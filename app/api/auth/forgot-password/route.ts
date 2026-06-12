import { forgotPassword } from "@/modules/auth/controllers/auth.controller";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return forgotPassword(request);
}

