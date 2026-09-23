import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { requireAdmin } from "@/utils/admin-auth"
import { replayNotificationDelivery } from "@/modules/notification/services/notification-admin.service"

const replaySchema = z.object({
  action: z.literal("retry"),
  reason: z.string().trim().min(10).max(500),
}).strict()

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    await assertRateLimit(`admin-notification-replay:${admin.id}:${clientIp(request)}`, 10, 60)
    const input = replaySchema.parse(await request.json())
    return NextResponse.json({
      data: await replayNotificationDelivery((await params).id, admin, input.reason),
    })
  } catch (error) {
    const status = error instanceof z.ZodError
      ? 400
      : typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500
    return NextResponse.json(
      { error: status < 500 && error instanceof Error ? error.message : "Could not replay notification delivery" },
      { status },
    )
  }
}
