ALTER TABLE "TourTraveler"
  ADD COLUMN IF NOT EXISTS "normalizedName" TEXT,
  ADD COLUMN IF NOT EXISTS "aadhaarHash" TEXT,
  ADD COLUMN IF NOT EXISTS "aadhaarLast4" TEXT;

CREATE INDEX IF NOT EXISTS "TourTraveler_aadhaarHash_idx" ON "TourTraveler"("aadhaarHash");
CREATE INDEX IF NOT EXISTS "TourTraveler_normalizedName_age_idx" ON "TourTraveler"("normalizedName", "age");
CREATE INDEX IF NOT EXISTS "TourTraveler_normalizedName_dob_idx" ON "TourTraveler"("normalizedName", "dob");
