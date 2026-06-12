import { NextRequest } from "next/server"
import { reviewJoinRequestController } from "@/modules/tour/controllers/tour.controller"

type Params = {
  params: Promise<{ id: string; requestId: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { requestId } = await params
  return reviewJoinRequestController(req, requestId)
}
