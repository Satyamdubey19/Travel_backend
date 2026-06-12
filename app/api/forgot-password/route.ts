import { forgotPassword } from "@/modules/auth/controllers/auth.controller";

export async function POST(req:Request) {
  return forgotPassword(req as any);
}
