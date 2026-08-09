import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import {
  createAssignmentBodySchema,
  listAssignmentsQuerySchema,
  updateAssignmentBodySchema,
  updateProgressBodySchema,
  type CreateAssignmentBody,
  type ListAssignmentsQuery,
  type UpdateAssignmentBody,
  type UpdateProgressBody,
} from "./schemas.js";
import {
  cancelAssignment,
  createAssignment,
  getAssignmentDetail,
  listAssignments,
  refreshOverdueAssignments,
  updateAssignment,
  updateLearnerProgress,
} from "./service.js";

export const partnerAssignmentsRouter = Router();

partnerAssignmentsRouter.get(
  "/",
  validate(listAssignmentsQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      await refreshOverdueAssignments(companyId);
      const result = await listAssignments(
        companyId,
        req.query as unknown as ListAssignmentsQuery
      );
      res.json({
        success: true,
        data: { assignments: result.assignments, pagination: result.pagination },
      });
    } catch (e) {
      next(e);
    }
  }
);

partnerAssignmentsRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(createAssignmentBodySchema),
  async (req, res, next) => {
    try {
      const created = await createAssignment(
        requireCompanyId(req),
        String(req.partnerAuth?.sub),
        req.body as CreateAssignmentBody
      );
      res.status(201).json({ success: true, data: created });
    } catch (e) {
      next(e);
    }
  }
);

partnerAssignmentsRouter.get("/:assignmentId", async (req, res, next) => {
  try {
    const detail = await getAssignmentDetail(
      requireCompanyId(req),
      routeParam(req, "assignmentId")
    );
    if (!detail) {
      res.status(404).json({ success: false, error: "Assignment not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});

partnerAssignmentsRouter.patch(
  "/:assignmentId",
  requirePortalRole("org_admin", "instructor"),
  validate(updateAssignmentBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updateAssignment(
        requireCompanyId(req),
        routeParam(req, "assignmentId"),
        req.body as UpdateAssignmentBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Assignment not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

partnerAssignmentsRouter.patch(
  "/:assignmentId/progress/:learnerId",
  requirePortalRole("org_admin", "instructor"),
  validate(updateProgressBodySchema),
  async (req, res, next) => {
    try {
      const updated = await updateLearnerProgress(
        requireCompanyId(req),
        routeParam(req, "assignmentId"),
        routeParam(req, "learnerId"),
        req.body as UpdateProgressBody
      );
      if (!updated) {
        res.status(404).json({ success: false, error: "Assignment or learner not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);

partnerAssignmentsRouter.delete(
  "/:assignmentId",
  requirePortalRole("org_admin", "instructor"),
  async (req, res, next) => {
    try {
      const cancelled = await cancelAssignment(
        requireCompanyId(req),
        routeParam(req, "assignmentId")
      );
      if (!cancelled) {
        res.status(404).json({ success: false, error: "Assignment not found" });
        return;
      }
      res.json({ success: true, data: { cancelled: true } });
    } catch (e) {
      next(e);
    }
  }
);
