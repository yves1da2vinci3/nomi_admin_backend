import { z } from "zod";

export const listLearnedWordsQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(500).default(100),
  language: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  masteryMin: z.coerce.number().min(0).max(1).optional(),
  masteryMax: z.coerce.number().min(0).max(1).optional(),
});
