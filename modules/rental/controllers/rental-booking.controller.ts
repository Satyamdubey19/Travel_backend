import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { currentUserId } from "@/utils/user-auth"
import { cancelRentalBooking, createRentalBooking, createRentalPaymentOrder, verifyRentalPayment } from "@/modules/rental/services/rental-booking.service"
import { cancelRentalBookingSchema, createRentalBookingSchema, rentalPaymentOrderSchema, rentalPaymentVerificationSchema } from "@/modules/rental/validators/rental-booking.validators"

function failure(error: unknown, fallback: string) {
  const status = error instanceof ZodError ? 400 : typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status })
}

export async function createRentalBookingController(request: NextRequest, rentalId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`rental-booking:${userId}:${clientIp(request)}`, 10, 60)
    const input = createRentalBookingSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await createRentalBooking(userId, rentalId, input) }, { status: 201 })
  } catch (error) { return failure(error, "Could not create rental booking") }
}

export async function createRentalPaymentOrderController(request: NextRequest, rentalId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`rental-payment-order:${userId}:${clientIp(request)}`, 20, 60)
    const input = rentalPaymentOrderSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await createRentalPaymentOrder(userId, rentalId, input.bookingId) })
  } catch (error) { return failure(error, "Could not create rental payment order") }
}

export async function verifyRentalPaymentController(request: NextRequest, rentalId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`rental-payment-verify:${userId}:${clientIp(request)}`, 30, 60)
    const input = rentalPaymentVerificationSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await verifyRentalPayment(userId, rentalId, input) })
  } catch (error) { return failure(error, "Could not verify rental payment") }
}

export async function cancelRentalBookingController(request: NextRequest, bookingId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`rental-cancel:${userId}:${clientIp(request)}`, 10, 60)
    const input = cancelRentalBookingSchema.parse(await request.json())
    return NextResponse.json({ success: true, data: await cancelRentalBooking(userId, bookingId, input.reason) })
  } catch (error) { return failure(error, "Could not cancel rental booking") }
}
