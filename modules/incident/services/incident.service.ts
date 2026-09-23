import { randomBytes } from "node:crypto";
import { Prisma, type IncidentSeverity, type IncidentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/utils/admin-auth";
import { queueNotification } from "@/modules/notification/services/notification-outbox.service";
import {
  assertIncidentTransition,
  statusForIncidentAction,
} from "./incident-policy";

export const createIncidentSchema = z
  .object({
    bookingId: z.string().uuid(),
    category: z.enum([
      "SAFETY",
      "HARASSMENT",
      "MEDICAL",
      "TRANSPORT",
      "HOST_CONDUCT",
      "TRAVELER_CONDUCT",
      "LOST_PERSON",
      "PROPERTY",
      "OTHER",
    ]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    title: z.string().trim().min(10).max(160),
    description: z.string().trim().min(30).max(4_000),
    immediateDanger: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.immediateDanger && !["HIGH", "CRITICAL"].includes(value.severity)) {
      context.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Immediate danger reports must be marked high or critical",
      });
    }
  });

export const adminIncidentActionSchema = z
  .object({
    action: z.enum([
      "TRIAGE",
      "ASSIGN_SELF",
      "START_INVESTIGATION",
      "RESOLVE",
      "CLOSE",
      "PAUSE_TOUR",
      "SUSPEND_HOST",
      "ADD_NOTE",
    ]),
    notes: z.string().trim().min(20).max(4_000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (["RESOLVE", "CLOSE"].includes(value.action) && value.notes.length < 40) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Resolution and closure notes must contain at least 40 characters",
      });
    }
  });

