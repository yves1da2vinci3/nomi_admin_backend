import { Router } from "express";
import { listSessionsForLearnedWord } from "./service.js";

export const learnedWordsRouter = Router();

learnedWordsRouter.get("/:id/sessions", async (req, res, next) => {
  try {
    const sessions = await listSessionsForLearnedWord(req.params.id);
    res.json({ success: true, data: { sessions } });
  } catch (e) {
    next(e);
  }
});
