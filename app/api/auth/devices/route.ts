import { devices } from "@/modules/auth/controllers/auth.controller"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return devices(request)
}
