import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAuthUserById, getUserFromSessionToken } from "@/modules/auth/services/auth.service"

export type AdminSession = {
  id: string
  email: string
  name: string
  role: "ADMIN"
}

export async function requireAdmin(request?: unknown): Promise<AdminSession> {
  void request
  const token = (await cookies()).get("token")?.value
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

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const user = await getAuthUserById(session.user.id)
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
