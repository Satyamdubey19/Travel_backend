import { NextRequest } from "next/server"
import { addTourTravelersController } from "@/modules/tour/controllers/tour-booking-engine.controller"

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  return addTourTravelersController(req, (await params).bookingId)
}
