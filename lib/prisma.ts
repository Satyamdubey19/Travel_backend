import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:1234@localhost:5432/travel_booking"

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
  prismaPool?: Pool
}

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxUses: 7_500,
  })

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPool = pool
}

export { prisma }
