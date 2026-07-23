import { z } from "zod";

export const listInterpreterSessionsQuerySchema = z.object({
  scenarioId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export const listPracticeRunsQuerySchema = z.object({
  scenarioId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export const analyticsQuerySchema = z.object({
  scenarioId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(90).default(14),
});
