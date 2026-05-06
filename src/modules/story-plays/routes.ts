import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const storyPlaysRouter = Router();

const querySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

storyPlaysRouter.get("/", async (req, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    const [rows, total] = await Promise.all([
      prisma.storyPlay.findMany({
        skip: q.skip,
        take: q.take,
        orderBy: { startedAt: "desc" },
        include: { game: true },
      }),
      prisma.storyPlay.count(),
    ]);
    res.json({
      success: true,
      data: {
        storyPlays: rows.map((p) => ({
          ...p,
          startedAt: p.startedAt.toISOString(),
          completedAt: p.completedAt?.toISOString() ?? null,
        })),
        total,
        skip: q.skip,
        take: q.take,
      },
    });
  } catch (e) {
    next(e);
  }
});

storyPlaysRouter.get("/:id", async (req, res, next) => {
  try {
    const p = await prisma.storyPlay.findUnique({
      where: { id: req.params.id },
      include: { game: true },
    });
    if (!p) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }
    res.json({
      success: true,
      data: {
        ...p,
        startedAt: p.startedAt.toISOString(),
        completedAt: p.completedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});
