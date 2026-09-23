import {
  createSessionToken,
  getActiveSessionId,
  ChangePassword,
  ConfirmEmailChange,
  DeviceLimitReachedError,
  getUserFromSessionToken,
  listUserDevices,
  LoginUser,
  RequestEmailChange,
  logoutUserDevice,
  registerUser,
  replaceLoginDevice,
  rotateRefreshToken,
  revokeRefreshToken,
  updateAuthenticatedUser,
  VerifyEmail,
  ResetPassword,
  RequestResetPassword,
} from "@/modules/auth/services/auth.service";
import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { assertTrustedOrigin, revokeToken } from "@/modules/auth/services/auth-security.service";
import { authErrorResponse } from "@/modules/auth/services/auth-error";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";

const authCookieMaxAge = 60 * 15;
const refreshCookieMaxAge = 60 * 60 * 24 * 30;
const authCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: authCookieMaxAge,
};
const refreshCookieOptions = {
  ...authCookieOptions,
  maxAge: refreshCookieMaxAge,
};
const deviceCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: refreshCookieMaxAge,
};

function jsonError(error: unknown, fallback = 400, unavailableMessage = "Unable to complete this request right now.") {
  const result = authErrorResponse(error, fallback, unavailableMessage);
  return NextResponse.json({ error: result.message }, {
    status: result.status,
  });
}

function normalizeLimiterEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "unknown";
}

function browserVerificationRequest(request: NextRequest) {
  return request.headers.get("accept")?.includes("text/html") === true;
}

function verificationLoginRedirect(request: NextRequest, verification: "complete" | "failed") {
  const configuredAppUrl = process.env.NEXTAUTH_URL ?? process.env.CORS_ORIGIN;
  const fallbackOrigin = request.nextUrl.origin;
  const url = new URL("/login", configuredAppUrl ?? fallbackOrigin);
  url.searchParams.set("verification", verification);
  return NextResponse.redirect(url);
}

function parseBrowser(userAgent?: string) {
  const value = userAgent || "";
  if (value.includes("Edg/")) return "Edge";
  if (value.includes("Chrome/")) return "Chrome";
  if (value.includes("Safari/") && !value.includes("Chrome/")) return "Safari";
  if (value.includes("Firefox/")) return "Firefox";
  return "Unknown";
}

function parseOs(userAgent?: string) {
  const value = userAgent || "";
  if (value.includes("Windows")) return "Windows";
  if (value.includes("Mac OS X")) return "macOS";
  if (value.includes("Android")) return "Android";
  if (value.includes("iPhone") || value.includes("iPad")) return "iOS";
  if (value.includes("Linux")) return "Linux";
  return "Unknown";
}

async function getDeviceInfo(request: NextRequest, generateIfMissing = true) {
  const cookieStore = await cookies().catch(() => null);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const headerDeviceId = request.headers.get("x-device-id")?.trim();
  const cookieDeviceId = cookieStore?.get("deviceId")?.value;
  const deviceId = cookieDeviceId || headerDeviceId || (generateIfMissing ? crypto.randomUUID() : undefined);
  const browser = parseBrowser(userAgent);
  const os = parseOs(userAgent);

  return {
    deviceId,
    deviceName: request.headers.get("x-device-name") ?? `${browser} ${os}`,
    browser,
    os,
    ipAddress: clientIp(request),
    userAgent,
  };
}

