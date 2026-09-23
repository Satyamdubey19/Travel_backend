import type { NextRequest } from "next/server";
import { getActivePoliciesController } from "@/modules/policy/controllers/policy.controller";

export async function GET(request: NextRequest) {
  return getActivePoliciesController(request);
}

