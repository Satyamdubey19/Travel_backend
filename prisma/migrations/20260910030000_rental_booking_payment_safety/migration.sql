ALTER TABLE "RentalBooking"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "RentalBooking_idempotencyKey_key" ON "RentalBooking"("idempotencyKey");
CREATE INDEX "RentalBooking_expiresAt_idx" ON "RentalBooking"("expiresAt");
CREATE UNIQUE INDEX "RentalPayment_providerOrderId_key" ON "RentalPayment"("providerOrderId");
CREATE UNIQUE INDEX "RentalPayment_providerPaymentId_key" ON "RentalPayment"("providerPaymentId");

CREATE TABLE "RentalRefund" (
  "id" TEXT NOT NULL,
  "rentalBookingId" TEXT NOT NULL,
  "rentalPaymentId" TEXT,
  "requestedAmount" DECIMAL(10,2) NOT NULL,
  "approvedAmount" DECIMAL(10,2),
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'REVIEW_PENDING',
  "reason" TEXT,
  "policySnapshot" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "RentalRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalRefund_rentalBookingId_fkey" FOREIGN KEY ("rentalBookingId") REFERENCES "RentalBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RentalRefund_rentalPaymentId_fkey" FOREIGN KEY ("rentalPaymentId") REFERENCES "RentalPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RentalRefund_rentalBookingId_key" ON "RentalRefund"("rentalBookingId");
CREATE UNIQUE INDEX "RentalRefund_rentalPaymentId_key" ON "RentalRefund"("rentalPaymentId");
CREATE INDEX "RentalRefund_status_createdAt_idx" ON "RentalRefund"("status", "createdAt");
