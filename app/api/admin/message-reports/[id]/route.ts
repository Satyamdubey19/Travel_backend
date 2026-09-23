import type { NextRequest } from "next/server"
import { reviewMessageReportController } from "@/modules/community/controllers/community-safety.controller"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return reviewMessageReportController(req, (await params).id)
}
