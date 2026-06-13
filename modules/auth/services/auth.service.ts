import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/hash";
import { sendAuthEmail, sendVerificationEmail } from "@/lib/mail";
import type { Gender, Prisma } from "@prisma/client";
import type { AuthRole, LoginInput, RegisterInput } from "@/modules/auth/types/auth";
import { invalidateUserSessions, isTokenRevoked, isUserSessionInvalidated } from "@/modules/auth/services/auth-security.service";

const passwordRounds = 12;
const sessionTtl = "7d";
const refreshTokenTtlMs = 1000 * 60 * 60 * 24 * 30;
const passwordResetTtlMs = 1000 * 60 * 60;
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
};

export type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
};

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
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password must be 128 characters or less"),
  role: z.enum(["user", "host", "USER", "HOST"]).optional(),
  businessName: z.string().trim().max(160, "Business name must be 160 characters or less").optional(),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  password: z.string().min(1, "Password is required"),
  type: z.enum(["USER", "HOST", "ADMIN", "user", "host", "admin"]).optional(),
}).strict();

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
}).strict();

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Valid email is required").max(254, "Email is too long"),
  token: z.string().trim().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128, "Password must be 128 characters or less"),
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
  if (user.deletedAt || user.isBanned || user.isActive === false || (user.status && user.status !== "ACTIVE")) {
    const error = new Error("Account is not allowed to authenticate") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

function assertAccountCanVerify(user: DbUser) {
  if (user.deletedAt || user.isBanned || user.isActive === false || user.status === "DELETED" || user.status === "BANNED") {
    const error = new Error("Account is not allowed to authenticate") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

function assertNotLocked(user: DbUser) {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const error = new Error("Account is temporarily locked. Try again later.") as Error & { statusCode?: number };
    error.statusCode = 423;
    throw error;
  }
}

function isAccountUsable(user: DbUser) {
  return !user.deletedAt && !user.isBanned && user.isActive !== false && (!user.status || user.status === "ACTIVE");
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
  const upper = value?.trim().toUpperCase()
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

async function createRefreshAuth(user: Pick<DbUser, "id">, context?: AuthRequestContext) {
  const ctx = sanitizedContext(context);
  const rawRefreshToken = generateToken();
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

  await prisma.session.create({
    data: {
      userId: user.id,
      deviceName: ctx.deviceName,
      deviceType: ctx.deviceId ? "known" : "browser",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawRefreshToken),
      deviceId: ctx.deviceId,
      deviceName: ctx.deviceName,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt,
    },
  });

  if (ctx.deviceId) {
    await prisma.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: ctx.deviceId,
        },
      },
      create: {
        userId: user.id,
        deviceId: ctx.deviceId,
        deviceType: "browser",
        ipAddress: ctx.ipAddress,
      },
      update: {
        ipAddress: ctx.ipAddress,
      },
    }).catch((error) => {
      console.error("Failed to upsert user device:", error);
    });
  }

  return rawRefreshToken;
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

function getJwtSecret() {
  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }
  return secret;
}

export function createSessionToken(user: Pick<DbUser, "id" | "role" | "email">) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: normalizeRole(user.role),
    },
    getJwtSecret(),
    { expiresIn: sessionTtl },
  );
}

export function verifySessionToken(token: string) {
  if (isTokenRevoked(token)) {
    return null;
  }

  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string") {
    return null;
  }
  return payload as { id: string; email: string; role: AuthRole; iat?: number; exp?: number };
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

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    businessName: host?.businessName ?? null,
    role,
    isHost: role === "HOST" && Boolean(host),
    isHostApproved: Boolean(host?.isApproved),
    provider: user.provider ?? "credentials",
  };
}

export async function registerUser(input: RegisterInput, context?: AuthRequestContext) {
  const parsed = parseOrThrow(registerSchema, input);
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
  const verificationExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.name,
        email,
        phone: parsed.phone,
        password: hashedPassword,
        role,
        status: "PENDING",
        provider: "credentials",
        isEmailVerified: false,
        verificationToken,
        verificationExpiry,
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
        isVerified: false,
      },
    });
  }

  await sendVerificationEmail(user.email, rawToken, user.name).catch((error) => {
    console.error("Failed to send signup email:", error);
  });

  await recordSecurityEvent(user.id, "REGISTERED", context);

  return {
    user: await toAuthUser(user),
  };
}

