import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import {
  importLearnersBodySchema,
  inactiveLearnersQuerySchema,
  inviteLearnerBodySchema,
  listLearnersQuerySchema,
  updateLearnerBodySchema,
  type ImportLearnersBody,
  type InactiveLearnersQuery,
  type InviteLearnerBody,
  type ListLearnersQuery,
  type UpdateLearnerBody,
} from "./schemas.js";
import {
  getLearnerDetail,
  importLearners,
  inviteLearner,
  listInactiveLearners,
  listLearners,
  removeLearner,
  updateLearner,
} from "./service.js";

export const partnerLearnersRouter = Router();

// Routes fixes avant `/:learnerId`, sinon `:learnerId` capture "import"/"inactive".
partnerLearnersRouter.post(
  "/import",
  requirePortalRole("org_admin", "instructor"),
  validate(importLearnersBodySchema),
  async (req, res, next) => {
    try {
      const result = await importLearners(
        requireCompanyId(req),
        req.body as ImportLearnersBody
      );
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

partnerLearnersRouter.get(
  "/inactive",
  validate(inactiveLearnersQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { days } = req.query as unknown as InactiveLearnersQuery;
      const result = await listInactiveLearners(requireCompanyId(req), days);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
);

partnerLearnersRouter.get(
  "/",
  validate(listLearnersQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const result = await listLearners(
        requireCompanyId(req),
        req.query as unknown as ListLearnersQuery
      );
      res.json({
        success: true,
        data: { learners: result.learners, pagination: result.pagination },
      });
    } catch (e) {
      next(e);
    }
  }
);

partnerLearnersRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(inviteLearnerBodySchema),
  async (req, res, next) => {
    try {
      const created = await inviteLearner(requireCompanyId(req), req.body as InviteLearnerBody);
      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }
);

partnerLearnersRouter.get("/:learnerId", async (req, res, next) => {
  try {
    const detail = await getLearnerDetail(requireCompanyId(req), routeParam(req, "learnerId"));
    if (!detail) {
      res.status(404).json({ success: false, error: "Learner not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});

partnerLearnersRouter.patch(
  "/:learnerId",
  requirePortalRole("org_admin", "instructor"),
  validate(updateLearnerBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updateLearner(
        requireCompanyId(req),
        routeParam(req, "learnerId"),
        req.body as UpdateLearnerBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Learner not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

partnerLearnersRouter.delete(
  "/:learnerId",
  requirePortalRole("org_admin"),
  async (req, res, next) => {
    try {
      const deleted = await removeLearner(requireCompanyId(req), routeParam(req, "learnerId"));
      if (!deleted) {
        res.status(404).json({ success: false, error: "Learner not found" });
        return;
      }
      res.json({ success: true, data: { deleted: true } });
    } catch (e) {
      next(e);
    }
  }
);
