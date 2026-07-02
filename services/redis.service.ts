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

export async function setEmailVerificationToken(email: string, tokenHash: string, ttlSeconds: number) {
  const redis = getRedisClient()
  if (!redis) return false

  await redis.set(`${emailVerifyPrefix}:${email}`, tokenHash, "EX", ttlSeconds)
  return true
}

export async function getEmailVerificationToken(email: string) {
  const redis = getRedisClient()
  if (!redis) return null

  return redis.get(`${emailVerifyPrefix}:${email}`)
}

export async function deleteEmailVerificationToken(email: string) {
  const redis = getRedisClient()
  if (!redis) return

  await redis.del(`${emailVerifyPrefix}:${email}`)
}

export async function storeRefreshToken(tokenHash: string, record: RefreshTokenRecord, ttlSeconds: number) {
  const redis = getRedisClient()
  if (!redis) return false

  await redis.set(`${refreshPrefix}:${tokenHash}`, JSON.stringify(record), "EX", ttlSeconds)
  await redis.sadd(`${refreshPrefix}:user:${record.userId}`, tokenHash)
  await redis.expire(`${refreshPrefix}:user:${record.userId}`, ttlSeconds)
  return true
}

export async function storeActiveDeviceSession(userId: string, deviceId: string, ttlSeconds: number) {
  const redis = getRedisClient()
  if (!redis) return false

  await redis.set(`${devicePrefix}:${userId}:${deviceId}`, "active", "EX", ttlSeconds)
  return true
}

export async function deleteActiveDeviceSession(userId: string, deviceId: string) {
  const redis = getRedisClient()
  if (!redis) return false

  await redis.del(`${devicePrefix}:${userId}:${deviceId}`)
  return true
}

export async function deleteUserActiveDeviceSessions(userId: string) {
  const redis = getRedisClient()
  if (!redis) return false

  const keys = await redis.keys(`${devicePrefix}:${userId}:*`)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
  return true
}

export async function deleteRefreshToken(tokenHash: string) {
  const redis = getRedisClient()
  if (!redis) return false

  const key = `${refreshPrefix}:${tokenHash}`
  const rawRecord = await redis.get(key)
  if (rawRecord) {
    const record = JSON.parse(rawRecord) as RefreshTokenRecord
    await redis.srem(`${refreshPrefix}:user:${record.userId}`, tokenHash)
  }

  await redis.del(key)
  return true
}

export async function deleteUserRefreshTokens(userId: string) {
  const redis = getRedisClient()
  if (!redis) return false

  const userKey = `${refreshPrefix}:user:${userId}`
  const tokenHashes = await redis.smembers(userKey)
  if (tokenHashes.length > 0) {
    await redis.del(...tokenHashes.map((tokenHash) => `${refreshPrefix}:${tokenHash}`))
  }
  await redis.del(userKey)
  return true
}
