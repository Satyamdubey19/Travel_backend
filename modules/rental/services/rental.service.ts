import { prisma } from "@/lib/prisma"
import type { VehicleType, ListingStatus, TransmissionType, FuelType } from "@prisma/client"
import type { Rental } from "@/lib/rentals"


export type RentalInput = {
  slug: string
  title: string
  vehicleType?: string
  brand: string
  model?: string
  year?: string
  city: string
  state?: string
  country?: string
  pickupArea?: string
  totalUnits?: string
  availableUnits?: string
  images?: string[]
  pricePerDay: string
  originalPrice?: string
  cancellationPolicy?: string
  status?: string
}

export type RentalDetailsInput = {
  transmission?: string
  fuelType?: string
  seats?: string
  engine?: string
  rangeKm?: string
  deposit?: string
  features?: string[]
  documentsRequired?: string[]
}


export async function listRentals(hostId: string) {
  return prisma.rental.findMany({
    where: { hostId },
    include: {
      RentalDetails: true,
      _count: { select: { RentalBooking: true, Review: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getRentalById(id: string, hostId: string) {
  return prisma.rental.findFirst({
    where: { id, hostId },
    include: { RentalDetails: true },
  })
}

export async function listPublicRentals() {
  const rentals = await prisma.rental.findMany({
    where: { status: "ACTIVE", isActive: true },
    include: {
      Host: true,
      RentalDetails: true,
      _count: { select: { RentalBooking: true, Review: true } },
    },
    orderBy: [{ totalBookings: "desc" }, { averageRating: "desc" }],
  })

  return rentals.map(normalizeRentalForPublic)
}

export async function getPublicRentalBySlug(slug: string) {
  const rental = await prisma.rental.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
      status: "ACTIVE",
      isActive: true,
    },
    include: {
      Host: true,
      RentalDetails: true,
      _count: { select: { RentalBooking: true, Review: true } },
    },
  })

  return rental ? normalizeRentalForPublic(rental) : null
}

export type RentalWithRelations = any

export function normalizeRentalForForm(rental: RentalWithRelations) {
  return {
    ...rental,
    pricePerDay: String(rental.pricePerDay),
    originalPrice: rental.originalPrice != null ? String(rental.originalPrice) : "",
    year: rental.year != null ? String(rental.year) : "",
    totalUnits: String(rental.totalUnits),
    availableUnits: String(rental.availableUnits),
    transmission: rental.RentalDetails?.transmission ?? "MANUAL",
    fuelType: rental.RentalDetails?.fuelType ?? "PETROL",
    seats: rental.RentalDetails?.seats != null ? String(rental.RentalDetails.seats) : "5",
    engine: rental.RentalDetails?.engine ?? "",
    rangeKm: rental.RentalDetails?.rangeKm != null ? String(rental.RentalDetails.rangeKm) : "0",
    deposit: rental.RentalDetails?.deposit != null ? String(rental.RentalDetails.deposit) : "0",
    features: rental.RentalDetails?.features ?? [],
    documentsRequired: rental.RentalDetails?.documentsRequired ?? [],
  }
}

type PublicRentalRecord = {
  slug: string
  vehicleType: string
  title: string
  brand: string
  city: string
  pickupArea: string | null
  images: string[]
  imageUrl: string | null
  pricePerDay: { toString(): string } | number
  originalPrice: { toString(): string } | number | null
  averageRating: number
  totalReviews: number
  availableUnits: number
  totalUnits: number
  cancellationPolicy: string | null
  Host?: { businessName: string | null; isVerified: boolean }
  RentalDetails?: {
    transmission: TransmissionType | null
    fuelType: FuelType | null
    seats: number | null
    engine: string | null
    rangeKm: number
    deposit: { toString(): string } | number
    features: string[]
    documentsRequired: string[]
  } | null
  _count?: { RentalBooking: number; Review: number }
}

export function normalizeRentalForPublic(rental: PublicRentalRecord): Rental {
  const details = rental.RentalDetails
  const images = rental.images.length > 0 ? rental.images : [rental.imageUrl || "/car-rental.jpg"]
  const vehicleType = rental.vehicleType === "CAR" || rental.vehicleType === "SUV" ? "car" : "bike"
  const fuel = details?.fuelType ? titleCase(details.fuelType) : undefined
  const transmission = details?.transmission ? titleCase(details.transmission) : undefined

  return {
    slug: rental.slug,
    type: vehicleType,
    title: rental.title,
    brand: rental.brand,
    city: rental.city,
    pickupArea: rental.pickupArea || `${rental.city} pickup hub`,
    image: images[0],
    pricePerDay: Number(rental.pricePerDay),
    originalPrice: rental.originalPrice != null ? Number(rental.originalPrice) : Number(rental.pricePerDay),
    rating: rental.averageRating,
    reviews: rental.totalReviews || rental._count?.Review || 0,
    seats: details?.seats ?? undefined,
    transmission: transmission as Rental["transmission"],
    fuel: fuel as Rental["fuel"],
    engine: details?.engine ?? undefined,
    rangeKm: details?.rangeKm ?? 0,
    availableUnits: rental.availableUnits,
    totalUnits: rental.totalUnits,
    deposit: details?.deposit != null ? Number(details.deposit) : 0,
    cancellation: rental.cancellationPolicy || "Free cancellation before pickup day",
    features: details?.features ?? [],
    documents: details?.documentsRequired ?? [],
    vendor: {
      name: rental.Host?.businessName || "GetHotels rental partner",
      responseTime: "Usually replies in 10 min",
      verified: rental.Host?.isVerified ?? false,
    },
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

  
export async function createRental(
  hostId: string,
  rentalData: RentalInput,
  details: RentalDetailsInput,
) {
  const totalUnits = parseInt(rentalData.totalUnits ?? "1") || 1
  const availableUnits = Math.min(parseInt(rentalData.availableUnits ?? String(totalUnits)) || totalUnits, totalUnits)

  return prisma.$transaction(async (tx) => {
    const created = await tx.rental.create({
      data: {
        hostId,
        slug: rentalData.slug,
        title: rentalData.title,
        vehicleType: (rentalData.vehicleType || "CAR") as VehicleType,
        brand: rentalData.brand,
        model: rentalData.model || null,
        year: rentalData.year ? parseInt(rentalData.year) : null,
        city: rentalData.city,
        state: rentalData.state || null,
        country: rentalData.country || "India",
        pickupArea: rentalData.pickupArea || null,
        totalUnits,
        availableUnits,
        imageUrl: (rentalData.images ?? [])[0] || null,
        images: rentalData.images ?? [],
        pricePerDay: parseFloat(rentalData.pricePerDay) || 0,
        originalPrice: rentalData.originalPrice ? parseFloat(rentalData.originalPrice) : null,
        cancellationPolicy: rentalData.cancellationPolicy || null,
        status: (rentalData.status || "PENDING_REVIEW") as ListingStatus,
      },
    })

    await tx.rentalDetails.create({
      data: {
        rentalId: created.id,
        transmission: (details.transmission || null) as TransmissionType | null,
        fuelType: (details.fuelType || null) as FuelType | null,
        seats: details.seats ? parseInt(details.seats) : null,
        engine: details.engine || null,
        rangeKm: details.rangeKm ? parseInt(details.rangeKm) : 0,
        deposit: details.deposit ? parseFloat(details.deposit) : 0,
        features: (details.features ?? []).filter(Boolean),
        documentsRequired: (details.documentsRequired ?? []).filter(Boolean),
      },
    })

    return created
  })
}

export async function updateRental(
  id: string,
  rentalData: RentalInput,
  details: RentalDetailsInput,
) {
  const totalUnits = parseInt(rentalData.totalUnits ?? "1") || 1
  const availableUnits = Math.min(parseInt(rentalData.availableUnits ?? String(totalUnits)) || totalUnits, totalUnits)

  return prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id },
      data: {
        slug: rentalData.slug,
        title: rentalData.title,
        vehicleType: (rentalData.vehicleType || "CAR") as unknown as VehicleType,
        brand: rentalData.brand,
        model: rentalData.model || null,
        year: rentalData.year ? parseInt(rentalData.year) : null,
        city: rentalData.city,
        state: rentalData.state || null,
        country: rentalData.country || "India",
        pickupArea: rentalData.pickupArea || null,
        totalUnits,
        availableUnits,
        imageUrl: (rentalData.images ?? [])[0] || null,
        images: rentalData.images ?? [],
        pricePerDay: parseFloat(rentalData.pricePerDay) || 0,
        originalPrice: rentalData.originalPrice ? parseFloat(rentalData.originalPrice) : null,
        cancellationPolicy: rentalData.cancellationPolicy || null,
        status: (rentalData.status || "PENDING_REVIEW") as unknown as ListingStatus,
      },
    })

    await tx.rentalDetails.upsert({
      where: { rentalId: id },
      create: {
        rentalId: id,
        transmission: (details.transmission || null) as TransmissionType | null,
        fuelType: (details.fuelType || null) as FuelType | null,
        seats: details.seats ? parseInt(details.seats) : null,
        engine: details.engine || null,
        rangeKm: details.rangeKm ? parseInt(details.rangeKm) : 0,
        deposit: details.deposit ? parseFloat(details.deposit) : 0,
        features: (details.features ?? []).filter(Boolean),
        documentsRequired: (details.documentsRequired ?? []).filter(Boolean),
      },
      update: {
        transmission: (details.transmission || null) as TransmissionType | null,
        fuelType: (details.fuelType || null) as FuelType | null,
        seats: details.seats ? parseInt(details.seats) : null,
        engine: details.engine || null,
        rangeKm: details.rangeKm ? parseInt(details.rangeKm) : 0,
        deposit: details.deposit ? parseFloat(details.deposit) : 0,
        features: (details.features ?? []).filter(Boolean),
        documentsRequired: (details.documentsRequired ?? []).filter(Boolean),
      },
    })
  })
}

export async function deleteRental(id: string) {
  return prisma.rental.delete({ where: { id } })
}
