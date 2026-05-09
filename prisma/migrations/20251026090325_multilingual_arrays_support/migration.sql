/*
  Warnings:

  - Changed the type of `title` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `description` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `expectedWords` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `expectedPhrases` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `requiredWords` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `optionalWords` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `successMessage` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `failureMessage` on the `ScenarioGoal` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `translation` on the `ScenarioVocabulary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."LearnedWord" ADD COLUMN     "cefrLevel" TEXT DEFAULT 'A1';

-- AlterTable
ALTER TABLE "public"."ScenarioGoal" DROP COLUMN "title",
ADD COLUMN     "title" JSONB NOT NULL,
DROP COLUMN "description",
ADD COLUMN     "description" JSONB NOT NULL,
DROP COLUMN "expectedWords",
ADD COLUMN     "expectedWords" JSONB NOT NULL,
DROP COLUMN "expectedPhrases",
ADD COLUMN     "expectedPhrases" JSONB NOT NULL,
DROP COLUMN "requiredWords",
ADD COLUMN     "requiredWords" JSONB NOT NULL,
DROP COLUMN "optionalWords",
ADD COLUMN     "optionalWords" JSONB NOT NULL,
DROP COLUMN "successMessage",
ADD COLUMN     "successMessage" JSONB NOT NULL,
DROP COLUMN "failureMessage",
ADD COLUMN     "failureMessage" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "public"."ScenarioVocabulary" DROP COLUMN "translation",
ADD COLUMN     "translation" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "cefrLevel" TEXT DEFAULT 'A1';
