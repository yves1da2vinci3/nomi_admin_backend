import Joi from "joi";
import { paginationQueryFields, type PaginationQuery } from "../../b2b/shared/schemas.js";

const LEARNER_STATUSES = ["active", "inactive", "never"] as const;

export type ListLearnersQuery = PaginationQuery & {
  search?: string;
  cohortId?: string;
  status?: (typeof LEARNER_STATUSES)[number];
};

export const listLearnersQuerySchema = Joi.object<ListLearnersQuery>({
  ...paginationQueryFields,
  search: Joi.string().trim().max(120),
  cohortId: Joi.string().uuid(),
  status: Joi.string().valid(...LEARNER_STATUSES),
});

export type InviteLearnerBody = {
  email: string;
  name: string;
  cohortId: string;
  cefrLevel?: string;
};

export const inviteLearnerBodySchema = Joi.object<InviteLearnerBody>({
  email: Joi.string().trim().lowercase().email().required(),
  name: Joi.string().trim().min(1).max(160).required(),
  cohortId: Joi.string().uuid().required(),
  cefrLevel: Joi.string().trim().max(8),
});

export type ImportLearnersBody = {
  cohortId: string;
  learners: { email: string; name: string; cefrLevel?: string }[];
};

export const importLearnersBodySchema = Joi.object<ImportLearnersBody>({
  cohortId: Joi.string().uuid().required(),
  learners: Joi.array()
    .items(
      Joi.object({
        email: Joi.string().trim().lowercase().email().required(),
        name: Joi.string().trim().min(1).max(160).required(),
        cefrLevel: Joi.string().trim().max(8),
      })
    )
    .min(1)
    .max(1000)
    .unique("email")
    .required(),
});

export type UpdateLearnerBody = {
  name?: string;
  email?: string;
  cohortId?: string;
  cefrLevel?: string | null;
  status?: (typeof LEARNER_STATUSES)[number];
};

export const updateLearnerBodySchema = Joi.object<UpdateLearnerBody>({
  name: Joi.string().trim().min(1).max(160),
  email: Joi.string().trim().lowercase().email(),
  cohortId: Joi.string().uuid(),
  cefrLevel: Joi.string().trim().max(8).allow(null, ""),
  status: Joi.string().valid(...LEARNER_STATUSES),
}).min(1);

export type InactiveLearnersQuery = {
  days: number;
};

export const inactiveLearnersQuerySchema = Joi.object<InactiveLearnersQuery>({
  days: Joi.number().integer().min(1).max(365).default(7),
});
