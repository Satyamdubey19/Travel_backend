import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin-auth";
import { listRentalDisputes } from "@/modules/admin/services/rental-dispute.service";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      data: await listRentalDisputes(
        request.nextUrl.searchParams.get("status") ?? "DISPUTED",
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
            : "Could not load rental disputes",
      },
      { status },
    );
  }
}
