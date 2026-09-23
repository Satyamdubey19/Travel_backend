import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { requiredEnv, validateProductionEnvironment, isBuildPhase } from "@/lib/env"

if (!isBuildPhase()) {
  validateProductionEnvironment()
}

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production" && !isBuildPhase()
    ? requiredEnv("DATABASE_URL")
    : "postgresql://postgres:postgres@localhost:5432/travelspro")

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

pool.on("error", (err) => {
  console.warn("Neon pooler idle connection recycled:", err.message);
});


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
