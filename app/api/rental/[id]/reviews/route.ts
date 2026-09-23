import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { currentUserId } from "@/utils/user-auth";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10).max(2000),
});

async function findRental(key: string) {
  return prisma.rental.findFirst({
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
  const rental = await findRental((await params).id);
  if (!rental)
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  const reviews = await prisma.review.findMany({
    where: { rentalId: rental.id, target: "RENTAL", isPublished: true },
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
      `rental-review:${userId}:${clientIp(request)}`,
      5,
      60,
    );
    const rental = await findRental((await params).id);
    if (!rental)
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    const input = reviewSchema.parse(await request.json());
    const booking = await prisma.rentalBooking.findFirst({
      where: { userId, rentalId: rental.id, status: "COMPLETED" },
      orderBy: { returnDate: "desc" },
      select: { id: true },
    });
    if (!booking)
      return NextResponse.json(
        { error: "Only travelers with a completed rental can review it" },
        { status: 403 },
      );
    const review = await prisma.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: { rentalBookingId: booking.id },
        create: {
          userId,
          hostId: rental.hostId,
          rentalId: rental.id,
          rentalBookingId: booking.id,
          target: "RENTAL",
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
        where: { rentalId: rental.id, target: "RENTAL", isPublished: true },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.rental.update({
        where: { id: rental.id },
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
      { error: "Could not save rental review" },
      { status: 500 },
    );
  }
}
