import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin-auth";
import { listAdminReviews } from "@/modules/review/services/review-operations.service";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      data: await listAdminReviews(
        request.nextUrl.searchParams.get("status") ?? "ALL",
      ),
    });
  } catch (error) {
    const status =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    return NextResponse.json(
      {
        error:
          status < 500 && error instanceof Error
            ? error.message
            : "Could not load reviews",
      },
      { status },
    );
  }
}
