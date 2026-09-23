import type { NextRequest } from "next/server"
import { createActivityPaymentOrderController } from "@/modules/activity/controllers/activity-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createActivityPaymentOrderController(request, (await params).id)
}
