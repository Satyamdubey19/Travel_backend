import { prisma } from "@/lib/prisma"
import type { BookingEventType, BookingStatus } from "@prisma/client"
import type { AdminSession } from "@/utils/admin-auth"
import type { ListQuery } from "@/utils/admin-query"

type EntityType = "USER" | "HOST" | "BOOKING" | "LISTING" | "KYC" | "PAYOUT"
type ListingType = "hotel" | "tour" | "rental" | "activity"
type AdminListingUpdateInput = {
  status?: string
  reason?: string
  isActive?: boolean
  title?: string
  rooms?: {
    id?: string
    pricePerNight?: number
    originalPrice?: number
    totalRooms?: number
    availableRooms?: number
    isActive?: boolean
  }[]
}
type AdminBookingUpdateInput = {
  status: string
  reason?: string
}

function money(value: unknown) {
  return Number(value ?? 0)
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function toBookingEventType(status: BookingStatus): BookingEventType {
  if (status === "CONFIRMED") return "CONFIRMED"
  if (status === "CANCELLED") return "CANCELLED"
  if (status === "COMPLETED") return "COMPLETED"
  if (status === "NO_SHOW") return "NO_SHOW"
  return "CREATED"
}

async function writeAuditLog(admin: AdminSession, action: string, entity: EntityType, entityId: string, oldData?: unknown, newData?: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action,
      entity,
      entityId,
      oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
      newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
    },
  })
}

async function notifyUser(userId: string, title: string, message: string, type: "SYSTEM" | "KYC_APPROVED" | "KYC_REJECTED" | "HOST_APPROVED" | "HOST_REJECTED" | "BOOKING_CONFIRMED" | "BOOKING_CANCELLED" | "PAYOUT_PROCESSED" | "PAYOUT_FAILED", data?: unknown) {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
    },
  })
}

export async function getAdminDashboard() {
  const [
    totalUsers,
    totalHosts,
    pendingKYC,
    approvedKYC,
    rejectedKYC,
    hotelBookings,
    rentalBookings,
    activityBookings,
    pendingListings,
    payments,
    payouts,
    recentBookings,
    recentUsers,
    auditLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: "DELETED" } } }),
    prisma.host.count({ where: { isActive: true } }),
    prisma.kycApplication.count({ where: { status: "PENDING" } }),
    prisma.kycApplication.count({ where: { status: "APPROVED" } }),
    prisma.kycApplication.count({ where: { status: "REJECTED" } }),
    prisma.booking.count(),
    prisma.rentalBooking.count(),
    prisma.activityBooking.count(),
    Promise.all([
      prisma.hotel.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.tour.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.rental.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.activity.count({ where: { status: "PENDING_REVIEW" } }),
    ]),
    prisma.payment.findMany({ where: { status: "SUCCESS" }, select: { amount: true } }),
    prisma.payout.findMany({ select: { amount: true, status: true } }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { User: true, Hotel: true, Tour: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { User: { select: { name: true, email: true } } },
    }),
  ])

  const totalRevenue = payments.reduce((sum, payment) => sum + money(payment.amount), 0)
  const totalPayouts = payouts.filter((payout) => payout.status === "COMPLETED").reduce((sum, payout) => sum + money(payout.amount), 0)
  const pendingPayouts = payouts.filter((payout) => payout.status === "PENDING").reduce((sum, payout) => sum + money(payout.amount), 0)

  return {
    stats: {
      totalUsers,
      totalHosts,
      totalBookings: hotelBookings + rentalBookings + activityBookings,
      pendingKYC,
      approvedKYC,
      rejectedKYC,
      pendingListings: pendingListings.reduce((sum, count) => sum + count, 0),
      totalRevenue,
      totalPayouts,
      pendingPayouts,
      confirmedBookings: await prisma.booking.count({ where: { status: "CONFIRMED" } }),
      cancelledBookings: await prisma.booking.count({ where: { status: "CANCELLED" } }),
    },
    recentBookings: recentBookings.map((booking) => ({
      id: booking.id,
      code: booking.bookingCode,
      guestName: booking.User.name,
      listingName: booking.Hotel?.title ?? booking.Tour?.title ?? "Booking",
      status: booking.status,
      totalAmount: money(booking.totalAmount),
      createdAt: booking.createdAt.toISOString(),
    })),
    recentUsers: recentUsers.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
    recentActivity: auditLogs.map((log) => ({
      id: log.id,
      type: log.entity.toLowerCase(),
      description: `${log.User?.name ?? "Admin"} ${log.action.toLowerCase().replaceAll("_", " ")} ${log.entity.toLowerCase()}`,
      timestamp: log.createdAt.toISOString(),
      status: "completed",
      href: `/admin/${log.entity.toLowerCase() === "user" ? "users" : log.entity.toLowerCase()}`,
    })),
  }
}

