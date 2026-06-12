import { NextRequest } from "next/server";

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

function cleanupRateStore(currentTime: number) {
  for (const [key, entry] of rateStore) {
    if (entry.resetAt <= currentTime) {
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
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) {
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:4000",
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

  let requestOrigin = "";
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
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
}

export function isTokenRevoked(token: string) {
  cleanupRevokedTokens(now());
  return revokedTokens.has(token);
}

export function invalidateUserSessions(userId: string) {
  userInvalidatedAfter.set(userId, Math.floor(now() / 1000));
}

export function isUserSessionInvalidated(userId: string, issuedAt?: number) {
  const invalidatedAfter = userInvalidatedAfter.get(userId);
  if (!invalidatedAfter || !issuedAt) {
    return false;
  }

  return issuedAt <= invalidatedAfter;
}
