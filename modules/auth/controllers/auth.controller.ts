import {
  createSessionToken,
  DeviceLimitReachedError,
  getAuthUserById,
  getUserFromSessionToken,
  listUserDevices,
  LoginUser,
  logoutUserDevice,
  registerUser,
  replaceLoginDevice,
  revokeRefreshToken,
  updateAuthenticatedUser,
  VerifyEmail,
} from "@/modules/auth/services/auth.service";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ResetPassword,RequestResetPassword } from "@/modules/auth/services/auth.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertTrustedOrigin, revokeToken } from "@/modules/auth/services/auth-security.service";
import { assertRateLimit, clientIp } from "@/lib/rate-limit";

const authCookieMaxAge = 60 * 60 * 24 * 7;
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

function errorStatus(error: unknown, fallback = 400) {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return Number((error as { statusCode?: number }).statusCode) || fallback;
  }
  return fallback;
}

function jsonError(error: unknown, fallback = 400) {
  return new Response(JSON.stringify({ error: (error as Error).message }), {
    status: errorStatus(error, fallback),
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeLimiterEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "unknown";
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

async function getDeviceInfo(request: NextRequest) {
  const cookieStore = await cookies();
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const headerDeviceId = request.headers.get("x-device-id")?.trim();
  const cookieDeviceId = cookieStore.get("deviceId")?.value;
  const deviceId = headerDeviceId || cookieDeviceId || crypto.randomUUID();
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

function setDeviceCookie(response: Response, deviceId: string) {
  response.headers.append(
    "Set-Cookie",
    `deviceId=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${refreshCookieMaxAge}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}; HttpOnly`,
  );
}

export const register=async(request:NextRequest)=>{
  try{
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:register:ip:${clientIp(request)}`, 8, 60);
    const body=await request.json();
    await assertRateLimit(`auth:register:email:${normalizeLimiterEmail(body.email)}`, 3, 60 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const {user}=await registerUser(body, deviceInfo);
    const response = new Response(JSON.stringify({
      user,
      message:"Registration successful. Please verify your email before logging in."
    }),{status:201,headers:{"Content-Type":"application/json"}});
    setDeviceCookie(response, deviceInfo.deviceId);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export const login=async(request:NextRequest)=>{
  try{
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:login:ip:${clientIp(request)}`, 20, 60);
    const body=await request.json();
    await assertRateLimit(`auth:login:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 6, 15 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const {user,token,refreshToken}=await LoginUser(body, deviceInfo);
    const cookieStore = await cookies();
    cookieStore.set("token",token,authCookieOptions);
    cookieStore.set("refreshToken",refreshToken,refreshCookieOptions);
    cookieStore.set("deviceId",deviceInfo.deviceId,deviceCookieOptions);
    return new Response(JSON.stringify({user}),{status:200,headers:{"Content-Type":"application/json"}});
  } catch (error) {
    if (error instanceof DeviceLimitReachedError) {
      return new Response(JSON.stringify({
        error: error.code,
        message: error.message,
        devices: error.devices,
      }), { status: error.statusCode, headers: { "Content-Type": "application/json" } });
    }
    const message = (error as Error).message;
    const status = message === "Incorrect email or password" ? 401 : errorStatus(error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}


export const forgotPassword=async(req:NextRequest)=>{
  try{
    assertTrustedOrigin(req);
    await assertRateLimit(`auth:forgot:ip:${clientIp(req)}`, 10, 60);
    const {email}=await req.json();
    await assertRateLimit(`auth:forgot:email:${normalizeLimiterEmail(email)}`, 3, 60 * 60);
    const result=await RequestResetPassword(email, await getDeviceInfo(req));
    return new Response(JSON.stringify(result),{
      status:201,
       headers: { "Content-Type": "application/json" },
    });
  }catch(err){
    const message = err instanceof Error ? err.message : "Server Error";
    const status = message === "Server Error" ? 500 : 400;

    return new Response(JSON.stringify({error: message}),{
      status: errorStatus(err, status),
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const ResetPasswordHandler=async(req:NextRequest)=>{
  try{
    assertTrustedOrigin(req);
    await assertRateLimit(`auth:reset:ip:${clientIp(req)}`, 10, 60);
    const {email,token,password}=await req.json();
    await assertRateLimit(`auth:reset:email:${normalizeLimiterEmail(email)}`, 5, 60 * 60);
    const result=await ResetPassword(email,token,password);

    return new Response(JSON.stringify(result),{
      status:200,
      headers:{ "Content-Type": "application/json" },
    });
  }catch(err){
     return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: errorStatus(err) }
    );
  }
}

export const me=async()=>{
  try {
    const token = (await cookies()).get("token")?.value;
    if (token) {
      const user = await getUserFromSessionToken(token);
      if (user) {
        return Response.json({ user }, { status: 200 });
      }
    }

    const session = await getServerSession(authOptions);
    if (session?.user) {
      const dbUser = session.user.id ? await getAuthUserById(session.user.id) : null;
      if (session.user.id && !dbUser) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json({ user: dbUser ?? session.user }, { status: 200 });
    }

    return Response.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

async function getAuthenticatedUserId() {
  const token = (await cookies()).get("token")?.value;
  if (token) {
    const user = await getUserFromSessionToken(token);
    if (user?.id) return String(user.id);
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ? String(session.user.id) : null;
}

export const devices=async(request:NextRequest)=>{
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const deviceInfo = await getDeviceInfo(request);
    const result = await listUserDevices(userId, deviceInfo.deviceId);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: errorStatus(error) });
  }
}

export const logoutDevice=async(request:NextRequest)=>{
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:device-logout:ip:${clientIp(request)}`, 20, 60);
    const userId = await getAuthenticatedUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const deviceInfo = await getDeviceInfo(request);
    const { deviceId } = await request.json();
    if (!deviceId || typeof deviceId !== "string") {
      return Response.json({ error: "Device id is required" }, { status: 400 });
    }

    await logoutUserDevice(userId, deviceId, deviceInfo);

    const response = Response.json({ message: "Device logged out" }, { status: 200 });
    if (deviceId === deviceInfo.deviceId) {
      const cookieStore = await cookies();
      const token = cookieStore.get("token")?.value;
      const refreshToken = cookieStore.get("refreshToken")?.value;
      if (token) revokeToken(token);
      await revokeRefreshToken(refreshToken);
      cookieStore.delete("token");
      cookieStore.delete("refreshToken");
    }
    return response;
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: errorStatus(error) });
  }
}

export const replaceDeviceLogin=async(request:NextRequest)=>{
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:replace-device:ip:${clientIp(request)}`, 10, 60);
    const body = await request.json();
    await assertRateLimit(`auth:replace-device:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 5, 15 * 60);
    const deviceInfo = await getDeviceInfo(request);
    const { user, token, refreshToken } = await replaceLoginDevice(body, deviceInfo);
    const cookieStore = await cookies();
    cookieStore.set("token", token, authCookieOptions);
    cookieStore.set("refreshToken", refreshToken, refreshCookieOptions);
    cookieStore.set("deviceId", deviceInfo.deviceId, deviceCookieOptions);
    return Response.json({ user }, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Incorrect email or password" ? 401 : errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

export const updateMe=async(request:NextRequest)=>{
  try {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:update-me:ip:${clientIp(request)}`, 30, 60);
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;

    let userId = sessionUserId;
    if (!userId) {
      const token = (await cookies()).get("token")?.value;
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await getUserFromSessionToken(token);
      userId = user?.id ? String(user.id) : undefined;
    }

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await updateAuthenticatedUser(userId, body);

   
    if (body.activateHost) {
      const newToken = createSessionToken({
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      });
      const cookieStore = await cookies();
      cookieStore.set("token", newToken, authCookieOptions);
      const isProduction = process.env.NODE_ENV === "production";
      cookieStore.delete(
        isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      );
    }

    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: errorStatus(error) });
  }
}

export const logout=async(request?: NextRequest)=>{
  if (request) {
    assertTrustedOrigin(request);
    await assertRateLimit(`auth:logout:ip:${clientIp(request)}`, 30, 60);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;
  const deviceInfo = request ? await getDeviceInfo(request) : undefined;
  if (token) {
    revokeToken(token);
  }
  await revokeRefreshToken(refreshToken, deviceInfo);
  cookieStore.delete("token");
  cookieStore.delete("refreshToken");
  return Response.json({ message: "Logged out" }, { status: 200 });
}

export const verifyEmail=async(request:NextRequest)=>{
  try {
    await assertRateLimit(`auth:verify:ip:${clientIp(request)}`, 30, 60);
    const email = request.nextUrl.searchParams.get("email");
    const token = request.nextUrl.searchParams.get("token");

    if (!email || !token) {
      return Response.json({ error: "Invalid verification link" }, { status: 400 });
    }

    const result = await VerifyEmail(email, token);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: errorStatus(error) });
  }
}
