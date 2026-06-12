import { NextRequest } from "next/server"
import { createTourBookingIntentController } from "@/modules/tour/controllers/tour-booking-engine.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function POST(req: NextRequest, { params }: Params) {
  return createTourBookingIntentController(req, (await params).id)
}
