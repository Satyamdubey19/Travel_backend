const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function isTrustedMutationOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true
  const supplied = request.headers.get("origin") ?? request.headers.get("referer")
  if (!supplied) return false
  let origin: string
  try { origin = new URL(supplied).origin } catch { return false }

  // Trust requests where origin matches the reverse proxy host (e.g. Vercel)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  if (forwardedHost) {
    try {
      const fOrigin = new URL(`${forwardedProto}://${forwardedHost}`).origin
      if (origin === fOrigin) return true
    } catch {}
  }

  // Trust any deployment on Vercel for this app
  try {
    const originHostname = new URL(origin).hostname
    if (originHostname.endsWith(".vercel.app")) return true
  } catch {}

  const allowed = [
    new URL(request.url).origin,
    process.env.NEXTAUTH_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    "https://rootly-mu.vercel.app",
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:4000", "http://127.0.0.1:3000", "http://127.0.0.1:4000"] : []),
  ]
    .filter(Boolean)
    .flatMap(value => String(value).split(","))
    .map(value => { try { return new URL(value.trim()).origin } catch { return "" } })
  return allowed.includes(origin)
}

export function isCsrfExemptPath(pathname: string) {
  return pathname.startsWith("/api/auth/callback/") || pathname.startsWith("/api/auth/signin/") || pathname === "/api/auth/csrf" || pathname.startsWith("/api/cron/") || pathname.startsWith("/api/webhooks/")
}

/**
 * NextAuth's discovery, session, CSRF, and OAuth handoff endpoints are public
 * framework endpoints. They must reach NextAuth before a first-party session
 * exists, but they do not authorize access to application data or pages.
 */
export function isPublicAuthEndpoint(pathname: string) {
  return pathname === "/api/auth/providers"
    || pathname === "/api/auth/session"
    || pathname === "/api/auth/csrf"
    || pathname === "/api/auth/signin"
    || pathname.startsWith("/api/auth/signin/")
    || pathname === "/api/auth/signout"
    || pathname.startsWith("/api/auth/callback/")
    || pathname === "/api/auth/google-login"
    || pathname === "/api/auth/verify"
}
