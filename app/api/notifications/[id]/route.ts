import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { currentUserId } from "@/utils/user-auth"
import { markNotificationRead } from "@/modules/notification/services/notification.service"

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void _request
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ data: await markNotificationRead(userId, (await params).id) })
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notification update failed" }, { status })
  }
}
