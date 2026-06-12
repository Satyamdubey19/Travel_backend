import { ResetPasswordHandler } from "@/modules/auth/controllers/auth.controller";

export async function POST(req:Request) {
  return ResetPasswordHandler(req as any)
}
