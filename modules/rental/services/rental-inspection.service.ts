import { Prisma, type RentalInspectionStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import {
  assertInspectionReady,
  inspectionDraftSchema,
  inspectionResponseSchema,
} from "@/modules/rental/validators/rental-inspection.validators";
import { queueNotification } from "@/modules/notification/services/notification-outbox.service";

function missing(message: string, statusCode = 404) {
  return Object.assign(new Error(message), { statusCode });
}
const inspectionOrder = [{ stage: "asc" as const }];

function withEvidenceUrls<T extends { evidenceAssetIds: string[] }>(
  inspection: T,
) {
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  return {
    ...inspection,
    evidenceUrls: inspection.evidenceAssetIds.map((assetId) =>
      cloudinary.url(assetId, {
        type: "authenticated",
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
      }),
    ),
  };
}

export async function listHostRentalInspections(
  hostId: string,
  bookingId: string,
) {
  const booking = await prisma.rentalBooking.findFirst({
    where: { id: bookingId, hostId },
    select: { id: true },
  });
  if (!booking) throw missing("Rental booking not found");
  return (
    await prisma.rentalInspection.findMany({
      where: { bookingId },
      orderBy: inspectionOrder,
    })
  ).map(withEvidenceUrls);
}

export async function saveHostRentalInspection(
  hostId: string,
  userId: string,
  bookingId: string,
  stage: RentalInspectionStage,
  raw: unknown,
) {
  const input = inspectionDraftSchema.parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.rentalBooking.findFirst({
        where: { id: bookingId, hostId },
        include: { RentalPayment: true },
      });
      if (!booking) throw missing("Rental booking not found");
      if (
        booking.RentalPayment?.status !== "SUCCESS" ||
        !["CONFIRMED", "COMPLETED"].includes(booking.status)
      )
        throw missing(
          "Only paid confirmed rentals can have custody inspections",
          409,
        );
      const existing = await tx.rentalInspection.findUnique({
        where: { bookingId_stage: { bookingId, stage } },
      });
      if (existing && existing.status !== "DRAFT")
        throw missing("Submitted inspection evidence is immutable", 409);
      if (stage === "RETURN") {
        const pickup = await tx.rentalInspection.findUnique({
          where: { bookingId_stage: { bookingId, stage: "PICKUP" } },
        });
        if (!pickup || pickup.status === "DRAFT")
          throw missing("Submit pickup evidence before recording return", 409);
      }
      const saved = await tx.rentalInspection.upsert({
        where: { bookingId_stage: { bookingId, stage } },
        create: {
          bookingId,
          stage,
          recordedByUserId: userId,
          ...input,
          checklist: input.checklist,
          damages: input.damages,
        },
        update: {
          ...input,
          checklist: input.checklist,
          damages: input.damages,
          recordedByUserId: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "RENTAL_INSPECTION_DRAFT_SAVED",
          entity: "RentalInspection",
          entityId: saved.id,
          newData: {
            bookingId,
            stage,
            evidenceCount: input.evidenceAssetIds.length,
          },
          module: "rental",
          severity: "INFO",
        },
      });
      return saved;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submitHostRentalInspection(
  hostId: string,
  userId: string,
  bookingId: string,
  stage: RentalInspectionStage,
) {
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.rentalBooking.findFirst({
        where: { id: bookingId, hostId },
        include: { RentalPayment: true },
      });
      if (!booking) throw missing("Rental booking not found");
      if (
        booking.RentalPayment?.status !== "SUCCESS" ||
        !["CONFIRMED", "COMPLETED"].includes(booking.status)
      )
        throw missing(
          "Only paid confirmed rentals can have custody inspections",
          409,
        );
      const inspection = await tx.rentalInspection.findUnique({
        where: { bookingId_stage: { bookingId, stage } },
      });
      if (!inspection)
        throw missing("Save the inspection draft before submission");
      if (inspection.status !== "DRAFT") return inspection;
      const parsed = inspectionDraftSchema.parse({
        odometerKm: inspection.odometerKm,
        fuelOrChargePercent: inspection.fuelOrChargePercent,
        conditionNotes: inspection.conditionNotes,
        checklist: inspection.checklist,
        damages: inspection.damages,
        evidenceAssetIds: inspection.evidenceAssetIds,
      });
      assertInspectionReady(parsed);
      const claim = await tx.rentalInspection.updateMany({
        where: { id: inspection.id, status: "DRAFT" },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      if (claim.count !== 1)
        throw missing("Inspection submission is already being processed", 409);
      await tx.rentalBookingTimeline.create({
        data: {
          bookingId,
          type: stage === "PICKUP" ? "CHECKED_IN" : "CHECKED_OUT",
          title: `${stage === "PICKUP" ? "Pickup" : "Return"} condition report submitted`,
          message:
            "The traveler must acknowledge or dispute this immutable condition snapshot.",
        },
      });
      await queueNotification(tx, {
        data: {
          userId: booking.userId,
          type: "SYSTEM",
          title: `${stage === "PICKUP" ? "Pickup" : "Return"} inspection needs your review`,
          message: `Review the condition evidence for booking ${booking.bookingCode} and acknowledge it or report a mismatch.`,
          data: { bookingId, product: "rental", inspectionStage: stage },
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "RENTAL_INSPECTION_SUBMITTED",
          entity: "RentalInspection",
          entityId: inspection.id,
          oldData: { status: "DRAFT" },
          newData: { status: "SUBMITTED", bookingId, stage },
          module: "rental",
          severity: "INFO",
        },
      });
      return tx.rentalInspection.findUniqueOrThrow({
        where: { id: inspection.id },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function listTravelerRentalInspections(
  userId: string,
  bookingId: string,
) {
  const booking = await prisma.rentalBooking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true },
  });
  if (!booking) throw missing("Rental booking not found");
  return (
    await prisma.rentalInspection.findMany({
      where: { bookingId, status: { not: "DRAFT" } },
      orderBy: inspectionOrder,
    })
  ).map((inspection) => ({
    ...withEvidenceUrls(inspection),
    evidenceAssetIds: [],
  }));
}

export async function respondToRentalInspection(
  userId: string,
  bookingId: string,
  stage: RentalInspectionStage,
  raw: unknown,
) {
  const input = inspectionResponseSchema.parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.rentalBooking.findFirst({
        where: { id: bookingId, userId },
        include: { Host: { select: { userId: true } } },
      });
      if (!booking) throw missing("Rental booking not found");
      const inspection = await tx.rentalInspection.findUnique({
        where: { bookingId_stage: { bookingId, stage } },
      });
      if (!inspection || inspection.status === "DRAFT")
        throw missing("Submitted inspection not found");
      if (["ACKNOWLEDGED", "DISPUTED", "RESOLVED"].includes(inspection.status))
        return inspection;
      const now = new Date();
      const status =
        input.action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : "DISPUTED";
      const claim = await tx.rentalInspection.updateMany({
        where: { id: inspection.id, status: "SUBMITTED" },
        data:
          input.action === "ACKNOWLEDGE"
            ? { status, acknowledgedByUserId: userId, acknowledgedAt: now }
            : {
                status,
                disputedByUserId: userId,
                disputedAt: now,
                disputeReason: input.reason,
              },
      });
      if (claim.count !== 1)
        throw missing("Inspection response is already being processed", 409);
      if (
        input.action === "ACKNOWLEDGE" &&
        stage === "RETURN" &&
        booking.status === "CONFIRMED"
      ) {
        await tx.rentalBooking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED" },
        });
        await tx.rentalBookingTimeline.create({
          data: {
            bookingId,
            type: "COMPLETED",
            title: "Rental return acknowledged",
            message:
              "The traveler acknowledged the return condition report and custody was closed.",
          },
        });
      }
      await queueNotification(tx, {
        data: {
          userId: booking.Host.userId,
          type: "SYSTEM",
          title: `Traveler ${input.action === "ACKNOWLEDGE" ? "acknowledged" : "disputed"} the ${stage.toLowerCase()} report`,
          message:
            input.action === "DISPUTE"
              ? input.reason
              : `Booking ${booking.bookingCode} custody evidence was accepted.`,
          data: {
            bookingId,
            product: "rental",
            inspectionStage: stage,
            status,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: `RENTAL_INSPECTION_${status}`,
          entity: "RentalInspection",
          entityId: inspection.id,
          oldData: { status: "SUBMITTED" },
          newData: {
            status,
            bookingId,
            stage,
            reason: input.action === "DISPUTE" ? input.reason : undefined,
          },
          module: "rental",
          severity: input.action === "DISPUTE" ? "WARN" : "INFO",
        },
      });
      return tx.rentalInspection.findUniqueOrThrow({
        where: { id: inspection.id },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
