import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getHostByUserId } from "@/modules/host/services/host.service"
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

async function getCurrentHost() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const host = await getHostByUserId(session.user.id)
  if (!host) return { error: NextResponse.json({ error: "Not a host" }, { status: 403 }) }

  return { host }
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

    const { rentalData, details } = splitRentalBody(await req.json())
    const rental = await createRental(host.id, rentalData, details)
    return NextResponse.json({ data: rental }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/rental:", error)
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

    const { rentalData, details } = splitRentalBody(await req.json())
    await updateRental(id, rentalData, details)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("PUT /api/rental/[id]:", error)
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
