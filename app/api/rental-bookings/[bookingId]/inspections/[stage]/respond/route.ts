import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { currentUserId } from "@/utils/user-auth";
import { inspectionStageSchema } from "@/modules/rental/validators/rental-inspection.validators";
import { respondToRentalInspection } from "@/modules/rental/services/rental-inspection.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string; stage: string }> },
) {
  try {
    const userId = await currentUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await assertRateLimit(
      `rental-inspection-response:${userId}:${clientIp(request)}`,
      5,
      60,
    );
    const values = await params;
    const stage = inspectionStageSchema.parse(values.stage.toUpperCase());
    return NextResponse.json({
      data: await respondToRentalInspection(
        userId,
        values.bookingId,
        stage,
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
            : "Could not respond to inspection",
      },
      { status },
    );
  }
}
