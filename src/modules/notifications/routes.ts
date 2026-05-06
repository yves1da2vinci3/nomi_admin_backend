import { Router } from "express";
import { getNotificationMetrics } from "./service.js";

export const notificationsRouter = Router();

notificationsRouter.get("/metrics", async (req, res, next) => {
  try {
    const data = await getNotificationMetrics(req.query.days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
