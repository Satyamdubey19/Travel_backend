import type { NextRequest } from "next/server"
import { verifyRentalPaymentController } from "@/modules/rental/controllers/rental-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return verifyRentalPaymentController(request, (await params).id)
}
