import type { NextRequest } from "next/server";
import { requireUser } from "@/utils/user-auth";
import { requireAdmin } from "@/utils/admin-auth";
import { ok, created, fail } from "@/utils/api-response";
import type { PolicyType } from "@prisma/client";
import {
  adminCreatePolicyVersion,
  adminGetConsentAuditLogs,
  adminListPolicies,
  adminTogglePolicyActive,
  checkUserConsentStatus,
  getActivePolicies,
  getPolicyByType,
  recordUserConsent,
} from "../services/policy.service";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function getActivePoliciesController(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typesParam = searchParams.get("types");
    const singleType = searchParams.get("type");

    if (singleType) {
      const policy = await getPolicyByType(singleType as PolicyType);
      return ok({ policy });
    }

    const types = typesParam
      ? (typesParam.split(",").map((t) => t.trim()) as PolicyType[])
      : undefined;

    const policies = await getActivePolicies(types);
    return ok({ policies });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load policies",
      500
    );
  }
}

export async function checkUserConsentController() {
  try {
    const user = await requireUser();
    const status = await checkUserConsentStatus(user.id, user.role);
    return ok(status);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 401
        : 401;
    return fail(
      error instanceof Error ? error.message : "Authentication required",
      status
    );
  }
}

export async function recordConsentController(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    let consents: Array<{
      policyId?: string;
      policyType?: PolicyType;
      policyVersion?: string;
    }> = [];
    if (Array.isArray(body.consents)) {
      consents = body.consents;
    } else if (body.policyId || body.id) {
      consents = [{
        policyId: body.policyId || body.id,
        policyVersion: body.policyVersion || body.version,
        policyType: body.policyType || body.type,
      }];
    } else if (body.policyType || body.type) {
      consents = [{
        policyType: body.policyType || body.type,
        policyVersion: body.policyVersion || body.version,
      }];
    }

    const result = await recordUserConsent(user.id, consents, {
      ipAddress,
      userAgent,
      actionContext: body.context || "CLICKWRAP_AGREEMENT",
    });

    return ok(result);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 400
        : 400;
    return fail(
      error instanceof Error ? error.message : "Failed to record consent",
      status
    );
  }
}

export async function adminListPoliciesController(request: NextRequest) {
  try {
    await requireAdmin(request);
    const policies = await adminListPolicies();
    return ok({ policies });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Admin authorization required",
      403
    );
  }
}

export async function adminCreatePolicyController(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();

    if (!body.type || !body.title || !body.version || !body.content) {
      return fail("Missing required fields (type, title, version, content)", 400);
    }

    const policy = await adminCreatePolicyVersion(admin.id, {
      type: body.type,
      title: body.title,
      version: body.version,
      summary: body.summary,
      content: body.content,
      activateImmediately: body.activateImmediately !== false,
    });

    return created({ policy });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to create policy",
      500
    );
  }
}

export async function adminTogglePolicyController(
  request: NextRequest,
  params: { id: string }
) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const isActive = Boolean(body.isActive);

    const updated = await adminTogglePolicyActive(params.id, isActive);
    return ok({ policy: updated });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to update policy",
      500
    );
  }
}

export async function adminAuditLogsController(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);

    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 20;
    const policyType = searchParams.get("policyType") as
      | PolicyType
      | undefined;
    const search = searchParams.get("search") || undefined;

    const result = await adminGetConsentAuditLogs({
      page,
      limit,
      policyType: policyType || undefined,
      search,
    });

    return ok({ ...result, consents: result.items });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to load audit logs",
      500
    );
  }
}

