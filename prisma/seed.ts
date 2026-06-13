import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcrypt"

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/travel_booking"
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function upsertUser(email: string, name: string, password: string, role: "USER" | "ADMIN" = "USER") {
  const hashedPassword = await bcrypt.hash(password, 10)

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role,
      isVerified: true,
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role,
      isVerified: true,
    },
  })
}

async function main() {
  try {
    console.log("Starting database seeding...")

    const [user1, user2, user3, adminUser] = await Promise.all([
      upsertUser("john@example.com", "John Doe", "Password@123"),
      upsertUser("jane@example.com", "Jane Smith", "Password@123"),
      upsertUser("bob@example.com", "Bob Johnson", "Password@123"),
      upsertUser("admin@gethotels.com", "GetHotels Admin", "Admin@123", "ADMIN"),
    ])

    console.log("Seeded users:", { user1: user1.id, user2: user2.id, user3: user3.id, adminUser: adminUser.id })
    console.log("Database seeding completed successfully.")
  } catch (error) {
    console.error("Seeding error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
