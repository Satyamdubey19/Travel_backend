import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requiredEnv } from "@/lib/env"
import { hasValidHmacSha256 } from "@/lib/payment-signature"
import { confirmTourBooking } from "@/modules/tour/services/tour.service"
import { confirmActivityBooking } from "@/modules/activity/services/activity-booking.service"
import { confirmRentalBooking } from "@/modules/rental/services/rental-booking.service"

type RazorpayPaymentEntity = { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; captured?: boolean }
type RazorpayWebhook = { event?: string; payload?: { payment?: { entity?: RazorpayPaymentEntity } } }

export async function handleRazorpayWebhook(rawBody: string, signature: string, eventId: string) {
  const secrets = [requiredEnv("RAZORPAY_WEBHOOK_SECRET"), process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS ?? ""]
  if (!hasValidHmacSha256(rawBody, signature, secrets)) throw Object.assign(new Error("Invalid webhook signature"), { statusCode: 401 })
  if (!eventId || eventId.length > 200) throw Object.assign(new Error("Missing webhook event id"), { statusCode: 400 })

  let event: RazorpayWebhook
  try { event = JSON.parse(rawBody) as RazorpayWebhook }
  catch { throw Object.assign(new Error("Invalid webhook body"), { statusCode: 400 }) }

  const eventType = event.event ?? "unknown"
  const entity = event.payload?.payment?.entity
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } })
  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") return { duplicate: true, status: existing.status }
  if (existing?.status === "PROCESSING") return { duplicate: true, status: "PROCESSING" }

  try {
    await prisma.paymentWebhookEvent.upsert({
      where: { eventId },
      create: { eventId, eventType, providerOrderId: entity?.order_id, providerPaymentId: entity?.id },
      update: { status: "PROCESSING", failureReason: null, eventType, providerOrderId: entity?.order_id, providerPaymentId: entity?.id },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true, status: "PROCESSING" }
    throw error
  }

  if (!["payment.captured", "order.paid", "payment.failed"].includes(eventType)) {
    await prisma.paymentWebhookEvent.update({ where: { eventId }, data: { status: "IGNORED", processedAt: new Date() } })
    return { ignored: true }
  }

  try {
    if (!entity?.order_id || !entity.id) throw new Error("Webhook payment details are incomplete")
    const payment = await prisma.payment.findUnique({ where: { providerOrderId: entity.order_id }, include: { Booking: true } })
    const activityPayment = payment ? null : await prisma.activityPayment.findUnique({ where: { providerOrderId: entity.order_id }, include: { ActivityBooking: true } })
    const rentalPayment = payment || activityPayment ? null : await prisma.rentalPayment.findUnique({ where: { providerOrderId: entity.order_id }, include: { RentalBooking: true } })
    const matchedPayment = payment ?? activityPayment ?? rentalPayment
    if (!matchedPayment) throw new Error("Payment order was not found")
    if (entity.amount !== undefined && entity.amount !== Math.round(Number(matchedPayment.amount) * 100)) throw new Error("Webhook amount does not match the booking")
    if (entity.currency && entity.currency !== matchedPayment.currency) throw new Error("Webhook currency does not match the booking")

    if (eventType === "payment.failed") {
      if (payment && payment.status !== "SUCCESS") await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } })
      if (activityPayment && activityPayment.status !== "SUCCESS") await prisma.activityPayment.update({ where: { id: activityPayment.id }, data: { status: "PENDING" } })
      if (rentalPayment && rentalPayment.status !== "SUCCESS") await prisma.rentalPayment.update({ where: { id: rentalPayment.id }, data: { status: "PENDING" } })
    } else {
      if (entity.captured === false || (entity.status && entity.status !== "captured")) throw new Error("Payment is not captured")
      if (payment) await confirmTourBooking(payment.bookingId, entity.id)
      else if (activityPayment) await confirmActivityBooking(activityPayment.activityBookingId, entity.id)
      else if (rentalPayment) await confirmRentalBooking(rentalPayment.rentalBookingId, entity.id)
    }
    await prisma.paymentWebhookEvent.update({ where: { eventId }, data: { status: "PROCESSED", processedAt: new Date() } })
    return { processed: true }
  } catch (error) {
    await prisma.paymentWebhookEvent.update({ where: { eventId }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed" } })
    throw error
  }
}
