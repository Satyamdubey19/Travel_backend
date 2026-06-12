import { NextRequest } from "next/server"
import { createTourController, getToursController } from "@/modules/tour/controllers/tour.controller"

export async function GET(req: NextRequest) {
  return getToursController(req)
}

export async function POST(req: NextRequest) {
  return createTourController(req)
}
