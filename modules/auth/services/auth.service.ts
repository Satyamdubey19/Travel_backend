import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/hash";
import { sendAuthEmail, sendVerificationEmail } from "@/lib/mail";
import {
  assertAuthEmailDeliveryConfigured,
  authEmailDeliveryFailure,
} from "@/lib/auth-email-policy";
import { Prisma, PolicyType } from "@prisma/client";
import type { Gender } from "@prisma/client";
import type { AuthRole, LoginInput, RegisterInput } from "@/modules/auth/types/auth";
import { isTokenRevoked } from "@/modules/auth/services/auth-security.service";
import { isSessionTokenInvalidated } from "@/modules/auth/services/auth-session-policy";
import {
  accountAuthenticationBlockReason,
  accountCanAuthenticate,
  accountCanVerifyEmail,
  credentialLoginBlockReason,
  hasApprovedHostAccess,
} from "@/modules/auth/services/auth-policy";
import { credentialReauthenticationFailure } from "@/modules/auth/services/auth-credential-policy";
import {
  deleteEmailVerificationToken,
  deleteActiveDeviceSession,
  deleteRefreshToken,
  deleteUserActiveDeviceSessions,
  deleteUserRefreshTokens,
  getEmailVerificationToken,
  setEmailVerificationToken,
  storeActiveDeviceSession,
  storeRefreshToken,
} from "@/services/redis.service";

const passwordRounds = 12;
const sessionTtl = "15m";
const refreshTokenTtlMs = 1000 * 60 * 60 * 24 * 30;
const refreshTokenTtlSeconds = refreshTokenTtlMs / 1000;
export const maxActiveDevices = 3;
const passwordResetTtlMs = 1000 * 60 * 60;
const emailVerificationTtlMs = 1000 * 60 * 60 * 24;
const emailVerificationTtlSeconds = emailVerificationTtlMs / 1000;
const emailChangeTtlMs = 1000 * 60 * 60;
const dummyPasswordHash = "$2b$12$J5mwthkzJDbOt3ElCdU5/uCF9tUoz0B0brOcFVAw4DvIN7uo/LCO6";

interface GoogleAuthInput {
  email: string;
  name?: string | null;
  providerId?: string | null;
}

type DbUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  provider?: string;
  status?: string;
  isActive?: boolean;
  isBanned?: boolean;
  deletedAt?: Date | null;
  lockedUntil?: Date | null;
  failedLoginAttempts?: number;
  emailVerifiedAt?: Date | null;
  sessionInvalidatedAt?: Date | null;
};

export type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
};

type DeviceListItem = {
  id: string;
  deviceId: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastSeenAt: Date;
  isCurrent: boolean;
};

export class DeviceLimitReachedError extends Error {
  statusCode = 409;
  code = "DEVICE_LIMIT_REACHED";
  devices: DeviceListItem[];

  constructor(devices: DeviceListItem[]) {
    super("Maximum device limit reached");
    this.devices = devices;
  }
}

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Valid phone is required")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value.trim() : undefined));

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  phone: phoneSchema,
  password: z.string().min(12, "Password must be at least 12 characters").max(128, "Password must be 128 characters or less"),
  role: z.enum(["user", "host", "USER", "HOST"]).optional(),
  businessName: z.string().trim().max(160, "Business name must be 160 characters or less").optional(),
  agreedToTerms: z.boolean().optional(),
  consentGiven: z.boolean().optional(),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  password: z.string().min(1, "Password is required"),
}).strict();

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
}).strict();

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  token: z.string().trim().min(1, "Reset token is required"),
  password: z.string().min(12, "Password must be at least 12 characters").max(128, "Password must be 128 characters or less"),
}).strict();

const emailChangeRequestSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  password: z.string().min(1, "Current password is required").max(128, "Password must be 128 characters or less"),
}).strict();

const emailChangeConfirmationSchema = z.object({
  requestId: z.string().uuid("Invalid email-change link"),
  token: z.string().trim().min(1, "Invalid email-change link"),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128, "Password must be 128 characters or less"),
  newPassword: z.string().min(12, "Password must be at least 12 characters").max(128, "Password must be 128 characters or less"),
}).strict();

const replaceDeviceLoginSchema = loginSchema.extend({
  deviceToLogout: z.string().trim().min(1, "Device to logout is required"),
}).strict();

const optionalTrimmedString = (max: number, field: string) =>
  z
    .string()
    .trim()
    .max(max, `${field} must be ${max} characters or less`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value.trim() : undefined));

const updateUserSchema = z.object({
  name: optionalTrimmedString(100, "Name"),
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long").optional(),
  phone: phoneSchema,
  businessName: optionalTrimmedString(160, "Business name"),
  activateHost: z.boolean().optional(),
  location: optionalTrimmedString(120, "Location"),
  bio: optionalTrimmedString(1000, "Bio"),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), "Valid date of birth is required"),
  gender: optionalTrimmedString(40, "Gender"),
  nationality: optionalTrimmedString(80, "Nationality"),
  address: optionalTrimmedString(250, "Address"),
  emergencyContactName: optionalTrimmedString(100, "Emergency contact name"),
  emergencyContactPhone: phoneSchema,
  website: z.string().trim().url("Valid website URL is required").max(200, "Website must be 200 characters or less").optional().or(z.literal("")).transform((value) => (value ? value.trim() : undefined)),
  instagram: optionalTrimmedString(80, "Instagram"),
  twitter: optionalTrimmedString(80, "Twitter"),
  travelStyle: optionalTrimmedString(80, "Travel style"),
  preferredCurrency: optionalTrimmedString(10, "Preferred currency"),
  preferredLanguage: optionalTrimmedString(40, "Preferred language"),
  dietaryPreferences: optionalTrimmedString(160, "Dietary preferences"),
  passportNumber: optionalTrimmedString(40, "Passport number"),
  frequentFlyerNumber: optionalTrimmedString(40, "Frequent flyer number"),
}).strict();

function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new Error(result.error.issues[0]?.message ?? "Invalid request payload");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRole(role?: string): AuthRole {
  const upper = role?.toUpperCase();
  if (upper === "ADMIN" || upper === "HOST") {
    return upper;
  }
  return "USER";
}

