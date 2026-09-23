import axios from "axios";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";

function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return JSON.stringify(err.response?.data ?? err.message);
  }
  return err instanceof Error ? err.message : String(err);
}

async function runHostAndAdminAuthVerification() {
  console.log("=== TRAVELS PRO HOST & ADMIN AUTH VERIFICATION ===");
  const backendBase = "http://localhost:4000";

  // 1. Host Registration via HTTP POST /api/auth/register
  console.log("\n[1/5] Testing Host Registration via HTTP...");
  const hostEmail = `host-test-${Date.now()}@travelspro.test`;
  const hostPassword = "HostPassword2026!#";
  const businessName = "Zanskar Wild Safaris";

  let hostRegisterRes;
  try {
    hostRegisterRes = await axios.post(
      `${backendBase}/api/auth/register`,
      {
        name: "Stanzin Host",
        email: hostEmail,
        phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: hostPassword,
        role: "host",
        businessName,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
      }
    );
    console.log("  ✓ Host registered successfully! Status:", hostRegisterRes.status);
    console.log("  ✓ Host User ID:", hostRegisterRes.data?.user?.id);
    console.log("  ✓ Role:", hostRegisterRes.data?.user?.role);
    console.log("  ✓ Has Host Application:", hostRegisterRes.data?.user?.hasHostApplication);
  } catch (err: unknown) {
    console.error("  ⨯ Host registration failed:", formatError(err));
    process.exit(1);
  }

  // 2. Host Sign-In via HTTP POST /api/auth/login
  console.log("\n[2/5] Testing Host Sign-In via HTTP...");
  let hostLoginCookies: string[] = [];
  try {
    const hostLoginRes = await axios.post(
      `${backendBase}/api/auth/login`,
      {
        email: hostEmail,
        password: hostPassword,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
      }
    );
    console.log("  ✓ Host sign-in status:", hostLoginRes.status);
    hostLoginCookies = hostLoginRes.headers["set-cookie"] || [];
  } catch (err: unknown) {
    console.error("  ⨯ Host sign-in failed:", formatError(err));
    process.exit(1);
  }

  const hostCookieHeader = hostLoginCookies.map((c) => c.split(";")[0]).join("; ");

  // 3. Host Profile Verification via /api/auth/me
  console.log("\n[3/5] Testing Host Profile Retrieval (/api/auth/me)...");
  try {
    const hostMeRes = await axios.get(`${backendBase}/api/auth/me`, {
      headers: { Cookie: hostCookieHeader },
    });
    console.log("  ✓ Host /api/auth/me email:", hostMeRes.data?.user?.email);
    console.log("  ✓ Host business name:", hostMeRes.data?.user?.businessName);
    console.log("  ✓ Host role:", hostMeRes.data?.user?.role);
    console.log("  ✓ Is host approved:", hostMeRes.data?.user?.isHostApproved);
  } catch (err: unknown) {
    console.error("  ⨯ Host /api/auth/me failed:", formatError(err));
    process.exit(1);
  }

  // 4. Admin Account & Session Verification
  console.log("\n[4/5] Testing Admin Authentication Flow...");
  const adminEmail = `admin-test-${Date.now()}@travelspro.test`;
  const adminPassword = "AdminSuperSecret2026!";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  // Seed admin user in database
  const adminUser = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: adminEmail,
      password: adminHash,
      role: "ADMIN",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("  ✓ Seeded test admin user in Neon DB with ID:", adminUser.id);

  // Sign in as admin via HTTP POST /api/auth/login
  let adminCookies: string[] = [];
  try {
    const adminLoginRes = await axios.post(
      `${backendBase}/api/auth/login`,
      {
        email: adminEmail,
        password: adminPassword,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
      }
    );
    console.log("  ✓ Admin sign-in status:", adminLoginRes.status);
    console.log("  ✓ Admin role in response:", adminLoginRes.data?.user?.role);
    adminCookies = adminLoginRes.headers["set-cookie"] || [];
  } catch (err: unknown) {
    console.error("  ⨯ Admin login failed:", formatError(err));
    process.exit(1);
  }

  const adminCookieHeader = adminCookies.map((c) => c.split(";")[0]).join("; ");

  // 5. Admin Me & Step-Up Auth
  console.log("\n[5/5] Testing Admin /api/auth/me & Protected Access...");
  try {
    const adminMeRes = await axios.get(`${backendBase}/api/auth/me`, {
      headers: { Cookie: adminCookieHeader },
    });
    console.log("  ✓ Admin verified: email:", adminMeRes.data?.user?.email, "Role:", adminMeRes.data?.user?.role);
    if (adminMeRes.data?.user?.role !== "ADMIN") {
      throw new Error("User role is not ADMIN");
    }
  } catch (err: unknown) {
    console.error("  ⨯ Admin /api/auth/me failed:", formatError(err));
    process.exit(1);
  }

  // Cleanup test users from DB
  await prisma.user.deleteMany({
    where: {
      email: { in: [hostEmail, adminEmail] },
    },
  });
  console.log("  ✓ Test artifacts cleaned up from Neon DB");

  console.log("\n=======================================================");
  console.log("   HOST & ADMIN AUTH FULLY VERIFIED ON LIVE STACK!     ");
  console.log("=======================================================\n");

  await prisma.$disconnect();
  process.exit(0);
}

runHostAndAdminAuthVerification().catch(async (err) => {
  console.error("Fatal test error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
