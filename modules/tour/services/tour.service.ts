import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { razorpay } from "@/lib/razorpay"
import { requiredEnv } from "@/lib/env"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"
import { requireTourCircleAccess } from "./tour-circle-access.service"
import { blockedUserIdsFor } from "@/modules/community/services/community-safety.service"
import { assertTourSafetyReady } from "@/modules/tour/services/tour-listing-policy"
import type { ListingStatus, TourDifficulty, TourRiskLevel } from "@prisma/client"
import type { Tour } from "@/lib/tours"

const TAX_RATE = 0.12
const PLATFORM_FEE_RATE = 0.1

function generateBookingCode() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = randomBytes(4).toString("hex").toUpperCase()
  return `GT${timestamp}${random}`
}

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function publicTourWhere(id: string) {
  return {
    OR: [{ id }, { slug: id }],
    deletedAt: null,
    status: "ACTIVE" as const,
    isActive: true,
    isApproved: true,
    riskDisclosure: { not: null },
    meetingPoint: { not: null },
    Host: { is: { isActive: true, isApproved: true, isVerified: true } },
  }
}

async function getTourTravelerProfile(userId: string) {
  return prisma.userProfile.findUnique({
    where: { userId },
    select: { gender: true },
  })
}

export type TourInput = {
  slug: string
  title: string
  description: string
  destination: string
  city?: string
  state?: string
  country?: string
  latitude?: string
  longitude?: string
  startDate?: string
  endDate?: string
  registrationDeadline?: string
  duration: string
  maxGroupSize: string
  totalSlots?: string
  availableSlots?: string
  pricePerPerson: string
  originalPrice?: string
  difficulty?: string
  category?: string
  tags?: string[]
  joinApprovalRequired?: boolean
  womenOnly?: boolean
  safeForSoloWomen?: boolean
  verifiedTravelersOnly?: boolean
  images?: string[]
  highlights?: string[]
  included?: string[]
  excluded?: string[]
  languages?: string | string[]
  cancellationPolicy?: string
  riskLevel?: string
  riskDisclosure?: string
  meetingPoint?: string
  eligibilityRequirements?: string[]
  requiredEquipment?: string[]
  emergencyPlan?: string
  minimumAge?: string | number
  requiresCaretaker?: boolean
  status?: string
}

export type ItineraryDayInput = {
  day: number
  title?: string
  description?: string
  activities?: string[]
  meals?: string[]
}

export type TourBookingInput = {
  guestCount?: number
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  specialRequests?: string
  departureBatchId?: string
}

export type VerifyTourPaymentInput = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

function validateTourListing(tourData: TourInput) {
  const invalid = (message: string) => { throw Object.assign(new Error(message), { statusCode: 400 }) }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tourData.slug?.trim() || "")) invalid("Tour slug must use lowercase words separated by hyphens")
  if ((tourData.title?.trim().length || 0) < 5) invalid("Tour title must be at least 5 characters")
  if ((tourData.description?.trim().length || 0) < 40) invalid("Tour description must be at least 40 characters")
  if ((tourData.destination?.trim().length || 0) < 2) invalid("Tour destination is required")
  const duration = Number(tourData.duration)
  const groupSize = Number(tourData.maxGroupSize)
  const totalSlots = Number(tourData.totalSlots ?? tourData.maxGroupSize)
  const availableSlots = Number(tourData.availableSlots ?? totalSlots)
  const price = Number(tourData.pricePerPerson)
  if (!Number.isInteger(duration) || duration < 1 || duration > 90) invalid("Tour duration must be between 1 and 90 days")
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 100) invalid("Group size must be between 1 and 100")
  if (!Number.isInteger(totalSlots) || totalSlots < 1 || totalSlots > groupSize) invalid("Total slots must be within the group size")
  if (!Number.isInteger(availableSlots) || availableSlots < 0 || availableSlots > totalSlots) invalid("Available slots must be between zero and total slots")
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) invalid("Tour price must be greater than zero")
  if ((tourData.cancellationPolicy?.trim().length || 0) < 20) invalid("A clear cancellation policy of at least 20 characters is required")
  if (!tourData.images?.some((image) => image.trim())) invalid("At least one tour image is required")
  const startDate = tourData.startDate ? new Date(tourData.startDate) : null
  const endDate = tourData.endDate ? new Date(tourData.endDate) : null
  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime()) || endDate < startDate) invalid("Valid start and end dates are required")
  assertTourSafetyReady(tourData)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function parseLanguages(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value || "English")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
}


