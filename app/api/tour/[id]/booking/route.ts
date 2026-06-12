import { NextRequest } from "next/server"
import { createTourBookingController } from "@/modules/tour/controllers/tour.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function POST(req: NextRequest, { params }: Params) {
  return createTourBookingController(req, (await params).id)
}
