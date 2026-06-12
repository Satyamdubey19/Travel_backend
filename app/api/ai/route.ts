import { prisma } from "@/lib/prisma"

function extractCity(message: string, cities: string[]) {
  const lower = message.toLowerCase()
  return cities.find((city) => city && lower.includes(city.toLowerCase()))
}

export async function POST(req: Request) {
  const { message = "" } = (await req.json().catch(() => ({}))) as { message?: string }

  const cities = await prisma.tour
    .findMany({
      where: { isActive: true },
      select: { city: true },
      distinct: ["city"],
    })
    .then((rows) => rows.map((row) => row.city).filter(Boolean) as string[])
    .catch(() => [])

  const city = extractCity(message, cities)

  const [tours, activities, rentals] = await Promise.all([
    prisma.tour
      .findMany({
        where: {
          isActive: true,
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        },
        select: {
          title: true,
          city: true,
          pricePerPerson: true,
          duration: true,
          slug: true,
        },
        take: 6,
      })
      .catch(() => []),
    prisma.activity
      .findMany({
        where: {
          isActive: true,
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        },
        select: {
          title: true,
          city: true,
          price: true,
          duration: true,
          slug: true,
        },
        take: 4,
      })
      .catch(() => []),
    prisma.rental
      .findMany({
        where: {
          isActive: true,
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        },
        select: {
          title: true,
          city: true,
          pricePerDay: true,
          slug: true,
          vehicleType: true,
        },
        take: 4,
      })
      .catch(() => []),
  ])

  return Response.json({
    message: city
      ? `Here are travel options in ${city}.`
      : "Here are trips, activities, and rentals you can explore.",
    tours: tours.map((tour) => ({
      name: tour.title,
      city: tour.city ?? null,
      price: Number(tour.pricePerPerson),
      duration: tour.duration,
      link: `/tours/${tour.slug}`,
    })),
    activities: activities.map((activity) => ({
      name: activity.title,
      city: activity.city,
      price: Number(activity.price),
      duration: activity.duration,
      link: `/activities/${activity.slug}`,
    })),
    rentals: rentals.map((rental) => ({
      name: rental.title,
      city: rental.city,
      price: Number(rental.pricePerDay),
      type: rental.vehicleType,
      link: `/car-rental/${rental.slug}`,
    })),
  })
}
