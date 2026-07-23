import { Router } from "express";
import { listDiaryQuerySchema } from "./schemas.js";
import { listDiaryEntries, getDiaryEntryDetail } from "./service.js";

export const diaryRouter = Router();

diaryRouter.get("/", async (req, res, next) => {
  try {
    const q = listDiaryQuerySchema.parse(req.query);
    const { rows, total } = await listDiaryEntries(q);
    res.json({ success: true, data: { entries: rows, total, skip: q.skip, take: q.take } });
  } catch (e) {
    next(e);
  }
});

diaryRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await getDiaryEntryDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});
