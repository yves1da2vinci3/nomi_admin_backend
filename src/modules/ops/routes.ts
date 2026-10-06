import { Router } from "express";
import { getOpsSwitches, getQueueStatus, opsSwitchPatchSchema, patchOpsSwitches } from "./service.js";

export const opsRouter = Router();

opsRouter.get("/queues", async (_req, res, next) => {
  try {
    const data = await getQueueStatus();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

opsRouter.get("/switches", async (_req, res, next) => {
  try {
    const data = await getOpsSwitches();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

opsRouter.patch("/switches", async (req, res, next) => {
  const parsed = opsSwitchPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  try {
    const data = await patchOpsSwitches(parsed.data);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
