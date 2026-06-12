ALTER TABLE "TourChatRoom"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

ALTER TABLE "TourMessage"
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT;

CREATE INDEX IF NOT EXISTS "TourMessage_roomId_createdAt_idx" ON "TourMessage"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "TourMessage_senderId_idx" ON "TourMessage"("senderId");

CREATE TABLE IF NOT EXISTS "TourMessageSeen" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "TourMessageSeen_messageId_userId_key" ON "TourMessageSeen"("messageId", "userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourMessageSeen_messageId_fkey') THEN
    ALTER TABLE "TourMessageSeen" ADD CONSTRAINT "TourMessageSeen_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TourMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourMessageSeen_userId_fkey') THEN
    ALTER TABLE "TourMessageSeen" ADD CONSTRAINT "TourMessageSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