export async function listAdminBookings(query: ListQuery) {
  const search = normalizeQuery(query.search)
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      User: { select: { name: true, email: true } },
      Host: { include: { User: { select: { name: true } } } },
      Hotel: { select: { title: true } },
      Tour: { select: { title: true } },
      BookingRoom: {
        include: {
          Room: { select: { availableRooms: true, totalRooms: true } },
        },
      },
    },
  })

  const filtered = bookings
    .filter((booking) => !query.status || query.status === "all" || booking.status === query.status.toUpperCase())
    .filter((booking) => {
      if (!search) return true
      const values = [
        booking.bookingCode,
        booking.User.name,
        booking.User.email,
        booking.contactName,
        booking.contactEmail,
        booking.Hotel?.title ?? "",
        booking.Tour?.title ?? "",
        booking.Host.businessName ?? booking.Host.User.name,
      ]
      return values.some((value) => value.toLowerCase().includes(search))
    })

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((booking) => ({
      id: booking.id,
      code: booking.bookingCode,
      guestName: booking.contactName || booking.User.name,
      guestEmail: booking.contactEmail || booking.User.email,
      hotelName: booking.Hotel?.title,
      tourName: booking.Tour?.title,
      hostName: booking.Host.businessName ?? booking.Host.User.name,
      checkInDate: booking.checkIn?.toISOString(),
      checkOutDate: booking.checkOut?.toISOString(),
      startDate: booking.checkIn?.toISOString(),
      endDate: booking.checkOut?.toISOString(),
      totalPrice: money(booking.totalAmount),
      status: booking.status.toLowerCase(),
      isOverridden: false,
      rooms: booking.BookingRoom.map((room) => ({
        id: room.id,
        name: room.roomName,
        quantity: room.quantity,
        availableRooms: room.Room.availableRooms,
        bookedRooms: Math.max(0, room.Room.totalRooms - room.Room.availableRooms),
      })),
      createdAt: booking.createdAt.toISOString(),
    })),
  }
}

