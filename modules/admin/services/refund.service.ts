import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { razorpay } from "@/lib/razorpay"
import type { AdminSession } from "@/utils/admin-auth"
import { assertRefundApproval, assertRefundExecution, assertRefundRejection } from "@/modules/admin/services/refund-policy"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"

export type RefundProduct = "activity" | "rental" | "tour"
export type RefundAction = "approve" | "reject" | "execute" | "reconcile"

function bad(message: string, statusCode = 400) { return Object.assign(new Error(message), { statusCode }) }
const serialize = <T>(value: T) => JSON.parse(JSON.stringify(value))

async function audit(admin: AdminSession, action: string, id: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({ data: { userId: admin.id, action, entity: "REFUND", entityId: id, oldData: serialize(before), newData: serialize(after), severity: action.includes("FAILED") ? "ERROR" : "INFO", module: "payments" } })
}

export async function listAdminRefunds(product?: string, status?: string) {
  const includeActivity = !product || product === "all" || product === "activity"
  const includeRental = !product || product === "all" || product === "rental"
  const includeTour = !product || product === "all" || product === "tour"
  const statusFilter = !status || status === "all" ? undefined : status
  const tourStatusFilter = statusFilter === "REVIEW_PENDING" ? { in: ["PENDING", "REVIEW_PENDING"] } : statusFilter ? { equals: statusFilter } : undefined

  const [activities, rentals, tours] = await Promise.all([
    includeActivity ? prisma.activityRefund.findMany({ where: { status: statusFilter }, include: { ActivityBooking: { include: { Activity: { select: { title: true } }, User: { select: { name: true, email: true } } } }, ActivityPayment: { select: { providerPaymentId: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    includeRental ? prisma.rentalRefund.findMany({ where: { status: statusFilter }, include: { RentalBooking: { include: { Rental: { select: { title: true } }, User: { select: { name: true, email: true } } } }, RentalPayment: { select: { providerPaymentId: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    includeTour ? prisma.refund.findMany({ where: tourStatusFilter ? { status: tourStatusFilter } : undefined, orderBy: { createdAt: "desc" }, take: 200 }) : [],
  ])

  let tourRows: Array<{
    id: string
    product: "tour"
    bookingId: string
    bookingCode: string
    listingTitle: string
    travelerName: string
    travelerEmail: string
    requestedAmount: number
    approvedAmount: number | null
    currency: string
    status: string
    reason: string | null
    policySnapshot: string
    providerRefundId: string | null
    canExecute: boolean
    failureReason: string | null
    createdAt: string
  }> = []

  if (tours.length > 0) {
    const tourBookingIds = [...new Set(tours.map((t) => t.tourBookingId))]
    const explicitPaymentIds = [...new Set(tours.map((t) => t.paymentId).filter(Boolean))] as string[]

    const tourBookings = await prisma.tourBooking.findMany({
      where: { id: { in: tourBookingIds } },
      select: {
        id: true,
        legacyBookingId: true,
        tourId: true,
        userId: true,
      },
    })
    const tourIds = [...new Set(tourBookings.map((tb) => tb.tourId).filter(Boolean))]
    const userIds = [...new Set(tourBookings.map((tb) => tb.userId).filter(Boolean))]
    const legacyBookingIds = [...new Set(tourBookings.map((tb) => tb.legacyBookingId).filter(Boolean))] as string[]

    const [toursData, usersData, explicitPayments, legacyBookings] = await Promise.all([
      tourIds.length > 0
        ? prisma.tour.findMany({ where: { id: { in: tourIds } }, select: { id: true, title: true } })
        : [],
      userIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        : [],
      explicitPaymentIds.length > 0
        ? prisma.payment.findMany({
            where: { id: { in: explicitPaymentIds } },
            select: { id: true, providerPaymentId: true, amount: true },
          })
        : [],
      legacyBookingIds.length > 0
        ? prisma.booking.findMany({
            where: { id: { in: legacyBookingIds } },
            select: {
              id: true,
              bookingCode: true,
              Payment: { select: { id: true, providerPaymentId: true, amount: true } },
            },
          })
        : [],
    ])

    const tbMap = new Map<string, { id: string; legacyBookingId: string | null; tourId: string; userId: string }>()
    for (const tb of tourBookings) tbMap.set(tb.id, tb)

    const tourMap = new Map<string, { id: string; title: string }>()
    for (const t of toursData) tourMap.set(t.id, t)

    const userMap = new Map<string, { id: string; name: string; email: string }>()
    for (const u of usersData) userMap.set(u.id, u)

    const explicitPayMap = new Map<string, { id: string; providerPaymentId: string | null; amount: unknown }>()
    for (const p of explicitPayments) explicitPayMap.set(p.id, p)

    const legacyMap = new Map<string, { id: string; bookingCode: string; Payment: { id: string; providerPaymentId: string | null; amount: unknown } | null }>()
    for (const b of legacyBookings) legacyMap.set(b.id, b)

    tourRows = tours.map((item) => {
      const tb = tbMap.get(item.tourBookingId)
      const tourInfo = tb?.tourId ? tourMap.get(tb.tourId) : null
      const userInfo = tb?.userId ? userMap.get(tb.userId) : null
      const legacyBooking = tb?.legacyBookingId ? legacyMap.get(tb.legacyBookingId) : null
      const payment = (item.paymentId ? explicitPayMap.get(item.paymentId) : null) || legacyBooking?.Payment
      const displayStatus = item.status === "PENDING" ? "REVIEW_PENDING" : item.status
      const isApprovedOrDone = ["APPROVED", "COMPLETED"].includes(item.status)

      return {
        id: item.id,
        product: "tour" as const,
        bookingId: item.tourBookingId,
        bookingCode: legacyBooking?.bookingCode || item.tourBookingId.slice(0, 8).toUpperCase(),
        listingTitle: tourInfo?.title || "Tour Expedition",
        travelerName: userInfo?.name || "Traveler",
        travelerEmail: userInfo?.email || "",
        requestedAmount: Number(item.amount),
        approvedAmount: isApprovedOrDone ? Number(item.amount) : null,
        currency: item.currency,
        status: displayStatus,
        reason: item.reason,
        policySnapshot: "Standard tour cancellation policy",
        providerRefundId: item.providerRefundId,
        canExecute: Boolean(payment?.providerPaymentId),
        failureReason: item.failureReason,
        createdAt: item.createdAt.toISOString(),
      }
    })
  }

  return [
    ...activities.map((item) => ({ id: item.id, product: "activity" as const, bookingId: item.activityBookingId, bookingCode: item.ActivityBooking.bookingCode, listingTitle: item.ActivityBooking.Activity.title, travelerName: item.ActivityBooking.User.name, travelerEmail: item.ActivityBooking.User.email, requestedAmount: Number(item.requestedAmount), approvedAmount: item.approvedAmount == null ? null : Number(item.approvedAmount), currency: item.currency, status: item.status, reason: item.reason, policySnapshot: item.policySnapshot, providerRefundId: item.providerRefundId, canExecute: Boolean(item.ActivityPayment?.providerPaymentId), failureReason: item.failureReason, createdAt: item.createdAt.toISOString() })),
    ...rentals.map((item) => ({ id: item.id, product: "rental" as const, bookingId: item.rentalBookingId, bookingCode: item.RentalBooking.bookingCode, listingTitle: item.RentalBooking.Rental.title, travelerName: item.RentalBooking.User.name, travelerEmail: item.RentalBooking.User.email, requestedAmount: Number(item.requestedAmount), approvedAmount: item.approvedAmount == null ? null : Number(item.approvedAmount), currency: item.currency, status: item.status, reason: item.reason, policySnapshot: item.policySnapshot, providerRefundId: item.providerRefundId, canExecute: Boolean(item.RentalPayment?.providerPaymentId), failureReason: item.failureReason, createdAt: item.createdAt.toISOString() })),
    ...tourRows,
  ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}

export async function decideRefund(product: RefundProduct, id: string, admin: AdminSession, action: RefundAction, approvedAmount?: number, reason?: string) {
  if (action === "approve") return approveRefund(product, id, admin, approvedAmount)
  if (action === "reject") return rejectRefund(product, id, admin, reason)
  if (action === "execute") return executeRefund(product, id, admin)
  return reconcileRefund(product, id, admin)
}

async function approveRefund(product: RefundProduct, id: string, admin: AdminSession, approvedAmount?: number) {
  const before = product === "activity" ? await prisma.activityRefund.findUnique({ where: { id } }) : await prisma.rentalRefund.findUnique({ where: { id } })
  if (!before) throw bad("Refund request not found", 404)
  if (before.status === "APPROVED" && Number(before.approvedAmount) === Number(approvedAmount)) return before
  assertRefundApproval(before.status, Number(before.requestedAmount), Number(approvedAmount))
  const data = { status: "APPROVED", approvedAmount: new Prisma.Decimal(Number(approvedAmount).toFixed(2)), failureReason: null }
  return prisma.$transaction(async (tx) => {
    const claim = product === "activity"
      ? await tx.activityRefund.updateMany({ where: { id, status: "REVIEW_PENDING" }, data })
      : await tx.rentalRefund.updateMany({ where: { id, status: "REVIEW_PENDING" }, data })
    if (claim.count !== 1) throw bad("Refund decision is already being processed", 409)
    const after = product === "activity" ? await tx.activityRefund.findUniqueOrThrow({ where: { id } }) : await tx.rentalRefund.findUniqueOrThrow({ where: { id } })
    await tx.auditLog.create({ data: { userId: admin.id, action: "REFUND_APPROVED", entity: "REFUND", entityId: id, oldData: serialize(before), newData: serialize(after), module: "payments" } })
    return after
  })
}

async function rejectRefund(product: RefundProduct, id: string, admin: AdminSession, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const before = product === "activity" ? await tx.activityRefund.findUnique({ where: { id } }) : await tx.rentalRefund.findUnique({ where: { id } })
    if (!before) throw bad("Refund request not found", 404)
    if (before.status === "REJECTED") return before
    assertRefundRejection(before.status, reason)
    const rejectionReason = reason!.trim()
    const data = { status: "REJECTED", approvedAmount: new Prisma.Decimal(0), failureReason: rejectionReason, processedAt: new Date() }
    const claim = product === "activity"
      ? await tx.activityRefund.updateMany({ where: { id, status: "REVIEW_PENDING" }, data })
      : await tx.rentalRefund.updateMany({ where: { id, status: "REVIEW_PENDING" }, data })
    if (claim.count !== 1) throw bad("Refund decision is already being processed", 409)
    const after = product === "activity" ? await tx.activityRefund.findUniqueOrThrow({ where: { id } }) : await tx.rentalRefund.findUniqueOrThrow({ where: { id } })
    const userId = "activityBookingId" in before
      ? (await tx.activityBooking.update({ where: { id: before.activityBookingId }, data: { status: "CANCELLED" }, select: { userId: true } })).userId
      : (await tx.rentalBooking.update({ where: { id: before.rentalBookingId }, data: { status: "CANCELLED" }, select: { userId: true } })).userId
    await queueNotification(tx, { data: { userId, type: "SYSTEM", title: "Refund review completed", message: `The refund request was not approved. Reason: ${rejectionReason}`, data: { refundId: id, product } } })
    await tx.auditLog.create({ data: { userId: admin.id, action: "REFUND_REJECTED", entity: "REFUND", entityId: id, oldData: serialize(before), newData: serialize(after), module: "payments" } })
    return after
  })
}

async function executeRefund(product: RefundProduct, id: string, admin: AdminSession) {
  let record: { id: string; status: string; approvedAmount: Prisma.Decimal | null; providerRefundId: string | null }
  let paymentId: string | null | undefined
  if (product === "activity") {
    const found = await prisma.activityRefund.findUnique({ where: { id }, include: { ActivityPayment: true } })
    if (!found) throw bad("Refund request not found", 404)
    record = found
    paymentId = found.ActivityPayment?.providerPaymentId
  } else {
    const found = await prisma.rentalRefund.findUnique({ where: { id }, include: { RentalPayment: true } })
    if (!found) throw bad("Refund request not found", 404)
    record = found
    paymentId = found.RentalPayment?.providerPaymentId
  }
  if (record.status === "COMPLETED") return record
  assertRefundExecution(record.status, record.approvedAmount == null ? null : Number(record.approvedAmount), paymentId)
  const capturedPaymentId = paymentId as string
  const approvedAmount = Number(record.approvedAmount)
  const claimed = product === "activity"
    ? await prisma.activityRefund.updateMany({ where: { id, status: { in: ["APPROVED", "FAILED"] } }, data: { status: "PROCESSING", failureReason: null } })
    : await prisma.rentalRefund.updateMany({ where: { id, status: { in: ["APPROVED", "FAILED"] } }, data: { status: "PROCESSING", failureReason: null } })
  if (claimed.count !== 1) throw bad("Refund execution is already in progress", 409)
  let providerRefundId: string | null = null
  try {
    const provider = await razorpay.payments.refund(capturedPaymentId, { amount: Math.round(approvedAmount * 100), speed: "normal", receipt: `refund-${product}-${id}`, notes: { product, refundId: id } })
    providerRefundId = provider.id
    const status = provider.status === "processed" ? "COMPLETED" : provider.status === "failed" ? "FAILED" : "PROCESSING"
    const after = await finishProviderUpdate(product, id, status, provider.id, provider.status === "failed" ? "Provider reported refund failure" : null)
    await finalizeBookingAndPayment(product, id, status)
    await audit(admin, status === "FAILED" ? "REFUND_EXECUTION_FAILED" : "REFUND_EXECUTED", id, record, after)
    return after
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Provider refund request failed"
    const after = await finishProviderUpdate(product, id, "FAILED", providerRefundId, message)
    await audit(admin, "REFUND_EXECUTION_FAILED", id, record, after)
    throw bad(message, 502)
  }
}

async function reconcileRefund(product: RefundProduct, id: string, admin: AdminSession) {
  const record = product === "activity" ? await prisma.activityRefund.findUnique({ where: { id } }) : await prisma.rentalRefund.findUnique({ where: { id } })
  if (!record) throw bad("Refund request not found", 404)
  if (record.status === "COMPLETED") return record
  if (!record.providerRefundId) throw bad("Provider refund reference is missing", 409)
  const provider = await razorpay.refunds.fetch(record.providerRefundId)
  const status = provider.status === "processed" ? "COMPLETED" : provider.status === "failed" ? "FAILED" : "PROCESSING"
  const after = await finishProviderUpdate(product, id, status, provider.id, provider.status === "failed" ? "Provider reported refund failure" : null)
  await finalizeBookingAndPayment(product, id, status)
  await audit(admin, "REFUND_RECONCILED", id, record, after)
  return after
}

async function finishProviderUpdate(product: RefundProduct, id: string, status: string, providerRefundId: string | null, failureReason: string | null) {
  const data = { status, providerRefundId: providerRefundId ?? undefined, failureReason, processedAt: ["COMPLETED", "FAILED"].includes(status) ? new Date() : null }
  return product === "activity" ? prisma.activityRefund.update({ where: { id }, data }) : prisma.rentalRefund.update({ where: { id }, data })
}

async function finalizeBookingAndPayment(product: RefundProduct, id: string, status: string) {
  if (status !== "COMPLETED") return
  await prisma.$transaction(async (tx) => {
    if (product === "activity") {
      const refund = await tx.activityRefund.findUniqueOrThrow({ where: { id }, include: { ActivityPayment: true, ActivityBooking: { select: { userId: true } } } })
      await tx.activityBooking.update({ where: { id: refund.activityBookingId }, data: { status: "CANCELLED", ActivityBookingTimeline: { create: { type: "REFUNDED", title: "Refund completed", message: `Refund of ${refund.currency} ${Number(refund.approvedAmount).toFixed(2)} was processed.` } } } })
      if (refund.ActivityPayment && Number(refund.approvedAmount) === Number(refund.ActivityPayment.amount)) await tx.activityPayment.update({ where: { id: refund.ActivityPayment.id }, data: { status: "REFUNDED" } })
      await queueNotification(tx, { data: { userId: refund.ActivityBooking.userId, type: "REFUND_PROCESSED", title: "Refund processed", message: `${refund.currency} ${Number(refund.approvedAmount).toFixed(2)} was processed through the payment provider.`, data: { refundId: id, product } } })
    } else {
      const refund = await tx.rentalRefund.findUniqueOrThrow({ where: { id }, include: { RentalPayment: true, RentalBooking: { select: { userId: true } } } })
      await tx.rentalBooking.update({ where: { id: refund.rentalBookingId }, data: { status: "CANCELLED", RentalBookingTimeline: { create: { type: "REFUNDED", title: "Refund completed", message: `Refund of ${refund.currency} ${Number(refund.approvedAmount).toFixed(2)} was processed.` } } } })
      if (refund.RentalPayment && Number(refund.approvedAmount) === Number(refund.RentalPayment.amount)) await tx.rentalPayment.update({ where: { id: refund.RentalPayment.id }, data: { status: "REFUNDED" } })
      await queueNotification(tx, { data: { userId: refund.RentalBooking.userId, type: "REFUND_PROCESSED", title: "Refund processed", message: `${refund.currency} ${Number(refund.approvedAmount).toFixed(2)} was processed through the payment provider.`, data: { refundId: id, product } } })
    }
  })
}
