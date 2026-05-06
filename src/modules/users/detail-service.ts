import { prisma } from "../../lib/prisma.js";
import { getMultilingualField } from "../scenarios/utils.js";
import { mapGameToStoryListItem } from "../generated-games/service.js";

function extractTitleFromGameData(gameData: unknown): string | null {
  if (!gameData || typeof gameData !== "object") return null;
  const g = gameData as Record<string, unknown>;
  const title = g.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const theme = g.theme;
  if (typeof theme === "string" && theme.trim()) return theme.trim();
  return null;
}

export type UserAdminDetail = {
  profile: {
    id: string;
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    learningLanguage: string | null;
    nativeLanguage: string | null;
    learningLanguages: string[];
    level: string | null;
    isSuspended: boolean;
    createdAt: string;
    updatedAt: string;
  };
  progress: {
    totalSessions: number;
    completedSessions: number;
    totalScore: number;
    averageScore: number;
    totalTimeSpent: number;
    wordsLearned: number;
    lastPlayed: string | null;
    bestScore: number;
  } | null;
  scenarioSessions: {
    id: string;
    scenarioId: string;
    scenarioTitle: string;
    learningLanguage: string;
    difficulty: string;
    status: string;
    score: number;
    durationSec: number;
    completed: boolean;
    startedAt: string;
    completedAt: string | null;
  }[];
  scenarioSessionStats: {
    total: number;
    completed: number;
    totalDurationSec: number;
    averageScore: number | null;
  };
  generatedGames: ReturnType<typeof mapGameToStoryListItem>[];
  generatedGamesTotal: number;
  storyPlays: {
    id: string;
    gameId: string;
    startedAt: string;
    completedAt: string | null;
    score: number | null;
    gameStatus: string;
    titleDisplay: string;
  }[];
  storyPlaysTotal: number;
  learnedWordsCount: number;
  recentLearnedWords: {
    id: string;
    word: string;
    language: string;
    lastUsed: string;
    masteryLevel: number;
  }[];
  notifications: {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }[];
  weeklyActivity: { day: string; sessionCount: number }[];
};

export async function getUserAdminDetail(
  userId: string,
  language: string
): Promise<UserAdminDetail | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [
    progressRow,
    scenarioSessions,
    sessionCount,
    completedSessionCount,
    durationSum,
    avgScoreAgg,
    generatedGamesRows,
    generatedGamesTotal,
    storyPlayRows,
    storyPlaysTotal,
    learnedWordsCount,
    recentLearnedWords,
    notificationsRows,
    sessionsLast7d,
  ] = await Promise.all([
    prisma.userProgress.findUnique({ where: { userId } }),
    prisma.scenarioSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 15,
      include: { scenario: true },
    }),
    prisma.scenarioSession.count({ where: { userId } }),
    prisma.scenarioSession.count({ where: { userId, completed: true } }),
    prisma.scenarioSession.aggregate({
      where: { userId },
      _sum: { duration: true },
    }),
    prisma.scenarioSession.aggregate({
      where: { userId, completed: true },
      _avg: { score: true },
    }),
    prisma.generatedGame.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.generatedGame.count({ where: { userId } }),
    prisma.storyPlay.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 15,
      include: { game: true },
    }),
    prisma.storyPlay.count({ where: { userId } }),
    prisma.learnedWord.count({ where: { userId } }),
    prisma.learnedWord.findMany({
      where: { userId },
      orderBy: { lastUsed: "desc" },
      take: 8,
      select: {
        id: true,
        word: true,
        language: true,
        lastUsed: true,
        masteryLevel: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.scenarioSession.findMany({
      where: { userId, startedAt: { gte: since7d } },
      select: { startedAt: true },
    }),
  ]);

  const dayBuckets = new Map<string, number>();
  for (const s of sessionsLast7d) {
    const day = s.startedAt.toISOString().slice(0, 10);
    dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }
  const weeklyActivity: { day: string; sessionCount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    weeklyActivity.push({ day, sessionCount: dayBuckets.get(day) ?? 0 });
  }

  const progress = progressRow
    ? {
        totalSessions: progressRow.totalSessions,
        completedSessions: progressRow.completedSessions,
        totalScore: progressRow.totalScore,
        averageScore: progressRow.averageScore,
        totalTimeSpent: progressRow.totalTimeSpent,
        wordsLearned: progressRow.wordsLearned,
        lastPlayed: progressRow.lastPlayed?.toISOString() ?? null,
        bestScore: progressRow.bestScore,
      }
    : null;

  const mappedSessions = scenarioSessions.map((s) => ({
    id: s.id,
    scenarioId: s.scenarioId,
    scenarioTitle: getMultilingualField(s.scenario.title, language),
    learningLanguage: s.learningLanguage,
    difficulty: s.difficulty,
    status: s.status,
    score: s.score,
    durationSec: s.duration,
    completed: s.completed,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
  }));

  const mappedGames = generatedGamesRows.map(mapGameToStoryListItem);

  const mappedPlays = storyPlayRows.map((p) => ({
    id: p.id,
    gameId: p.gameId,
    startedAt: p.startedAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
    score: p.score,
    gameStatus: p.game.status,
    titleDisplay:
      extractTitleFromGameData(p.game.gameData) ?? `Story ${p.gameId.slice(0, 8)}`,
  }));

  return {
    profile: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      learningLanguage: user.learningLanguage,
      nativeLanguage: user.nativeLanguage,
      learningLanguages: user.learningLanguages,
      level: user.level,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    progress,
    scenarioSessions: mappedSessions,
    scenarioSessionStats: {
      total: sessionCount,
      completed: completedSessionCount,
      totalDurationSec: durationSum._sum.duration ?? 0,
      averageScore: avgScoreAgg._avg.score ?? null,
    },
    generatedGames: mappedGames,
    generatedGamesTotal,
    storyPlays: mappedPlays,
    storyPlaysTotal,
    learnedWordsCount,
    recentLearnedWords: recentLearnedWords.map((w) => ({
      id: w.id,
      word: w.word,
      language: w.language,
      lastUsed: w.lastUsed.toISOString(),
      masteryLevel: w.masteryLevel,
    })),
    notifications: notificationsRows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    weeklyActivity,
  };
}
