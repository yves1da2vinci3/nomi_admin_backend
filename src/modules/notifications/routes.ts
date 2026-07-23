import { Router } from "express";
import { z } from "zod";
import { getNotificationMetrics, listNotifications, sendExpoPushToUser } from "./service.js";
import { prisma } from "../../lib/prisma.js";

export const notificationsRouter = Router();

const listQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().uuid().optional(),
});

notificationsRouter.get("/metrics", async (req, res, next) => {
  try {
    const data = await getNotificationMetrics(req.query.days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const { rows, total } = await listNotifications(q);
    res.json({ success: true, data: { notifications: rows, total, skip: q.skip, take: q.take } });
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
    const title = "Test Push Notification";
    const message = "This is a test push notification sent from the admin panel.";
    await prisma.notification.create({
      data: { userId: parsed.data.userId, type: "test_push", title, message, isRead: false },
    });
    const pushResult = await sendExpoPushToUser(parsed.data.userId, title, message);
    res.json({ success: true, data: { sent: true, push: pushResult } });
  } catch (e) {
    next(e);
  }
});
