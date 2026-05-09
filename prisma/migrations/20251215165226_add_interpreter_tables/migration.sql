-- CreateTable
CREATE TABLE "InterpreterScenario" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "location" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "pnjs" JSONB NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpreterObjective" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpreterSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "learningLanguage" TEXT NOT NULL,
    "nativeLanguage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalObjectives" INTEGER NOT NULL,
    "scoresPerObjective" JSONB,
    "audioUrls" JSONB,
    "llmEval" JSONB,
    "vocabularySpotlight" JSONB,
    "feedback" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpretationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "objectiveId" TEXT,
    "step" INTEGER NOT NULL,
    "wordTimestamps" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterpretationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterpreterScenario_difficulty_isActive_idx" ON "InterpreterScenario"("difficulty", "isActive");

-- CreateIndex
CREATE INDEX "InterpreterObjective_scenarioId_order_idx" ON "InterpreterObjective"("scenarioId", "order");

-- CreateIndex
CREATE INDEX "InterpreterSession_userId_scenarioId_status_idx" ON "InterpreterSession"("userId", "scenarioId", "status");

-- CreateIndex
CREATE INDEX "InterpreterSession_status_completed_idx" ON "InterpreterSession"("status", "completed");

-- CreateIndex
CREATE INDEX "InterpretationMessage_sessionId_step_idx" ON "InterpretationMessage"("sessionId", "step");

-- CreateIndex
CREATE INDEX "InterpretationMessage_sessionId_objectiveId_idx" ON "InterpretationMessage"("sessionId", "objectiveId");

-- AddForeignKey
ALTER TABLE "InterpreterObjective" ADD CONSTRAINT "InterpreterObjective_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "InterpreterScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterSession" ADD CONSTRAINT "InterpreterSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "InterpreterScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterSession" ADD CONSTRAINT "InterpreterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpretationMessage" ADD CONSTRAINT "InterpretationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterpreterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
