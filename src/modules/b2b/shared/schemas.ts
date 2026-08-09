import Joi from "joi";

/** Query de pagination commune aux listes B2B (convention `page`/`limit`). */
export const paginationQueryFields = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

export type PaginationQuery = {
  page: number;
  limit: number;
};

/** Texte multilingue : `{ fr: "…", en: "…" }`. */
export const localizedTextSchema = Joi.object()
  .pattern(Joi.string().min(2).max(10), Joi.string().trim().min(1))
  .min(1);

/** Slug / clé technique : minuscules, chiffres, tirets et underscores. */
export const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9][a-z0-9_-]*$/)
  .max(64);

/**
 * Rend tous les champs optionnels et refuse un PATCH vide.
 *
 * `fork(…optional())` conserve les `.default()` du schéma de création : un PATCH
 * d'un seul champ réinitialiserait tous les autres. Les clés absentes du corps
 * reçu sont donc retirées après validation.
 */
export function toPatchSchema<T>(schema: Joi.ObjectSchema<T>): Joi.ObjectSchema<Partial<T>> {
  const keys = Object.keys(schema.describe().keys ?? {});
  return schema
    .fork(keys, (field) => field.optional())
    .custom((value: Record<string, unknown>, helpers) => {
      const original = helpers.original as Record<string, unknown> | undefined;
      if (!original || typeof original !== "object") return value;
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        if (key in original) patch[key] = value[key];
      }
      return patch;
    })
    .min(1) as unknown as Joi.ObjectSchema<Partial<T>>;
}
