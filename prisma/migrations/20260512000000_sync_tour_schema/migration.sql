DO $$ BEGIN
  CREATE TYPE "TourStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "TourParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'JOINED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "TourRole" AS ENUM ('HOST', 'CO_HOST', 'MEMBER', 'MODERATOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tour"
  ADD COLUMN IF NOT EXISTS "joinApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tourStatus" "TourStatus" NOT NULL DEFAULT 'UPCOMING',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "womenOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "safeForSoloWomen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifiedTravelersOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "registrationDeadline" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TourParticipant" (
  "id" TEXT PRIMARY KEY,
  "tourId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookingId" TEXT,
  "status" "TourParticipantStatus" NOT NULL DEFAULT 'PENDING',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "introMessage" TEXT,
  "role" "TourRole" NOT NULL DEFAULT 'MEMBER',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "isHostApproved" BOOLEAN NOT NULL DEFAULT false,
  "checkedInAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "TourParticipant_tourId_userId_key" ON "TourParticipant"("tourId", "userId");
CREATE INDEX IF NOT EXISTS "TourParticipant_tourId_idx" ON "TourParticipant"("tourId");
CREATE INDEX IF NOT EXISTS "TourParticipant_userId_idx" ON "TourParticipant"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourParticipant_tourId_fkey') THEN
    ALTER TABLE "TourParticipant" ADD CONSTRAINT "TourParticipant_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourParticipant_userId_fkey') THEN
    ALTER TABLE "TourParticipant" ADD CONSTRAINT "TourParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourParticipant_bookingId_fkey') THEN
    ALTER TABLE "TourParticipant" ADD CONSTRAINT "TourParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TravelerReport" (
  "id" TEXT PRIMARY KEY,
  "reporterId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "TravelerReport_tourId_idx" ON "TravelerReport"("tourId");
CREATE INDEX IF NOT EXISTS "TravelerReport_reporterId_idx" ON "TravelerReport"("reporterId");
CREATE INDEX IF NOT EXISTS "TravelerReport_reportedUserId_idx" ON "TravelerReport"("reportedUserId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelerReport_tourId_fkey') THEN
    ALTER TABLE "TravelerReport" ADD CONSTRAINT "TravelerReport_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelerReport_reporterId_fkey') THEN
    ALTER TABLE "TravelerReport" ADD CONSTRAINT "TravelerReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelerReport_reportedUserId_fkey') THEN
    ALTER TABLE "TravelerReport" ADD CONSTRAINT "TravelerReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TourWaitlist" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourWaitlist_userId_fkey') THEN
    ALTER TABLE "TourWaitlist" ADD CONSTRAINT "TourWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourWaitlist_tourId_fkey') THEN
    ALTER TABLE "TourWaitlist" ADD CONSTRAINT "TourWaitlist_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TourChatRoom" (
  "id" TEXT PRIMARY KEY,
  "tourId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "name" TEXT,
  "imageUrl" TEXT
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourChatRoom_tourId_fkey') THEN
    ALTER TABLE "TourChatRoom" ADD CONSTRAINT "TourChatRoom_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TourMessage" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "participantId" TEXT,
  "message" TEXT,
  "imageUrl" TEXT,
  "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMP(3),
  "isEdited" BOOLEAN NOT NULL DEFAULT false,
  "editedAt" TIMESTAMP(3)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourMessage_roomId_fkey') THEN
    ALTER TABLE "TourMessage" ADD CONSTRAINT "TourMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TourChatRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourMessage_senderId_fkey') THEN
    ALTER TABLE "TourMessage" ADD CONSTRAINT "TourMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourMessage_participantId_fkey') THEN
    ALTER TABLE "TourMessage" ADD CONSTRAINT "TourMessage_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TourParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TourJoinRequest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "introduction" TEXT,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UserTravelPreference" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "preferredAgeMin" INTEGER,
  "preferredAgeMax" INTEGER,
  "preferredLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "likesAdventure" BOOLEAN NOT NULL DEFAULT false,
  "likesNightlife" BOOLEAN NOT NULL DEFAULT false,
  "likesNature" BOOLEAN NOT NULL DEFAULT false,
  "budgetRange" TEXT
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserTravelPreference_userId_fkey') THEN
    ALTER TABLE "UserTravelPreference" ADD CONSTRAINT "UserTravelPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
