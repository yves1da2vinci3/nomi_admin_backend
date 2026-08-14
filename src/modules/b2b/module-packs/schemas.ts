import Joi from "joi";
import {
  paginationQueryFields,
  slugSchema,
  toPatchSchema,
  type PaginationQuery,
} from "../shared/schemas.js";

const PACK_TIERS = ["base", "addon", "boost"] as const;
const BILLING_PERIODS = ["monthly", "quarterly", "one_time"] as const;
const PACK_BADGES = ["popular", "included_in_plan", "new"] as const;

export type ListPacksQuery = PaginationQuery & {
  isActive?: boolean;
  tier?: (typeof PACK_TIERS)[number];
  search?: string;
};

export const listPacksQuerySchema = Joi.object<ListPacksQuery>({
  ...paginationQueryFields,
  isActive: Joi.boolean(),
  tier: Joi.string().valid(...PACK_TIERS),
  search: Joi.string().trim().max(120),
});

export type PackItemInput = {
  moduleId: string;
  sessionCredits: number;
};

const packItemSchema = Joi.object<PackItemInput>({
  moduleId: Joi.string().uuid().required(),
  sessionCredits: Joi.number().integer().min(0).max(100000).required(),
});

export type CreatePackBody = {
  slug: string;
  name: string;
  tagline?: string;
  tier: (typeof PACK_TIERS)[number];
  billingPeriod: (typeof BILLING_PERIODS)[number];
  priceFcfa: number;
  priceUsdCents: number;
  badge?: (typeof PACK_BADGES)[number] | null;
  features: string[];
  isActive: boolean;
  items: PackItemInput[];
};

export const createPackBodySchema = Joi.object<CreatePackBody>({
  slug: slugSchema.required(),
  name: Joi.string().trim().min(1).max(120).required(),
  tagline: Joi.string().trim().max(240).allow(""),
  tier: Joi.string()
    .valid(...PACK_TIERS)
    .default("addon"),
  billingPeriod: Joi.string()
    .valid(...BILLING_PERIODS)
    .default("monthly"),
  priceFcfa: Joi.number().integer().min(0).required(),
  priceUsdCents: Joi.number().integer().min(0).default(0),
  badge: Joi.string()
    .valid(...PACK_BADGES)
    .allow(null),
  features: Joi.array().items(Joi.string().trim().min(1).max(240)).default([]),
  isActive: Joi.boolean().default(true),
  // Un pack sans ligne n'accorde aucun crédit : au moins un module requis.
  items: Joi.array().items(packItemSchema).min(1).unique("moduleId").required(),
});

export type UpdatePackBody = Partial<CreatePackBody>;

export const updatePackBodySchema = toPatchSchema(createPackBodySchema).fork(
  ["items"],
  (field) => field.optional()
);
