import type { NextRequest } from "next/server"
import { unblockUserController } from "@/modules/community/controllers/community-safety.controller"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ blockedId: string }> }) {
  return unblockUserController(req, (await params).blockedId)
}