function assertActiveAccount(user: DbUser) {
  const reason = accountAuthenticationBlockReason(user)
  if (reason) {
    const error = new Error(reason) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

function assertAccountCanVerify(user: DbUser) {
  if (!accountCanVerifyEmail(user)) {
    const error = new Error("Account is not allowed to authenticate") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

function isAccountUsable(user: DbUser) {
  return accountCanAuthenticate(user);
}

function safePrismaError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2002") {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "field");
    if (fields.includes("phone")) {
      return "Phone already exists";
    }
    if (fields.includes("email")) {
      return "Email already exists";
    }
    return "Duplicate value already exists";
  }

  return error instanceof Error ? error.message : "Request failed";
}

function normalizeGender(value?: string | null): Gender | null {
  const upper = value?.trim().toUpperCase().replace(/[\s-]+/g, "_")
  if (upper === "MALE" || upper === "FEMALE" || upper === "NON_BINARY" || upper === "PREFER_NOT_TO_SAY") {
    return upper as Gender
  }
  return null
}

function sanitizedContext(context?: AuthRequestContext) {
  return {
    ipAddress: context?.ipAddress || "unknown",
    userAgent: context?.userAgent?.slice(0, 500),
    deviceId: context?.deviceId?.slice(0, 120),
    deviceName: context?.deviceName?.slice(0, 160),
    browser: context?.browser?.slice(0, 80),
    os: context?.os?.slice(0, 80),
  };
}

async function recordSecurityEvent(userId: string, type: string, context?: AuthRequestContext, metadata?: Record<string, unknown>) {
  const ctx = sanitizedContext(context);
  const jsonMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue : undefined;
  await prisma.securityEvent.create({
    data: {
      userId,
      type,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: jsonMetadata,
    },
  }).catch((error) => {
    console.error("Failed to record security event:", error);
  });
}

async function recordLoginAttempt(email: string, success: boolean, context?: AuthRequestContext) {
  const ctx = sanitizedContext(context);
  await prisma.loginAttempt.create({
    data: {
      email,
      ipAddress: ctx.ipAddress,
      success,
    },
  }).catch((error) => {
    console.error("Failed to record login attempt:", error);
  });
}

function nextLockUntil(attempts: number) {
  if (attempts >= 20) {
    return new Date(Date.now() + 1000 * 60 * 60 * 24);
  }
  if (attempts >= 10) {
    return new Date(Date.now() + 1000 * 60 * 60);
  }
  if (attempts >= 5) {
    return new Date(Date.now() + 1000 * 60 * 15);
  }
  return null;
}

async function registerFailedLogin(user: DbUser, email: string, context?: AuthRequestContext) {
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  const lockedUntil = nextLockUntil(attempts);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil,
      ...(attempts >= 20 ? { status: "SUSPENDED" } : {}),
    },
  });

  await recordLoginAttempt(email, false, context);
  await recordSecurityEvent(user.id, lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED", context, { failedLoginAttempts: attempts });
}

function toDeviceListItem(device: {
  deviceId: string;
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: Date | null;
  isCurrent?: boolean | null;
}): DeviceListItem {
  return {
    id: device.deviceId,
    deviceId: device.deviceId,
    deviceName: device.deviceName ?? null,
    browser: device.browser ?? null,
    os: device.os ?? null,
    ipAddress: device.ipAddress ?? null,
    lastSeenAt: device.lastSeenAt ?? new Date(),
    isCurrent: Boolean(device.isCurrent),
  };
}

async function listActiveDevicesForUser(userId: string, currentDeviceId?: string) {
  const devices = await prisma.userDevice.findMany({
    where: { userId, isActive: true },
    orderBy: { lastSeenAt: "desc" },
  });

  return devices.map((device) => toDeviceListItem({
    ...device,
    isCurrent: currentDeviceId ? device.deviceId === currentDeviceId : device.isCurrent,
  }));
}

async function createRefreshAuth(user: Pick<DbUser, "id">, context?: AuthRequestContext) {
  const ctx = sanitizedContext(context);
  const deviceId = ctx.deviceId || "unknown";
  const rawRefreshToken = generateToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

  const sessionId = await prisma.$transaction(async (tx) => {
    const activeDevices = await tx.userDevice.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { lastSeenAt: "desc" },
    });
    const currentDevice = activeDevices.find((device) => device.deviceId === deviceId);

    if (!currentDevice && activeDevices.length >= maxActiveDevices) {
      throw new DeviceLimitReachedError(activeDevices.map(toDeviceListItem));
    }

    await tx.session.updateMany({
      where: { userId: user.id, deviceId, isActive: true },
      data: { isActive: false, lastSeenAt: new Date() },
    });

    const session = await tx.session.create({
      data: {
        userId: user.id,
        deviceId,
        deviceName: ctx.deviceName,
        deviceType: "browser",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceId,
        deviceName: ctx.deviceName,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        expiresAt,
      },
    });

    await tx.userDevice.updateMany({
      where: { userId: user.id, isCurrent: true },
      data: { isCurrent: false },
    });

    await tx.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName: ctx.deviceName,
        deviceType: "browser",
        browser: ctx.browser,
        os: ctx.os,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        lastSeenAt: new Date(),
        isCurrent: true,
        isActive: true,
        refreshTokenHash: tokenHash,
      },
      update: {
        deviceName: ctx.deviceName,
        browser: ctx.browser,
        os: ctx.os,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        lastSeenAt: new Date(),
        isCurrent: true,
        isActive: true,
        refreshTokenHash: tokenHash,
      },
    });
    return session.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await storeRefreshToken(tokenHash, {
    userId: user.id,
    deviceId,
    deviceName: ctx.deviceName,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    createdAt: new Date().toISOString(),
  }, refreshTokenTtlSeconds).catch((error) => {
    console.error("Failed to store refresh token in Redis:", error);
  });

  await storeActiveDeviceSession(user.id, deviceId, refreshTokenTtlSeconds).catch((error) => {
    console.error("Failed to store active device session in Redis:", error);
  });

  return { rawRefreshToken, sessionId };
}

