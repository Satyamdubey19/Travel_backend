import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcrypt"
import dotenv from "dotenv"
import { getDevelopmentSeedConfig } from "@/lib/development-seed"

dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" })

const { connectionString, userPassword: seedUserPassword, adminEmail: seedAdminEmail, adminPassword: seedAdminPassword } = getDevelopmentSeedConfig()

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
      status: "ACTIVE",
      isActive: true,
      isBanned: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role,
      status: "ACTIVE",
      isActive: true,
      isBanned: false,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
}

async function upsertApprovedDevelopmentHost(userId: string) {
  return prisma.host.upsert({
    where: { userId },
    update: {
      businessName: "Travels Pro Test Host",
      contactEmail: "host@example.test",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      isVerified: true,
      isApproved: true,
      isActive: true,
      kycStatus: "APPROVED",
      rejectionReason: null,
      suspendedAt: null,
      deactivatedAt: null,
    },
    create: {
      userId,
      businessName: "Travels Pro Test Host",
      contactEmail: "host@example.test",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      isVerified: true,
      isApproved: true,
      isActive: true,
      kycStatus: "APPROVED",
    },
  })
}

async function main() {
  try {
    console.log("Starting database seeding...")

    const [user1, user2, user3, hostUser, adminUser] = await Promise.all([
      upsertUser("john@example.test", "John Doe", seedUserPassword),
      upsertUser("jane@example.test", "Jane Smith", seedUserPassword),
      upsertUser("bob@example.test", "Bob Johnson", seedUserPassword),
      upsertUser("host@example.test", "Development Host", seedUserPassword, "HOST"),
      upsertUser(seedAdminEmail, "Development Admin", seedAdminPassword, "ADMIN"),
    ])
    const host = await upsertApprovedDevelopmentHost(hostUser.id)

    console.log("Seeded development identities:", {
      travelerIds: [user1.id, user2.id, user3.id],
      hostId: host.userId,
      adminId: adminUser.id,
    })
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
