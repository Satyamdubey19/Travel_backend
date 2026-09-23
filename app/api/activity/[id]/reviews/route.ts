import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/utils/user-auth";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10).max(2000),
});

async function findActivity(key: string) {
  return prisma.activity.findFirst({
    where: {
      OR: [{ id: key }, { slug: key }],
      status: "ACTIVE",
      isActive: true,
      isApproved: true,
      Host: { is: { isActive: true, isApproved: true, isVerified: true } },
    },
    select: { id: true, hostId: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const activity = await findActivity((await params).id);
  if (!activity)
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  const reviews = await prisma.review.findMany({
    where: { activityId: activity.id, target: "ACTIVITY", isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      response: true,
      responseAt: true,
      createdAt: true,
      User: {
        select: { name: true, UserProfile: { select: { avatarUrl: true } } },
      },
    },
  });
  return NextResponse.json({
    data: reviews.map((review) => ({
      ...review,
      createdAt: review.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await currentUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await assertRateLimit(
      `activity-review:${userId}:${clientIp(request)}`,
      5,
      60,
    );
    const activity = await findActivity((await params).id);
    if (!activity)
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 },
      );
    const input = reviewSchema.parse(await request.json());
    const booking = await prisma.activityBooking.findFirst({
      where: { userId, activityId: activity.id, status: "COMPLETED" },
      orderBy: { date: "desc" },
      select: { id: true },
    });
    if (!booking)
      return NextResponse.json(
        { error: "Only travelers with a completed activity can review it" },
        { status: 403 },
      );

    const review = await prisma.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: { activityBookingId: booking.id },
        create: {
          userId,
          hostId: activity.hostId,
          activityId: activity.id,
          activityBookingId: booking.id,
          target: "ACTIVITY",
          rating: input.rating,
          title: input.title || null,
          comment: input.comment,
          isPublished: true,
        },
        update: {
          rating: input.rating,
          title: input.title || null,
          comment: input.comment,
        },
      });
      const aggregate = await tx.review.aggregate({
        where: {
          activityId: activity.id,
          target: "ACTIVITY",
          isPublished: true,
        },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.activity.update({
        where: { id: activity.id },
        data: {
          averageRating: aggregate._avg.rating ?? 0,
          totalReviews: aggregate._count.rating,
        },
      });
      return saved;
    });
    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Rating must be 1-5 and comment must be 10-2000 characters" },
        { status: 400 },
      );
    return NextResponse.json(
      { error: "Could not save activity review" },
      { status: 500 },
    );
  }
}
