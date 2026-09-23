import crypto from "node:crypto";
import bcrypt from "bcrypt";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const STEP_UP_SECRET = process.env.JWT_SECRET || "travels_pro_admin_step_up_secret";
const STEP_UP_TTL_SECONDS = 15 * 60; // 15 minutes

interface StepUpPayload {
  adminId: string;
  email: string;
  purpose: "kyc_step_up";
  exp: number;
}

/**
 * Creates an HMAC-signed step-up authentication token for sensitive administrative actions.
 */
export function generateStepUpToken(adminId: string, email: string, ttlSeconds = STEP_UP_TTL_SECONDS): string {
  const payload: StepUpPayload = {
    adminId,
    email,
    purpose: "kyc_step_up",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const dataString = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", STEP_UP_SECRET)
    .update(dataString)
    .digest("base64url");

  return `${dataString}.${signature}`;
}

/**
 * Verifies that a step-up token is valid, unexpired, and matches the authenticated admin.
 */
export function verifyStepUpToken(token: string | null | undefined, adminId: string): boolean {
  if (!token || !token.includes(".")) return false;

  const [dataPart, sigPart] = token.split(".");
  if (!dataPart || !sigPart) return false;

  const expectedSig = crypto
    .createHmac("sha256", STEP_UP_SECRET)
    .update(dataPart)
    .digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sigPart), Buffer.from(expectedSig))) {
      return false;
    }

    const payload: StepUpPayload = JSON.parse(Buffer.from(dataPart, "base64url").toString("utf8"));

    if (payload.purpose !== "kyc_step_up") return false;
    if (payload.adminId !== adminId) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies the administrator's password and issues a new step-up session token.
 */
export async function verifyAdminPasswordAndIssueStepUp(adminId: string, password: string) {
  if (!password || typeof password !== "string") {
    throw Object.assign(new Error("Password is required for step-up authentication"), {
      statusCode: 400,
    });
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, password: true, role: true, status: true, isActive: true },
  });

  if (!admin || admin.role !== "ADMIN" || !admin.isActive || !admin.password) {
    throw Object.assign(new Error("Administrator authentication failed"), {
      statusCode: 403,
    });
  }

  const passwordValid = await bcrypt.compare(password, admin.password);
  if (!passwordValid) {
    throw Object.assign(new Error("Invalid administrator password"), {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  const token = generateStepUpToken(admin.id, admin.email, STEP_UP_TTL_SECONDS);

  return {
    stepUpToken: token,
    expiresInSeconds: STEP_UP_TTL_SECONDS,
  };
}

/**
 * Checks whether the incoming request carries a valid admin step-up token.
 */
export function hasValidAdminStepUp(request: NextRequest, adminId: string): boolean {
  const token =
    request.headers.get("x-admin-step-up") ||
    request.cookies.get("admin_step_up")?.value;

  return verifyStepUpToken(token, adminId);
}

/**
 * Throws an HTTP 403 STEP_UP_REQUIRED error if step-up authentication is absent or expired.
 */
export function requireAdminStepUp(request: NextRequest, adminId: string) {
  if (!hasValidAdminStepUp(request, adminId)) {
    throw Object.assign(
      new Error("Step-up authentication required to view sensitive identity documents or decide KYC applications"),
      {
        statusCode: 403,
        code: "STEP_UP_REQUIRED",
      }
    );
  }
}

