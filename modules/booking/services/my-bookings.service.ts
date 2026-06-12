import { prisma } from "@/lib/prisma"
import type { UnifiedBookingRecord } from "@/types/my-bookings"

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function toAmount(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function sortByNewest(a: UnifiedBookingRecord, b: UnifiedBookingRecord) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

export async function listUnifiedBookingsForUser(userId: string): Promise<UnifiedBookingRecord[]> {
  const [tourBookings, rentalBookings, activityBookings] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, tourId: { not: null } },
      include: {
        Tour: { select: { id: true, title: true, destination: true, city: true, slug: true, startDate: true, endDate: true } },
        Payment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.rentalBooking.findMany({
      where: { userId },
      include: {
        Rental: { select: { id: true, title: true, city: true, slug: true, vehicleType: true } },
        RentalPayment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityBooking.findMany({
      where: { userId },
      include: {
        Activity: { select: { id: true, title: true, city: true, slug: true, category: true } },
        ActivityPayment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const baseBookings: UnifiedBookingRecord[] = tourBookings.map((booking) => ({
    id: booking.id,
    bookingCode: booking.bookingCode,
    bookingType: "TOUR",
    status: booking.status,
    totalAmount: toAmount(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    startDate: toIso(booking.Tour?.startDate ?? booking.checkIn),
    endDate: toIso(booking.Tour?.endDate ?? booking.checkOut),
    title: booking.Tour?.title ?? "Tour booking",
    subtitle: booking.Tour?.destination ?? "Tour reservation",
    location: booking.Tour?.city ?? null,
    href: booking.Tour?.slug ? `/tours/${booking.Tour.slug}` : "/tours",
    paymentStatus: booking.Payment?.status ?? null,
  }))

  const rentalRecords: UnifiedBookingRecord[] = rentalBookings.map((booking) => ({
    id: booking.id,
    bookingCode: booking.bookingCode,
    bookingType: "RENTAL",
    status: booking.status,
    totalAmount: toAmount(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    startDate: booking.pickupDate.toISOString(),
    endDate: booking.returnDate.toISOString(),
    title: booking.Rental?.title ?? "Rental booking",
    subtitle: booking.Rental?.vehicleType ? `${booking.Rental.vehicleType} rental` : "Vehicle reservation",
    location: booking.Rental?.city ?? null,
    href: booking.Rental?.slug ? `/car-rental/${booking.Rental.slug}` : "/car-rental",
    paymentStatus: booking.RentalPayment?.status ?? null,
  }))

  const activityRecords: UnifiedBookingRecord[] = activityBookings.map((booking) => ({
    id: booking.id,
    bookingCode: booking.bookingCode,
    bookingType: "ACTIVITY",
    status: booking.status,
    totalAmount: toAmount(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    startDate: booking.date.toISOString(),
    endDate: null,
    title: booking.Activity?.title ?? "Activity booking",
    subtitle: booking.Activity?.category ? `${booking.Activity.category} activity` : "Activity reservation",
    location: booking.Activity?.city ?? null,
    href: booking.Activity?.slug ? `/activities/${booking.Activity.slug}` : "/activities",
    paymentStatus: booking.ActivityPayment?.status ?? null,
  }))

  return [...baseBookings, ...rentalRecords, ...activityRecords].sort(sortByNewest)
}
