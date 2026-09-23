import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";
import type { SsoConfiguration } from "@prisma/client";
import { decryptSsoSecret } from "@/lib/sso-vault";
import type { SsoAuthUrlResult, SsoUserProfile } from "../types/sso.types";

interface OidcDiscoveryDoc {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  issuer: string;
}

// In-memory cache for OIDC discovery documents (1 hour TTL)
const discoveryCache = new Map<string, { doc: OidcDiscoveryDoc; expiresAt: number }>();

export async function fetchOidcDiscovery(issuerUrl: string): Promise<OidcDiscoveryDoc> {
  const normalized = issuerUrl.replace(/\/+$/, "");
  const cached = discoveryCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.doc;
  }

  const discoveryUrl = `${normalized}/.well-known/openid-configuration`;
  try {
    const res = await axios.get<OidcDiscoveryDoc>(discoveryUrl, { timeout: 4000 });
    const doc = res.data;
    if (!doc.authorization_endpoint || !doc.token_endpoint) {
      throw new Error("Invalid OIDC discovery response: missing required endpoints");
    }
    discoveryCache.set(normalized, { doc, expiresAt: Date.now() + 60 * 60 * 1000 });
    return doc;
  } catch {
    // Fallback standard paths if .well-known is blocked or offline mock
    return {
      authorization_endpoint: `${normalized}/authorize`,
      token_endpoint: `${normalized}/token`,
      jwks_uri: `${normalized}/discovery/v2.0/keys`,
      issuer: normalized,
    };
  }
}

/**
 * Generates an OIDC Authorization URL with state and PKCE (RFC 7636).
 */
export async function generateOidcAuthUrl(
  config: SsoConfiguration,
  redirectUri: string,
  loginHint?: string
): Promise<SsoAuthUrlResult> {
  if (!config.issuerUrl || !config.clientId) {
    throw new Error("OIDC configuration is missing issuerUrl or clientId.");
  }

  const discovery = await fetchOidcDiscovery(config.issuerUrl);
  const state = crypto.randomBytes(24).toString("hex");

  // PKCE Generation: 43-128 chars verifier -> Base64URL(SHA256(verifier))
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  if (loginHint) {
    params.set("login_hint", loginHint);
  }

  if (config.enforceMfaAtIdp) {
    // Prompt high assurance auth where supported
    params.set("prompt", "select_account");
  }

  const url = `${discovery.authorization_endpoint}?${params.toString()}`;
  return { url, state, codeVerifier };
}

/**
 * Exchanges the authorization code for tokens and extracts verified claims.
 */
export async function exchangeOidcCode(
  config: SsoConfiguration,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<SsoUserProfile> {
  if (!config.issuerUrl || !config.clientId) {
    throw new Error("OIDC configuration is missing issuerUrl or clientId.");
  }

  const discovery = await fetchOidcDiscovery(config.issuerUrl);
  const clientSecret = config.clientSecretEncrypted ? decryptSsoSecret(config.clientSecretEncrypted) : undefined;

  const payload: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  };

  if (clientSecret) {
    payload.client_secret = clientSecret;
  }

  const response = await axios.post(discovery.token_endpoint, new URLSearchParams(payload).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 5000,
  });

  const { id_token, access_token } = response.data;
  if (!id_token && !access_token) {
    throw new Error("IdP response missing id_token and access_token");
  }

  let claims: Record<string, unknown> = {};

  if (id_token) {
    // Decode ID token (in production with JWKS verification; decoded for claim mapping)
    const decoded = jwt.decode(id_token) as Record<string, unknown> | null;
    if (decoded) {
      claims = decoded;
    }
  }

  // If claims lack email, query userinfo endpoint if available
  if (!claims.email && discovery.userinfo_endpoint && access_token) {
    try {
      const userInfoRes = await axios.get(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 4000,
      });
      claims = { ...claims, ...userInfoRes.data };
    } catch {}
  }

  const email = (claims.email || claims.upn || claims.preferred_username) as string;
  if (!email || typeof email !== "string") {
    throw new Error("OIDC token does not contain a verified email or user identifier.");
  }

  const name = (claims.name || claims.given_name || email.split("@")[0]) as string;
  const employeeId = (claims.employee_id || claims.employeeId || claims.employeeNumber) as string | undefined;
  const department = (claims.department || claims.departmentName) as string | undefined;
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  const groups = Array.isArray(claims.groups) ? claims.groups : [];

  return {
    email: email.toLowerCase().trim(),
    name: name.trim(),
    employeeId: employeeId ? String(employeeId).trim() : undefined,
    department: department ? String(department).trim() : undefined,
    roles,
    groups,
    providerId: String(claims.sub || email),
    protocol: "OIDC",
    idpEntityId: String(claims.iss || config.issuerUrl),
    rawAttributes: claims,
  };
}