export async function updateAdminBooking(id: string, admin: AdminSession, input: AdminBookingUpdateInput) {
  const nextStatus = input.status as BookingStatus
  const before = await prisma.booking.findUnique({
    where: { id },
    include: { User: true, Payment: true, InventoryReservation: true, Tour: true },
  })
  if (!before) throw new Error("Booking not found")

  const booking = await prisma.$transaction(async (tx) => {
    if (nextStatus === "CONFIRMED") {
      await tx.inventoryReservation.updateMany({
        where: { bookingId: id, status: "ACTIVE" },
        data: { status: "CONFIRMED" },
      })

      if (before.tourId && before.Tour) {
        await tx.tourParticipant.upsert({
          where: { tourId_userId: { tourId: before.tourId, userId: before.userId } },
          create: {
            tourId: before.tourId,
            userId: before.userId,
            bookingId: before.id,
            status: "JOINED",
            isHostApproved: true,
          },
          update: {
            bookingId: before.id,
            status: "JOINED",
            isHostApproved: true,
            cancelledAt: null,
          },
        })

        await tx.tourChatRoom.upsert({
          where: { tourId: before.tourId },
          create: { tourId: before.tourId, name: `${before.Tour.title} group` },
          update: {},
        })
      }
    }

    if (nextStatus === "CANCELLED") {
      await tx.inventoryReservation.updateMany({
        where: { bookingId: id, status: { in: ["ACTIVE", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      })

      if (before.tourId) {
        await tx.tourParticipant.updateMany({
          where: { bookingId: before.id, tourId: before.tourId },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        })
      }
    }

    return tx.booking.update({
      where: { id },
      data: {
        status: nextStatus,
        cancelledAt: nextStatus === "CANCELLED" ? new Date() : before.cancelledAt,
        cancellationReason: nextStatus === "CANCELLED" ? input.reason ?? "Cancelled by admin" : before.cancellationReason,
        BookingTimeline: {
          create: {
            type: toBookingEventType(nextStatus),
            title: `Admin marked booking ${nextStatus.toLowerCase().replace("_", " ")}`,
            message: input.reason ?? "Booking status updated by admin.",
            metadata: { adminId: admin.id, previousStatus: before.status, nextStatus },
          },
        },
      },
      include: { Hotel: true, Tour: true, User: true },
    })
  })

  await writeAuditLog(admin, `BOOKING_${nextStatus}`, "BOOKING", id, before, input)
  await notifyUser(
    before.userId,
    "Booking status updated",
    `Your booking ${before.bookingCode} is now ${nextStatus.toLowerCase().replace("_", " ")}.`,
    nextStatus === "CANCELLED" ? "BOOKING_CANCELLED" : nextStatus === "CONFIRMED" ? "BOOKING_CONFIRMED" : "SYSTEM",
    { bookingId: id, bookingCode: before.bookingCode, reason: input.reason },
  )

  return booking
}

export async function listAdminUsers(query: ListQuery) {
  const search = normalizeQuery(query.search)
  const users = await prisma.user.findMany({
    orderBy: { [query.sortBy]: query.sortOrder },
    include: { Host: true },
  })

  const filtered = users.filter((user) => {
    const matchesSearch = !search || [user.name, user.email, user.phone ?? ""].some((value) => value.toLowerCase().includes(search))
    const matchesRole = !query.role || query.role === "all" || user.role === query.role
    const matchesStatus = !query.status || query.status === "all" || user.status === query.status
    return matchesSearch && matchesRole && matchesStatus
  })

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? "",
      role: user.role,
      status: user.status,
      isActive: user.status === "ACTIVE",
      isHost: Boolean(user.Host),
      createdAt: user.createdAt.toISOString(),
    })),
  }
}

export async function updateAdminUser(id: string, admin: AdminSession, input: { status: string; reason?: string }) {
  const before = await prisma.user.findUnique({ where: { id } })
  if (!before) throw new Error("User not found")

  const user = await prisma.user.update({
    where: { id },
    data: { status: input.status as "ACTIVE" | "SUSPENDED" | "DELETED" },
  })

  await writeAuditLog(admin, `USER_${input.status}`, "USER", id, before, { status: input.status, reason: input.reason })
  await notifyUser(id, "Account status updated", `Your account status is now ${input.status.toLowerCase()}.`, "SYSTEM", { reason: input.reason })

  return user
}

