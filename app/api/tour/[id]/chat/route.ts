import { NextRequest } from "next/server"
import { getTourChatController, sendTourChatMessageController } from "@/modules/tour/controllers/tour.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return getTourChatController(req, (await params).id)
}

export async function POST(req: NextRequest, { params }: Params) {
  return sendTourChatMessageController(req, (await params).id)
}
