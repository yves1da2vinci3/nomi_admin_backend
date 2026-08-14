import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import type { TransactionClient } from "../../../types/prisma-derived.js";

type WeekInput = {
  week: number;
  moduleId: string;
  assignmentTitle: string;
  deadlineOffsetDays: number;
  description?: string;
};

type CreatePathBody = {
  name: string;
  description?: string;
  cohortIds: string[];
  weeks: WeekInput[];
};

const weekSchema = Joi.object<WeekInput>({
  week: Joi.number().integer().min(1).max(52).required(),
  moduleId: Joi.string().uuid().required(),
  assignmentTitle: Joi.string().trim().min(1).max(200).required(),
  deadlineOffsetDays: Joi.number().integer().min(1).max(90).default(7),
  description: Joi.string().trim().max(1000).allow(""),
});

const createPathBodySchema = Joi.object<CreatePathBody>({
  name: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().trim().max(1000).allow(""),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  weeks: Joi.array().items(weekSchema).min(1).unique("week").required(),
});

type UpdatePathBody = Partial<CreatePathBody> & { status?: "draft" | "active" | "completed" };

const updatePathBodySchema = Joi.object<UpdatePathBody>({
  name: Joi.string().trim().min(1).max(160),
  description: Joi.string().trim().max(1000).allow(""),
  cohortIds: Joi.array().items(Joi.string().uuid()).unique(),
  weeks: Joi.array().items(weekSchema).min(1).unique("week"),
  status: Joi.string().valid("draft", "active", "completed"),
}).min(1);

const pathInclude = {
  weeks: {
    include: { module: { select: { id: true, key: true, name: true } } },
    orderBy: { week: "asc" },
  },
  cohorts: { include: { cohort: { select: { id: true, name: true } } } },
} as const;

type PathRow = Awaited<
  ReturnType<typeof prisma.learningPath.findFirstOrThrow<{ include: typeof pathInclude }>>
>;

function mapPath(row: PathRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    cohorts: row.cohorts.map((c) => c.cohort),
    weeks: row.weeks.map((w) => ({
      id: w.id,
      week: w.week,
      moduleId: w.moduleId,
      moduleKey: w.module.key,
      assignmentTitle: w.assignmentTitle,
      deadlineOffsetDays: w.deadlineOffsetDays,
      description: w.description,
    })),
  };
}

async function assertCohorts(companyId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.cohort.count({ where: { companyId, id: { in: ids } } });
  if (count !== ids.length) throw httpError(400, "Unknown cohortId for this company");
}

export const partnerPathsRouter = Router();

partnerPathsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.learningPath.findMany({
      where: { companyId: requireCompanyId(req) },
      include: pathInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: { paths: rows.map(mapPath) } });
  } catch (e) {
    next(e);
  }
});

partnerPathsRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(createPathBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const body = req.body as CreatePathBody;
      await assertCohorts(companyId, body.cohortIds);

      const moduleIds = [...new Set(body.weeks.map((w) => w.moduleId))];
      const known = await prisma.b2bModule.count({ where: { id: { in: moduleIds } } });
      if (known !== moduleIds.length) throw httpError(400, "Unknown moduleId in weeks");

      const created = await prisma.learningPath.create({
        data: {
          companyId,
          name: body.name,
          description: body.description || null,
          weeks: {
            create: body.weeks.map((w) => ({
              week: w.week,
              moduleId: w.moduleId,
              assignmentTitle: w.assignmentTitle,
              deadlineOffsetDays: w.deadlineOffsetDays,
              description: w.description || null,
            })),
          },
          cohorts: { create: body.cohortIds.map((cohortId) => ({ cohortId })) },
        },
        include: pathInclude,
      });
      res.status(201).json({ success: true, data: mapPath(created) });
    } catch (e) {
      next(e);
    }
  }
);

partnerPathsRouter.patch(
  "/:pathId",
  requirePortalRole("org_admin", "instructor"),
  validate(updatePathBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const pathId = routeParam(req, "pathId");
      const body = req.body as UpdatePathBody;

      const current = await prisma.learningPath.findFirst({ where: { id: pathId, companyId } });
      if (!current) {
        res.status(404).json({ success: false, error: "Path not found" });
        return;
      }
      if (body.cohortIds) await assertCohorts(companyId, body.cohortIds);

      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.learningPath.update({
          where: { id: pathId },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.description !== undefined ? { description: body.description || null } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.status === "active" && !current.activatedAt
              ? { activatedAt: new Date() }
              : {}),
          },
        });

        if (body.weeks) {
          await tx.learningPathWeek.deleteMany({ where: { pathId } });
          await tx.learningPathWeek.createMany({
            data: body.weeks.map((w) => ({
              pathId,
              week: w.week,
              moduleId: w.moduleId,
              assignmentTitle: w.assignmentTitle,
              deadlineOffsetDays: w.deadlineOffsetDays,
              description: w.description || null,
            })),
          });
        }

        if (body.cohortIds) {
          await tx.learningPathCohort.deleteMany({
            where: { pathId, cohortId: { notIn: body.cohortIds } },
          });
          for (const cohortId of body.cohortIds) {
            await tx.learningPathCohort.upsert({
              where: { pathId_cohortId: { pathId, cohortId } },
              create: { pathId, cohortId },
              update: {},
            });
          }
        }
      });

      const row = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: pathInclude,
      });
      res.json({ success: true, data: row ? mapPath(row) : null });
    } catch (e) {
      next(e);
    }
  }
);

partnerPathsRouter.delete("/:pathId", requirePortalRole("org_admin"), async (req, res, next) => {
  try {
    const companyId = requireCompanyId(req);
    const pathId = routeParam(req, "pathId");
    const current = await prisma.learningPath.findFirst({ where: { id: pathId, companyId } });
    if (!current) {
      res.status(404).json({ success: false, error: "Path not found" });
      return;
    }
    await prisma.learningPath.delete({ where: { id: pathId } });
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
