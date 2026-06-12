import { adminBookings } from "@/modules/admin/controllers/admin.controller"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return adminBookings(request)
}


