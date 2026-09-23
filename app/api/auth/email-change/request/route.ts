import type { NextRequest } from "next/server"
import { requestEmailChange } from "@/modules/auth/controllers/auth.controller"

export async function POST(request: NextRequest) {
  return requestEmailChange(request)
}
