import { z } from "zod";

export const listSessionsQuerySchema = z.object({
  type: z.enum(["scenario", "interpreter"]),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
  language: z.string().optional(),
});

export const getSessionQuerySchema = z.object({
  type: z.enum(["scenario", "interpreter"]),
});
