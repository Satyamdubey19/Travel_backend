CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT,
  "deviceName" TEXT,
  "deviceType" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL DEFAULT 'browser',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");

ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDevice" DROP CONSTRAINT IF EXISTS "UserDevice_userId_fkey";
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
CREATE INDEX IF NOT EXISTS "Session_deviceId_idx" ON "Session"("deviceId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_isActive_idx" ON "Session"("isActive");
CREATE INDEX IF NOT EXISTS "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserDevice" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

ALTER TABLE "UserDevice" ALTER COLUMN "deviceType" SET DEFAULT 'browser';
UPDATE "UserDevice" SET "deviceType" = 'browser' WHERE "deviceType" IS NULL;

CREATE INDEX IF NOT EXISTS "UserDevice_deviceId_idx" ON "UserDevice"("deviceId");
CREATE INDEX IF NOT EXISTS "UserDevice_isActive_idx" ON "UserDevice"("isActive");
