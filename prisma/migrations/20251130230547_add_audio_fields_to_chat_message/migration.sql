-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "audioFileUrl" TEXT,
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "inputMode" TEXT,
ADD COLUMN     "transcription" TEXT,
ADD COLUMN     "wordTimestamps" JSONB;
