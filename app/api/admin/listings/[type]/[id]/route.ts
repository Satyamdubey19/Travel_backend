import { adminUpdateListing } from "@/modules/admin/controllers/admin.controller"
import type { NextRequest } from "next/server"

export async function PATCH(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  return adminUpdateListing(request, context)
}

