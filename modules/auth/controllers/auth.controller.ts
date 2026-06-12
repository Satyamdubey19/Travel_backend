import { createSessionToken, getAuthUserById, getUserFromSessionToken, LoginUser, registerUser, updateAuthenticatedUser, VerifyEmail } from "@/modules/auth/services/auth.service";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ResetPassword,RequestResetPassword } from "@/modules/auth/services/auth.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertRateLimit, assertTrustedOrigin, clientIp, revokeToken } from "@/modules/auth/services/auth-security.service";

const authCookieMaxAge = 60 * 60 * 24 * 7;
const authCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: authCookieMaxAge,
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

export const register=async(request:NextRequest)=>{
  try{
    assertTrustedOrigin(request);
    assertRateLimit(`auth:register:ip:${clientIp(request)}`, 8, 60 * 1000);
    const body=await request.json();
    assertRateLimit(`auth:register:email:${normalizeLimiterEmail(body.email)}`, 3, 60 * 60 * 1000);
    const {user}=await registerUser(body);
    return new Response(JSON.stringify({
      user,
      message:"Registration successful. Please verify your email before logging in."
    }),{status:201,headers:{"Content-Type":"application/json"}})
  } catch (error) {
    return jsonError(error);
  }
}

export const login=async(request:NextRequest)=>{
  try{
    assertTrustedOrigin(request);
    assertRateLimit(`auth:login:ip:${clientIp(request)}`, 20, 60 * 1000);
    const body=await request.json();
    assertRateLimit(`auth:login:email:${normalizeLimiterEmail(body.email)}:${clientIp(request)}`, 6, 15 * 60 * 1000);
    const {user,token}=await LoginUser(body);
    (await cookies()).set("token",token,authCookieOptions);
    return new Response(JSON.stringify({user}),{status:200,headers:{"Content-Type":"application/json"}});
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Incorrect email or password" ? 401 : errorStatus(error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}


export const forgotPassword=async(req:NextRequest)=>{
  try{
    assertTrustedOrigin(req);
    assertRateLimit(`auth:forgot:ip:${clientIp(req)}`, 10, 60 * 1000);
    const {email}=await req.json();
    assertRateLimit(`auth:forgot:email:${normalizeLimiterEmail(email)}`, 3, 60 * 60 * 1000);
    const result=await RequestResetPassword(email);
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
    assertRateLimit(`auth:reset:ip:${clientIp(req)}`, 10, 60 * 1000);
    const {email,token,password}=await req.json();
    assertRateLimit(`auth:reset:email:${normalizeLimiterEmail(email)}`, 5, 60 * 60 * 1000);
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

export const updateMe=async(request:NextRequest)=>{
  try {
    assertTrustedOrigin(request);
    assertRateLimit(`auth:update-me:ip:${clientIp(request)}`, 30, 60 * 1000);
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
    assertRateLimit(`auth:logout:ip:${clientIp(request)}`, 30, 60 * 1000);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    revokeToken(token);
  }
  cookieStore.delete("token");
  return Response.json({ message: "Logged out" }, { status: 200 });
}

export const verifyEmail=async(request:NextRequest)=>{
  try {
    assertRateLimit(`auth:verify:ip:${clientIp(request)}`, 30, 60 * 1000);
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
