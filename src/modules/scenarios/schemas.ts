import { z } from "zod";

export const listScenariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  theme: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  language: z.string().default("fr"),
  includeGoals: z.enum(["true", "false"]).optional(),
  includeVocabulary: z.enum(["true", "false"]).optional(),
});

const jsonLangRecord = z.record(z.string(), z.string());

export const createScenarioBodySchema = z.object({
  title: jsonLangRecord,
  description: jsonLangRecord,
  pnjRole: z.string(),
  pnjPersonality: z.string(),
  pnjTone: z.string(),
  location: z.string(),
  theme: z.string(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateScenarioBodySchema = createScenarioBodySchema.partial();

export const createGoalBodySchema = z.object({
  title: jsonLangRecord,
  description: jsonLangRecord,
  order: z.number().int(),
  expectedWords: z.any(),
  expectedPhrases: z.any(),
  minWords: z.number().int().optional(),
  requiredWords: z.any(),
  optionalWords: z.any(),
  successMessage: jsonLangRecord,
  failureMessage: jsonLangRecord,
  isActive: z.boolean().optional(),
});

export const createVocabBodySchema = z.object({
  word: z.string(),
  translation: jsonLangRecord,
  category: z.string(),
  difficulty: z.number().int().optional(),
  context: z.string().nullable().optional(),
});
