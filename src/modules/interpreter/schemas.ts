import { z } from "zod";

const jsonLangRecord = z.record(z.string(), z.string());

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createScenarioSchema = z.object({
  title: jsonLangRecord,
  description: jsonLangRecord,
  location: jsonLangRecord,
  difficulty: z.string(),
  interactionType: z.string(),
  pnjs: z.any(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateScenarioSchema = createScenarioSchema.partial();

export const createObjectiveSchema = z.object({
  title: jsonLangRecord,
  description: jsonLangRecord,
  order: z.number().int(),
  isActive: z.boolean().optional(),
});

export const updateObjectiveSchema = createObjectiveSchema.partial();
