import { randomBytes } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { prepareTravelerIdentity, assertTravelersAreUniqueForTour } from "@/modules/tour/services/tour-traveler-duplicate.service"
import { calculateRefundAmount, calculateRefundPercent } from "@/modules/tour/services/tour-cancellation-policy"
import { assertTravelersMeetMinimumAge } from "@/modules/tour/services/tour-listing-policy"
import type { CreateTourBookingIntentInput, TourTravelerInput } from "@/modules/tour/validators/tour-booking.validators"

export { calculateRefundPercent } from "@/modules/tour/services/tour-cancellation-policy"

const TAX_RATE = 0.12
const PLATFORM_FEE_RATE = 0.10

function bookingCode() {
  return `TB${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`
}

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function dateOrNull(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function findTour(tourKey: string) {
  return prisma.tour.findFirst({
    where: { OR: [{ id: tourKey }, { slug: tourKey }], deletedAt: null, isActive: true },
    select: {
      id: true, hostId: true, title: true, totalSlots: true, availableSlots: true, pricePerPerson: true,
      startDate: true, endDate: true, registrationDeadline: true, status: true, tourStatus: true,
      joinApprovalRequired: true, womenOnly: true, verifiedTravelersOnly: true,
      riskLevel: true, riskDisclosure: true, meetingPoint: true, eligibilityRequirements: true,
      requiredEquipment: true, minimumAge: true, requiresCaretaker: true,
      Host: { select: { userId: true, isActive: true, isApproved: true, isVerified: true } },
    },
  })
}

async function getBatch(tx: Prisma.TransactionClient, tourId: string, batchId?: string) {
  if (!batchId || batchId.startsWith("tour:")) return null
  const rows = await tx.$queryRaw<{
    id: string
    startDate: Date
    endDate: Date
    seatsLeft: number
    basePrice: { toString(): string } | number
    earlyBirdPrice: { toString(): string } | number | null
    earlyBirdEndsAt: Date | null
    status: string
  }[]>`
    SELECT "id", "startDate", "endDate", "seatsLeft", "basePrice", "earlyBirdPrice", "earlyBirdEndsAt", "status"
    FROM "TourDepartureBatch"
    WHERE "id" = ${batchId} AND "tourId" = ${tourId}
    LIMIT 1
  `
  return rows[0] ?? null
}

function unitPrice(tourPrice: number, batch: Awaited<ReturnType<typeof getBatch>>) {
  if (!batch) return tourPrice
  const early = batch.earlyBirdPrice == null ? null : Number(batch.earlyBirdPrice)
  if (early && batch.earlyBirdEndsAt && batch.earlyBirdEndsAt > new Date()) return early
  return Number(batch.basePrice)
}

async function insertTravelers(tx: Prisma.TransactionClient, bookingId: string, travelers: TourTravelerInput[], status: string) {
  for (const traveler of travelers) {
    const identity = prepareTravelerIdentity(traveler)
    await tx.$executeRaw`
      INSERT INTO "TourTraveler" (
        "tourBookingId", "fullName", "normalizedName", "age", "dob", "aadhaarHash", "aadhaarLast4", "gender", "email", "phone",
        "emergencyContactName", "emergencyContactPhone", "country", "foodPreference",
        "medicalNotes", "bloodGroup", "idType", "idUploadUrl", "relation", "seatPreference", "status"
      ) VALUES (
        ${bookingId}, ${traveler.fullName}, ${identity.normalizedName}, ${traveler.age ?? null}, ${dateOrNull(traveler.dob)}, ${identity.aadhaarHash}, ${identity.aadhaarLast4}, ${traveler.gender ?? null},
        ${traveler.email || null}, ${traveler.phone || null}, ${traveler.emergencyContactName ?? null}, ${traveler.emergencyContactPhone ?? null},
        ${traveler.country ?? null}, ${traveler.foodPreference ?? null}, ${traveler.medicalNotes ?? null}, ${traveler.bloodGroup ?? null},
        ${traveler.idType ?? null}, ${traveler.idUploadUrl || null}, ${traveler.relation ?? null}, ${traveler.seatPreference ?? null}, ${status}
      )
    `
  }
}

async function queueWaitlist(tx: Prisma.TransactionClient, bookingId: string, tourId: string, batchId: string | null, userId: string, groupSize: number) {
  const positionRows = await tx.$queryRaw<{ nextPosition: number }[]>`
    SELECT COALESCE(MAX("position"), 0) + 1 AS "nextPosition"
    FROM "WaitlistQueue"
    WHERE "tourId" = ${tourId} AND COALESCE("batchId", 'tour') = COALESCE(${batchId}, 'tour') AND "status" = 'WAITLISTED'
  `
  const position = Number(positionRows[0]?.nextPosition ?? 1)
  const rows = await tx.$queryRaw<{ id: string; position: number; groupSize: number; expiresAt: Date | null }[]>`
    INSERT INTO "WaitlistQueue" ("tourId", "batchId", "tourBookingId", "userId", "groupSize", "position", "status", "expiresAt")
    VALUES (${tourId}, ${batchId}, ${bookingId}, ${userId}, ${groupSize}, ${position}, 'WAITLISTED', ${new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)})
    RETURNING "id", "position", "groupSize", "expiresAt"
  `
  return rows[0]
}

export async function createTourBookingIntent(userId: string, tourKey: string, input: CreateTourBookingIntentInput) {
  const travelers = input.travelers
  if (input.riskAcknowledged !== true) throw new Error("Risk disclosure acknowledgement is required before booking")
  const groupSize = travelers.length
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")
  if (tour.status !== "ACTIVE") throw new Error("Tour is not open for booking")
  if (!tour.Host.isActive || !tour.Host.isApproved || !tour.Host.isVerified) throw new Error("This host is not available for booking")
  if (tour.Host.userId === userId) throw new Error("Hosts cannot book their own tour")
  if (tour.startDate <= new Date()) throw new Error("This tour has already started")
  if (tour.registrationDeadline && tour.registrationDeadline < new Date()) throw new Error("Registration deadline has passed")
  if (tour.womenOnly && travelers.some(traveler => traveler.gender !== "FEMALE")) throw new Error("Every traveler must meet this women-only tour requirement")
  if (!tour.riskDisclosure || !tour.meetingPoint || tour.eligibilityRequirements.length === 0) throw new Error("This tour is awaiting an updated safety review")

  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existingRows = await tx.$queryRaw<{ id: string; bookingCode: string; status: string; paymentStatus: string; travelersCount: number; confirmedCount: number; waitlistedCount: number; totalAmount: Prisma.Decimal; currency: string }[]>`
        SELECT "id", "bookingCode", "status", "paymentStatus", "travelersCount", "confirmedCount", "waitlistedCount", "totalAmount", "currency"
        FROM "TourBooking"
        WHERE "idempotencyKey" = ${`${userId}:${tour.id}:${input.idempotencyKey}`}
        LIMIT 1
      `
      if (existingRows[0]) {
        const existing = existingRows[0]
        return { bookingId: existing.id, bookingCode: existing.bookingCode, status: existing.status, paymentStatus: existing.paymentStatus, travelersCount: existing.travelersCount, confirmedCount: existing.confirmedCount, waitlistedCount: existing.waitlistedCount, totalAmount: Number(existing.totalAmount), currency: existing.currency }
      }
    }
    if (tour.joinApprovalRequired) {
      const participant = await tx.tourParticipant.findUnique({ where: { tourId_userId: { tourId: tour.id, userId } } })
      if (!participant?.isHostApproved || !["APPROVED", "JOINED"].includes(participant.status)) throw new Error("Host approval is required before booking this tour")
    }
    if (tour.verifiedTravelersOnly) {
      const profile = await tx.userProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile) throw new Error("Complete your traveler profile before booking this tour")
    }
    const batch = await getBatch(tx, tour.id, input.departureBatchId)
    if (input.departureBatchId && !input.departureBatchId.startsWith("tour:") && !batch) throw new Error("Selected departure is unavailable")
    if (batch?.status === "CANCELLED") throw new Error("Selected departure is cancelled")
    assertTravelersMeetMinimumAge(travelers, tour.minimumAge, batch?.startDate ?? tour.startDate)
    await assertTravelersAreUniqueForTour(tx, tour.id, travelers)

    const available = batch ? Number(batch.seatsLeft) : tour.availableSlots
    const price = unitPrice(Number(tour.pricePerPerson), batch)
    const subtotal = toMoney(price * groupSize)
    const taxes = toMoney(subtotal * TAX_RATE)
    const totalAmount = toMoney(subtotal + taxes)
    const canConfirmGroup = available >= groupSize
    const status = canConfirmGroup ? "PENDING" : "WAITLISTED"
    const travelerStatus = canConfirmGroup ? "PENDING" : "WAITLISTED"
    const expiresAt = new Date(Date.now() + (canConfirmGroup ? 15 : 3 * 24 * 60) * 60 * 1000)
    const code = bookingCode()
    const platformFee = toMoney(totalAmount * PLATFORM_FEE_RATE)
    const riskAcknowledgedAt = new Date()
    const riskDisclosureSnapshot = {
      riskLevel: tour.riskLevel,
      riskDisclosure: tour.riskDisclosure,
      meetingPoint: tour.meetingPoint,
      eligibilityRequirements: tour.eligibilityRequirements,
      requiredEquipment: tour.requiredEquipment,
      minimumAge: tour.minimumAge,
      requiresCaretaker: tour.requiresCaretaker,
    }
    const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } })
    if (!user) throw new Error("User not found")
    const legacyBooking = await tx.booking.create({
      data: {
        bookingCode: code, userId, hostId: tour.hostId, tourId: tour.id, checkIn: batch?.startDate ?? tour.startDate,
        checkOut: batch?.endDate ?? tour.endDate, totalGuests: groupSize, adults: groupSize,
        contactName: input.contactName || user.name, contactEmail: input.contactEmail || user.email,
        contactPhone: input.contactPhone || user.phone || "", specialRequests: input.specialRequests || null,
        riskAcknowledgedAt, riskDisclosureSnapshot,
        subtotal: new Prisma.Decimal(subtotal), taxes: new Prisma.Decimal(taxes), totalAmount: new Prisma.Decimal(totalAmount),
        currency: "INR", status: "PENDING", expiresAt,
        Payment: { create: { userId, hostId: tour.hostId, amount: new Prisma.Decimal(totalAmount), hostEarnings: new Prisma.Decimal(totalAmount - platformFee), platformFee: new Prisma.Decimal(platformFee), currency: "INR", provider: "razorpay", status: "PENDING" } },
        BookingTimeline: { create: { type: "CREATED", title: canConfirmGroup ? "Tour booking created" : "Tour waitlist request created", message: canConfirmGroup ? "Complete payment within 15 minutes to reserve these seats." : "We will notify you if enough seats become available.", metadata: { departureBatchId: batch?.id ?? null, groupSize } } },
      },
    })

    const rows = await tx.$queryRaw<{ id: string; bookingCode: string; status: string; paymentStatus: string; totalAmount: Prisma.Decimal; currency: string }[]>`
      INSERT INTO "TourBooking" (
        "bookingCode", "userId", "hostId", "tourId", "batchId", "legacyBookingId", "idempotencyKey", "status", "paymentStatus",
        "travelersCount", "confirmedCount", "waitlistedCount", "unitPrice", "subtotal", "taxes", "totalAmount", "expiresAt", "metadata", "riskAcknowledgedAt", "riskDisclosureSnapshot"
      ) VALUES (
        ${code}, ${userId}, ${tour.hostId}, ${tour.id}, ${batch?.id ?? null}, ${legacyBooking.id}, ${input.idempotencyKey ? `${userId}:${tour.id}:${input.idempotencyKey}` : null}, ${status}, 'PENDING',
        ${groupSize}, 0, ${canConfirmGroup ? 0 : groupSize}, ${new Prisma.Decimal(price)}, ${new Prisma.Decimal(subtotal)},
        ${new Prisma.Decimal(taxes)}, ${new Prisma.Decimal(totalAmount)}, ${expiresAt},
        ${JSON.stringify({ contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone, specialRequests: input.specialRequests ?? null })},
        ${riskAcknowledgedAt}, ${JSON.stringify(riskDisclosureSnapshot)}
      )
      RETURNING "id", "bookingCode", "status", "paymentStatus", "totalAmount", "currency"
    `

    const booking = rows[0]
    await insertTravelers(tx, booking.id, travelers, travelerStatus)

    const waitlist = canConfirmGroup ? null : await queueWaitlist(tx, booking.id, tour.id, batch?.id ?? null, userId, groupSize)

    await tx.auditLog.create({
      data: {
        userId,
        action: "TOUR_BOOKING_INTENT_CREATED",
        entity: "TourBooking",
        entityId: booking.id,
        module: "tour",
        newData: { tourId: tour.id, groupSize, status },
      },
    }).catch(() => null)

    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      travelersCount: groupSize,
      confirmedCount: 0,
      waitlistedCount: canConfirmGroup ? 0 : groupSize,
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      waitlist: waitlist ? { ...waitlist, expiresAt: waitlist.expiresAt?.toISOString() ?? null } : undefined,
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 20000,
  })
}

