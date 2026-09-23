import assert from "node:assert/strict";
import test from "node:test";
import { authSchemaAuditTables, getAuthSchemaAuditConfig } from "@/lib/auth-schema-audit";

const safeEnvironment = {
  AUTH_SCHEMA_AUDIT_CONFIRMATION: "READ_ONLY",
  AUTH_SCHEMA_AUDIT_ENVIRONMENT: "staging",
  DATABASE_URL: "postgresql://audit_user:audit_password@localhost:5432/travels_audit",
};

test("auth schema audit refuses an unconfirmed, production, or unconfigured target", () => {
  assert.throws(() => getAuthSchemaAuditConfig({ ...safeEnvironment, AUTH_SCHEMA_AUDIT_CONFIRMATION: undefined }), /READ_ONLY/);
  assert.throws(() => getAuthSchemaAuditConfig({ ...safeEnvironment, AUTH_SCHEMA_AUDIT_ENVIRONMENT: "production" }), /production is refused/);
  assert.throws(() => getAuthSchemaAuditConfig({ ...safeEnvironment, DATABASE_URL: "" }), /DATABASE_URL/);
});

test("auth schema audit only targets the expected security tables", () => {
  assert.deepEqual(authSchemaAuditTables, [
    "User",
    "RefreshToken",
    "Session",
    "UserDevice",
    "PasswordResetToken",
    "EmailChangeRequest",
    "LoginAttempt",
    "SecurityEvent",
  ]);
  assert.deepEqual(getAuthSchemaAuditConfig(safeEnvironment), {
    connectionString: safeEnvironment.DATABASE_URL,
    environment: "staging",
  });
});
