import type { RequestHandler } from "express";
import type { PortalRole } from "@prisma/client";
import type { Env } from "../config/env.js";
import { verifyPartnerJwt } from "../lib/partner-jwt.js";

/**
 * Auth du portail B2B. Seul un JWT `PartnerUser` est accepté : ni
 * `ADMIN_API_TOKEN`, ni JWT admin ne donnent accès à `/api/v1/partner/*`.
 */
export function createPartnerAuthMiddleware(env: Env): RequestHandler {
  return async (req, res, next) => {
    const hdr = req.headers.authorization;
    const bearer =
      typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : null;
    if (!bearer) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const payload = await verifyPartnerJwt(env, bearer);
    if (!payload) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    req.partnerAuth = payload;
    next();
  };
}

/** Restreint une route à certains `portalRole`. À placer après l'auth portail. */
export function requirePortalRole(...roles: PortalRole[]): RequestHandler {
  return (req, res, next) => {
    const role = req.partnerAuth?.role;
    if (!role) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!roles.includes(role)) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * `companyId` provient toujours du token — jamais du body ni de la query.
 * Lève si appelé hors d'une route protégée par `createPartnerAuthMiddleware`.
 */
export function requireCompanyId(req: { partnerAuth?: { companyId: string } }): string {
  const companyId = req.partnerAuth?.companyId;
  if (!companyId) throw new Error("partnerAuth missing — route not protected");
  return companyId;
}
