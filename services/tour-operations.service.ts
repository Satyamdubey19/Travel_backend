import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type TourBatch = {
  id: string
  tourId: string
  label: string | null
  startDate: Date
  endDate: Date
  registrationDeadline: Date | null
  cancellationCutoff: Date | null
  totalSeats: number
  seatsLeft: number
  basePrice: { toString(): string } | number
  earlyBirdPrice: { toString(): string } | number | null
  earlyBirdEndsAt: Date | null
  status: string
}

type CreateBatchInput = {
  label?: string
  startDate?: string
  endDate?: string
  registrationDeadline?: string
  cancellationCutoff?: string
  totalSeats?: number
  basePrice?: number
  earlyBirdPrice?: number
  earlyBirdEndsAt?: string
  status?: string
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeBatch(batch: TourBatch) {
  const now = Date.now()
  const earlyBirdPrice = batch.earlyBirdPrice == null ? null : Number(batch.earlyBirdPrice)
  const earlyBirdActive = Boolean(earlyBirdPrice && batch.earlyBirdEndsAt && batch.earlyBirdEndsAt.getTime() > now)
  const seatsLeft = Math.max(0, Number(batch.seatsLeft ?? 0))
  const derivedStatus = seatsLeft <= 0 ? "SOLD_OUT" : seatsLeft <= Math.max(2, Math.ceil(Number(batch.totalSeats) * 0.2)) ? "ALMOST_FULL" : batch.status

  return {
    ...batch,
    startDate: batch.startDate.toISOString(),
    endDate: batch.endDate.toISOString(),
    registrationDeadline: batch.registrationDeadline?.toISOString() ?? null,
    cancellationCutoff: batch.cancellationCutoff?.toISOString() ?? null,
    earlyBirdEndsAt: batch.earlyBirdEndsAt?.toISOString() ?? null,
    basePrice: Number(batch.basePrice),
    earlyBirdPrice,
    currentPrice: earlyBirdActive ? earlyBirdPrice : Number(batch.basePrice),
    earlyBirdActive,
    seatsLeft,
    status: derivedStatus,
  }
}

async function findTour(tourKey: string) {
  return prisma.tour.findFirst({
    where: { OR: [{ id: tourKey }, { slug: tourKey }], deletedAt: null },
    select: {
      id: true,
      hostId: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      totalSlots: true,
      availableSlots: true,
      pricePerPerson: true,
    },
  })
}

function fallbackBatch(tour: NonNullable<Awaited<ReturnType<typeof findTour>>>) {
  const seatsLeft = Math.max(0, tour.availableSlots)
  return {
    id: `tour:${tour.id}`,
    tourId: tour.id,
    label: "Primary departure",
    startDate: tour.startDate.toISOString(),
    endDate: tour.endDate.toISOString(),
    registrationDeadline: tour.registrationDeadline?.toISOString() ?? null,
    cancellationCutoff: tour.registrationDeadline?.toISOString() ?? null,
    totalSeats: tour.totalSlots,
    seatsLeft,
    basePrice: Number(tour.pricePerPerson),
    earlyBirdPrice: null,
    earlyBirdEndsAt: null,
    currentPrice: Number(tour.pricePerPerson),
    earlyBirdActive: false,
    status: seatsLeft <= 0 ? "SOLD_OUT" : seatsLeft <= Math.max(2, Math.ceil(tour.totalSlots * 0.2)) ? "ALMOST_FULL" : "OPEN",
  }
}

export async function listTourBatches(tourKey: string) {
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")

  const rows = await prisma.$queryRaw<TourBatch[]>`
    SELECT * FROM "TourDepartureBatch"
    WHERE "tourId" = ${tour.id}
    ORDER BY "startDate" ASC
  `

  return rows.length > 0 ? rows.map(normalizeBatch) : [fallbackBatch(tour)]
}

export async function createTourBatch(hostId: string, tourKey: string, input: CreateBatchInput) {
  const tour = await findTour(tourKey)
  if (!tour || tour.hostId !== hostId) throw new Error("Tour not found")

  const startDate = toDate(input.startDate) ?? tour.startDate
  const endDate = toDate(input.endDate) ?? tour.endDate
  const registrationDeadline = toDate(input.registrationDeadline) ?? tour.registrationDeadline
  const cancellationCutoff = toDate(input.cancellationCutoff) ?? registrationDeadline
  const totalSeats = Math.max(1, Math.trunc(Number(input.totalSeats ?? tour.totalSlots)))
  const basePrice = Math.max(1, Number(input.basePrice ?? tour.pricePerPerson))

  const rows = await prisma.$queryRaw<TourBatch[]>`
    INSERT INTO "TourDepartureBatch" (
      "tourId", "label", "startDate", "endDate", "registrationDeadline", "cancellationCutoff",
      "totalSeats", "seatsLeft", "basePrice", "earlyBirdPrice", "earlyBirdEndsAt", "status"
    )
    VALUES (
      ${tour.id}, ${input.label ?? null}, ${startDate}, ${endDate}, ${registrationDeadline}, ${cancellationCutoff},
      ${totalSeats}, ${totalSeats}, ${new Prisma.Decimal(basePrice)}, ${input.earlyBirdPrice ? new Prisma.Decimal(input.earlyBirdPrice) : null},
      ${toDate(input.earlyBirdEndsAt)}, ${input.status ?? "OPEN"}
    )
    RETURNING *
  `

  return normalizeBatch(rows[0])
}

export async function joinTourWaitlist(userId: string, tourKey: string, input: { batchId?: string; seatsRequested?: number }) {
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")

  const batchId = input.batchId?.startsWith("tour:") ? null : input.batchId ?? null
  const seatsRequested = Math.max(1, Math.min(10, Math.trunc(Number(input.seatsRequested ?? 1))))
  const positionRow = await prisma.$queryRaw<{ nextPosition: number }[]>`
    SELECT COALESCE(MAX("position"), 0) + 1 AS "nextPosition"
    FROM "TourWaitlist"
    WHERE "tourId" = ${tour.id} AND "status" = 'WAITING'
  `
  const position = Number(positionRow[0]?.nextPosition ?? 1)

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    INSERT INTO "TourWaitlist" ("userId", "tourId", "batchId", "position", "seatsRequested", "status", "expiresAt")
    VALUES (${userId}, ${tour.id}, ${batchId}, ${position}, ${seatsRequested}, 'WAITING', ${new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)})
    ON CONFLICT ("userId", "tourId", (COALESCE("batchId", 'tour'))) DO UPDATE SET
      "seatsRequested" = EXCLUDED."seatsRequested",
      "status" = 'WAITING',
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING *
  `

  await prisma.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: "You joined the waitlist",
      message: `We will notify you if seats open for ${tour.title}.`,
      data: { tourId: tour.id, batchId, seatsRequested },
    },
  }).catch(() => null)

  return rows[0]
}

export async function listTourAnnouncements(tourKey: string) {
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")
  return prisma.$queryRaw`
    SELECT * FROM "TourAnnouncement"
    WHERE "tourId" = ${tour.id}
    ORDER BY "isPinned" DESC, "createdAt" DESC
    LIMIT 20
  `
}

export async function createTourAnnouncement(hostId: string, tourKey: string, input: { title?: string; message?: string; severity?: string; isPinned?: boolean }) {
  const tour = await findTour(tourKey)
  if (!tour || tour.hostId !== hostId) throw new Error("Tour not found")
  if (!input.title?.trim() || !input.message?.trim()) throw new Error("Announcement title and message are required")

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    INSERT INTO "TourAnnouncement" ("tourId", "hostId", "title", "message", "severity", "isPinned")
    VALUES (${tour.id}, ${hostId}, ${input.title.trim()}, ${input.message.trim()}, ${input.severity ?? "INFO"}, ${Boolean(input.isPinned)})
    RETURNING *
  `
  return rows[0]
}

export async function listTourDocuments(tourKey: string, participantOnly = false) {
  const tour = await findTour(tourKey)
  if (!tour) throw new Error("Tour not found")
  return prisma.$queryRaw`
    SELECT * FROM "TourDocument"
    WHERE "tourId" = ${tour.id}
    AND (${participantOnly} = false OR "visibility" IN ('PUBLIC', 'PARTICIPANTS'))
    ORDER BY "createdAt" DESC
  `
}

export async function createTourDocument(hostId: string, tourKey: string, input: { title?: string; url?: string; documentType?: string; visibility?: string }) {
  const tour = await findTour(tourKey)
  if (!tour || tour.hostId !== hostId) throw new Error("Tour not found")
  if (!input.title?.trim() || !input.url?.trim()) throw new Error("Document title and URL are required")

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    INSERT INTO "TourDocument" ("tourId", "hostId", "title", "documentType", "url", "visibility")
    VALUES (${tour.id}, ${hostId}, ${input.title.trim()}, ${input.documentType ?? "GUIDELINE"}, ${input.url.trim()}, ${input.visibility ?? "PARTICIPANTS"})
    RETURNING *
  `
  return rows[0]
}
