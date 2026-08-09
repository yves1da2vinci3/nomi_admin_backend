import type { Router } from "express";
import type { Env } from "../config/env.js";
import { partnerMeRouter } from "../modules/partner/auth/routes.js";
import { partnerDashboardRouter } from "../modules/partner/dashboard/routes.js";
import { partnerCohortsRouter } from "../modules/partner/cohorts/routes.js";
import { partnerLearnersRouter } from "../modules/partner/learners/routes.js";
import { partnerAssignmentsRouter } from "../modules/partner/assignments/routes.js";
import { partnerTeamRouter } from "../modules/partner/team/routes.js";
import { partnerCatalogRouter } from "../modules/partner/catalog/routes.js";
import { createPartnerOrdersRouter } from "../modules/partner/orders/routes.js";
import { partnerCertificatesRouter } from "../modules/partner/certificates/routes.js";
import { partnerPathsRouter } from "../modules/partner/paths/routes.js";
import { partnerReportsRouter } from "../modules/partner/reports/routes.js";
import { partnerNudgesRouter } from "../modules/partner/nudges/routes.js";
import { partnerSettingsRouter } from "../modules/partner/settings/routes.js";

/**
 * Routes du portail B2B — montées sous `/api/v1/partner` derrière
 * `createPartnerAuthMiddleware`. Toutes scopées à `req.partnerAuth.companyId`.
 */
export function mountPartnerRoutes(app: Router, env: Env) {
  app.use("/auth", partnerMeRouter);
  app.use("/dashboard", partnerDashboardRouter);
  app.use("/cohorts", partnerCohortsRouter);
  app.use("/learners", partnerLearnersRouter);
  app.use("/assignments", partnerAssignmentsRouter);
  app.use("/team", partnerTeamRouter);
  app.use("/catalog", partnerCatalogRouter);
  app.use("/orders", createPartnerOrdersRouter(env));
  app.use("/certificates", partnerCertificatesRouter);
  app.use("/paths", partnerPathsRouter);
  app.use("/reports", partnerReportsRouter);
  app.use("/nudges", partnerNudgesRouter);
  app.use("/settings", partnerSettingsRouter);
}
