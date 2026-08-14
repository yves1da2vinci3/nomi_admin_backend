import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import {
  createModuleBodySchema,
  listModulesQuerySchema,
  updateModuleBodySchema,
  type CreateModuleBody,
  type ListModulesQuery,
  type UpdateModuleBody,
} from "./schemas.js";
import {
  createModule,
  deleteModule,
  getModuleById,
  listModules,
  updateModule,
} from "./service.js";

export const b2bModulesRouter = Router();

b2bModulesRouter.get("/", validate(listModulesQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await listModules(req.query as unknown as ListModulesQuery);
    res.json({ success: true, data: { modules: result.modules, pagination: result.pagination } });
  } catch (e) {
    next(e);
  }
});

b2bModulesRouter.post("/", validate(createModuleBodySchema), async (req, res, next) => {
  try {
    const created = await createModule(req.body as CreateModuleBody);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

b2bModulesRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getModuleById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Module not found" });
      return;
    }
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

b2bModulesRouter.patch("/:id", validate(updateModuleBodySchema), async (req, res, next) => {
  try {
    const updated = await updateModule(String(req.params.id), req.body as UpdateModuleBody);
    if (!updated) {
      res.status(404).json({ success: false, error: "Module not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

b2bModulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteModule(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Module not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
