import "dotenv/config";
import { encode } from "next-auth/jwt";
import { prisma } from "../lib/prisma";

const BASE_URL = "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET || "mysecret123";

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  const parts = header.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
  for (const part of parts) {
    const [pair] = part.split(";");
    const [name, ...val] = pair.split("=");
    if (name && val.length > 0) {
      cookies[name.trim()] = val.join("=").trim();
    }
  }
  return cookies;
}

function cookiesToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function runOAuthSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING COMPREHENSIVE GOOGLE OAUTH TEST SUITE");
  console.log("=================================================");

  const timestamp = Date.now();
  const testNewEmail = `oauth.test.newbie.${timestamp}@example.com`;
  const testLimitEmail = `oauth.test.limit.${timestamp}@example.com`;

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      testsFailed++;
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: CSRF Endpoint Verification via Frontend Port 3000
    // -----------------------------------------------------------------
    console.log("\n[1/8] Verifying CSRF token generation on http://localhost:3000/api/auth/csrf...");
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    assert(csrfRes.status === 200, "CSRF endpoint returns 200 OK");

    const csrfData = await csrfRes.json();
    assert(typeof csrfData.csrfToken === "string" && csrfData.csrfToken.length >= 32, "Returns valid CSRF token");

    const csrfCookies = parseCookies(csrfRes.headers.get("set-cookie"));
    assert(Boolean(csrfCookies["next-auth.csrf-token"]), "Issues next-auth.csrf-token cookie");

    // -----------------------------------------------------------------
    // TEST 2: Google Sign-in Initiation on http://localhost:3000/api/auth/signin/google
    // -----------------------------------------------------------------
    console.log("\n[2/8] Verifying Google sign-in initiation on http://localhost:3000/api/auth/signin/google...");
    const signinParams = new URLSearchParams({
      csrfToken: csrfData.csrfToken,
      callbackUrl: "/api/auth/google-login?callbackUrl=%2Ftrips",
      json: "true",
    });

    const signinRes = await fetch(`${BASE_URL}/api/auth/signin/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookiesToHeader(csrfCookies),
      },
      body: signinParams.toString(),
      redirect: "manual",
    });
    assert(signinRes.status === 200, "Signin endpoint returns 200 with JSON redirect payload");

    const signinData = await signinRes.json();
    assert(Boolean(signinData.url), "Response contains authorization URL");

    const authUrl = new URL(signinData.url);
    assert(authUrl.origin === "https://accounts.google.com", "Directs to Google Accounts");
    assert(authUrl.pathname === "/o/oauth2/v2/auth", "Uses Google OAuth2 v2 authorization endpoint");
    assert(authUrl.searchParams.get("client_id") === process.env.GOOGLE_CLIENT_ID, "Uses correct GOOGLE_CLIENT_ID");
    assert(authUrl.searchParams.get("redirect_uri") === "http://localhost:3000/api/auth/callback/google", "Redirect URI is http://localhost:3000/api/auth/callback/google");
    assert(authUrl.searchParams.get("response_type") === "code", "Response type is code");
    assert(authUrl.searchParams.get("scope")?.includes("email") === true, "Scopes include email");

    // -----------------------------------------------------------------
    // TEST 3: OAuth Signup Handoff Simulation (Brand New User)
    // -----------------------------------------------------------------
    console.log(`\n[3/8] Simulating OAuth Signup handoff for new user: ${testNewEmail}...`);
    const newNextAuthJwt = await encode({
      token: {
        id: `google-uid-${timestamp}`,
        email: testNewEmail,
        name: "Test OAuth Newbie",
        role: "OAUTH_HANDOFF",
        provider: "google",
        sub: `google-uid-${timestamp}`,
      },
      secret: SECRET,
      maxAge: 300,
    });

    const signupHandoffRes = await fetch(`${BASE_URL}/api/auth/google-login?callbackUrl=%2Ftrips%2Fexplore`, {
      method: "GET",
      headers: {
        Cookie: `next-auth.session-token=${newNextAuthJwt}`,
      },
      redirect: "manual",
    });

    assert(signupHandoffRes.status === 307, "Handoff returns 307 redirect status");
    const signupRedirectLoc = signupHandoffRes.headers.get("location");
    assert(signupRedirectLoc === `${BASE_URL}/trips/explore`, `Redirects to specified destination: ${BASE_URL}/trips/explore`);

    const signupSetCookies = parseCookies(signupHandoffRes.headers.get("set-cookie"));
    assert(Boolean(signupSetCookies["token"]), "Sets first-party token cookie");
    assert(Boolean(signupSetCookies["refreshToken"]), "Sets first-party refreshToken cookie");
    assert(Boolean(signupSetCookies["deviceId"]), "Sets first-party deviceId cookie");

    // Verify DB user record
    const createdDbUser = await prisma.user.findUnique({
      where: { email: testNewEmail },
    });
    assert(Boolean(createdDbUser), "New user is successfully created in PostgreSQL");
    assert(createdDbUser?.provider === "google", "User provider is 'google'");
    assert(createdDbUser?.role === "USER", "Default user role is 'USER'");
    assert(createdDbUser?.isEmailVerified === true, "OAuth user email is verified automatically");
    assert(Boolean(createdDbUser?.emailVerifiedAt), "Email verification timestamp is recorded");

    // -----------------------------------------------------------------
    // TEST 4: OAuth Login Handoff Simulation (Existing User)
    // -----------------------------------------------------------------
    console.log(`\n[4/8] Simulating OAuth Login handoff for existing user: ${testNewEmail}...`);
    const loginHandoffRes = await fetch(`${BASE_URL}/api/auth/google-login?callbackUrl=%2Fprofile`, {
      method: "GET",
      headers: {
        Cookie: `next-auth.session-token=${newNextAuthJwt}`,
      },
      redirect: "manual",
    });

    assert(loginHandoffRes.status === 307, "Login handoff returns 307 redirect");
    assert(loginHandoffRes.headers.get("location") === `${BASE_URL}/profile`, "Redirects to profile destination");
    const loginSetCookies = parseCookies(loginHandoffRes.headers.get("set-cookie"));
    assert(Boolean(loginSetCookies["token"]), "Issues fresh first-party token cookie on login");
    assert(Boolean(loginSetCookies["refreshToken"]), "Issues fresh refreshToken cookie on login");

    // -----------------------------------------------------------------
    // TEST 5: Verify Session API (/api/auth/me) with OAuth Cookies
    // -----------------------------------------------------------------
    console.log("\n[5/8] Verifying session profile endpoint (/api/auth/me) with OAuth cookies...");
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Cookie: cookiesToHeader(signupSetCookies),
      },
    });
    assert(meRes.status === 200, "/api/auth/me returns 200 OK");
    const meData = await meRes.json();
    assert(meData.user?.email === testNewEmail, "Session user email matches OAuth user");
    assert(meData.user?.role === "USER", "Session user role matches USER");
    assert(Boolean(meData.token), "me response includes access token");
    assert(Boolean(meData.deviceId), "me response includes deviceId");

    // -----------------------------------------------------------------
    // TEST 6: Verify Refresh Rotation (/api/auth/refresh) with OAuth Cookies
    // -----------------------------------------------------------------
    console.log("\n[6/8] Verifying refresh token rotation (/api/auth/refresh) with OAuth cookies...");
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: cookiesToHeader(signupSetCookies),
        Origin: BASE_URL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert(refreshRes.status === 200, "/api/auth/refresh returns 200 OK");
    const refreshData = await refreshRes.json();
    assert(Boolean(refreshData.token), "Returns rotated session access token");
    assert(Boolean(refreshData.refreshToken), "Returns rotated refresh token");

    // -----------------------------------------------------------------
    // TEST 7: OAuth Device Limit Auto-Eviction Test
    // -----------------------------------------------------------------
    console.log(`\n[7/8] Testing OAuth Device Limit Auto-Eviction for ${testLimitEmail}...`);
    // 1. Create a user
    const limitUser = await prisma.user.create({
      data: {
        email: testLimitEmail,
        name: "Limit Test User",
        provider: "google",
        isEmailVerified: true,
        status: "ACTIVE",
      },
    });

    // 2. Pre-populate 5 active devices
    for (let i = 1; i <= 5; i++) {
      await prisma.userDevice.create({
        data: {
          userId: limitUser.id,
          deviceId: `device-existing-${i}-${timestamp}`,
          deviceName: `Test Device ${i}`,
          browser: "Chrome",
          os: "Windows",
          isActive: true,
          lastSeenAt: new Date(Date.now() - (6 - i) * 60000), // oldest is device-existing-1
        },
      });
      await prisma.session.create({
        data: {
          userId: limitUser.id,
          deviceId: `device-existing-${i}-${timestamp}`,
          isActive: true,
          lastSeenAt: new Date(Date.now() - (6 - i) * 60000),
        },
      });
    }

    const preActiveDevices = await prisma.userDevice.count({
      where: { userId: limitUser.id, isActive: true },
    });
    assert(preActiveDevices === 5, "Successfully pre-created 5 active devices");

    // 3. Trigger OAuth handoff for this user on a brand-new device
    const limitJwt = await encode({
      token: {
        id: limitUser.id,
        email: testLimitEmail,
        name: limitUser.name,
        role: "OAUTH_HANDOFF",
        provider: "google",
        sub: limitUser.id,
      },
      secret: SECRET,
      maxAge: 300,
    });

    const limitHandoffRes = await fetch(`${BASE_URL}/api/auth/google-login?callbackUrl=%2F`, {
      method: "GET",
      headers: {
        Cookie: `next-auth.session-token=${limitJwt}`,
      },
      redirect: "manual",
    });

    const actualLimitLoc = limitHandoffRes.headers.get("location");
    console.log("    -> Actual location:", actualLimitLoc);
    assert(limitHandoffRes.status === 307, "OAuth succeeds without failing with 409 or DEVICE_LIMIT_REACHED");
    assert(actualLimitLoc === `${BASE_URL}/` || actualLimitLoc === `${BASE_URL}`, "Redirects to home page");

    const postActiveDevices = await prisma.userDevice.count({
      where: { userId: limitUser.id, isActive: true },
    });
    assert(postActiveDevices <= 3, "Total active devices does not exceed limit (3)");

    const oldestDevice = await prisma.userDevice.findFirst({
      where: { userId: limitUser.id, deviceId: `device-existing-1-${timestamp}` },
    });
    assert(oldestDevice?.isActive === false, "Oldest device was automatically evicted to make room for new OAuth session");

    // -----------------------------------------------------------------
    // TEST 8: Host Mode Target Preservation in OAuth
    // -----------------------------------------------------------------
    console.log("\n[8/8] Testing Host Mode handoff target preservation...");
    const hostTarget = "/host/signup?googleHost=1";
    const hostHandoffRes = await fetch(`${BASE_URL}/api/auth/google-login?callbackUrl=${encodeURIComponent(hostTarget)}`, {
      method: "GET",
      headers: {
        Cookie: `next-auth.session-token=${newNextAuthJwt}`,
      },
      redirect: "manual",
    });
    assert(hostHandoffRes.status === 307, "Host handoff returns 307 redirect");
    assert(hostHandoffRes.headers.get("location") === `${BASE_URL}${hostTarget}`, "Target preserved correctly as /host/signup?googleHost=1");

    console.log("\n=================================================");
    console.log(`🎉 ALL ${testsPassed} TESTS PASSED WITH 0 FAILURES!`);
    console.log("=================================================");
  } finally {
    // Clean up test data
    console.log("\n🧹 Cleaning up test database records...");
    await prisma.user.deleteMany({
      where: {
        email: { in: [testNewEmail, testLimitEmail] },
      },
    }).catch(() => {});
    await prisma.$disconnect();
    console.log("Cleanup completed.");
  }
}

runOAuthSuite().catch((err) => {
  console.error("Test suite encountered unhandled error:", err);
  process.exit(1);
});