export async function listTours(hostId: string) {
  return prisma.tour.findMany({
    where: { hostId },
    include: {
      TourItineraryDay: { orderBy: { day: "asc" } },
      _count: { select: { Booking: true, Review: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getTourById(id: string, hostId: string) {
  return prisma.tour.findFirst({
    where: { id, hostId },
    include: { TourItineraryDay: { orderBy: { day: "asc" } } },
  })
}

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("connection ended") ||
    message.includes("terminating connection") ||
    message.includes("timeout expired")
  )
}

async function queryPublicTours() {
  return prisma.tour.findMany({
    where: { status: "ACTIVE", isActive: true, isApproved: true, deletedAt: null, riskDisclosure: { not: null }, meetingPoint: { not: null }, Host: { is: { isActive: true, isApproved: true, isVerified: true } } },
    include: {
      TourItineraryDay: { orderBy: { day: "asc" } },
      _count: { select: { Booking: true, Review: true } },
    },
    orderBy: [{ totalBookings: "desc" }, { averageRating: "desc" }],
  })
}

export async function listPublicTours() {
  try {
    const tours = await queryPublicTours().catch(async (error) => {
      if (!isTransientDatabaseError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 350))
      return queryPublicTours()
    })

    return tours.map(normalizeTourForPublic)
  } catch (error) { throw error }
}

export async function getPublicTourBySlug(slug: string) {
  const tour = await prisma.tour.findFirst({
    where: {
      ...publicTourWhere(slug),
    },
    include: {
      TourItineraryDay: { orderBy: { day: "asc" } },
      _count: { select: { Booking: true, Review: true } },
    },
  })

  return tour ? normalizeTourForPublic(tour as PublicTourRecord) : null
}

export type TourWithRelations = {
  latitude: number | null
  longitude: number | null
  duration: number
  maxGroupSize: number
  totalSlots: number
  availableSlots: number
  pricePerPerson: { toString(): string } | number
  originalPrice: { toString(): string } | number | null
  languages: string[]
  TourItineraryDay: ItineraryDayInput[]
  [key: string]: unknown
}

export function normalizeTourForForm(tour: TourWithRelations) {
  return {
    ...tour,
    latitude: tour.latitude != null ? String(tour.latitude) : "",
    longitude: tour.longitude != null ? String(tour.longitude) : "",
    duration: String(tour.duration),
    maxGroupSize: String(tour.maxGroupSize),
    totalSlots: String(tour.totalSlots),
    availableSlots: String(tour.availableSlots),
    pricePerPerson: String(tour.pricePerPerson),
    originalPrice: tour.originalPrice != null ? String(tour.originalPrice) : "",
    languages: tour.languages.join(", "),
    itinerary: tour.TourItineraryDay,
  }
}

type PublicTourRecord = {
  id: string
  slug: string
  title: string
  description: string
  destination: string
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  duration: number
  pricePerPerson: { toString(): string } | number
  availableSlots: number
  totalSlots: number
  joinApprovalRequired: boolean
  womenOnly: boolean
  safeForSoloWomen: boolean
  verifiedTravelersOnly: boolean
  averageRating: number
  totalReviews: number
  images: string[]
  highlights: string[]
  included: string[]
  excluded: string[]
  difficulty: string
  riskLevel: string
  riskDisclosure: string | null
  meetingPoint: string | null
  eligibilityRequirements: string[]
  requiredEquipment: string[]
  emergencyPlan: string | null
  minimumAge: number
  requiresCaretaker: boolean
  languages: string[]
  category: string | null
  TourItineraryDay: {
    day: number
    title: string
    description: string
    activities: string[]
    meals: string[]
  }[]
  _count?: { Booking: number; Review: number }
}

export function normalizeTourForPublic(tour: PublicTourRecord): Tour {
  const images = tour.images.length > 0 ? tour.images : ["/tour1.jpg"]
  const city = tour.city ?? tour.destination.split(",")[0]?.trim() ?? "India"
  const country = tour.country ?? "India"
  const category = (tour.category ?? "adventure").toLowerCase()

  return {
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    destination: tour.destination,
    location: {
      lat: tour.latitude ?? 0,
      lng: tour.longitude ?? 0,
      city,
      country,
    },
    duration: tour.duration,
    price: Number(tour.pricePerPerson),
    groupSize: `${Math.max(0, tour.availableSlots)} of ${tour.totalSlots} slots available`,
    availableSlots: tour.availableSlots,
    totalSlots: tour.totalSlots,
    joinApprovalRequired: tour.joinApprovalRequired,
    womenOnly: tour.womenOnly,
    safeForSoloWomen: tour.safeForSoloWomen,
    verifiedTravelersOnly: tour.verifiedTravelersOnly,
    riskLevel: tour.riskLevel,
    riskDisclosure: tour.riskDisclosure ?? "",
    meetingPoint: tour.meetingPoint ?? "",
    eligibilityRequirements: tour.eligibilityRequirements,
    requiredEquipment: tour.requiredEquipment,
    // Operational response plans can contain private contacts and routes. Public
    // clients only need to know that a reviewed plan exists.
    emergencyPlanRecorded: Boolean(tour.emergencyPlan?.trim()),
    minimumAge: tour.minimumAge,
    requiresCaretaker: tour.requiresCaretaker,
    languages: tour.languages,
    rating: tour.averageRating,
    reviews: tour.totalReviews || tour._count?.Review || 0,
    image: images[0],
    gallery: images,
    description: tour.description,
    highlights: tour.highlights,
    itinerary: tour.TourItineraryDay.map((day) => ({
      day: day.day,
      title: day.title,
      description: day.description,
      activities: day.activities,
      meals: day.meals,
    })),
    includedStays: [],
    bestTimeToVisit: "October to March",
    category,
    tags: [category, city.toLowerCase(), tour.difficulty.toLowerCase()],
    budget: {
      perPersonBase: Number(tour.pricePerPerson),
      inclusions: tour.included,
      exclusions: tour.excluded,
    },
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function createTour(
  hostId: string,
  tourData: TourInput,
  itinerary: ItineraryDayInput[],
) {
  validateTourListing(tourData)
  const languages = parseLanguages(tourData.languages)
  const totalSlots = parseInt(tourData.totalSlots ?? tourData.maxGroupSize ?? "20") || 20
  const availableSlots = Math.min(parseInt(tourData.availableSlots ?? String(totalSlots)) || totalSlots, totalSlots)
  const startDate = tourData.startDate ? new Date(tourData.startDate) : new Date()
  const endDate = tourData.endDate ? new Date(tourData.endDate) : new Date(startDate.getTime() + ((parseInt(tourData.duration) || 1) - 1) * 86400000)

  return prisma.$transaction(async (tx) => {
    const created = await tx.tour.create({
      data: {
        hostId,
        slug: tourData.slug,
        title: tourData.title,
        description: tourData.description,
        destination: tourData.destination,
        city: tourData.city || null,
        state: tourData.state || null,
        country: tourData.country || null,
        latitude: tourData.latitude ? parseFloat(tourData.latitude) : null,
        longitude: tourData.longitude ? parseFloat(tourData.longitude) : null,
        startDate,
        endDate,
        registrationDeadline: tourData.registrationDeadline ? new Date(tourData.registrationDeadline) : null,
        duration: parseInt(tourData.duration) || 1,
        maxGroupSize: parseInt(tourData.maxGroupSize) || 15,
        totalSlots,
        availableSlots,
        pricePerPerson: parseFloat(tourData.pricePerPerson) || 0,
        originalPrice: tourData.originalPrice ? parseFloat(tourData.originalPrice) : null,
        difficulty: (tourData.difficulty || "MODERATE") as TourDifficulty,
        riskLevel: (tourData.riskLevel || "LOW") as TourRiskLevel,
        riskDisclosure: tourData.riskDisclosure?.trim() || null,
        meetingPoint: tourData.meetingPoint?.trim() || null,
        eligibilityRequirements: (tourData.eligibilityRequirements ?? []).map((item) => item.trim()).filter(Boolean),
        requiredEquipment: (tourData.requiredEquipment ?? []).map((item) => item.trim()).filter(Boolean),
        emergencyPlan: tourData.emergencyPlan?.trim() || null,
        minimumAge: Number(tourData.minimumAge),
        requiresCaretaker: tourData.requiresCaretaker ?? false,
        category: tourData.category || null,
        tags: (tourData.tags ?? []).filter(Boolean),
        joinApprovalRequired: tourData.joinApprovalRequired ?? false,
        womenOnly: tourData.womenOnly ?? false,
        safeForSoloWomen: tourData.safeForSoloWomen ?? false,
        verifiedTravelersOnly: tourData.verifiedTravelersOnly ?? false,
        images: (tourData.images ?? []),
        highlights: (tourData.highlights ?? []).filter(Boolean),
        included: (tourData.included ?? []).filter(Boolean),
        excluded: (tourData.excluded ?? []).filter(Boolean),
        languages,
        cancellationPolicy: tourData.cancellationPolicy || null,
        status: "PENDING_REVIEW" as ListingStatus,
        isApproved: false,
        submittedForReviewAt: new Date(),
      },
    })

    for (const day of itinerary) {
      await tx.tourItineraryDay.create({
        data: {
          tourId: created.id,
          day: day.day,
          title: day.title || `Day ${day.day}`,
          description: day.description || "",
          activities: (day.activities || []).filter(Boolean),
          meals: (day.meals || []).filter(Boolean),
        },
      })
    }

    return created
  })
}

export async function updateTour(
  id: string,
  tourData: TourInput,
  itinerary: ItineraryDayInput[],
) {
  validateTourListing(tourData)
  const languages = parseLanguages(tourData.languages)
  const totalSlots = parseInt(tourData.totalSlots ?? tourData.maxGroupSize ?? "20") || 20
  const availableSlots = Math.min(parseInt(tourData.availableSlots ?? String(totalSlots)) || totalSlots, totalSlots)
  const startDate = tourData.startDate ? new Date(tourData.startDate) : new Date()
  const endDate = tourData.endDate ? new Date(tourData.endDate) : new Date(startDate.getTime() + ((parseInt(tourData.duration) || 1) - 1) * 86400000)

  return prisma.$transaction(async (tx) => {
    await tx.tour.update({
      where: { id },
      data: {
        slug: tourData.slug,
        title: tourData.title,
        description: tourData.description,
        destination: tourData.destination,
        city: tourData.city || null,
        state: tourData.state || null,
        country: tourData.country || null,
        latitude: tourData.latitude ? parseFloat(tourData.latitude) : null,
        longitude: tourData.longitude ? parseFloat(tourData.longitude) : null,
        startDate,
        endDate,
        registrationDeadline: tourData.registrationDeadline ? new Date(tourData.registrationDeadline) : null,
        duration: parseInt(tourData.duration) || 1,
        maxGroupSize: parseInt(tourData.maxGroupSize) || 15,
        totalSlots,
        availableSlots,
        pricePerPerson: parseFloat(tourData.pricePerPerson) || 0,
        originalPrice: tourData.originalPrice ? parseFloat(tourData.originalPrice) : null,
        difficulty: (tourData.difficulty || "MODERATE") as TourDifficulty,
        riskLevel: (tourData.riskLevel || "LOW") as TourRiskLevel,
        riskDisclosure: tourData.riskDisclosure?.trim() || null,
        meetingPoint: tourData.meetingPoint?.trim() || null,
        eligibilityRequirements: (tourData.eligibilityRequirements ?? []).map((item) => item.trim()).filter(Boolean),
        requiredEquipment: (tourData.requiredEquipment ?? []).map((item) => item.trim()).filter(Boolean),
        emergencyPlan: tourData.emergencyPlan?.trim() || null,
        minimumAge: Number(tourData.minimumAge),
        requiresCaretaker: tourData.requiresCaretaker ?? false,
        category: tourData.category || null,
        tags: (tourData.tags ?? []).filter(Boolean),
        joinApprovalRequired: tourData.joinApprovalRequired ?? false,
        womenOnly: tourData.womenOnly ?? false,
        safeForSoloWomen: tourData.safeForSoloWomen ?? false,
        verifiedTravelersOnly: tourData.verifiedTravelersOnly ?? false,
        images: (tourData.images ?? []),
        highlights: (tourData.highlights ?? []).filter(Boolean),
        included: (tourData.included ?? []).filter(Boolean),
        excluded: (tourData.excluded ?? []).filter(Boolean),
        languages,
        cancellationPolicy: tourData.cancellationPolicy || null,
        status: "PENDING_REVIEW" as ListingStatus,
        isApproved: false,
        approvedAt: null,
        submittedForReviewAt: new Date(),
      },
    })

    await tx.tourItineraryDay.deleteMany({ where: { tourId: id } })
    for (const day of itinerary) {
      await tx.tourItineraryDay.create({
        data: {
          tourId: id,
          day: day.day,
          title: day.title || `Day ${day.day}`,
          description: day.description || "",
          activities: (day.activities || []).filter(Boolean),
          meals: (day.meals || []).filter(Boolean),
        },
      })
    }
  })
}

export async function deleteTour(id: string) {
  return prisma.tour.update({ where: { id }, data: { status: "ARCHIVED", isActive: false, isApproved: false, archivedAt: new Date() } })
}

export async function checkTourJoinEligibility(userId: string, tourId: string) {
  const tour = await prisma.tour.findFirst({
    where: publicTourWhere(tourId),
    select: {
      id: true,
      hostId: true,
      title: true,
      slug: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      availableSlots: true,
      totalSlots: true,
      pricePerPerson: true,
      joinApprovalRequired: true,
      womenOnly: true,
      safeForSoloWomen: true,
      verifiedTravelersOnly: true,
    },
  })

  if (!tour) throw new Error("Tour not found or not available")
  if (tour.availableSlots <= 0) throw new Error("Tour has no available slots")

  const now = new Date()
  if (tour.startDate <= now) throw new Error("Tour has already started")
  if (tour.registrationDeadline && tour.registrationDeadline < now) {
    throw new Error("Registration deadline has passed")
  }

  const [participant, joinRequest, profile] = await Promise.all([
    prisma.tourParticipant.findUnique({
      where: { tourId_userId: { tourId: tour.id, userId } },
      select: { id: true, status: true },
    }),
    prisma.tourJoinRequest.findFirst({
      where: { tourId: tour.id, userId, status: "PENDING" },
      select: { id: true, status: true },
    }),
    getTourTravelerProfile(userId),
  ])

  if (participant && !["REJECTED", "CANCELLED"].includes(participant.status)) {
    throw new Error("You are already part of this tour")
  }
  if (joinRequest) throw new Error("You already have a pending join request")

  if (tour.womenOnly && profile?.gender !== "FEMALE") {
    throw new Error("This tour is only open to women travelers")
  }
  if (tour.verifiedTravelersOnly && !profile) {
    throw new Error("This tour requires a completed traveler profile")
  }

  return { tour, profile }
}

export async function createTourJoinRequest(userId: string, tourId: string, introduction?: string) {
  const { tour } = await checkTourJoinEligibility(userId, tourId)

  if (!tour.joinApprovalRequired) {
    throw new Error("This tour does not require host approval. You can book directly.")
  }

  return prisma.tourJoinRequest.create({
    data: {
      userId,
      tourId: tour.id,
      introduction: introduction?.trim() || null,
      status: "PENDING",
    },
  })
}

export async function approveTourJoinRequest(hostId: string, requestId: string) {
  const request = await prisma.tourJoinRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error("Join request not found")

  const tour = await prisma.tour.findFirst({ where: { id: request.tourId, hostId } })
  if (!tour) throw new Error("Tour not found")

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tourJoinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    })

    await tx.tourParticipant.upsert({
      where: { tourId_userId: { tourId: request.tourId, userId: request.userId } },
      create: {
        tourId: request.tourId,
        userId: request.userId,
        status: "APPROVED",
        isHostApproved: true,
        introMessage: request.introduction,
      },
      update: {
        status: "APPROVED",
        isHostApproved: true,
        introMessage: request.introduction,
      },
    })

    await tx.tourChatRoom.upsert({
      where: { tourId: request.tourId },
      create: { tourId: request.tourId, name: `${tour.title} group` },
      update: {},
    })

    return updated
  })
}

export async function rejectTourJoinRequest(hostId: string, requestId: string) {
  const request = await prisma.tourJoinRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error("Join request not found")

  const tour = await prisma.tour.findFirst({ where: { id: request.tourId, hostId } })
  if (!tour) throw new Error("Tour not found")

  return prisma.tourJoinRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  })
}

