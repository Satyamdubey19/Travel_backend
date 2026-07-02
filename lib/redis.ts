
import IORedis from "ioredis"

type RedisGlobal = typeof globalThis & {
  getHotelsRedis?: IORedis
}

const redisGlobal = globalThis as RedisGlobal

export function getRedisClient() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null

  if (!redisGlobal.getHotelsRedis) {
    redisGlobal.getHotelsRedis = new IORedis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    })

    redisGlobal.getHotelsRedis.on("error", (error) => {
      console.error("Redis connection error:", error.message)
    })
  }

  return redisGlobal.getHotelsRedis
}
