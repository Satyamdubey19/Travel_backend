import type { NextRequest } from "next/server"
import { createRentalBookingController } from "@/modules/rental/controllers/rental-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createRentalBookingController(request, (await params).id)
}
