import { z } from "zod";

export const listUsersQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export const createUserBodySchema = z.object({
  email: z.string().email(),
  uid: z.string().min(1),
  displayName: z.string().optional().nullable(),
  photoURL: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  learningLanguage: z.string().optional().nullable(),
  learningLanguages: z.array(z.string()).default([]),
  nativeLanguage: z.string().optional().nullable(),
  expoPushToken: z.string().optional().nullable(),
});

export const updateUserBodySchema = createUserBodySchema.partial();
