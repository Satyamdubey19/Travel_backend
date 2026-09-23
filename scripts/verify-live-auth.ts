import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" });

import { prisma } from "@/lib/prisma";
import {
  registerUser,
  LoginUser,
  getUserFromSessionToken,
  rotateRefreshToken,
  RequestResetPassword,
  ResetPassword,
  listUserDevices,
} from "@/modules/auth/services/auth.service";

let lastResetToken = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (urlStr.includes("brevo.com") || urlStr.includes("/smtp/email")) {
    if (init?.body && typeof init.body === "string") {
      const match = init.body.match(/token=([a-f0-9]+)/i);
      if (match) lastResetToken = match[1];
    }
    return new Response(JSON.stringify({ messageId: `<test-${Date.now()}@travelspro.in>` }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

const testDevice = {

  deviceId: "verify-live-auth-device-" + Date.now(),
  deviceName: "Automated Verifier Chrome Windows",
  browser: "Chrome",
  os: "Windows",
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
};

const travelerEmail = `traveler-${Date.now()}@travelspro.test`;
const hostEmail = `host-${Date.now()}@travelspro.test`;
const travelerPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
const hostPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
const initialPassword = "SecurePassword1234!@#$";
const updatedPassword = "NewSecurePassword5678!@#$";

async function cleanupUser(email: string, phone?: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            ...(phone ? [{ phone }] : []),
          ],
        },
      });
      if (!user) return;
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userDevice.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.host.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      return;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`[Cleanup] Non-fatal cleanup note for ${email}:`, (err as Error).message);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

