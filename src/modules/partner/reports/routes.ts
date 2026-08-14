import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";

type CreateReportBody = {
  type: string;
  format: "pdf" | "csv";
  cohortId?: string;
  periodStart?: Date;
  periodEnd?: Date;
};

const createReportBodySchema = Joi.object<CreateReportBody>({
  type: Joi.string().trim().min(1).max(64).required(),
  format: Joi.string().valid("pdf", "csv").default("pdf"),
  cohortId: Joi.string().uuid(),
  periodStart: Joi.date().iso(),
  periodEnd: Joi.date().iso().min(Joi.ref("periodStart")),
});

export const partnerReportsRouter = Router();

partnerReportsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.companyReport.findMany({
      where: { companyId: requireCompanyId(req) },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      data: {
        reports: rows.map((row) => ({
          id: row.id,
          type: row.type,
          format: row.format,
          author: row.author,
          cohortId: row.cohortId,
          cohortName: row.cohortName,
          periodStart: row.periodStart?.toISOString() ?? null,
          periodEnd: row.periodEnd?.toISOString() ?? null,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

partnerReportsRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(createReportBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const body = req.body as CreateReportBody;

      let cohortName: string | null = null;
      if (body.cohortId) {
        const cohort = await prisma.cohort.findFirst({
          where: { id: body.cohortId, companyId },
          select: { name: true },
        });
        if (!cohort) throw httpError(404, "Cohort not found");
        cohortName = cohort.name;
      }

      const created = await prisma.companyReport.create({
        data: {
          companyId,
          type: body.type,
          format: body.format,
          author: req.partnerAuth?.email ?? "portail",
          cohortId: body.cohortId ?? null,
          cohortName,
          periodStart: body.periodStart ?? null,
          periodEnd: body.periodEnd ?? null,
          // Lien de téléchargement valable 30 jours.
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      res.status(201).json({
        success: true,
        data: { ...created, createdAt: created.createdAt.toISOString() },
      });
    } catch (e) {
      next(e);
    }
  }
);

partnerReportsRouter.delete(
  "/:reportId",
  requirePortalRole("org_admin", "instructor"),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const reportId = routeParam(req, "reportId");
      const current = await prisma.companyReport.findFirst({
        where: { id: reportId, companyId },
      });
      if (!current) {
        res.status(404).json({ success: false, error: "Report not found" });
        return;
      }
      await prisma.companyReport.delete({ where: { id: reportId } });
      res.json({ success: true, data: { deleted: true } });
    } catch (e) {
      next(e);
    }
  }
);

/** Données agrégées d'un rapport, recalculées à la demande. */
partnerReportsRouter.get("/:reportId", async (req, res, next) => {
  try {
    const companyId = requireCompanyId(req);
    const reportId = routeParam(req, "reportId");
    const report = await prisma.companyReport.findFirst({ where: { id: reportId, companyId } });
    if (!report) {
      res.status(404).json({ success: false, error: "Report not found" });
      return;
    }

    const learnerWhere = {
      companyId,
      ...(report.cohortId ? { cohortId: report.cohortId } : {}),
    };

    const [learners, progressStats, usageByModule] = await Promise.all([
      prisma.companyLearner.count({ where: learnerWhere }),
      prisma.assignmentProgress.groupBy({
        by: ["status"],
        where: { learner: learnerWhere },
        _count: { _all: true },
      }),
      prisma.moduleUsageEvent.groupBy({
        by: ["moduleId"],
        where: {
          companyId,
          ...(report.periodStart || report.periodEnd
            ? {
                occurredAt: {
                  ...(report.periodStart ? { gte: report.periodStart } : {}),
                  ...(report.periodEnd ? { lte: report.periodEnd } : {}),
                },
              }
            : {}),
        },
        _count: { _all: true },
      }),
    ]);

    const modules = await prisma.b2bModule.findMany({
      where: { id: { in: usageByModule.map((u) => u.moduleId) } },
      select: { id: true, key: true },
    });
    const keyById = new Map(modules.map((m) => [m.id, m.key]));

    const done = progressStats.find((p) => p.status === "done")?._count._all ?? 0;
    const total = progressStats.reduce((sum, p) => sum + p._count._all, 0);

    res.json({
      success: true,
      data: {
        report: {
          id: report.id,
          type: report.type,
          format: report.format,
          cohortId: report.cohortId,
          cohortName: report.cohortName,
          periodStart: report.periodStart?.toISOString() ?? null,
          periodEnd: report.periodEnd?.toISOString() ?? null,
          createdAt: report.createdAt.toISOString(),
        },
        metrics: {
          learners,
          assignmentsDone: done,
          assignmentsTotal: total,
          completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
          sessionsByModule: usageByModule.map((u) => ({
            moduleId: u.moduleId,
            moduleKey: keyById.get(u.moduleId) ?? u.moduleId,
            sessions: u._count._all,
          })),
        },
      },
    });
  } catch (e) {
    next(e);
  }
});
