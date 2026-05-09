-- Reconcile externally managed tables already present in production DB.
-- This migration is idempotent to avoid destructive operations.

CREATE TABLE IF NOT EXISTS "public"."diary_entries" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "audio_path" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "raw_text" TEXT,
    "corrected_text" TEXT,
    "expected_ipa" TEXT,
    "detected_theme" TEXT,
    "theme_keywords" JSONB,
    "words" JSONB,
    "analysis" JSONB,
    "diff" JSONB,
    "response_text" TEXT,
    "response_audio_path" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "language" TEXT,
    "user_id" TEXT,
    "native_language" TEXT,
    "response_translation" TEXT,
    "audio_url" TEXT,
    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_diary_entries_created_at"
    ON "public"."diary_entries" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_diary_entries_language"
    ON "public"."diary_entries" ("language");
CREATE INDEX IF NOT EXISTS "idx_diary_entries_status"
    ON "public"."diary_entries" ("status");
CREATE INDEX IF NOT EXISTS "idx_diary_entries_user_id"
    ON "public"."diary_entries" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" BIGINT NOT NULL,
    "dirty" BOOLEAN NOT NULL,
    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);
