import { Router } from "express";
import { listSessionsQuerySchema, getSessionQuerySchema } from "./schemas.js";
import { listSessions, getSessionDetail } from "./service.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", async (req, res, next) => {
  try {
    const q = listSessionsQuerySchema.parse(req.query);
    const { rows, total } = await listSessions(q);
    res.json({
      success: true,
      data: { sessions: rows, total, skip: q.skip, take: q.take },
    });
  } catch (e) {
    next(e);
  }
});

sessionsRouter.get("/:id", async (req, res, next) => {
  try {
    const q = getSessionQuerySchema.parse(req.query);
    const detail = await getSessionDetail(req.params.id, q.type);
    if (!detail) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});
