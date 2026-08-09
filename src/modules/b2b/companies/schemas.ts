import Joi from "joi";
import {
  paginationQueryFields,
  slugSchema,
  toPatchSchema,
  type PaginationQuery,
} from "../shared/schemas.js";

const ORG_TYPES = ["training_center", "school", "enterprise"] as const;
const PLANS = ["pilot", "center", "school", "enterprise"] as const;
const PORTAL_ROLES = ["org_admin", "instructor", "viewer"] as const;
const COHORT_STATUSES = ["upcoming", "active", "ended", "archived"] as const;

export type ListCompaniesQuery = PaginationQuery & {
  search?: string;
  orgType?: (typeof ORG_TYPES)[number];
  plan?: (typeof PLANS)[number];
  isActive?: boolean;
};

export const listCompaniesQuerySchema = Joi.object<ListCompaniesQuery>({
  ...paginationQueryFields,
  search: Joi.string().trim().max(120),
  orgType: Joi.string().valid(...ORG_TYPES),
  plan: Joi.string().valid(...PLANS),
  isActive: Joi.boolean(),
});

export type CreateCompanyBody = {
  name: string;
  slug: string;
  orgType: (typeof ORG_TYPES)[number];
  plan: (typeof PLANS)[number];
  seatLimit: number;
  apiQuotaMonth: number;
  logoUrl?: string | null;
  timezone: string;
  renewalDate?: Date | null;
  weeklyDigest: boolean;
  quotaAlert: boolean;
  monthlyReport: boolean;
  isActive: boolean;
};

export const createCompanyBodySchema = Joi.object<CreateCompanyBody>({
  name: Joi.string().trim().min(1).max(160).required(),
  slug: slugSchema.required(),
  orgType: Joi.string()
    .valid(...ORG_TYPES)
    .default("training_center"),
  plan: Joi.string()
    .valid(...PLANS)
    .default("pilot"),
  seatLimit: Joi.number().integer().min(0).max(100000).default(0),
  apiQuotaMonth: Joi.number().integer().min(0).default(0),
  logoUrl: Joi.string().trim().uri().allow(null, ""),
  timezone: Joi.string().trim().max(64).default("UTC"),
  renewalDate: Joi.date().iso().allow(null),
  weeklyDigest: Joi.boolean().default(true),
  quotaAlert: Joi.boolean().default(true),
  monthlyReport: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

export type UpdateCompanyBody = Partial<CreateCompanyBody> & { apiUsedMonth?: number };

export const updateCompanyBodySchema = (
  toPatchSchema(createCompanyBodySchema) as unknown as Joi.ObjectSchema<UpdateCompanyBody>
).keys({
  apiUsedMonth: Joi.number().integer().min(0),
});

// --- Cohortes ---------------------------------------------------------------

export type ListCohortsQuery = PaginationQuery & {
  status?: (typeof COHORT_STATUSES)[number];
  search?: string;
};

export const listCohortsQuerySchema = Joi.object<ListCohortsQuery>({
  ...paginationQueryFields,
  status: Joi.string().valid(...COHORT_STATUSES),
  search: Joi.string().trim().max(120),
});

export type CreateCohortBody = {
  name: string;
  startDate: Date;
  endDate: Date;
  seatLimit: number;
  instructorIds: string[];
};

export const createCohortBodySchema = Joi.object<CreateCohortBody>({
  name: Joi.string().trim().min(1).max(160).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
  seatLimit: Joi.number().integer().min(0).max(100000).default(0),
  instructorIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
});

export type UpdateCohortBody = Partial<CreateCohortBody> & {
  status?: (typeof COHORT_STATUSES)[number];
};

export const updateCohortBodySchema = Joi.object<UpdateCohortBody>({
  name: Joi.string().trim().min(1).max(160),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  seatLimit: Joi.number().integer().min(0).max(100000),
  instructorIds: Joi.array().items(Joi.string().uuid()).unique(),
  status: Joi.string().valid(...COHORT_STATUSES),
}).min(1);

// --- Utilisateurs portail ---------------------------------------------------

export type CreatePartnerUserBody = {
  email: string;
  displayName?: string;
  portalRole: (typeof PORTAL_ROLES)[number];
  password?: string;
  cohortIds: string[];
};

export const createPartnerUserBodySchema = Joi.object<CreatePartnerUserBody>({
  email: Joi.string().trim().lowercase().email().required(),
  displayName: Joi.string().trim().max(160),
  portalRole: Joi.string()
    .valid(...PORTAL_ROLES)
    .default("viewer"),
  // Sans mot de passe, le compte reste `pending` et ne peut pas se connecter.
  password: Joi.string().min(8).max(200),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
});

export type UpdatePartnerUserBody = {
  displayName?: string;
  portalRole?: (typeof PORTAL_ROLES)[number];
  password?: string;
  cohortIds?: string[];
  status?: "active" | "pending";
};

export const updatePartnerUserBodySchema = Joi.object<UpdatePartnerUserBody>({
  displayName: Joi.string().trim().max(160),
  portalRole: Joi.string().valid(...PORTAL_ROLES),
  password: Joi.string().min(8).max(200),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique(),
  status: Joi.string().valid("active", "pending"),
}).min(1);

// --- Entitlements et crédits ------------------------------------------------

export type GrantEntitlementBody = {
  packId: string;
  expiresAt?: Date | null;
};

export const grantEntitlementBodySchema = Joi.object<GrantEntitlementBody>({
  packId: Joi.string().uuid().required(),
  expiresAt: Joi.date().iso().allow(null),
});

export type AdjustCreditsBody = {
  moduleId: string;
  /** Delta signé : positif pour créditer, négatif pour reprendre. */
  delta: number;
  entitlementId?: string;
};

export const adjustCreditsBodySchema = Joi.object<AdjustCreditsBody>({
  moduleId: Joi.string().uuid().required(),
  delta: Joi.number().integer().invalid(0).required(),
  entitlementId: Joi.string().uuid(),
});
