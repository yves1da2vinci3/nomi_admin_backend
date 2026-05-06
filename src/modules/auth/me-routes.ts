import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

/** Protected: GET /auth/me — mount under prefix /auth */
export const authMeRouter = Router();

authMeRouter.get("/me", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, displayName: true },
    });
    if (!admin) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    res.json({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName ?? admin.email.split("@")[0] ?? "Admin",
      },
    });
  } catch (e) {
    next(e);
  }
});
