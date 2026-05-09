-- AlterTable: Convert Scenario title and description to Json
ALTER TABLE "Scenario" ALTER COLUMN "title" TYPE JSONB USING jsonb_build_object('fr', "title");
ALTER TABLE "Scenario" ALTER COLUMN "description" TYPE JSONB USING jsonb_build_object('fr', "description");