export async function listAdminHosts(query: ListQuery) {
  const search = normalizeQuery(query.search)
  const hosts = await prisma.host.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      User: true,
      _count: { select: { Hotel: true, Tour: true, Rental: true, Activity: true, Booking: true, RentalBooking: true, ActivityBooking: true } },
      Payment: { where: { status: "SUCCESS" }, select: { amount: true } },
    },
  })

  const filtered = hosts.filter((host) => {
    const values = [host.businessName ?? "", host.User.email, host.User.name, host.city ?? ""]
    const matchesSearch = !search || values.some((value) => value.toLowerCase().includes(search))
    const matchesStatus = !query.status || query.status === "all" || host.kycStatus === query.status || (query.status === "verified" && host.isVerified)
    return matchesSearch && matchesStatus
  })

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((host) => ({
      id: host.id,
      businessName: host.businessName ?? host.User.name,
      email: host.contactEmail ?? host.User.email,
      phone: host.supportPhone ?? host.User.phone ?? "",
      city: host.city ?? "-",
      isVerified: host.isVerified,
      isApproved: host.isApproved,
      isActive: host.isActive,
      kycStatus: host.kycStatus,
      totalProperties: host._count.Hotel + host._count.Tour + host._count.Rental + host._count.Activity,
      totalBookings: host._count.Booking + host._count.RentalBooking + host._count.ActivityBooking,
      revenue: host.Payment.reduce((sum, payment) => sum + money(payment.amount), 0),
      joinedAt: host.joinedAt.toISOString(),
      lastActive: host.updatedAt.toISOString(),
    })),
  }
}

export async function updateAdminHost(id: string, admin: AdminSession, input: { status: string; reason?: string }) {
  const before = await prisma.host.findUnique({ where: { id }, include: { User: true } })
  if (!before) throw new Error("Host not found")

  const isActive = input.status === "ACTIVE"
  const host = await prisma.host.update({
    where: { id },
    data: { isActive },
  })

  await prisma.user.update({
    where: { id: before.userId },
    data: { status: input.status as "ACTIVE" | "SUSPENDED" | "DELETED" },
  })
  await writeAuditLog(admin, `HOST_${input.status}`, "HOST", id, before, { status: input.status, reason: input.reason })
  await notifyUser(before.userId, "Host account updated", `Your host account status is now ${input.status.toLowerCase()}.`, "SYSTEM", { reason: input.reason })

  return host
}

export async function listAdminPayouts(query: ListQuery) {
  const payouts = await prisma.payout.findMany({
    orderBy: { requestedAt: "desc" },
    include: { Host: { include: { User: true } } },
  })

  const filtered = payouts.filter((payout) => !query.status || query.status === "all" || payout.status === query.status)

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((payout) => ({
      id: payout.id,
      hostId: payout.hostId,
      hostName: payout.Host.businessName ?? payout.Host.User.name,
      amount: money(payout.amount),
      bankName: payout.bankName ?? payout.Host.bankName ?? "Bank",
      accountNumber: payout.accountNumber ?? payout.Host.bankAccountNumber ?? "0000",
      status: payout.status.toLowerCase(),
      transactionId: payout.transactionId ?? undefined,
      requestedAt: payout.requestedAt.toISOString(),
      processedAt: payout.processedAt?.toISOString(),
      failureReason: payout.failureReason ?? undefined,
      notes: payout.notes ?? undefined,
    })),
  }
}

export async function updateAdminPayout(id: string, admin: AdminSession, input: { status: string; transactionId?: string; failureReason?: string; notes?: string }) {
  const before = await prisma.payout.findUnique({ where: { id }, include: { Host: true } })
  if (!before) throw new Error("Payout not found")

  const payout = await prisma.payout.update({
    where: { id },
    data: {
      status: input.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
      transactionId: input.transactionId,
      failureReason: input.failureReason,
      notes: input.notes,
      processedAt: ["COMPLETED", "FAILED"].includes(input.status) ? new Date() : undefined,
      processedById: admin.id,
    },
  })

  await writeAuditLog(admin, `PAYOUT_${input.status}`, "PAYOUT", id, before, input)
  await notifyUser(before.Host.userId, "Payout status updated", `Your payout is now ${input.status.toLowerCase()}.`, input.status === "FAILED" ? "PAYOUT_FAILED" : "PAYOUT_PROCESSED", input)

  return payout
}

