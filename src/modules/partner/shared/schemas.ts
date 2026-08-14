import Joi from "joi";
import { paginationQueryFields, type PaginationQuery } from "../../b2b/shared/schemas.js";

export { paginationQueryFields };
export type { PaginationQuery };

export const MODULE_KEYS = [
  "scenario",
  "diary",
  "interpreter",
  "listening_story",
  "review_game",
] as const;

/** Liste paginée générique du portail (recherche + statut libre par module). */
export const listQuerySchema = Joi.object<PaginationQuery & { search?: string }>({
  ...paginationQueryFields,
  search: Joi.string().trim().max(120),
});
