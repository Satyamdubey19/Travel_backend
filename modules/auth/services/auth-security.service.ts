import { NextRequest } from "next/server";
import { getRedisClient } from "@/lib/redis";
import crypto from "crypto";

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateStore = new Map<string, RateEntry>();
const revokedTokens = new Map<string, number>();
const userInvalidatedAfter = new Map<string, number>();

const defaultWindowMs = 60 * 1000;
const defaultTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

const MAX_RATE_ENTRIES = 10000;

function cleanupRateStore(currentTime: number) {
  for (const [key, entry] of rateStore) {
    if (entry.resetAt <= currentTime) {
      rateStore.delete(key);
    }
  }
  if (rateStore.size > MAX_RATE_ENTRIES) {
    const keys = Array.from(rateStore.keys()).slice(0, Math.floor(MAX_RATE_ENTRIES * 0.2));
    for (const key of keys) {
      rateStore.delete(key);
    }
  }
}

function cleanupRevokedTokens(currentTime: number) {
  for (const [token, expiresAt] of revokedTokens) {
    if (expiresAt <= currentTime) {
      revokedTokens.delete(token);
    }
  }
}

export function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function assertRateLimit(key: string, limit: number, windowMs = defaultWindowMs) {
  const currentTime = now();
  cleanupRateStore(currentTime);

  const existing = rateStore.get(key);
  if (!existing || existing.resetAt <= currentTime) {
    rateStore.set(key, { count: 1, resetAt: currentTime + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const error = new Error("Too many requests. Please try again later.") as Error & { statusCode?: number };
    error.statusCode = 429;
    throw error;
  }
}

export function assertTrustedOrigin(request: NextRequest) {
  if (request.headers.get("authorization")?.startsWith("Bearer ")) {
    return;
  }

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  let requestOrigin = "";
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  if (requestOrigin === request.nextUrl.origin) {
    return;
  }

  const allowedOrigins = [
    request.nextUrl.origin,
    process.env.NEXTAUTH_URL,
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:4000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });

  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(requestOrigin);
      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.startsWith("192.168.") ||
        url.hostname.startsWith("10.") ||
        url.hostname.endsWith(".local")
      ) {
        return;
      }
    } catch {
      // proceed to strict check
    }
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

export function revokeToken(token: string, expiresAtMs?: number) {
  cleanupRevokedTokens(now());
  revokedTokens.set(token, expiresAtMs ?? now() + defaultTokenTtlMs);
  const expiry = expiresAtMs ?? now() + defaultTokenTtlMs;
  revokedTokens.set(token, expiry);

  try {
    const redis = getRedisClient();
    if (redis && (redis.status === "ready" || redis.status === "connect")) {
      const ttlSeconds = Math.max(1, Math.ceil((expiry - now()) / 1000));
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      redis.set(`auth:revoked:${tokenHash}`, "1", "EX", ttlSeconds).catch(() => null);
    }
  } catch {
    // Non-fatal fallback
  }
}

export function isTokenRevoked(token: string) {
  cleanupRevokedTokens(now());
  return revokedTokens.has(token);
}

export function invalidateUserSessions(userId: string) {
  userInvalidatedAfter.set(userId, Math.floor(now() / 1000));
  const ts = Math.floor(now() / 1000);
  userInvalidatedAfter.set(userId, ts);

  try {
    const redis = getRedisClient();
    if (redis && (redis.status === "ready" || redis.status === "connect")) {
      redis.set(`auth:user-invalidated:${userId}`, String(ts), "EX", 30 * 24 * 60 * 60).catch(() => null);
    }
  } catch {
    // Non-fatal fallback
  }
}

export function isUserSessionInvalidated(userId: string, issuedAt?: number) {
  const invalidatedAfter = userInvalidatedAfter.get(userId);
  if (!invalidatedAfter || !issuedAt) {
    return false;
  }

  return issuedAt <= invalidatedAfter;
}
