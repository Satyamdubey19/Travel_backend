import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

type SessionRole = "USER" | "HOST" | "ADMIN";

type AuthSession = {
  id?: string;
  role?: SessionRole;
  isHost?: boolean;
};

const publicPaths = new Set([
  "/login",
  "/signup",
  "/host/signup",
]);

const userOnlyPaths = ["/profile", "/wishlist"];

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifyCustomJwt(token: string): Promise<AuthSession | null> {
  try {
    const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) return null;

    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedHeader))) as { alg?: string };
    if (header.alg !== "HS256") return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (bytesToBase64Url(new Uint8Array(signed)) !== signature) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as {
      id?: number | string;
      role?: SessionRole;
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return {
      id: payload.id ? String(payload.id) : undefined,
      role: payload.role,
      isHost: payload.role === "HOST",
    };
  } catch {
    return null;
  }
}

async function getAuthSession(req: NextRequest): Promise<AuthSession | null> {
  const nextAuthToken = await getToken({ req }).catch(() => null);
  const customTokenValue = req.cookies.get("token")?.value;
  const customSession = customTokenValue ? await verifyCustomJwt(customTokenValue) : null;

  if (customSession) {
    return customSession;
  }

  if (nextAuthToken) {
    return {
      id: nextAuthToken.id ? String(nextAuthToken.id) : undefined,
      role: nextAuthToken.role as SessionRole | undefined,
      isHost: nextAuthToken.isHost === true,
    };
  }

  return customSession;
}

function redirectToLogin(req: NextRequest, role?: SessionRole) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  if (role) {
    url.searchParams.set("role", role);
  }
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  if (publicPaths.has(path)) {
    return NextResponse.next();
  }

  const session = await getAuthSession(req);

  if (!session) {
    if (path.startsWith("/admin")) return redirectToLogin(req, "ADMIN");
    if (path === "/host" || path.startsWith("/host/")) return redirectToLogin(req, "HOST");
    return redirectToLogin(req);
  }

  if (path.startsWith("/admin") && session.role !== "ADMIN") {
    return redirectToLogin(req, "ADMIN");
  }

  if ((path === "/host" || path.startsWith("/host/")) && session.role !== "HOST" && session.isHost !== true) {
    return redirectToLogin(req, "HOST");
  }

  if (userOnlyPaths.some((protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}/`))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/host", "/host/:path*", "/profile", "/profile/:path*", "/wishlist", "/wishlist/:path*"],
};
