import { createHmac } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { razorpay } from "@/lib/razorpay"
import { sendBookingConfirmationEmail } from "@/lib/mail"
import type { ListingStatus, TourDifficulty } from "@prisma/client"
import { tours as demoTours, type Tour } from "@/lib/tours"

const TAX_RATE = 0.12
const PLATFORM_FEE_RATE = 0.1

function generateBookingCode() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
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

function makeFutureDate(daysAhead: number) {
  return addDays(new Date(), daysAhead)
}

function parseGroupBounds(value: string) {
  const matches = value.match(/\d+/g)?.map(Number) ?? []
  const lower = matches[0] ?? 2
  const upper = matches[matches.length - 1] ?? lower
  return { lower, upper }
}

function mapDemoTourToInput(demoTour: Tour) {
  const { lower, upper } = parseGroupBounds(demoTour.groupSize)
  const startDate = makeFutureDate(14)
  const endDate = addDays(startDate, Math.max(1, demoTour.duration - 1))

  return {
    tourData: {
      slug: demoTour.slug,
      title: demoTour.title,
      description: demoTour.description,
      destination: demoTour.destination,
      city: demoTour.location.city,
      country: demoTour.location.country,
      latitude: String(demoTour.location.lat),
      longitude: String(demoTour.location.lng),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      registrationDeadline: addDays(startDate, -7).toISOString(),
      duration: String(demoTour.duration),
      maxGroupSize: String(upper),
      totalSlots: String(upper),
      availableSlots: String(lower),
      pricePerPerson: String(demoTour.price),
      originalPrice: String(Math.round(demoTour.price * 1.18)),
      difficulty: "MODERATE",
      category: demoTour.category,
      tags: demoTour.tags,
      joinApprovalRequired: Boolean(demoTour.joinApprovalRequired),
      womenOnly: Boolean(demoTour.womenOnly),
      safeForSoloWomen: Boolean(demoTour.safeForSoloWomen),
      verifiedTravelersOnly: Boolean(demoTour.verifiedTravelersOnly),
      images: demoTour.gallery.length > 0 ? demoTour.gallery : [demoTour.image],
      highlights: demoTour.highlights,
      included: demoTour.budget.inclusions,
      excluded: demoTour.budget.exclusions,
      languages: ["English", "Hindi"],
      cancellationPolicy: "Free cancellation up to 7 days before departure.",
      status: "ACTIVE",
    },
    itinerary: demoTour.itinerary.map((day) => ({
      day: day.day,
      title: day.title,
      description: day.description,
      activities: day.activities,
      meals: day.meals,
    })),
  }
}

async function ensureDemoTourRecord(tourKey: string) {
  const existing = await prisma.tour.findFirst({ where: { OR: [{ id: tourKey }, { slug: tourKey }], deletedAt: null } })
  if (existing) return existing

  const demoTour = demoTours.find((item) => item.slug === tourKey || item.id === tourKey)
  if (!demoTour) return null

  const host = await prisma.host.findFirst({ orderBy: { createdAt: "asc" } })
  if (!host) {
    const fallbackUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
    if (!fallbackUser) throw new Error("No host or user exists to attach the demo tour")

    const createdHost = await prisma.host.upsert({
      where: { userId: fallbackUser.id },
      update: {},
      create: {
        userId: fallbackUser.id,
        businessName: "GetHotels Experiences",
        hostType: "TOUR_OPERATOR",
        businessType: "INDIVIDUAL",
        isActive: true,
        isApproved: true,
        isVerified: true,
      },
    })

    const { tourData, itinerary } = mapDemoTourToInput(demoTour)
    return createTour(createdHost.id, tourData, itinerary)
  }

  const { tourData, itinerary } = mapDemoTourToInput(demoTour)
  return createTour(host.id, tourData, itinerary)
}

function publicTourWhere(id: string) {
  return {
    OR: [{ id }, { slug: id }],
    deletedAt: null,
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
    where: { status: "ACTIVE", isActive: true, isApproved: true },
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
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error
    console.warn("GET /api/tour: using fallback tours after database connection drop")
    return demoTours
  }
}

export async function getPublicTourBySlug(slug: string) {
  await ensureDemoTourRecord(slug)
  const tour = await prisma.tour.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      deletedAt: null,
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
    includedHotels: [],
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
        status: (tourData.status || "PENDING_REVIEW") as ListingStatus,
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
        status: (tourData.status || "PENDING_REVIEW") as ListingStatus,
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
  return prisma.tour.delete({ where: { id } })
}

