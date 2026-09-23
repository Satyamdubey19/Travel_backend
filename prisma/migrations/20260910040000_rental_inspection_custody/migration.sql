CREATE TYPE "RentalInspectionStage" AS ENUM ('PICKUP', 'RETURN');
CREATE TYPE "RentalInspectionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'DISPUTED', 'RESOLVED');
CREATE TYPE "RentalDisputeResolution" AS ENUM ('HOST_EVIDENCE_ACCEPTED', 'TRAVELER_CLAIM_ACCEPTED', 'MUTUAL_SETTLEMENT', 'NO_FINANCIAL_ACTION');

CREATE TABLE "RentalInspection" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "stage" "RentalInspectionStage" NOT NULL,
  "status" "RentalInspectionStatus" NOT NULL DEFAULT 'DRAFT',
  "odometerKm" INTEGER,
  "fuelOrChargePercent" INTEGER,
  "conditionNotes" TEXT,
  "checklist" JSONB,
  "damages" JSONB,
  "evidenceAssetIds" TEXT[] NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "acknowledgedByUserId" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "disputedByUserId" TEXT,
  "disputedAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "resolution" "RentalDisputeResolution",
  "resolutionNotes" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalInspection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalInspection_bookingId_stage_key" ON "RentalInspection"("bookingId", "stage");
CREATE INDEX "RentalInspection_bookingId_status_idx" ON "RentalInspection"("bookingId", "status");
CREATE INDEX "RentalInspection_submittedAt_idx" ON "RentalInspection"("submittedAt");
ALTER TABLE "RentalInspection" ADD CONSTRAINT "RentalInspection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