export async function listAdminKyc(query: ListQuery) {
  const applications = await prisma.kycApplication.findMany({
    orderBy: { submittedAt: "desc" },
    include: { Host: { include: { User: true } } },
  })

  const filtered = applications.filter((application) => !query.status || query.status === "all" || application.status === query.status)

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((application) => ({
      id: application.id,
      status: application.status,
      firstName: application.firstName,
      lastName: application.lastName,
      dateOfBirth: application.dateOfBirth?.toISOString() ?? "",
      nationality: application.nationality ?? "",
      idType: application.idType,
      idNumber: application.idNumber,
      idFrontImage: application.idFrontUrl ?? "",
      idBackImage: application.idBackUrl ?? "",
      addressProof: application.addressProofUrl ?? "",
      businessLicense: application.businessDocUrl ?? "",
      taxCertificate: "",
      submittedAt: application.submittedAt.toISOString(),
      rejectionReason: application.rejectionReason ?? undefined,
      host: {
        id: application.Host.id,
        businessName: application.Host.businessName ?? application.Host.User.name,
        phone: application.Host.supportPhone ?? application.Host.User.phone ?? "",
        user: {
          email: application.Host.User.email,
          name: application.Host.User.name,
        },
      },
    })),
  }
}

export async function decideAdminKyc(id: string, admin: AdminSession, input: { action?: string; status?: string; rejectionReason?: string }) {
  const before = await prisma.kycApplication.findUnique({ where: { id }, include: { Host: true } })
  if (!before) throw new Error("KYC application not found")

  const nextStatus = input.status ?? (input.action === "approve" ? "APPROVED" : "REJECTED")
  const application = await prisma.kycApplication.update({
    where: { id },
    data: {
      status: nextStatus as "PENDING" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED",
      rejectionReason: nextStatus === "REJECTED" ? input.rejectionReason : null,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  })

  await prisma.host.update({
    where: { id: before.hostId },
    data: {
      kycStatus: nextStatus as "PENDING" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED",
      isVerified: nextStatus === "APPROVED",
      isApproved: nextStatus === "APPROVED",
    },
  })

  await writeAuditLog(admin, `KYC_${nextStatus}`, "KYC", id, before, input)
  await notifyUser(before.Host.userId, nextStatus === "APPROVED" ? "KYC approved" : "KYC rejected", nextStatus === "APPROVED" ? "Your KYC documents were approved." : `Your KYC was rejected. ${input.rejectionReason ?? ""}`, nextStatus === "APPROVED" ? "KYC_APPROVED" : "KYC_REJECTED", input)

  return application
}

export async function listAdminListings(query: ListQuery) {
  const requestedType = query.type
  const includeType = (type: ListingType) => !requestedType || requestedType === "all" || requestedType === type
  const search = normalizeQuery(query.search)

  const [hotels, tours, rentals, activities] = await Promise.all([
    includeType("hotel") ? prisma.hotel.findMany({ include: { Host: { include: { User: true } }, Room: { orderBy: { createdAt: "asc" } }, _count: { select: { Booking: true, Review: true } } } }) : [],
    includeType("tour") ? prisma.tour.findMany({ include: { Host: { include: { User: true } }, _count: { select: { Booking: true, Review: true } } } }) : [],
    includeType("rental") ? prisma.rental.findMany({ include: { Host: { include: { User: true } }, _count: { select: { RentalBooking: true, Review: true } } } }) : [],
    includeType("activity") ? prisma.activity.findMany({ include: { Host: { include: { User: true } }, _count: { select: { ActivityBooking: true, Review: true } } } }) : [],
  ])

  const rows = [
    ...hotels.map((item) => ({
      id: item.id,
      type: "hotel" as const,
      title: item.title,
      ownerName: item.Host.businessName ?? item.Host.User.name,
      city: item.city,
      status: item.status,
      isActive: item.isActive,
      isApproved: item.isApproved,
      price: item.Room.filter((room) => room.isActive).reduce((min, room) => {
        const price = money(room.pricePerNight)
        return min === 0 || price < min ? price : min
      }, 0),
      inventoryLabel: item.Room.length > 0
        ? `${item.Room.filter((room) => room.isActive).reduce((sum, room) => sum + room.availableRooms, 0)} of ${item.Room.filter((room) => room.isActive).reduce((sum, room) => sum + room.totalRooms, 0)} rooms`
        : "No rooms",
      inventoryDetails: item.Room.map((room) => ({
        id: room.id,
        label: `${room.name} (${room.type})`,
        pricePerNight: money(room.pricePerNight),
        originalPrice: room.originalPrice == null ? undefined : money(room.originalPrice),
        available: room.availableRooms,
        total: room.totalRooms,
        isActive: room.isActive,
      })),
      bookings: item._count.Booking,
      reviews: item._count.Review,
      createdAt: item.createdAt.toISOString(),
    })),
    ...tours.map((item) => ({
      id: item.id,
      type: "tour" as const,
      title: item.title,
      ownerName: item.Host.businessName ?? item.Host.User.name,
      city: item.city ?? item.destination,
      status: item.status,
      isActive: item.isActive,
      isApproved: item.isApproved,
      price: money(item.pricePerPerson),
      inventoryLabel: `${item.availableSlots} of ${item.totalSlots} slots`,
      inventoryDetails: [{ label: "Tour slots", available: item.availableSlots, total: item.totalSlots }],
      bookings: item._count.Booking,
      reviews: item._count.Review,
      createdAt: item.createdAt.toISOString(),
    })),
    ...rentals.map((item) => ({
      id: item.id,
      type: "rental" as const,
      title: item.title,
      ownerName: item.Host.businessName ?? item.Host.User.name,
      city: item.city,
      status: item.status,
      isActive: item.isActive,
      isApproved: item.isApproved,
      price: money(item.pricePerDay),
      inventoryLabel: `${item.availableUnits} of ${item.totalUnits} vehicles`,
      inventoryDetails: [{ label: "Rental vehicles", available: item.availableUnits, total: item.totalUnits }],
      bookings: item._count.RentalBooking,
      reviews: item._count.Review,
      createdAt: item.createdAt.toISOString(),
    })),
    ...activities.map((item) => ({
      id: item.id,
      type: "activity" as const,
      title: item.title,
      ownerName: item.Host.businessName ?? item.Host.User.name,
      city: item.city,
      status: item.status,
      isActive: item.isActive,
      isApproved: item.isApproved,
      price: money(item.price),
      inventoryLabel: `${item.availableSlots} of ${item.totalSlots} slots`,
      inventoryDetails: [{ label: "Activity slots", available: item.availableSlots, total: item.totalSlots }],
      bookings: item._count.ActivityBooking,
      reviews: item._count.Review,
      createdAt: item.createdAt.toISOString(),
    })),
  ]

  const filtered = rows
    .filter((item) => !query.status || query.status === "all" || item.status === query.status)
    .filter((item) => !search || [item.title, item.ownerName, item.city].some((value) => value.toLowerCase().includes(search)))
    .sort((a, b) => query.sortOrder === "asc" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit),
  }
}

