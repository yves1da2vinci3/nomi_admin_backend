import { Router } from "express";
import {
  paginationQuerySchema,
  createScenarioSchema,
  updateScenarioSchema,
  createObjectiveSchema,
  updateObjectiveSchema,
} from "./schemas.js";
import {
  listScenarios,
  createScenario,
  getScenario,
  updateScenario,
  deleteScenario,
  addObjective,
  updateObjective,
  deleteObjective,
} from "./service.js";

export const interpreterRouter = Router();

interpreterRouter.get("/", async (req, res, next) => {
  try {
    const q = paginationQuerySchema.parse(req.query);
    const result = await listScenarios(q.page, q.limit);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const scenario = await createScenario(parsed.data);
    res.status(201).json({ success: true, data: scenario });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.get("/:id", async (req, res, next) => {
  try {
    const scenario = await getScenario(req.params.id);
    res.json({ success: true, data: scenario });
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    if (err.statusCode === 404) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    next(e);
  }
});

interpreterRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const scenario = await updateScenario(req.params.id, parsed.data);
    res.json({ success: true, data: scenario });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteScenario(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.post("/:id/objectives", async (req, res, next) => {
  try {
    const parsed = createObjectiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const obj = await addObjective(req.params.id, parsed.data);
    res.status(201).json({ success: true, data: obj });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.patch("/:id/objectives/:objId", async (req, res, next) => {
  try {
    const parsed = updateObjectiveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const obj = await updateObjective(req.params.id, req.params.objId, parsed.data);
    res.json({ success: true, data: obj });
  } catch (e) {
    next(e);
  }
});

interpreterRouter.delete("/:id/objectives/:objId", async (req, res, next) => {
  try {
    await deleteObjective(req.params.id, req.params.objId);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
