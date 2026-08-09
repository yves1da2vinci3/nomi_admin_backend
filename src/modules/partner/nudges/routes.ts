import { Router } from "express";
import Joi from "joi";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";

type SendNudgeBody = {
  learnerIds: string[];
  channel: "email" | "digest";
  message: string;
};

const sendNudgeBodySchema = Joi.object<SendNudgeBody>({
  learnerIds: Joi.array().items(Joi.string().uuid()).min(1).max(500).unique().required(),
  channel: Joi.string().valid("email", "digest").default("email"),
  message: Joi.string().trim().min(1).max(2000).required(),
});

export const partnerNudgesRouter = Router();

partnerNudgesRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.nudgeLog.findMany({
      where: { companyId: requireCompanyId(req) },
      include: { sentByPartnerUser: { select: { id: true, email: true, displayName: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    res.json({
      success: true,
      data: {
        nudges: rows.map((row) => ({
          id: row.id,
          learnerIds: row.learnerIds,
          learnerCount: row.learnerIds.length,
          channel: row.channel,
          message: row.message,
          sentBy: row.sentByPartnerUser,
          sentAt: row.sentAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

partnerNudgesRouter.post(
  "/",
  requirePortalRole("org_admin", "instructor"),
  validate(sendNudgeBodySchema),
  async (req, res, next) => {
    try {
      const companyId = requireCompanyId(req);
      const body = req.body as SendNudgeBody;

      // Les apprenants ciblés doivent tous appartenir à l'entreprise du token.
      const known = await prisma.companyLearner.count({
        where: { companyId, id: { in: body.learnerIds } },
      });
      if (known !== body.learnerIds.length) throw httpError(400, "Unknown learnerId");

      const created = await prisma.nudgeLog.create({
        data: {
          companyId,
          learnerIds: body.learnerIds,
          channel: body.channel,
          message: body.message,
          sentByPartnerUserId: req.partnerAuth?.sub ?? null,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: created.id,
          learnerCount: created.learnerIds.length,
          channel: created.channel,
          sentAt: created.sentAt.toISOString(),
        },
      });
    } catch (e) {
      next(e);
    }
  }
);