export async function listAdminPosts(query: ListQuery) {
  const search = normalizeQuery(query.search)
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: query.sortOrder },
    include: {
      User: { select: { id: true, name: true, email: true, role: true, status: true } },
      Hotel: { select: { id: true, title: true, city: true } },
      Tour: { select: { id: true, title: true, city: true, destination: true } },
      _count: { select: { PostComment: true, PostLike: true } },
    },
  })

  const filtered = posts.filter((post) => {
    const values = [
      post.caption ?? "",
      post.User.name,
      post.User.email,
      post.Hotel?.title ?? "",
      post.Hotel?.city ?? "",
      post.Tour?.title ?? "",
      post.Tour?.city ?? "",
      post.Tour?.destination ?? "",
    ]
    return !search || values.some((value) => value.toLowerCase().includes(search))
  })

  return {
    total: filtered.length,
    rows: filtered.slice(query.skip, query.skip + query.limit).map((post) => ({
      id: post.id,
      imageUrl: post.imageUrl,
      caption: post.caption ?? "",
      viewCount: post.viewCount,
      comments: post._count.PostComment,
      likes: post._count.PostLike,
      author: {
        id: post.User.id,
        name: post.User.name,
        email: post.User.email,
        role: post.User.role,
        status: post.User.status,
      },
      listing: post.Hotel
        ? { type: "hotel", id: post.Hotel.id, title: post.Hotel.title, location: post.Hotel.city }
        : post.Tour
          ? { type: "tour", id: post.Tour.id, title: post.Tour.title, location: post.Tour.city ?? post.Tour.destination }
          : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    })),
  }
}

