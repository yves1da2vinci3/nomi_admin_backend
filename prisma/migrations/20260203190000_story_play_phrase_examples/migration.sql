-- Phrase examples cache on LearnedWord (TTL enforced in application, 24h)
ALTER TABLE "LearnedWord" ADD COLUMN IF NOT EXISTS "phraseExamples" JSONB;
ALTER TABLE "LearnedWord" ADD COLUMN IF NOT EXISTS "phraseExamplesExpiresAt" TIMESTAMP(3);

-- StoryPlay: per-user play tracking for shared Interactive Stories
CREATE TABLE IF NOT EXISTS "StoryPlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,

    CONSTRAINT "StoryPlay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoryPlay_userId_gameId_key" ON "StoryPlay"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "StoryPlay_userId_completedAt_idx" ON "StoryPlay"("userId", "completedAt");
CREATE INDEX IF NOT EXISTS "StoryPlay_gameId_idx" ON "StoryPlay"("gameId");

ALTER TABLE "StoryPlay" DROP CONSTRAINT IF EXISTS "StoryPlay_userId_fkey";
ALTER TABLE "StoryPlay" ADD CONSTRAINT "StoryPlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryPlay" DROP CONSTRAINT IF EXISTS "StoryPlay_gameId_fkey";
ALTER TABLE "StoryPlay" ADD CONSTRAINT "StoryPlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GeneratedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
