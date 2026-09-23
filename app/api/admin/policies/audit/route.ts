import type { NextRequest } from "next/server";
import { adminAuditLogsController } from "@/modules/policy/controllers/policy.controller";

export async function GET(request: NextRequest) {
  return adminAuditLogsController(request);
}