async function resetLoginState(userId: string, context?: AuthRequestContext) {
  const ctx = sanitizedContext(context);
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
  await prisma.session.updateMany({
    where: {
      userId,
      isActive: true,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
    data: {
      lastSeenAt: new Date(),
    },
  });
}

export function getJwtSecret() {
  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }
  return secret;
}

export function createSessionToken(
  user: Pick<DbUser, "id" | "role" | "email">,
  deviceId?: string,
  sessionId?: string,
) {
  return jwt.sign(
    {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: normalizeRole(user.role),
      issuedAtMs: Date.now(),
      ...(deviceId ? { deviceId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    getJwtSecret(),
    { expiresIn: sessionTtl, algorithm: "HS256" },
  );
}

export function verifySessionToken(token: string) {
  if (!token || typeof token !== "string" || isTokenRevoked(token)) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload) {
      return null;
    }
    const obj = payload as { id?: string; userId?: string; email: string; role: AuthRole; iat?: number; exp?: number; issuedAtMs?: number; deviceId?: string; sessionId?: string };
    const id = obj.id || obj.userId;
    if (!id) return null;
    return { ...obj, id, userId: id };
  } catch {
    return null;
  }
}

async function getHostProfile(userId: string) {
  return prisma.host.findFirst({
    where: {
      userId,
    },
  });
}

export async function toAuthUser(user: DbUser) {
  const role = normalizeRole(user.role);
  const host = await getHostProfile(user.id);
  const isHost = hasApprovedHostAccess({
    role,
    isActive: host?.isActive,
    isApproved: host?.isApproved,
    isVerified: host?.isVerified,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    businessName: host?.businessName ?? null,
    role,
    isHost,
    hasHostApplication: Boolean(host),
    isHostApproved: Boolean(host?.isApproved),
    provider: user.provider ?? "credentials",
  };
}

export async function registerUser(input: RegisterInput, context?: AuthRequestContext) {
  const parsed = parseOrThrow(registerSchema, input);
  // A registration is not successful until its verification message can be
  // delivered. Check before hashing or persisting an unusable account.
  assertAuthEmailDeliveryConfigured();
  const email = normalizeEmail(parsed.email);
  const requestedRole = normalizeRole(parsed.role);
  const role = requestedRole === "HOST" ? "USER" : requestedRole;

  if (requestedRole === "ADMIN") {
    throw new Error("Admin accounts cannot be created from signup");
  }

  if (requestedRole === "HOST" && !parsed.businessName?.trim()) {
    throw new Error("Business name is required for host signup");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email already exists");
  }

  if (parsed.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: parsed.phone } });
    if (existingPhone) {
      throw new Error("Phone already exists");
    }
  }

  const hashedPassword = await bcrypt.hash(parsed.password, passwordRounds);
  const rawToken = generateToken();
  const verificationToken = hashToken(rawToken);
  const verificationExpiry = new Date(Date.now() + emailVerificationTtlMs);

  const shouldAutoVerify = process.env.NODE_ENV !== "production"
    || process.env.AUTO_VERIFY_EMAIL === "true"
    || process.env.BREVO_API_KEY?.includes("mock")
    || !process.env.BREVO_API_KEY;

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.name,
        email,
        phone: parsed.phone,
        password: hashedPassword,
        role,
        status: "ACTIVE",
        provider: "credentials",
        isEmailVerified: shouldAutoVerify,
        emailVerifiedAt: shouldAutoVerify ? new Date() : null,
        verificationToken: shouldAutoVerify ? null : verificationToken,
        verificationExpiry: shouldAutoVerify ? null : verificationExpiry,
      },
    });
  } catch (error) {
    throw new Error(safePrismaError(error));
  }

  if (requestedRole === "HOST") {
    await prisma.host.create({
      data: {
        userId: user.id,
        businessName: parsed.businessName?.trim(),
        contactEmail: user.email,
        supportPhone: user.phone,
        isVerified: shouldAutoVerify,
      },
    });
  }

  // Record initial clickwrap policy consents
  try {
    const policyTypes: PolicyType[] = requestedRole === "HOST"
      ? [PolicyType.TERMS_OF_SERVICE, PolicyType.PRIVACY_POLICY, PolicyType.HOST_SAFETY_AGREEMENT]
      : [PolicyType.TERMS_OF_SERVICE, PolicyType.PRIVACY_POLICY];

    const activePolicies = await prisma.policy.findMany({
      where: {
        type: { in: policyTypes },
        isActive: true,
      },
    });

    for (const pol of activePolicies) {
      await prisma.policyConsent.create({
        data: {
          userId: user.id,
          policyId: pol.id,
          policyType: pol.type,
          policyVersion: pol.version,
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
          context: "SIGNUP",
        },
      });
    }
  } catch (consentErr) {
    console.error("Failed to record policy consent during signup:", consentErr);
  }

  if (!shouldAutoVerify) {
    const storedVerificationInRedis = await setEmailVerificationToken(email, verificationToken, emailVerificationTtlSeconds).catch((error) => {
      console.error("Failed to store email verification token in Redis:", error);
      return false;
    });

    if (storedVerificationInRedis) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: null,
          verificationExpiry: null,
        },
      });
    }
  }

  try {
    await sendVerificationEmail(user.email, rawToken, user.name);
  } catch (error) {
    if (!shouldAutoVerify) {
      await deleteEmailVerificationToken(email).catch(() => false);
      await prisma.user.delete({ where: { id: user.id } }).catch((cleanupError) => {
        console.error("Failed to remove incomplete registration", { name: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
      });
      if (error instanceof Error && "statusCode" in error) throw error;
      throw authEmailDeliveryFailure();
    }
    console.warn("Dev registration email send skipped or failed gracefully:", (error as Error).message);
  }

  await recordSecurityEvent(user.id, "REGISTERED", context);

  return {
    user: await toAuthUser(user),
  };
}

async function authenticateLoginInput(input: LoginInput, context?: AuthRequestContext) {
  const parsed = parseOrThrow(loginSchema, input);
  const email = normalizeEmail(parsed.email);
  let user: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    // Keep the client response generic, but retain enough server-side detail to
    // diagnose schema/connection drift without logging credentials or URLs.
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage
      .replace(/(?:postgres(?:ql)?|redis(?:s)?):\/\/\S+/gi, "[redacted-url]")
      .replace(/password\s*=\s*[^\s;]+/gi, "password=[redacted]")
      .slice(0, 500);
    console.error("Auth user lookup failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code,
      message,
    });
    throw error;
  }

  if (!user?.password) {
    await bcrypt.compare(parsed.password, dummyPasswordHash);
    await recordLoginAttempt(email, false, context);
    throw new Error("Incorrect email or password");
  }

  const isValidPassword = await bcrypt.compare(parsed.password, user.password);
  if (!isValidPassword) {
    await registerFailedLogin(user, email, context);
    throw new Error("Incorrect email or password");
  }

  const blockReason = credentialLoginBlockReason(user, true);
  if (blockReason) {
    const error = new Error(blockReason) as Error & { statusCode?: number };
    error.statusCode = blockReason.startsWith("Account is temporarily locked") ? 423 : 403;
    throw error;
  }

  const authUser = await toAuthUser(user);
  return { user, authUser, email };
}

