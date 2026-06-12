import { RateLimiterMemory } from "rate-limiter-flexible"

const limiters = new Map<string, RateLimiterMemory>()

export async function assertRateLimit(key: string, points = 20, duration = 60) {
  const limiterKey = `${points}:${duration}`
  let limiter = limiters.get(limiterKey)
  if (!limiter) {
    limiter = new RateLimiterMemory({ points, duration })
    limiters.set(limiterKey, limiter)
  }
  await limiter.consume(key)
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous"
}