function setAuthCookies(
  response: NextResponse,
  cookieStore: Awaited<ReturnType<typeof cookies>> | null,
  options: {
    token?: string | null;
    refreshToken?: string | null;
    deviceId?: string | null;
  }
) {
  if (options.token !== undefined) {
    if (options.token) {
      cookieStore?.set("token", options.token, authCookieOptions);
      response.cookies.set("token", options.token, authCookieOptions);
    } else {
      cookieStore?.delete("token");
      response.cookies.delete("token");
    }
  }

  if (options.refreshToken !== undefined) {
    if (options.refreshToken) {
      cookieStore?.set("refreshToken", options.refreshToken, refreshCookieOptions);
      response.cookies.set("refreshToken", options.refreshToken, refreshCookieOptions);
    } else {
      cookieStore?.delete("refreshToken");
      response.cookies.delete("refreshToken");
    }
  }

  if (options.deviceId !== undefined) {
    if (options.deviceId) {
      cookieStore?.set("deviceId", options.deviceId, deviceCookieOptions);
      response.cookies.set("deviceId", options.deviceId, deviceCookieOptions);
    } else {
      cookieStore?.delete("deviceId");
      response.cookies.delete("deviceId");
    }
  }
}

export const register = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:register:ip:${clientIp(request)}`, 8, 60);
    const body = await request.json();
    await assertRateLimit(`auth:register:email:${normalizeLimiterEmail(body.email)}`, 3, 60 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const { user } = await registerUser(body, deviceInfo);
    const response = NextResponse.json({
      user,
      message: "Registration successful. Please verify your email before logging in.",
      deviceId: deviceInfo.deviceId,
    }, { status: 201 });
    if (deviceInfo.deviceId) {
      const cookieStore = await cookies().catch(() => null);
      setAuthCookies(response, cookieStore, {
        deviceId: deviceInfo.deviceId,
      });
    }
    return response;
  } catch (error) {
    return jsonError(error, 400, "Unable to create your account right now. Please try again shortly.");
  }
};

export const login = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:login:ip:${clientIp(request)}`, 20, 60);
    const body = await request.json();
    await assertRateLimit(`auth:login:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 6, 15 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const { user, token, refreshToken, reconsentRequired, pendingPolicies } = await LoginUser(body, deviceInfo);
    const cookieStore = await cookies().catch(() => null);
    const response = NextResponse.json({
      user,
      token,
      accessToken: token,
      refreshToken,
      deviceId: deviceInfo.deviceId,
      reconsentRequired,
      pendingPolicies,
    }, { status: 200 });
    setAuthCookies(response, cookieStore, {
      token,
      refreshToken,
      deviceId: deviceInfo.deviceId,
    });
    return response;
  } catch (error) {
    if (error instanceof DeviceLimitReachedError) {
      return NextResponse.json({
        error: error.code,
        message: error.message,
        devices: error.devices,
      }, { status: error.statusCode });
    }
    const message = (error as Error).message;
    const status = message === "Incorrect email or password" ? 401 : 400;
    return jsonError(error, status, "Unable to sign in right now. Please try again shortly.");
  }
};

export const forgotPassword = async (req: NextRequest) => {
  try {
    assertTrustedOrigin(req);
    await assertRateLimit(`auth:forgot:ip:${clientIp(req)}`, 10, 60);
    const { email } = await req.json();
    await assertRateLimit(`auth:forgot:email:${normalizeLimiterEmail(email)}`, 3, 60 * 60);
    const result = await RequestResetPassword(email, await getDeviceInfo(req));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err, 400, "Unable to send a password-reset link right now. Please try again shortly.");
  }
};

export const ResetPasswordHandler = async (req: NextRequest) => {
  try {
    assertTrustedOrigin(req);
    await assertRateLimit(`auth:reset:ip:${clientIp(req)}`, 10, 60);
    const { email, token, password } = await req.json();
    await assertRateLimit(`auth:reset:email:${normalizeLimiterEmail(email)}`, 5, 60 * 60);
    const result = await ResetPassword(email, token, password);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return jsonError(err, 400, "Unable to reset your password right now. Please try again shortly.");
  }
};

export const me = async (request?: NextRequest) => {
  try {
    const cookieStore = await cookies().catch(() => null);
    let token = cookieStore?.get("token")?.value || request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      try {
        const headerStore = await headers();
        token = headerStore.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      } catch {}
    }
    if (token) {
      const user = await getUserFromSessionToken(token);
      if (user) {
        const deviceId = cookieStore?.get("deviceId")?.value || request?.headers.get("x-device-id") || undefined;
        return NextResponse.json({ user, token, accessToken: token, deviceId }, { status: 200 });
      }
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
};

async function getAuthenticatedUserId(request?: NextRequest) {
  const cookieStore = await cookies().catch(() => null);
  let token = cookieStore?.get("token")?.value || request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    try {
      const headerStore = await headers();
      token = headerStore.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    } catch {}
  }
  if (token) {
    const user = await getUserFromSessionToken(token);
    if (user?.id) return String(user.id);
  }

  return null;
}

export const devices = async (request: NextRequest) => {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const deviceInfo = await getDeviceInfo(request);
    const result = await listUserDevices(userId, deviceInfo.deviceId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return jsonError(error, 400, "Unable to load your devices right now. Please try again shortly.");
  }
};

export const logoutDevice = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:device-logout:ip:${clientIp(request)}`, 20, 60);
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const deviceInfo = await getDeviceInfo(request);
    const { deviceId } = await request.json();
    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json({ error: "Device id is required" }, { status: 400 });
    }

    await logoutUserDevice(userId, deviceId, deviceInfo);

    const response = NextResponse.json({ message: "Device logged out" }, { status: 200 });
    if (deviceId === deviceInfo.deviceId) {
      const cookieStore = await cookies().catch(() => null);
      const token = cookieStore?.get("token")?.value;
      const refreshToken = cookieStore?.get("refreshToken")?.value;
      if (token) revokeToken(token);
      await revokeRefreshToken(refreshToken);
      setAuthCookies(response, cookieStore, {
        token: null,
        refreshToken: null,
      });
    }
    return response;
  } catch (error) {
    return jsonError(error, 400, "Unable to update this device right now. Please try again shortly.");
  }
};

