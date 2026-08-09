import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { routeParam } from "../shared/params.js";
import {
  adjustCreditsBodySchema,
  createCohortBodySchema,
  createCompanyBodySchema,
  createPartnerUserBodySchema,
  grantEntitlementBodySchema,
  listCohortsQuerySchema,
  listCompaniesQuerySchema,
  updateCohortBodySchema,
  updateCompanyBodySchema,
  updatePartnerUserBodySchema,
  type AdjustCreditsBody,
  type CreateCohortBody,
  type CreateCompanyBody,
  type CreatePartnerUserBody,
  type GrantEntitlementBody,
  type ListCohortsQuery,
  type ListCompaniesQuery,
  type UpdateCohortBody,
  type UpdateCompanyBody,
  type UpdatePartnerUserBody,
} from "./schemas.js";
import {
  adjustCredits,
  archiveCohort,
  createCohort,
  createCompany,
  createPartnerUser,
  deleteCompany,
  deletePartnerUser,
  getCompanyById,
  getCompanyUsage,
  grantEntitlement,
  listCohorts,
  listCompanies,
  listPartnerUsers,
  revokeEntitlement,
  updateCohort,
  updateCompany,
  updatePartnerUser,
} from "./service.js";

export const companiesRouter = Router();

/**
 * Les sous-routeurs imbriqués sont montés AVANT les routes `/:id`, sinon
 * `/:id` capture le premier segment (même piège que `scenarios/goals`).
 */
const cohortsRouter = Router({ mergeParams: true });

cohortsRouter.get("/", validate(listCohortsQuerySchema, "query"), async (req, res, next) => {
  try {
    const companyId = routeParam(req, "companyId");
    const result = await listCohorts(companyId, req.query as unknown as ListCohortsQuery);
    res.json({ success: true, data: { cohorts: result.cohorts, pagination: result.pagination } });
  } catch (e) {
    next(e);
  }
});

cohortsRouter.post("/", validate(createCohortBodySchema), async (req, res, next) => {
  try {
    const created = await createCohort(
      routeParam(req, "companyId"),
      req.body as CreateCohortBody
    );
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

cohortsRouter.patch("/:cohortId", validate(updateCohortBodySchema), async (req, res, next) => {
  try {
    const updated = await updateCohort(
      routeParam(req, "companyId"),
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
});

cohortsRouter.delete("/:cohortId", async (req, res, next) => {
  try {
    const archived = await archiveCohort(
      routeParam(req, "companyId"),
      routeParam(req, "cohortId")
    );
    if (!archived) {
      res.status(404).json({ success: false, error: "Cohort not found" });
      return;
    }
    res.json({ success: true, data: archived });
  } catch (e) {
    next(e);
  }
});

const partnerUsersRouter = Router({ mergeParams: true });

partnerUsersRouter.get("/", async (req, res, next) => {
  try {
    const rows = await listPartnerUsers(routeParam(req, "companyId"));
    res.json({ success: true, data: { partnerUsers: rows } });
  } catch (e) {
    next(e);
  }
});

partnerUsersRouter.post("/", validate(createPartnerUserBodySchema), async (req, res, next) => {
  try {
    const created = await createPartnerUser(
      routeParam(req, "companyId"),
      req.body as CreatePartnerUserBody
    );
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

partnerUsersRouter.patch(
  "/:partnerUserId",
  validate(updatePartnerUserBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updatePartnerUser(
        routeParam(req, "companyId"),
        routeParam(req, "partnerUserId"),
        req.body as UpdatePartnerUserBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Partner user not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

partnerUsersRouter.delete("/:partnerUserId", async (req, res, next) => {
  try {
    const deleted = await deletePartnerUser(
      routeParam(req, "companyId"),
      routeParam(req, "partnerUserId")
    );
    if (!deleted) {
      res.status(404).json({ success: false, error: "Partner user not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

const entitlementsRouter = Router({ mergeParams: true });

entitlementsRouter.post("/", validate(grantEntitlementBodySchema), async (req, res, next) => {
  try {
    const granted = await grantEntitlement(
      routeParam(req, "companyId"),
      req.body as GrantEntitlementBody
    );
    res.status(201).json({ success: true, data: granted });
  } catch (e) {
    next(e);
  }
});

entitlementsRouter.delete("/:entitlementId", async (req, res, next) => {
  try {
    const revoked = await revokeEntitlement(
      routeParam(req, "companyId"),
      routeParam(req, "entitlementId")
    );
    if (!revoked) {
      res.status(404).json({ success: false, error: "Entitlement not found" });
      return;
    }
    res.json({ success: true, data: { revoked: true } });
  } catch (e) {
    next(e);
  }
});

companiesRouter.use("/:companyId/cohorts", cohortsRouter);
companiesRouter.use("/:companyId/partner-users", partnerUsersRouter);
companiesRouter.use("/:companyId/entitlements", entitlementsRouter);

companiesRouter.get("/:companyId/usage", async (req, res, next) => {
  try {
    const usage = await getCompanyUsage(routeParam(req, "companyId"));
    res.json({ success: true, data: usage });
  } catch (e) {
    next(e);
  }
});

companiesRouter.post(
  "/:companyId/credits",
  validate(adjustCreditsBodySchema),
  async (req, res, next) => {
    try {
      const result = await adjustCredits(
        routeParam(req, "companyId"),
        req.body as AdjustCreditsBody
      );
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

companiesRouter.get("/", validate(listCompaniesQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await listCompanies(req.query as unknown as ListCompaniesQuery);
    res.json({
      success: true,
      data: { companies: result.companies, pagination: result.pagination },
    });
  } catch (e) {
    next(e);
  }
});

companiesRouter.post("/", validate(createCompanyBodySchema), async (req, res, next) => {
  try {
    const created = await createCompany(req.body as CreateCompanyBody);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

companiesRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getCompanyById(String(req.params.id));
    if (!item) {
      res.status(404).json({ success: false, error: "Company not found" });
      return;
    }
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

companiesRouter.patch("/:id", validate(updateCompanyBodySchema), async (req, res, next) => {
  try {
    const updated = await updateCompany(String(req.params.id), req.body as UpdateCompanyBody);
    if (!updated) {
      res.status(404).json({ success: false, error: "Company not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

companiesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteCompany(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ success: false, error: "Company not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
