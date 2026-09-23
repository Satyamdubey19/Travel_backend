
import IORedis from "ioredis"

type RedisGlobal = typeof globalThis & {
  getHotelsRedis?: IORedis
}

const redisGlobal = globalThis as RedisGlobal

export function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) return null

  let parsed: URL
  try {
    parsed = new URL(redisUrl)
  } catch {
    if (process.env.NODE_ENV === "production") throw new Error("REDIS_URL must be a valid redis connection string")
    return null
  }

  if ((parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") || !parsed.hostname) {
    if (process.env.NODE_ENV === "production") throw new Error("REDIS_URL must use redis:// or rediss://")
    return null
  }

  if (!redisGlobal.getHotelsRedis) {
    let hasLoggedError = false
    redisGlobal.getHotelsRedis = new IORedis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) return null // Stop reconnecting when Redis is unavailable
        return Math.min(times * 100, 500)
      },
    })

    redisGlobal.getHotelsRedis.on("error", (error) => {
      if (!hasLoggedError) {
        hasLoggedError = true
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Redis] Optional local cache unavailable; falling back to primary database storage.")
        } else {
          console.error("Redis connection error:", error.message)
        }
      }
    })
  }

  return redisGlobal.getHotelsRedis
}
