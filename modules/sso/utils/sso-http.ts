import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STATE_SECRET = process.env.JWT_SECRET || "travels_pro_sso_state_secret";

export function getAppUrl(request: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {}
  }
  return request.nextUrl.origin;
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Creates an HMAC-signed tamper-evident state token for OIDC/SAML redirects.
 */
export function createStateToken(payload: Record<string, unknown>, ttlSeconds = 600): string {
  const data = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const jsonStr = JSON.stringify(data);
  const base64Data = Buffer.from(jsonStr, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(base64Data)
    .digest("base64url");

  return `${base64Data}.${signature}`;
}

/**
 * Validates and unpacks an HMAC-signed state token.
 */
export function verifyStateToken<T = Record<string, unknown>>(token?: string | null): T | null {
  if (!token || !token.includes(".")) return null;

  const [base64Data, signature] = token.split(".");
  if (!base64Data || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(base64Data)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const raw = Buffer.from(base64Data, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Sets standardized authentication and session cookies for SSO.
 */
export function setSsoAuthCookies(
  response: NextResponse,
  auth: {
    sessionToken: string;
    refreshToken: string;
    deviceId: string;
    inactivityTimeoutMinutes: number;
  }
) {
  const isProd = process.env.NODE_ENV === "production";
  const sessionMaxAge = auth.inactivityTimeoutMinutes * 60;
  const refreshMaxAge = 60 * 60 * 24 * 7; // 7 days

  response.cookies.set("token", auth.sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });

  response.cookies.set("refreshToken", auth.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });

  response.cookies.set("deviceId", auth.deviceId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

/**
 * Clears authentication cookies upon SSO logout or session expiration.
 */
export function clearSsoAuthCookies(response: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  for (const name of ["token", "refreshToken", "deviceId", "sso_state"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

