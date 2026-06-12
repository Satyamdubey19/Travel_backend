import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { releaseReservedRoomInventory } from "@/services/availability.service"

type ExpireStaleBookingsOptions = {
  now?: Date
  limit?: number
}

export type ExpireStaleBookingsResult = {
  processed: number
  failed: number
  skipped: number
  bookingIds: string[]
}

const DEFAULT_LIMIT = 100
const EXPIRY_REASON = "Booking hold expired - payment not completed"

export async function expireStaleBookings(options: ExpireStaleBookingsOptions = {}): Promise<ExpireStaleBookingsResult> {
  const now = options.now ?? new Date()
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 500))
  const expiredBookings = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      couponId: true,
      BookingRoom: {
        select: {
          roomId: true,
          checkIn: true,
          checkOut: true,
          quantity: true,
          inventoryReserved: true,
        },
      },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
  })

  if (expiredBookings.length === 0) {
    return { processed: 0, failed: 0, skipped: 0, bookingIds: [] }
  }

  let processed = 0
  let failed = 0
  let skipped = 0
  const bookingIds: string[] = []

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

        for (const bookingRoom of booking.BookingRoom) {
          if (!bookingRoom.inventoryReserved) continue

          await releaseReservedRoomInventory({
            roomId: bookingRoom.roomId,
            checkIn: bookingRoom.checkIn,
            checkOut: bookingRoom.checkOut,
            quantity: bookingRoom.quantity,
          }, tx)
        }

        await tx.inventoryReservation.updateMany({
          where: { bookingId: booking.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        })

        await tx.bookingRoom.updateMany({
          where: { bookingId: booking.id },
          data: { inventoryReserved: false },
        })

        await tx.payment.updateMany({
          where: { bookingId: booking.id, status: "PENDING" },
          data: { status: "FAILED", refundReason: EXPIRY_REASON },
        })

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
              releasedInventory: booking.BookingRoom
                .filter((room) => room.inventoryReserved)
                .map((room) => ({
                  roomId: room.roomId,
                  checkIn: room.checkIn.toISOString(),
                  checkOut: room.checkOut.toISOString(),
                  quantity: room.quantity,
                })),
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

  return { processed, failed, skipped, bookingIds }
}
