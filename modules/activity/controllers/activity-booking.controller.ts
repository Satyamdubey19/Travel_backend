import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { currentUserId } from "@/utils/user-auth"
import { cancelActivityBooking, createActivityBooking, createActivityPaymentOrder, verifyActivityPayment } from "@/modules/activity/services/activity-booking.service"
import { activityPaymentOrderSchema, activityPaymentVerificationSchema, cancelActivityBookingSchema, createActivityBookingSchema } from "@/modules/activity/validators/activity-booking.validators"
import { ZodError } from "zod"

function failure(error: unknown, fallback: string) {
  const status = error instanceof ZodError ? 400 : typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status })
}

export async function createActivityBookingController(request: NextRequest, activityId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`activity-booking:${userId}:${clientIp(request)}`, 10, 60)
    const input = createActivityBookingSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await createActivityBooking(userId, activityId, input) }, { status: 201 })
  } catch (error) { return failure(error, "Could not create activity booking") }
}

export async function createActivityPaymentOrderController(request: NextRequest, activityId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`activity-payment-order:${userId}:${clientIp(request)}`, 20, 60)
    const input = activityPaymentOrderSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await createActivityPaymentOrder(userId, activityId, input.bookingId) })
  } catch (error) { return failure(error, "Could not create activity payment order") }
}

export async function verifyActivityPaymentController(request: NextRequest, activityId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`activity-payment-verify:${userId}:${clientIp(request)}`, 30, 60)
    const input = activityPaymentVerificationSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await verifyActivityPayment(userId, activityId, input) })
  } catch (error) { return failure(error, "Could not verify activity payment") }
}

export async function cancelActivityBookingController(request: NextRequest, bookingId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`activity-cancel:${userId}:${clientIp(request)}`, 10, 60)
    const input = cancelActivityBookingSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await cancelActivityBooking(userId, bookingId, input.reason) })
  } catch (error) { return failure(error, "Could not cancel activity booking") }
}
