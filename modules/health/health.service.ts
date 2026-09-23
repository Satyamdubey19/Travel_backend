import { prisma } from "@/lib/prisma"
import { getRedisClient } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { readinessOutcome, type DependencyState } from "@/modules/health/health-policy"
import { isAuthSchemaReady, type AuthSchemaState } from "@/modules/health/auth-schema-policy"
import { isAuthEmailDeliveryConfigured } from "@/lib/auth-email-policy"

const CHECK_TIMEOUT_MS = 2_000

async function boundedCheck(check: () => Promise<unknown>): Promise<DependencyState> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("dependency check timed out")), CHECK_TIMEOUT_MS)
      }),
    ])
    return "ok"
  } catch {
    return "unavailable"
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function getAuthSchemaState(): Promise<DependencyState> {
  const rows = await prisma.$queryRaw<AuthSchemaState[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'tokenHash'
      ) AS "refreshTokenHash",
      to_regclass('public."PasswordResetToken"') IS NOT NULL AS "passwordResetTokenTable",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'PasswordResetToken' AND column_name = 'tokenHash'
      ) AS "passwordResetTokenHash",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'deviceId'
      ) AS "sessionDeviceId",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserDevice' AND column_name = 'refreshTokenHash'
      ) AS "userDeviceRefreshTokenHash",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'sessionInvalidatedAt'
      ) AS "userSessionInvalidatedAt",
      to_regclass('public."EmailChangeRequest"') IS NOT NULL AS "emailChangeRequestTable",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'EmailChangeRequest' AND column_name = 'otpHash'
      ) AS "emailChangeRequestHash",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EmailChangeRequest'
          AND column_name IN ('id', 'userId', 'oldEmail', 'newEmail', 'otpHash', 'expiresAt', 'createdAt')
      ) = 7 AS "emailChangeRequestComplete"
  `;
  return isAuthSchemaReady(rows[0]) ? "ok" : "unavailable";
}

export async function getReadiness() {
  const startedAt = Date.now()
  const redis = getRedisClient()
  const [databaseState, redisState, authSchemaState] = await Promise.all([
    boundedCheck(() => prisma.$queryRaw`SELECT 1`),
    redis ? boundedCheck(() => redis.ping()) : Promise.resolve("not_configured" as const),
    boundedCheck(getAuthSchemaState),
  ])
  const authEmailConfiguration: DependencyState = isAuthEmailDeliveryConfigured() ? "ok" : "not_configured"
  const outcome = readinessOutcome(databaseState, redisState, process.env.NODE_ENV === "production", authSchemaState, authEmailConfiguration)
  const response = {
    ...outcome,
    service: "travels-backend",
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    dependencies: {
      database: databaseState,
      redis: redisState,
      authSchema: authSchemaState,
      // This verifies required mail configuration only. It intentionally does
      // not attempt to send an email from a public health endpoint.
      authEmailConfig: authEmailConfiguration,
    },
  }

  if (!outcome.ready) logger.warn({ event: "readiness_failed", dependencies: response.dependencies, durationMs: response.durationMs })
  return response
}
