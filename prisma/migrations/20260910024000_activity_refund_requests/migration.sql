CREATE TABLE "ActivityRefund" (
  "id" TEXT NOT NULL,
  "activityBookingId" TEXT NOT NULL,
  "activityPaymentId" TEXT,
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
  CONSTRAINT "ActivityRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityRefund_activityBookingId_key" ON "ActivityRefund"("activityBookingId");
CREATE UNIQUE INDEX "ActivityRefund_activityPaymentId_key" ON "ActivityRefund"("activityPaymentId");
CREATE INDEX "ActivityRefund_status_createdAt_idx" ON "ActivityRefund"("status", "createdAt");

ALTER TABLE "ActivityRefund" ADD CONSTRAINT "ActivityRefund_activityBookingId_fkey" FOREIGN KEY ("activityBookingId") REFERENCES "ActivityBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityRefund" ADD CONSTRAINT "ActivityRefund_activityPaymentId_fkey" FOREIGN KEY ("activityPaymentId") REFERENCES "ActivityPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
