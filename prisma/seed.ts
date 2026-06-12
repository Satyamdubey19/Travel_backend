import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcrypt"

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/travel_booking"
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    console.log("🌱 Starting database seeding...")

    const [johnPassword, janePassword, bobPassword, adminPassword] = await Promise.all([
      bcrypt.hash("Password@123", 10),
      bcrypt.hash("Password@123", 10),
      bcrypt.hash("Password@123", 10),
      bcrypt.hash("Admin@123", 10),
    ])

    // Keep demo accounts reusable across seed runs and ensure they can log in immediately.
    const user1 = await prisma.user.upsert({
      where: { email: "john@example.com" },
      update: {
        name: "John Doe",
        password: johnPassword,
        isVerified: true,
      },
      create: {
        email: "john@example.com",
        name: "John Doe",
        password: johnPassword,
        isVerified: true,
      },
    })

    const user2 = await prisma.user.upsert({
      where: { email: "jane@example.com" },
      update: {
        name: "Jane Smith",
        password: janePassword,
        isVerified: true,
      },
      create: {
        email: "jane@example.com",
        name: "Jane Smith",
        password: janePassword,
        isVerified: true,
      },
    })

    const user3 = await prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {
        name: "Bob Johnson",
        password: bobPassword,
        isVerified: true,
      },
      create: {
        email: "bob@example.com",
        name: "Bob Johnson",
        password: bobPassword,
        isVerified: true,
      },
    })

    const adminUser = await prisma.user.upsert({
      where: { email: "admin@gethotels.com" },
      update: {
        name: "GetHotels Admin",
        password: adminPassword,
        role: "ADMIN",
        isVerified: true,
      },
      create: {
        email: "admin@gethotels.com",
        name: "GetHotels Admin",
        password: adminPassword,
        role: "ADMIN",
        isVerified: true,
      },
    })

    console.log("✅ Created users:", { user1, user2, user3, adminUser })

    // Create sample hotels
    const hotel1 = await prisma.hotel.create({
      data: {
        title: "Luxury Beach Resort",
        location: "Maldives",
        description: "A beautiful 5-star resort on the beach with pristine waters",
        price: 500,
        rating: 4.8,
        image: "/hotels/beach-resort.jpg",
      },
    })

    const hotel2 = await prisma.hotel.create({
      data: {
        title: "City View Hotel",
        location: "New York",
        description: "Modern hotel in the heart of Manhattan",
        price: 300,
        rating: 4.5,
        image: "/hotels/city-hotel.jpg",
      },
    })

    const hotel3 = await prisma.hotel.create({
      data: {
        title: "Mountain Retreat",
        location: "Switzerland",
        description: "Cozy alpine hotel with mountain views",
        price: 250,
        rating: 4.6,
        image: "/hotels/mountain.jpg",
      },
    })

    console.log("✅ Created hotels:", { hotel1, hotel2, hotel3 })

    // Create sample tours
    const tour1 = await prisma.tour.create({
      data: {
        title: "Paris City Tour",
        destination: "Paris",
        description: "3-day guided tour of Paris including Eiffel Tower and Louvre",
        price: 800,
        duration: 3,
        image: "/tours/paris.jpg",
      },
    })

    const tour2 = await prisma.tour.create({
      data: {
        title: "Japan Adventure",
        destination: "Japan",
        description: "7-day journey through Tokyo, Kyoto, and Mount Fuji",
        price: 2000,
        duration: 7,
        image: "/tours/japan.jpg",
      },
    })

    console.log("✅ Created tours:", { tour1, tour2 })

    // Create sample bookings
    const booking1 = await prisma.booking.create({
      data: {
        userId: user1.id,
        hotelId: hotel1.id,
        checkIn: new Date("2026-05-01"),
        checkOut: new Date("2026-05-05"),
        guests: 2,
        status: "confirmed",
      },
    })

    console.log("✅ Created booking:", booking1)

    // Create sample reviews
    const review1 = await prisma.review.create({
      data: {
        rating: 5,
        comment: "Amazing experience! Would definitely come back.",
        userId: user1.id,
        hotelId: hotel1.id,
      },
    })

    const review2 = await prisma.review.create({
      data: {
        rating: 4,
        comment: "Great tour, very well organized.",
        userId: user2.id,
        tourId: tour1.id,
      },
    })

    console.log("✅ Created reviews:", { review1, review2 })

    // Create sample wishlist
    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId: user2.id,
        hotelId: hotel2.id,
      },
    })

    console.log("✅ Created wishlist item:", wishlistItem)

    // Create sample post
    const post = await prisma.post.create({
      data: {
        title: "My Amazing Vacation",
        content: "I had an incredible time at the beach resort!",
        image: "/posts/vacation.jpg",
        userId: user1.id,
      },
    })

    console.log("✅ Created post:", post)

    console.log("\n✨ Database seeding completed successfully!")
  } catch (error) {
    console.error("❌ Seeding error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
