import type { SsoProtocol, Role } from "@prisma/client";

export interface SsoUserProfile {
  email: string;
  name: string;
  employeeId?: string;
  department?: string;
  roles?: string[];
  groups?: string[];
  providerId: string;
  protocol: SsoProtocol;
  idpEntityId: string;
  rawAttributes?: Record<string, unknown>;
}

export interface SsoAuthUrlResult {
  url: string;
  state: string;
  codeVerifier?: string;
}

export interface SsoCallbackInput {
  domain?: string;
  code?: string;
  state?: string;
  SAMLResponse?: string;
  RelayState?: string;
  codeVerifier?: string;
}

export interface SsoSessionData {
  userId: string;
  organizationId: string;
  email: string;
  role: Role;
  employeeId?: string;
  department?: string;
  lastActivityAt: number;
  inactivityTimeoutMinutes: number;
}

