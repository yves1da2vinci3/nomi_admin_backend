import { Router } from "express";
import { getDashboardMetrics } from "./service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/metrics", async (req, res, next) => {
  try {
    const data = await getDashboardMetrics(req.query.days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
