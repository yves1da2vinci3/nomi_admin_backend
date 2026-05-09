/*
  Warnings:

  - You are about to drop the column `currentLanguage` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `languages` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "currentLanguage",
DROP COLUMN "language",
DROP COLUMN "languages",
ADD COLUMN     "learningLanguage" TEXT,
ADD COLUMN     "learningLanguages" TEXT[],
ADD COLUMN     "nativeLanguage" TEXT;

-- CreateTable
CREATE TABLE "public"."Scenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pnjRole" TEXT NOT NULL,
    "pnjPersonality" TEXT NOT NULL,
    "pnjTone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScenarioGoal" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "expectedWords" TEXT[],
    "expectedPhrases" TEXT[],
    "minWords" INTEGER NOT NULL DEFAULT 1,
    "requiredWords" TEXT[],
    "optionalWords" TEXT[],
    "successMessage" TEXT NOT NULL,
    "failureMessage" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScenarioVocabulary" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScenarioSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "learningLanguage" TEXT NOT NULL,
    "nativeLanguage" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "learnedWords" TEXT[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "step" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GECCorrection" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "wrong" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "reason" TEXT,
    "errorType" TEXT,
    "confidence" DOUBLE PRECISION,
    "severity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GECCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LearnedWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "context" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteryLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnedWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "wordsLearned" INTEGER NOT NULL DEFAULT 0,
    "lastPlayed" TIMESTAMP(3),
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioSession_userId_scenarioId_status_idx" ON "public"."ScenarioSession"("userId", "scenarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "public"."UserProgress"("userId");

-- AddForeignKey
ALTER TABLE "public"."ScenarioGoal" ADD CONSTRAINT "ScenarioGoal_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScenarioVocabulary" ADD CONSTRAINT "ScenarioVocabulary_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScenarioSession" ADD CONSTRAINT "ScenarioSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "public"."Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScenarioSession" ADD CONSTRAINT "ScenarioSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ScenarioSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GECCorrection" ADD CONSTRAINT "GECCorrection_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GECCorrection" ADD CONSTRAINT "GECCorrection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ScenarioSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LearnedWord" ADD CONSTRAINT "LearnedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
