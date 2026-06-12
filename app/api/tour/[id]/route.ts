import { NextRequest } from "next/server"
import {
  deleteTourController,
  getTour,
  updateTourController,
} from "@/modules/tour/controllers/tour.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return getTour(req, (await params).id)
}

export async function PUT(req: NextRequest, { params }: Params) {
  return updateTourController(req, (await params).id)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return deleteTourController(req, (await params).id)
}
