import type { NextRequest } from "next/server"
import { cancelActivityBookingController } from "@/modules/activity/controllers/activity-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  return cancelActivityBookingController(request, (await params).bookingId)
}