export async function createTourBooking(userId: string, tourId: string, input: TourBookingInput) {
  const guestCount = Math.max(1, Math.trunc(input.guestCount ?? 1))
  const { tour } = await checkTourJoinEligibility(userId, tourId)
  if (guestCount > tour.availableSlots) throw new Error("Not enough tour slots available")
  const batchId = input.departureBatchId?.startsWith("tour:") ? null : input.departureBatchId ?? null
  const batchRows = batchId ? await prisma.$queryRaw<{
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
    WHERE "id" = ${batchId} AND "tourId" = ${tour.id}
    LIMIT 1
  ` : []
  const batch = batchRows[0]
  if (batchId && !batch) throw new Error("Selected departure is no longer available")
  if (batch && (batch.status === "SOLD_OUT" || batch.seatsLeft < guestCount)) throw new Error("Selected departure is sold out")

  if (tour.joinApprovalRequired) {
    const approved = await prisma.tourParticipant.findUnique({
      where: { tourId_userId: { tourId: tour.id, userId } },
      select: { status: true, isHostApproved: true },
    })
    if (!approved || !approved.isHostApproved || !["APPROVED", "JOINED"].includes(approved.status)) {
      throw new Error("Host approval is required before booking this tour")
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  })

  const unitPrice = batch
    ? Number(batch.earlyBirdPrice && batch.earlyBirdEndsAt && batch.earlyBirdEndsAt > new Date() ? batch.earlyBirdPrice : batch.basePrice)
    : Number(tour.pricePerPerson)
  const subtotal = toMoney(unitPrice * guestCount)
  const taxes = toMoney(subtotal * TAX_RATE)
  const totalAmount = toMoney(subtotal + taxes)
  const platformFee = toMoney(totalAmount * PLATFORM_FEE_RATE)
  const hostEarnings = toMoney(totalAmount - platformFee)
  const bookingCode = generateBookingCode()

  return prisma.booking.create({
    data: {
      bookingCode,
      userId,
      hostId: tour.hostId,
      tourId: tour.id,
      checkIn: batch?.startDate ?? tour.startDate,
      checkOut: addDays(batch?.endDate ?? tour.endDate, 1),
      totalGuests: guestCount,
      adults: guestCount,
      children: 0,
      infants: 0,
      contactName: input.contactName?.trim() || user?.name || "Traveler",
      contactEmail: input.contactEmail?.trim() || user?.email || "",
      contactPhone: input.contactPhone?.trim() || user?.phone || "",
      specialRequests: input.specialRequests?.trim() || null,
      subtotal: new Prisma.Decimal(subtotal),
      taxes: new Prisma.Decimal(taxes),
      discount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(totalAmount),
      currency: "INR",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      Payment: {
        create: {
          userId,
          hostId: tour.hostId,
          amount: new Prisma.Decimal(totalAmount),
          hostEarnings: new Prisma.Decimal(hostEarnings),
          platformFee: new Prisma.Decimal(platformFee),
          currency: "INR",
          provider: "razorpay",
          status: "PENDING",
        },
      },
      BookingTimeline: {
        create: {
          type: "CREATED",
          title: "Tour booking created",
          message: "Complete payment to confirm your tour slot.",
          metadata: { tourId: tour.id, guestCount, departureBatchId: batchId, unitPrice },
        },
      },
    },
    include: {
      Tour: { select: { id: true, title: true, city: true, destination: true, slug: true } },
      Payment: true,
      BookingTimeline: true,
    },
  })
}

export async function createTourPaymentOrder(userId: string, tourId: string, bookingId: string) {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  if (!razorpayKeyId) throw new Error("Razorpay key id is not configured")

  const bridgeRows = await prisma.$queryRaw<{ legacyBookingId: string | null; status: string; expiresAt: Date | null }[]>`
    SELECT "legacyBookingId", "status", "expiresAt" FROM "TourBooking"
    WHERE "id" = ${bookingId} AND "tourId" = ${tourId} AND "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
  `
  const bridge = bridgeRows[0]
  if (bridge?.status === "WAITLISTED") throw new Error("Waitlisted groups cannot pay until seats are offered")
  if (bridge?.expiresAt && bridge.expiresAt <= new Date()) throw new Error("This booking hold has expired")
  const commerceBookingId = bridge?.legacyBookingId ?? bookingId

  const booking = await prisma.booking.findFirst({
    where: { id: commerceBookingId, userId, tourId, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { Payment: true, Tour: { select: { title: true } } },
  })

  if (!booking || !booking.Payment) throw new Error("Pending tour booking not found")
  if (booking.Payment.providerOrderId && ["PENDING", "PROCESSING"].includes(booking.Payment.status)) {
    return { bookingId, bookingCode: booking.bookingCode, orderId: booking.Payment.providerOrderId, amount: Math.round(Number(booking.totalAmount) * 100), currency: booking.currency, keyId: razorpayKeyId }
  }
  const claimed = await prisma.payment.updateMany({ where: { id: booking.Payment.id, status: "PENDING", providerOrderId: null }, data: { status: "PROCESSING" } })
  if (claimed.count !== 1) throw new Error("Payment order creation is already in progress")

  let order
  try {
    order = await razorpay.orders.create({
      amount: Math.round(Number(booking.totalAmount) * 100), currency: booking.currency, receipt: booking.bookingCode,
      notes: { bookingId: booking.id, tourBookingId: bridge ? bookingId : "", bookingCode: booking.bookingCode, tour: booking.Tour?.title ?? "Tour" },
    })
  } catch (error) {
    await prisma.payment.updateMany({ where: { id: booking.Payment.id, providerOrderId: null, status: "PROCESSING" }, data: { status: "PENDING" } })
    throw error
  }

  await prisma.payment.update({
    where: { bookingId: booking.id },
    data: {
      providerOrderId: order.id,
      status: "PROCESSING",
    },
  })

  return {
    bookingId,
    bookingCode: booking.bookingCode,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: razorpayKeyId,
  }
}

export async function verifyTourPayment(userId: string, tourId: string, input: VerifyTourPaymentInput) {
  const expected = createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET"))
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex")

  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(input.razorpay_signature, "hex")
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) throw new Error("Invalid payment signature")

  const payment = await prisma.payment.findFirst({
    where: { providerOrderId: input.razorpay_order_id, userId, Booking: { tourId } },
    include: { Booking: { include: { Tour: true } } },
  })

  if (!payment?.Booking?.tourId || !payment.Booking.Tour) throw new Error("Tour payment not found")
  return confirmTourBooking(payment.Booking.id, input.razorpay_payment_id)
}

export async function confirmTourBooking(bookingId: string, providerPaymentId?: string) {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { Tour: true, Payment: true, BookingTimeline: true },
    })

    if (!existing?.Tour || !existing.tourId) throw new Error("Tour booking not found")
    if (existing.status === "CONFIRMED") {
      await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'CONFIRMED', "paymentStatus" = 'SUCCESS', "confirmedCount" = "travelersCount", "waitlistedCount" = 0, "confirmedAt" = COALESCE("confirmedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP WHERE "legacyBookingId" = ${existing.id}`
      await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CONFIRMED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" IN (SELECT "id" FROM "TourBooking" WHERE "legacyBookingId" = ${existing.id}) AND "status" <> 'CANCELLED'`
      return existing
    }
    if (existing.status !== "PENDING") throw new Error("Booking cannot be confirmed")
    if (existing.Tour.availableSlots < existing.totalGuests) throw new Error("Not enough tour slots available")

    const slotUpdate = await tx.tour.updateMany({
      where: { id: existing.Tour.id, availableSlots: { gte: existing.totalGuests } },
      data: { availableSlots: { decrement: existing.totalGuests }, totalBookings: { increment: 1 } },
    })
    if (slotUpdate.count !== 1) throw new Error("Not enough tour slots available")

    const bookingMeta = existing.BookingTimeline.find((item) => item.type === "CREATED")?.metadata as { departureBatchId?: string } | null
    if (bookingMeta?.departureBatchId) {
      const batchUpdate = await tx.$executeRaw`
        UPDATE "TourDepartureBatch"
        SET "seatsLeft" = "seatsLeft" - ${existing.totalGuests},
            "status" = CASE WHEN "seatsLeft" - ${existing.totalGuests} <= 0 THEN 'SOLD_OUT' ELSE "status" END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${bookingMeta.departureBatchId}
          AND "tourId" = ${existing.Tour.id}
          AND "seatsLeft" >= ${existing.totalGuests}
          AND "status" <> 'CANCELLED'
      `
      if (Number(batchUpdate) !== 1) throw new Error("Selected departure is sold out")
    }

    await tx.payment.update({
      where: { bookingId: existing.id },
      data: {
        status: "SUCCESS",
        providerPaymentId: providerPaymentId ?? existing.Payment?.providerPaymentId,
        transactionId: providerPaymentId ?? existing.Payment?.transactionId,
        paidAt: new Date(),
      },
    })

    await tx.tourParticipant.upsert({
      where: { tourId_userId: { tourId: existing.Tour.id, userId: existing.userId } },
      create: {
        tourId: existing.Tour.id,
        userId: existing.userId,
        bookingId: existing.id,
        status: "JOINED",
        isHostApproved: true,
      },
      update: {
        bookingId: existing.id,
        status: "JOINED",
        isHostApproved: true,
      },
    })

    await tx.tourChatRoom.upsert({
      where: { tourId: existing.Tour.id },
      create: { tourId: existing.Tour.id, name: `${existing.Tour.title} group` },
      update: {},
    })

    await tx.$executeRaw`UPDATE "TourBooking" SET "status" = 'CONFIRMED', "paymentStatus" = 'SUCCESS', "confirmedCount" = "travelersCount", "waitlistedCount" = 0, "confirmedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "legacyBookingId" = ${existing.id}`
    await tx.$executeRaw`UPDATE "TourTraveler" SET "status" = 'CONFIRMED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tourBookingId" IN (SELECT "id" FROM "TourBooking" WHERE "legacyBookingId" = ${existing.id}) AND "status" <> 'CANCELLED'`

    const confirmedBooking = await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: "CONFIRMED",
        BookingTimeline: {
          create: {
            type: "PAYMENT_CONFIRMED",
            title: "Payment confirmed",
            message: "Tour slot confirmed and group access unlocked.",
          },
        },
      },
      include: {
        Tour: { select: { id: true, title: true, city: true, destination: true, slug: true } },
        Payment: true,
        TourParticipant: true,
      },
    })

    await queueNotification(tx, {
      data: {
        userId: existing.userId,
        type: "BOOKING_CONFIRMED",
        title: "Tour booking confirmed",
        message: `Booking ${existing.bookingCode} is confirmed and group access is unlocked.`,
        data: { bookingId: existing.id, product: "tour" },
      },
    })

    return confirmedBooking
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 20000,
  })

  return booking
}

