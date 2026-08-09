import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import { buildPagination, skipFor } from "../../b2b/shared/pagination.js";
import { paginationQueryFields, type PaginationQuery } from "../../b2b/shared/schemas.js";
import type { CompanyCertificateWhereInput } from "../../../types/prisma-derived.js";

type ListCertificatesQuery = PaginationQuery & {
  status?: "draft" | "issued" | "revoked";
  cohortId?: string;
  search?: string;
};

const listCertificatesQuerySchema = Joi.object<ListCertificatesQuery>({
  ...paginationQueryFields,
  status: Joi.string().valid("draft", "issued", "revoked"),
  cohortId: Joi.string().uuid(),
  search: Joi.string().trim().max(120),
});

type IssueCertificateBody = { learnerId: string };

const issueCertificateBodySchema = Joi.object<IssueCertificateBody>({
  learnerId: Joi.string().uuid().required(),
});

export const partnerCertificatesRouter = Router();

partnerCertificatesRouter.get(
  "/",
  validate(listCertificatesQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const params = req.query as unknown as ListCertificatesQuery;
      const where: CompanyCertificateWhereInput = { companyId };
      if (params.status) where.status = params.status;
      if (params.cohortId) where.cohortId = params.cohortId;
      const q = params.search?.trim();
      if (q) where.learnerName = { contains: q, mode: "insensitive" };

      const [rows, total] = await Promise.all([
        prisma.companyCertificate.findMany({
          where,
          orderBy: { issuedAt: "desc" },
          skip: skipFor(params.page, params.limit),
          take: params.limit,
        }),
        prisma.companyCertificate.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          certificates: rows.map((row) => ({
            id: row.id,
            learnerId: row.learnerId,
            learnerName: row.learnerName,
            cohortId: row.cohortId,
            cohortName: row.cohortName,
            companyName: row.companyName,
            issuedAt: row.issuedAt.toISOString(),
            issuedBy: row.issuedBy,
            averageScore: row.averageScore,
            totalSessions: row.totalSessions,
            totalHours: row.totalHours,
            cefrLevel: row.cefrLevel,
            scoresByModule: row.scoresByModule,
            status: row.status,
            revokedAt: row.revokedAt?.toISOString() ?? null,
          })),
          pagination: buildPagination(params.page, params.limit, total),
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Émission = snapshot des scores au moment T (noms et moyennes figés), calculé
 * depuis `AssignmentProgress` et `ModuleUsageEvent`.
 */
partnerCertificatesRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(issueCertificateBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const { learnerId } = req.body as IssueCertificateBody;

      const learner = await prisma.companyLearner.findFirst({
        where: { id: learnerId, companyId },
        include: {
          cohort: { select: { id: true, name: true } },
          company: { select: { name: true } },
        },
      });
      if (!learner) throw httpError(404, "Learner not found");

      const [progress, usage] = await Promise.all([
        prisma.assignmentProgress.findMany({
          where: { learnerId, score: { not: null } },
          include: { assignment: { include: { module: { select: { key: true } } } } },
        }),
        prisma.moduleUsageEvent.findMany({
          where: { learnerId },
          include: { module: { select: { key: true } } },
        }),
      ]);

      const scoresByModule: Record<string, number> = {};
      const perModule = new Map<string, number[]>();
      for (const row of progress) {
        const key = row.assignment.module.key;
        perModule.set(key, [...(perModule.get(key) ?? []), row.score as number]);
      }
      for (const [key, scores] of perModule) {
        scoresByModule[key] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }

      const allScores = progress.map((p) => p.score as number);
      const averageScore =
        allScores.length > 0
          ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
          : 0;

      const created = await prisma.companyCertificate.create({
        data: {
          companyId,
          learnerId,
          cohortId: learner.cohortId,
          learnerName: learner.name,
          cohortName: learner.cohort.name,
          companyName: learner.company.name,
          issuedBy: req.partnerAuth?.email ?? "portail",
          averageScore,
          totalSessions: usage.length,
          totalHours: null,
          cefrLevel: learner.cefrLevel,
          scoresByModule,
          status: "issued",
        },
      });

      res.status(201).json({
        success: true,
        data: { ...created, issuedAt: created.issuedAt.toISOString() },
      });
    } catch (e) {
      next(e);
    }
  }
);

/** Révocation — action absente du prototype. */
partnerCertificatesRouter.delete(
  "/:certificateId",
  requirePortalRole("org_admin"),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const certificateId = routeParam(req, "certificateId");
      const current = await prisma.companyCertificate.findFirst({
        where: { id: certificateId, companyId },
      });
      if (!current) {
        res.status(404).json({ success: false, error: "Certificate not found" });
        return;
      }
      const updated = await prisma.companyCertificate.update({
        where: { id: certificateId },
        data: { status: "revoked", revokedAt: new Date() },
      });
      res.json({
        success: true,
        data: { id: updated.id, status: updated.status, revokedAt: updated.revokedAt },
      });
    } catch (e) {
      next(e);
    }
  }
);
