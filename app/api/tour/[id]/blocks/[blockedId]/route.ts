import type { NextRequest } from "next/server"
import { blockCircleMemberController } from "@/modules/community/controllers/community-safety.controller"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; blockedId: string }> }) {
  const values = await params
  return blockCircleMemberController(req, values.id, values.blockedId)
}
