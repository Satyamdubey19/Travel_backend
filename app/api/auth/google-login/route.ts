import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { createSessionToken, handleGoogleAuth } from "@/modules/auth/services/auth.service"

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const appUrl = getAppUrl()

  if (!session?.user?.email) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const user = await handleGoogleAuth({
    email: session.user.email,
    name: session.user.name,
    providerId: session.user.id,
  })

  const response = NextResponse.redirect(appUrl)
  response.cookies.set("token", createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })

  return response
}
