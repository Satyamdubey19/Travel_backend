import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/hash";
import { sendAuthEmail, sendVerificationEmail } from "@/lib/mail";
import type { Gender } from "@prisma/client";
import type { AuthRole, LoginInput, RegisterInput } from "@/types/auth";

const passwordRounds = 12;

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
};

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

function normalizeGender(value?: string | null): Gender | null {
  const upper = value?.trim().toUpperCase()
  if (upper === "MALE" || upper === "FEMALE" || upper === "NON_BINARY" || upper === "PREFER_NOT_TO_SAY") {
    return upper as Gender
  }
  return null
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
    { expiresIn: "7d" },
  );
}

export function verifySessionToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string") {
    return null;
  }
  return payload as { id: string; email: string; role: AuthRole };
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
  const host = role === "HOST" ? await getHostProfile(user.id) : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    businessName: host?.businessName ?? null,
    role,
    isHost: role === "HOST" || Boolean(host),
    isHostApproved: Boolean(host?.isApproved),
    provider: user.provider ?? "credentials",
  };
}

export async function registerUser(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const role = normalizeRole(input.role);

  if (role === "ADMIN") {
    throw new Error("Admin accounts cannot be created from signup");
  }

  if (!input.name?.trim()) {
    throw new Error("Name is required");
  }

  if (!email.includes("@")) {
    throw new Error("Valid email is required");
  }

  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  if (role === "HOST" && !input.businessName?.trim()) {
    throw new Error("Business name is required for host signup");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await bcrypt.hash(input.password, passwordRounds);
  const rawToken = generateToken();
  const verificationToken = hashToken(rawToken);
  const verificationExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      password: hashedPassword,
      role,
      provider: "credentials",
      isEmailVerified: false,
      verificationToken,
      verificationExpiry,
    },
  });

  if (role === "HOST") {
    await prisma.host.create({
      data: {
        userId: user.id,
        businessName: input.businessName?.trim(),
        contactEmail: user.email,
        supportPhone: user.phone,
        isVerified: false,
      },
    });
  }

  await sendVerificationEmail(user.email, rawToken, user.name).catch((error) => {
    console.error("Failed to send signup email:", error);
  });

  return {
    user: await toAuthUser(user),
  };
}

export async function LoginUser(input: LoginInput & { type?: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.password) {
    throw new Error("Incorrect email or password");
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password);
  if (!isValidPassword) {
    throw new Error("Incorrect email or password");
  }

  const requestedRole = input.type ? normalizeRole(input.type) : null;
  const authUser = await toAuthUser(user);
  const hasRequestedRole =
    !requestedRole ||
    (requestedRole === "HOST" && authUser.isHost) ||
    (requestedRole === "USER" && authUser.role !== "ADMIN") ||
    (requestedRole === "ADMIN" && authUser.role === "ADMIN");

  if (!hasRequestedRole) {
    throw new Error(`This account does not have ${requestedRole?.toLowerCase()} access`);
  }

  await sendAuthEmail({ to: user.email, name: user.name, type: "login" }).catch((error) => {
    console.error("Failed to send login email:", error);
  });

  return {
    user: authUser,
    token: createSessionToken(user),
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
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name || name,
        provider: user.provider === "credentials" ? user.provider : "google",
        providerId: user.providerId ?? providerId,
        isEmailVerified: true,
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
  return user ? toAuthUser(user) : null;
}

export async function VerifyEmail(emailInput: string, token: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.verificationToken) {
    throw new Error("Invalid verification link");
  }

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

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  return user ? toAuthUser(user) : null;
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
  const id = String(userId);
  if (!id) {
    throw new Error("Invalid session user");
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new Error("User not found");
  }

  const email = input.email ? normalizeEmail(input.email) : existingUser.email;
  if (email !== existingUser.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new Error("Email is already in use");
    }
  }

  const shouldActivateHost = Boolean(input.activateHost);

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: input.name?.trim() || existingUser.name,
      email,
      phone: input.phone?.trim() || null,
      role: shouldActivateHost ? "HOST" : existingUser.role,
    },
  });

  if (shouldActivateHost) {
    await prisma.host.upsert({
      where: { userId: id },
      create: {
        userId: id,
        businessName: input.businessName?.trim() || updatedUser.name,
        contactEmail: updatedUser.email,
        supportPhone: updatedUser.phone,
        isVerified: updatedUser.isEmailVerified,
      },
      update: {
        businessName: input.businessName?.trim() || undefined,
        contactEmail: updatedUser.email,
        supportPhone: updatedUser.phone,
      },
    });
  }

  const profilePreferences = {
    location: input.location?.trim() || null,
    nationality: input.nationality?.trim() || null,
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    website: input.website?.trim() || null,
    instagram: input.instagram?.trim() || null,
    twitter: input.twitter?.trim() || null,
    travelStyle: input.travelStyle?.trim() || null,
    preferredCurrency: input.preferredCurrency?.trim() || "INR",
    preferredLanguage: input.preferredLanguage?.trim() || "English",
    dietaryPreferences: input.dietaryPreferences?.trim() || null,
    passportNumber: input.passportNumber?.trim() || null,
    frequentFlyerNumber: input.frequentFlyerNumber?.trim() || null,
  };

  await prisma.userProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      bio: input.bio?.trim() || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: normalizeGender(input.gender),
      address: input.address?.trim() || null,
      city: input.location?.trim() || null,
      preferences: profilePreferences,
    },
    update: {
      bio: input.bio?.trim() || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: normalizeGender(input.gender),
      address: input.address?.trim() || null,
      city: input.location?.trim() || null,
      preferences: profilePreferences,
    },
  });

  return {
    user: await toAuthUser(updatedUser),
  };
}

export async function RequestResetPassword(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { message: "If that email exists, a reset link has been sent." };
  }

  const rawToken = generateToken();
  const resetToken = hashToken(rawToken);
  const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
  await sendAuthEmail({ to: user.email, name: user.name, type: "reset", actionUrl: resetUrl }).catch((error) => {
    console.error("Failed to send password reset email:", error);
  });

  return { message: "If that email exists, a reset link has been sent." };
}

export async function ResetPassword(emailInput: string, token: string, password?: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.resetToken || !user.resetTokenExpiry) {
    throw new Error("Invalid reset token");
  }

  if (user.resetTokenExpiry.getTime() < Date.now()) {
    throw new Error("Reset token has expired");
  }

  if (hashToken(token) !== user.resetToken) {
    throw new Error("Invalid reset token");
  }

  const data: {
    resetToken: null;
    resetTokenExpiry: null;
    password?: string;
  } = {
    resetToken: null,
    resetTokenExpiry: null,
  };

  if (password) {
    data.password = await bcrypt.hash(password, passwordRounds);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return { message: "Password reset successful" };
}
