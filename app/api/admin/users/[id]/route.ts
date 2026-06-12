import { adminUpdateUser } from "@/modules/admin/controllers/admin.controller"
import type { NextRequest } from "next/server"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  return adminUpdateUser(request, context)
}