const incidentInclude = {
  Reporter: { select: { id: true, name: true, email: true } },
  Owner: { select: { id: true, name: true, email: true } },
  Booking: { select: { id: true, bookingCode: true, status: true } },
  Tour: { select: { id: true, title: true, slug: true, status: true, isActive: true, isApproved: true, moderationNotes: true } },
  Host: {
    select: {
      id: true,
      userId: true,
      businessName: true,
      isActive: true,
      isApproved: true,
      moderationNotes: true,
    },
  },
  IncidentEvent: {
    select: {
      id: true,
      action: true,
      note: true,
      oldStatus: true,
      newStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function incidentReference() {
  return `INC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function listReportedIncidents(userId: string) {
  return prisma.incident.findMany({
    where: { reporterId: userId },
    select: {
      id: true,
      referenceCode: true,
      category: true,
      severity: true,
      status: true,
      title: true,
      immediateDanger: true,
      createdAt: true,
      updatedAt: true,
      Tour: { select: { title: true, slug: true } },
      Booking: { select: { bookingCode: true } },
      IncidentEvent: {
        where: { action: { in: ["REPORTED", "TRIAGE", "START_INVESTIGATION", "RESOLVE", "CLOSE"] } },
        select: { action: true, oldStatus: true, newStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createIncident(userId: string, raw: unknown) {
  const input = createIncidentSchema.parse(raw);
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      bookingCode: true,
      userId: true,
      tourId: true,
      hostId: true,
      Host: { select: { userId: true } },
    },
  });
  if (!booking?.tourId) {
    throw Object.assign(new Error("Tour booking not found"), { statusCode: 404 });
  }
  if (booking.userId !== userId && booking.Host.userId !== userId) {
    throw Object.assign(new Error("You cannot report an incident for this booking"), {
      statusCode: 403,
    });
  }

  return prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        referenceCode: incidentReference(),
        reporterId: userId,
        bookingId: booking.id,
        tourId: booking.tourId!,
        hostId: booking.hostId,
        category: input.category,
        severity: input.severity,
        title: input.title,
        description: input.description,
        immediateDanger: input.immediateDanger,
        IncidentEvent: {
          create: {
            actorId: userId,
            action: "REPORTED",
            newStatus: "OPEN",
            note: "Incident submitted to the private operations queue.",
          },
        },
      },
      include: incidentInclude,
    });
    const admins = await tx.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", isActive: true, isBanned: false },
      select: { id: true },
    });
    for (const admin of admins) {
      await queueNotification(tx, {
        data: {
          userId: admin.id,
          type: "SYSTEM",
          title: input.severity === "CRITICAL" ? "Critical incident awaiting triage" : "New incident awaiting triage",
          message: `${incident.referenceCode} requires private operations review. Open the incident queue; sensitive details are not included in email.`,
          data: { incidentId: incident.id, referenceCode: incident.referenceCode },
        },
      });
    }
    return {
      id: incident.id,
      referenceCode: incident.referenceCode,
      status: incident.status,
      severity: incident.severity,
      createdAt: incident.createdAt,
    };
  });
}

export async function listAdminIncidents(status = "ACTIVE") {
  const normalized = status.toUpperCase();
  if (!["ACTIVE", "OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "ALL"].includes(normalized)) {
    throw Object.assign(new Error("Invalid incident status"), { statusCode: 400 });
  }
  const where: Prisma.IncidentWhereInput =
    normalized === "ALL"
      ? {}
      : normalized === "ACTIVE"
        ? { status: { in: ["OPEN", "TRIAGED", "IN_PROGRESS"] } }
        : { status: normalized as IncidentStatus };
  const rows = await prisma.incident.findMany({
    where,
    include: incidentInclude,
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const priority: Record<IncidentSeverity, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  };
  return rows.sort(
    (left, right) =>
      priority[right.severity] - priority[left.severity] ||
      left.createdAt.getTime() - right.createdAt.getTime(),
  );
}

export async function performAdminIncidentAction(
  id: string,
  admin: AdminSession,
  raw: unknown,
) {
  const input = adminIncidentActionSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.incident.findUnique({ where: { id }, include: incidentInclude });
    if (!before) throw Object.assign(new Error("Incident not found"), { statusCode: 404 });

    const requestedStatus = statusForIncidentAction(input.action);
    if (requestedStatus) assertIncidentTransition(before.status, requestedStatus);
    if (input.action === "ASSIGN_SELF" && before.ownerId && before.ownerId !== admin.id) {
      throw Object.assign(new Error("Incident is already assigned to another administrator"), { statusCode: 409 });
    }

    const now = new Date();
    const update: Prisma.IncidentUncheckedUpdateManyInput = {
      ownerId: input.action === "ASSIGN_SELF" ? admin.id : before.ownerId,
      severity: input.severity ?? before.severity,
    };
    if (requestedStatus) update.status = requestedStatus;
    if (requestedStatus === "TRIAGED") update.triagedAt = now;
    if (requestedStatus === "RESOLVED") {
      update.resolvedAt = now;
      update.resolutionSummary = input.notes;
    }
    if (requestedStatus === "CLOSED") {
      update.closedAt = now;
      update.resolutionSummary = input.notes;
    }

    const claim = await tx.incident.updateMany({
      where: { id, status: before.status, updatedAt: before.updatedAt },
      data: update,
    });
    if (claim.count !== 1) {
      throw Object.assign(new Error("Incident changed while this action was being processed"), { statusCode: 409 });
    }

    if (input.action === "PAUSE_TOUR") {
      await tx.tour.update({
        where: { id: before.tourId },
        data: {
          status: "PAUSED",
          isActive: false,
          isApproved: false,
          moderationNotes: [before.Tour.moderationNotes, `Paused during incident ${before.referenceCode}. ${input.notes}`].filter(Boolean).join("\n"),
          reviewedAt: now,
          reviewedById: admin.id,
        },
      });
    }
    if (input.action === "SUSPEND_HOST") {
      await tx.host.update({
        where: { id: before.hostId },
        data: {
          isActive: false,
          isApproved: false,
          suspendedAt: now,
          moderationNotes: [before.Host.moderationNotes, `Suspended during incident ${before.referenceCode}. ${input.notes}`].filter(Boolean).join("\n"),
          reviewedAt: now,
          reviewedById: admin.id,
        },
      });
    }

    await tx.incidentEvent.create({
      data: {
        incidentId: id,
        actorId: admin.id,
        action: input.action,
        note: input.notes,
        oldStatus: before.status,
        newStatus: requestedStatus ?? before.status,
        metadata: {
          previousSeverity: before.severity,
          newSeverity: input.severity ?? before.severity,
        },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: `INCIDENT_${input.action}`,
        entity: "Incident",
        entityId: id,
        oldData: {
          status: before.status,
          severity: before.severity,
          ownerId: before.ownerId,
          restrictionTarget: input.action === "PAUSE_TOUR"
            ? { entity: "Tour", id: before.tourId, status: before.Tour.status, isActive: before.Tour.isActive, isApproved: before.Tour.isApproved }
            : input.action === "SUSPEND_HOST"
              ? { entity: "Host", id: before.hostId, isActive: before.Host.isActive, isApproved: before.Host.isApproved }
              : undefined,
        },
        newData: {
          status: requestedStatus ?? before.status,
          severity: input.severity ?? before.severity,
          ownerId: input.action === "ASSIGN_SELF" ? admin.id : before.ownerId,
          notes: input.notes,
        },
        module: "incident",
        severity: ["PAUSE_TOUR", "SUSPEND_HOST"].includes(input.action) ? "CRITICAL" : "WARN",
      },
    });
    await queueNotification(tx, {
      data: {
        userId: before.reporterId,
        type: "SYSTEM",
        title: `Incident ${before.referenceCode} updated`,
        message: requestedStatus
          ? `Your private incident report is now ${requestedStatus.toLowerCase().replaceAll("_", " ")}. Open your incident history for the latest status.`
          : "Your private incident report received an operations update. Open your incident history for the latest status.",
        data: { incidentId: id, referenceCode: before.referenceCode },
      },
    });
    if (["PAUSE_TOUR", "SUSPEND_HOST"].includes(input.action) && before.Host.userId !== before.reporterId) {
      await queueNotification(tx, {
        data: {
          userId: before.Host.userId,
          type: "SYSTEM",
          title: input.action === "PAUSE_TOUR" ? "Tour paused for operations review" : "Host operations suspended for review",
          message: `${before.referenceCode} triggered an administrative restriction. Review the host dashboard and contact platform operations for the reasoned decision.`,
          data: { incidentId: id, referenceCode: before.referenceCode },
        },
      });
    }
    return tx.incident.findUniqueOrThrow({ where: { id }, include: incidentInclude });
  });
}
