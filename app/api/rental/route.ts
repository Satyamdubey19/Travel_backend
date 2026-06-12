import { NextRequest } from "next/server"
import { createRentalController, getRentalsController } from "@/modules/rental/controllers/rental.controller"

export async function GET(req: NextRequest) {
  return getRentalsController(req)
}

export async function POST(req: NextRequest) {
  return createRentalController(req)
}

