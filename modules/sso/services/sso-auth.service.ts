import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { Role, AccountStatus } from "@prisma/client";
import { generateToken, hashToken } from "@/lib/hash";
import { getRedisClient } from "@/lib/redis";
import { storeActiveDeviceSession, storeRefreshToken } from "@/services/redis.service";
import type { SsoUserProfile, SsoSessionData } from "../types/sso.types";

export class SsoInactiveAccountError extends Error {
  constructor(message = "Your employee account is inactive. Please contact your corporate administrator.") {
    super(message);
    this.name = "SsoInactiveAccountError";
  }
}

export class SsoProvisioningError extends Error {
  constructor(message = "Automatic user provisioning is disabled for your organization. Please contact your IT admin.") {
    super(message);
    this.name = "SsoProvisioningError";
  }
}

/**
 * Resolves the corporate organization and active SSO configuration by corporate email or domain.
 */
export async function resolveOrganizationByDomain(emailOrDomain: string) {
  const domain = emailOrDomain.includes("@")
    ? emailOrDomain.split("@")[1].toLowerCase().trim()
    : emailOrDomain.toLowerCase().trim();

  const organization = await prisma.organization.findUnique({
    where: { domain },
    include: { ssoConfig: true },
  });

  if (!organization || !organization.isActive) {
    return null;
  }

  if (!organization.ssoConfig) {
    return null;
  }

  return organization;
}

/**
 * Resolves application role from IdP groups or default organization policy.
 */
export function mapIdpRoleToAppRole(idpRoles: string[] = [], defaultRole: Role = Role.USER): Role {
  const normalized = idpRoles.map((r) => r.toLowerCase());

  if (normalized.some((r) => r.includes("admin") || r.includes("superadmin"))) {
    return Role.ADMIN;
  }
  if (normalized.some((r) => r.includes("manager") || r.includes("host") || r.includes("reviewer"))) {
    return Role.HOST;
  }

  return defaultRole;
}

/**
 * Core SSO Authenticator: Validates Inactive Employee Gates, Executes JIT Auto-Provisioning,
 * Synchronizes RBAC, logs immutable audit trail, and generates session tokens.
 */
