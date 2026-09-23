import { NextRequest, NextResponse } from "next/server"
import { currentUserId } from "@/utils/user-auth"
import { getUnifiedBookingForUser, listUnifiedBookingsForUser } from "@/modules/booking/services/my-bookings.service"

export async function listMyBookingsController(_req: NextRequest) {
  void _req
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const bookings = await listUnifiedBookingsForUser(userId)
    return NextResponse.json({ success: true, data: bookings })
  } catch (error) {
    console.error("GET /api/my-bookings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function getMyBookingController(_req: NextRequest, type: string, id: string) {
  void _req
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const booking = await getUnifiedBookingForUser(userId, type.toLowerCase(), id)
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: booking })
  } catch (error) {
    console.error("GET /api/my-bookings/[type]/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
