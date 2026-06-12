import { NextRequest } from "next/server"
import { createDocumentController, listDocumentsController } from "@/modules/tour/controllers/tour-operations.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return listDocumentsController(req, (await params).id)
}

export async function POST(req: NextRequest, { params }: Params) {
  return createDocumentController(req, (await params).id)
}
