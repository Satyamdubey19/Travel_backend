import { NextRequest, NextResponse } from "next/server"
import { processNotificationDeliveries } from "@/modules/notification/services/notification-delivery.service"

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
  const headerToken = request.headers.get("x-cron-secret")
  return bearerToken === secret || headerToken === secret
}

async function handleProcessNotifications(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 25)
  const result = await processNotificationDeliveries({
    limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
  })
  return NextResponse.json({ success: true, data: result })
}

export async function GET(request: NextRequest) {
  return handleProcessNotifications(request)
}

export async function POST(request: NextRequest) {
  return handleProcessNotifications(request)
}
