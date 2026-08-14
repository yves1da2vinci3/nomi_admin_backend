import Joi from "joi";
import {
  localizedTextSchema,
  paginationQueryFields,
  slugSchema,
  toPatchSchema,
  type PaginationQuery,
} from "../shared/schemas.js";

export type ListModulesQuery = PaginationQuery & {
  isActive?: boolean;
  search?: string;
};

export const listModulesQuerySchema = Joi.object<ListModulesQuery>({
  ...paginationQueryFields,
  isActive: Joi.boolean(),
  search: Joi.string().trim().max(120),
});

export type CreateModuleBody = {
  key: string;
  name: Record<string, string>;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
};

export const createModuleBodySchema = Joi.object<CreateModuleBody>({
  key: slugSchema.required(),
  name: localizedTextSchema.required(),
  icon: Joi.string().trim().max(64),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().min(0).default(0),
});

export type UpdateModuleBody = Partial<CreateModuleBody>;

export const updateModuleBodySchema = toPatchSchema(createModuleBodySchema);
