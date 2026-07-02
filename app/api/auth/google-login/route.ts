import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { createAuthSessionForUser, DeviceLimitReachedError, handleGoogleAuth } from "@/modules/auth/services/auth.service"

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000"
}

function parseBrowser(userAgent?: string) {
  const value = userAgent || ""
  if (value.includes("Edg/")) return "Edge"
  if (value.includes("Chrome/")) return "Chrome"
  if (value.includes("Safari/") && !value.includes("Chrome/")) return "Safari"
  if (value.includes("Firefox/")) return "Firefox"
  return "Unknown"
}

function parseOs(userAgent?: string) {
  const value = userAgent || ""
  if (value.includes("Windows")) return "Windows"
  if (value.includes("Mac OS X")) return "macOS"
  if (value.includes("Android")) return "Android"
  if (value.includes("iPhone") || value.includes("iPad")) return "iOS"
  if (value.includes("Linux")) return "Linux"
  return "Unknown"
}

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous"
}

function getDeviceInfo(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? undefined
  const browser = parseBrowser(userAgent)
  const os = parseOs(userAgent)
  const deviceId = request.headers.get("x-device-id")?.trim() || request.cookies.get("deviceId")?.value || crypto.randomUUID()

  return {
    deviceId,
    deviceName: request.headers.get("x-device-name") ?? `${browser} ${os}`,
    browser,
    os,
    ipAddress: clientIp(request),
    userAgent,
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const appUrl = getAppUrl()

  if (!session?.user?.email) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const deviceInfo = getDeviceInfo(request)
  let user
  let token
  let refreshToken
  try {
    user = await handleGoogleAuth({
      email: session.user.email,
      name: session.user.name,
      providerId: session.user.id,
    })
    const auth = await createAuthSessionForUser(user, deviceInfo)
    token = auth.token
    refreshToken = auth.refreshToken
  } catch (error) {
    if (error instanceof DeviceLimitReachedError) {
      return NextResponse.redirect(`${appUrl}/login?error=DEVICE_LIMIT_REACHED`)
    }
    throw error
  }

  const response = NextResponse.redirect(appUrl)
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  response.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set("deviceId", deviceInfo.deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}
