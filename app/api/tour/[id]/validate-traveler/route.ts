import { NextRequest } from "next/server"
import { validateTourTravelerController } from "@/modules/tour/controllers/tour-booking-engine.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function POST(req: NextRequest, { params }: Params) {
  return validateTourTravelerController(req, (await params).id)
}
