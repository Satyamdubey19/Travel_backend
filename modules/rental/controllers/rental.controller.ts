import { NextRequest, NextResponse } from "next/server"
import { requireHost } from "@/utils/host-auth"
import {
  listRentals,
  listPublicRentals,
  getRentalById,
  getPublicRentalBySlug,
  normalizeRentalForForm,
  createRental,
  updateRental,
  deleteRental,
} from "@/modules/rental/services/rental.service"
import type { RentalDetailsInput, RentalInput } from "@/modules/rental/services/rental.service"
import { z } from "zod"

const rentalListingSchema = z.object({
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(5).max(160),
  vehicleType: z.enum(["CAR", "BIKE", "SCOOTER", "SUV"]),
  brand: z.string().trim().min(2).max(80),
  model: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1).transform(String).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  pickupArea: z.string().trim().min(3).max(180),
  totalUnits: z.coerce.number().int().min(1).max(100).transform(String),
  availableUnits: z.coerce.number().int().min(0).max(100).transform(String),
  images: z.array(z.string().trim().min(1).max(1000)).min(1).max(12),
  pricePerDay: z.coerce.number().positive().max(1_000_000).transform(String),
  originalPrice: z.coerce.number().positive().max(1_000_000).transform(String).optional(),
  cancellationPolicy: z.string().trim().min(20).max(2000),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]).optional(),
  fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "CNG", "HYBRID"]).optional(),
  seats: z.coerce.number().int().min(1).max(20).transform(String).optional(),
  engine: z.string().trim().max(80).optional(),
  rangeKm: z.coerce.number().int().min(0).max(5000).transform(String).optional(),
  deposit: z.coerce.number().min(0).max(1_000_000).transform(String).optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  documentsRequired: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
}).superRefine((value, context) => {
  if (Number(value.availableUnits) > Number(value.totalUnits)) context.addIssue({ code: "custom", path: ["availableUnits"], message: "Available units cannot exceed total units" })
})

async function getCurrentHost() {
  try { return { host: (await requireHost()).host } }
  catch (error) { return { error: NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 401 }) } }
}

function splitRentalBody(body: Record<string, unknown>) {
  const {
    transmission, fuelType, seats, engine, rangeKm, deposit,
    features, documentsRequired,
    ...rentalData
  } = body

  return {
    rentalData: rentalData as RentalInput,
    details: { transmission, fuelType, seats, engine, rangeKm, deposit, features, documentsRequired } as RentalDetailsInput,
  }
}

export const getRentals = async (req: NextRequest) => {
  try {
    const scope = new URL(req.url).searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const rentals = await listRentals(host.id)
      return NextResponse.json({ data: rentals })
    }

    const rentals = await listPublicRentals()
    return NextResponse.json({ data: rentals })
  } catch (error) {
    console.error("GET /api/rental:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getRental = async (req: NextRequest, id: string) => {
  try {
    const scope = new URL(req.url).searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const rental = await getRentalById(id, host.id)
      if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 })

      return NextResponse.json({ data: normalizeRentalForForm(rental) })
    }

    const rental = await getPublicRentalBySlug(id)
    if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 })

    return NextResponse.json({ data: rental })
  } catch (error) {
    console.error("GET /api/rental/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const createRentalController = async (req: NextRequest) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const { rentalData, details } = splitRentalBody(rentalListingSchema.parse(await req.json()))
    const rental = await createRental(host.id, rentalData, details)
    return NextResponse.json({ data: rental }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/rental:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid rental details" }, { status: 400 })
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "A rental with this slug already exists." }, { status: 409 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const updateRentalController = async (req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getRentalById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Rental not found" }, { status: 404 })

    const { rentalData, details } = splitRentalBody(rentalListingSchema.parse(await req.json()))
    await updateRental(id, rentalData, details)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("PUT /api/rental/[id]:", error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid rental details" }, { status: 400 })
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "A rental with this slug already exists." }, { status: 409 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const deleteRentalController = async (_req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getRentalById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Rental not found" }, { status: 404 })

    await deleteRental(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/rental/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getRentalsController = getRentals
