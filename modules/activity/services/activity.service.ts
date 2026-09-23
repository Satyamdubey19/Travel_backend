import { prisma } from "@/lib/prisma"
import type { ActivityCategory, ActivityDifficulty, ListingStatus, Activity as PrismaActivity } from "@prisma/client"
import type { Activity } from "@/lib/activities"

// ─── Input Types ───────────────────────────────────────────────────────────────

export type ActivityInput = {
  slug: string
  title: string
  description?: string
  city: string
  state?: string
  country?: string
  area?: string
  category?: string
  difficulty?: string
  price: string
  originalPrice?: string
  duration: string
  groupSizeMin?: string
  groupSizeMax?: string
  totalSlots?: string
  availableSlots?: string
  language?: string
  images?: string[]
  highlights?: string[]
  included?: string[]
  excluded?: string[]
  meetingPoint?: string
  meetingLat?: string
  meetingLng?: string
  cancellationPolicy?: string
  status?: string
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function listActivities(hostId: string) {
  return prisma.activity.findMany({
    where: { hostId },
    include: {
      _count: { select: { ActivityBooking: true, Review: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getActivityById(id: string, hostId: string) {
  return prisma.activity.findFirst({ where: { id, hostId } })
}

export async function listPublicActivities() {
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const activities = await prisma.activity.findMany({
    where: { status: "ACTIVE", isActive: true, isApproved: true, Host: { is: { isActive: true, isApproved: true, isVerified: true } }, ActivitySlot: { some: { isActive: true, date: { gte: tomorrow } } } },
    include: {
      Host: true,
      ActivitySlot: {
        where: { isActive: true, date: { gte: tomorrow } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      _count: { select: { ActivityBooking: true, Review: true } },
    },
    orderBy: [{ totalBookings: "desc" }, { averageRating: "desc" }],
  })

  return activities.map(normalizeActivityForPublic)
}

export async function getPublicActivityBySlug(slug: string) {
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const activity = await prisma.activity.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      status: "ACTIVE",
      isActive: true,
      isApproved: true,
      Host: { is: { isActive: true, isApproved: true, isVerified: true } },
      ActivitySlot: { some: { isActive: true, date: { gte: tomorrow } } },
    },
    include: {
      Host: true,
      ActivitySlot: {
        where: { isActive: true, date: { gte: tomorrow } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      _count: { select: { ActivityBooking: true, Review: true } },
    },
  })

  return activity ? normalizeActivityForPublic(activity) : null
}

export type ActivityRecord = PrismaActivity & {
  Host?: { businessName: string | null; isVerified: boolean } | null
  ActivitySlot?: Array<{ startTime: string }>
  _count?: { Review: number; ActivityBooking?: number }
}

export function normalizeActivityForForm(activity: ActivityRecord) {
  return {
    ...activity,
    price: String(activity.price),
    originalPrice: activity.originalPrice != null ? String(activity.originalPrice) : "",
    groupSizeMin: String(activity.groupSizeMin),
    groupSizeMax: String(activity.groupSizeMax),
    totalSlots: String(activity.totalSlots),
    availableSlots: String(activity.availableSlots),
    meetingLat: activity.meetingLat != null ? String(activity.meetingLat) : "",
    meetingLng: activity.meetingLng != null ? String(activity.meetingLng) : "",
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

type PublicActivityRecord = {
  slug: string
  title: string
  category: string
  city: string
  area: string | null
  meetingPoint: string | null
  images: string[]
  imageUrl: string | null
  price: { toString(): string } | number
  originalPrice: { toString(): string } | number | null
  duration: string
  averageRating: number
  totalReviews: number
  availableSlots: number
  totalSlots: number
  language: string
  difficulty: string
  highlights: string[]
  included: string[]
  cancellationPolicy: string | null
  Host?: { businessName: string | null; isVerified: boolean }
  ActivitySlot?: { id: string; date: Date; startTime: string; totalSpots: number; bookedSpots: number }[]
  _count?: { ActivityBooking: number; Review: number }
}

export function normalizeActivityForPublic(activity: PublicActivityRecord): Activity {
  const images = activity.images.length > 0 ? activity.images : [activity.imageUrl || "/tour1.jpg"]
  const category = activity.category.toLowerCase() as Activity["category"]
  const difficulty = titleCase(activity.difficulty) as Activity["difficulty"]
  const startTimes = Array.from(new Set((activity.ActivitySlot ?? []).map((slot) => slot.startTime)))
  const totalFutureSpots = (activity.ActivitySlot ?? []).reduce((sum, slot) => sum + slot.totalSpots, 0)
  const availableFutureSpots = (activity.ActivitySlot ?? []).reduce((sum, slot) => sum + Math.max(slot.totalSpots - slot.bookedSpots, 0), 0)

  return {
    slug: activity.slug,
    title: activity.title,
    category,
    city: activity.city,
    area: activity.area || activity.meetingPoint || activity.city,
    image: images[0],
    price: Number(activity.price),
    originalPrice: activity.originalPrice != null ? Number(activity.originalPrice) : Number(activity.price),
    duration: activity.duration,
    rating: activity.averageRating,
    reviews: activity.totalReviews || activity._count?.Review || 0,
    groupSize: totalFutureSpots > 0 ? `${availableFutureSpots} of ${totalFutureSpots} future spots available` : "No future slots",
    startTimes,
    slots: (activity.ActivitySlot ?? []).map((slot) => ({
      id: slot.id,
      date: slot.date.toISOString(),
      startTime: slot.startTime,
      spotsLeft: Math.max(slot.totalSpots - slot.bookedSpots, 0),
    })),
    language: activity.language,
    difficulty,
    highlights: activity.highlights,
    included: activity.included,
    itinerary: activity.highlights,
    cancellationPolicy: activity.cancellationPolicy,
    host: {
      name: activity.Host?.businessName || "GetHotels activity host",
      verified: activity.Host?.isVerified ?? false,
      responseTime: "Response time not measured",
    },
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export async function createActivity(hostId: string, data: ActivityInput) {
  validateActivityListing(data)
  const totalSlots = parseInt(data.totalSlots ?? data.groupSizeMax ?? "20") || 20
  const availableSlots = Math.min(parseInt(data.availableSlots ?? String(totalSlots)) || totalSlots, totalSlots)

  return prisma.activity.create({
    data: {
      hostId,
      slug: data.slug,
      title: data.title,
      description: data.description || null,
      city: data.city,
      state: data.state || null,
      country: data.country || "India",
      area: data.area || null,
      category: (data.category || "ADVENTURE") as ActivityCategory,
      difficulty: (data.difficulty || "EASY") as ActivityDifficulty,
      price: parseFloat(data.price) || 0,
      originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
      duration: data.duration,
      groupSizeMin: parseInt(data.groupSizeMin ?? "1") || 1,
      groupSizeMax: parseInt(data.groupSizeMax ?? "20") || 20,
      totalSlots,
      availableSlots,
      language: data.language || "English",
      imageUrl: (data.images ?? [])[0] || null,
      images: data.images ?? [],
      highlights: (data.highlights ?? []).filter(Boolean),
      included: (data.included ?? []).filter(Boolean),
      excluded: (data.excluded ?? []).filter(Boolean),
      meetingPoint: data.meetingPoint || null,
      meetingLat: data.meetingLat ? parseFloat(data.meetingLat) : null,
      meetingLng: data.meetingLng ? parseFloat(data.meetingLng) : null,
      cancellationPolicy: data.cancellationPolicy || null,
      status: "PENDING_REVIEW" as ListingStatus,
      isApproved: false,
      submittedForReviewAt: new Date(),
    },
  })
}

export async function updateActivity(id: string, data: ActivityInput) {
  validateActivityListing(data)
  const totalSlots = parseInt(data.totalSlots ?? data.groupSizeMax ?? "20") || 20
  const availableSlots = Math.min(parseInt(data.availableSlots ?? String(totalSlots)) || totalSlots, totalSlots)

  return prisma.activity.update({
    where: { id },
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description || null,
      city: data.city,
      state: data.state || null,
      country: data.country || "India",
      area: data.area || null,
      category: (data.category || "ADVENTURE") as ActivityCategory,
      difficulty: (data.difficulty || "EASY") as ActivityDifficulty,
      price: parseFloat(data.price) || 0,
      originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : null,
      duration: data.duration,
      groupSizeMin: parseInt(data.groupSizeMin ?? "1") || 1,
      groupSizeMax: parseInt(data.groupSizeMax ?? "20") || 20,
      totalSlots,
      availableSlots,
      language: data.language || "English",
      imageUrl: (data.images ?? [])[0] || null,
      images: data.images ?? [],
      highlights: (data.highlights ?? []).filter(Boolean),
      included: (data.included ?? []).filter(Boolean),
      excluded: (data.excluded ?? []).filter(Boolean),
      meetingPoint: data.meetingPoint || null,
      meetingLat: data.meetingLat ? parseFloat(data.meetingLat) : null,
      meetingLng: data.meetingLng ? parseFloat(data.meetingLng) : null,
      cancellationPolicy: data.cancellationPolicy || null,
      status: "PENDING_REVIEW" as ListingStatus,
      isApproved: false,
      approvedAt: null,
      submittedForReviewAt: new Date(),
    },
  })
}

export async function deleteActivity(id: string) {
  return prisma.activity.update({ where: { id }, data: { status: "ARCHIVED", isActive: false, isApproved: false, archivedAt: new Date() } })
}

function validateActivityListing(data: ActivityInput) {
  const invalid = (message: string) => { throw Object.assign(new Error(message), { statusCode: 400 }) }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug?.trim() || "")) invalid("Activity slug must use lowercase words separated by hyphens")
  if ((data.title?.trim().length || 0) < 5) invalid("Activity title must be at least 5 characters")
  if ((data.description?.trim().length || 0) < 40) invalid("Activity description must be at least 40 characters")
  if ((data.city?.trim().length || 0) < 2) invalid("Activity city is required")
  if (!["ADVENTURE", "WELLNESS", "HERITAGE", "WATER", "FOOD", "CULTURE", "NATURE", "SPORTS"].includes(data.category || "ADVENTURE")) invalid("Activity category is invalid")
  if (!["EASY", "MODERATE", "HIGH"].includes(data.difficulty || "EASY")) invalid("Activity difficulty is invalid")
  if (!Number.isFinite(Number(data.price)) || Number(data.price) <= 0) invalid("Activity price must be greater than zero")
  const minimum = Number(data.groupSizeMin ?? 1)
  const maximum = Number(data.groupSizeMax ?? 20)
  const total = Number(data.totalSlots ?? maximum)
  const available = Number(data.availableSlots ?? total)
  if (!Number.isInteger(minimum) || minimum < 1 || !Number.isInteger(maximum) || maximum < minimum || maximum > 100) invalid("Activity group size is invalid")
  if (!Number.isInteger(total) || total < 1 || total > maximum || !Number.isInteger(available) || available < 0 || available > total) invalid("Activity capacity is invalid")
  if (!data.images?.some((image) => image.trim())) invalid("At least one activity image is required")
  if ((data.cancellationPolicy?.trim().length || 0) < 20) invalid("A clear cancellation policy of at least 20 characters is required")
}
