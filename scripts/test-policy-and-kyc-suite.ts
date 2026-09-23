import axios from "axios";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";

const BACKEND_BASE = "http://localhost:4000";
axios.defaults.headers.common["Origin"] = "http://localhost:3000";

function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return JSON.stringify(err.response?.data ?? err.message);
  }
  return err instanceof Error ? err.message : String(err);
}

function parseCookies(res: any): { accessToken?: string; refreshToken?: string } {
  const setCookie = res.headers["set-cookie"] || [];
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  for (const cookieStr of setCookie) {
    if (cookieStr.startsWith("access_token=")) {
      accessToken = cookieStr.split(";")[0].replace("access_token=", "");
    }
    if (cookieStr.startsWith("refresh_token=")) {
      refreshToken = cookieStr.split(";")[0].replace("refresh_token=", "");
    }
  }

  return { accessToken, refreshToken };
}

async function runPolicyAndKycSuite() {
  console.log("================================================================");
  console.log("  TRAVELS PRO: TERMS, POLICIES & ENHANCED HOST KYC TEST SUITE  ");
  console.log("================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`, detail || "");
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Retrieve Active Policies (Public Endpoint)
    // -------------------------------------------------------------
    console.log("\n--- Step 1: Active Public Policies Endpoint ---");
    const activePoliciesRes = await axios.get(`${BACKEND_BASE}/api/policies/active`);
    assert(activePoliciesRes.status === 200, "GET /api/policies/active returns 200 OK");
    const policies = activePoliciesRes.data?.data?.policies;
    assert(Array.isArray(policies), "Policies returned as array");
    assert(policies.length >= 5, `Expected at least 5 active policies, found ${policies.length}`);

    const policyTypes = policies.map((p: any) => p.type);
    assert(policyTypes.includes("TERMS_OF_SERVICE"), "Includes TERMS_OF_SERVICE");
    assert(policyTypes.includes("PRIVACY_POLICY"), "Includes PRIVACY_POLICY");
    assert(policyTypes.includes("HOST_SAFETY_AGREEMENT"), "Includes HOST_SAFETY_AGREEMENT");
    assert(policyTypes.includes("TRAVELER_SAFETY_POLICY"), "Includes TRAVELER_SAFETY_POLICY");
    assert(policyTypes.includes("CANCELLATION_POLICY"), "Includes CANCELLATION_POLICY");

    // -------------------------------------------------------------
    // TEST 2: User Registration with Clickwrap Consent Audit Trail
    // -------------------------------------------------------------
    console.log("\n--- Step 2: User Registration with Policy Consent ---");
    const userEmail = `traveler-safety-${Date.now()}@travelspro.test`;
    const userPassword = "SafetyPassword2026!#";

    const registerRes = await axios.post(
      `${BACKEND_BASE}/api/auth/register`,
      {
        name: "Aarav Sharma",
        email: userEmail,
        phone: `+9191${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: userPassword,
        role: "user",
        agreedToTerms: true,
        consentGiven: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TestTravelerAgent/1.0",
        },
      }
    );

    assert(registerRes.status === 201, "User registered successfully (201 Created)");
    const createdUserId = registerRes.data?.user?.id;
    assert(Boolean(createdUserId), "User ID returned in register response");

    const userConsentRecords = await prisma.policyConsent.findMany({
      where: { userId: createdUserId },
      include: { Policy: true },
    });
    assert(userConsentRecords.length >= 1, "PolicyConsent record created on signup");
    assert(Boolean(userConsentRecords[0].consentedAt), "ConsentedAt timestamp recorded");
    assert(userConsentRecords[0].context === "SIGNUP", "Consent context is SIGNUP");
    assert(Boolean(userConsentRecords[0].ipAddress), "Audit IP address captured");

    // Mark user verified and sign in to get active session cookies
    await prisma.user.update({
      where: { id: createdUserId },
      data: { isEmailVerified: true },
    });

    const userLoginRes = await axios.post(`${BACKEND_BASE}/api/auth/login`, {
      email: userEmail,
      password: userPassword,
    });
    const userCookieHeader = (userLoginRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    const authHeaders = {
      Cookie: userCookieHeader,
    };

    // -------------------------------------------------------------
    // TEST 3: User Consent Check (Up to Date)
    // -------------------------------------------------------------
    console.log("\n--- Step 3: Consent Check for Fresh User ---");
    const consentCheckRes = await axios.get(`${BACKEND_BASE}/api/policies/check-consent`, {
      headers: authHeaders,
    });
    assert(consentCheckRes.status === 200, "GET /api/policies/check-consent returns 200");
    assert(consentCheckRes.data?.data?.reconsentRequired === false, "No re-consent required for fresh user");
    assert(consentCheckRes.data?.data?.missingPolicies.length === 0, "Missing policies array is empty");

    // -------------------------------------------------------------
    // TEST 4: Admin Bumps Policy Version (e.g. TERMS_OF_SERVICE v1.1)
    // -------------------------------------------------------------
    console.log("\n--- Step 4: Admin Policy Versioning & Activation ---");
    // Ensure admin user exists with known password
    const adminEmail = "admin@travelspro.test";
    const adminPassword = "AdminSecurePassword2026!#";
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedAdminPassword,
        role: "ADMIN",
        isEmailVerified: true,
      },
      create: {
        name: "System Safety Admin",
        email: adminEmail,
        password: hashedAdminPassword,
        role: "ADMIN",
        isEmailVerified: true,
      },
    });

    const adminUserRecord = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (adminUserRecord) {
      await prisma.userDevice.deleteMany({
        where: { userId: adminUserRecord.id },
      });
    }

    const adminLoginRes = await axios.post(
      `${BACKEND_BASE}/api/auth/login`,
      {
        email: adminEmail,
        password: adminPassword,
      },
      {
        headers: {
          "x-device-id": "test-admin-device-01",
        },
      }
    );
    const adminCookieHeader = (adminLoginRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    const adminAuthHeaders = {
      Cookie: adminCookieHeader,
    };

    // Clean up any existing test versions > 1.0 to ensure idempotent runs
    await prisma.policyConsent.deleteMany({
      where: {
        Policy: {
          type: "TERMS_OF_SERVICE",
          version: { not: "1.0" },
        },
      },
    });
    await prisma.policy.deleteMany({
      where: {
        type: "TERMS_OF_SERVICE",
        version: { not: "1.0" },
      },
    });

    // Create new version v1.1 for TERMS_OF_SERVICE
    const newVersionRes = await axios.post(
      `${BACKEND_BASE}/api/admin/policies`,
      {
        type: "TERMS_OF_SERVICE",
        version: "1.1",
        title: "Terms of Service & Platform User Agreement (Updated 2026)",
        summary: "Updated dispute resolution clauses and mandatory safety disclosures.",
        content: "# Terms of Service v1.1\n\nAll marketplace users must comply with updated 2026 digital safety protocols.",
        effectiveDate: new Date().toISOString(),
        isActive: true,
      },
      { headers: adminAuthHeaders }
    );
    assert(newVersionRes.status === 201, "Admin successfully published TERMS_OF_SERVICE v1.1 (201 Created)");
    const newPolicyId = newVersionRes.data?.data?.policy?.id;
    assert(Boolean(newPolicyId), "New policy ID returned");

    // Verify GET /api/policies/active now reflects v1.1
    const updatedActivePoliciesRes = await axios.get(`${BACKEND_BASE}/api/policies/active`);
    const activeTos = updatedActivePoliciesRes.data?.data?.policies.find((p: any) => p.type === "TERMS_OF_SERVICE");
    assert(activeTos?.version === "1.1", "Active TERMS_OF_SERVICE is now v1.1");

    // -------------------------------------------------------------
    // TEST 5: Blocking Re-consent Triggered for User
    // -------------------------------------------------------------
    console.log("\n--- Step 5: Blocking Re-consent Detection ---");
    const reconsentCheckRes = await axios.get(`${BACKEND_BASE}/api/policies/check-consent`, {
      headers: authHeaders,
    });
    assert(reconsentCheckRes.data?.data?.reconsentRequired === true, "Re-consent correctly triggered for out-of-date user");
    const missing = reconsentCheckRes.data?.data?.missingPolicies;
    assert(missing.length >= 1, "Missing policies contains updated document");
    assert(missing[0].type === "TERMS_OF_SERVICE" && missing[0].version === "1.1", "Missing policy is TERMS_OF_SERVICE v1.1");

    // Login response also signals reconsentRequired
    const userReconsentLoginRes = await axios.post(`${BACKEND_BASE}/api/auth/login`, {
      email: userEmail,
      password: userPassword,
    });
    assert(userReconsentLoginRes.data?.reconsentRequired === true, "Login response warns user that re-consent is required");

    // -------------------------------------------------------------
    // TEST 6: User Accepts New Policy Version (POST /api/policies/consent)
    // -------------------------------------------------------------
    console.log("\n--- Step 6: User Submits Clickwrap Re-consent ---");
    const consentSubmitRes = await axios.post(
      `${BACKEND_BASE}/api/policies/consent`,
      {
        policyId: newPolicyId,
        policyType: "TERMS_OF_SERVICE",
        policyVersion: "1.1",
        consentGiven: true,
      },
      { headers: authHeaders }
    );
    assert(consentSubmitRes.status === 200, "Consent submitted successfully (200 OK)");

    const postConsentCheckRes = await axios.get(`${BACKEND_BASE}/api/policies/check-consent`, {
      headers: authHeaders,
    });
    assert(postConsentCheckRes.data?.data?.reconsentRequired === false, "User re-consent status resolved to false");

    // -------------------------------------------------------------
    // TEST 7: Enhanced Host KYC Application with Photo Proofs & Safety Agreement
    // -------------------------------------------------------------
    console.log("\n--- Step 7: Enhanced Host KYC & Safety Compliance ---");
    const hostEmail = `host-kyc-safety-${Date.now()}@travelspro.test`;
    const hostPassword = "HostSecureKycPassword2026!#";

    const hostRegisterRes = await axios.post(
      `${BACKEND_BASE}/api/auth/register`,
      {
        name: "Tsering Norbu",
        email: hostEmail,
        phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: hostPassword,
        role: "host",
        businessName: "Himalayan High Altitude Guides LLP",
        agreedToTerms: true,
        consentGiven: true,
      },
      { headers: { "Content-Type": "application/json" } }
    );
    // Mark host verified and sign in to get active session cookies
    await prisma.user.update({
      where: { email: hostEmail },
      data: { isEmailVerified: true },
    });

    const hostLoginRes = await axios.post(`${BACKEND_BASE}/api/auth/login`, {
      email: hostEmail,
      password: hostPassword,
    });
    const hostCookieHeader = (hostLoginRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
    const hostAuthHeaders = {
      Cookie: hostCookieHeader,
    };

    const hostKycPayload = {
      hostType: "REGISTERED_BUSINESS",
      firstName: "Tsering",
      lastName: "Norbu",
      dateOfBirth: "1988-06-15T00:00:00.000Z",
      nationality: "Indian",
      idType: "aadhaar",
      idNumber: "5544 3322 1100",
      idFrontImage: "kyc/proofs/aadhaar-front-test.jpg",
      idBackImage: "kyc/proofs/aadhaar-back-test.jpg",
      selfieImage: "kyc/proofs/live-selfie-test.jpg",
      streetAddress: "42 Gompa Road, Near Main Bazaar",
      city: "Leh",
      state: "Ladakh",
      postalCode: "194101",
      country: "India",
      addressProofType: "UTILITY_BILL",
      addressProof: "kyc/proofs/electricity-bill.pdf",
      businessName: "Himalayan High Altitude Guides LLP",
      gstin: "01AAAAA0000A1Z5",
      businessPan: "ABCDE1234F",
      bankAccountName: "Himalayan High Altitude Guides LLP",
      bankAccountNumber: "50200012345678",
      bankIfsc: "HDFC0001234",
      bankName: "HDFC Bank Ltd",
      cancelledChequeImage: "kyc/proofs/cancelled-cheque.jpg",
      emergencyContactName: "Dolma Norbu",
      emergencyContactPhone: "+919876543210",
      emergencyContactRelation: "SPOUSE",
      safetyCertImage: "kyc/proofs/wilderness-first-aid.pdf",
      agreedToHostSafetyPolicy: true,
      consentGiven: true,
    };

    const kycSubmitRes = await axios.post(`${BACKEND_BASE}/api/host/kyc`, hostKycPayload, {
      headers: hostAuthHeaders,
    });
    assert(kycSubmitRes.status === 201, "Host KYC submitted successfully (201 Created)");
    assert(kycSubmitRes.data?.data?.kycApplication?.status === "PENDING", "KYC status set to PENDING");

    // Fetch submitted KYC via GET /api/host/kyc
    const kycGetRes = await axios.get(`${BACKEND_BASE}/api/host/kyc`, { headers: hostAuthHeaders });
    assert(kycGetRes.status === 200, "GET /api/host/kyc returns 200");
    const kycData = kycGetRes.data?.data;
    assert(kycData.hostType === "REGISTERED_BUSINESS", "Host type correctly saved");
    assert(kycData.city === "Leh", "Address city saved");
    assert(kycData.gstin === "01AAAAA0000A1Z5", "GSTIN saved");
    assert(kycData.maskedBankAccountNumber === "•••• •••• 5678", `Bank account properly masked: ${kycData.maskedBankAccountNumber}`);

    // Verify DB encryption: Raw bankAccountNumber must NOT be stored in plain text
    const rawKycDb = await prisma.kycApplication.findFirst({
      where: { Host: { userId: hostRegisterRes.data?.user?.id } },
    });
    assert(Boolean(rawKycDb?.bankAccountNumber), "Bank account number exists in DB");
    assert(
      rawKycDb?.bankAccountNumber !== "50200012345678",
      "Bank account number is securely ENCRYPTED (not plain text) in database"
    );
    assert(
      rawKycDb?.bankAccountNumber?.includes(":") === true,
      "Bank account ciphertext follows IV:ciphertext:authTag AES-GCM format"
    );

    // Verify Host Safety Agreement consent was recorded in PolicyConsent
    const hostSafetyConsent = await prisma.policyConsent.findFirst({
      where: {
        userId: hostRegisterRes.data?.user?.id,
        policyType: "HOST_SAFETY_AGREEMENT",
        context: "HOST_KYC",
      },
      orderBy: { consentedAt: "desc" },
    });
    assert(Boolean(hostSafetyConsent), "Host Safety Agreement consent recorded in audit table");
    assert(Boolean(hostSafetyConsent?.consentedAt), "Host safety consent timestamp recorded");
    assert(hostSafetyConsent?.context === "HOST_KYC", "Host safety consent context is HOST_KYC");

    // -------------------------------------------------------------
    // TEST 8: Admin Consent Audit Trail Verification
    // -------------------------------------------------------------
    console.log("\n--- Step 8: Admin Consent Audit Trail ---");
    const auditRes = await axios.get(`${BACKEND_BASE}/api/admin/policies/audit`, {
      headers: adminAuthHeaders,
    });
    assert(auditRes.status === 200, "Admin can retrieve consent audit trail (200 OK)");
    const auditLogs = auditRes.data?.data?.consents || auditRes.data?.data?.items;
    assert(Array.isArray(auditLogs), "Audit logs returned as array");
    assert(auditLogs.length >= 3, `Expected at least 3 audit entries, found ${auditLogs.length}`);

    // Check that audit logs include user info and policy info
    const firstLog = auditLogs[0];
    assert(Boolean(firstLog.User?.email || firstLog.user?.email), "Audit log contains user email");
    assert(Boolean(firstLog.Policy?.title || firstLog.policy?.title), "Audit log contains policy title");

    // -------------------------------------------------------------
    // CLEANUP: Restore TERMS_OF_SERVICE v1.0 active
    // -------------------------------------------------------------
    console.log("\n--- Cleanup: Deactivating v1.1 test policy ---");
    const tos1_0 = await prisma.policy.findFirst({
      where: { type: "TERMS_OF_SERVICE", version: "1.0" },
    });
    if (tos1_0) {
      await prisma.policy.updateMany({
        where: { type: "TERMS_OF_SERVICE" },
        data: { isActive: false },
      });
      await prisma.policy.update({
        where: { id: tos1_0.id },
        data: { isActive: true },
      });
      console.log("  ✓ TERMS_OF_SERVICE v1.0 restored as active");
    }

    console.log("\n================================================================");
    console.log(`  ALL TESTS PASSED! (${passedTests}/${totalTests})`);
    console.log("================================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", formatError(err));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPolicyAndKycSuite();
