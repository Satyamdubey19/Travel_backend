import type { NextRequest } from "next/server"
import { confirmEmailChange } from "@/modules/auth/controllers/auth.controller"

export async function POST(request: NextRequest) {
  return confirmEmailChange(request)
}
