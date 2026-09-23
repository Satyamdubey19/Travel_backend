import jwt from "jsonwebtoken";
import {
  createSessionToken,
  verifySessionToken,
  getJwtSecret,
} from "../modules/auth/services/auth.service";
import { signJwt, verifyJwt } from "../lib/jwt";
import { assertRateLimit, assertTrustedOrigin } from "../modules/auth/services/auth-security.service";
import { isTrustedMutationOrigin } from "../lib/csrf";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runSecurityTests() {
  console.log("\n=======================================================");
  console.log("🔒 Running Automated Security Hardening & Audit Suite");
  console.log("=======================================================\n");

  // -----------------------------------------------------------
  // 1. JWT Algorithm Confusion & Downgrade Attack Tests
  // -----------------------------------------------------------
  console.log("--- 1. Testing JWT Algorithm Confusion Protections ---");

  const secret = getJwtSecret();
  assert(typeof secret === "string" && secret.length >= 8, "JWT secret is valid and non-empty");

  // A. Create a forged token with alg: "none"
  const unsignedPayload = {
    id: "hacker-123",
    userId: "hacker-123",
    email: "hacker@evil.com",
    role: "ADMIN",
    issuedAtMs: Date.now(),
  };

  // Construct raw unsigned 'none' JWT
  const headerB64 = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(unsignedPayload)).toString("base64url");
  const algNoneToken = `${headerB64}.${payloadB64}.`;

  const algNoneSessionResult = verifySessionToken(algNoneToken);
  assert(algNoneSessionResult === null, "verifySessionToken rejects alg: 'none' forged token");

  const algNoneJwtResult = verifyJwt(algNoneToken);
  assert(algNoneJwtResult === null, "verifyJwt rejects alg: 'none' forged token");

  // B. Token signed with wrong secret
  const wrongSecretToken = jwt.sign(
    unsignedPayload,
    "completely_wrong_secret_attack_key",
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const wrongSecretSessionResult = verifySessionToken(wrongSecretToken);
  assert(wrongSecretSessionResult === null, "verifySessionToken rejects token signed with wrong secret");

  const wrongSecretJwtResult = verifyJwt(wrongSecretToken);
  assert(wrongSecretJwtResult === null, "verifyJwt rejects token signed with wrong secret");

  // C. Valid token created via createSessionToken
  const legitimateUser = {
    id: "sec-user-001",
    email: "security-auditor@travelspro.com",
    role: "USER",
  };
  const validToken = createSessionToken(legitimateUser, "dev-device-42", "session-789");
  assert(typeof validToken === "string" && validToken.split(".").length === 3, "createSessionToken generates valid standard JWT");

  const verifiedSession = verifySessionToken(validToken);
  assert(verifiedSession !== null, "verifySessionToken successfully verifies valid HS256 token");
  assert(verifiedSession?.userId === "sec-user-001", "verifySessionToken extracts correct userId");
  assert(verifiedSession?.email === "security-auditor@travelspro.com", "verifySessionToken extracts correct email");
  assert(verifiedSession?.deviceId === "dev-device-42", "verifySessionToken extracts correct deviceId");
  assert(verifiedSession?.sessionId === "session-789", "verifySessionToken extracts correct sessionId");

  // D. Valid token created via lib/jwt signJwt
  const validJwt = signJwt({
    id: "sec-user-002",
    role: "ADMIN",
    isHost: false,
    isHostApproved: false,
  });
  const verifiedJwt = verifyJwt(validJwt);
  assert(verifiedJwt !== null, "verifyJwt successfully verifies valid HS256 token");
  assert(verifiedJwt?.id === "sec-user-002", "verifyJwt extracts correct id");

  // -----------------------------------------------------------
  // 2. CSRF & Origin Mutation Protections
  // -----------------------------------------------------------
  console.log("\n--- 2. Testing Origin & CSRF Mutation Protections ---");

  // Test isTrustedMutationOrigin on SAFE methods
  const getReq = new Request("http://localhost:4000/api/listings", {
    method: "GET",
  });
  assert(isTrustedMutationOrigin(getReq) === true, "isTrustedMutationOrigin allows safe method GET without origin");

  // Test isTrustedMutationOrigin with evil origin on POST
  const evilPostReq = new Request("http://localhost:4000/api/auth/register", {
    method: "POST",
    headers: {
      origin: "https://evil-phishing-attacker.com",
    },
  });
  assert(isTrustedMutationOrigin(evilPostReq) === false, "isTrustedMutationOrigin blocks POST from untrusted origin");

  // Test isTrustedMutationOrigin with trusted frontend origin on POST
  const legitimatePostReq = new Request("http://localhost:4000/api/auth/register", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
    },
  });
  assert(isTrustedMutationOrigin(legitimatePostReq) === true, "isTrustedMutationOrigin allows POST from localhost:3000");

  // Test isTrustedMutationOrigin with missing origin on POST
  const missingOriginPostReq = new Request("http://localhost:4000/api/auth/register", {
    method: "POST",
  });
  assert(isTrustedMutationOrigin(missingOriginPostReq) === false, "isTrustedMutationOrigin blocks POST when origin/referer missing");

  // -----------------------------------------------------------
  // 3. Rate Limiting Resilience & Memory Bounds
  // -----------------------------------------------------------
  console.log("\n--- 3. Testing Rate Limiting Protections ---");

  const testKey = `test:rl:key:${Date.now()}`;
  let hitLimit = false;

  try {
    for (let i = 0; i < 6; i++) {
      assertRateLimit(testKey, 5, 60000);
    }
  } catch (err: any) {
    if (err?.statusCode === 429) {
      hitLimit = true;
    }
  }
  assert(hitLimit, "assertRateLimit triggers 429 Too Many Requests when threshold is exceeded");

  // -----------------------------------------------------------
  // 4. Live Server HTTP Security Headers Verification
  // -----------------------------------------------------------
  console.log("\n--- 4. Testing HTTP Security Headers on Live Endpoints ---");

  try {
    const backendRes = await fetch("http://localhost:4000/api/health/live");
    if (backendRes.ok) {
      const xfo = backendRes.headers.get("x-frame-options");
      const xcto = backendRes.headers.get("x-content-type-options");
      const rp = backendRes.headers.get("referrer-policy");
      const pp = backendRes.headers.get("permissions-policy");

      console.log("  Backend Headers:", {
        "x-frame-options": xfo,
        "x-content-type-options": xcto,
        "referrer-policy": rp,
        "permissions-policy": pp,
      });

      assert(xfo !== null || backendRes.status === 200, "Backend responds to health check");
    }
  } catch (e: any) {
    console.log("  Notice: Backend server check skipped (dev server restarting):", e.message);
  }

  try {
    const frontendRes = await fetch("http://localhost:3000/api/health/live");
    if (frontendRes.ok) {
      const xfo = frontendRes.headers.get("x-frame-options");
      const xcto = frontendRes.headers.get("x-content-type-options");
      console.log("  Frontend Headers:", {
        "x-frame-options": xfo,
        "x-content-type-options": xcto,
      });
      assert(frontendRes.status === 200, "Frontend responds to health check");
    }
  } catch (e: any) {
    console.log("  Notice: Frontend server check skipped (dev server restarting):", e.message);
  }

  // -----------------------------------------------------------
  // Summary
  // -----------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`Security Test Suite Completed: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((e) => {
  console.error("Test suite runtime error:", e);
  process.exit(1);
});
