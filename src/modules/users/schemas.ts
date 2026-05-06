import { z } from "zod";

export const listUsersQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  /** Langue d’apprentissage (ex. « Spanish ») ; ignoré si vide ou « All Languages » */
  language: z.string().optional(),
  level: z.enum(["all", "beginner", "intermediate", "advanced"]).optional().default("all"),
  /** any | active (!isSuspended) | inactive (isSuspended) | none (aucune ligne, filtres exclusifs off) */
  accountStatus: z.enum(["any", "active", "inactive", "none"]).optional().default("any"),
});

export const userDetailQuerySchema = z.object({
  language: z.string().default("fr"),
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

export const updateUserBodySchema = createUserBodySchema.partial().extend({
  isSuspended: z.boolean().optional(),
});
