CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "TourDepartureBatch" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourId" TEXT NOT NULL,
  "label" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "registrationDeadline" TIMESTAMP(3),
  "cancellationCutoff" TIMESTAMP(3),
  "totalSeats" INTEGER NOT NULL DEFAULT 20,
  "seatsLeft" INTEGER NOT NULL DEFAULT 20,
  "basePrice" DECIMAL(10,2) NOT NULL,
  "earlyBirdPrice" DECIMAL(10,2),
  "earlyBirdEndsAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourDepartureBatch_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourDepartureBatch_seats_nonnegative" CHECK ("seatsLeft" >= 0 AND "totalSeats" >= 0)
);

CREATE INDEX IF NOT EXISTS "TourDepartureBatch_tourId_startDate_idx" ON "TourDepartureBatch"("tourId", "startDate");
CREATE INDEX IF NOT EXISTS "TourDepartureBatch_status_startDate_idx" ON "TourDepartureBatch"("status", "startDate");

ALTER TABLE "TourWaitlist"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "seatsRequested" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'WAITING',
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourWaitlist_batchId_fkey') THEN
    ALTER TABLE "TourWaitlist"
      ADD CONSTRAINT "TourWaitlist_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TourDepartureBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TourWaitlist_userId_tourId_batchId_key" ON "TourWaitlist"("userId", "tourId", COALESCE("batchId", 'tour'));
CREATE INDEX IF NOT EXISTS "TourWaitlist_tourId_status_position_idx" ON "TourWaitlist"("tourId", "status", "position");

CREATE TABLE IF NOT EXISTS "TourAnnouncement" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourAnnouncement_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourAnnouncement_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourAnnouncement_tourId_createdAt_idx" ON "TourAnnouncement"("tourId", "createdAt");
CREATE INDEX IF NOT EXISTS "TourAnnouncement_tourId_isPinned_idx" ON "TourAnnouncement"("tourId", "isPinned");

CREATE TABLE IF NOT EXISTS "TourDocument" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'GUIDELINE',
  "url" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'PARTICIPANTS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourDocument_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourDocument_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourDocument_tourId_visibility_idx" ON "TourDocument"("tourId", "visibility");

CREATE TABLE IF NOT EXISTS "TourMessageReaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TourMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TourMessageReaction_messageId_userId_emoji_key" ON "TourMessageReaction"("messageId", "userId", "emoji");
