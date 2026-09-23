import type { PolicyType } from "@prisma/client";

export type { PolicyType };

export interface PolicyDto {
  id: string;
  type: PolicyType;
  title: string;
  version: string;
  summary: string | null;
  content: string;
  isActive: boolean;
  effectiveDate: string;
  publishedById?: string | null;
  createdAt: string;
  updatedAt: string;
  consentCount?: number;
}

export interface ConsentRecordInput {
  policyType: PolicyType;
  policyVersion?: string;
  policyId?: string;
}

export interface UserConsentStatus {
  hasAcceptedMandatory: boolean;
  reconsentRequired: boolean;
  missingPolicies: Array<{
    type: PolicyType;
    version: string;
    id: string;
    title: string;
    summary: string | null;
  }>;
  acceptedPolicies: Array<{
    type: PolicyType;
    version: string;
    consentedAt: string;
  }>;
}

export interface CreatePolicyInput {
  type: PolicyType;
  title: string;
  version: string;
  summary?: string;
  content: string;
  activateImmediately?: boolean;
}

