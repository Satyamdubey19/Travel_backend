import type { NextRequest } from "next/server"
import { verifyActivityPaymentController } from "@/modules/activity/controllers/activity-booking.controller"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return verifyActivityPaymentController(request, (await params).id)
}
