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
        RentalRefund: { select: { status: true, approvedAmount: true, requestedAmount: true, failureReason: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityBooking.findMany({
      where: { userId },
      include: {
        Activity: { select: { id: true, title: true, city: true, slug: true, category: true } },
        ActivityPayment: { select: { status: true } },
        ActivityRefund: { select: { status: true, approvedAmount: true, requestedAmount: true, failureReason: true } },
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
    refundStatus: booking.RentalRefund?.status ?? null,
    refundAmount: toAmount(booking.RentalRefund?.approvedAmount ?? booking.RentalRefund?.requestedAmount),
    refundMessage: booking.RentalRefund?.failureReason ?? null,
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
    refundStatus: booking.ActivityRefund?.status ?? null,
    refundAmount: toAmount(booking.ActivityRefund?.approvedAmount ?? booking.ActivityRefund?.requestedAmount),
    refundMessage: booking.ActivityRefund?.failureReason ?? null,
  }))

  return [...baseBookings, ...rentalRecords, ...activityRecords].sort(sortByNewest)
}

export async function getUnifiedBookingForUser(userId: string, type: string, id: string) {
  if (type === "activity") {
    const booking = await prisma.activityBooking.findFirst({ where: { id, userId }, include: { Activity: { select: { title: true, slug: true, city: true, area: true, cancellationPolicy: true, Host: { select: { businessName: true } } } }, ActivityPayment: true, ActivityRefund: true, ActivityBookingTimeline: { orderBy: { createdAt: "asc" } } } })
    if (!booking) return null
    return { id: booking.id, type: "ACTIVITY", bookingCode: booking.bookingCode, status: booking.status, title: booking.Activity.title, listingHref: `/activities/${booking.Activity.slug}`, location: [booking.Activity.area,booking.Activity.city].filter(Boolean).join(", "), startDate: booking.date.toISOString(), endDate: null, contact: { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone }, quantityLabel: `${booking.guestCount} guest${booking.guestCount===1?"":"s"}`, subtotal: toAmount(booking.subtotal), taxes: toAmount(booking.taxes), totalAmount: toAmount(booking.totalAmount), currency: booking.currency, paymentStatus: booking.ActivityPayment?.status ?? null, cancellationPolicy: booking.Activity.cancellationPolicy, cancellationReason: booking.cancellationReason, refund: booking.ActivityRefund ? { status: booking.ActivityRefund.status, requestedAmount: toAmount(booking.ActivityRefund.requestedAmount), approvedAmount: booking.ActivityRefund.approvedAmount == null ? null : toAmount(booking.ActivityRefund.approvedAmount), providerRefundId: booking.ActivityRefund.providerRefundId, failureReason: booking.ActivityRefund.failureReason } : null, hostName: booking.Activity.Host.businessName, notes: booking.specialRequests, timeline: booking.ActivityBookingTimeline.map((item)=>({ type:item.type,title:item.title,message:item.message,createdAt:item.createdAt.toISOString() })) }
  }
  if (type === "rental") {
    const booking = await prisma.rentalBooking.findFirst({ where: { id, userId }, include: { Rental: { select: { title: true, slug: true, city: true, pickupArea: true, cancellationPolicy: true, Host: { select: { businessName: true } } } }, RentalPayment: true, RentalRefund: true, RentalBookingTimeline: { orderBy: { createdAt: "asc" } } } })
    if (!booking) return null
    return { id: booking.id, type: "RENTAL", bookingCode: booking.bookingCode, status: booking.status, title: booking.Rental.title, listingHref: `/car-rental/${booking.Rental.slug}`, location: [booking.Rental.pickupArea,booking.Rental.city].filter(Boolean).join(", "), startDate: booking.pickupDate.toISOString(), endDate: booking.returnDate.toISOString(), contact: { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone }, quantityLabel: `${booking.days} day${booking.days===1?"":"s"}`, subtotal: toAmount(booking.subtotal), taxes: toAmount(booking.taxes), totalAmount: toAmount(booking.totalAmount), currency: booking.currency, paymentStatus: booking.RentalPayment?.status ?? null, cancellationPolicy: booking.Rental.cancellationPolicy, cancellationReason: booking.cancellationReason, refund: booking.RentalRefund ? { status: booking.RentalRefund.status, requestedAmount: toAmount(booking.RentalRefund.requestedAmount), approvedAmount: booking.RentalRefund.approvedAmount == null ? null : toAmount(booking.RentalRefund.approvedAmount), providerRefundId: booking.RentalRefund.providerRefundId, failureReason: booking.RentalRefund.failureReason } : null, hostName: booking.Rental.Host.businessName, notes: booking.notes, timeline: booking.RentalBookingTimeline.map((item)=>({ type:item.type,title:item.title,message:item.message,createdAt:item.createdAt.toISOString() })) }
  }
  if (type === "tour") {
    const booking = await prisma.booking.findFirst({ where: { id, userId, tourId: { not: null } }, include: { Tour: { select: { title: true, slug: true, destination: true, city: true, cancellationPolicy: true, Host: { select: { businessName: true } } } }, Payment: true, BookingTimeline: { orderBy: { createdAt: "asc" } } } })
    if (!booking?.Tour) return null
    const operational = await prisma.tourBooking.findUnique({ where: { legacyBookingId: booking.id }, select: { id: true } })
    const refund = operational ? await prisma.refund.findFirst({ where: { tourBookingId: operational.id }, orderBy: { createdAt: "desc" } }) : null
    return { id: booking.id, type: "TOUR", bookingCode: booking.bookingCode, status: booking.status, title: booking.Tour.title, listingHref: `/tours/${booking.Tour.slug}`, location: booking.Tour.city ?? booking.Tour.destination, startDate: (booking.checkIn ?? null)?.toISOString() ?? null, endDate: (booking.checkOut ?? null)?.toISOString() ?? null, contact: { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone }, quantityLabel: `${booking.totalGuests} traveler${booking.totalGuests===1?"":"s"}`, subtotal: toAmount(booking.subtotal), taxes: toAmount(booking.taxes), totalAmount: toAmount(booking.totalAmount), currency: booking.currency, paymentStatus: booking.Payment?.status ?? null, cancellationPolicy: booking.Tour.cancellationPolicy, cancellationReason: booking.cancellationReason, refund: refund ? { status: refund.status, requestedAmount: toAmount(refund.amount), approvedAmount: null, providerRefundId: refund.providerRefundId, failureReason: refund.failureReason } : null, riskAcknowledgement: booking.riskAcknowledgedAt ? { acknowledgedAt: booking.riskAcknowledgedAt.toISOString(), snapshot: booking.riskDisclosureSnapshot } : null, hostName: booking.Tour.Host.businessName, notes: booking.specialRequests, timeline: booking.BookingTimeline.map((item)=>({ type:item.type,title:item.title,message:item.message,createdAt:item.createdAt.toISOString() })) }
  }
  return null
}
