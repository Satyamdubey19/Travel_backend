-- Production hotel inventory calendar upgrade.
-- Room.totalRooms and Room.availableRooms remain for compatibility, but sellable availability is now date based.

CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Booking"
ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "BookingRoom"
ADD COLUMN "inventoryReserved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Room"
ADD COLUMN "baseOccupancy" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "instantBook" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minAdvanceDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAdvanceDays" INTEGER;

ALTER TABLE "RoomAvailability"
ADD COLUMN "totalInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "soldInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservedInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "availableInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "basePrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "isClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedToCheckIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedToCheckOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minStay" INTEGER,
ADD COLUMN "maxStay" INTEGER;

UPDATE "RoomAvailability" AS calendar
SET
  "totalInventory" = room."totalRooms",
  "soldInventory" = GREATEST(room."totalRooms" - calendar."availableCount", 0),
  "reservedInventory" = 0,
  "availableInventory" = calendar."availableCount",
  "basePrice" = room."pricePerNight"
FROM "Room" AS room
WHERE calendar."roomId" = room."id";

CREATE TABLE "InventoryReservation" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "quantity" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonalPricing" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "price" DECIMAL(10, 2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeasonalPricing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlackoutDate" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonalPricing_roomId_startDate_endDate_key" ON "SeasonalPricing"("roomId", "startDate", "endDate");
CREATE UNIQUE INDEX "BlackoutDate_roomId_date_key" ON "BlackoutDate"("roomId", "date");

CREATE INDEX "Booking_checkIn_checkOut_idx" ON "Booking"("checkIn", "checkOut");
CREATE INDEX "Room_hotelId_type_idx" ON "Room"("hotelId", "type");
CREATE INDEX "Room_pricePerNight_idx" ON "Room"("pricePerNight");
CREATE INDEX "RoomAvailability_availableInventory_idx" ON "RoomAvailability"("availableInventory");
CREATE INDEX "RoomAvailability_date_availableInventory_idx" ON "RoomAvailability"("date", "availableInventory");
CREATE INDEX "InventoryReservation_roomId_idx" ON "InventoryReservation"("roomId");
CREATE INDEX "InventoryReservation_bookingId_idx" ON "InventoryReservation"("bookingId");
CREATE INDEX "InventoryReservation_expiresAt_idx" ON "InventoryReservation"("expiresAt");
CREATE INDEX "InventoryReservation_status_idx" ON "InventoryReservation"("status");
CREATE INDEX "InventoryReservation_roomId_checkIn_checkOut_idx" ON "InventoryReservation"("roomId", "checkIn", "checkOut");
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "SeasonalPricing_roomId_idx" ON "SeasonalPricing"("roomId");
CREATE INDEX "SeasonalPricing_roomId_startDate_endDate_idx" ON "SeasonalPricing"("roomId", "startDate", "endDate");
CREATE INDEX "BlackoutDate_roomId_idx" ON "BlackoutDate"("roomId");
CREATE INDEX "BlackoutDate_date_idx" ON "BlackoutDate"("date");

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonalPricing"
ADD CONSTRAINT "SeasonalPricing_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackoutDate"
ADD CONSTRAINT "BlackoutDate_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomAvailability"
ADD CONSTRAINT "RoomAvailability_inventory_check"
CHECK (
  "totalInventory" >= 0
  AND "soldInventory" >= 0
  AND "reservedInventory" >= 0
  AND "availableInventory" >= 0
  AND "availableInventory" <= "totalInventory"
);

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_quantity_check"
CHECK ("quantity" > 0 AND "checkOut" > "checkIn");
