-- CreateTable
CREATE TABLE "ScenarioKeywordsHintsCache" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "learningLanguage" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "hints" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioKeywordsHintsCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioKeywordsHintsCache_scenarioId_learningLanguage_idx" ON "ScenarioKeywordsHintsCache"("scenarioId", "learningLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioKeywordsHintsCache_scenarioId_goalId_learningLangua_key" ON "ScenarioKeywordsHintsCache"("scenarioId", "goalId", "learningLanguage", "difficulty");
