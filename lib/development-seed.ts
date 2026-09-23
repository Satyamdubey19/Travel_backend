export type DevelopmentSeedConfig = {
  connectionString: string
  userPassword: string
  adminEmail: string
  adminPassword: string
}

export function getDevelopmentSeedConfig(environment: Readonly<Record<string, string | undefined>> = process.env): DevelopmentSeedConfig {
  const connectionString = environment.DATABASE_URL?.trim()
  const developmentSeedEnabled = environment.ALLOW_DEVELOPMENT_SEED === "true"
  const userPassword = environment.DEV_SEED_USER_PASSWORD
  const adminEmail = environment.DEV_SEED_ADMIN_EMAIL?.trim()
  const adminPassword = environment.DEV_SEED_ADMIN_PASSWORD

  if (!connectionString) throw new Error("DATABASE_URL is required for development seed data")
  if (environment.NODE_ENV === "production") throw new Error("Development seed data is disabled in production")
  if (!developmentSeedEnabled) throw new Error("Set ALLOW_DEVELOPMENT_SEED=true to seed a disposable development database")
  if (!userPassword || userPassword.length < 12) throw new Error("DEV_SEED_USER_PASSWORD must be at least 12 characters")
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error("DEV_SEED_ADMIN_EMAIL and a 12+ character DEV_SEED_ADMIN_PASSWORD are required")
  }

  return { connectionString, userPassword, adminEmail, adminPassword }
}
