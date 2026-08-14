import { Router } from "express";
import { requireCompanyId } from "../../../middleware/auth-partner.js";
import { getCatalog } from "./service.js";

export const partnerCatalogRouter = Router();

partnerCatalogRouter.get("/", async (req, res, next) => {
  try {
    const catalog = await getCatalog(requireCompanyId(req));
    res.json({ success: true, data: catalog });
  } catch (e) {
    next(e);
  }
});
