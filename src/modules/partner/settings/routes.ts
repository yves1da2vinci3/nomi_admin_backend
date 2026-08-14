import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";

type UpdateSettingsBody = {
  name?: string;
  logoUrl?: string | null;
  timezone?: string;
  weeklyDigest?: boolean;
  quotaAlert?: boolean;
  monthlyReport?: boolean;
};

/**
 * Champs modifiables par le partenaire. `plan`, `seatLimit` et `apiQuotaMonth`
 * restent pilotés par l'admin interne.
 */
const updateSettingsBodySchema = Joi.object<UpdateSettingsBody>({
  name: Joi.string().trim().min(1).max(160),
  logoUrl: Joi.string().trim().uri().allow(null, ""),
  timezone: Joi.string().trim().max(64),
  weeklyDigest: Joi.boolean(),
  quotaAlert: Joi.boolean(),
  monthlyReport: Joi.boolean(),
}).min(1);

export const partnerSettingsRouter = Router();

partnerSettingsRouter.get("/", async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: requireCompanyId(req) },
      select: {
        id: true,
        name: true,
        slug: true,
        orgType: true,
        plan: true,
        seatLimit: true,
        apiQuotaMonth: true,
        apiUsedMonth: true,
        logoUrl: true,
        timezone: true,
        renewalDate: true,
        weeklyDigest: true,
        quotaAlert: true,
        monthlyReport: true,
      },
    });
    if (!company) {
      res.status(404).json({ success: false, error: "Company not found" });
      return;
    }
    res.json({
      success: true,
      data: { ...company, renewalDate: company.renewalDate?.toISOString() ?? null },
    });
  } catch (e) {
    next(e);
  }
});

partnerSettingsRouter.patch(
  "/",
  requirePortalRole("org_admin"),
  validate(updateSettingsBodySchema),
  async (req, res, next) => {
    try {
      const body = req.body as UpdateSettingsBody;
      const updated = await prisma.company.update({
        where: { id: requireCompanyId(req) },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl || null } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.weeklyDigest !== undefined ? { weeklyDigest: body.weeklyDigest } : {}),
          ...(body.quotaAlert !== undefined ? { quotaAlert: body.quotaAlert } : {}),
          ...(body.monthlyReport !== undefined ? { monthlyReport: body.monthlyReport } : {}),
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          timezone: true,
          weeklyDigest: true,
          quotaAlert: true,
          monthlyReport: true,
        },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
);
