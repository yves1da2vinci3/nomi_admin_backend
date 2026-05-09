-- DropIndex
DROP INDEX "ScenarioKeywordsHintsCache_scenarioId_goalId_learningLangua_key";

-- DropIndex
DROP INDEX "ScenarioKeywordsHintsCache_scenarioId_learningLanguage_idx";

-- AlterTable: add with default, then drop default
ALTER TABLE "ScenarioKeywordsHintsCache" ADD COLUMN "nativeLanguage" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "ScenarioKeywordsHintsCache" ALTER COLUMN "nativeLanguage" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ScenarioKeywordsHintsCache_scenarioId_learningLanguage_nati_idx" ON "ScenarioKeywordsHintsCache"("scenarioId", "learningLanguage", "nativeLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioKeywordsHintsCache_scenarioId_goalId_learningLangua_key" ON "ScenarioKeywordsHintsCache"("scenarioId", "goalId", "learningLanguage", "nativeLanguage", "difficulty");
