import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { deleteActiveDeviceSession } from "@/services/redis.service";
import { clearSsoAuthCookies, getAppUrl } from "@/modules/sso/utils/sso-http";

interface JwtPayload {
  userId?: string;
  id?: string;
  email?: string;
  organizationId?: string;
  deviceId?: string;
  sso?: boolean;
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

async function handleLogout(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const deviceId =
    request.cookies.get("deviceId")?.value ||
    request.headers.get("x-device-id");

  let idpLogoutUrl: string | null = null;

  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || "travels_pro_jwt_secret";
      const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;

      const userId = payload.userId || payload.id;
      const targetDeviceId = payload.deviceId || deviceId;

      if (userId && targetDeviceId) {
        await deleteActiveDeviceSession(userId, targetDeviceId);
      }

      // Check for IdP Single Logout URL
      if (payload.organizationId) {
        const config = await prisma.ssoConfiguration.findUnique({
          where: { organizationId: payload.organizationId },
        });
        if (config?.logoutUrl) {
          idpLogoutUrl = config.logoutUrl;
        }
      }
    } catch {
      // Ignore token decode errors on logout
    }
  }

  const isApiRequest =
    request.headers.get("accept")?.includes("application/json") &&
    request.method === "POST";

  if (isApiRequest) {
    const response = NextResponse.json({
      success: true,
      message: "SSO session successfully terminated",
      idpLogoutUrl,
    });
    clearSsoAuthCookies(response);
    return response;
  }

  // Browser redirect flow
  const targetRedirect = idpLogoutUrl || `${appUrl}/login?logout=success`;
  const response = NextResponse.redirect(new URL(targetRedirect, appUrl));
  clearSsoAuthCookies(response);
  return response;
}
