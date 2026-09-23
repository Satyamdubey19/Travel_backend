import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requiredEnv } from "@/lib/env"
import { razorpay } from "@/lib/razorpay"
import type { ActivityPaymentVerificationInput, CreateActivityBookingInput } from "@/modules/activity/validators/activity-booking.validators"
import { activityBookingKey, assertAdvanceActivityDate, calculateActivityBookingTotal } from "@/modules/activity/services/activity-booking-policy"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"

const HOLD_MINUTES = 15

function bookingCode() {
  return `AB${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`
}

export async function createActivityBooking(userId: string, activityKey: string, input: CreateActivityBookingInput) {
  const activity = await prisma.activity.findFirst({
    where: {
      OR: [{ id: activityKey }, { slug: activityKey }],
      status: "ACTIVE",
      isActive: true,
      Host: { is: { isActive: true, isApproved: true, isVerified: true } },
    },
    select: { id: true, hostId: true, title: true, price: true, cancellationPolicy: true, Host: { select: { userId: true } } },
  })
  if (!activity) throw Object.assign(new Error("Activity is not available for booking"), { statusCode: 404 })
  if (activity.Host.userId === userId) throw Object.assign(new Error("Hosts cannot book their own activity"), { statusCode: 409 })
  if (!activity.cancellationPolicy?.trim()) throw Object.assign(new Error("Activity cancellation terms must be published before booking"), { statusCode: 409 })

  const idempotencyKey = activityBookingKey(userId, activity.id, input.idempotencyKey)
  const prior = await prisma.activityBooking.findUnique({ where: { idempotencyKey }, include: { ActivityPayment: true } })
  if (prior) return serializeBooking(prior)

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.activityBooking.findUnique({ where: { idempotencyKey }, include: { ActivityPayment: true } })
    if (duplicate) return serializeBooking(duplicate)

    const slot = await tx.activitySlot.findFirst({
      where: { id: input.slotId, activityId: activity.id, isActive: true },
      select: { id: true, date: true, startTime: true, totalSpots: true, bookedSpots: true },
    })
    if (!slot) throw Object.assign(new Error("Selected activity slot was not found"), { statusCode: 404 })
    assertAdvanceActivityDate(slot.date)

    const held = await tx.$executeRaw`
      UPDATE "ActivitySlot"
      SET "bookedSpots" = "bookedSpots" + ${input.guestCount}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${slot.id}
        AND "activityId" = ${activity.id}
        AND "isActive" = true
        AND "bookedSpots" + ${input.guestCount} <= "totalSpots"
    `
    if (Number(held) !== 1) throw Object.assign(new Error("Not enough spots remain in this activity slot"), { statusCode: 409 })

    const subtotal = calculateActivityBookingTotal(Number(activity.price), input.guestCount)
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000)
    const booking = await tx.activityBooking.create({
      data: {
        bookingCode: bookingCode(),
        idempotencyKey,
        userId,
        hostId: activity.hostId,
        activityId: activity.id,
        slotId: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        guestCount: input.guestCount,
        privateGroup: false,
        subtotal: new Prisma.Decimal(subtotal),
        taxes: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(subtotal),
        currency: "INR",
        status: "PENDING",
        expiresAt,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        specialRequests: input.specialRequests || null,
        ActivityPayment: { create: { userId, amount: new Prisma.Decimal(subtotal), currency: "INR", provider: "razorpay", status: "PENDING" } },
        ActivityBookingTimeline: { create: { type: "CREATED", title: "Activity spot held", message: `Complete payment within ${HOLD_MINUTES} minutes.` } },
      },
      include: { ActivityPayment: true },
    })
    return serializeBooking(booking)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.activityBooking.findUnique({ where: { idempotencyKey }, include: { ActivityPayment: true } })
      if (existing) return serializeBooking(existing)
    }
    throw error
  })
}

export async function createActivityPaymentOrder(userId: string, activityKey: string, bookingId: string) {
  const keyId = requiredEnv("RAZORPAY_KEY_ID")
  const booking = await prisma.activityBooking.findFirst({
    where: { id: bookingId, userId, status: "PENDING", expiresAt: { gt: new Date() }, Activity: { OR: [{ id: activityKey }, { slug: activityKey }] } },
    include: { Activity: { select: { title: true } }, ActivityPayment: true },
  })
  if (!booking?.ActivityPayment) throw Object.assign(new Error("Pending activity booking not found"), { statusCode: 404 })
  if (booking.ActivityPayment.providerOrderId && ["PENDING", "PROCESSING"].includes(booking.ActivityPayment.status)) {
    return { bookingId, bookingCode: booking.bookingCode, orderId: booking.ActivityPayment.providerOrderId, amount: Math.round(Number(booking.totalAmount) * 100), currency: booking.currency, keyId }
  }

  const claim = await prisma.activityPayment.updateMany({ where: { id: booking.ActivityPayment.id, status: "PENDING", providerOrderId: null }, data: { status: "PROCESSING" } })
  if (claim.count !== 1) throw Object.assign(new Error("Payment order creation is already in progress"), { statusCode: 409 })

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(Number(booking.totalAmount) * 100),
      currency: booking.currency,
      receipt: booking.bookingCode,
      notes: { productType: "activity", activityBookingId: booking.id, activityId: booking.activityId, activity: booking.Activity.title },
    })
    await prisma.activityPayment.update({ where: { id: booking.ActivityPayment.id }, data: { providerOrderId: order.id } })
    return { bookingId, bookingCode: booking.bookingCode, orderId: order.id, amount: order.amount, currency: order.currency, keyId }
  } catch (error) {
    await prisma.activityPayment.updateMany({ where: { id: booking.ActivityPayment.id, providerOrderId: null, status: "PROCESSING" }, data: { status: "PENDING" } })
    throw error
  }
}

