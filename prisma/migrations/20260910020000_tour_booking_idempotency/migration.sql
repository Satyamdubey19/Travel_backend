ALTER TABLE "TourBooking" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "TourBooking_idempotencyKey_key" ON "TourBooking"("idempotencyKey");
