import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { requireHost } from "@/utils/host-auth";
import { inspectionStageSchema } from "@/modules/rental/validators/rental-inspection.validators";
import {
  listHostRentalInspections,
  saveHostRentalInspection,
  submitHostRentalInspection,
} from "@/modules/rental/services/rental-inspection.service";

function failure(error: unknown) {
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
          : "Inspection operation failed",
    },
    { status },
  );
}

async function context(params: Promise<{ bookingId: string; stage: string }>) {
  const { user, host } = await requireHost();
  const values = await params;
  return {
    user,
    host,
    bookingId: values.bookingId,
    stage: inspectionStageSchema.parse(values.stage.toUpperCase()),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string; stage: string }> },
) {
  try {
    const { host, bookingId, stage } = await context(params);
    const records = await listHostRentalInspections(host.id, bookingId);
    return NextResponse.json({
      data: records.find((record) => record.stage === stage) ?? null,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string; stage: string }> },
) {
  try {
    const { user, host, bookingId, stage } = await context(params);
    await assertRateLimit(
      `rental-inspection:${user.id}:${clientIp(request)}`,
      20,
      60,
    );
    return NextResponse.json({
      data: await saveHostRentalInspection(
        host.id,
        String(user.id),
        bookingId,
        stage,
        await request.json(),
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string; stage: string }> },
) {
  try {
    const { user, host, bookingId, stage } = await context(params);
    await assertRateLimit(
      `rental-inspection-submit:${user.id}:${clientIp(request)}`,
      5,
      60,
    );
    return NextResponse.json({
      data: await submitHostRentalInspection(
        host.id,
        String(user.id),
        bookingId,
        stage,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
