import { NextRequest } from "next/server"
import { createBatchController, listBatchesController } from "@/modules/tour/controllers/tour-operations.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return listBatchesController(req, (await params).id)
}

export async function POST(req: NextRequest, { params }: Params) {
  return createBatchController(req, (await params).id)
}
