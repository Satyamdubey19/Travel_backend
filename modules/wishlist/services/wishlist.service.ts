import { prisma } from "@/lib/prisma"
import { WishlistTarget } from "@prisma/client"

export const getWishlistService = async (userId: string) => {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      Hotel: {
        select: {
          title: true,
          slug: true,
          city: true,
          averageRating: true,
          HotelImage: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      Tour: { select: { title: true, slug: true, images: true, pricePerPerson: true, city: true } },
      Rental: { select: { title: true, slug: true } },
      Activity: { select: { title: true, slug: true } },
    },
  });
};


export const addToWishlistService = async (
  userId: string,
  data: {
    target: WishlistTarget;
    hotelId?: string;
    hotelSlug?: string;
    tourId?: string;
    tourSlug?: string;
    rentalId?: string;
    activityId?: string;
  }
) => {
  let hotelId = data.hotelId;
  if (!hotelId && data.hotelSlug) {
    const hotel = await prisma.hotel.findUnique({ where: { slug: data.hotelSlug }, select: { id: true } });
    if (!hotel) throw new Error(`Hotel not found: ${data.hotelSlug}`);
    hotelId = hotel.id;
  }

  let tourId = data.tourId;
  if (!tourId && data.tourSlug) {
    const tour = await prisma.tour.findUnique({ where: { slug: data.tourSlug }, select: { id: true } });
    if (!tour) throw new Error(`Tour not found: ${data.tourSlug}`);
    tourId = tour.id;
  }

  return prisma.wishlistItem.create({
    data: {
      userId,
      target: data.target,
      ...(hotelId ? { hotelId } : {}),
      ...(tourId ? { tourId } : {}),
      ...(data.rentalId ? { rentalId: data.rentalId } : {}),
      ...(data.activityId ? { activityId: data.activityId } : {}),
    },
  });
};

export const removeFromWishlistService = async (userId: string, id: string) => {
  return prisma.wishlistItem.deleteMany({
    where: { id, userId },
  });
};