/**
 * Runtime configuration helpers. Never provide production secrets or database
 * credentials as source-code fallbacks: a misconfigured deployment must fail
 * closed rather than connecting to an unintended database.
 */
export const productionRequiredEnvironmentVariables = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CORS_ORIGIN",
  "REDIS_URL",
  "CRON_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "AADHAAR_HASH_SECRET",
  "KYC_ENCRYPTION_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "BREVO_API_KEY",
  "BREVO_FROM_EMAIL",
] as const;

export function isSuppliedEnvironmentValue(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && !normalized.startsWith("your_") && !normalized.startsWith("replace_with_"));
}

function isValidRedisConnection(value: string | undefined) {
  if (!isSuppliedEnvironmentValue(value)) return false

  try {
    const parsed = new URL(value!.trim())
    return (parsed.protocol === "redis:" || parsed.protocol === "rediss:") && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

function isValidProductionEnvironmentValue(name: string, value: string | undefined) {
  if (!isSuppliedEnvironmentValue(value)) return false
  if (name === "REDIS_URL") return isValidRedisConnection(value)
  return true
}

export function getMissingProductionEnvironmentVariables(environment: Record<string, string | undefined> = process.env) {
  return productionRequiredEnvironmentVariables.filter((name) => !isValidProductionEnvironmentValue(name, environment[name]));
}

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value || !isValidProductionEnvironmentValue(name, value)) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function requiredInProduction(name: string) {
  const value = process.env[name]?.trim()
  if (process.env.NODE_ENV === "production" && !isValidProductionEnvironmentValue(name, value)) {
    throw new Error(`Missing required production environment variable: ${name}`)
  }
  return value
}

export function isBuildPhase() {
  return Boolean(
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_BUILD === "true" ||
    process.env.IS_BUILD === "true" ||
    (typeof process.argv !== "undefined" &&
      process.argv.some((arg) => typeof arg === "string" && (arg.includes("build") || arg.includes("next"))))
  )
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return
  if (isBuildPhase()) return
  for (const name of productionRequiredEnvironmentVariables) requiredEnv(name)
}
