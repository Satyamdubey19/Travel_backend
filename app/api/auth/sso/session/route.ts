import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  validateSsoSession,
  touchSsoSession,
} from "@/modules/sso/services/sso-auth.service";
import { clearSsoAuthCookies } from "@/modules/sso/utils/sso-http";

interface JwtPayload {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  organizationId?: string;
  deviceId?: string;
  sso?: boolean;
}

export async function GET(request: NextRequest) {
  return handleSessionCheck(request);
}

export async function POST(request: NextRequest) {
  return handleSessionCheck(request);
}

async function handleSessionCheck(request: NextRequest) {
  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const deviceId =
    request.cookies.get("deviceId")?.value ||
    request.headers.get("x-device-id");

  if (!token) {
    return NextResponse.json(
      { active: false, error: "UNAUTHORIZED", message: "No active authentication token found." },
      { status: 401 }
    );
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "travels_pro_jwt_secret";
    const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
    const userId = payload.userId || payload.id;
    const targetDeviceId = payload.deviceId || deviceId;

    if (!userId) {
      return NextResponse.json(
        { active: false, error: "INVALID_TOKEN", message: "Token does not contain a valid user identity." },
        { status: 401 }
      );
    }

    // SSO Sliding Session Inactivity Enforcement
    if (payload.sso) {
      if (!targetDeviceId) {
        return NextResponse.json(
          { active: false, error: "MISSING_DEVICE", message: "Device identifier is required for SSO sessions." },
          { status: 401 }
        );
      }

      const check = await validateSsoSession(userId, targetDeviceId);
      if (!check.valid) {
        const response = NextResponse.json(
          {
            active: false,
            error: "SESSION_TIMEOUT",
            message: "Your corporate SSO session has expired due to inactivity. Please log in again.",
          },
          { status: 401 }
        );
        clearSsoAuthCookies(response);
        return response;
      }

      // Touch sliding window on valid active activity
      await touchSsoSession(userId, targetDeviceId);
    }

    return NextResponse.json({
      active: true,
      user: {
        id: userId,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
        sso: Boolean(payload.sso),
      },
    });
  } catch {
    const response = NextResponse.json(
      { active: false, error: "TOKEN_EXPIRED", message: "Session token is invalid or expired." },
      { status: 401 }
    );
    clearSsoAuthCookies(response);
    return response;
  }
}