export async function LoginUser(input: LoginInput, context?: AuthRequestContext) {
  const { user, authUser, email } = await authenticateLoginInput(input, context);

  await resetLoginState(user.id, context);
  let refreshToken: string;
  let sessionId: string;
  try {
    const created = await createRefreshAuth(user, context);
    refreshToken = created.rawRefreshToken;
    sessionId = created.sessionId;
  } catch (error) {
    if (error instanceof DeviceLimitReachedError) {
      await recordSecurityEvent(user.id, "DEVICE_LIMIT_REACHED", context, { deviceId: context?.deviceId });
    }
    throw error;
  }
  await recordLoginAttempt(email, true, context);
  await recordSecurityEvent(user.id, "LOGIN_SUCCESS", context);
  await recordSecurityEvent(user.id, "DEVICE_LOGIN", context, { deviceId: context?.deviceId });

  await sendAuthEmail({ to: user.email, name: user.name, type: "login" }).catch((error) => {
    console.error("Failed to send login email:", error);
  });

  // Check if user has consented to latest active policies
  let reconsentRequired = false;
  const pendingPolicies: Array<{ id: string; type: string; version: string; title: string; summary: string | null }> = [];
  try {
    const activeMandatory = await prisma.policy.findMany({
      where: {
        type: {
          in: user.role === "HOST"
            ? [PolicyType.TERMS_OF_SERVICE, PolicyType.PRIVACY_POLICY, PolicyType.HOST_SAFETY_AGREEMENT]
            : [PolicyType.TERMS_OF_SERVICE, PolicyType.PRIVACY_POLICY],
        },
        isActive: true,
      },
    });

    const userConsents = await prisma.policyConsent.findMany({
      where: { userId: user.id },
      select: { policyType: true, policyVersion: true },
    });

    for (const pol of activeMandatory) {
      const accepted = userConsents.some(
        (c) => c.policyType === pol.type && c.policyVersion === pol.version
      );
      if (!accepted) {
        pendingPolicies.push({
          id: pol.id,
          type: pol.type,
          version: pol.version,
          title: pol.title,
          summary: pol.summary,
        });
      }
    }
    reconsentRequired = pendingPolicies.length > 0;
  } catch (err) {
    console.error("Failed to check policy consent status during login:", err);
  }

  const authUserWithConsent = Object.assign({}, authUser, {
    reconsentRequired,
    pendingPolicies,
  });

  return {
    user: authUserWithConsent,
    token: createSessionToken(user, context?.deviceId, sessionId),
    refreshToken,
    reconsentRequired,
    pendingPolicies,
  };
}

export async function listUserDevices(userId: string, currentDeviceId?: string) {
  return listActiveDevicesForUser(userId, currentDeviceId);
}

export async function getActiveSessionId(userId: string, deviceId?: string) {
  if (!deviceId) return undefined;
  const session = await prisma.session.findFirst({
    where: { userId, deviceId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return session?.id;
}

export async function logoutUserDevice(userId: string, deviceId: string, context?: AuthRequestContext, eventType = "DEVICE_FORCE_LOGOUT") {
  const device = await prisma.userDevice.findFirst({
    where: { userId, deviceId, isActive: true },
  });

  if (!device) {
    const error = new Error("Device not found or already logged out") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    if (device.refreshTokenHash) {
      await tx.refreshToken.updateMany({
        where: { tokenHash: device.refreshTokenHash, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    await tx.session.updateMany({
      where: { userId, deviceId, isActive: true },
      data: { isActive: false, lastSeenAt: new Date() },
    });

    await tx.userDevice.updateMany({
      where: { userId, deviceId, isActive: true },
      data: {
        isActive: false,
        isCurrent: false,
        refreshTokenHash: null,
        lastSeenAt: new Date(),
      },
    });
  });

  if (device.refreshTokenHash) {
    await deleteRefreshToken(device.refreshTokenHash).catch((error) => {
      console.error("Failed to delete refresh token from Redis:", error);
    });
  }
  await deleteActiveDeviceSession(userId, deviceId).catch((error) => {
    console.error("Failed to delete active device session from Redis:", error);
  });
  await recordSecurityEvent(userId, eventType, context, { deviceId });
}

export async function replaceLoginDevice(input: LoginInput & { type?: string; deviceToLogout?: string }, context?: AuthRequestContext) {
  const parsed = parseOrThrow(replaceDeviceLoginSchema, input);
  // The normal credential validator is intentionally strict and accepts only
  // email/password. Keep the replacement selector out of that second parse.
  const { user, authUser, email } = await authenticateLoginInput({
    email: parsed.email,
    password: parsed.password,
  }, context);

  if (parsed.deviceToLogout === context?.deviceId) {
    const error = new Error("Cannot replace the current device") as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  await logoutUserDevice(user.id, parsed.deviceToLogout, context, "DEVICE_REPLACED");

  await resetLoginState(user.id, context);
  const { rawRefreshToken: refreshToken, sessionId } = await createRefreshAuth(user, context);
  await recordLoginAttempt(email, true, context);
  await recordSecurityEvent(user.id, "LOGIN_SUCCESS", context);
  await recordSecurityEvent(user.id, "DEVICE_LOGIN", context, { deviceId: context?.deviceId, replacedDeviceId: parsed.deviceToLogout });

  await sendAuthEmail({ to: user.email, name: user.name, type: "login" }).catch((error) => {
    console.error("Failed to send login email:", error);
  });

  return {
    user: authUser,
    token: createSessionToken(user, context?.deviceId, sessionId),
    refreshToken,
  };
}

export async function createAuthSessionForUser(user: Pick<DbUser, "id" | "role" | "email" | "name">, context?: AuthRequestContext) {
  const { rawRefreshToken: refreshToken, sessionId } = await createRefreshAuth(user, context);
  await recordSecurityEvent(user.id, "DEVICE_LOGIN", context, { deviceId: context?.deviceId });

  return {
    token: createSessionToken(user, context?.deviceId, sessionId),
    refreshToken,
  };
}

export async function handleGoogleAuth(input: GoogleAuthInput) {
  const email = normalizeEmail(input.email);
  const providerId = input.providerId ?? undefined;
  const name = input.name?.trim() || email.split("@")[0] || "Guest";

  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        provider: "google",
        providerId,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
      },
    });
  } else {
    assertActiveAccount(user);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name || name,
        provider: user.provider === "credentials" ? user.provider : "google",
        providerId: user.providerId ?? providerId,
        isEmailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        status: "ACTIVE",
      },
    });
  }

  await sendAuthEmail({
    to: user.email,
    name: user.name,
    type: isNewUser ? "signup" : "login",
  }).catch((error) => {
    console.error("Failed to send Google auth email:", error);
  });

  return toAuthUser(user);
}

