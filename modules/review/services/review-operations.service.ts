import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/utils/admin-auth";
import { queueNotification } from "@/modules/notification/services/notification-outbox.service";

export const hostReviewResponseSchema = z
  .object({ response: z.string().trim().min(10).max(1000) })
  .strict();
export const reviewModerationSchema = z
  .object({
    isPublished: z.boolean(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

const reviewInclude = {
  User: {
    select: {
      id: true,
      name: true,
      UserProfile: { select: { avatarUrl: true } },
    },
  },
  Tour: { select: { id: true, title: true, slug: true } },
  Activity: { select: { id: true, title: true, slug: true } },
  Rental: { select: { id: true, title: true, slug: true } },
} as const;

function present<
  T extends {
    Tour: { id: string; title: string; slug: string } | null;
    Activity: { id: string; title: string; slug: string } | null;
    Rental: { id: string; title: string; slug: string } | null;
  },
>(row: T) {
  const listing = row.Tour ?? row.Activity ?? row.Rental;
  return {
    ...row,
    listing: listing
      ? { id: listing.id, title: listing.title, slug: listing.slug }
      : null,
    Tour: undefined,
    Activity: undefined,
    Rental: undefined,
  };
}

export async function listHostReviews(hostId: string) {
  const rows = await prisma.review.findMany({
    where: { hostId },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const ratings = rows.map((row) => row.rating);
  return {
    data: rows.map(present),
    meta: {
      stats: {
        totalReviews: rows.length,
        averageRating: rows.length
          ? Number(
              (
                ratings.reduce((sum, value) => sum + value, 0) / rows.length
              ).toFixed(2),
            )
          : 0,
        positive: ratings.filter((value) => value >= 4).length,
        neutral: ratings.filter((value) => value === 3).length,
        negative: ratings.filter((value) => value <= 2).length,
      },
    },
  };
}

export async function respondToHostReview(
  hostId: string,
  userId: string,
  reviewId: string,
  raw: unknown,
) {
  const input = hostReviewResponseSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.review.findFirst({
      where: { id: reviewId, hostId },
    });
    if (!before)
      throw Object.assign(new Error("Review not found"), { statusCode: 404 });
    if (!before.isPublished)
      throw Object.assign(
        new Error("A hidden review cannot receive a public response"),
        { statusCode: 409 },
      );
    const updated = await tx.review.update({
      where: { id: before.id },
      data: { response: input.response, responseAt: new Date() },
      include: reviewInclude,
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: before.response
          ? "HOST_REVIEW_RESPONSE_UPDATED"
          : "HOST_REVIEW_RESPONDED",
        entity: "Review",
        entityId: before.id,
        oldData: { response: before.response },
        newData: { response: input.response },
        module: "reviews",
        severity: "INFO",
      },
    });
    await queueNotification(tx, {
      data: {
        userId: before.userId,
        type: "SYSTEM",
        title: "Host responded to your review",
        message: input.response,
        data: { reviewId: before.id, target: before.target },
      },
    });
    return present(updated);
  });
}

export async function listAdminReviews(status = "ALL") {
  const normalized = status.toUpperCase();
  if (!["ALL", "PUBLISHED", "HIDDEN", "LOW_RATING"].includes(normalized))
    throw Object.assign(new Error("Invalid review filter"), {
      statusCode: 400,
    });
  const where =
    normalized === "PUBLISHED"
      ? { isPublished: true }
      : normalized === "HIDDEN"
        ? { isPublished: false }
        : normalized === "LOW_RATING"
          ? { rating: { lte: 2 } }
          : {};
  return (
    await prisma.review.findMany({
      where,
      include: { ...reviewInclude, Host: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  ).map(present);
}

async function recomputeAggregate(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  review: {
    target: string;
    tourId: string | null;
    activityId: string | null;
    rentalId: string | null;
  },
) {
  if (review.target === "TOUR" && review.tourId) {
    const aggregate = await tx.review.aggregate({
      where: { tourId: review.tourId, target: "TOUR", isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.tour.update({
      where: { id: review.tourId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        totalReviews: aggregate._count.rating,
      },
    });
  }
  if (review.target === "ACTIVITY" && review.activityId) {
    const aggregate = await tx.review.aggregate({
      where: {
        activityId: review.activityId,
        target: "ACTIVITY",
        isPublished: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.activity.update({
      where: { id: review.activityId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        totalReviews: aggregate._count.rating,
      },
    });
  }
  if (review.target === "RENTAL" && review.rentalId) {
    const aggregate = await tx.review.aggregate({
      where: { rentalId: review.rentalId, target: "RENTAL", isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.rental.update({
      where: { id: review.rentalId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        totalReviews: aggregate._count.rating,
      },
    });
  }
}

export async function moderateReview(
  reviewId: string,
  admin: AdminSession,
  raw: unknown,
) {
  const input = reviewModerationSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.review.findUnique({ where: { id: reviewId } });
    if (!before)
      throw Object.assign(new Error("Review not found"), { statusCode: 404 });
    if (before.isPublished === input.isPublished) return before;
    const claim = await tx.review.updateMany({
      where: { id: reviewId, isPublished: before.isPublished },
      data: { isPublished: input.isPublished },
    });
    if (claim.count !== 1)
      throw Object.assign(
        new Error("Review moderation is already being processed"),
        { statusCode: 409 },
      );
    await recomputeAggregate(tx, before);
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: input.isPublished ? "REVIEW_PUBLISHED" : "REVIEW_HIDDEN",
        entity: "Review",
        entityId: reviewId,
        oldData: { isPublished: before.isPublished },
        newData: { isPublished: input.isPublished, reason: input.reason },
        module: "reviews",
        severity: input.isPublished ? "INFO" : "WARN",
      },
    });
    await queueNotification(tx, {
      data: {
        userId: before.userId,
        type: "SYSTEM",
        title: input.isPublished
          ? "Your review is visible"
          : "Your review was hidden",
        message: input.reason,
        data: {
          reviewId,
          target: before.target,
          isPublished: input.isPublished,
        },
      },
    });
    return tx.review.findUniqueOrThrow({ where: { id: reviewId } });
  });
}
