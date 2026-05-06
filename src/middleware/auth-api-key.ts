import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";

export function createAuthApiKeyMiddleware(env: Env): RequestHandler {
  const token = env.ADMIN_API_TOKEN;
  return (req, res, next) => {
    const hdr = req.headers.authorization;
    const bearer =
      typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : null;
    if (!bearer || bearer !== token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    next();
  };
}
