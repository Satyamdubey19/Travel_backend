import { getHostBookingController } from "@/modules/booking/controllers/host-booking.controller";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  return getHostBookingController(
    (await context.params).bookingId,
    new URL(request.url).searchParams.get("type"),
  );
}
