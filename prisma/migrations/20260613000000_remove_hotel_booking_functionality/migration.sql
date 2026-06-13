-- Remove hotel listing, room inventory, and hotel booking surfaces.

DELETE FROM "WishlistItem" WHERE "hotelId" IS NOT NULL OR "target" = 'HOTEL';
DELETE FROM "Review" WHERE "hotelId" IS NOT NULL OR "target" = 'HOTEL';
DELETE FROM "ModerationLog" WHERE "entityType" = 'HOTEL';
UPDATE "Host" SET "hostType" = 'MULTI_SERVICE' WHERE "hostType" = 'HOTEL_OWNER';

ALTER TABLE "Booking" DROP COLUMN IF EXISTS "hotelId";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "hotelId";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "hotelId";
ALTER TABLE "WishlistItem" DROP COLUMN IF EXISTS "hotelId";

DROP TABLE IF EXISTS "InventoryReservation" CASCADE;
DROP TABLE IF EXISTS "BlackoutDate" CASCADE;
DROP TABLE IF EXISTS "SeasonalPricing" CASCADE;
DROP TABLE IF EXISTS "RoomAvailability" CASCADE;
DROP TABLE IF EXISTS "BookingGuest" CASCADE;
DROP TABLE IF EXISTS "BookingRoom" CASCADE;
DROP TABLE IF EXISTS "HotelAmenity" CASCADE;
DROP TABLE IF EXISTS "HotelImage" CASCADE;
DROP TABLE IF EXISTS "HotelRule" CASCADE;
DROP TABLE IF EXISTS "Room" CASCADE;
DROP TABLE IF EXISTS "Hotel" CASCADE;

ALTER TYPE "HostType" RENAME TO "HostType_old";
CREATE TYPE "HostType" AS ENUM ('TOUR_OPERATOR', 'RENTAL_AGENCY', 'ACTIVITY_PROVIDER', 'MULTI_SERVICE');
ALTER TABLE "Host"
  ALTER COLUMN "hostType" DROP DEFAULT,
  ALTER COLUMN "hostType" TYPE "HostType" USING "hostType"::text::"HostType",
  ALTER COLUMN "hostType" SET DEFAULT 'MULTI_SERVICE';
DROP TYPE "HostType_old";

ALTER TYPE "ReviewTarget" RENAME TO "ReviewTarget_old";
CREATE TYPE "ReviewTarget" AS ENUM ('TOUR', 'RENTAL', 'ACTIVITY');
ALTER TABLE "Review"
  ALTER COLUMN "target" TYPE "ReviewTarget" USING "target"::text::"ReviewTarget";
DROP TYPE "ReviewTarget_old";

ALTER TYPE "WishlistTarget" RENAME TO "WishlistTarget_old";
CREATE TYPE "WishlistTarget" AS ENUM ('TOUR', 'RENTAL', 'ACTIVITY');
ALTER TABLE "WishlistItem"
  ALTER COLUMN "target" TYPE "WishlistTarget" USING "target"::text::"WishlistTarget";
DROP TYPE "WishlistTarget_old";

ALTER TYPE "ModerationEntityType" RENAME TO "ModerationEntityType_old";
CREATE TYPE "ModerationEntityType" AS ENUM ('USER', 'HOST', 'TOUR', 'RENTAL', 'ACTIVITY', 'KYC', 'BOOKING', 'PAYOUT', 'REVIEW');
ALTER TABLE "ModerationLog"
  ALTER COLUMN "entityType" TYPE "ModerationEntityType" USING "entityType"::text::"ModerationEntityType";
DROP TYPE "ModerationEntityType_old";

DROP TYPE IF EXISTS "PropertyType";
DROP TYPE IF EXISTS "RoomType";
DROP TYPE IF EXISTS "ReservationStatus";
