import { Router } from "express";
import { z } from "zod";
import { getNotificationMetrics } from "./service.js";
import { prisma } from "../../lib/prisma.js";

export const notificationsRouter = Router();

notificationsRouter.get("/metrics", async (req, res, next) => {
  try {
    const data = await getNotificationMetrics(req.query.days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

notificationsRouter.post("/test-push", async (req, res, next) => {
  try {
    const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    await prisma.notification.create({
      data: {
        userId: parsed.data.userId,
        type: "test_push",
        title: "Test Push Notification",
        message: "This is a test push notification sent from the admin panel.",
        isRead: false,
      },
    });
    res.json({ success: true, data: { sent: true } });
  } catch (e) {
    next(e);
  }
});
