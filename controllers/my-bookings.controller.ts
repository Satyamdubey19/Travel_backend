import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserFromSessionToken } from "@/services/auth.service"
import { listUnifiedBookingsForUser } from "@/services/my-bookings.service"

async function getAuthenticatedUserId() {
  const token = (await cookies()).get("token")?.value
  if (token) {
    const user = await getUserFromSessionToken(token)
    if (user?.id) return String(user.id)
  }

  const session = await getServerSession(authOptions)
  return session?.user?.id ? String(session.user.id) : null
}

export async function listMyBookingsController(_req: NextRequest) {
  void _req
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const bookings = await listUnifiedBookingsForUser(userId)
    return NextResponse.json({ success: true, data: bookings })
  } catch (error) {
    console.error("GET /api/my-bookings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
