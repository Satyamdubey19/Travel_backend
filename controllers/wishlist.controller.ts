import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { getUserFromSessionToken } from "@/services/auth.service";
import { WishlistTarget } from "@prisma/client";
import {
  getWishlistService,
  addToWishlistService,
  removeFromWishlistService,
} from "@/services/wishlist.service";

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return String(session.user.id);

  const token = (await cookies()).get("token")?.value;
  if (!token) return null;

  const user = await getUserFromSessionToken(token);
  return user?.id ? String(user.id) : null;
}

export const getWishlistController = async () => {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const wishlist = await getWishlistService(userId);
    return NextResponse.json(wishlist);
  } catch {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
};

// ── POST /api/wishlist ────────────────────────────────────────────────────────
export const addToWishlistController = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { target, hotelId, hotelSlug, tourId, tourSlug, rentalId, activityId } = body as {
      target?: string;
      hotelId?: string;
      hotelSlug?: string;
      tourId?: string;
      tourSlug?: string;
      rentalId?: string;
      activityId?: string;
    };
    console.log("Received add to wishlist request:", { body });

    const userId = await resolveUserId();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const validTargets: string[] = ["HOTEL", "TOUR", "RENTAL", "ACTIVITY"];
    if (!target || !validTargets.includes(target)) {
      return new Response(
        JSON.stringify({ error: "target is required: HOTEL | TOUR | RENTAL | ACTIVITY" }),
        { status: 400 }
      );
    }

    const newItem = await addToWishlistService(userId, {
      target: target as WishlistTarget,
      hotelId,
      hotelSlug,
      tourId,
      tourSlug,
      rentalId,
      activityId,
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
};

// ── DELETE /api/wishlist ──────────────────────────────────────────────────────
export const removeFromWishlistController = async (req: NextRequest) => {
  try {
    const { id } = await req.json() as { id?: string };

    const userId = await resolveUserId();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: "id is required" }), { status: 400 });
    }

    const result = await removeFromWishlistService(userId, id);
    return NextResponse.json(result);
  } catch {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
};