export async function verifyActivityPayment(userId: string, activityKey: string, input: ActivityPaymentVerificationInput) {
  const expected = createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET"))
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(input.razorpay_signature, "hex")
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 })
  }

  const payment = await prisma.activityPayment.findFirst({
    where: { providerOrderId: input.razorpay_order_id, userId, ActivityBooking: { Activity: { OR: [{ id: activityKey }, { slug: activityKey }] } } },
  })
  if (!payment) throw Object.assign(new Error("Activity payment not found"), { statusCode: 404 })
  return confirmActivityBooking(payment.activityBookingId, input.razorpay_payment_id)
}

export async function confirmActivityBooking(bookingId: string, providerPaymentId?: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.activityBooking.findUnique({ where: { id: bookingId }, include: { ActivityPayment: true } })
    if (!booking) throw new Error("Activity booking not found")
    if (booking.status === "CONFIRMED") return serializeBooking(booking)
    if (booking.status !== "PENDING" || !booking.expiresAt || booking.expiresAt <= new Date()) throw new Error("Activity booking hold has expired")

    await tx.activityPayment.update({
      where: { activityBookingId: booking.id },
      data: { status: "SUCCESS", providerPaymentId: providerPaymentId ?? booking.ActivityPayment?.providerPaymentId, transactionId: providerPaymentId ?? booking.ActivityPayment?.transactionId, paidAt: new Date() },
    })
    const confirmed = await tx.activityBooking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", expiresAt: null, ActivityBookingTimeline: { create: { type: "CONFIRMED", title: "Activity booking confirmed", message: "Payment was verified and the activity spot is confirmed." } } },
      include: { ActivityPayment: true },
    })
    await tx.activity.update({ where: { id: booking.activityId }, data: { totalBookings: { increment: 1 } } })
    await queueNotification(tx, { data: { userId: booking.userId, type: "BOOKING_CONFIRMED", title: "Activity booking confirmed", message: `Booking ${booking.bookingCode} is confirmed.`, data: { bookingId: booking.id, product: "activity" } } })
    return serializeBooking(confirmed)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function cancelActivityBooking(userId: string, bookingId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.activityBooking.findFirst({
      where: { id: bookingId, userId },
      include: { Activity: { select: { cancellationPolicy: true } }, ActivityPayment: true, ActivityRefund: true },
    })
    if (!booking) throw Object.assign(new Error("Activity booking not found"), { statusCode: 404 })
    if (["CANCELLED", "REFUND_PENDING"].includes(booking.status)) {
      return { bookingId: booking.id, status: booking.status, refundStatus: booking.ActivityRefund?.status ?? null }
    }
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) throw Object.assign(new Error("Activity booking can no longer be cancelled"), { statusCode: 409 })

    const paid = booking.ActivityPayment?.status === "SUCCESS"
    const nextStatus = paid ? "REFUND_PENDING" : "CANCELLED"
    const claim = await tx.activityBooking.updateMany({
      where: { id: booking.id, userId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: nextStatus, cancelledAt: new Date(), cancellationReason: reason, expiresAt: null },
    })
    if (claim.count !== 1) throw Object.assign(new Error("Activity cancellation is already being processed"), { statusCode: 409 })

    if (booking.slotId) {
      await tx.$executeRaw`UPDATE "ActivitySlot" SET "bookedSpots" = GREATEST(0, "bookedSpots" - ${booking.guestCount}), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.slotId}`
    }
    if (!paid && booking.ActivityPayment) {
      await tx.activityPayment.updateMany({ where: { id: booking.ActivityPayment.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED" } })
    }
    const refund = paid && booking.ActivityPayment ? await tx.activityRefund.upsert({
      where: { activityBookingId: booking.id },
      create: {
        activityBookingId: booking.id,
        activityPaymentId: booking.ActivityPayment.id,
        requestedAmount: booking.totalAmount,
        currency: booking.currency,
        status: "REVIEW_PENDING",
        reason,
        policySnapshot: booking.Activity.cancellationPolicy || "No policy snapshot available",
      },
      update: {},
    }) : null
    await tx.activityBookingTimeline.create({
      data: {
        bookingId: booking.id,
        type: "CANCELLED",
        title: paid ? "Cancellation submitted for refund review" : "Activity booking cancelled",
        message: paid ? "The maximum paid amount is under review against the policy captured at booking." : "The unpaid seat hold was released.",
      },
    })
    await queueNotification(tx, { data: { userId, type: "BOOKING_CANCELLED", title: paid ? "Activity cancellation under refund review" : "Activity booking cancelled", message: paid ? `Booking ${booking.bookingCode} was cancelled and its refund is under review.` : `Booking ${booking.bookingCode} was cancelled.`, data: { bookingId: booking.id, product: "activity", refundStatus: refund?.status ?? null } } })
    return { bookingId: booking.id, status: nextStatus, refundStatus: refund?.status ?? null }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

function serializeBooking(booking: { id: string; bookingCode: string; status: string; totalAmount: Prisma.Decimal; currency: string; expiresAt: Date | null; ActivityPayment: { status: string } | null }) {
  return { id: booking.id, bookingCode: booking.bookingCode, status: booking.status, totalAmount: Number(booking.totalAmount), currency: booking.currency, expiresAt: booking.expiresAt?.toISOString() ?? null, paymentStatus: booking.ActivityPayment?.status ?? null }
}