export async function getAuthUserById(userId: number | string) {
  const id = String(userId);
  if (!id) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  return user && isAccountUsable(user) ? toAuthUser(user) : null;
}

export async function VerifyEmail(emailInput: string, token: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Invalid verification link");
  }

  assertAccountCanVerify(user);

  const tokenHash = hashToken(token);
  const redisToken = await getEmailVerificationToken(email).catch((error) => {
    console.error("Failed to read email verification token from Redis:", error);
    return null;
  });

  if (redisToken) {
    if (redisToken !== tokenHash) {
      throw new Error("Invalid verification link");
    }
  } else {
    if (!user.verificationToken) {
      throw new Error("Invalid verification link");
    }

    if (user.verificationExpiry && user.verificationExpiry.getTime() < Date.now()) {
      throw new Error("Verification link has expired");
    }

    if (tokenHash !== user.verificationToken) {
      throw new Error("Invalid verification link");
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken: null,
      verificationExpiry: null,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
  });

  await prisma.host.updateMany({
    where: { userId: user.id },
    data: { isVerified: true },
  });
  await deleteEmailVerificationToken(email).catch((error) => {
    console.error("Failed to delete email verification token from Redis:", error);
  });

  return { user: await toAuthUser(updatedUser), message: "Email verified successfully" };
}

export async function getUserFromSessionToken(token: string) {
  const payload = verifySessionToken(token);
  if (!payload?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (user && isSessionTokenInvalidated(payload, user.sessionInvalidatedAt)) return null;
  if (user && payload.sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { userId: true, deviceId: true, isActive: true },
    });
    if (!session || !session.isActive || session.userId !== user.id || (payload.deviceId && session.deviceId !== payload.deviceId)) {
      return null;
    }
  } else if (user && payload.deviceId) {
    const issuedAtMs = typeof payload.issuedAtMs === "number"
      ? payload.issuedAtMs
      : typeof payload.iat === "number" ? payload.iat * 1000 : undefined;
    if (issuedAtMs === undefined) return null;

    // Bind new custom access tokens to the active database session for their
    // device. Logout deactivates that session, so another application process
    // rejects the token too. A small skew allowance handles database/app clock
    // differences without allowing a replacement session to revive it.
    const activeSession = await prisma.session.findFirst({
      where: {
        userId: user.id,
        deviceId: payload.deviceId,
        isActive: true,
        createdAt: { lte: new Date(issuedAtMs + 1_000) },
      },
      select: { id: true },
    });
    if (!activeSession) return null;
  }
  return user && isAccountUsable(user) ? toAuthUser(user) : null;
}

export async function updateAuthenticatedUser(userId: number | string, input: Partial<{
  name: string;
  email: string;
  phone: string;
  businessName: string;
  activateHost: boolean;
  location: string;
  bio: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  website: string;
  instagram: string;
  twitter: string;
  travelStyle: string;
  preferredCurrency: string;
  preferredLanguage: string;
  dietaryPreferences: string;
  passportNumber: string;
  frequentFlyerNumber: string;
}>) {
  const parsed = parseOrThrow(updateUserSchema, input);
  const id = String(userId);
  if (!id) {
    throw new Error("Invalid session user");
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new Error("User not found");
  }

  assertActiveAccount(existingUser);

  const email = parsed.email ? normalizeEmail(parsed.email) : existingUser.email;
  if (email !== existingUser.email) {
    throw Object.assign(new Error("Confirm a new email through the secure email-change flow"), { statusCode: 400 });
  }

  if (parsed.phone && parsed.phone !== existingUser.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: parsed.phone } });
    if (existingPhone) {
      throw new Error("Phone already exists");
    }
  }

  const shouldActivateHost = Boolean(parsed.activateHost);
  if (shouldActivateHost && !parsed.businessName?.trim()) {
    throw new Error("Business name is required for host activation");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: parsed.name || existingUser.name,
      email,
      phone: parsed.phone ?? existingUser.phone,
      role: existingUser.role,
    },
  });

  if (shouldActivateHost) {
    await prisma.host.upsert({
      where: { userId: id },
      create: {
        userId: id,
        businessName: parsed.businessName?.trim() || updatedUser.name,
        contactEmail: updatedUser.email,
        supportPhone: updatedUser.phone,
        isVerified: updatedUser.isEmailVerified,
      },
      update: {
        businessName: parsed.businessName?.trim() || undefined,
        contactEmail: updatedUser.email,
        supportPhone: updatedUser.phone,
      },
    });
  }

  const profilePreferences = {
    location: parsed.location || null,
    nationality: parsed.nationality || null,
    emergencyContactName: parsed.emergencyContactName || null,
    emergencyContactPhone: parsed.emergencyContactPhone || null,
    website: parsed.website || null,
    instagram: parsed.instagram || null,
    twitter: parsed.twitter || null,
    travelStyle: parsed.travelStyle || null,
    preferredCurrency: parsed.preferredCurrency || "INR",
    preferredLanguage: parsed.preferredLanguage || "English",
    dietaryPreferences: parsed.dietaryPreferences || null,
    passportNumber: parsed.passportNumber || null,
    frequentFlyerNumber: parsed.frequentFlyerNumber || null,
  };

  await prisma.userProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      bio: parsed.bio || null,
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
      gender: normalizeGender(parsed.gender),
      address: parsed.address || null,
      city: parsed.location || null,
      preferences: profilePreferences,
    },
    update: {
      bio: parsed.bio || null,
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
      gender: normalizeGender(parsed.gender),
      address: parsed.address || null,
      city: parsed.location || null,
      preferences: profilePreferences,
    },
  });

  return {
    user: await toAuthUser(updatedUser),
  };
}

