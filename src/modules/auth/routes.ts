import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { signAdminJwt } from "../../lib/admin-jwt.js";
import type { Env } from "../../config/env.js";

/** Public: POST /auth/login */
export function createPublicAuthRouter(env: Env): Router {
  const r = Router();

  r.post("/login", async (req, res, next) => {
    try {
      const emailRaw = req.body?.email;
      const password = req.body?.password;
      if (typeof emailRaw !== "string" || typeof password !== "string") {
        res.status(400).json({ success: false, error: "Invalid body" });
        return;
      }
      const email = emailRaw.trim().toLowerCase();
      if (!email || !password) {
        res.status(400).json({ success: false, error: "Invalid body" });
        return;
      }

      const admin = await prisma.admin.findUnique({ where: { email } });
      if (!admin) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const ok = await Bun.password.verify(password, admin.passwordHash);
      if (!ok) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const accessToken = await signAdminJwt(env, { sub: admin.id, email: admin.email });
      res.json({
        success: true,
        data: {
          accessToken,
          admin: {
            id: admin.id,
            email: admin.email,
            displayName: admin.displayName ?? admin.email.split("@")[0] ?? "Admin",
          },
        },
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
