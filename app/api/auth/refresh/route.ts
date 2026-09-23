import type { NextRequest } from "next/server"
import { refreshSession } from "@/modules/auth/controllers/auth.controller"

export async function POST(request: NextRequest) {
  return refreshSession(request)
}
