import { NextRequest ,NextResponse} from "next/server";
import { getWishlistController, addToWishlistController,removeFromWishlistController } from "@/modules/wishlist/controllers/wishlist.controller";

export async function GET(req: NextRequest) {
  void req
  return getWishlistController()
}

export async function POST(req: NextRequest) {
  return addToWishlistController(req);
}

export async function DELETE(req: NextRequest) {
return removeFromWishlistController(req);
}

