import { Router } from "express";
import {
  createGoalBodySchema,
  createScenarioBodySchema,
  createVocabBodySchema,
  listScenariosQuerySchema,
  updateScenarioBodySchema,
} from "./schemas.js";
import {
  createGoalRaw,
  createScenarioRaw,
  createVocabRaw,
  deleteGoalRaw,
  deleteScenarioRaw,
  deleteVocabRaw,
  getScenarioById,
  listScenarios,
  mapScenarioToApiItem,
  updateGoalRaw,
  updateScenarioRaw,
  updateVocabRaw,
} from "./service.js";
import { prisma } from "../../lib/prisma.js";

export const scenariosRouter = Router();

/** Nested routes must mount before `/:id` or `/x/goals` matches `:id` = `x`. */
const goalsRouter = Router({ mergeParams: true });

goalsRouter.get("/", async (req, res, next) => {
  try {
    const { scenarioId } = req.params as { scenarioId: string };
    const goals = await prisma.scenarioGoal.findMany({
      where: { scenarioId, isActive: true },
      orderBy: { order: "asc" },
    });
    res.json({
      success: true,
      data: goals.map((g) => ({
        id: g.id,
        scenarioId: g.scenarioId,
        order: g.order,
        title: g.title,
        description: g.description,
        isActive: g.isActive,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

goalsRouter.post("/", async (req, res, next) => {
  try {
    const { scenarioId } = req.params as { scenarioId: string };
    const parsed = createGoalBodySchema.parse(req.body);
    const body = {
      ...parsed,
      expectedWords: parsed.expectedWords ?? [],
      expectedPhrases: parsed.expectedPhrases ?? [],
      requiredWords: parsed.requiredWords ?? [],
      optionalWords: parsed.optionalWords ?? [],
    };
    const g = await createGoalRaw(scenarioId, body);
    res.status(201).json({ success: true, data: g });
  } catch (e) {
    next(e);
  }
});

goalsRouter.patch("/:goalId", async (req, res, next) => {
  try {
    const patch = req.body as Record<string, unknown>;
    const g = await updateGoalRaw(req.params.goalId, patch);
    res.json({ success: true, data: g });
  } catch (e) {
    next(e);
  }
});

goalsRouter.delete("/:goalId", async (req, res, next) => {
  try {
    await deleteGoalRaw(req.params.goalId);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

const vocabRouter = Router({ mergeParams: true });

vocabRouter.get("/", async (req, res, next) => {
  try {
    const { scenarioId } = req.params as { scenarioId: string };
    const rows = await prisma.scenarioVocabulary.findMany({
      where: { scenarioId },
      orderBy: [{ category: "asc" }, { difficulty: "asc" }],
    });
    res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

vocabRouter.post("/", async (req, res, next) => {
  try {
    const { scenarioId } = req.params as { scenarioId: string };
    const body = createVocabBodySchema.parse(req.body);
    const v = await createVocabRaw(scenarioId, body);
    res.status(201).json({ success: true, data: v });
  } catch (e) {
    next(e);
  }
});

vocabRouter.patch("/:vocabId", async (req, res, next) => {
  try {
    const patch = req.body as Record<string, unknown>;
    const v = await updateVocabRaw(req.params.vocabId, patch);
    res.json({ success: true, data: v });
  } catch (e) {
    next(e);
  }
});

vocabRouter.delete("/:vocabId", async (req, res, next) => {
  try {
    await deleteVocabRaw(req.params.vocabId);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

scenariosRouter.use("/:scenarioId/goals", goalsRouter);
scenariosRouter.use("/:scenarioId/vocabulary", vocabRouter);

scenariosRouter.get("/", async (req, res, next) => {
  try {
    const q = listScenariosQuerySchema.parse(req.query);
    const result = await listScenarios({
      page: q.page,
      limit: q.limit,
      theme: q.theme,
      search: q.search,
      isActive: q.isActive,
      language: q.language,
      includeGoals: q.includeGoals === "true",
      includeVocabulary: q.includeVocabulary === "true",
    });
    res.json({
      success: true,
      data: {
        scenarios: result.scenarios,
        pagination: result.pagination,
      },
    });
  } catch (e) {
    next(e);
  }
});

scenariosRouter.post("/", async (req, res, next) => {
  try {
    const body = createScenarioBodySchema.parse(req.body);
    const created = await createScenarioRaw(body);
    const lang = (req.query.language as string) || "fr";
    const item = await getScenarioById(created.id, lang, false, false);
    res.status(201).json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

scenariosRouter.get("/:id", async (req, res, next) => {
  try {
    const language = (req.query.language as string) || "fr";
    const includeGoals = req.query.includeGoals === "true";
    const includeVocabulary = req.query.includeVocabulary === "true";
    const item = await getScenarioById(req.params.id, language, includeGoals, includeVocabulary);
    if (!item) {
      res.status(404).json({ success: false, error: "Scenario not found" });
      return;
    }
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

scenariosRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateScenarioBodySchema.parse(req.body);
    await updateScenarioRaw(req.params.id, body as any);
    const language = (req.query.language as string) || "fr";
    const item = await getScenarioById(req.params.id, language, false, false);
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

scenariosRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteScenarioRaw(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
