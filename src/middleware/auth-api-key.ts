import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import { verifyAdminJwt } from "../lib/admin-jwt.js";

/**
 * Accepte `Authorization: Bearer` égal à ADMIN_API_TOKEN (legacy / scripts)
 * ou un JWT HS256 signé avec JWT_SECRET (sessions login admin).
 */
export function createAuthApiKeyMiddleware(env: Env): RequestHandler {
  const apiToken = env.ADMIN_API_TOKEN;
  return async (req, res, next) => {
    const hdr = req.headers.authorization;
    const bearer =
      typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : null;
    if (!bearer) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (bearer === apiToken) {
      delete req.adminAuth;
      next();
      return;
    }

    const jwtPayload = await verifyAdminJwt(env, bearer);
    if (!jwtPayload) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    req.adminAuth = jwtPayload;
    next();
  };
}
