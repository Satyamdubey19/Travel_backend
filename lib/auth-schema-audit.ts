export const authSchemaAuditTables = [
  "User",
  "RefreshToken",
  "Session",
  "UserDevice",
  "PasswordResetToken",
  "EmailChangeRequest",
  "LoginAttempt",
  "SecurityEvent",
] as const;

type AuditEnvironment = "development" | "staging";

export type AuthSchemaAuditConfig = {
  connectionString: string;
  environment: AuditEnvironment;
};

export function getAuthSchemaAuditConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthSchemaAuditConfig {
  if (environment.AUTH_SCHEMA_AUDIT_CONFIRMATION !== "READ_ONLY") {
    throw new Error("Set AUTH_SCHEMA_AUDIT_CONFIRMATION=READ_ONLY before running the auth schema audit.");
  }

  const target = environment.AUTH_SCHEMA_AUDIT_ENVIRONMENT;
  if (target !== "development" && target !== "staging") {
    throw new Error("Set AUTH_SCHEMA_AUDIT_ENVIRONMENT to development or staging; production is refused.");
  }

  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the read-only auth schema audit.");
  }

  return { connectionString, environment: target };
}
