import type { GeneratedGame } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

function extractTitle(gameData: unknown): string | null {
  if (!gameData || typeof gameData !== "object") return null;
  const g = gameData as Record<string, unknown>;
  const title = g.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const theme = g.theme;
  if (typeof theme === "string" && theme.trim()) return theme.trim();
  return null;
}

function extractTheme(gameData: unknown): string {
  if (!gameData || typeof gameData !== "object") return "—";
  const g = gameData as Record<string, unknown>;
  const t = g.theme;
  return typeof t === "string" && t.trim() ? t.trim() : "—";
}

export function mapGameToStoryListItem(g: GeneratedGame) {
  const gd = g.gameData;
  return {
    id: g.id,
    status: g.status,
    difficulty: g.difficulty,
    learningLanguage: g.learningLanguage,
    createdAt: g.createdAt.toISOString(),
    titleDisplay: extractTitle(gd) ?? `Story ${g.id.slice(0, 8)}`,
    themeDisplay: extractTheme(gd),
    error: g.error,
    gameData: gd as unknown,
  };
}

export function mapGameToDetail(g: GeneratedGame) {
  return {
    ...g,
    gameType: g.gameType,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export async function listGeneratedGames(params: {
  skip: number;
  take: number;
  gameType?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params.gameType) where.gameType = params.gameType;
  if (params.status) where.status = params.status;

  const [rows, total] = await Promise.all([
    prisma.generatedGame.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.generatedGame.count({ where }),
  ]);
  return { rows, total };
}

export async function getGeneratedGameById(id: string) {
  return prisma.generatedGame.findUnique({ where: { id } });
}

export async function createGeneratedGame(data: Parameters<typeof prisma.generatedGame.create>[0]["data"]) {
  return prisma.generatedGame.create({ data });
}

export async function updateGeneratedGame(
  id: string,
  data: Parameters<typeof prisma.generatedGame.update>[0]["data"]
) {
  return prisma.generatedGame.update({ where: { id }, data });
}

export async function deleteGeneratedGame(id: string) {
  return prisma.generatedGame.delete({ where: { id } });
}
