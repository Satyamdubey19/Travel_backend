import type { NextRequest } from "next/server"
import { changePassword } from "@/modules/auth/controllers/auth.controller"

export async function POST(request: NextRequest) {
  return changePassword(request)
}
