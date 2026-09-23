import assert from "node:assert/strict";
import test from "node:test";
import { Role, SsoProtocol } from "@prisma/client";
import {
  mapIdpRoleToAppRole,
  SsoInactiveAccountError,
  SsoProvisioningError,
} from "@/modules/sso/services/sso-auth.service";
import { encryptSsoSecret, decryptSsoSecret } from "@/lib/sso-vault";
import { createStateToken, verifyStateToken } from "@/modules/sso/utils/sso-http";
import { validateSamlResponse, generateSamlAuthnRequest } from "@/modules/sso/services/saml.service";

test("SSO Key Vault: AES-256-GCM encrypts and decrypts IdP client secrets and private keys", () => {
  const secret = "azure-client-secret-abc-12345-xyz!";
  const encrypted = encryptSsoSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);

  const decrypted = decryptSsoSecret(encrypted);
  assert.equal(decrypted, secret);
});

test("SSO Key Vault: Tampered ciphertext or invalid auth tag throws authentication error", () => {
  const secret = "okta-private-signing-key";
  const encrypted = encryptSsoSecret(secret);
  const parts = encrypted.split(":");
  // Tamper with the ciphertext
  const tamperedCiphertext = parts[1].replace(/^[0-9a-f]/, (c) => (c === "a" ? "b" : "a"));
  const corrupted = `${parts[0]}:${tamperedCiphertext}:${parts[2]}`;

  assert.throws(() => decryptSsoSecret(corrupted));
});

test("SSO RBAC: maps IdP group claims to application roles accurately", () => {
  // Admin claims
  assert.equal(mapIdpRoleToAppRole(["Performance_App_Admin"], Role.USER), Role.ADMIN);
  assert.equal(mapIdpRoleToAppRole(["Org_SuperAdmin", "Employee"], Role.USER), Role.ADMIN);

  // Host / Manager claims
  assert.equal(mapIdpRoleToAppRole(["Travel_Host_Manager"], Role.USER), Role.HOST);
  assert.equal(mapIdpRoleToAppRole(["performance_reviewer"], Role.USER), Role.HOST);

  // Default fallback for regular employee
  assert.equal(mapIdpRoleToAppRole(["Staff_Member", "Employee"], Role.USER), Role.USER);
  assert.equal(mapIdpRoleToAppRole([], Role.USER), Role.USER);
  assert.equal(mapIdpRoleToAppRole([], Role.HOST), Role.HOST);
});

test("SSO State Token: creates and verifies HMAC-signed tamper-evident state tokens", () => {
  const statePayload = {
    state: "random-uuid-state-123",
    codeVerifier: "pkce-code-verifier-456",
    organizationId: "org-uuid-789",
    domain: "acme.com",
    protocol: "OIDC" as const,
  };

  const token = createStateToken(statePayload, 300);
  assert.ok(token.includes("."));

  const verified = verifyStateToken<typeof statePayload>(token);
  assert.ok(verified);
  assert.equal(verified?.state, "random-uuid-state-123");
  assert.equal(verified?.domain, "acme.com");
  assert.equal(verified?.protocol, "OIDC");

  // Tampered signature must fail
  const [dataPart, sigPart] = token.split(".");
  const tamperedToken = `${dataPart}.${sigPart.slice(0, -2)}xx`;
  assert.equal(verifyStateToken(tamperedToken), null);

  // Expired token must return null
  const expiredToken = createStateToken(statePayload, -10);
  assert.equal(verifyStateToken(expiredToken), null);
});

