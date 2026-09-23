-- Durable participant blocking and message-report moderation for private Trip Circles.
CREATE TYPE "CommunityReportReason" AS ENUM (
  'HARASSMENT',
  'HATE_OR_ABUSE',
  'SEXUAL_CONTENT',
  'THREAT_OR_SAFETY',
  'SCAM_OR_SPAM',
  'PRIVACY_VIOLATION',
  'OTHER'
);

CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED');

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBlock_no_self_check" CHECK ("blockerId" <> "blockedId")
);

CREATE TABLE "TourMessageReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "reason" "CommunityReportReason" NOT NULL,
  "details" TEXT,
  "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TourMessageReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourMessageReport_no_self_check" CHECK ("reporterId" <> "reportedUserId")
);

CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");
CREATE UNIQUE INDEX "TourMessageReport_reporterId_messageId_key" ON "TourMessageReport"("reporterId", "messageId");
CREATE INDEX "TourMessageReport_status_createdAt_idx" ON "TourMessageReport"("status", "createdAt");
CREATE INDEX "TourMessageReport_tourId_idx" ON "TourMessageReport"("tourId");
CREATE INDEX "TourMessageReport_reportedUserId_idx" ON "TourMessageReport"("reportedUserId");

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourMessageReport" ADD CONSTRAINT "TourMessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TourMessageReport" ADD CONSTRAINT "TourMessageReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TourMessageReport" ADD CONSTRAINT "TourMessageReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TourMessageReport" ADD CONSTRAINT "TourMessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TourMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TourMessageReport" ADD CONSTRAINT "TourMessageReport_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