export const replaceDeviceLogin = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:replace-device:ip:${clientIp(request)}`, 10, 60);
    const body = await request.json();
    await assertRateLimit(`auth:replace-device:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 5, 15 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const { user, token, refreshToken } = await replaceLoginDevice(body, deviceInfo);
    const cookieStore = await cookies().catch(() => null);
    const response = NextResponse.json({
      user,
      token,
      accessToken: token,
      refreshToken,
      deviceId: deviceInfo.deviceId,
    }, { status: 200 });
    setAuthCookies(response, cookieStore, {
      token,
      refreshToken,
      deviceId: deviceInfo.deviceId,
    });
    return response;
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Incorrect email or password" ? 401 : 400;
    return jsonError(error, status, "Unable to sign in right now. Please try again shortly.");
  }
};

export const updateMe = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:update-me:ip:${clientIp(request)}`, 30, 60);
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await updateAuthenticatedUser(userId, body);

    const response = NextResponse.json(result, { status: 200 });

    if (body.activateHost) {
      const deviceInfo = await getDeviceInfo(request);
      const sessionId = await getActiveSessionId(String(userId), deviceInfo.deviceId);
      const newToken = createSessionToken({
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      }, deviceInfo.deviceId, sessionId);
      const cookieStore = await cookies().catch(() => null);
      setAuthCookies(response, cookieStore, {
        token: newToken,
      });
      cookieStore?.delete("next-auth.session-token");
      cookieStore?.delete("__Secure-next-auth.session-token");
      response.cookies.delete("next-auth.session-token");
      response.cookies.delete("__Secure-next-auth.session-token");
    }

    return response;
  } catch (error) {
    return jsonError(error, 400, "Unable to update your account right now. Please try again shortly.");
  }
};

export const requestEmailChange = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:email-change-request:ip:${clientIp(request)}`, 5, 15 * 60);
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    await assertRateLimit(`auth:email-change-request:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 3, 60 * 60);
    const result = await RequestEmailChange(userId, body, await getDeviceInfo(request));
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return jsonError(error, 400, "Unable to start an email change right now. Please try again shortly.");
  }
};

export const confirmEmailChange = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:email-change-confirm:ip:${clientIp(request)}`, 10, 15 * 60);
    const result = await ConfirmEmailChange(await request.json(), await getDeviceInfo(request));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return jsonError(error, 400, "Unable to confirm this email change right now. Please try again shortly.");
  }
};

