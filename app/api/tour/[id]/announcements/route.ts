import { NextRequest } from "next/server"
import { createAnnouncementController, listAnnouncementsController } from "@/modules/tour/controllers/tour-operations.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return listAnnouncementsController(req, (await params).id)
}

export async function POST(req: NextRequest, { params }: Params) {
  return createAnnouncementController(req, (await params).id)
}
