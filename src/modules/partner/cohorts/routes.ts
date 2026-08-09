import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import {
  createCohortBodySchema,
  listCohortsQuerySchema,
  updateCohortBodySchema,
  type CreateCohortBody,
  type ListCohortsQuery,
  type UpdateCohortBody,
} from "../../b2b/companies/schemas.js";
import {
  archiveCohort,
  createCohort,
  listCohorts,
  updateCohort,
} from "../../b2b/companies/service.js";
import { getCohortDetail } from "./service.js";

export const partnerCohortsRouter = Router();

partnerCohortsRouter.get(
  "/",
  validate(listCohortsQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const result = await listCohorts(companyId, req.query as unknown as ListCohortsQuery);
      res.json({
        success: true,
        data: { cohorts: result.cohorts, pagination: result.pagination },
      });
    } catch (e) {
      next(e);
    }
  }
);

partnerCohortsRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(createCohortBodySchema),
  async (req, res, next) => {
    try {
      const created = await createCohort(requireCompanyId(req), req.body as CreateCohortBody);
      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }
);

partnerCohortsRouter.get("/:cohortId", async (req, res, next) => {
  try {
    const detail = await getCohortDetail(requireCompanyId(req), routeParam(req, "cohortId"));
    if (!detail) {
      res.status(404).json({ success: false, error: "Cohort not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});

partnerCohortsRouter.patch(
  "/:cohortId",
  requirePortalRole("org_admin", "instructor"),
  validate(updateCohortBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updateCohort(
        requireCompanyId(req),
        routeParam(req, "cohortId"),
        req.body as UpdateCohortBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Cohort not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

/** Archivage (jamais de suppression dure côté portail). */
partnerCohortsRouter.delete(
  "/:cohortId",
  requirePortalRole("org_admin"),
  async (req, res, next) => {
    try {
      const archived = await archiveCohort(requireCompanyId(req), routeParam(req, "cohortId"));
      if (!archived) {
        res.status(404).json({ success: false, error: "Cohort not found" });
        return;
      }
      res.json({ success: true, data: archived });
    } catch (e) {
      next(e);
    }
  }
);
