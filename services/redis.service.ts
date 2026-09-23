import { getRedisClient } from "@/lib/redis"

type RefreshTokenRecord = {
  userId: string
  deviceId?: string
  deviceName?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

const refreshPrefix = "gethotels:auth:refresh"
const emailVerifyPrefix = "gethotels:auth:email-verify"
const devicePrefix = "auth:device"

function isRedisReady(redis: ReturnType<typeof getRedisClient>): boolean {
  if (!redis) return false
  return redis.status === "ready" || redis.status === "connect"
}

export async function setEmailVerificationToken(email: string, tokenHash: string, ttlSeconds: number): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    await redis.set(`${emailVerifyPrefix}:${email}`, tokenHash, "EX", ttlSeconds)
    return true
  } catch {
    return false
  }
}

export async function getEmailVerificationToken(email: string): Promise<string | null> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return null

    return await redis.get(`${emailVerifyPrefix}:${email}`)
  } catch {
    return null
  }
}

export async function deleteEmailVerificationToken(email: string): Promise<void> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return

    await redis.del(`${emailVerifyPrefix}:${email}`)
  } catch {
    // Non-fatal cache invalidation failure
  }
}

export async function storeRefreshToken(tokenHash: string, record: RefreshTokenRecord, ttlSeconds: number): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    await redis.set(`${refreshPrefix}:${tokenHash}`, JSON.stringify(record), "EX", ttlSeconds)
    await redis.sadd(`${refreshPrefix}:user:${record.userId}`, tokenHash)
    await redis.expire(`${refreshPrefix}:user:${record.userId}`, ttlSeconds)
    return true
  } catch {
    return false
  }
}

export async function storeActiveDeviceSession(userId: string, deviceId: string, ttlSeconds: number): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    await redis.set(`${devicePrefix}:${userId}:${deviceId}`, "active", "EX", ttlSeconds)
    return true
  } catch {
    return false
  }
}

export async function deleteActiveDeviceSession(userId: string, deviceId: string): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    await redis.del(`${devicePrefix}:${userId}:${deviceId}`)
    return true
  } catch {
    return false
  }
}

export async function deleteUserActiveDeviceSessions(userId: string): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    const keys = await redis.keys(`${devicePrefix}:${userId}:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return true
  } catch {
    return false
  }
}

export async function deleteRefreshToken(tokenHash: string): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    const key = `${refreshPrefix}:${tokenHash}`
    const rawRecord = await redis.get(key)
    if (rawRecord) {
      const record = JSON.parse(rawRecord) as RefreshTokenRecord
      await redis.srem(`${refreshPrefix}:user:${record.userId}`, tokenHash)
    }

    await redis.del(key)
    return true
  } catch {
    return false
  }
}

export async function deleteUserRefreshTokens(userId: string): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis || !isRedisReady(redis)) return false

    const userKey = `${refreshPrefix}:user:${userId}`
    const tokenHashes = await redis.smembers(userKey)
    if (tokenHashes.length > 0) {
      await redis.del(...tokenHashes.map((tokenHash) => `${refreshPrefix}:${tokenHash}`))
    }
    await redis.del(userKey)
    return true
  } catch {
    return false
  }
}
