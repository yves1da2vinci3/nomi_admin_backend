import { Router } from "express";
import {
  listInterpreterSessionsQuerySchema,
  listPracticeRunsQuerySchema,
  analyticsQuerySchema,
} from "./schemas.js";
import {
  listInterpreterSessions,
  getInterpreterSessionDetail,
  listPracticeRuns,
  getPracticeRunDetail,
  getScenarioAnalytics,
} from "./service.js";

export const interpreterSessionsRouter = Router();

interpreterSessionsRouter.get("/analytics", async (req, res, next) => {
  try {
    const q = analyticsQuerySchema.parse(req.query);
    const data = await getScenarioAnalytics(q.scenarioId, q.days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

interpreterSessionsRouter.get("/", async (req, res, next) => {
  try {
    const q = listInterpreterSessionsQuerySchema.parse(req.query);
    const { rows, total } = await listInterpreterSessions(q);
    res.json({ success: true, data: { sessions: rows, total, skip: q.skip, take: q.take } });
  } catch (e) {
    next(e);
  }
});

interpreterSessionsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await getInterpreterSessionDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});

export const interpreterPracticeRunsRouter = Router();

interpreterPracticeRunsRouter.get("/", async (req, res, next) => {
  try {
    const q = listPracticeRunsQuerySchema.parse(req.query);
    const { rows, total } = await listPracticeRuns(q);
    res.json({ success: true, data: { runs: rows, total, skip: q.skip, take: q.take } });
  } catch (e) {
    next(e);
  }
});

interpreterPracticeRunsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await getPracticeRunDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});
