import { NextRequest } from "next/server"
import { listMyBookingsController } from "@/modules/booking/controllers/my-bookings.controller"

export async function GET(req: NextRequest) {
  return listMyBookingsController(req)
}