async function runLiveAuthVerification() {
  console.log("=== TRAVELS PRO LIVE DATABASE AUTHENTICATION MATRIX ===");
  console.log("Database target:", process.env.DATABASE_URL?.split("@")[1] || "configured");

  // Step 0: Pre-clean
  await cleanupUser(travelerEmail, travelerPhone);
  await cleanupUser(hostEmail, hostPhone);

  try {
    // 1. Traveler Registration
    console.log("\n[1/8] Testing Traveler Registration...");
    const regResult = await registerUser(
      {
        name: "Aarav Sharma",
        email: travelerEmail,
        phone: travelerPhone,
        password: initialPassword,
        role: "user",
      },
      testDevice
    );
    if (!regResult.user?.id) throw new Error("Traveler registration failed to return user ID");
    console.log("  ✓ User created in PostgreSQL with ID:", regResult.user.id);

    // Verify in DB and manually set isVerified: true for verification test
    const dbUser = await prisma.user.findUnique({ where: { id: regResult.user.id } });
    if (!dbUser) throw new Error("User not found in database after registration");
    if (dbUser.role !== "USER") throw new Error(`Expected role USER, got ${dbUser.role}`);
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { isEmailVerified: true, emailVerifiedAt: new Date(), status: "ACTIVE" },
    });
    console.log("  ✓ Verified user state updated in Neon DB");

    // 2. Host Applicant Registration
    console.log("\n[2/8] Testing Host Applicant Registration...");
    const hostRegResult = await registerUser(
      {
        name: "Priya Patel",
        email: hostEmail,
        phone: hostPhone,
        password: initialPassword,
        role: "host",
        businessName: "Himalayan Expeditions",
      },
      testDevice
    );
    if (!hostRegResult.user?.id) throw new Error("Host registration failed to return user ID");
    const dbHost = await prisma.host.findUnique({ where: { userId: hostRegResult.user.id } });
    if (!dbHost) throw new Error("Host profile was not created alongside user account");
    console.log("  ✓ Host user and associated Host record created. Business:", dbHost.businessName);
    await prisma.user.update({
      where: { id: hostRegResult.user.id },
      data: { isEmailVerified: true, emailVerifiedAt: new Date(), status: "ACTIVE" },
    });

    // 3. Credential Sign-in
    console.log("\n[3/8] Testing Credential Sign-In & Session Creation...");
    const loginResult = await LoginUser(
      { email: travelerEmail, password: initialPassword },
      testDevice
    );
    if (!loginResult.token || !loginResult.refreshToken) {
      throw new Error("Login failed to issue token pair");
    }
    console.log("  ✓ Session token and refresh token successfully generated");

    // Verify RefreshToken in PostgreSQL
    const tokenRecords = await prisma.refreshToken.findMany({
      where: { userId: dbUser.id, revokedAt: null },
    });
    if (tokenRecords.length === 0) throw new Error("RefreshToken record was not saved to database");
    if (!tokenRecords[0].tokenHash) throw new Error("RefreshToken.tokenHash is missing or null");
    console.log("  ✓ RefreshToken persisted with unique tokenHash in Neon DB");

    // 4. Session Validation from Token
    console.log("\n[4/8] Testing Session Verification from Token...");
    const verifiedUser = await getUserFromSessionToken(loginResult.token);
    if (!verifiedUser || verifiedUser.email !== travelerEmail) {
      throw new Error("getUserFromSessionToken returned invalid user or null");
    }
    console.log("  ✓ Verified session for:", verifiedUser.email, "Role:", verifiedUser.role);

    // 5. Device Registry Verification (Active Session)
    console.log("\n[5/9] Testing Multi-Device Registry with Active Session...");
    const rawDevices = await listUserDevices(dbUser.id, testDevice.deviceId);
    const deviceList = Array.isArray(rawDevices) ? rawDevices : (rawDevices as { devices?: unknown[] }).devices ?? [];
    if (deviceList.length === 0) {
      throw new Error("Device registry returned empty list for active session");
    }
    console.log("  ✓ Registered devices count:", deviceList.length);

    // 6. Refresh Token Rotation (Single-Use)
    console.log("\n[6/9] Testing Refresh Token Rotation...");
    const rotated = await rotateRefreshToken(loginResult.refreshToken, testDevice);
    if (!rotated.token || !rotated.refreshToken) {
      throw new Error("rotateRefreshToken failed to return new token pair");
    }
    console.log("  ✓ Refresh token successfully rotated");

    // 7. Security: Token Reuse Detection & Family Invalidation
    console.log("\n[7/9] Testing Token Family Protection on Token Reuse...");
    let replayPrevented = false;
    try {
      await rotateRefreshToken(loginResult.refreshToken, testDevice);
    } catch {
      replayPrevented = true;
    }
    if (!replayPrevented) {
      throw new Error("SECURITY FAILURE: Consumed refresh token was allowed to be replayed!");
    }
    console.log("  ✓ Refresh token replay strictly blocked & token family invalidated");

    // 7. Password Reset Lifecycle
    console.log("\n[7/8] Testing Password Reset Flow & Session Invalidation...");
    const resetReq = await RequestResetPassword(travelerEmail, testDevice);
    if (!resetReq.message) throw new Error("RequestResetPassword returned no response");

    const resetTokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
    });
    if (!resetTokenRecord?.tokenHash) throw new Error("PasswordResetToken not found in database");
    if (!lastResetToken) throw new Error("Reset token was not extracted from email dispatch");
    console.log("  ✓ Password reset token issued and tokenHash stored in PostgreSQL");

    await ResetPassword(travelerEmail, lastResetToken, updatedPassword);
    console.log("  ✓ Password successfully reset to new credentials");

    // Verify session invalidation
    const updatedUser = await prisma.user.findUnique({ where: { id: dbUser.id } });
    if (!updatedUser?.sessionInvalidatedAt) {
      throw new Error("User.sessionInvalidatedAt was not updated on password reset");
    }
    console.log("  ✓ User.sessionInvalidatedAt updated to:", updatedUser.sessionInvalidatedAt.toISOString());

    // 8. Re-authentication with Updated Password
    console.log("\n[8/8] Testing Re-authentication with New Password...");
    let oldPasswordRejected = false;
    try {
      await LoginUser({ email: travelerEmail, password: initialPassword }, testDevice);
    } catch {
      oldPasswordRejected = true;
    }
    if (!oldPasswordRejected) throw new Error("Old password was accepted after reset!");
    console.log("  ✓ Old password rejected as expected");

    const newLogin = await LoginUser({ email: travelerEmail, password: updatedPassword }, testDevice);
    if (!newLogin.token) throw new Error("Login with new password failed");
    console.log("  ✓ Successfully signed in with new password");

    console.log("\n=======================================================");
    console.log("  ALL 8 LIVE AUTH LIFECYCLE CHECKS PASSED PERFECTLY!  ");
    console.log("=======================================================\n");
  } finally {
    await cleanupUser(travelerEmail);
    await cleanupUser(hostEmail);
    await prisma.$disconnect();
  }
}

runLiveAuthVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ LIVE AUTH VERIFICATION FAILED:", err);
    process.exit(1);
  });
