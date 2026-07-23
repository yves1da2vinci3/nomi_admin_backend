import { prisma } from "../../lib/prisma.js";

export async function listDiaryEntries(params: {
  skip: number;
  take: number;
  userId?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params.userId) where.userId = params.userId;
  if (params.status) where.status = params.status;

  const [rows, total] = await Promise.all([
    prisma.externalDiaryEntry.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.externalDiaryEntry.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    total,
    rows: rows.map((r) => {
      const u = r.userId ? userMap.get(r.userId) : undefined;
      return {
        id: r.id,
        userId: r.userId,
        user: u?.displayName || u?.email || r.userId || "—",
        status: r.status,
        durationMs: r.durationMs,
        language: r.language,
        detectedTheme: r.detectedTheme,
        rawText: r.rawText,
        correctedText: r.correctedText,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  };
}

export async function getDiaryEntryDetail(id: string) {
  const r = await prisma.externalDiaryEntry.findUnique({ where: { id } });
  if (!r) return null;

  let user: { id: string; displayName: string | null; email: string } | null = null;
  if (r.userId) {
    user = await prisma.user.findUnique({
      where: { id: r.userId },
      select: { id: true, displayName: true, email: true },
    });
  }

  return {
    id: r.id,
    userId: r.userId,
    user: user?.displayName || user?.email || r.userId || "—",
    status: r.status,
    audioPath: r.audioPath,
    audioUrl: r.audioUrl,
    durationMs: r.durationMs,
    language: r.language,
    nativeLanguage: r.nativeLanguage,
    detectedTheme: r.detectedTheme,
    themeKeywords: r.themeKeywords,
    rawText: r.rawText,
    correctedText: r.correctedText,
    expectedIpa: r.expectedIpa,
    words: r.words,
    analysis: r.analysis,
    diff: r.diff,
    responseText: r.responseText,
    responseTranslation: r.responseTranslation,
    responseAudioPath: r.responseAudioPath,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
