import { NextResponse } from "next/server";
import { currentUserId } from "@/utils/user-auth";
import { listTravelerRentalInspections } from "@/modules/rental/services/rental-inspection.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const userId = await currentUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({
      data: await listTravelerRentalInspections(
        userId,
        (await params).bookingId,
      ),
    });
  } catch (error) {
    const status =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    return NextResponse.json(
      {
        error:
          status < 500 && error instanceof Error
            ? error.message
            : "Could not load rental inspections",
      },
      { status },
    );
  }
}
