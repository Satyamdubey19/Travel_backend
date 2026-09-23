import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/utils/user-auth";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import type { IdRouteParams as Params } from "@/types/routes";

async function findTour(id: string) {
  return prisma.tour.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      deletedAt: null,
      status: "ACTIVE",
      isActive: true,
      isApproved: true,
      Host: { is: { isActive: true, isApproved: true, isVerified: true } },
    },
    select: { id: true, hostId: true },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const tour = await findTour((await params).id);
  if (!tour)
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });

  const reviews = await prisma.$queryRaw`
    SELECT r."id", r."rating", r."title", r."comment", r."response", r."responseAt", r."createdAt",
           json_build_object(
             'name', u."name",
             'UserProfile', json_build_object('avatarUrl', up."avatarUrl")
           ) AS "User"
    FROM "Review" r
    JOIN "User" u ON u."id" = r."userId"
    LEFT JOIN "UserProfile" up ON up."userId" = u."id"
    WHERE r."tourId" = ${tour.id}
      AND COALESCE(r."isPublished", true) = true
    ORDER BY r."createdAt" DESC
    LIMIT 25
  `;

  return NextResponse.json({ data: reviews });
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await currentUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await assertRateLimit(`tour-review:${userId}:${clientIp(req)}`, 5, 60);

  const tour = await findTour((await params).id);
  if (!tour)
    return NextResponse.json({ error: "Tour not found" }, { status: 404 });

  const completedBooking = await prisma.booking.findFirst({
    where: { userId, tourId: tour.id, status: "COMPLETED" },
    select: { id: true },
  });
  if (!completedBooking)
    return NextResponse.json(
      { error: "Only completed travelers can review this tour" },
      { status: 403 },
    );

  const body = (await req.json().catch(() => ({}))) as {
    rating?: number;
    title?: string;
    comment?: string;
  };
  const rating = Math.trunc(Number(body.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 },
    );
  if (
    !body.comment?.trim() ||
    body.comment.trim().length < 10 ||
    body.comment.trim().length > 2000
  )
    return NextResponse.json(
      { error: "Review comment must be 10-2000 characters" },
      { status: 400 },
    );
  const comment = body.comment.trim();
  const title = body.title?.trim();
  if (title && title.length > 120)
    return NextResponse.json(
      { error: "Review title must be 120 characters or fewer" },
      { status: 400 },
    );

  const review = await prisma.$transaction(async (tx) => {
    const saved = await tx.review.upsert({
      where: { bookingId: completedBooking.id },
      create: {
        userId,
        hostId: tour.hostId,
        tourId: tour.id,
        bookingId: completedBooking.id,
        target: "TOUR",
        rating,
        title: title || null,
        comment,
        isPublished: true,
      },
      update: { rating, title: title || null, comment },
    });
    const aggregate = await tx.review.aggregate({
      where: { tourId: tour.id, target: "TOUR", isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.tour.update({
      where: { id: tour.id },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        totalReviews: aggregate._count.rating,
      },
    });
    return saved;
  });

  return NextResponse.json({ data: review }, { status: 201 });
}
