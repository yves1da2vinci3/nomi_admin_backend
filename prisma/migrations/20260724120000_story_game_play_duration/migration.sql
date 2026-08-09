-- AlterTable
ALTER TABLE "StoryPlay" ADD COLUMN IF NOT EXISTS "durationSec" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GamePlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER NOT NULL,
    "score" INTEGER,

    CONSTRAINT "GamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GamePlay_userId_gameType_idx" ON "GamePlay"("userId", "gameType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GamePlay_userId_completedAt_idx" ON "GamePlay"("userId", "completedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GamePlay_gameId_idx" ON "GamePlay"("gameId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GeneratedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
