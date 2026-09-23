ALTER TABLE "ActivityBooking"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ActivityBooking_idempotencyKey_key" ON "ActivityBooking"("idempotencyKey");
CREATE INDEX "ActivityBooking_expiresAt_idx" ON "ActivityBooking"("expiresAt");

CREATE UNIQUE INDEX "ActivityPayment_providerOrderId_key" ON "ActivityPayment"("providerOrderId");
CREATE UNIQUE INDEX "ActivityPayment_providerPaymentId_key" ON "ActivityPayment"("providerPaymentId");
