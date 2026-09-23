import { getServerSession } from "next-auth"
import { getToken, type GetTokenParams } from "next-auth/jwt"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuthSessionForUser, DeviceLimitReachedError, handleGoogleAuth, logoutUserDevice, maxActiveDevices } from "@/modules/auth/services/auth.service"
import { authLoginRecoveryPath, safeAuthCallbackPath } from "@/modules/auth/services/auth-redirect"

function getAppUrl(request: NextRequest) {
  const configuredFrontend = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configuredFrontend) {
    try {
      return new URL(configuredFrontend).origin
    } catch {}
  }
  const configured = process.env.NEXTAUTH_URL
  if (configured && !configured.includes("onrender.com")) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  // Check forwarded host from Vercel proxy
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  if (forwardedHost && !forwardedHost.includes("onrender.com")) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return "https://rootly-mu.vercel.app"
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

function clearNextAuthHandoff(response: NextResponse) {
  for (const name of ["next-auth.session-token", "__Secure-next-auth.session-token"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: name.startsWith("__Secure-"),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request)
  const callbackPath = safeAuthCallbackPath(request.nextUrl.searchParams.get("callbackUrl"))

  try {
    const session = await getServerSession(authOptions).catch(() => null)
    let userEmail = session?.user?.email
    let userName = session?.user?.name
    let userId = session?.user?.id

    if (!userEmail) {
      const secret = (authOptions.secret as string) || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
      if (secret) {
        const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"
        const jwtToken = await getToken({
          req: request as unknown as GetTokenParams["req"],
          secret,
          secureCookie: isHttps,
        }).catch(() => null)

        if (jwtToken?.email) {
          userEmail = jwtToken.email as string
          userName = (jwtToken.name as string) || undefined
          userId = (jwtToken.id as string) || (jwtToken.sub as string) || undefined
        }
      }
    }

    if (!userEmail) {
      console.warn("Google authentication handoff: No valid session or token found")
      return NextResponse.redirect(new URL(authLoginRecoveryPath(callbackPath, "GOOGLE_SIGNIN_FAILED"), appUrl))
    }

    const deviceInfo = getDeviceInfo(request)
    const user = await handleGoogleAuth({
      email: userEmail,
      name: userName,
      providerId: userId,
    })

    let auth
    try {
      auth = await createAuthSessionForUser(user, deviceInfo)
    } catch (error) {
      console.log("[OAuth Handoff] Caught session error:", error instanceof Error ? error.name : "Unknown", "isDeviceLimit:", error instanceof DeviceLimitReachedError)
      if (error instanceof DeviceLimitReachedError) {
        console.log("[OAuth Handoff] Auto-evicting excess devices for user:", user.id)
        const activeDevices = await prisma.userDevice.findMany({
          where: { userId: user.id, isActive: true },
          orderBy: { lastSeenAt: "asc" },
        })
        const toEvictCount = Math.max(1, activeDevices.length - maxActiveDevices + 1)
        const devicesToEvict = activeDevices.slice(0, toEvictCount)
        console.log("[OAuth Handoff] Evicting", devicesToEvict.length, "devices:", devicesToEvict.map(d => d.deviceId))
        for (const dev of devicesToEvict) {
          await logoutUserDevice(user.id, dev.deviceId, deviceInfo, "DEVICE_REPLACED").catch((err) => {
            console.error("Failed to evict device:", dev.deviceId, err)
          })
        }
        auth = await createAuthSessionForUser(user, deviceInfo)
        console.log("[OAuth Handoff] Successfully renewed session after eviction")
      } else {
        throw error
      }
    }

    const response = NextResponse.redirect(new URL(callbackPath, appUrl))
    response.cookies.set("token", auth.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    })
    response.cookies.set("refreshToken", auth.refreshToken, {
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
    clearNextAuthHandoff(response)

    return response
  } catch (error) {
    if (error instanceof DeviceLimitReachedError) {
      return NextResponse.redirect(new URL(authLoginRecoveryPath(callbackPath, "DEVICE_LIMIT_REACHED"), appUrl))
    }
    const name = error instanceof Error ? error.name : "UnknownError"
    console.error("Google authentication handoff failed", { name })
    return NextResponse.redirect(new URL(authLoginRecoveryPath(callbackPath, "GOOGLE_SIGNIN_FAILED"), appUrl))
  }
}