export async function addTravelersToTourBooking(userId: string, bookingId: string, travelers: TourTravelerInput[]) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; tourId: string; batchId: string | null; userId: string; status: string }[]>`
      SELECT "id", "tourId", "batchId", "userId", "status"
      FROM "TourBooking"
      WHERE "id" = ${bookingId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      LIMIT 1
    `
    const booking = rows[0]
    if (!booking) throw new Error("Booking not found")
    await assertTravelersAreUniqueForTour(tx, booking.tourId, travelers)

    const batch = await getBatch(tx, booking.tourId, booking.batchId ?? undefined)
    const tour = await tx.tour.findUnique({ where: { id: booking.tourId }, select: { availableSlots: true } })
    const available = batch ? Number(batch.seatsLeft) : tour?.availableSlots ?? 0
    const canConfirm = available >= travelers.length
    await insertTravelers(tx, bookingId, travelers, canConfirm ? "PENDING" : "WAITLISTED")
    if (!canConfirm) await queueWaitlist(tx, bookingId, booking.tourId, batch?.id ?? null, userId, travelers.length)
    return { added: travelers.length, status: canConfirm ? "PENDING" : "WAITLISTED" }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function cancelTourBooking(userId: string, bookingId: string, input: { travelerId?: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; tourId: string; batchId: string | null; legacyBookingId: string | null; userId: string; status: string; paymentStatus: string; totalAmount: Prisma.Decimal; travelersCount: number }[]>`
      SELECT "id", "tourId", "batchId", "legacyBookingId", "userId", "status", "paymentStatus", "totalAmount", "travelersCount"
      FROM "TourBooking"
      WHERE "id" = ${bookingId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      LIMIT 1
    `
    const booking = rows[0]
    if (!booking) throw new Error("Booking not found")
    if (["CANCELLED", "EXPIRED"].includes(booking.status)) throw new Error("Booking is already closed")
    const tour = await tx.tour.findUnique({ where: { id: booking.tourId }, select: { startDate: true } })
    if (!tour) throw new Error("Tour not found")

    const travelerRows = input.travelerId ? await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT "id", "status" FROM "TourTraveler" WHERE "id" = ${input.travelerId} AND "tourBookingId" = ${booking.id} LIMIT 1
    ` : []
    if (input.travelerId && !travelerRows[0]) throw new Error("Traveler not found in this booking")
    if (travelerRows[0]?.status === "CANCELLED") throw new Error("Traveler is already cancelled")

    const batchRows = booking.batchId ? await tx.$queryRaw<{ startDate: Date }[]>`SELECT "startDate" FROM "TourDepartureBatch" WHERE "id" = ${booking.batchId} LIMIT 1` : []
    const tripStart = batchRows[0]?.startDate ?? tour.startDate
    const wasConfirmed = booking.status === "CONFIRMED" && booking.paymentStatus === "SUCCESS"
    const cancelledSeats = input.travelerId ? 1 : booking.travelersCount
    const closesBooking = !input.travelerId || booking.travelersCount <= 1

    const refundPercent = wasConfirmed ? calculateRefundPercent(tripStart) : 0
    const scope = input.travelerId ? "TRAVELER" : "BOOKING"
    const refundAmount = calculateRefundAmount(Number(booking.totalAmount), booking.travelersCount, refundPercent, Boolean(input.travelerId))

    await tx.$executeRaw`
      INSERT INTO "TourCancellation" ("tourBookingId", "travelerId", "cancelledById", "scope", "reason", "refundPercent", "refundAmount", "status", "processedAt")
      VALUES (${booking.id}, ${input.travelerId ?? null}, ${userId}, ${scope}, ${input.reason ?? null}, ${refundPercent}, ${new Prisma.Decimal(refundAmount)}, 'APPROVED', CURRENT_TIMESTAMP)
    `

    if (input.travelerId) {
      await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${input.travelerId} AND "tourBookingId" = ${booking.id}`
      await tx.$executeRaw`UPDATE "TourBooking" SET "travelersCount" = GREATEST(0, "travelersCount" - 1), "confirmedCount" = GREATEST(0, "confirmedCount" - ${wasConfirmed ? 1 : 0}), "waitlistedCount" = GREATEST(0, "waitlistedCount" - ${booking.status === "WAITLISTED" ? 1 : 0}), "status" = CASE WHEN "travelersCount" <= 1 THEN 'CANCELLED' ELSE "status" END, "cancelledAt" = CASE WHEN "travelersCount" <= 1 THEN CURRENT_TIMESTAMP ELSE "cancelledAt" END, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.id}`
    } else {
      await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'CANCELLED', "paymentStatus" = ${refundAmount > 0 ? "REFUND_PENDING" : booking.paymentStatus}, "confirmedCount" = 0, "waitlistedCount" = 0, "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.id}`
      await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" = ${booking.id}`
      await tx.$executeRaw`UPDATE "WaitlistQueue" SET "status" = 'DECLINED', "declinedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" = ${booking.id} AND "status" = 'WAITLISTED'`
    }
    if (closesBooking) {
      await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'CANCELLED', "paymentStatus" = ${refundAmount > 0 ? "REFUND_PENDING" : booking.paymentStatus}, "confirmedCount" = 0, "waitlistedCount" = 0, "cancelledAt" = COALESCE("cancelledAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.id}`
      await tx.$executeRaw`UPDATE "WaitlistQueue" SET "status" = 'DECLINED', "declinedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" = ${booking.id} AND "status" = 'WAITLISTED'`
    }

    if (wasConfirmed) {
      await tx.$executeRaw`UPDATE "Tour" SET "availableSlots" = LEAST("totalSlots", "availableSlots" + ${cancelledSeats}), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.tourId}`
      if (booking.batchId) await tx.$executeRaw`UPDATE "TourDepartureBatch" SET "seatsLeft" = LEAST("totalSeats", "seatsLeft" + ${cancelledSeats}), "status" = CASE WHEN "status" = 'SOLD_OUT' THEN 'OPEN' ELSE "status" END, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.batchId}`
    }

    if (closesBooking && booking.legacyBookingId) {
      await tx.booking.update({
        where: { id: booking.legacyBookingId },
        data: {
          status: refundAmount > 0 ? "REFUND_PENDING" : "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason ?? "Traveler cancellation",
          BookingTimeline: { create: { type: "CANCELLED", title: "Booking cancelled", message: refundAmount > 0 ? "Refund review is pending." : "Booking closed without a refund." } },
        },
      })
      await tx.tourParticipant.updateMany({ where: { bookingId: booking.legacyBookingId, tourId: booking.tourId, userId }, data: { status: "CANCELLED", cancelledAt: new Date() } })
    } else if (input.travelerId && booking.legacyBookingId) {
      await tx.booking.update({
        where: { id: booking.legacyBookingId },
        data: {
          totalGuests: { decrement: 1 }, adults: { decrement: 1 },
          BookingTimeline: { create: { type: "CANCELLED", title: "One traveler cancelled", message: refundAmount > 0 ? "A partial refund review is pending." : "The remaining travelers stay confirmed." } },
        },
      })
    }

    if (refundAmount > 0) {
      const payment = booking.legacyBookingId ? await tx.payment.findUnique({ where: { bookingId: booking.legacyBookingId }, select: { id: true } }) : null
      await tx.$executeRaw`
        INSERT INTO "Refund" ("tourBookingId", "paymentId", "amount", "currency", "status", "reason")
        VALUES (${booking.id}, ${payment?.id ?? null}, ${new Prisma.Decimal(refundAmount)}, 'INR', 'PENDING', ${input.reason ?? "Traveler cancellation"})
      `
    }

    return { bookingId: booking.id, scope, refundPercent, refundAmount }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
