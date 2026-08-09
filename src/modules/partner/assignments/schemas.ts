import Joi from "joi";
import { paginationQueryFields, type PaginationQuery } from "../../b2b/shared/schemas.js";

const ASSIGNMENT_STATUSES = ["active", "overdue", "completed", "cancelled"] as const;
const PROGRESS_STATUSES = ["done", "pending", "late"] as const;

export type ListAssignmentsQuery = PaginationQuery & {
  status?: (typeof ASSIGNMENT_STATUSES)[number];
  cohortId?: string;
  moduleId?: string;
  search?: string;
};

export const listAssignmentsQuerySchema = Joi.object<ListAssignmentsQuery>({
  ...paginationQueryFields,
  status: Joi.string().valid(...ASSIGNMENT_STATUSES),
  cohortId: Joi.string().uuid(),
  moduleId: Joi.string().uuid(),
  search: Joi.string().trim().max(120),
});

export type CreateAssignmentBody = {
  moduleId: string;
  title: string;
  deadline: Date;
  message?: string;
  contentType?: string;
  contentId?: string;
  cohortIds: string[];
  targetsAllCohorts: boolean;
};

export const createAssignmentBodySchema = Joi.object<CreateAssignmentBody>({
  moduleId: Joi.string().uuid().required(),
  title: Joi.string().trim().min(1).max(200).required(),
  deadline: Joi.date().iso().required(),
  message: Joi.string().trim().max(2000).allow(""),
  contentType: Joi.string().trim().max(64),
  contentId: Joi.string().trim().max(64),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  // « Toutes les cohortes » est explicite : plus de sentinelle tableau vide.
  targetsAllCohorts: Joi.boolean().default(false),
})
  .or("cohortIds", "targetsAllCohorts")
  .custom((value: CreateAssignmentBody, helpers) => {
    if (!value.targetsAllCohorts && value.cohortIds.length === 0) {
      return helpers.error("any.custom", {
        message: "cohortIds requis lorsque targetsAllCohorts est false",
      });
    }
    return value;
  });

export type UpdateAssignmentBody = {
  moduleId?: string;
  title?: string;
  deadline?: Date;
  message?: string;
  contentType?: string;
  contentId?: string | null;
  status?: (typeof ASSIGNMENT_STATUSES)[number];
  cohortIds?: string[];
  targetsAllCohorts?: boolean;
};

export const updateAssignmentBodySchema = Joi.object<UpdateAssignmentBody>({
  moduleId: Joi.string().uuid(),
  title: Joi.string().trim().min(1).max(200),
  deadline: Joi.date().iso(),
  message: Joi.string().trim().max(2000).allow(""),
  contentType: Joi.string().trim().max(64),
  contentId: Joi.string().trim().max(64).allow(null, ""),
  status: Joi.string().valid(...ASSIGNMENT_STATUSES),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique(),
  targetsAllCohorts: Joi.boolean(),
}).min(1);

export type UpdateProgressBody = {
  status: (typeof PROGRESS_STATUSES)[number];
  score?: number | null;
};

export const updateProgressBodySchema = Joi.object<UpdateProgressBody>({
  status: Joi.string()
    .valid(...PROGRESS_STATUSES)
    .required(),
  score: Joi.number().integer().min(0).max(100).allow(null),
});
