-- CreateTable
CREATE TABLE "public"."GeneratedGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "difficulty" TEXT NOT NULL,
    "learningLanguage" TEXT NOT NULL,
    "userLanguage" TEXT NOT NULL,
    "scenarioIds" TEXT[],
    "words" TEXT[],
    "gameData" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedGame_userId_status_idx" ON "public"."GeneratedGame"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "public"."Notification"("userId", "isRead");
