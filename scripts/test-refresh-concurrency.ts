import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" });

import axios from "axios";
import { prisma } from "@/lib/prisma";

async function runConcurrencyTest() {
  console.log("=== TRAVELS PRO REFRESH TOKEN CONCURRENCY & RESILIENCE TEST ===");
  const backendBase = "http://localhost:4000";
  const testEmail = `concurrent-auth-${Date.now()}@travelspro.test`;
  const testPassword = "Password123!@#$";
  let userId = "";

  try {
    // 1. Create and verify user
    console.log("\n[1/4] Registering test user...");
    const regRes = await axios.post(
      `${backendBase}/api/auth/register`,
      {
        name: "Concurrent Tester",
        email: testEmail,
        password: testPassword,
        role: "user",
      },
      {
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      }
    );
    userId = regRes.data?.user?.id;
    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true, emailVerifiedAt: new Date(), status: "ACTIVE" },
    });
    console.log("  ✓ User created and verified:", userId);

    // 2. Log in
    console.log("\n[2/4] Logging in...");
    const loginRes = await axios.post(
      `${backendBase}/api/auth/login`,
      { email: testEmail, password: testPassword },
      {
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      }
    );
    const { token: initialAccess, refreshToken: initialRefresh, deviceId } = loginRes.data;
    if (!initialAccess || !initialRefresh || !deviceId) {
      throw new Error("Missing tokens or deviceId in login response");
    }
    console.log("  ✓ Logged in. Device ID:", deviceId);

    // 3. Test Refresh with deviceId preserved
    console.log("\n[3/4] Testing token refresh with preserved deviceId...");
    const refreshRes = await axios.post(
      `${backendBase}/api/auth/refresh`,
      { refreshToken: initialRefresh },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          "x-device-id": deviceId,
        },
      }
    );
    const { token: refreshedAccess, refreshToken: secondRefresh, deviceId: refreshedDeviceId } = refreshRes.data;
    if (!refreshedAccess || !secondRefresh) {
      throw new Error("Refresh failed to return token pair");
    }
    if (refreshedDeviceId !== deviceId) {
      throw new Error(`Device ID desynchronized: expected ${deviceId}, got ${refreshedDeviceId}`);
    }
    console.log("  ✓ Token refresh preserved device ID:", refreshedDeviceId);

    // 4. Test client-side queue simulation (multiple parallel calls with expired token)
    console.log("\n[4/4] Simulating 5 parallel requests hitting expired access token...");
    // Let's create an axios client with the queued retry logic
    let isRefreshing = false;
    let refreshCount = 0;
    let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

    const simulatedClient = axios.create({ baseURL: backendBase });
    let currentToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expiredToken.simulated";
    let activeRefreshToken = secondRefresh;

    simulatedClient.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return simulatedClient(original);
          });
        }

        original._retry = true;
        isRefreshing = true;

        try {
          refreshCount++;
          const res = await axios.post(
            `${backendBase}/api/auth/refresh`,
            { refreshToken: activeRefreshToken },
            {
              headers: {
                "Content-Type": "application/json",
                Origin: "http://localhost:3000",
                "x-device-id": deviceId,
              },
            }
          );
          const newAccess = res.data.token;
          activeRefreshToken = res.data.refreshToken;
          currentToken = newAccess;

          failedQueue.forEach((q) => q.resolve(newAccess));
          failedQueue = [];

          original.headers.Authorization = `Bearer ${newAccess}`;
          return simulatedClient(original);
        } catch (err) {
          failedQueue.forEach((q) => q.reject(err));
          failedQueue = [];
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
    );

    // Fire 5 requests concurrently using the expired token
    const results = await Promise.all([
      simulatedClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${currentToken}` } }),
      simulatedClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${currentToken}` } }),
      simulatedClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${currentToken}` } }),
      simulatedClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${currentToken}` } }),
      simulatedClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${currentToken}` } }),
    ]);

    for (const r of results) {
      if (r.status !== 200 || r.data.user.email !== testEmail) {
        throw new Error("Concurrent request failed to resolve with authenticated user");
      }
    }
    console.log(`  ✓ All 5 parallel requests resolved with 200 OK`);
    console.log(`  ✓ Exact number of refresh HTTP calls made: ${refreshCount} (Expected: 1)`);
    if (refreshCount !== 1) {
      throw new Error(`Queue race condition: expected 1 refresh call, but made ${refreshCount}`);
    }

    console.log("\n=======================================================");
    console.log("  CONCURRENCY & REFRESH QUEUE TEST PASSED PERFECTLY!  ");
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

runConcurrencyTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ CONCURRENCY TEST FAILED:", err.message);
    process.exit(1);
  });

