import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible"
import { getRedisClient } from "@/lib/redis"

const limiters = new Map<string, RateLimiterMemory | RateLimiterRedis>()

export async function assertRateLimit(key: string, points = 20, duration = 60) {
  const limiterKey = `${points}:${duration}`
  let limiter = limiters.get(limiterKey)
  if (!limiter) {
    const redis = getRedisClient()
    limiter = redis
      ? new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: "gethotels:rate-limit",
          points,
          duration,
        })
      : new RateLimiterMemory({ points, duration })
    limiters.set(limiterKey, limiter)
  }
  try {
    await limiter.consume(key)
  } catch {
    const error = new Error("Too many requests. Please try again later.") as Error & { statusCode?: number }
    error.statusCode = 429
    throw error
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous"
}
