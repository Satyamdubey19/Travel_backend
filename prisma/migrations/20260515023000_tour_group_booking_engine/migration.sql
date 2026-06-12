CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "TourBooking" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "bookingCode" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "batchId" TEXT,
  "legacyBookingId" TEXT UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "travelersCount" INTEGER NOT NULL DEFAULT 1,
  "confirmedCount" INTEGER NOT NULL DEFAULT 0,
  "waitlistedCount" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "taxes" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "expiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TourBooking_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TourBooking_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TourBooking_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TourDepartureBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TourBooking_legacyBookingId_fkey" FOREIGN KEY ("legacyBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourBooking_userId_createdAt_idx" ON "TourBooking"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TourBooking_tourId_status_idx" ON "TourBooking"("tourId", "status");
CREATE INDEX IF NOT EXISTS "TourBooking_batchId_status_idx" ON "TourBooking"("batchId", "status");
CREATE INDEX IF NOT EXISTS "TourBooking_hostId_status_idx" ON "TourBooking"("hostId", "status");

CREATE TABLE IF NOT EXISTS "TourTraveler" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourBookingId" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "age" INTEGER,
  "dob" TIMESTAMP(3),
  "gender" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "country" TEXT,
  "foodPreference" TEXT,
  "medicalNotes" TEXT,
  "bloodGroup" TEXT,
  "idType" TEXT,
  "idUploadUrl" TEXT,
  "relation" TEXT,
  "seatPreference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourTraveler_tourBookingId_fkey" FOREIGN KEY ("tourBookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourTraveler_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourTraveler_tourBookingId_status_idx" ON "TourTraveler"("tourBookingId", "status");
CREATE INDEX IF NOT EXISTS "TourTraveler_email_phone_idx" ON "TourTraveler"("email", "phone");

CREATE TABLE IF NOT EXISTS "WaitlistQueue" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourId" TEXT NOT NULL,
  "batchId" TEXT,
  "tourBookingId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "groupSize" INTEGER NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITLISTED',
  "promotedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistQueue_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitlistQueue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TourDepartureBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WaitlistQueue_tourBookingId_fkey" FOREIGN KEY ("tourBookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitlistQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistQueue_batch_position_key" ON "WaitlistQueue"(COALESCE("batchId", "tourId"), "position");
CREATE INDEX IF NOT EXISTS "WaitlistQueue_tour_status_position_idx" ON "WaitlistQueue"("tourId", "status", "position");

CREATE TABLE IF NOT EXISTS "TourCancellation" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourBookingId" TEXT NOT NULL,
  "travelerId" TEXT,
  "cancelledById" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'BOOKING',
  "reason" TEXT,
  "refundPercent" INTEGER NOT NULL DEFAULT 0,
  "refundAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "TourCancellation_tourBookingId_fkey" FOREIGN KEY ("tourBookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TourCancellation_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "TourTraveler"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TourCancellation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TourCancellation_booking_status_idx" ON "TourCancellation"("tourBookingId", "status");

CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tourBookingId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "providerRefundId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "Refund_tourBookingId_fkey" FOREIGN KEY ("tourBookingId") REFERENCES "TourBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Refund_booking_status_idx" ON "Refund"("tourBookingId", "status");
