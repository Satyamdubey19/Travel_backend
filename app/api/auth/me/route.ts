import { me, updateMe } from "@/modules/auth/controllers/auth.controller";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return me(request);
}

export async function PATCH(request: NextRequest) {
  return updateMe(request);
}