export async function processSsoAuthentication(
  organizationId: string,
  ssoProfile: SsoUserProfile,
  meta: { ipAddress?: string; userAgent?: string; deviceId?: string } = {}
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { ssoConfig: true },
  });

  if (!org || !org.ssoConfig) {
    throw new Error("Organization SSO configuration not found or disabled.");
  }

  const { email, name, employeeId, department, roles, idpEntityId, protocol } = ssoProfile;

  // 1. Query existing user by email
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      OrganizationMember: {
        where: { organizationId: org.id },
      },
    },
  });

  // 2. Inactive Employee Safety Gate
  if (existingUser) {
    const isUserInactive =
      existingUser.status !== AccountStatus.ACTIVE ||
      !existingUser.isActive ||
      existingUser.isBanned;

    const memberRecord = existingUser.OrganizationMember[0];
    const isMemberDeactivated = memberRecord && !memberRecord.isCurrent;

    if (isUserInactive || isMemberDeactivated) {
      await prisma.ssoAuditLog.create({
        data: {
          organizationId: org.id,
          userId: existingUser.id,
          email,
          eventType: "ACCOUNT_INACTIVE",
          protocol,
          idpEntityId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          failureReason: "User or organizational membership is marked inactive in database.",
        },
      });

      throw new SsoInactiveAccountError();
    }
  }

  let finalUserId = existingUser?.id;
  const assignedRole = existingUser?.role || mapIdpRoleToAppRole(roles, org.ssoConfig.defaultRole);

  // 3. Just-in-Time (JIT) Auto-Provisioning or Account Update
  if (!existingUser) {
    if (!org.ssoConfig.jitEnabled) {
      await prisma.ssoAuditLog.create({
        data: {
          organizationId: org.id,
          email,
          eventType: "PROVISIONING_REJECTED",
          protocol,
          idpEntityId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          failureReason: "JIT auto-provisioning is disabled for organization.",
        },
      });

      throw new SsoProvisioningError();
    }

    // Atomic JIT User Creation
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          role: assignedRole,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          provider: "sso",
          providerId: ssoProfile.providerId,
          lastLoginAt: new Date(),
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          employeeId: employeeId || null,
          department: department || null,
          role: roles?.[0] || "EMPLOYEE",
          isCurrent: true,
        },
      });

      return user;
    });

    finalUserId = newUser.id;

    await prisma.ssoAuditLog.create({
      data: {
        organizationId: org.id,
        userId: finalUserId,
        email,
        eventType: "JIT_PROVISIONED",
        protocol,
        idpEntityId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { employeeId, department, assignedRole },
      },
    });
  } else {
    // Existing active user: sync last login and link organization member if not linked
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          lastLoginAt: new Date(),
          providerId: ssoProfile.providerId,
        },
      });

      if (existingUser.OrganizationMember.length === 0) {
        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: existingUser.id,
            employeeId: employeeId || null,
            department: department || null,
            role: roles?.[0] || "EMPLOYEE",
            isCurrent: true,
          },
        });
      }
    });
  }

  // 4. Record Successful Login in Audit Trail
  await prisma.ssoAuditLog.create({
    data: {
      organizationId: org.id,
      userId: finalUserId,
      email,
      eventType: "LOGIN_SUCCESS",
      protocol,
      idpEntityId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  // 5. Generate Session Tokens & Sliding Inactivity Window
  const jwtSecret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "travels_pro_jwt_secret";
  const deviceId = meta.deviceId || "sso_" + generateToken().slice(0, 12);
  const sessionTtlSeconds = org.ssoConfig.inactivityTimeoutMinutes * 60;
  const refreshTokenTtlSeconds = 60 * 60 * 24 * 7; // 7 days
  const rawRefreshToken = generateToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + refreshTokenTtlSeconds * 1000);

  // Create active Session and register UserDevice in database
  const session = await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId: finalUserId!, deviceId, isActive: true },
      data: { isActive: false, lastSeenAt: new Date() },
    });

    const createdSession = await tx.session.create({
      data: {
        userId: finalUserId!,
        deviceId,
        deviceName: meta.userAgent ? "Corporate SSO Browser" : "SSO Device",
        deviceType: "browser",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    await tx.refreshToken.create({
      data: {
        userId: finalUserId!,
        tokenHash,
        deviceId,
        deviceName: meta.userAgent ? "Corporate SSO Browser" : undefined,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    await tx.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId: finalUserId!,
          deviceId,
        },
      },
      create: {
        userId: finalUserId!,
        deviceId,
        deviceName: meta.userAgent ? "Corporate SSO Browser" : "SSO Device",
        deviceType: "browser",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        lastSeenAt: new Date(),
        isCurrent: true,
        isActive: true,
        refreshTokenHash: tokenHash,
      },
      update: {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        lastSeenAt: new Date(),
        isCurrent: true,
        isActive: true,
        refreshTokenHash: tokenHash,
      },
    });

    return createdSession;
  });

  const sessionToken = jwt.sign(
    {
      id: finalUserId,
      userId: finalUserId,
      email,
      role: assignedRole,
      organizationId: org.id,
      sso: true,
      deviceId,
      sessionId: session.id,
      issuedAtMs: Date.now(),
    },
    jwtSecret,
    { expiresIn: sessionTtlSeconds, algorithm: "HS256" }
  );

  await storeRefreshToken(
    tokenHash,
    {
      userId: finalUserId!,
      deviceId,
      deviceName: meta.userAgent ? "Corporate SSO Browser" : undefined,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      createdAt: new Date().toISOString(),
    },
    refreshTokenTtlSeconds
  );

  // Store sliding inactivity timestamp in Redis
  const sessionData: SsoSessionData = {
    userId: finalUserId!,
    organizationId: org.id,
    email,
    role: assignedRole,
    employeeId,
    department,
    lastActivityAt: Date.now(),
    inactivityTimeoutMinutes: org.ssoConfig.inactivityTimeoutMinutes,
  };

  await storeActiveDeviceSession(finalUserId!, deviceId, sessionTtlSeconds);

  const redis = getRedisClient();
  if (redis) {
    await redis.set(
      `sso:session:${finalUserId}:${deviceId}`,
      JSON.stringify(sessionData),
      "EX",
      sessionTtlSeconds
    );
  }

  return {
    user: {
      id: finalUserId!,
      email,
      name: existingUser ? existingUser.name : name,
      role: assignedRole,
      organizationId: org.id,
      organizationName: org.name,
    },
    sessionToken,
    refreshToken: rawRefreshToken,
    deviceId,
    inactivityTimeoutMinutes: org.ssoConfig.inactivityTimeoutMinutes,
  };
}

/**
 * Refreshes the sliding session inactivity TTL in Redis for active SSO sessions.
 */
export async function touchSsoSession(userId: string, deviceId: string, timeoutMinutes = 15): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const sessionKey = `sso:session:${userId}:${deviceId}`;
  const raw = await redis.get(sessionKey);
  if (!raw) return false;

  try {
    const sessionData: SsoSessionData = JSON.parse(raw);
    sessionData.lastActivityAt = Date.now();
    const ttlSeconds = (sessionData.inactivityTimeoutMinutes || timeoutMinutes) * 60;

    await redis.set(sessionKey, JSON.stringify(sessionData), "EX", ttlSeconds);
    await storeActiveDeviceSession(userId, deviceId, ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether an active SSO session is within its sliding inactivity window.
 */
export async function validateSsoSession(userId: string, deviceId: string): Promise<{ valid: boolean; sessionData?: SsoSessionData }> {
  const redis = getRedisClient();
  if (!redis) {
    // If Redis is temporarily unconfigured/offline in local dev, allow valid token pass-through
    return { valid: true };
  }

  const sessionKey = `sso:session:${userId}:${deviceId}`;
  const raw = await redis.get(sessionKey);
  if (!raw) {
    return { valid: false };
  }

  try {
    const sessionData: SsoSessionData = JSON.parse(raw);
    return { valid: true, sessionData };
  } catch {
    return { valid: false };
  }
}

