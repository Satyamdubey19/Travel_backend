import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { requireHost } from "@/utils/host-auth";
import { respondToHostReview } from "@/modules/review/services/review-operations.service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, host } = await requireHost();
    await assertRateLimit(
      `host-review-response:${user.id}:${clientIp(request)}`,
      10,
      60,
    );
    return NextResponse.json({
      data: await respondToHostReview(
        host.id,
        String(user.id),
        (await params).id,
        await request.json(),
      ),
    });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode) || 500
          : 500;
    return NextResponse.json(
      {
        error:
          status < 500 && error instanceof Error
            ? error.message
            : "Could not save review response",
      },
      { status },
    );
  }
}
