import type { NextRequest } from "next/server";
import {
  listHostBookingsController,
  updateHostBookingController,
} from "@/modules/booking/controllers/host-booking.controller";

export async function GET(request: NextRequest) {
  return listHostBookingsController(request);
}
export async function PATCH(request: NextRequest) {
  return updateHostBookingController(request);
}
