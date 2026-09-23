import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin-auth";
import { verifyAdminPasswordAndIssueStepUp } from "@/modules/admin/services/admin-step-up.service";
import { assertTrustedOrigin } from "@/modules/auth/services/auth-security.service";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const admin = await requireAdmin(request);
    const body = await request.json();
    const password = body?.password;

    const result = await verifyAdminPasswordAndIssueStepUp(admin.id, password);

    const response = NextResponse.json({
      success: true,
      stepUpToken: result.stepUpToken,
      expiresInSeconds: result.expiresInSeconds,
    });

    response.cookies.set("admin_step_up", result.stepUpToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: result.expiresInSeconds,
    });

    return response;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string; code?: string };
    const status = err?.statusCode || 500;
    const message = err?.message || "Step-up authentication failed";
    return NextResponse.json({ error: message, code: err?.code }, { status });
  }
}

