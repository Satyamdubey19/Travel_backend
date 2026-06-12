import { logout } from "@/modules/auth/controllers/auth.controller";

export async function POST() {
  return logout();
}

