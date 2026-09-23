import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireHost } from "@/utils/host-auth";
import {
  getHostBooking,
  listHostBookings,
  updateHostBookingStatus,
  type HostBookingType,
} from "@/modules/booking/services/host-booking.service";

function status(error: unknown) {
  return typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode) || 500
    : 500;
}
function responseError(error: unknown) {
  const code = status(error);
  return NextResponse.json(
    {
      error:
        code < 500 && error instanceof Error
          ? error.message
          : "Unable to process host booking",
    },
    { status: code },
  );
}

export async function listHostBookingsController(request: NextRequest) {
  try {
    const { host } = await requireHost();
    const result = await listHostBookings(
      host.id,
      request.nextUrl.searchParams.get("status") ?? undefined,
      request.nextUrl.searchParams.get("type") ?? undefined,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return responseError(error);
  }
}
function bookingType(value: unknown): HostBookingType {
  if (value === "activity" || value === "rental" || value === "tour")
    return value;
  return "tour";
}
export async function getHostBookingController(
  bookingId: string,
  type?: string | null,
) {
  try {
    const { host } = await requireHost();
    return NextResponse.json({
      success: true,
      data: await getHostBooking(host.id, bookingId, bookingType(type)),
    });
  } catch (error) {
    return responseError(error);
  }
}
export async function updateHostBookingController(request: NextRequest) {
  try {
    const { host } = await requireHost();
    const body = (await request.json()) as {
      bookingId?: string;
      status?: string;
      note?: string;
      type?: string;
    };
    if (!body.bookingId || !body.status)
      return NextResponse.json(
        { error: "Booking and status are required" },
        { status: 400 },
      );
    return NextResponse.json({
      success: true,
      data: await updateHostBookingStatus(
        host.id,
        body.bookingId,
        body.status,
        body.note,
        bookingType(body.type),
      ),
    });
  } catch (error) {
    return responseError(error);
  }
}
