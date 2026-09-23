import type { NextRequest } from "next/server"
import { cancelRentalBookingController } from "@/modules/rental/controllers/rental-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  return cancelRentalBookingController(request, (await params).bookingId)
}
