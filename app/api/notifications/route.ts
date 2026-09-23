import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { currentUserId } from "@/utils/user-auth"
import { listNotificationsForUser, markAllNotificationsRead } from "@/modules/notification/services/notification.service"

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const notifications = await listNotificationsForUser(userId)
  return NextResponse.json({ data: notifications.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null })) })
}

export async function PATCH(_request: NextRequest) {
  void _request
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ data: await markAllNotificationsRead(userId) })
}
