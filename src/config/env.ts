import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  PORT: z.coerce.number().default(4001),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_TOKEN: z.string().min(8),
  /** When using Bearer ADMIN_API_TOKEN, optional UUID of an Admin row — sets req.adminAuth.sub for routes that need it (e.g. Studio projects). */
  ADMIN_API_ACTING_SUB: z.string().uuid().optional(),
  /** Email paired with ADMIN_API_ACTING_SUB for req.adminAuth (defaults to api-token placeholder). */
  ADMIN_API_ACTING_EMAIL: z.string().email().optional(),
  ADMIN_CORS_ORIGIN: z.string().optional(),
  /** Origine du portail B2B (`b2b-admin`) autorisée en CORS, ex. http://localhost:3000. */
  PARTNER_CORS_ORIGIN: z.string().optional(),
  /** HS256 secret for admin JWT (min 32 chars recommended) */
  JWT_SECRET: z.string().min(16),
  /** e.g. 8h, 15m — passed to jose */
  JWT_EXPIRES_IN: z.string().optional().default("8h"),
  /** Durée de vie du JWT portail partenaire (`PartnerUser`). */
  PARTNER_JWT_EXPIRES_IN: z.string().optional().default("12h"),
  /** URL publique du portail B2B — sert de base aux redirections Stripe. */
  B2B_PORTAL_URL: z.string().optional().default("http://localhost:3000"),
  /** Optionnel — sans clé, le checkout Stripe bascule en mode simulation. */
  STRIPE_SECRET_KEY: z.string().optional(),
  /** Optionnel — requis pour vérifier la signature du webhook Stripe. */
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Période du balayage d'usage B2B, en ms. `0` désactive l'ordonnanceur. */
  USAGE_INGEST_INTERVAL_MS: z.coerce.number().int().min(0).default(300_000),
  /** Optional: Studio AI routes return 503 if unset or too short. */
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((s) => (s && s.length >= 10 ? s : undefined)),
  ANTHROPIC_MODEL: z.string().optional().default("claude-haiku-4-5-20251001"),
  REDIS_URL: z.string().url().optional(),
  /** nomi-core (voice/diary service) — used to fetch per-user diary voice-stats for UserDetail. */
  NOMI_CORE_URL: z.string().optional().default("http://localhost:8088"),
  /** Optional — Expo push send in POST /notifications/test-push falls back to DB-only insert if unset. */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  B2_KEY_ID: z.string().optional(),
  B2_APPLICATION_KEY: z.string().optional(),
  B2_BUCKET_ID: z.string().optional(),
  B2_BUCKET_NAME: z.string().optional().default("nomiBucket"),
  B2_DOWNLOAD_URL: z.string().optional(),
  /** Alias courant (ex. nomi_backend) pour la base d’URL fichiers B2. */
  BACKBLAZE_BUCKET_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment validation failed");
  }
  return parsed.data;
}
