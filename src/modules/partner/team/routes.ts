import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import {
  createPartnerUserBodySchema,
  updatePartnerUserBodySchema,
  type CreatePartnerUserBody,
  type UpdatePartnerUserBody,
} from "../../b2b/companies/schemas.js";
import {
  createPartnerUser,
  deletePartnerUser,
  listPartnerUsers,
  updatePartnerUser,
} from "../../b2b/companies/service.js";

/** Gestion de l'équipe portail — réservée aux `org_admin` en écriture. */
export const partnerTeamRouter = Router();

partnerTeamRouter.get("/", async (req, res, next) => {
  try {
    const members = await listPartnerUsers(requireCompanyId(req));
    res.json({ success: true, data: { members } });
  } catch (e) {
    next(e);
  }
});

partnerTeamRouter.post(
  "/",
  requirePortalRole("org_admin"),
  validate(createPartnerUserBodySchema),
  async (req, res, next) => {
    try {
      const created = await createPartnerUser(
        requireCompanyId(req),
        req.body as CreatePartnerUserBody
      );
      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }
);

partnerTeamRouter.patch(
  "/:memberId",
  requirePortalRole("org_admin"),
  validate(updatePartnerUserBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updatePartnerUser(
        requireCompanyId(req),
        routeParam(req, "memberId"),
        req.body as UpdatePartnerUserBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Member not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

partnerTeamRouter.delete("/:memberId", requirePortalRole("org_admin"), async (req, res, next) => {
  try {
    const memberId = routeParam(req, "memberId");
    if (memberId === req.partnerAuth?.sub) {
      res.status(409).json({ success: false, error: "Impossible de se révoquer soi-même" });
      return;
    }
    const deleted = await deletePartnerUser(requireCompanyId(req), memberId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Member not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
