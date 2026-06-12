import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserFromSessionToken } from "@/services/auth.service"
import { addTravelersToTourBooking, cancelTourBooking, createTourBookingIntent } from "@/services/tour-booking-engine.service"
import { validateTravelerForTour } from "@/services/tour-traveler-duplicate.service"
import { addTourTravelersSchema, cancelTourBookingSchema, createTourBookingIntentSchema, validateTourTravelerSchema } from "@/validators/tour-booking.validators"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"

async function getAuthenticatedUserId() {
  const token = (await cookies()).get("token")?.value
  if (token) {
    const user = await getUserFromSessionToken(token)
    if (user?.id) return String(user.id)
  }
  const session = await getServerSession(authOptions)
  return session?.user?.id ? String(session.user.id) : null
}

function apiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback
  const status = message.includes("not found") ? 404 : message.includes("not open") || message.includes("unavailable") ? 409 : 400
  return NextResponse.json({ error: message }, { status })
}

export async function createTourBookingIntentController(req: NextRequest, tourId: string) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`tour-booking:${userId}:${clientIp(req)}`, 10, 60)
    const body = createTourBookingIntentSchema.parse(await req.json())
    const data = await createTourBookingIntent(userId, tourId, body)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return apiError(error, "Could not create tour booking")
  }
}

export async function addTourTravelersController(req: NextRequest, bookingId: string) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`tour-travelers:${userId}:${clientIp(req)}`, 20, 60)
    const body = addTourTravelersSchema.parse(await req.json())
    const data = await addTravelersToTourBooking(userId, bookingId, body.travelers)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return apiError(error, "Could not add travelers")
  }
}

export async function cancelTourBookingController(req: NextRequest, bookingId: string) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`tour-cancel:${userId}:${clientIp(req)}`, 10, 60)
    const body = cancelTourBookingSchema.parse(await req.json().catch(() => ({})))
    const data = await cancelTourBooking(userId, bookingId, body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return apiError(error, "Could not cancel booking")
  }
}

export async function validateTourTravelerController(req: NextRequest, tourId: string) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`tour-traveler-validate:${userId}:${clientIp(req)}`, 60, 60)
    const body = validateTourTravelerSchema.parse(await req.json())
    const data = await validateTravelerForTour(tourId, body)
    return NextResponse.json({ success: true, data: {
      isDuplicate: data.isDuplicate,
      message: data.message,
      maskedAadhaar: data.maskedAadhaar,
    } })
  } catch (error) {
    return apiError(error, "Could not validate traveler")
  }
}
