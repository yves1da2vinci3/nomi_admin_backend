import Joi from "joi";
import { MODULE_KEYS } from "../../b2b/usage/matching.js";

export type ListContentsQuery = {
  moduleKey: (typeof MODULE_KEYS)[number];
  search?: string;
  limit: number;
};

export const listContentsQuerySchema = Joi.object<ListContentsQuery>({
  moduleKey: Joi.string()
    .valid(...MODULE_KEYS)
    .required(),
  search: Joi.string().trim().max(120),
  limit: Joi.number().integer().min(1).max(100).default(50),
});
