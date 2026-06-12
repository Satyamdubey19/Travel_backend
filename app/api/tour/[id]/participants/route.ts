import { NextRequest } from "next/server"
import { listTourParticipantsController } from "@/modules/tour/controllers/tour.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return listTourParticipantsController(req, (await params).id)
}
