import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type ExpireStaleBookingsOptions = {
  now?: Date
  limit?: number
}

export type ExpireStaleBookingsResult = {
  processed: number
  failed: number
  skipped: number
  bookingIds: string[]
  activityBookingIds: string[]
  completedActivityBookingIds: string[]
  rentalBookingIds: string[]
  completedRentalBookingIds: string[]
}

const DEFAULT_LIMIT = 100
const EXPIRY_REASON = "Booking hold expired - payment not completed"

export async function expireStaleBookings(options: ExpireStaleBookingsOptions = {}): Promise<ExpireStaleBookingsResult> {
  const now = options.now ?? new Date()
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 500))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [expiredBookings, expiredActivityBookings, completedActivityBookings, expiredRentalBookings, completedRentalBookings] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      select: { id: true, couponId: true },
      orderBy: { expiresAt: "asc" },
      take: limit,
    }),
    prisma.activityBooking.findMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      select: { id: true, slotId: true, guestCount: true },
      orderBy: { expiresAt: "asc" },
      take: limit,
    }),
    prisma.activityBooking.findMany({
      where: { status: "CONFIRMED", date: { lt: today } },
      select: { id: true },
      orderBy: { date: "asc" },
      take: limit,
    }),
    prisma.rentalBooking.findMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: limit,
    }),
    prisma.rentalBooking.findMany({
      where: { status: "CONFIRMED", returnDate: { lt: today } },
      select: { id: true },
      orderBy: { returnDate: "asc" },
      take: limit,
    }),
  ])

  if (expiredBookings.length === 0 && expiredActivityBookings.length === 0 && completedActivityBookings.length === 0 && expiredRentalBookings.length === 0 && completedRentalBookings.length === 0) {
    return { processed: 0, failed: 0, skipped: 0, bookingIds: [], activityBookingIds: [], completedActivityBookingIds: [], rentalBookingIds: [], completedRentalBookingIds: [] }
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const bookingIds: string[] = []
  const activityBookingIds: string[] = []
  const completedActivityBookingIds: string[] = []
  const rentalBookingIds: string[] = []
  const completedRentalBookingIds: string[] = []

  for (const booking of expiredBookings) {
    try {
      const expired = await prisma.$transaction(async (tx) => {
        const claim = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: "PENDING",
            expiresAt: { lte: now },
          },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancellationReason: EXPIRY_REASON,
          },
        })

        if (claim.count !== 1) return false

        await tx.payment.updateMany({
          where: { bookingId: booking.id, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "FAILED", refundReason: EXPIRY_REASON },
        })

        await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'EXPIRED', "paymentStatus" = 'FAILED', "updatedAt" = CURRENT_TIMESTAMP WHERE "legacyBookingId" = ${booking.id} AND "status" IN ('PENDING', 'WAITLISTED')`
        await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" IN (SELECT "id" FROM "TourBooking" WHERE "legacyBookingId" = ${booking.id}) AND "status" IN ('PENDING', 'WAITLISTED')`
        await tx.$executeRaw`UPDATE "WaitlistQueue" SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" IN (SELECT "id" FROM "TourBooking" WHERE "legacyBookingId" = ${booking.id}) AND "status" = 'WAITLISTED'`

        const redemptions = await tx.couponRedemption.deleteMany({
          where: { bookingId: booking.id },
        })

        if (booking.couponId && redemptions.count > 0) {
          await tx.coupon.update({
            where: { id: booking.couponId },
            data: { usedCount: { decrement: redemptions.count } },
          })
        }

        await tx.bookingTimeline.create({
          data: {
            bookingId: booking.id,
            type: "CANCELLED",
            title: "Booking hold expired",
            message: "Booking automatically cancelled because payment was not completed before the hold expired.",
            metadata: {
              reason: EXPIRY_REASON,
              expiredAt: now.toISOString(),
            },
          },
        })

        return true
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 20000,
      })

      if (!expired) {
        skipped++
        continue
      }

      processed++
      bookingIds.push(booking.id)
    } catch (error) {
      failed++
      console.error(`Failed to expire booking ${booking.id}:`, error)
    }
  }

  for (const booking of expiredActivityBookings) {
    try {
      const expired = await prisma.$transaction(async (tx) => {
        const claim = await tx.activityBooking.updateMany({
          where: { id: booking.id, status: "PENDING", expiresAt: { lte: now } },
          data: { status: "CANCELLED", cancelledAt: now, cancellationReason: EXPIRY_REASON },
        })
        if (claim.count !== 1) return false

        await tx.activityPayment.updateMany({
          where: { activityBookingId: booking.id, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "FAILED" },
        })
        if (booking.slotId) {
          await tx.$executeRaw`UPDATE "ActivitySlot" SET "bookedSpots" = GREATEST(0, "bookedSpots" - ${booking.guestCount}), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.slotId}`
        }
        await tx.activityBookingTimeline.create({
          data: { bookingId: booking.id, type: "CANCELLED", title: "Activity hold expired", message: "The reserved spots were released because payment was not completed in time." },
        })
        return true
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 })

      if (!expired) { skipped++; continue }
      processed++
      activityBookingIds.push(booking.id)
    } catch (error) {
      failed++
      console.error(`Failed to expire activity booking ${booking.id}:`, error)
    }
  }

  for (const booking of completedActivityBookings) {
    try {
      const completed = await prisma.$transaction(async (tx) => {
        const claim = await tx.activityBooking.updateMany({ where: { id: booking.id, status: "CONFIRMED", date: { lt: today } }, data: { status: "COMPLETED" } })
        if (claim.count !== 1) return false
        await tx.activityBookingTimeline.create({ data: { bookingId: booking.id, type: "COMPLETED", title: "Activity completed", message: "The activity date has passed. The traveler may now leave a verified review." } })
        return true
      })
      if (!completed) { skipped++; continue }
      processed++
      completedActivityBookingIds.push(booking.id)
    } catch (error) {
      failed++
      console.error(`Failed to complete activity booking ${booking.id}:`, error)
    }
  }

  for (const booking of expiredRentalBookings) {
    try {
      const expired = await prisma.$transaction(async (tx) => {
        const claim = await tx.rentalBooking.updateMany({ where: { id: booking.id, status: "PENDING", expiresAt: { lte: now } }, data: { status: "CANCELLED", cancelledAt: now, cancellationReason: EXPIRY_REASON, expiresAt: null } })
        if (claim.count !== 1) return false
        await tx.rentalPayment.updateMany({ where: { rentalBookingId: booking.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED" } })
        await tx.rentalBookingTimeline.create({ data: { bookingId: booking.id, type: "CANCELLED", title: "Rental hold expired", message: "The vehicle hold was released because payment was not completed in time." } })
        return true
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 })
      if (!expired) { skipped++; continue }
      processed++
      rentalBookingIds.push(booking.id)
    } catch (error) {
      failed++
      console.error(`Failed to expire rental booking ${booking.id}:`, error)
    }
  }

  for (const booking of completedRentalBookings) {
    try {
      const completed = await prisma.$transaction(async (tx) => {
        const claim = await tx.rentalBooking.updateMany({ where: { id: booking.id, status: "CONFIRMED", returnDate: { lt: today } }, data: { status: "COMPLETED" } })
        if (claim.count !== 1) return false
        await tx.rentalBookingTimeline.create({ data: { bookingId: booking.id, type: "COMPLETED", title: "Rental completed", message: "The rental return date has passed. The traveler may now leave a verified review." } })
        return true
      })
      if (!completed) { skipped++; continue }
      processed++
      completedRentalBookingIds.push(booking.id)
    } catch (error) {
      failed++
      console.error(`Failed to complete rental booking ${booking.id}:`, error)
    }
  }

  return { processed, failed, skipped, bookingIds, activityBookingIds, completedActivityBookingIds, rentalBookingIds, completedRentalBookingIds }
}
