import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { ingestUsageBodySchema, type IngestUsageBody } from "./schemas.js";
import { ingestUsage, resetMonthlyApiUsage } from "./service.js";

/**
 * Déclenchement manuel du balayage d'usage — rattrapage et vérification. Le
 * même travail tourne périodiquement via `jobs/b2b-scheduler.ts`.
 */
export const b2bUsageRouter = Router();

b2bUsageRouter.post("/ingest", validate(ingestUsageBodySchema), async (req, res, next) => {
  try {
    const body = req.body as IngestUsageBody;
    const report = await ingestUsage({ since: body.since, limit: body.limit });
    res.json({ success: true, data: report });
  } catch (e) {
    next(e);
  }
});

b2bUsageRouter.post("/reset-monthly", async (_req, res, next) => {
  try {
    const companies = await resetMonthlyApiUsage();
    res.json({ success: true, data: { companies } });
  } catch (e) {
    next(e);
  }
});
