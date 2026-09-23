import crypto from "crypto";
import zlib from "zlib";
import type { SsoConfiguration } from "@prisma/client";
import type { SsoAuthUrlResult, SsoUserProfile } from "../types/sso.types";

/**
 * Generates an XML AuthnRequest for SAML 2.0 Web Browser SSO Profile.
 */
export function generateSamlAuthnRequest(
  config: SsoConfiguration,
  assertionConsumerServiceUrl: string
): SsoAuthUrlResult {
  if (!config.entryPoint || !config.issuer) {
    throw new Error("SAML 2.0 configuration is missing entryPoint or issuer.");
  }

  const requestId = "_" + crypto.randomBytes(16).toString("hex");
  const issueInstant = new Date().toISOString();
  const state = crypto.randomBytes(24).toString("hex");

  const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${requestId}"
    Version="2.0"
    IssueInstant="${issueInstant}"
    Destination="${config.entryPoint}"
    AssertionConsumerServiceURL="${assertionConsumerServiceUrl}"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
    <saml:Issuer>${config.issuer}</saml:Issuer>
    <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;

  // HTTP-Redirect Binding: Deflate -> Base64 -> URLEncode
  const deflated = zlib.deflateRawSync(Buffer.from(xml, "utf8"));
  const samlRequest = deflated.toString("base64");

  const params = new URLSearchParams({
    SAMLRequest: samlRequest,
    RelayState: state,
  });

  const separator = config.entryPoint.includes("?") ? "&" : "?";
  const url = `${config.entryPoint}${separator}${params.toString()}`;

  return { url, state };
}

/**
 * Parses and validates SAMLResponse XML, extracting NameID and assertion attributes.
 */
export function validateSamlResponse(
  config: SsoConfiguration,
  samlResponseBase64: string
): SsoUserProfile {
  if (!samlResponseBase64) {
    throw new Error("Missing SAMLResponse parameter.");
  }

  const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8");

  // Check StatusCode
  if (!xml.includes("urn:oasis:names:tc:SAML:2.0:status:Success")) {
    const statusMatch = xml.match(/<samlp:StatusMessage>(.*?)<\/samlp:StatusMessage>/i);
    const message = statusMatch ? statusMatch[1] : "SAML authentication was rejected by Identity Provider.";
    throw new Error(`SAML Error: ${message}`);
  }

  // Extract NameID (Primary Email or Subject)
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>(.*?)<\/saml:NameID>/i) || xml.match(/<NameID[^>]*>(.*?)<\/NameID>/i);
  let email = nameIdMatch ? nameIdMatch[1].trim() : "";

  // Extract Attributes
  const attributes: Record<string, string> = {};
  const attrRegex = /<saml:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([\s\S]*?)<\/saml:AttributeValue>[\s\S]*?<\/saml:Attribute>/gi;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(xml)) !== null) {
    const key = match[1];
    const val = match[2].trim();
    attributes[key] = val;
  }

  // Common claim namespaces (ADFS, Okta, Azure AD)
  const emailClaim =
    attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    attributes["email"] ||
    attributes["User.Email"] ||
    attributes["mail"];

  if (emailClaim) {
    email = emailClaim;
  }

  if (!email || !email.includes("@")) {
    throw new Error("SAMLResponse did not contain a valid email address in NameID or AttributeStatement.");
  }

  const displayName =
    attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
    attributes["displayName"] ||
    attributes["name"] ||
    email.split("@")[0];

  const employeeId =
    attributes["employeeNumber"] ||
    attributes["employeeId"] ||
    attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/privatepersonalidentifier"];

  const department = attributes["department"] || attributes["departmentName"];
  const rolesRaw = attributes["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || attributes["role"] || attributes["groups"];
  const roles = rolesRaw ? rolesRaw.split(",").map((r) => r.trim()) : [];

  return {
    email: email.toLowerCase().trim(),
    name: displayName.trim(),
    employeeId: employeeId ? employeeId.trim() : undefined,
    department: department ? department.trim() : undefined,
    roles,
    groups: roles,
    providerId: email.toLowerCase().trim(),
    protocol: "SAML2",
    idpEntityId: config.issuer || "SAML_IDP",
    rawAttributes: attributes,
  };
}

