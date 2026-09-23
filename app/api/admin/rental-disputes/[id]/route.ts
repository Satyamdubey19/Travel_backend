import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { requireAdmin } from "@/utils/admin-auth";
import { resolveRentalDispute } from "@/modules/admin/services/rental-dispute.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    await assertRateLimit(
      `admin-rental-dispute:${admin.id}:${clientIp(request)}`,
      10,
      60,
    );
    return NextResponse.json({
      data: await resolveRentalDispute(
        (await params).id,
        admin,
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
            : "Could not resolve rental dispute",
      },
      { status },
    );
  }
}
