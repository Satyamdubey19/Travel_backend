import { prisma } from "@/lib/prisma"
import type { ActivityCategory, ActivityDifficulty, ListingStatus } from "@prisma/client"
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
  const activities = await prisma.activity.findMany({
    where: { status: "ACTIVE", isActive: true },
    include: {
      Host: true,
      ActivitySlot: {
        where: { isActive: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      _count: { select: { ActivityBooking: true, Review: true } },
    },
    orderBy: [{ totalBookings: "desc" }, { averageRating: "desc" }],
  })

  return activities.map(normalizeActivityForPublic)
}

export async function getPublicActivityBySlug(slug: string) {
  const activity = await prisma.activity.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      status: "ACTIVE",
      isActive: true,
    },
    include: {
      Host: true,
      ActivitySlot: {
        where: { isActive: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      _count: { select: { ActivityBooking: true, Review: true } },
    },
  })

  return activity ? normalizeActivityForPublic(activity) : null
}

export type ActivityRecord = any

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
  Host?: { businessName: string | null; isVerified: boolean }
  ActivitySlot?: { startTime: string }[]
  _count?: { ActivityBooking: number; Review: number }
}

export function normalizeActivityForPublic(activity: PublicActivityRecord): Activity {
  const images = activity.images.length > 0 ? activity.images : [activity.imageUrl || "/tour1.jpg"]
  const category = activity.category.toLowerCase() as Activity["category"]
  const difficulty = titleCase(activity.difficulty) as Activity["difficulty"]
  const startTimes = Array.from(new Set((activity.ActivitySlot ?? []).map((slot) => slot.startTime)))

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
    groupSize: `${Math.max(0, activity.availableSlots)} of ${activity.totalSlots} slots available`,
    startTimes: startTimes.length > 0 ? startTimes : ["9:00 AM"],
    language: activity.language,
    difficulty,
    highlights: activity.highlights,
    included: activity.included,
    itinerary: activity.highlights.length > 0 ? activity.highlights : ["Meet host", "Activity briefing", "Experience starts"],
    host: {
      name: activity.Host?.businessName || "GetHotels activity host",
      verified: activity.Host?.isVerified ?? false,
      responseTime: "Replies in 10 min",
    },
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export async function createActivity(hostId: string, data: ActivityInput) {
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
      status: (data.status || "PENDING_REVIEW") as ListingStatus,
    },
  })
}

export async function updateActivity(id: string, data: ActivityInput) {
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
      status: (data.status || "PENDING_REVIEW") as ListingStatus,
    },
  })
}

export async function deleteActivity(id: string) {
  return prisma.activity.delete({ where: { id } })
}
