import type { NextRequest } from "next/server"
import { getMyBookingController } from "@/modules/booking/controllers/my-bookings.controller"
export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) { const { type, id } = await params; return getMyBookingController(request, type, id) }