/**
 * Start a credential-account email change. The current password prevents a
 * stolen browser session from silently moving account recovery to an attacker,
 * while the new-address link proves control of the proposed destination.
 */
export async function RequestEmailChange(
  userId: number | string,
  input: { email?: string; password?: string },
  context?: AuthRequestContext,
) {
  const parsed = parseOrThrow(emailChangeRequestSchema, input);
  assertAuthEmailDeliveryConfigured();

  const id = String(userId);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  assertActiveAccount(user);

  const reauthenticationFailure = credentialReauthenticationFailure({
    provider: user.provider,
    hasPassword: Boolean(user.password),
    passwordIsValid: user.password ? await bcrypt.compare(parsed.password, user.password) : false,
  });
  if (reauthenticationFailure) throw Object.assign(new Error(reauthenticationFailure.message), { statusCode: reauthenticationFailure.statusCode });

  const newEmail = normalizeEmail(parsed.email);
  if (newEmail === user.email) return { message: "This is already your account email." };

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) throw Object.assign(new Error("Email is already in use"), { statusCode: 409 });

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + emailChangeTtlMs);
  const request = await prisma.$transaction(async (tx) => {
    await tx.emailChangeRequest.deleteMany({ where: { userId: user.id } });
    return tx.emailChangeRequest.create({
      data: {
        userId: user.id,
        oldEmail: user.email,
        newEmail,
        otpHash: tokenHash,
        expiresAt,
      },
    });
  });

  const confirmationUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/confirm-email-change?requestId=${encodeURIComponent(request.id)}&token=${encodeURIComponent(rawToken)}`;
  try {
    await sendAuthEmail({ to: newEmail, name: user.name, type: "email_change", actionUrl: confirmationUrl });
  } catch (error) {
    await prisma.emailChangeRequest.deleteMany({ where: { id: request.id } }).catch((cleanupError) => {
      console.error("Failed to remove undelivered email-change request", { name: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
    });
    if (error instanceof Error && "statusCode" in error) throw error;
    throw authEmailDeliveryFailure();
  }

  // This is a security notice only; the confirmation message is already
  // delivered to the new address, so an advisory-mail failure must not create
  // a misleading failure state or remove a valid request.
  await sendAuthEmail({ to: user.email, name: user.name, type: "email_change_notice" }).catch((error) => {
    console.error("Failed to send email-change security notice", { name: error instanceof Error ? error.name : "UnknownError" });
  });
  await recordSecurityEvent(user.id, "EMAIL_CHANGE_REQUESTED", context, { requestId: request.id });

  return { message: "Confirm the link sent to your new email address to complete the change." };
}

export async function ConfirmEmailChange(input: { requestId?: string; token?: string }, context?: AuthRequestContext) {
  const parsed = parseOrThrow(emailChangeConfirmationSchema, input);
  const tokenHash = hashToken(parsed.token);
  const now = new Date();

  const change = await prisma.emailChangeRequest.findFirst({
    where: { id: parsed.requestId, otpHash: tokenHash, expiresAt: { gt: now } },
  });
  if (!change) throw Object.assign(new Error("Invalid or expired email-change link"), { statusCode: 400 });

  const completed = await prisma.$transaction(async (tx) => {
    // Claim first so a link can be used once, even if two browser tabs submit
    // it at the same time.
    const claimed = await tx.emailChangeRequest.deleteMany({
      where: { id: change.id, otpHash: tokenHash, expiresAt: { gt: now } },
    });
    if (claimed.count !== 1) return false;

    const existing = await tx.user.findUnique({ where: { email: change.newEmail } });
    if (existing && existing.id !== change.userId) {
      throw Object.assign(new Error("Email is already in use"), { statusCode: 409 });
    }

    const updated = await tx.user.updateMany({
      where: { id: change.userId, email: change.oldEmail },
      data: {
        email: change.newEmail,
        isEmailVerified: true,
        emailVerifiedAt: now,
        sessionInvalidatedAt: now,
      },
    });
    if (updated.count !== 1) return false;

    await Promise.all([
      tx.host.updateMany({ where: { userId: change.userId }, data: { contactEmail: change.newEmail } }),
      tx.refreshToken.updateMany({ where: { userId: change.userId, isRevoked: false }, data: { isRevoked: true, revokedAt: now } }),
      tx.session.updateMany({ where: { userId: change.userId, isActive: true }, data: { isActive: false, lastSeenAt: now } }),
      tx.userDevice.updateMany({
        where: { userId: change.userId, isActive: true },
        data: { isActive: false, isCurrent: false, refreshTokenHash: null, lastSeenAt: now },
      }),
    ]);
    return true;
  });

  if (!completed) throw Object.assign(new Error("Invalid or expired email-change link"), { statusCode: 400 });

  await Promise.all([
    deleteUserRefreshTokens(change.userId).catch(() => false),
    deleteUserActiveDeviceSessions(change.userId).catch(() => false),
  ]);
  await recordSecurityEvent(change.userId, "EMAIL_CHANGE_COMPLETED", context, { requestId: change.id });

  return { message: "Email updated. Sign in again with your new address." };
}

export async function RequestResetPassword(emailInput: string, context?: AuthRequestContext) {
  const parsed = parseOrThrow(forgotPasswordSchema, { email: emailInput });
  // Configuration is checked before the lookup so a missing mail provider is
  // never an account-existence oracle.
  assertAuthEmailDeliveryConfigured();
  const email = normalizeEmail(parsed.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !isAccountUsable(user)) {
    return { message: "If that email exists, a reset link has been sent." };
  }

  const rawToken = generateToken();
  const resetToken = hashToken(rawToken);
  const resetTokenExpiry = new Date(Date.now() + passwordResetTtlMs);

  const resetRecord = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: resetToken,
      expiresAt: resetTokenExpiry,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  await recordSecurityEvent(user.id, "PASSWORD_RESET_REQUESTED", context);

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
  try {
    await sendAuthEmail({ to: user.email, name: user.name, type: "reset", actionUrl: resetUrl });
  } catch (error) {
    // Delete only this request's token. A concurrent reset request must keep
    // its own token instead of being invalidated by this failed send.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { id: resetRecord.id, usedAt: null } }),
      prisma.user.updateMany({
        where: { id: user.id, resetToken },
        data: { resetToken: null, resetTokenExpiry: null },
      }),
    ]).catch((cleanupError) => {
      console.error("Failed to remove undelivered password-reset token", { name: cleanupError instanceof Error ? cleanupError.name : "UnknownError" });
    });
    if (error instanceof Error && "statusCode" in error) throw error;
    throw authEmailDeliveryFailure();
  }

  return { message: "If that email exists, a reset link has been sent." };
}

export async function ResetPassword(emailInput: string, token: string, password?: string) {
  const parsed = parseOrThrow(resetPasswordSchema, { email: emailInput, token, password });
  const email = normalizeEmail(parsed.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Invalid reset token");
  }

  assertActiveAccount(user);

  const tokenHash = hashToken(parsed.token);
  const resetTokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      tokenHash,
      usedAt: null,
    },
  });

  if (!resetTokenRecord && tokenHash !== user.resetToken) {
    throw new Error("Invalid reset token");
  }

  const resetTokenExpiry = resetTokenRecord?.expiresAt ?? user.resetTokenExpiry;
  if (!resetTokenExpiry || resetTokenExpiry.getTime() < Date.now()) {
    throw new Error("Reset token has expired");
  }

  const hashedPassword = await bcrypt.hash(parsed.password, passwordRounds);
  const result = await prisma.$transaction(async (tx) => {
    if (resetTokenRecord) {
      const tokenUpdate = await tx.passwordResetToken.updateMany({
        where: {
          id: resetTokenRecord.id,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (tokenUpdate.count !== 1) {
        return { count: 0 };
      }
    }

    return tx.user.updateMany({
      where: {
        id: user.id,
        ...(resetTokenRecord ? {} : {
          resetToken: tokenHash,
          resetTokenExpiry: {
            gt: new Date(),
          },
        }),
      },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }, { maxWait: 15_000, timeout: 30_000 });

  if (result.count !== 1) {
    throw new Error("Invalid reset token");
  }

  await prisma.user.update({ where: { id: user.id }, data: { sessionInvalidatedAt: new Date() } });
  const deletedRedisRefreshTokens = await deleteUserRefreshTokens(user.id).catch((error) => {
    console.error("Failed to delete user refresh tokens from Redis:", error);
    return false;
  });
  if (!deletedRedisRefreshTokens) {
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }
  await prisma.session.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false, lastSeenAt: new Date() },
  });
  await prisma.userDevice.updateMany({
    where: { userId: user.id, isActive: true },
    data: {
      isActive: false,
      isCurrent: false,
      refreshTokenHash: null,
      lastSeenAt: new Date(),
    },
  });
  await deleteUserActiveDeviceSessions(user.id).catch((error) => {
    console.error("Failed to delete user active device sessions from Redis:", error);
  });
  await recordSecurityEvent(user.id, "PASSWORD_RESET_COMPLETED");

  return { message: "Password reset successful" };
}

export async function ChangePassword(
  userId: number | string,
  input: { currentPassword?: string; newPassword?: string },
  context?: AuthRequestContext,
) {
  const parsed = parseOrThrow(changePasswordSchema, input);
  const id = String(userId);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  assertActiveAccount(user);

  const reauthenticationFailure = credentialReauthenticationFailure({
    provider: user.provider,
    hasPassword: Boolean(user.password),
    passwordIsValid: user.password ? await bcrypt.compare(parsed.currentPassword, user.password) : false,
  });
  if (reauthenticationFailure) throw Object.assign(new Error(reauthenticationFailure.message), { statusCode: reauthenticationFailure.statusCode });
  if (user.password && await bcrypt.compare(parsed.newPassword, user.password)) {
    throw Object.assign(new Error("Choose a password you have not used for this account"), { statusCode: 400 });
  }

  const now = new Date();
  const password = await bcrypt.hash(parsed.newPassword, passwordRounds);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password, failedLoginAttempts: 0, lockedUntil: null, sessionInvalidatedAt: now },
    });
    await Promise.all([
      tx.refreshToken.updateMany({ where: { userId: user.id, isRevoked: false }, data: { isRevoked: true, revokedAt: now } }),
      tx.session.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, lastSeenAt: now } }),
      tx.userDevice.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, isCurrent: false, refreshTokenHash: null, lastSeenAt: now } }),
    ]);
  });
  await Promise.all([
    deleteUserRefreshTokens(user.id).catch(() => false),
    deleteUserActiveDeviceSessions(user.id).catch(() => false),
  ]);
  await recordSecurityEvent(user.id, "PASSWORD_CHANGED", context);

  return { message: "Password updated. Sign in again to continue." };
}

export async function revokeRefreshToken(rawToken?: string, context?: AuthRequestContext) {
  if (!rawToken) {
    return;
  }

  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (existing?.userId && existing.deviceId) {
    const existingDeviceId = existing.deviceId;
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: {
          tokenHash,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
      await tx.session.updateMany({
        where: {
          userId: existing.userId,
          deviceId: existingDeviceId,
          isActive: true,
        },
        data: {
          isActive: false,
          lastSeenAt: new Date(),
        },
      });
      await tx.userDevice.updateMany({
        where: {
          userId: existing.userId,
          deviceId: existingDeviceId,
          isActive: true,
        },
        data: {
          isActive: false,
          isCurrent: false,
          refreshTokenHash: null,
          lastSeenAt: new Date(),
        },
      });
    });
    await deleteActiveDeviceSession(existing.userId, existingDeviceId).catch((error) => {
      console.error("Failed to delete active device session from Redis:", error);
    });
    await recordSecurityEvent(existing.userId, "DEVICE_LOGOUT", context, { deviceId: existingDeviceId });
  }

  const deletedFromRedis = await deleteRefreshToken(tokenHash).catch((error) => {
    console.error("Failed to delete refresh token from Redis:", error);
    return false;
  });

  if (!deletedFromRedis && !existing) {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }
}

async function invalidateRefreshFamily(userId: string, context?: AuthRequestContext) {
  const invalidatedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { sessionInvalidatedAt: invalidatedAt } }),
    prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true, revokedAt: invalidatedAt } }),
    prisma.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false, lastSeenAt: invalidatedAt } }),
    prisma.userDevice.updateMany({ where: { userId, isActive: true }, data: { isActive: false, isCurrent: false, refreshTokenHash: null, lastSeenAt: invalidatedAt } }),
  ]);
  await Promise.all([
    deleteUserRefreshTokens(userId).catch(() => false),
    deleteUserActiveDeviceSessions(userId).catch(() => false),
  ]);
  await recordSecurityEvent(userId, "REFRESH_TOKEN_REUSE_DETECTED", context);
}

export async function rotateRefreshToken(rawToken: string | undefined, context?: AuthRequestContext) {
  if (!rawToken) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  const oldHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash }, include: { User: true } });
  if (!existing) throw Object.assign(new Error("Invalid session"), { statusCode: 401 });

  if (existing.isRevoked) {
    await invalidateRefreshFamily(existing.userId, context);
    throw Object.assign(new Error("Session reuse detected. Sign in again."), { statusCode: 401 });
  }
  const now = new Date();
  if (existing.expiresAt <= now || !isAccountUsable(existing.User) || (existing.User.sessionInvalidatedAt && existing.createdAt <= existing.User.sessionInvalidatedAt)) {
    await prisma.refreshToken.updateMany({ where: { id: existing.id, isRevoked: false }, data: { isRevoked: true, revokedAt: now } });
    throw Object.assign(new Error("Session expired"), { statusCode: 401 });
  }
  if (existing.deviceId && context?.deviceId && existing.deviceId !== context.deviceId) {
    await invalidateRefreshFamily(existing.userId, context);
    await prisma.refreshToken.updateMany({ where: { id: existing.id, isRevoked: false }, data: { isRevoked: true, revokedAt: now } });
    await recordSecurityEvent(existing.userId, "REFRESH_TOKEN_DEVICE_MISMATCH", context, {
      expectedDeviceId: existing.deviceId,
      actualDeviceId: context.deviceId,
    });
    throw Object.assign(new Error("Session device mismatch. Sign in again."), { statusCode: 401 });
  }

  const nextRaw = generateToken();
  const nextHash = hashToken(nextRaw);
  const nextExpiry = new Date(Date.now() + refreshTokenTtlMs);
  const rotated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.refreshToken.updateMany({
      where: { id: existing.id, isRevoked: false, expiresAt: { gt: now } },
      data: { isRevoked: true, revokedAt: now },
    });
    if (consumed.count !== 1) return false;
    await tx.refreshToken.create({ data: {
      userId: existing.userId, tokenHash: nextHash, deviceId: existing.deviceId,
      deviceName: context?.deviceName ?? existing.deviceName, ipAddress: context?.ipAddress,
      userAgent: context?.userAgent, expiresAt: nextExpiry,
    } });
    if (existing.deviceId) {
      await tx.userDevice.updateMany({ where: { userId: existing.userId, deviceId: existing.deviceId, isActive: true }, data: { refreshTokenHash: nextHash, lastSeenAt: now, ipAddress: context?.ipAddress, userAgent: context?.userAgent } });
      await tx.session.updateMany({ where: { userId: existing.userId, deviceId: existing.deviceId, isActive: true }, data: { lastSeenAt: now } });
    }
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (!rotated) {
    await invalidateRefreshFamily(existing.userId, context);
    throw Object.assign(new Error("Session reuse detected. Sign in again."), { statusCode: 401 });
  }
  await deleteRefreshToken(oldHash).catch(() => false);
  await storeRefreshToken(nextHash, { userId: existing.userId, deviceId: existing.deviceId ?? undefined, deviceName: context?.deviceName, ipAddress: context?.ipAddress, userAgent: context?.userAgent, createdAt: now.toISOString() }, refreshTokenTtlSeconds).catch(() => false);
  await recordSecurityEvent(existing.userId, "REFRESH_TOKEN_ROTATED", context, { deviceId: existing.deviceId });
  const activeSession = existing.deviceId
    ? await prisma.session.findFirst({
        where: { userId: existing.userId, deviceId: existing.deviceId, isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;
  const resolvedDeviceId = existing.deviceId || context?.deviceId || undefined;
  return {
    user: await toAuthUser(existing.User),
    token: createSessionToken(existing.User, resolvedDeviceId, activeSession?.id),
    refreshToken: nextRaw,
    deviceId: resolvedDeviceId,
  };
}
