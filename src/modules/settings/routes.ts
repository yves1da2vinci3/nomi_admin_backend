import { Router } from "express";
import { z } from "zod";

export const settingsRouter = Router();

type AppSettings = {
  maintenanceMode: boolean;
  sessionTimeoutSeconds: number;
  globalRateLimitRpm: number;
  notificationEmail: string;
};

const state: AppSettings = {
  maintenanceMode: false,
  sessionTimeoutSeconds: 3600,
  globalRateLimitRpm: 100,
  notificationEmail: "ops-alerts@nomi.app",
};

const patchSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  sessionTimeoutSeconds: z.number().int().positive().optional(),
  globalRateLimitRpm: z.number().int().positive().optional(),
  notificationEmail: z.string().email().optional(),
});

settingsRouter.get("/", (_req, res) => {
  res.json({ success: true, data: state });
});

settingsRouter.patch("/", (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  Object.assign(state, parsed.data);
  res.json({ success: true, data: state });
});

settingsRouter.post("/maintenance", (req, res) => {
  const body = z.object({ enabled: z.boolean().optional() }).safeParse(req.body);
  if (body.success && body.data.enabled !== undefined) {
    state.maintenanceMode = body.data.enabled;
  } else {
    state.maintenanceMode = !state.maintenanceMode;
  }
  res.json({ success: true, data: { maintenanceMode: state.maintenanceMode } });
});
