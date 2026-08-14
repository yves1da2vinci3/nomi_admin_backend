import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { uploadB2File } from "../../../services/backblazeService.js";

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

const LOGO_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const uploadLogoBodySchema = Joi.object<{ dataUri: string }>({
  dataUri: Joi.string().min(10).required(),
});

function parseImageDataUri(dataUri: string): { mime: string; buffer: Buffer } {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw httpError(400, "dataUri invalide (format attendu: data:<mime>;base64,<data>)");
  }
  const mime = match[1].toLowerCase();
  if (!LOGO_MIMES.has(mime)) {
    throw httpError(400, "Type d'image non supporté (png, jpeg, webp, svg)");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw httpError(400, "Fichier vide");
  }
  if (buffer.length > LOGO_MAX_BYTES) {
    throw httpError(400, "Logo trop volumineux (2 Mo max)");
  }
  return { mime, buffer };
}

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/webp") return "webp";
  return "png";
}

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

partnerSettingsRouter.post(
  "/logo",
  requirePortalRole("org_admin"),
  validate(uploadLogoBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const { mime, buffer } = parseImageDataUri((req.body as { dataUri: string }).dataUri);
      const fileName = `b2b/companies/${companyId}/logo.${extForMime(mime)}`;
      const url = await uploadB2File(buffer, fileName, mime);
      await prisma.company.update({
        where: { id: companyId },
        data: { logoUrl: url },
      });
      res.status(201).json({ success: true, data: { url } });
    } catch (e) {
      next(e);
    }
  }
);

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
