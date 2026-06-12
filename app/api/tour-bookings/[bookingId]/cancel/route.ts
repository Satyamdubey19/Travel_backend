import { NextRequest } from "next/server"
import { cancelTourBookingController } from "@/modules/tour/controllers/tour-booking-engine.controller"

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  return cancelTourBookingController(req, (await params).bookingId)
}
