ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionInvalidatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_sessionInvalidatedAt_idx" ON "User"("sessionInvalidatedAt");
