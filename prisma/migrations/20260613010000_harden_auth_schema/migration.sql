-- Extend account status values used by the hardened auth flow.
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'BANNED';

DO $$ BEGIN
  CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET_PASSWORD', 'CHANGE_EMAIL', 'CHANGE_PHONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User auth state.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lockedUntil_idx" ON "User"("lockedUntil");

-- RefreshToken now stores only token hashes. Existing legacy plaintext rows are
-- immediately revoked by this migration.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RefreshToken' AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RefreshToken' AND column_name = 'tokenHash'
  ) THEN
    DROP INDEX IF EXISTS "RefreshToken_token_key";
    ALTER TABLE "RefreshToken" RENAME COLUMN "token" TO "tokenHash";
  END IF;
END $$;

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;
UPDATE "RefreshToken" SET "tokenHash" = "id" WHERE "tokenHash" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "isRevoked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
UPDATE "RefreshToken" SET "isRevoked" = true, "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX IF NOT EXISTS "RefreshToken_isRevoked_idx" ON "RefreshToken"("isRevoked");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceName" TEXT,
  "deviceType" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OtpVerification" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "otpHash" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "ipAddress" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "oldEmail" TEXT NOT NULL,
  "newEmail" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_isActive_idx" ON "Session"("isActive");
CREATE INDEX IF NOT EXISTS "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

CREATE INDEX IF NOT EXISTS "OtpVerification_email_idx" ON "OtpVerification"("email");
CREATE INDEX IF NOT EXISTS "OtpVerification_phone_idx" ON "OtpVerification"("phone");
CREATE INDEX IF NOT EXISTS "OtpVerification_purpose_idx" ON "OtpVerification"("purpose");
CREATE INDEX IF NOT EXISTS "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");

CREATE INDEX IF NOT EXISTS "LoginAttempt_email_idx" ON "LoginAttempt"("email");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ipAddress_idx" ON "LoginAttempt"("ipAddress");
CREATE INDEX IF NOT EXISTS "LoginAttempt_success_idx" ON "LoginAttempt"("success");
CREATE INDEX IF NOT EXISTS "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");
CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId");

CREATE INDEX IF NOT EXISTS "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_newEmail_idx" ON "EmailChangeRequest"("newEmail");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_expiresAt_idx" ON "EmailChangeRequest"("expiresAt");

CREATE INDEX IF NOT EXISTS "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");
CREATE INDEX IF NOT EXISTS "SecurityEvent_type_idx" ON "SecurityEvent"("type");
CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDevice" DROP CONSTRAINT IF EXISTS "UserDevice_userId_fkey";
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailChangeRequest" DROP CONSTRAINT IF EXISTS "EmailChangeRequest_userId_fkey";
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecurityEvent" DROP CONSTRAINT IF EXISTS "SecurityEvent_userId_fkey";
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
