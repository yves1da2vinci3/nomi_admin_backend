-- CreateEnum
CREATE TYPE "LexicalBand" AS ENUM ('foundational', 'developing', 'refined');

-- AlterTable LearnedWord: new columns (keep cefrLevel until backfill)
ALTER TABLE "LearnedWord" ADD COLUMN IF NOT EXISTS "lexicalBand" "LexicalBand" NOT NULL DEFAULT 'foundational';
ALTER TABLE "LearnedWord" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "LearnedWord" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- Backfill lexicalBand from legacy cefrLevel when column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'LearnedWord' AND column_name = 'cefrLevel'
  ) THEN
    UPDATE "LearnedWord" SET "lexicalBand" = CASE
      WHEN UPPER(COALESCE("cefrLevel", 'A1')) IN ('A1', 'A2') THEN 'foundational'::"LexicalBand"
      WHEN UPPER(COALESCE("cefrLevel", 'A1')) IN ('B1', 'B2') THEN 'developing'::"LexicalBand"
      ELSE 'refined'::"LexicalBand"
    END;
  END IF;
END $$;

-- Normalize LearnedWord.language to ISO codes (subset aligned with app catalog)
UPDATE "LearnedWord" SET language = CASE lower(trim(language))
  WHEN 'french' THEN 'fr'
  WHEN 'français' THEN 'fr'
  WHEN 'francais' THEN 'fr'
  WHEN 'fr' THEN 'fr'
  WHEN 'spanish' THEN 'es'
  WHEN 'español' THEN 'es'
  WHEN 'espanol' THEN 'es'
  WHEN 'es' THEN 'es'
  WHEN 'german' THEN 'de'
  WHEN 'deutsch' THEN 'de'
  WHEN 'de' THEN 'de'
  WHEN 'italian' THEN 'it'
  WHEN 'italiano' THEN 'it'
  WHEN 'it' THEN 'it'
  WHEN 'portuguese' THEN 'pt'
  WHEN 'português' THEN 'pt'
  WHEN 'portugues' THEN 'pt'
  WHEN 'pt' THEN 'pt'
  WHEN 'english' THEN 'en'
  WHEN 'en' THEN 'en'
  WHEN 'japanese' THEN 'ja'
  WHEN 'ja' THEN 'ja'
  WHEN 'mandarin' THEN 'zh'
  WHEN 'zh' THEN 'zh'
  WHEN 'arabic' THEN 'ar'
  WHEN 'ar' THEN 'ar'
  WHEN 'turkish' THEN 'tr'
  WHEN 'tr' THEN 'tr'
  WHEN 'dutch' THEN 'nl'
  WHEN 'nederlands' THEN 'nl'
  WHEN 'nl' THEN 'nl'
  WHEN 'swedish' THEN 'sv'
  WHEN 'svenska' THEN 'sv'
  WHEN 'sv' THEN 'sv'
  WHEN 'hindi' THEN 'hi'
  WHEN 'hi' THEN 'hi'
  WHEN 'polish' THEN 'pl'
  WHEN 'polski' THEN 'pl'
  WHEN 'pl' THEN 'pl'
  WHEN 'français' THEN 'fr'
  ELSE lower(trim(language))
END;

-- Dedupe: keep richest row per (userId, language, word case-insensitive)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", language, lower(trim(word))
      ORDER BY "masteryLevel" DESC, "timesUsed" DESC, "updatedAt" DESC
    ) AS rn
  FROM "LearnedWord"
)
DELETE FROM "LearnedWord" WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Drop legacy cefrLevel on LearnedWord
ALTER TABLE "LearnedWord" DROP COLUMN IF EXISTS "cefrLevel";

-- CreateTable UserLanguageLexicalStage
CREATE TABLE "UserLanguageLexicalStage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "lexicalStage" "LexicalBand" NOT NULL DEFAULT 'foundational',
    "lastPromotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLanguageLexicalStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserLanguageLexicalStage_userId_languageCode_key" ON "UserLanguageLexicalStage"("userId", "languageCode");
