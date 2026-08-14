import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { listContentsQuerySchema, type ListContentsQuery } from "./schemas.js";
import { listModuleContents } from "./service.js";

/**
 * Catalogue de contenus assignables. Global, pas scopé `companyId` : la route
 * reste derrière l'auth partenaire mais les contenus sont les mêmes pour tous.
 */
export const partnerContentsRouter = Router();

partnerContentsRouter.get("/", validate(listContentsQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await listModuleContents(req.query as unknown as ListContentsQuery);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
