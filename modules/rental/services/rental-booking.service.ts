import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requiredEnv } from "@/lib/env"
import { razorpay } from "@/lib/razorpay"
import type { CreateRentalBookingInput, RentalPaymentVerificationInput } from "@/modules/rental/validators/rental-booking.validators"
import { calculateRentalDays, calculateRentalTotal, parseRentalDate, rentalBookingKey } from "@/modules/rental/services/rental-booking-policy"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"

const HOLD_MINUTES = 15

function bookingCode() {
  return `RB${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`
}

export async function createRentalBooking(userId: string, rentalKey: string, input: CreateRentalBookingInput) {
  const rental = await prisma.rental.findFirst({
    where: {
      OR: [{ id: rentalKey }, { slug: rentalKey }], status: "ACTIVE", isActive: true, isApproved: true,
      Host: { is: { isActive: true, isApproved: true, isVerified: true } },
    },
    select: { id: true, hostId: true, title: true, pricePerDay: true, availableUnits: true, cancellationPolicy: true, Host: { select: { userId: true } } },
  })
  if (!rental) throw Object.assign(new Error("Rental is not available for booking"), { statusCode: 404 })
  if (rental.Host.userId === userId) throw Object.assign(new Error("Hosts cannot book their own rental"), { statusCode: 409 })
  if (!rental.cancellationPolicy?.trim()) throw Object.assign(new Error("Rental cancellation terms must be published before booking"), { statusCode: 409 })
  if (rental.availableUnits < 1) throw Object.assign(new Error("This rental is currently unavailable"), { statusCode: 409 })

  const pickupDate = parseRentalDate(input.pickupDate)
  const returnDate = parseRentalDate(input.returnDate)
  const days = calculateRentalDays(pickupDate, returnDate)
  const idempotencyKey = rentalBookingKey(userId, rental.id, input.idempotencyKey)
  const prior = await prisma.rentalBooking.findUnique({ where: { idempotencyKey }, include: { RentalPayment: true } })
  if (prior) return serializeBooking(prior)

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.rentalBooking.findUnique({ where: { idempotencyKey }, include: { RentalPayment: true } })
    if (duplicate) return serializeBooking(duplicate)

    await tx.$queryRaw`SELECT "id" FROM "Rental" WHERE "id" = ${rental.id} FOR UPDATE`
    const overlapping = await tx.rentalBooking.count({
      where: {
        rentalId: rental.id,
        pickupDate: { lt: returnDate },
        returnDate: { gt: pickupDate },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING", expiresAt: { gt: new Date() } }],
      },
    })
    if (overlapping >= rental.availableUnits) throw Object.assign(new Error("No units remain for the selected dates"), { statusCode: 409 })

    const subtotal = calculateRentalTotal(Number(rental.pricePerDay), days)
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000)
    const booking = await tx.rentalBooking.create({
      data: {
        bookingCode: bookingCode(), idempotencyKey, userId, hostId: rental.hostId, rentalId: rental.id,
        pickupDate, returnDate, pickupTime: input.pickupTime || null, days, withHelmet: input.withHelmet,
        withDelivery: false, deliveryFee: new Prisma.Decimal(0), subtotal: new Prisma.Decimal(subtotal), taxes: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(subtotal), currency: "INR", status: "PENDING", expiresAt,
        contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone, notes: input.notes || null,
        RentalPayment: { create: { userId, amount: new Prisma.Decimal(subtotal), currency: "INR", provider: "razorpay", status: "PENDING" } },
        RentalBookingTimeline: { create: { type: "CREATED", title: "Rental held", message: `Complete payment within ${HOLD_MINUTES} minutes.` } },
      },
      include: { RentalPayment: true },
    })
    return serializeBooking(booking)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.rentalBooking.findUnique({ where: { idempotencyKey }, include: { RentalPayment: true } })
      if (existing) return serializeBooking(existing)
    }
    throw error
  })
}

export async function createRentalPaymentOrder(userId: string, rentalKey: string, bookingId: string) {
  const keyId = requiredEnv("RAZORPAY_KEY_ID")
  const booking = await prisma.rentalBooking.findFirst({
    where: { id: bookingId, userId, status: "PENDING", expiresAt: { gt: new Date() }, Rental: { OR: [{ id: rentalKey }, { slug: rentalKey }] } },
    include: { Rental: { select: { title: true } }, RentalPayment: true },
  })
  if (!booking?.RentalPayment) throw Object.assign(new Error("Pending rental booking not found"), { statusCode: 404 })
  if (booking.RentalPayment.providerOrderId && ["PENDING", "PROCESSING"].includes(booking.RentalPayment.status)) {
    return { bookingId, bookingCode: booking.bookingCode, orderId: booking.RentalPayment.providerOrderId, amount: Math.round(Number(booking.totalAmount) * 100), currency: booking.currency, keyId }
  }
  const claim = await prisma.rentalPayment.updateMany({ where: { id: booking.RentalPayment.id, status: "PENDING", providerOrderId: null }, data: { status: "PROCESSING" } })
  if (claim.count !== 1) throw Object.assign(new Error("Payment order creation is already in progress"), { statusCode: 409 })
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(Number(booking.totalAmount) * 100), currency: booking.currency, receipt: booking.bookingCode,
      notes: { productType: "rental", rentalBookingId: booking.id, rentalId: booking.rentalId, rental: booking.Rental.title },
    })
    await prisma.rentalPayment.update({ where: { id: booking.RentalPayment.id }, data: { providerOrderId: order.id } })
    return { bookingId, bookingCode: booking.bookingCode, orderId: order.id, amount: order.amount, currency: order.currency, keyId }
  } catch (error) {
    await prisma.rentalPayment.updateMany({ where: { id: booking.RentalPayment.id, providerOrderId: null, status: "PROCESSING" }, data: { status: "PENDING" } })
    throw error
  }
}

