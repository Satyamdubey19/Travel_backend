import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible"
import { getRedisClient } from "@/lib/redis"

const redisLimiters = new Map<string, RateLimiterRedis>()
const memoryLimiters = new Map<string, RateLimiterMemory>()

type RateLimitError = Error & { statusCode?: number; code?: string }

export function isRateLimitExceeded(error: unknown) {
  return typeof error === "object" && error !== null && "msBeforeNext" in error
}

function rateLimitExceededError() {
  const error = new Error("Too many requests. Please try again later.") as RateLimitError
  error.statusCode = 429
  return error
}

function rateLimitUnavailableError() {
  const error = new Error("Rate limit service is temporarily unavailable. Please try again shortly.") as RateLimitError
  error.statusCode = 503
  error.code = "RATE_LIMIT_UNAVAILABLE"
  return error
}

function memoryLimiter(limiterKey: string, points: number, duration: number) {
  let limiter = memoryLimiters.get(limiterKey)
  if (!limiter) {
    limiter = new RateLimiterMemory({ points, duration })
    memoryLimiters.set(limiterKey, limiter)
  }
  return limiter
}

async function consumeMemoryLimit(limiterKey: string, key: string, points: number, duration: number) {
  try {
    await memoryLimiter(limiterKey, points, duration).consume(key)
  } catch (error) {
    if (isRateLimitExceeded(error)) throw rateLimitExceededError()
    throw rateLimitUnavailableError()
  }
}

export async function assertRateLimit(key: string, points = 20, duration = 60) {
  const limiterKey = `${points}:${duration}`
  const redis = getRedisClient()
  if (!redis) {
    await consumeMemoryLimit(limiterKey, key, points, duration)
    return
  }

  let limiter = redisLimiters.get(limiterKey)
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "gethotels:rate-limit",
      points,
      duration,
    })
    redisLimiters.set(limiterKey, limiter)
  }

  try {
    await limiter.consume(key)
  } catch (error) {
    if (isRateLimitExceeded(error)) throw rateLimitExceededError()

    // A configured-but-unreachable Redis instance must never masquerade as a
    // client throttle. Launch builds fail closed; local development can still
    // run with the intentionally supported per-process limiter.
    redisLimiters.delete(limiterKey)
    if (process.env.NODE_ENV === "production") {
      throw rateLimitUnavailableError()
    }
    await consumeMemoryLimit(limiterKey, key, points, duration)
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous"
}
