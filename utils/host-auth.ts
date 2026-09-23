import { cookies, headers } from "next/headers"
import { getAuthUserById, getUserFromSessionToken } from "@/modules/auth/services/auth.service"
import { getHostByUserId } from "@/modules/host/services/host.service"

async function extractToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get("token")?.value
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

export async function requireHostApplicant() {
  const token = await extractToken()
  const sessionUser = token ? await getUserFromSessionToken(token) : null
  const userId = sessionUser?.id
  const user = userId ? await getAuthUserById(userId) : null
  if (!user) throw Object.assign(new Error("Authentication required"), { statusCode: 401 })
  const host = await getHostByUserId(String(user.id))
  if (!host) throw Object.assign(new Error("Host application required"), { statusCode: 403 })
  return { user, host }
}

export async function requireHost() {
  const token = await extractToken()
  const sessionUser = token ? await getUserFromSessionToken(token) : null
  const userId = sessionUser?.id
  const user = userId ? await getAuthUserById(userId) : null
  if (!user) throw Object.assign(new Error("Authentication required"), { statusCode: 401 })
  if (user.role !== "HOST") throw Object.assign(new Error("Approved host access required"), { statusCode: 403 })

  const host = await getHostByUserId(String(user.id))
  if (!host || !host.isActive || !host.isApproved || !host.isVerified) {
    throw Object.assign(new Error("Your host application is not approved"), { statusCode: 403 })
  }
  return { user, host }
}
