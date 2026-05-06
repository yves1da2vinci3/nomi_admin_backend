import { z } from "zod";

export const listGeneratedGamesQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
  gameType: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().uuid().optional(),
});

export const createGeneratedGameBodySchema = z.object({
  userId: z.string().uuid(),
  gameType: z.string(),
  status: z.string().optional(),
  difficulty: z.string(),
  learningLanguage: z.string(),
  userLanguage: z.string(),
  scenarioIds: z.array(z.string()).default([]),
  words: z.array(z.string()).default([]),
  gameData: z.any().optional().nullable(),
  error: z.string().optional().nullable(),
});

export const updateGeneratedGameBodySchema = createGeneratedGameBodySchema.partial();
