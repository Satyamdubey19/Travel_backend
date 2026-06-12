ALTER TABLE "Room"
ADD COLUMN "availableRooms" INTEGER NOT NULL DEFAULT 1;

UPDATE "Room"
SET "availableRooms" = "totalRooms"
WHERE "availableRooms" = 1;

ALTER TABLE "Tour"
ADD COLUMN "totalSlots" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "availableSlots" INTEGER NOT NULL DEFAULT 20;

UPDATE "Tour"
SET "totalSlots" = "maxGroupSize",
    "availableSlots" = "maxGroupSize";

ALTER TABLE "Activity"
ADD COLUMN "totalSlots" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "availableSlots" INTEGER NOT NULL DEFAULT 20;

UPDATE "Activity"
SET "totalSlots" = "groupSizeMax",
    "availableSlots" = "groupSizeMax";

ALTER TABLE "Rental"
ADD COLUMN "totalUnits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "availableUnits" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Room"
ADD CONSTRAINT "Room_availableRooms_check" CHECK ("availableRooms" >= 0 AND "availableRooms" <= "totalRooms");

ALTER TABLE "Tour"
ADD CONSTRAINT "Tour_availableSlots_check" CHECK ("availableSlots" >= 0 AND "availableSlots" <= "totalSlots");

ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_availableSlots_check" CHECK ("availableSlots" >= 0 AND "availableSlots" <= "totalSlots");

ALTER TABLE "Rental"
ADD CONSTRAINT "Rental_availableUnits_check" CHECK ("availableUnits" >= 0 AND "availableUnits" <= "totalUnits");
