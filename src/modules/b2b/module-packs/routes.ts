import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import {
  createPackBodySchema,
  listPacksQuerySchema,
  updatePackBodySchema,
  type CreatePackBody,
  type ListPacksQuery,
  type UpdatePackBody,
} from "./schemas.js";
import { createPack, deletePack, getPackById, listPacks, updatePack } from "./service.js";

export const modulePacksRouter = Router();

modulePacksRouter.get("/", validate(listPacksQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await listPacks(req.query as unknown as ListPacksQuery);
    res.json({ success: true, data: { packs: result.packs, pagination: result.pagination } });
  } catch (e) {
    next(e);
  }
});

modulePacksRouter.post("/", validate(createPackBodySchema), async (req, res, next) => {
  try {
    const created = await createPack(req.body as CreatePackBody);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

modulePacksRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getPackById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: "Pack not found" });
      return;
    }
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
});

modulePacksRouter.patch("/:id", validate(updatePackBodySchema), async (req, res, next) => {
  try {
    const updated = await updatePack(String(req.params.id), req.body as UpdatePackBody);
    if (!updated) {
      res.status(404).json({ success: false, error: "Pack not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

modulePacksRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deletePack(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Pack not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
