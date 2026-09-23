import type { NextRequest } from "next/server";
import { adminTogglePolicyController } from "@/modules/policy/controllers/policy.controller";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return adminTogglePolicyController(request, params);
}

