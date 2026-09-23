import { cookies, headers } from "next/headers"
import { getUserFromSessionToken } from "@/modules/auth/services/auth.service"

export type AdminSession = {
  id: string
  email: string
  name: string
  role: "ADMIN"
}

async function extractToken(request?: unknown): Promise<string | undefined> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get("access_token")?.value || cookieStore.get("token")?.value
  if (cookieToken) return cookieToken

  if (request && typeof request === "object" && "headers" in request && typeof (request as { headers: Headers }).headers?.get === "function") {
    const authHeader = (request as { headers: Headers }).headers.get("authorization")
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, "").trim() || undefined
    }
  }

  try {
    const headerStore = await headers()
    const authHeader = headerStore.get("authorization")
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, "").trim() || undefined
    }
  } catch {}

  return undefined
}

export async function requireAdmin(request?: unknown): Promise<AdminSession> {
  const token = await extractToken(request)
  if (token) {
    const user = await getUserFromSessionToken(token)
    if (user?.role === "ADMIN") {
      return {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: "ADMIN",
      }
    }
  }

  throw Object.assign(new Error("Admin access required"), { statusCode: 403 })
}
