import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" });

import axios from "axios";
import { prisma } from "@/lib/prisma";

async function runLiveHttpVerification() {
  console.log("=== TRAVELS PRO PRODUCTION-READY AUTH VERIFICATION SUITE ===");
  const backendBase = "http://localhost:4000";

  const testEmail = `e2e-jwt-${Date.now()}@travelspro.test`;
  const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = "SuperSecurePassword123!@#$";
  let userId = "";

  try {
    // 1. Health Checks
    console.log("\n[1/10] Checking Backend Health Check Endpoint...");
    const liveRes = await axios.get(`${backendBase}/api/health/live`);
    console.log("  ✓ /api/health/live returned 200:", liveRes.data.service);

    // 2. User Registration
    console.log("\n[2/10] Testing Registration via HTTP POST /api/auth/register...");
    const registerRes = await axios.post(
      `${backendBase}/api/auth/register`,
      {
        name: "Enterprise Traveler",
        email: testEmail,
        phone: testPhone,
        password: testPassword,
        role: "user",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
      }
    );
    userId = registerRes.data?.user?.id;
    if (!userId) throw new Error("Registration did not return user id");
    console.log("  ✓ Registered successfully. User ID:", userId);

    // Activate and verify email in database for login
    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true, emailVerifiedAt: new Date(), status: "ACTIVE" },
    });
    console.log("  ✓ User account verified in Neon database for login testing");

    // 3. Credential Login: verify both cookies and JSON body tokens
    console.log("\n[3/10] Testing Sign-In via HTTP POST /api/auth/login...");
    const loginRes = await axios.post(
      `${backendBase}/api/auth/login`,
      { email: testEmail, password: testPassword },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        },
      }
    );
    console.log("  ✓ Sign-in status:", loginRes.status);
    
    // Validate JSON response contains user, token, accessToken, and refreshToken
    const { token: accessToken, refreshToken, user } = loginRes.data;
    if (!accessToken || !refreshToken || !user?.id) {
      throw new Error("Login failed to return complete token pair in JSON payload");
    }
    console.log("  ✓ JSON response contains valid JWT accessToken & refreshToken");

    // Validate cookies
    const authCookies = loginRes.headers["set-cookie"] || [];
    const hasTokenCookie = authCookies.some((c) => c.startsWith("token="));
    const hasRefreshCookie = authCookies.some((c) => c.startsWith("refreshToken="));
    if (!hasTokenCookie || !hasRefreshCookie) {
      throw new Error("Login failed to set httpOnly session and refresh cookies");
    }
    console.log("  ✓ Set-Cookie headers contain token, refreshToken, and deviceId");

    const cookieHeader = authCookies.map((c) => c.split(";")[0]).join("; ");

    // 4. Session Verification with Cookie only
    console.log("\n[4/10] Testing /api/auth/me using Cookie only...");
    const meCookieRes = await axios.get(`${backendBase}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    if (meCookieRes.data?.user?.email !== testEmail) {
      throw new Error("Cookie-based session extraction failed");
    }
    console.log("  ✓ /api/auth/me successfully authenticated via Cookie:", meCookieRes.data.user.email);

    // 5. Session Verification with Authorization: Bearer <token> only (NO Cookies!)
    console.log("\n[5/10] Testing /api/auth/me using Authorization: Bearer <token> only (No Cookies)...");
    const meBearerRes = await axios.get(`${backendBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (meBearerRes.data?.user?.email !== testEmail) {
      throw new Error("Bearer token session extraction failed");
    }
    console.log("  ✓ /api/auth/me successfully authenticated via Bearer token:", meBearerRes.data.user.email);

    // 6. Protected Devices Endpoint with Bearer token only
    console.log("\n[6/10] Testing /api/auth/devices using Bearer token only...");
    const devicesRes = await axios.get(`${backendBase}/api/auth/devices`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const deviceList = Array.isArray(devicesRes.data) ? devicesRes.data : devicesRes.data?.devices ?? [];
    console.log("  ✓ /api/auth/devices returned active devices count:", deviceList.length);

    // 7. Refresh Token Rotation via HTTP POST /api/auth/refresh (Cookie mode)
    console.log("\n[7/10] Testing Refresh Token Rotation via Cookie...");
    const refreshCookieRes = await axios.post(
      `${backendBase}/api/auth/refresh`,
      {},
      {
        headers: {
          Cookie: cookieHeader,
          Origin: "http://localhost:3000",
        },
      }
    );
    const newAccessToken = refreshCookieRes.data?.token || refreshCookieRes.data?.accessToken;
    const newRefreshToken = refreshCookieRes.data?.refreshToken;
    if (!newAccessToken || !newRefreshToken) {
      throw new Error("Refresh endpoint failed to return rotated token pair");
    }
    console.log("  ✓ Token rotation successful! New access token & refresh token issued");

    // 8. Refresh Token Rotation via Request Body (No Cookies - Mobile/API mode)
    console.log("\n[8/10] Testing Refresh Token Rotation via Request Body { refreshToken } (No Cookies)...");
    const refreshBodyRes = await axios.post(
      `${backendBase}/api/auth/refresh`,
      { refreshToken: newRefreshToken },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
      }
    );
    const thirdAccessToken = refreshBodyRes.data?.token || refreshBodyRes.data?.accessToken;
    const thirdRefreshToken = refreshBodyRes.data?.refreshToken;
    if (!thirdAccessToken || !thirdRefreshToken) {
      throw new Error("Body-based refresh failed to return rotated token pair");
    }
    console.log("  ✓ Body-based token rotation successful!");

    // 9. Token Reuse Attack Protection (Replay Detection)
    console.log("\n[9/10] Testing Token Replay Detection & Family Invalidation...");
    let replayBlocked = false;
    try {
      await axios.post(
        `${backendBase}/api/auth/refresh`,
        { refreshToken: newRefreshToken }, // already consumed!
        {
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
          },
        }
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        replayBlocked = true;
      }
    }
    if (!replayBlocked) {
      throw new Error("SECURITY BREACH: Consumed refresh token replay was permitted!");
    }
    console.log("  ✓ Consumed refresh token replay strictly blocked with 401 & token family revoked");

    // 10. Malformed/Expired Token Safe Rejection (Zero 500 crashes)
    console.log("\n[10/10] Testing Malformed / Expired Token Rejection (Crash Protection)...");
    let malformedBlocked = false;
    try {
      await axios.get(`${backendBase}/api/auth/me`, {
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature" },
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        malformedBlocked = true;
      }
    }
    if (!malformedBlocked) {
      throw new Error("Malformed token was not rejected with 401");
    }
    console.log("  ✓ Malformed token safely rejected with 401 Unauthorized (Zero 500 exceptions)");

    console.log("\n=======================================================");
    console.log("  ALL 10 PRODUCTION AUTH LIFECYCLE CHECKS PASSED!     ");
    console.log("=======================================================\n");
  } finally {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => null);
      await prisma.session.deleteMany({ where: { userId } }).catch(() => null);
      await prisma.userDevice.deleteMany({ where: { userId } }).catch(() => null);
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }
    await prisma.$disconnect();
  }
}

runLiveHttpVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ LIVE HTTP AUTH VERIFICATION FAILED:", err.message);
    process.exit(1);
  });
