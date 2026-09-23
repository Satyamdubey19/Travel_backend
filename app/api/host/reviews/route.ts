import { NextResponse } from "next/server";
import { requireHost } from "@/utils/host-auth";
import { listHostReviews } from "@/modules/review/services/review-operations.service";

export async function GET() {
  try {
    const { host } = await requireHost();
    const result = await listHostReviews(host.id);
    return NextResponse.json({ success: true, ...result });
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
            : "Could not load host reviews",
      },
      { status },
    );
  }
}
