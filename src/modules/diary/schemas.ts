import { z } from "zod";

export const listDiaryQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
});
