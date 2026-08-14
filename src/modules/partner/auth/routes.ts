import { Router } from "express";
import type { Env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { signPartnerJwt } from "../../../lib/partner-jwt.js";
import { validate } from "../../../middleware/validate.js";
import { partnerLoginBodySchema, type PartnerLoginBody } from "./schemas.js";

/** Public: POST /api/v1/partner/auth/login */
export function createPartnerPublicAuthRouter(env: Env): Router {
  const r = Router();

  r.post("/login", validate(partnerLoginBodySchema), async (req, res, next) => {
    try {
      const { email, password } = req.body as PartnerLoginBody;

      const user = await prisma.partnerUser.findUnique({
        where: { email },
        include: { company: { select: { id: true, name: true, slug: true, isActive: true } } },
      });

      // Message identique dans tous les cas d'échec : pas d'énumération de comptes.
      if (!user || !user.passwordHash || !user.company.isActive) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const ok = await Bun.password.verify(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const [accessToken] = await Promise.all([
        signPartnerJwt(env, {
          sub: user.id,
          email: user.email,
          companyId: user.companyId,
          role: user.portalRole,
        }),
        prisma.partnerUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), status: "active" },
        }),
      ]);

      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName ?? user.email.split("@")[0] ?? "Utilisateur",
            portalRole: user.portalRole,
            companyId: user.companyId,
          },
          company: {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
          },
        },
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

/** Protégé: GET /api/v1/partner/auth/me */
export const partnerMeRouter = Router();

partnerMeRouter.get("/me", async (req, res, next) => {
  try {
    const sub = req.partnerAuth?.sub;
    if (!sub) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const user = await prisma.partnerUser.findUnique({
      where: { id: sub },
      include: {
        company: {
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
            isActive: true,
          },
        },
      },
    });

    if (!user || !user.company.isActive) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName ?? user.email.split("@")[0] ?? "Utilisateur",
          portalRole: user.portalRole,
          status: user.status,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          orgType: user.company.orgType,
          plan: user.company.plan,
          seatLimit: user.company.seatLimit,
          apiQuotaMonth: user.company.apiQuotaMonth,
          apiUsedMonth: user.company.apiUsedMonth,
          logoUrl: user.company.logoUrl,
          timezone: user.company.timezone,
          renewalDate: user.company.renewalDate?.toISOString() ?? null,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});
