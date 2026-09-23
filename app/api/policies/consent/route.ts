import type { NextRequest } from "next/server";
import { recordConsentController } from "@/modules/policy/controllers/policy.controller";

export async function POST(request: NextRequest) {
  return recordConsentController(request);
}

