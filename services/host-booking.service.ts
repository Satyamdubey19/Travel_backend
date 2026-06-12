import { BookingEventType, BookingStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type HostBookingStatus = "ALL" | BookingStatus

export interface ListHostBookingsInput {
  hostId?: string
  status?: HostBookingStatus
  type?: string
  page?: number
  pageSize?: number
}

export interface UpdateHostBookingInput {
  hostId?: string
  bookingId: string
  status: BookingStatus
  note?: string
}

const ALLOWED_HOST_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
}

const DEFAULT_PAGE_SIZE = 20

function statusForClient(status: BookingStatus) {
  return status.toLowerCase()
}

function money(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0)
}

function timelineTitle(status: BookingStatus) {
  const labels: Record<BookingStatus, string> = {
    PENDING: "Booking marked pending",
    CONFIRMED: "Booking confirmed",
    CANCELLED: "Booking cancelled",
    COMPLETED: "Booking completed",
    NO_SHOW: "Guest marked no-show",
    REFUND_PENDING: "Refund pending",
  }

  return labels[status]
}

function timelineType(status: BookingStatus): BookingEventType {
  if (status === "CANCELLED") return "CANCELLED"
  if (status === "COMPLETED") return "COMPLETED"
  if (status === "NO_SHOW") return "NO_SHOW"
  return "CONFIRMED"
}

export async function listHostBookings(input: ListHostBookingsInput) {
  const { hostId, status = "ALL", page = 1, pageSize = DEFAULT_PAGE_SIZE } = input

  const where: Prisma.BookingWhereInput = {
    ...(hostId ? { hostId } : {}),
    ...(status !== "ALL" ? { status } : {}),
  }

  const [bookings, total, stats] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        bookingCode: true,
        status: true,
        checkIn: true,
        checkOut: true,
        totalGuests: true,
        contactName: true,
        contactEmail: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        Hotel: {
          select: { id: true, title: true, slug: true, city: true },
        },
        Tour: {
          select: { id: true, title: true, slug: true, city: true },
        },
        BookingRoom: {
          select: {
            id: true,
            roomId: true,
            roomName: true,
            quantity: true,
            Room: {
              select: {
                availableRooms: true,
                totalRooms: true,
              },
            },
          },
        },
        Payment: {
          select: {
            status: true,
            hostEarnings: true,
            platformFee: true,
            refundedAt: true,
          },
        },
        User: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({
      by: ["status"],
      where: hostId ? { hostId } : {},
      _count: { status: true },
      _sum: { totalAmount: true },
    }),
  ])

  const statMap = Object.fromEntries(
    stats.map((item) => [
      item.status,
      { count: item._count.status, revenue: money(item._sum.totalAmount) },
    ]),
  ) as Partial<Record<BookingStatus, { count: number; revenue: number }>>

  return {
    data: bookings.map((booking) => ({
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: statusForClient(booking.status),
      checkInDate: booking.checkIn?.toISOString() ?? null,
      checkOutDate: booking.checkOut?.toISOString() ?? null,
      startDate: booking.checkIn?.toISOString() ?? null,
      endDate: booking.checkOut?.toISOString() ?? null,
      numberOfGuests: booking.totalGuests,
      totalPrice: money(booking.totalAmount),
      currency: booking.currency,
      createdAt: booking.createdAt.toISOString(),
      guest: {
        id: booking.User.id,
        name: booking.contactName || booking.User.name || "Guest",
        email: booking.contactEmail || booking.User.email,
      },
      hotel: booking.Hotel
        ? {
            id: booking.Hotel.id,
            name: booking.Hotel.title,
            slug: booking.Hotel.slug,
            city: booking.Hotel.city,
          }
        : null,
      tour: booking.Tour
        ? {
            id: booking.Tour.id,
            name: booking.Tour.title,
            slug: booking.Tour.slug,
            city: booking.Tour.city,
          }
        : null,
      rooms: booking.BookingRoom.map((room) => ({
        id: room.id,
        roomId: room.roomId,
        name: room.roomName,
        quantity: room.quantity,
        availableRooms: room.Room.availableRooms,
        bookedRooms: Math.max(room.Room.totalRooms - room.Room.availableRooms, 0),
      })),
      payment: booking.Payment
        ? {
            status: booking.Payment.status,
            hostEarnings: money(booking.Payment.hostEarnings),
            platformFee: money(booking.Payment.platformFee),
            refundedAt: booking.Payment.refundedAt?.toISOString() ?? null,
          }
        : null,
    })),
    meta: {
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        totalBookings: total,
        confirmedBookings: statMap.CONFIRMED?.count ?? 0,
        pendingBookings: statMap.PENDING?.count ?? 0,
        completedBookings: statMap.COMPLETED?.count ?? 0,
        cancelledBookings: statMap.CANCELLED?.count ?? 0,
        totalRevenue: stats
          .filter((item) => item.status !== "CANCELLED")
          .reduce((sum, item) => sum + money(item._sum.totalAmount), 0),
      },
    },
  }
}

export async function updateHostBookingStatus(input: UpdateHostBookingInput) {
  const { hostId, bookingId, status: newStatus, note } = input

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, ...(hostId ? { hostId } : {}) },
      select: {
        id: true,
        status: true,
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
    })

    if (!booking) {
      throw new Error("Booking not found")
    }

    const allowed = ALLOWED_HOST_TRANSITIONS[booking.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot move booking from ${booking.status} to ${newStatus}`)
    }

    if (newStatus === "CANCELLED") {
      const { releaseReservedRoomInventory } = await import("@/services/availability.service")

      for (const room of booking.BookingRoom) {
        if (room.inventoryReserved) {
          await releaseReservedRoomInventory(
            {
              roomId: room.roomId,
              checkIn: room.checkIn,
              checkOut: room.checkOut,
              quantity: room.quantity,
            },
            tx,
          )
        }
      }

      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { inventoryReserved: false },
      })

      await tx.inventoryReservation.updateMany({
        where: { bookingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      })

      await tx.payment.updateMany({
        where: { bookingId, status: { not: "REFUNDED" } },
        data: { status: "FAILED" },
      })
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        ...(newStatus === "CANCELLED"
          ? { cancelledAt: new Date(), cancellationReason: note ?? "Cancelled by host" }
          : {}),
      },
    })

    await tx.bookingTimeline.create({
      data: {
        bookingId,
        type: timelineType(newStatus),
        title: timelineTitle(newStatus),
        message: note ?? null,
      },
    })

    return updated
  })
}
