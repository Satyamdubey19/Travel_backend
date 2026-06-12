import { createSessionToken, getAuthUserById, getUserFromSessionToken, LoginUser, registerUser, updateAuthenticatedUser, VerifyEmail } from "@/services/auth.service";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ResetPassword,RequestResetPassword } from "@/services/auth.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const authCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};


export const register=async(request:NextRequest)=>{
  try{
    const body=await request.json();
    const {user}=await registerUser(body);
    const token = createSessionToken(user);
    (await cookies()).set("token", token, authCookieOptions);
    return new Response(JSON.stringify({
      user,
      message:"Registration successful. You are signed in now."
    }),{status:201,headers:{"Content-Type":"application/json"}})
  } catch (error) {
    return new Response(JSON.stringify({error: (error as Error).message}), {status: 400, headers: {"Content-Type": "application/json"}});
  }
}

export const login=async(request:NextRequest)=>{
  try{
    const body=await request.json();
    const {user,token}=await LoginUser(body);
    (await cookies()).set("token",token,authCookieOptions);
    return new Response(JSON.stringify({user}),{status:200,headers:{"Content-Type":"application/json"}});
  } catch (error) {
    return new Response(JSON.stringify({error: (error as Error).message}), {status: 400, headers: {"Content-Type": "application/json"}});
  }
}


export const forgotPassword=async(req:NextRequest)=>{
  try{
    const {email}=await req.json();
    const result=await RequestResetPassword(email);
    return new Response(JSON.stringify(result),{
      status:201,
       headers: { "Content-Type": "application/json" },
    });
  }catch(err){
    const message = err instanceof Error ? err.message : "Server Error";
    const status = message === "Server Error" ? 500 : 400;

    return new Response(JSON.stringify({error: message}),{
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const ResetPasswordHandler=async(req:NextRequest)=>{
  try{
    const {email,token,password}=await req.json();
    const result=await ResetPassword(email,token,password);

    return new Response(JSON.stringify(result),{
      status:200,
      headers:{ "Content-Type": "application/json" },
    });
  }catch(err){
     return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400 }
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
      return Response.json({ user: dbUser ?? session.user }, { status: 200 });
    }

    return Response.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const updateMe=async(request:NextRequest)=>{
  try {
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
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export const logout=async()=>{
  (await cookies()).delete("token");
  return Response.json({ message: "Logged out" }, { status: 200 });
}

export const verifyEmail=async(request:NextRequest)=>{
  try {
    const email = request.nextUrl.searchParams.get("email");
    const token = request.nextUrl.searchParams.get("token");

    if (!email || !token) {
      return Response.json({ error: "Invalid verification link" }, { status: 400 });
    }

    const result = await VerifyEmail(email, token);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