export const changePassword = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:change-password:ip:${clientIp(request)}`, 5, 15 * 60);
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await ChangePassword(userId, await request.json(), await getDeviceInfo(request));
    const cookieStore = await cookies().catch(() => null);
    const response = NextResponse.json(result, { status: 200 });
    setAuthCookies(response, cookieStore, {
      token: null,
      refreshToken: null,
    });
    return response;
  } catch (error) {
    return jsonError(error, 400, "Unable to update your password right now. Please try again shortly.");
  }
};

export const logout = async (request?: NextRequest) => {
  try {
    if (request) {
      assertTrustedOrigin(request);
      await assertRateLimit(`auth:logout:ip:${clientIp(request)}`, 30, 60);
    }
    const cookieStore = await cookies().catch(() => null);
    let token = cookieStore?.get("token")?.value;
    let refreshToken = cookieStore?.get("refreshToken")?.value;
    if (!token && request) {
      token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    }
    if (!token) {
      try {
        const headerStore = await headers();
        token = headerStore.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      } catch {}
    }
    if (!refreshToken && request) {
      try {
        const body = await request.clone().json();
        refreshToken = body?.refreshToken;
      } catch {}
      if (!refreshToken) {
        refreshToken = request.headers.get("x-refresh-token") || undefined;
      }
    }
    const deviceInfo = request ? await getDeviceInfo(request) : undefined;
    if (token) {
      revokeToken(token);
    }
    await revokeRefreshToken(refreshToken, deviceInfo);
    const response = NextResponse.json({ message: "Logged out" }, { status: 200 });
    setAuthCookies(response, cookieStore, {
      token: null,
      refreshToken: null,
    });
    return response;
  } catch (error) {
    return jsonError(error, 400, "Unable to sign out securely right now. Please try again shortly.");
  }
};

export const refreshSession = async (request: NextRequest) => {
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:refresh:ip:${clientIp(request)}`, 30, 60);
    const cookieStore = await cookies().catch(() => null);
    let currentRefreshToken = cookieStore?.get("refreshToken")?.value;
    if (!currentRefreshToken) {
      try {
        const body = await request.clone().json();
        currentRefreshToken = body?.refreshToken;
      } catch {}
    }
    if (!currentRefreshToken) {
      currentRefreshToken = request.headers.get("x-refresh-token") || undefined;
    }

    const deviceInfo = await getDeviceInfo(request, false);
    const result = await rotateRefreshToken(currentRefreshToken, deviceInfo);
    const response = NextResponse.json({
      user: result.user,
      token: result.token,
      accessToken: result.token,
      refreshToken: result.refreshToken,
      deviceId: result.deviceId,
    }, { status: 200 });

    setAuthCookies(response, cookieStore, {
      token: result.token,
      refreshToken: result.refreshToken,
      deviceId: result.deviceId,
    });
    return response;
  } catch (error) {
    const cookieStore = await cookies().catch(() => null);
    const response = jsonError(error, 401, "Your session could not be renewed. Please sign in again.");
    setAuthCookies(response, cookieStore, {
      token: null,
      refreshToken: null,
    });
    return response;
  }
};

export const verifyEmail = async (request: NextRequest) => {
  try {
    await assertRateLimit(`auth:verify:ip:${clientIp(request)}`, 30, 60);
    const email = request.nextUrl.searchParams.get("email");
    const token = request.nextUrl.searchParams.get("token");

    if (!email || !token) {
      if (browserVerificationRequest(request)) return verificationLoginRedirect(request, "failed");
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
    }

    const result = await VerifyEmail(email, token);
    if (browserVerificationRequest(request)) return verificationLoginRedirect(request, "complete");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (browserVerificationRequest(request)) return verificationLoginRedirect(request, "failed");
    return jsonError(error, 400, "Unable to verify your email right now. Please try again shortly.");
  }
};
