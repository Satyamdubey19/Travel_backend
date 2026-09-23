import { cookies, headers } from "next/headers"
import { getUserFromSessionToken } from "@/modules/auth/services/auth.service"

async function extractToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get("access_token")?.value || cookieStore.get("token")?.value
  if (cookieToken) return cookieToken

  try {
    const headerStore = await headers()
    const authHeader = headerStore.get("authorization")
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, "").trim() || undefined
    }
  } catch {}

  return undefined
}

export async function requireUser() {
  const token = await extractToken()
  const customUser = token ? await getUserFromSessionToken(token) : null
  if (customUser) return customUser
  throw Object.assign(new Error("Authentication required"), { statusCode: 401 })
}

export async function currentUserId() {
  try { return String((await requireUser()).id) } catch { return null }
}