export async function updateAdminListing(type: ListingType, id: string, admin: AdminSession, input: AdminListingUpdateInput) {
  const nextStatus = input.status as "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "ARCHIVED" | undefined
  const reviewedAt = input.status ? new Date() : undefined
  const sharedData = {
    status: nextStatus,
    isActive: input.isActive,
    title: input.title,
    reviewedAt,
    reviewedById: input.status ? admin.id : undefined,
    moderationNotes: input.reason,
  }
  const approvalData = {
    ...sharedData,
    isApproved: input.status === "ACTIVE" ? true : input.status === "REJECTED" || input.status === "ARCHIVED" || input.status === "PENDING_REVIEW" ? false : undefined,
    approvedAt: input.status === "ACTIVE" ? reviewedAt : input.status ? null : undefined,
    rejectedAt: input.status === "REJECTED" ? reviewedAt : input.status === "ACTIVE" || input.status === "PENDING_REVIEW" ? null : undefined,
    rejectionReason: input.status === "REJECTED" ? input.reason ?? null : input.status === "ACTIVE" || input.status === "PENDING_REVIEW" ? null : undefined,
  }

  if (type === "hotel") {
    const before = await prisma.hotel.findUnique({ where: { id }, include: { Room: true } })
    if (!before) throw new Error("Listing not found")
    const listing = await prisma.$transaction(async (tx) => {
      if (input.rooms?.length) {
        for (const room of input.rooms) {
          if (!room.id || !before.Room.some((existing) => existing.id === room.id)) continue
          const totalRooms = room.totalRooms == null ? undefined : Math.max(Math.trunc(room.totalRooms), 1)
          const availableRooms = room.availableRooms == null
            ? undefined
            : Math.max(Math.trunc(room.availableRooms), 0)
          await tx.room.update({
            where: { id: room.id },
            data: {
              pricePerNight: room.pricePerNight == null ? undefined : room.pricePerNight,
              originalPrice: room.originalPrice,
              totalRooms,
              availableRooms: totalRooms == null || availableRooms == null ? availableRooms : Math.min(availableRooms, totalRooms),
              isActive: room.isActive,
            },
          })
        }
      }

      return tx.hotel.update({ where: { id }, data: approvalData })
    })
    await writeAuditLog(admin, `LISTING_${input.status ?? "UPDATED"}`, "LISTING", id, before, { ...input, type })
    return listing
  }

  if (type === "tour") {
    const before = await prisma.tour.findUnique({ where: { id } })
    if (!before) throw new Error("Listing not found")
    const listing = await prisma.tour.update({ where: { id }, data: approvalData })
    await writeAuditLog(admin, `LISTING_${input.status ?? "UPDATED"}`, "LISTING", id, before, { ...input, type })
    return listing
  }

  if (type === "rental") {
    const before = await prisma.rental.findUnique({ where: { id } })
    if (!before) throw new Error("Listing not found")
    const listing = await prisma.rental.update({ where: { id }, data: approvalData })
    await writeAuditLog(admin, `LISTING_${input.status ?? "UPDATED"}`, "LISTING", id, before, { ...input, type })
    return listing
  }

  const before = await prisma.activity.findUnique({ where: { id } })
  if (!before) throw new Error("Listing not found")
  const listing = await prisma.activity.update({ where: { id }, data: approvalData })
  await writeAuditLog(admin, `LISTING_${input.status ?? "UPDATED"}`, "LISTING", id, before, { ...input, type })
  return listing
}
