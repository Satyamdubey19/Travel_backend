import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { aadhaarLast4, hashAadhaar, maskAadhaar, normalizeTravelerName } from "@/lib/traveler-identity"
import type { TourTravelerInput, ValidateTourTravelerInput } from "@/validators/tour-booking.validators"

const ACTIVE_TRAVELER_STATUSES = ["CONFIRMED", "WAITLISTED", "PENDING"] as const

type DuplicateRow = {
  id: string
  fullName: string
  status: string
  bookingCode: string
  aadhaarLast4: string | null
}

export class DuplicateTravelerError extends Error {
  constructor(message = "This traveler is already booked for this tour. Please enter another traveler.") {
    super(message)
    this.name = "DuplicateTravelerError"
  }
}

export function prepareTravelerIdentity(traveler: Pick<TourTravelerInput, "fullName" | "aadhaar">) {
  return {
    aadhaarHash: hashAadhaar(traveler.aadhaar),
    aadhaarLast4: aadhaarLast4(traveler.aadhaar),
    maskedAadhaar: maskAadhaar(traveler.aadhaar),
    normalizedName: normalizeTravelerName(traveler.fullName),
  }
}

function dateOrNull(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function resolveTourId(tx: Prisma.TransactionClient, tourKey: string) {
  const tour = await tx.tour.findFirst({
    where: { OR: [{ id: tourKey }, { slug: tourKey }], deletedAt: null },
    select: { id: true },
  })
  return tour?.id ?? null
}

export function findDuplicateTravelersInPayload(travelers: TourTravelerInput[]) {
  const aadhaarMap = new Map<string, number>()
  const nameDobMap = new Map<string, number>()
  const nameAgeMap = new Map<string, number>()

  for (let index = 0; index < travelers.length; index += 1) {
    const traveler = travelers[index]
    const identity = prepareTravelerIdentity(traveler)
    const dob = dateOrNull(traveler.dob)?.toISOString().slice(0, 10)
    const age = traveler.age == null ? null : Number(traveler.age)

    const keys = [
      { map: aadhaarMap, key: identity.aadhaarHash },
      ...(dob ? [{ map: nameDobMap, key: `${identity.normalizedName}:${dob}` }] : []),
      ...(age != null ? [{ map: nameAgeMap, key: `${identity.normalizedName}:${age}` }] : []),
    ]

    for (const { map, key } of keys) {
      const previous = map.get(key)
      if (previous !== undefined) {
        return { duplicate: true, firstIndex: previous, duplicateIndex: index }
      }
      map.set(key, index)
    }
  }

  return { duplicate: false, firstIndex: -1, duplicateIndex: -1 }
}

export async function validateTravelerForTour(
  tourKey: string,
  input: ValidateTourTravelerInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const tourId = await resolveTourId(tx, tourKey)
  if (!tourId) throw new Error("Tour not found")

  const identity = prepareTravelerIdentity(input)
  const dob = dateOrNull(input.dob)
  const age = input.age == null ? null : Number(input.age)

  const rows = await tx.$queryRaw<DuplicateRow[]>`
    SELECT tt."id", tt."fullName", tt."status", tb."bookingCode", tt."aadhaarLast4"
    FROM "TourTraveler" tt
    INNER JOIN "TourBooking" tb ON tb."id" = tt."tourBookingId"
    WHERE tb."tourId" = ${tourId}
      AND tb."deletedAt" IS NULL
      AND tt."status" IN (${Prisma.join([...ACTIVE_TRAVELER_STATUSES])})
      AND (
        tt."aadhaarHash" = ${identity.aadhaarHash}
        OR (tt."normalizedName" = ${identity.normalizedName} AND ${dob}::timestamp IS NOT NULL AND tt."dob" = ${dob})
        OR (tt."normalizedName" = ${identity.normalizedName} AND ${age}::integer IS NOT NULL AND tt."age" = ${age})
      )
    LIMIT 1
  `

  const duplicate = rows[0]
  return {
    isDuplicate: Boolean(duplicate),
    message: duplicate ? "This traveler is already registered for this tour." : "Traveler is available for this tour.",
    maskedAadhaar: identity.maskedAadhaar,
    duplicate: duplicate ? {
      travelerId: duplicate.id,
      status: duplicate.status,
      bookingCode: duplicate.bookingCode,
      aadhaarLast4: duplicate.aadhaarLast4,
    } : null,
  }
}

export async function assertTravelersAreUniqueForTour(
  tx: Prisma.TransactionClient,
  tourId: string,
  travelers: TourTravelerInput[],
) {
  const localDuplicate = findDuplicateTravelersInPayload(travelers)
  if (localDuplicate.duplicate) {
    throw new DuplicateTravelerError("This traveler appears more than once in this booking. Please enter another traveler.")
  }

  for (const traveler of travelers) {
    const result = await validateTravelerForTour(tourId, traveler, tx)
    if (result.isDuplicate) {
      throw new DuplicateTravelerError()
    }
  }
}
