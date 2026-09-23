import type { NextRequest } from "next/server";
import {
  adminListPoliciesController,
  adminCreatePolicyController,
} from "@/modules/policy/controllers/policy.controller";

export async function GET(request: NextRequest) {
  return adminListPoliciesController(request);
}

export async function POST(request: NextRequest) {
  return adminCreatePolicyController(request);
}

