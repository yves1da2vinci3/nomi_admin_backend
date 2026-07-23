import { prisma } from "../../lib/prisma.js";

export async function listLearnedWordsForUser(
  userId: string,
  params: {
    skip: number;
    take: number;
    language?: string;
    source?: string;
    status?: string;
    search?: string;
    masteryMin?: number;
    masteryMax?: number;
  }
) {
  const where: Record<string, unknown> = { userId };
  if (params.language) where.language = params.language;
  if (params.source) where.vocabularySource = params.source;
  if (params.status) where.status = params.status;
  if (params.search) where.word = { contains: params.search, mode: "insensitive" };
  if (params.masteryMin != null || params.masteryMax != null) {
    where.masteryLevel = {
      ...(params.masteryMin != null ? { gte: params.masteryMin } : {}),
      ...(params.masteryMax != null ? { lte: params.masteryMax } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.learnedWord.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { lastUsed: "desc" },
    }),
    prisma.learnedWord.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((w) => ({
      id: w.id,
      word: w.word,
      language: w.language,
      context: w.context,
      difficulty: w.difficulty,
      lexicalBand: w.lexicalBand,
      timesUsed: w.timesUsed,
      timesCorrect: w.timesCorrect,
      lastUsed: w.lastUsed.toISOString(),
      masteryLevel: w.masteryLevel,
      status: w.status,
      isFavorite: w.isFavorite,
      vocabularySource: w.vocabularySource,
      createdAt: w.createdAt.toISOString(),
    })),
  };
}

export async function listSessionsForLearnedWord(learnedWordId: string) {
  const rows = await prisma.learnedWordSession.findMany({
    where: { learnedWordId },
    include: { scenarioSession: { include: { scenario: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    scenarioSessionId: r.scenarioSessionId,
    scenarioId: r.scenarioSession.scenarioId,
    startedAt: r.scenarioSession.startedAt.toISOString(),
    completedAt: r.scenarioSession.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