test("SSO SAML 2.0: AuthnRequest generation produces valid Deflated Base64 and RelayState", () => {
  const mockConfig = {
    id: "sso-cfg-1",
    organizationId: "org-1",
    protocol: SsoProtocol.SAML2,
    provider: "OKTA" as const,
    issuerUrl: null,
    clientId: null,
    clientSecretEncrypted: null,
    entryPoint: "https://login.okta.com/app/travelspro/sso/saml",
    issuer: "urn:travelspro:sp",
    cert: null,
    logoutUrl: "https://login.okta.com/app/travelspro/slo",
    jitEnabled: true,
    defaultRole: Role.USER,
    inactivityTimeoutMinutes: 15,
    enforceMfaAtIdp: true,
    allowPasswordFallback: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = generateSamlAuthnRequest(mockConfig, "https://api.travelspro.com/api/auth/sso/callback");
  assert.ok(result.url.startsWith("https://login.okta.com/app/travelspro/sso/saml"));
  assert.ok(result.url.includes("SAMLRequest="));
  assert.ok(result.url.includes("RelayState="));
  assert.ok(result.state.length > 0);
});

test("SSO SAML 2.0: parses valid assertion XML with NameID and enterprise attributes", () => {
  const mockConfig = {
    id: "sso-cfg-1",
    organizationId: "org-1",
    protocol: SsoProtocol.SAML2,
    provider: "OKTA" as const,
    issuerUrl: null,
    clientId: null,
    clientSecretEncrypted: null,
    entryPoint: "https://login.okta.com/app/travelspro/sso/saml",
    issuer: "urn:travelspro:sp",
    cert: null,
    logoutUrl: null,
    jitEnabled: true,
    defaultRole: Role.USER,
    inactivityTimeoutMinutes: 30,
    enforceMfaAtIdp: true,
    allowPasswordFallback: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const xmlAssertion = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
      <samlp:Status>
        <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
      </samlp:Status>
      <saml:Assertion>
        <saml:Subject>
          <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">ananya.deshmukh@acme.corp</saml:NameID>
        </saml:Subject>
        <saml:AttributeStatement>
          <saml:Attribute Name="displayName">
            <saml:AttributeValue>Ananya Deshmukh</saml:AttributeValue>
          </saml:Attribute>
          <saml:Attribute Name="employeeId">
            <saml:AttributeValue>EMP-9021</saml:AttributeValue>
          </saml:Attribute>
          <saml:Attribute Name="department">
            <saml:AttributeValue>Product Engineering</saml:AttributeValue>
          </saml:Attribute>
          <saml:Attribute Name="role">
            <saml:AttributeValue>Admin,Performance_Reviewer</saml:AttributeValue>
          </saml:Attribute>
        </saml:AttributeStatement>
      </saml:Assertion>
    </samlp:Response>
  `;

  const base64Response = Buffer.from(xmlAssertion, "utf8").toString("base64");
  const profile = validateSamlResponse(mockConfig, base64Response);

  assert.equal(profile.email, "ananya.deshmukh@acme.corp");
  assert.equal(profile.name, "Ananya Deshmukh");
  assert.equal(profile.employeeId, "EMP-9021");
  assert.equal(profile.department, "Product Engineering");
  assert.deepEqual(profile.roles, ["Admin", "Performance_Reviewer"]);
  assert.equal(profile.protocol, "SAML2");
});

test("SSO SAML 2.0: throws descriptive error if IdP returns non-success status", () => {
  const mockConfig = {
    id: "sso-cfg-1",
    organizationId: "org-1",
    protocol: SsoProtocol.SAML2,
    provider: "OKTA" as const,
    issuerUrl: null,
    clientId: null,
    clientSecretEncrypted: null,
    entryPoint: "https://login.okta.com",
    issuer: "urn:travelspro:sp",
    cert: null,
    logoutUrl: null,
    jitEnabled: true,
    defaultRole: Role.USER,
    inactivityTimeoutMinutes: 30,
    enforceMfaAtIdp: true,
    allowPasswordFallback: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const xmlRejected = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
      <samlp:Status>
        <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"/>
        <samlp:StatusMessage>User authentication failed at corporate directory</samlp:StatusMessage>
      </samlp:Status>
    </samlp:Response>
  `;

  const base64 = Buffer.from(xmlRejected, "utf8").toString("base64");
  assert.throws(() => validateSamlResponse(mockConfig, base64), /User authentication failed/);
});

test("SSO Inactive Account & Provisioning Error classes", () => {
  const inactiveErr = new SsoInactiveAccountError();
  assert.equal(inactiveErr.name, "SsoInactiveAccountError");
  assert.match(inactiveErr.message, /inactive/i);

  const provErr = new SsoProvisioningError();
  assert.equal(provErr.name, "SsoProvisioningError");
  assert.match(provErr.message, /provisioning is disabled/i);
});

