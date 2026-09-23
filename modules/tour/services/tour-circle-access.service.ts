import { prisma } from "@/lib/prisma";

export type TourCircleAccessOptions = {
  allowCompletedTour?: boolean;
};

export function hasActiveCircleMembership(participant: {
  status: string;
  Booking: { status: string } | null;
} | null) {
  return Boolean(
    participant &&
      ["JOINED", "COMPLETED"].includes(participant.status) &&
      participant.Booking &&
      ["CONFIRMED", "COMPLETED"].includes(participant.Booking.status),
  );
}

export async function requireTourCircleAccess(
  userId: string,
  tourKey: string,
  options: TourCircleAccessOptions = {},
) {
  const tour = await prisma.tour.findFirst({
    where: { OR: [{ id: tourKey }, { slug: tourKey }], deletedAt: null },
    select: { id: true, hostId: true, title: true, tourStatus: true },
  });
  if (!tour) {
    throw Object.assign(new Error("Tour not found"), { statusCode: 404 });
  }
  if (tour.tourStatus === "CANCELLED" || (!options.allowCompletedTour && tour.tourStatus === "COMPLETED")) {
    throw Object.assign(new Error("This Trip Circle is closed"), { statusCode: 403 });
  }

  const [participant, host] = await Promise.all([
    prisma.tourParticipant.findUnique({
      where: { tourId_userId: { tourId: tour.id, userId } },
      select: {
        id: true,
        status: true,
        Booking: { select: { status: true } },
      },
    }),
    prisma.host.findFirst({
      where: {
        id: tour.hostId,
        userId,
        isActive: true,
        isApproved: true,
      },
      select: { id: true },
    }),
  ]);

  const activeParticipant = hasActiveCircleMembership(participant);
  if (!host && !activeParticipant) {
    throw Object.assign(
      new Error("A confirmed active booking is required for this Trip Circle"),
      { statusCode: 403 },
    );
  }
  return {
    tour,
    participant: activeParticipant ? participant : null,
    isHost: Boolean(host),
  };
}
