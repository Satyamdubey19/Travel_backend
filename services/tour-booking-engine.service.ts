import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { prepareTravelerIdentity, assertTravelersAreUniqueForTour } from "@/services/tour-traveler-duplicate.service"
import type { CreateTourBookingIntentInput, TourTravelerInput } from "@/validators/tour-booking.validators"

const TAX_RATE = 0.12

function bookingCode() {
  return `TB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`
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
    select: { id: true, hostId: true, title: true, totalSlots: true, availableSlots: true, pricePerPerson: true, startDate: true, endDate: true, status: true, tourStatus: true },
  })
}

async function getBatch(tx: Prisma.TransactionClient, tourId: string, batchId?: string) {
  if (!batchId || batchId.startsWith("tour:")) return null
  const rows = await tx.$queryRaw<{
    id: string
    seatsLeft: number
    basePrice: { toString(): string } | number
    earlyBirdPrice: { toString(): string } | number | null
    earlyBirdEndsAt: Date | null
    status: string
  }[]>`
    SELECT "id", "seatsLeft", "basePrice", "earlyBirdPrice", "earlyBirdEndsAt", "status"
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
  const groupSize = travelers.length
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")
  if (tour.status !== "ACTIVE") throw new Error("Tour is not open for booking")

  return prisma.$transaction(async (tx) => {
    const batch = await getBatch(tx, tour.id, input.departureBatchId)
    if (input.departureBatchId && !input.departureBatchId.startsWith("tour:") && !batch) throw new Error("Selected departure is unavailable")
    if (batch?.status === "CANCELLED") throw new Error("Selected departure is cancelled")
    await assertTravelersAreUniqueForTour(tx, tour.id, travelers)

    const available = batch ? Number(batch.seatsLeft) : tour.availableSlots
    const price = unitPrice(Number(tour.pricePerPerson), batch)
    const subtotal = toMoney(price * groupSize)
    const taxes = toMoney(subtotal * TAX_RATE)
    const totalAmount = toMoney(subtotal + taxes)
    const canConfirmGroup = available >= groupSize
    const status = canConfirmGroup ? "PENDING" : "WAITLISTED"
    const travelerStatus = canConfirmGroup ? "PENDING" : "WAITLISTED"

    const rows = await tx.$queryRaw<{ id: string; bookingCode: string; status: string; paymentStatus: string; totalAmount: Prisma.Decimal; currency: string }[]>`
      INSERT INTO "TourBooking" (
        "bookingCode", "userId", "hostId", "tourId", "batchId", "status", "paymentStatus",
        "travelersCount", "confirmedCount", "waitlistedCount", "unitPrice", "subtotal", "taxes", "totalAmount", "expiresAt", "metadata"
      ) VALUES (
        ${bookingCode()}, ${userId}, ${tour.hostId}, ${tour.id}, ${batch?.id ?? null}, ${status}, 'PENDING',
        ${groupSize}, ${canConfirmGroup ? groupSize : 0}, ${canConfirmGroup ? 0 : groupSize}, ${new Prisma.Decimal(price)}, ${new Prisma.Decimal(subtotal)},
        ${new Prisma.Decimal(taxes)}, ${new Prisma.Decimal(totalAmount)}, ${new Date(Date.now() + 1000 * 60 * 15)},
        ${JSON.stringify({ contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone, specialRequests: input.specialRequests ?? null })}
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
      confirmedCount: canConfirmGroup ? groupSize : 0,
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

export function calculateRefundPercent(startDate: Date, now = new Date()) {
  const hours = (startDate.getTime() - now.getTime()) / 36e5
  const days = hours / 24
  if (hours < 24) return 0
  if (days > 30) return 100
  if (days >= 15) return 75
  if (days >= 7) return 50
  return 0
}

export async function cancelTourBooking(userId: string, bookingId: string, input: { travelerId?: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; tourId: string; batchId: string | null; userId: string; totalAmount: Prisma.Decimal; travelersCount: number }[]>`
      SELECT "id", "tourId", "batchId", "userId", "totalAmount", "travelersCount"
      FROM "TourBooking"
      WHERE "id" = ${bookingId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      LIMIT 1
    `
    const booking = rows[0]
    if (!booking) throw new Error("Booking not found")
    const tour = await tx.tour.findUnique({ where: { id: booking.tourId }, select: { startDate: true } })
    if (!tour) throw new Error("Tour not found")

    const refundPercent = calculateRefundPercent(tour.startDate)
    const scope = input.travelerId ? "TRAVELER" : "BOOKING"
    const refundAmount = toMoney(Number(booking.totalAmount) * (refundPercent / 100))

    await tx.$executeRaw`
      INSERT INTO "TourCancellation" ("tourBookingId", "travelerId", "cancelledById", "scope", "reason", "refundPercent", "refundAmount", "status", "processedAt")
      VALUES (${booking.id}, ${input.travelerId ?? null}, ${userId}, ${scope}, ${input.reason ?? null}, ${refundPercent}, ${new Prisma.Decimal(refundAmount)}, 'APPROVED', CURRENT_TIMESTAMP)
    `

    if (input.travelerId) {
      await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${input.travelerId} AND "tourBookingId" = ${booking.id}`
    } else {
      await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${booking.id}`
      await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" = ${booking.id}`
    }

    if (refundAmount > 0) {
      await tx.$executeRaw`
        INSERT INTO "Refund" ("tourBookingId", "amount", "currency", "status", "reason")
        VALUES (${booking.id}, ${new Prisma.Decimal(refundAmount)}, 'INR', 'PENDING', ${input.reason ?? "Traveler cancellation"})
      `
    }

    return { bookingId: booking.id, scope, refundPercent, refundAmount }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
