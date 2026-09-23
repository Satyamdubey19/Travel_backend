CREATE TYPE "TourRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

ALTER TABLE "Tour"
  ADD COLUMN "riskLevel" "TourRiskLevel" NOT NULL DEFAULT 'LOW',
  ADD COLUMN "riskDisclosure" TEXT,
  ADD COLUMN "meetingPoint" TEXT,
  ADD COLUMN "eligibilityRequirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requiredEquipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "emergencyPlan" TEXT,
  ADD COLUMN "minimumAge" INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN "requiresCaretaker" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Tour_riskLevel_status_idx" ON "Tour"("riskLevel", "status");

ALTER TABLE "Booking"
  ADD COLUMN "riskAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "riskDisclosureSnapshot" JSONB;

ALTER TABLE "TourBooking"
  ADD COLUMN "riskAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "riskDisclosureSnapshot" JSONB;

-- Existing approved tours must be reviewed again with an explicit risk disclosure.
UPDATE "Tour"
SET
  "status" = 'PENDING_REVIEW',
  "isApproved" = false,
  "approvedAt" = NULL,
  "submittedForReviewAt" = CURRENT_TIMESTAMP,
  "moderationNotes" = 'Risk and safety disclosure requires review after schema migration.'
WHERE "isApproved" = true OR "status" = 'ACTIVE';
