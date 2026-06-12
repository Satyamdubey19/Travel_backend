import { me, updateMe } from "@/modules/auth/controllers/auth.controller";
import type { NextRequest } from "next/server";

export async function GET() {
  return me();
}

export async function PATCH(request: NextRequest) {
  return updateMe(request);
}

