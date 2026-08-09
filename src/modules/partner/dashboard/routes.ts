import { Router } from "express";
import Joi from "joi";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId } from "../../../middleware/auth-partner.js";
import { getDashboard } from "./service.js";
import { refreshOverdueAssignments } from "../assignments/service.js";

type DashboardQuery = { days: number; cohortId?: string };

const dashboardQuerySchema = Joi.object<DashboardQuery>({
  days: Joi.number().integer().min(7).max(90).default(14),
  cohortId: Joi.string().uuid(),
});

export const partnerDashboardRouter = Router();

partnerDashboardRouter.get("/", validate(dashboardQuerySchema, "query"), async (req, res, next) => {
  try {
    const companyId = requireCompanyId(req);
    const { days, cohortId } = req.query as unknown as DashboardQuery;
    await refreshOverdueAssignments(companyId);
    const data = await getDashboard(companyId, days, cohortId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