CREATE INDEX "UserLanguageLexicalStage_userId_idx" ON "UserLanguageLexicalStage"("userId");
ALTER TABLE "UserLanguageLexicalStage" ADD CONSTRAINT "UserLanguageLexicalStage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed UserLanguageLexicalStage from User.cefrLevel + learningLanguage (one row per user primary language)
INSERT INTO "UserLanguageLexicalStage" ("id", "userId", "languageCode", "lexicalStage", "lastPromotedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       u."id",
       CASE lower(trim(COALESCE(u."learningLanguage", 'en')))
         WHEN 'french' THEN 'fr'
         WHEN 'français' THEN 'fr'
         WHEN 'francais' THEN 'fr'
         WHEN 'spanish' THEN 'es'
         WHEN 'español' THEN 'es'
         WHEN 'espanol' THEN 'es'
         WHEN 'german' THEN 'de'
         WHEN 'deutsch' THEN 'de'
         WHEN 'italian' THEN 'it'
         WHEN 'italiano' THEN 'it'
         WHEN 'portuguese' THEN 'pt'
         WHEN 'português' THEN 'pt'
         WHEN 'portugues' THEN 'pt'
         WHEN 'english' THEN 'en'
         WHEN 'japanese' THEN 'ja'
         WHEN 'mandarin' THEN 'zh'
         WHEN 'arabic' THEN 'ar'
         WHEN 'turkish' THEN 'tr'
         WHEN 'dutch' THEN 'nl'
         WHEN 'swedish' THEN 'sv'
         WHEN 'hindi' THEN 'hi'
         WHEN 'polish' THEN 'pl'
         WHEN 'fr' THEN 'fr'
         WHEN 'es' THEN 'es'
         WHEN 'de' THEN 'de'
         WHEN 'it' THEN 'it'
         WHEN 'pt' THEN 'pt'
         WHEN 'en' THEN 'en'
         WHEN 'ja' THEN 'ja'
         WHEN 'zh' THEN 'zh'
         WHEN 'ar' THEN 'ar'
         WHEN 'tr' THEN 'tr'
         WHEN 'nl' THEN 'nl'
         WHEN 'sv' THEN 'sv'
         WHEN 'hi' THEN 'hi'
         WHEN 'pl' THEN 'pl'
         ELSE 'en'
       END,
       CASE
         WHEN UPPER(COALESCE(u."cefrLevel", 'A1')) IN ('A1', 'A2') THEN 'foundational'::"LexicalBand"
         WHEN UPPER(COALESCE(u."cefrLevel", 'A1')) IN ('B1', 'B2') THEN 'developing'::"LexicalBand"
         ELSE 'refined'::"LexicalBand"
       END,
       NULL,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "User" u
WHERE COALESCE(trim(u."learningLanguage"), '') <> ''
ON CONFLICT ("userId", "languageCode") DO NOTHING;

-- Drop User.cefrLevel (replaced by per-language lexical stage)
ALTER TABLE "User" DROP COLUMN IF EXISTS "cefrLevel";

-- Unique on LearnedWord
CREATE UNIQUE INDEX IF NOT EXISTS "LearnedWord_userId_language_word_key" ON "LearnedWord"("userId", language, word);

-- CreateTable LearnedWordSession
CREATE TABLE "LearnedWordSession" (
    "id" TEXT NOT NULL,
    "learnedWordId" TEXT NOT NULL,
    "scenarioSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnedWordSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearnedWordSession_learnedWordId_scenarioSessionId_key" ON "LearnedWordSession"("learnedWordId", "scenarioSessionId");
CREATE INDEX "LearnedWordSession_scenarioSessionId_idx" ON "LearnedWordSession"("scenarioSessionId");
ALTER TABLE "LearnedWordSession" ADD CONSTRAINT "LearnedWordSession_learnedWordId_fkey" FOREIGN KEY ("learnedWordId") REFERENCES "LearnedWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnedWordSession" ADD CONSTRAINT "LearnedWordSession_scenarioSessionId_fkey" FOREIGN KEY ("scenarioSessionId") REFERENCES "ScenarioSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
