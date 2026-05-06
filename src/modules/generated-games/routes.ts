import { Router } from "express";
import {
  createGeneratedGameBodySchema,
  listGeneratedGamesQuerySchema,
  updateGeneratedGameBodySchema,
} from "./schemas.js";
import {
  createGeneratedGame,
  deleteGeneratedGame,
  getGeneratedGameById,
  listGeneratedGames,
  mapGameToDetail,
  mapGameToStoryListItem,
  updateGeneratedGame,
} from "./service.js";

export const generatedGamesRouter = Router();

generatedGamesRouter.get("/", async (req, res, next) => {
  try {
    const q = listGeneratedGamesQuerySchema.parse(req.query);
    const { rows, total } = await listGeneratedGames({
      skip: q.skip,
      take: q.take,
      gameType: q.gameType,
      status: q.status,
      userId: q.userId,
    });
    const list = rows.map(mapGameToStoryListItem);
    res.json({
      success: true,
      data: {
        games: list,
        total,
        skip: q.skip,
        take: q.take,
      },
    });
  } catch (e) {
    next(e);
  }
});

generatedGamesRouter.get("/:id", async (req, res, next) => {
  try {
    const g = await getGeneratedGameById(req.params.id);
    if (!g) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({ success: true, data: mapGameToDetail(g) });
  } catch (e) {
    next(e);
  }
});

generatedGamesRouter.post("/", async (req, res, next) => {
  try {
    const body = createGeneratedGameBodySchema.parse(req.body);
    const created = await createGeneratedGame({
      userId: body.userId,
      gameType: body.gameType,
      status: body.status ?? "pending",
      difficulty: body.difficulty,
      learningLanguage: body.learningLanguage,
      userLanguage: body.userLanguage,
      scenarioIds: body.scenarioIds,
      words: body.words,
      gameData: body.gameData ?? undefined,
      error: body.error ?? undefined,
    });
    res.status(201).json({ success: true, data: mapGameToDetail(created) });
  } catch (e) {
    next(e);
  }
});

generatedGamesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateGeneratedGameBodySchema.parse(req.body);
    const updated = await updateGeneratedGame(req.params.id, body as any);
    res.json({ success: true, data: mapGameToDetail(updated) });
  } catch (e) {
    next(e);
  }
});

generatedGamesRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteGeneratedGame(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
