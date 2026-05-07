import { z } from "zod";

export const createProjectBodySchema = z.object({
  title: z.string().min(1).max(200),
  state: z.record(z.unknown()).optional().default({}),
});

export const updateProjectBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  state: z.record(z.unknown()).optional(),
});

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
