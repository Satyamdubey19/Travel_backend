import { adminUpdateHost } from "@/modules/admin/controllers/admin.controller"
import type { NextRequest } from "next/server"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  return adminUpdateHost(request, context)
}