export async function listTourParticipants(userId: string, tourId: string) {
  const { tour } = await requireTourCircleAccess(userId, tourId, { allowCompletedTour: true })

  return prisma.tourParticipant.findMany({
    where: { tourId: tour.id, status: { in: ["APPROVED", "JOINED", "COMPLETED"] } },
    select: {
      id: true,
      status: true,
      role: true,
      isVerified: true,
      isHostApproved: true,
      User: {
        select: {
          id: true,
          name: true,
          UserProfile: {
            select: {
              avatarUrl: true,
              bio: true,
              gender: true,
              showGender: true,
              languages: true,
              interests: true,
              travelStyle: true,
            },
          },
        },
      },
    },
  })
}

export type TourChatAccessScope = "host-or-participant" | "participant"

export async function getTourChatPreview(userId: string, tourId: string, scope: TourChatAccessScope = "host-or-participant") {
  const { tour } = await getActiveTourChatAccess(userId, tourId, scope)
  const blockedUserIds = [...await blockedUserIdsFor(userId)]

  const room = await prisma.tourChatRoom.findUnique({
    where: { tourId: tour.id },
    include: {
      messages: {
        where: {
          deletedAt: null,
          ...(blockedUserIds.length > 0 ? { senderId: { notIn: blockedUserIds } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { User: { select: { id: true, name: true } } },
      },
    },
  })

  return room ? { ...room, messages: room.messages.reverse() } : { tourId: tour.id, messages: [] }
}

async function getActiveTourChatAccess(userId: string, tourId: string, scope: TourChatAccessScope = "host-or-participant") {
  const access = await requireTourCircleAccess(userId, tourId)
  if (scope === "participant" && access.isHost && !access.participant) {
    throw Object.assign(new Error("A confirmed active booking is required for this Trip Circle"), { statusCode: 403 })
  }
  return { tour: access.tour, participant: access.participant }
}

export async function sendTourChatMessage(userId: string, tourId: string, message: string, scope: TourChatAccessScope = "host-or-participant") {
  const cleanMessage = message.trim()
  if (!cleanMessage) throw new Error("Message is required")
  if (cleanMessage.length > 2000) throw new Error("Message is too long")

  const { tour, participant } = await getActiveTourChatAccess(userId, tourId, scope)

  return prisma.$transaction(async (tx) => {
    const room = await tx.tourChatRoom.upsert({
      where: { tourId: tour.id },
      create: { tourId: tour.id, name: `${tour.title} group` },
      update: {},
    })

    const created = await tx.tourMessage.create({
      data: {
        roomId: room.id,
        senderId: userId,
        participantId: participant?.id ?? null,
        message: cleanMessage,
        messageType: "TEXT",
      },
      include: { User: { select: { id: true, name: true } } },
    })

    await tx.tourChatRoom.update({
      where: { id: room.id },
      data: {
        lastMessage: cleanMessage,
        lastMessageAt: created.createdAt,
      },
    })

    return created
  })
}