export async function checkTourJoinEligibility(userId: string, tourId: string) {
  const ensured = await ensureDemoTourRecord(tourId)
  const tour = ensured ?? await prisma.tour.findFirst({
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

export async function createTourPaymentOrder(userId: string, bookingId: string) {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  if (!razorpayKeyId) throw new Error("Razorpay key id is not configured")

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, tourId: { not: null }, status: "PENDING" },
    include: { Payment: true, Tour: { select: { title: true } } },
  })

  if (!booking || !booking.Payment) throw new Error("Pending tour booking not found")

  const order = await razorpay.orders.create({
    amount: Math.round(Number(booking.totalAmount) * 100),
    currency: booking.currency,
    receipt: booking.bookingCode,
    notes: {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      tour: booking.Tour?.title ?? "Tour",
    },
  })

  await prisma.payment.update({
    where: { bookingId: booking.id },
    data: {
      providerOrderId: order.id,
      status: "PROCESSING",
    },
  })

  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: razorpayKeyId,
  }
}

export async function verifyTourPayment(userId: string, input: VerifyTourPaymentInput) {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex")

  if (expected !== input.razorpay_signature) throw new Error("Invalid payment signature")

  const payment = await prisma.payment.findFirst({
    where: { providerOrderId: input.razorpay_order_id, userId },
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
    if (existing.status === "CONFIRMED") return existing
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

    return tx.booking.update({
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
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 20000,
  })

  await sendBookingConfirmationEmail({
    to: booking.contactEmail,
    guestName: booking.contactName,
    bookingCode: booking.bookingCode,
    hotelName: booking.Tour?.title ?? "GetHotels tour",
    city: booking.Tour?.city ?? booking.Tour?.destination,
    checkIn: booking.checkIn ?? new Date(),
    checkOut: booking.checkOut ?? booking.checkIn ?? new Date(),
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    rooms: [{
      roomName: "Tour seat",
      quantity: booking.totalGuests,
      nights: 1,
      pricePerNight: booking.subtotal,
      total: booking.totalAmount,
    }],
    bookingUrl: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/profile`,
  }).catch((error) => {
    console.error("Failed to send tour confirmation email:", error)
  })

  return booking
}

export async function listTourParticipants(userId: string, tourId: string) {
  await ensureDemoTourRecord(tourId)
  const tour = await prisma.tour.findFirst({ where: { OR: [{ id: tourId }, { slug: tourId }] }, select: { id: true, hostId: true } })
  if (!tour) throw new Error("Tour not found")

  const access = await prisma.tourParticipant.findUnique({
    where: { tourId_userId: { tourId: tour.id, userId } },
    select: { id: true },
  })
  if (!access) throw new Error("Join the tour to view participants")

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
  await ensureDemoTourRecord(tourId)
  const { tour } = await getActiveTourChatAccess(userId, tourId, scope)

  const room = await prisma.tourChatRoom.findUnique({
    where: { tourId: tour.id },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { User: { select: { id: true, name: true } } },
      },
    },
  })

  return room ? { ...room, messages: room.messages.reverse() } : { tourId: tour.id, messages: [] }
}

async function getActiveTourChatAccess(userId: string, tourId: string, scope: TourChatAccessScope = "host-or-participant") {
  const tour = await prisma.tour.findFirst({
    where: { OR: [{ id: tourId }, { slug: tourId }] },
    select: { id: true, hostId: true, title: true, tourStatus: true },
  })
  if (!tour) throw new Error("Tour not found")
  if (["COMPLETED", "CANCELLED"].includes(tour.tourStatus)) {
    throw new Error("Tour chat is closed because this tour is no longer active")
  }

  const [participant, host] = await Promise.all([
    prisma.tourParticipant.findUnique({
      where: { tourId_userId: { tourId: tour.id, userId } },
      select: { id: true, status: true },
    }),
    prisma.host.findFirst({
      where: { id: tour.hostId, userId },
      select: { id: true },
    }),
  ])

  const canChatAsParticipant = participant?.status === "JOINED"
  const canChatAsHost = scope === "host-or-participant" && Boolean(host)
  if (!canChatAsHost && !canChatAsParticipant) {
    throw new Error("Join the tour to unlock group chat")
  }

  return { tour, participant }
}

export async function sendTourChatMessage(userId: string, tourId: string, message: string, scope: TourChatAccessScope = "host-or-participant") {
  await ensureDemoTourRecord(tourId)
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
