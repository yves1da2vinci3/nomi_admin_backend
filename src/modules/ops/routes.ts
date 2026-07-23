import { Router } from "express";
import { getQueueStatus } from "./service.js";

export const opsRouter = Router();

opsRouter.get("/queues", async (_req, res, next) => {
  try {
    const data = await getQueueStatus();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
