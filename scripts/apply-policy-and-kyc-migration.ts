import { prisma } from "../lib/prisma";

async function main() {
  console.log("Applying additive Policy and KYC migrations safely to Neon PostgreSQL...");

  const queries = [
    `DO $$ BEGIN
      CREATE TYPE "PolicyType" AS ENUM (
        'TERMS_OF_SERVICE',
        'PRIVACY_POLICY',
        'HOST_SAFETY_AGREEMENT',
        'TRAVELER_SAFETY_POLICY',
        'CANCELLATION_POLICY'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "Policy" (
      "id" TEXT NOT NULL,
      "type" "PolicyType" NOT NULL,
      "title" TEXT NOT NULL,
      "version" TEXT NOT NULL,
      "summary" TEXT,
      "content" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "publishedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "Policy_type_version_key" ON "Policy"("type", "version");`,
    `CREATE INDEX IF NOT EXISTS "Policy_type_isActive_idx" ON "Policy"("type", "isActive");`,
    `CREATE INDEX IF NOT EXISTS "Policy_publishedById_idx" ON "Policy"("publishedById");`,

    `DO $$ BEGIN
      ALTER TABLE "Policy" ADD CONSTRAINT "Policy_publishedById_fkey"
      FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "PolicyConsent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "policyId" TEXT NOT NULL,
      "policyType" "PolicyType" NOT NULL,
      "policyVersion" TEXT NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "context" TEXT NOT NULL DEFAULT 'SIGNUP',
      "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PolicyConsent_pkey" PRIMARY KEY ("id")
    );`,

    `CREATE INDEX IF NOT EXISTS "PolicyConsent_userId_policyType_idx" ON "PolicyConsent"("userId", "policyType");`,
    `CREATE INDEX IF NOT EXISTS "PolicyConsent_policyId_idx" ON "PolicyConsent"("policyId");`,
    `CREATE INDEX IF NOT EXISTS "PolicyConsent_consentedAt_idx" ON "PolicyConsent"("consentedAt");`,

    `DO $$ BEGIN
      ALTER TABLE "PolicyConsent" ADD CONSTRAINT "PolicyConsent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "PolicyConsent" ADD CONSTRAINT "PolicyConsent_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Additive columns for KycApplication
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "hostType" TEXT NOT NULL DEFAULT 'INDIVIDUAL';`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "selfieUrl" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "streetAddress" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "city" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "state" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'India';`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "addressProofType" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "businessName" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "gstin" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "businessPan" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "bankName" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "cancelledChequeUrl" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "safetyCertUrl" TEXT;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "agreedToHostSafetyPolicy" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "KycApplication" ADD COLUMN IF NOT EXISTS "safetyPolicyAgreedAt" TIMESTAMP(3);`,
  ];

  for (const q of queries) {
    await prisma.$executeRawUnsafe(q);
  }

  console.log("Additive Policy and KYC database migrations successfully applied!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

