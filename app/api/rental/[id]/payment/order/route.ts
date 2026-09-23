import type { NextRequest } from "next/server"
import { createRentalPaymentOrderController } from "@/modules/rental/controllers/rental-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createRentalPaymentOrderController(request, (await params).id)
}