export async function LoginUser(input: LoginInput & { type?: string }, context?: AuthRequestContext) {
  const parsed = parseOrThrow(loginSchema, input);
  const email = normalizeEmail(parsed.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.password) {
    await bcrypt.compare(parsed.password, dummyPasswordHash);
    await recordLoginAttempt(email, false, context);
    throw new Error("Incorrect email or password");
  }

  assertAccountCanVerify(user);
  assertNotLocked(user);

  if (!user.isEmailVerified) {
    const error = new Error("Please verify your email before logging in") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  assertActiveAccount(user);

  const isValidPassword = await bcrypt.compare(parsed.password, user.password);
  if (!isValidPassword) {
    await registerFailedLogin(user, email, context);
    throw new Error("Incorrect email or password");
  }

  const requestedRole = parsed.type ? normalizeRole(parsed.type) : null;
  const authUser = await toAuthUser(user);
  const hasRequestedRole =
    !requestedRole ||
    (requestedRole === "HOST" && authUser.isHost) ||
    (requestedRole === "USER" && authUser.role !== "ADMIN") ||
    (requestedRole === "ADMIN" && authUser.role === "ADMIN");

  if (!hasRequestedRole) {
    await recordLoginAttempt(email, false, context);
    await recordSecurityEvent(user.id, "LOGIN_ROLE_DENIED", context, { requestedRole });
    throw new Error(`This account does not have ${requestedRole?.toLowerCase()} access`);
  }

  await resetLoginState(user.id, context);
  await recordLoginAttempt(email, true, context);
  await recordSecurityEvent(user.id, "LOGIN_SUCCESS", context);
  const refreshToken = await createRefreshAuth(user, context);

  await sendAuthEmail({ to: user.email, name: user.name, type: "login" }).catch((error) => {
    console.error("Failed to send login email:", error);
  });

  return {
    user: authUser,
    token: createSessionToken(user),
    refreshToken,
  };
}

export async function authorizeCredentials(input: LoginInput & { type?: string }) {
  const { user } = await LoginUser(input);
  return user;
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

  if (!user?.verificationToken) {
    throw new Error("Invalid verification link");
  }

  assertAccountCanVerify(user);

  if (user.verificationExpiry && user.verificationExpiry.getTime() < Date.now()) {
    throw new Error("Verification link has expired");
  }

  if (hashToken(token) !== user.verificationToken) {
    throw new Error("Invalid verification link");
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

  return { user: await toAuthUser(updatedUser), message: "Email verified successfully" };
}

export async function getUserFromSessionToken(token: string) {
  const payload = verifySessionToken(token);
  if (!payload?.id) {
    return null;
  }

  if (isUserSessionInvalidated(payload.id, payload.iat)) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
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
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new Error("Email is already in use");
    }
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

export async function RequestResetPassword(emailInput: string, context?: AuthRequestContext) {
  const parsed = parseOrThrow(forgotPasswordSchema, { email: emailInput });
  const email = normalizeEmail(parsed.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !isAccountUsable(user)) {
    return { message: "If that email exists, a reset link has been sent." };
  }

  const rawToken = generateToken();
  const resetToken = hashToken(rawToken);
  const resetTokenExpiry = new Date(Date.now() + passwordResetTtlMs);

  await prisma.passwordResetToken.create({
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
  await sendAuthEmail({ to: user.email, name: user.name, type: "reset", actionUrl: resetUrl }).catch((error) => {
    console.error("Failed to send password reset email:", error);
  });

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
  });

  if (result.count !== 1) {
    throw new Error("Invalid reset token");
  }

  invalidateUserSessions(user.id);
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
  await prisma.session.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false, lastSeenAt: new Date() },
  });
  await recordSecurityEvent(user.id, "PASSWORD_RESET_COMPLETED");

  return { message: "Password reset successful" };
}

export async function revokeRefreshToken(rawToken?: string) {
  if (!rawToken) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(rawToken),
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  });
}
