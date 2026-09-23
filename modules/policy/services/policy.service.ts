import { prisma } from "@/lib/prisma";
import type { PolicyConsent, PolicyType } from "@prisma/client";
import type {
  CreatePolicyInput,
  PolicyDto,
  UserConsentStatus,
} from "../types/policy";

export async function getActivePolicies(
  types?: PolicyType[]
): Promise<PolicyDto[]> {
  const where: Record<string, unknown> = { isActive: true };
  if (types && types.length > 0) {
    where.type = { in: types };
  }

  const policies = await prisma.policy.findMany({
    where,
    orderBy: { type: "asc" },
  });

  return policies.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    version: p.version,
    summary: p.summary,
    content: p.content,
    isActive: p.isActive,
    effectiveDate: p.effectiveDate.toISOString(),
    publishedById: p.publishedById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function getPolicyByType(
  type: PolicyType
): Promise<PolicyDto | null> {
  const policy = await prisma.policy.findFirst({
    where: { type, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!policy) return null;

  return {
    id: policy.id,
    type: policy.type,
    title: policy.title,
    version: policy.version,
    summary: policy.summary,
    content: policy.content,
    isActive: policy.isActive,
    effectiveDate: policy.effectiveDate.toISOString(),
    publishedById: policy.publishedById,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export async function checkUserConsentStatus(
  userId: string,
  role?: string
): Promise<UserConsentStatus> {
  const mandatoryTypes: PolicyType[] = [
    "TERMS_OF_SERVICE",
    "PRIVACY_POLICY",
  ];

  if (role === "HOST" || role === "host") {
    mandatoryTypes.push("HOST_SAFETY_AGREEMENT");
  }

  // Get active versions of mandatory policies
  const activePolicies = await prisma.policy.findMany({
    where: { type: { in: mandatoryTypes }, isActive: true },
  });

  // Get all user consents
  const userConsents = await prisma.policyConsent.findMany({
    where: { userId },
    orderBy: { consentedAt: "desc" },
  });

  const acceptedPolicies = userConsents.map((c) => ({
    type: c.policyType,
    version: c.policyVersion,
    consentedAt: c.consentedAt.toISOString(),
  }));

  const missingPolicies: UserConsentStatus["missingPolicies"] = [];

  for (const active of activePolicies) {
    const hasConsented = userConsents.some(
      (c) =>
        c.policyType === active.type &&
        c.policyVersion === active.version
    );

    if (!hasConsented) {
      missingPolicies.push({
        type: active.type,
        version: active.version,
        id: active.id,
        title: active.title,
        summary: active.summary,
      });
    }
  }

  return {
    hasAcceptedMandatory: missingPolicies.length === 0,
    reconsentRequired: missingPolicies.length > 0,
    missingPolicies,
    acceptedPolicies,
  };
}

export async function recordUserConsent(
  userId: string,
  consents: Array<{
    policyType?: PolicyType;
    policyId?: string;
    policyVersion?: string;
  }>,
  context?: {
    ipAddress?: string;
    userAgent?: string;
    actionContext?: string;
  }
) {
  if (!consents || consents.length === 0) {
    return { count: 0 };
  }

  const results: PolicyConsent[] = [];

  for (const item of consents) {
    let policy: {
      id: string;
      type: PolicyType;
      version: string;
    } | null = null;

    if (item.policyId) {
      policy = await prisma.policy.findUnique({
        where: { id: item.policyId },
      });
    } else if (item.policyType && item.policyVersion) {
      policy = await prisma.policy.findFirst({
        where: { type: item.policyType, version: item.policyVersion },
      });
    } else if (item.policyType) {
      policy = await prisma.policy.findFirst({
        where: { type: item.policyType, isActive: true },
      });
    }

    if (!policy) {
      continue;
    }

    // Check if already consented to this exact version
    const existing = await prisma.policyConsent.findFirst({
      where: {
        userId,
        policyId: policy.id,
        policyVersion: policy.version,
      },
    });

    if (!existing) {
      const consentRecord = await prisma.policyConsent.create({
        data: {
          userId,
          policyId: policy.id,
          policyType: policy.type,
          policyVersion: policy.version,
          ipAddress: context?.ipAddress || null,
          userAgent: context?.userAgent || null,
          context: context?.actionContext || "USER_INTERACTION",
        },
      });
      results.push(consentRecord);
    } else {
      results.push(existing);
    }
  }

  return {
    count: results.length,
    recorded: results,
  };
}

export async function adminListPolicies() {
  const policies = await prisma.policy.findMany({
    include: {
      _count: {
        select: { Consents: true },
      },
      PublishedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });

  return policies.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    version: p.version,
    summary: p.summary,
    content: p.content,
    isActive: p.isActive,
    effectiveDate: p.effectiveDate.toISOString(),
    publishedById: p.publishedById,
    publishedBy: p.PublishedBy,
    consentCount: p._count.Consents,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function adminCreatePolicyVersion(
  adminUserId: string,
  input: CreatePolicyInput
) {
  return prisma.$transaction(async (tx) => {
    // If set to activate immediately, mark other versions of this type as inactive
    if (input.activateImmediately !== false) {
      await tx.policy.updateMany({
        where: { type: input.type, isActive: true },
        data: { isActive: false },
      });
    }

    const policy = await tx.policy.create({
      data: {
        type: input.type,
        title: input.title,
        version: input.version,
        summary: input.summary || null,
        content: input.content,
        isActive: input.activateImmediately !== false,
        publishedById: adminUserId,
        effectiveDate: new Date(),
      },
    });

    return policy;
  });
}

export async function adminTogglePolicyActive(
  policyId: string,
  isActive: boolean
) {
  const target = await prisma.policy.findUnique({
    where: { id: policyId },
  });

  if (!target) {
    throw Object.assign(new Error("Policy not found"), { statusCode: 404 });
  }

  return prisma.$transaction(async (tx) => {
    if (isActive) {
      // Deactivate any other version of same type
      await tx.policy.updateMany({
        where: { type: target.type, isActive: true, NOT: { id: policyId } },
        data: { isActive: false },
      });
    }

    const updated = await tx.policy.update({
      where: { id: policyId },
      data: { isActive },
    });

    return updated;
  });
}

export async function adminGetConsentAuditLogs(params: {
  page?: number;
  limit?: number;
  policyType?: PolicyType;
  search?: string;
}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.policyType) {
    where.policyType = params.policyType;
  }

  if (params.search) {
    where.User = {
      OR: [
        { email: { contains: params.search, mode: "insensitive" } },
        { name: { contains: params.search, mode: "insensitive" } },
      ],
    };
  }

  const [total, items] = await Promise.all([
    prisma.policyConsent.count({ where }),
    prisma.policyConsent.findMany({
      where,
      include: {
        User: {
          select: { id: true, name: true, email: true, role: true },
        },
        Policy: {
          select: { id: true, title: true, version: true, type: true },
        },
      },
      orderBy: { consentedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map((i) => ({
      id: i.id,
      userId: i.userId,
      user: i.User,
      policyId: i.policyId,
      policy: i.Policy,
      policyType: i.policyType,
      policyVersion: i.policyVersion,
      ipAddress: i.ipAddress,
      userAgent: i.userAgent,
      context: i.context,
      consentedAt: i.consentedAt.toISOString(),
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

