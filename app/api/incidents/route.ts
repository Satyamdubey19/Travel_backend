import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";
import { requireUser } from "@/utils/user-auth";
import { createIncident, listReportedIncidents } from "@/modules/incident/services/incident.service";

function responseError(error: unknown, fallback: string) {
  const status = error instanceof z.ZodError ? 400 : typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500;
  return NextResponse.json({ error: status < 500 && error instanceof Error ? error.message : fallback }, { status });
}

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ data: await listReportedIncidents(String(user.id)) });
  } catch (error) {
    return responseError(error, "Could not load incident history");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    await assertRateLimit(`incident-create:${user.id}:${clientIp(request)}`, 5, 60 * 60);
    return NextResponse.json({ data: await createIncident(String(user.id), await request.json()) }, { status: 201 });
  } catch (error) {
    return responseError(error, "Could not submit incident report");
  }
}
