import type { NextRequest } from "next/server"
import { createActivityBookingController } from "@/modules/activity/controllers/activity-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createActivityBookingController(request, (await params).id)
}
