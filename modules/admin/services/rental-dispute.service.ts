import { z } from "zod";
import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/utils/admin-auth";
import { queueNotification } from "@/modules/notification/services/notification-outbox.service";

export const resolveRentalDisputeSchema = z
  .object({
    resolution: z.enum([
      "HOST_EVIDENCE_ACCEPTED",
      "TRAVELER_CLAIM_ACCEPTED",
      "MUTUAL_SETTLEMENT",
      "NO_FINANCIAL_ACTION",
    ]),
    notes: z.string().trim().min(20).max(2000),
  })
  .strict();

function evidenceUrls(ids: string[]) {
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  return ids.map((assetId) =>
    cloudinary.url(assetId, {
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: expiresAt,
    }),
  );
}

const disputeInclude = {
  RentalBooking: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
      pickupDate: true,
      returnDate: true,
      User: { select: { id: true, name: true, email: true } },
      Host: { select: { id: true, userId: true, businessName: true } },
      Rental: { select: { id: true, title: true, slug: true, city: true } },
    },
  },
} as const;

function present<T extends { evidenceAssetIds: string[] }>(row: T) {
  return {
    ...row,
    evidenceUrls: evidenceUrls(row.evidenceAssetIds),
    evidenceAssetIds: [],
  };
}

export async function listRentalDisputes(status = "DISPUTED") {
  const normalized = status.toUpperCase();
  if (!["DISPUTED", "RESOLVED", "ALL"].includes(normalized))
    throw Object.assign(new Error("Invalid dispute status"), {
      statusCode: 400,
    });
  const rows = await prisma.rentalInspection.findMany({
    where:
      normalized === "ALL"
        ? { status: { in: ["DISPUTED", "RESOLVED"] } }
        : { status: normalized as "DISPUTED" | "RESOLVED" },
    include: disputeInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(present);
}

export async function resolveRentalDispute(
  id: string,
  admin: AdminSession,
  raw: unknown,
) {
  const input = resolveRentalDisputeSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.rentalInspection.findUnique({
      where: { id },
      include: disputeInclude,
    });
    if (!before)
      throw Object.assign(new Error("Rental dispute not found"), {
        statusCode: 404,
      });
    if (before.status === "RESOLVED") {
      if (
        before.resolution === input.resolution &&
        before.resolutionNotes === input.notes
      )
        return present(before);
      throw Object.assign(new Error("This dispute is already resolved"), {
        statusCode: 409,
      });
    }
    if (before.status !== "DISPUTED")
      throw Object.assign(
        new Error("Only disputed inspections can be resolved"),
        { statusCode: 409 },
      );
    const claim = await tx.rentalInspection.updateMany({
      where: { id, status: "DISPUTED" },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolutionNotes: input.notes,
        resolvedByUserId: admin.id,
        resolvedAt: new Date(),
      },
    });
    if (claim.count !== 1)
      throw Object.assign(
        new Error("Dispute resolution is already being processed"),
        { statusCode: 409 },
      );
    await tx.rentalBookingTimeline.create({
      data: {
        bookingId: before.bookingId,
        type: "CHECKED_OUT",
        title: `${before.stage === "PICKUP" ? "Pickup" : "Return"} evidence dispute resolved`,
        message:
          "An administrator recorded a reasoned evidence decision. Financial adjustments, if any, require a separate reviewed payment operation.",
      },
    });
    const message = `The ${before.stage.toLowerCase()} evidence dispute for ${before.RentalBooking.bookingCode} was resolved as ${input.resolution.toLowerCase().replaceAll("_", " ")}. ${input.notes}`;
    for (const notification of [
        {
          userId: before.RentalBooking.User.id,
          type: "SYSTEM" as const,
          title: "Rental evidence dispute resolved",
          message,
          data: {
            bookingId: before.bookingId,
            inspectionId: id,
            resolution: input.resolution,
          },
        },
        {
          userId: before.RentalBooking.Host.userId,
          type: "SYSTEM" as const,
          title: "Rental evidence dispute resolved",
          message,
          data: {
            bookingId: before.bookingId,
            inspectionId: id,
            resolution: input.resolution,
          },
        },
      ]) {
      await queueNotification(tx, { data: notification });
    }
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "RENTAL_DISPUTE_RESOLVED",
        entity: "RentalInspection",
        entityId: id,
        oldData: { status: before.status, disputeReason: before.disputeReason },
        newData: {
          status: "RESOLVED",
          resolution: input.resolution,
          notes: input.notes,
        },
        module: "rental",
        severity: "WARN",
      },
    });
    return present(
      await tx.rentalInspection.findUniqueOrThrow({
        where: { id },
        include: disputeInclude,
      }),
    );
  });
}