export async function verifyRentalPayment(userId: string, rentalKey: string, input: RentalPaymentVerificationInput) {
  const expected = createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET")).update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`).digest("hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(input.razorpay_signature, "hex")
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) throw Object.assign(new Error("Invalid payment signature"), { statusCode: 400 })
  const payment = await prisma.rentalPayment.findFirst({ where: { providerOrderId: input.razorpay_order_id, userId, RentalBooking: { Rental: { OR: [{ id: rentalKey }, { slug: rentalKey }] } } } })
  if (!payment) throw Object.assign(new Error("Rental payment not found"), { statusCode: 404 })
  return confirmRentalBooking(payment.rentalBookingId, input.razorpay_payment_id)
}

export async function confirmRentalBooking(bookingId: string, providerPaymentId?: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.rentalBooking.findUnique({ where: { id: bookingId }, include: { RentalPayment: true } })
    if (!booking) throw new Error("Rental booking not found")
    if (booking.status === "CONFIRMED") return serializeBooking(booking)
    if (booking.status !== "PENDING" || !booking.expiresAt || booking.expiresAt <= new Date()) throw new Error("Rental booking hold has expired")
    await tx.rentalPayment.update({ where: { rentalBookingId: booking.id }, data: { status: "SUCCESS", providerPaymentId: providerPaymentId ?? booking.RentalPayment?.providerPaymentId, transactionId: providerPaymentId ?? booking.RentalPayment?.transactionId, paidAt: new Date() } })
    const confirmed = await tx.rentalBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", expiresAt: null, RentalBookingTimeline: { create: { type: "CONFIRMED", title: "Rental booking confirmed", message: "Payment was verified and the vehicle is reserved." } } }, include: { RentalPayment: true } })
    await tx.rental.update({ where: { id: booking.rentalId }, data: { totalBookings: { increment: 1 } } })
    await queueNotification(tx, { data: { userId: booking.userId, type: "BOOKING_CONFIRMED", title: "Rental booking confirmed", message: `Booking ${booking.bookingCode} is confirmed.`, data: { bookingId: booking.id, product: "rental" } } })
    return serializeBooking(confirmed)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function cancelRentalBooking(userId: string, bookingId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.rentalBooking.findFirst({ where: { id: bookingId, userId }, include: { Rental: { select: { cancellationPolicy: true } }, RentalPayment: true, RentalRefund: true } })
    if (!booking) throw Object.assign(new Error("Rental booking not found"), { statusCode: 404 })
    if (["CANCELLED", "REFUND_PENDING"].includes(booking.status)) return { bookingId: booking.id, status: booking.status, refundStatus: booking.RentalRefund?.status ?? null }
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) throw Object.assign(new Error("Rental booking can no longer be cancelled"), { statusCode: 409 })
    const paid = booking.RentalPayment?.status === "SUCCESS"
    const nextStatus = paid ? "REFUND_PENDING" : "CANCELLED"
    const claim = await tx.rentalBooking.updateMany({ where: { id: booking.id, userId, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: nextStatus, cancelledAt: new Date(), cancellationReason: reason, expiresAt: null } })
    if (claim.count !== 1) throw Object.assign(new Error("Rental cancellation is already being processed"), { statusCode: 409 })
    if (!paid && booking.RentalPayment) await tx.rentalPayment.updateMany({ where: { id: booking.RentalPayment.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED" } })
    const refund = paid && booking.RentalPayment ? await tx.rentalRefund.upsert({
      where: { rentalBookingId: booking.id },
      create: { rentalBookingId: booking.id, rentalPaymentId: booking.RentalPayment.id, requestedAmount: booking.totalAmount, currency: booking.currency, status: "REVIEW_PENDING", reason, policySnapshot: booking.Rental.cancellationPolicy || "No policy snapshot available" },
      update: {},
    }) : null
    await tx.rentalBookingTimeline.create({ data: { bookingId: booking.id, type: "CANCELLED", title: paid ? "Cancellation submitted for refund review" : "Rental booking cancelled", message: paid ? "The maximum paid amount is under review against the captured policy." : "The unpaid vehicle hold was released." } })
    await queueNotification(tx, { data: { userId, type: "BOOKING_CANCELLED", title: paid ? "Rental cancellation under refund review" : "Rental booking cancelled", message: paid ? `Booking ${booking.bookingCode} was cancelled and its refund is under review.` : `Booking ${booking.bookingCode} was cancelled.`, data: { bookingId: booking.id, product: "rental", refundStatus: refund?.status ?? null } } })
    return { bookingId: booking.id, status: nextStatus, refundStatus: refund?.status ?? null }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

function serializeBooking(booking: { id: string; bookingCode: string; status: string; totalAmount: Prisma.Decimal; currency: string; expiresAt: Date | null; RentalPayment: { status: string } | null }) {
  return { id: booking.id, bookingCode: booking.bookingCode, status: booking.status, totalAmount: Number(booking.totalAmount), currency: booking.currency, expiresAt: booking.expiresAt?.toISOString() ?? null, paymentStatus: booking.RentalPayment?.status ?? null }
}
