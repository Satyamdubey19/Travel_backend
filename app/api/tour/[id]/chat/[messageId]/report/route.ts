import type { NextRequest } from "next/server"
import { reportTourMessageController } from "@/modules/community/controllers/community-safety.controller"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const values = await params
  return reportTourMessageController(req, values.id, values.messageId)
}
