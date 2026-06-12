import { NextRequest, NextResponse } from "next/server"
import { expireStaleBookings } from "@/modules/booking/services/expire-bookings.service"


function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
  const headerToken = request.headers.get("x-cron-secret")

  return bearerToken === secret || headerToken === secret
}

async function handleExpireBookings(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const limitParam = request.nextUrl.searchParams.get("limit")
  const limit = limitParam ? Number(limitParam) : undefined
  const result = await expireStaleBookings({ limit: Number.isFinite(limit) ? limit : undefined })

  return NextResponse.json({ success: true, data: result })
}

export async function GET(request: NextRequest) {
  return handleExpireBookings(request)
}

export async function POST(request: NextRequest) {
  return handleExpireBookings(request)
}
