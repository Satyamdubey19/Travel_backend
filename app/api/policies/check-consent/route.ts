import { checkUserConsentController } from "@/modules/policy/controllers/policy.controller";

export async function GET() {
  return checkUserConsentController();
}

