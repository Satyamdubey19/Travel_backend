import { prisma } from "../lib/prisma";

async function main() {
  console.log("Applying additive SSO schema migrations safely to Neon PostgreSQL...");

  const queries = [
    `DO $$ BEGIN
      CREATE TYPE "SsoProtocol" AS ENUM ('OIDC', 'SAML2');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "SsoIdpProvider" AS ENUM ('ENTRA_ID', 'OKTA', 'GOOGLE_WORKSPACE', 'ONELOGIN', 'GENERIC_SAML', 'GENERIC_OIDC');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "Organization" (
      "id" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE TABLE IF NOT EXISTS "SsoConfiguration" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "protocol" "SsoProtocol" NOT NULL DEFAULT 'OIDC',
      "provider" "SsoIdpProvider" NOT NULL DEFAULT 'ENTRA_ID',
      "issuerUrl" TEXT,
      "clientId" TEXT,
      "clientSecretEncrypted" TEXT,
      "entryPoint" TEXT,
      "issuer" TEXT,
      "cert" TEXT,
      "logoutUrl" TEXT,
      "jitEnabled" BOOLEAN NOT NULL DEFAULT true,
      "defaultRole" "Role" NOT NULL DEFAULT 'USER',
      "inactivityTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
      "enforceMfaAtIdp" BOOLEAN NOT NULL DEFAULT true,
      "allowPasswordFallback" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SsoConfiguration_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE TABLE IF NOT EXISTS "OrganizationMember" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "employeeId" TEXT,
      "department" TEXT,
      "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
      "isCurrent" BOOLEAN NOT NULL DEFAULT true,
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE TABLE IF NOT EXISTS "SsoAuditLog" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT,
      "email" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "protocol" "SsoProtocol" NOT NULL,
      "idpEntityId" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "failureReason" TEXT,
      "metadata" JSONB,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SsoAuditLog_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Organization_domain_key" ON "Organization"("domain");`,
    `CREATE INDEX IF NOT EXISTS "Organization_domain_isActive_idx" ON "Organization"("domain", "isActive");`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "SsoConfiguration_organizationId_key" ON "SsoConfiguration"("organizationId");`,
    `CREATE INDEX IF NOT EXISTS "SsoConfiguration_organizationId_idx" ON "SsoConfiguration"("organizationId");`,

    `CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_isCurrent_idx" ON "OrganizationMember"("organizationId", "isCurrent");`,
    `CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_employeeId_key" ON "OrganizationMember"("organizationId", "employeeId");`,

    `CREATE INDEX IF NOT EXISTS "SsoAuditLog_organizationId_timestamp_idx" ON "SsoAuditLog"("organizationId", "timestamp");`,
    `CREATE INDEX IF NOT EXISTS "SsoAuditLog_email_eventType_idx" ON "SsoAuditLog"("email", "eventType");`,
    `CREATE INDEX IF NOT EXISTS "SsoAuditLog_userId_idx" ON "SsoAuditLog"("userId");`,

    `DO $$ BEGIN
      ALTER TABLE "SsoConfiguration" ADD CONSTRAINT "SsoConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "SsoAuditLog" ADD CONSTRAINT "SsoAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "SsoAuditLog" ADD CONSTRAINT "SsoAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
  ];

  for (const query of queries) {
    await prisma.$executeRawUnsafe(query);
  }

  // Verification check:
  const orgCount = await prisma.organization.count();
  const ssoConfigCount = await prisma.ssoConfiguration.count();
  console.log(`SSO Migration applied successfully. Verified access to Organization (count: ${orgCount}) and SsoConfiguration (count: ${ssoConfigCount}).`);
}

main()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

