import { prisma } from "../../lib/prisma.js";
import { getMultilingualField } from "../scenarios/utils.js";
import { mapGameToStoryListItem } from "../generated-games/service.js";

function extractOverallScore(feedback: unknown): number | null {
  if (!feedback || typeof feedback !== "object") return null;
  const f = feedback as Record<string, unknown>;
  const raw = f.overallScore ?? f.total;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function durationSecondsBetween(startedAt: Date, completedAt: Date | null): number {
  if (!completedAt) return 0;
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
}

function levelTargets(level: string | null): { targetSessions: number; minScoreRequired: number } {
  if (level === "Intermediate") return { targetSessions: 30, minScoreRequired: 85 };
  if (level === "Advanced") return { targetSessions: 50, minScoreRequired: 90 };
  return { targetSessions: 15, minScoreRequired: 75 };
}

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
  interpreter: {
    completedRuns: number;
    totalPracticeDurationSeconds: number;
    averageScore: number | null;
    bestScore: number | null;
    lastPlayed: string | null;
  };
  listening: {
    playsCompleted: number;
  };
  games: {
    total: number;
    byType: { gameType: string; status: string; count: number }[];
  };
  diary: {
    totalDurationSeconds: number;
    averageWordScore: number | null;
  };
  levelProgress: {
    level: string;
    targetSessions: number;
    minScoreRequired: number;
    progress: number;
  };
  vocabSummary: {
    total: number;
    masteryBuckets: { low: number; medium: number; high: number };
    bySource: { vocabularySource: string; count: number }[];
    byLexicalBand: { lexicalBand: string; count: number }[];
  };
  stages: { language: string; lexicalStage: string }[];
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
    interpreterRuns,
    legacyInterpreterSessions,
    listeningPlaysCompleted,
    gamesByTypeStatus,
    vocabMasteryLow,
    vocabMasteryMedium,
    vocabMasteryHigh,
    vocabBySource,
    vocabByLexicalBand,
    stagesRows,
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
    prisma.interpreterPracticeRun.findMany({
      where: { userId, status: "completed", completedAt: { not: null } },
      select: { startedAt: true, completedAt: true, feedback: true },
    }),
    prisma.interpreterSession.findMany({
      where: { userId, completed: true, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true, feedback: true },
    }),
    prisma.storyPlay.count({ where: { userId, completedAt: { not: null } } }),
    prisma.generatedGame.groupBy({
      by: ["gameType", "status"],
      where: { userId, gameType: { not: "story" } },
      _count: { _all: true },
    }),
    prisma.learnedWord.count({ where: { userId, masteryLevel: { lt: 0.3 } } }),
    prisma.learnedWord.count({ where: { userId, masteryLevel: { gte: 0.3, lt: 0.7 } } }),
    prisma.learnedWord.count({ where: { userId, masteryLevel: { gte: 0.7 } } }),
    prisma.learnedWord.groupBy({
      by: ["vocabularySource"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.learnedWord.groupBy({
      by: ["lexicalBand"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.userLanguageLexicalStage.findMany({
      where: { userId },
      select: { languageCode: true, lexicalStage: true },
    }),
  ]);

  let diaryTotalDurationSeconds = 0;
  let diaryAverageWordScore: number | null = null;
  try {
    const nomiCoreUrl = (process.env.NOMI_CORE_URL || "http://localhost:8088").replace(/\/+$/, "");
    const voiceRes = await fetch(
      `${nomiCoreUrl}/v1/diary/voice-stats?user_id=${encodeURIComponent(user.uid)}`
    );
    if (voiceRes.ok) {
      const voiceJson = (await voiceRes.json()) as {
        total_duration_ms?: unknown;
        average_word_score?: unknown;
      };
      const ms = Math.max(0, Math.floor(Number(voiceJson?.total_duration_ms) || 0));
      diaryTotalDurationSeconds = Math.floor(ms / 1000);
      const rawAvg = voiceJson?.average_word_score;
      if (typeof rawAvg === "number" && !Number.isNaN(rawAvg)) {
        diaryAverageWordScore = Math.round(Math.min(100, Math.max(0, rawAvg)) * 10) / 10;
      }
    }
  } catch {
    /* nomi-core unreachable — diary stats omitted, rest of the detail still returns */
  }

  let interpreterDurationSeconds = 0;
  const interpreterScores: number[] = [];
  let interpreterLastPlayed: Date | null = null;
  for (const run of [...interpreterRuns, ...legacyInterpreterSessions]) {
    interpreterDurationSeconds += durationSecondsBetween(run.startedAt, run.completedAt);
    const score = extractOverallScore(run.feedback);
    if (score != null) interpreterScores.push(score);
    if (run.completedAt && (!interpreterLastPlayed || run.completedAt > interpreterLastPlayed)) {
      interpreterLastPlayed = run.completedAt;
    }
  }
  const interpreterAverageScore =
    interpreterScores.length > 0
      ? Math.round((interpreterScores.reduce((a, b) => a + b, 0) / interpreterScores.length) * 10) / 10
      : null;
  const interpreterBestScore =
    interpreterScores.length > 0 ? Math.round(Math.max(...interpreterScores)) : null;

  const { targetSessions, minScoreRequired } = levelTargets(user.level);
  const completedForProgress = progressRow?.completedSessions ?? 0;
  const bestScoreForProgress = progressRow?.bestScore ?? 0;
  const sessionProgress = Math.min(completedForProgress / targetSessions, 1);
  const scoreProgress =
    bestScoreForProgress >= minScoreRequired ? 1 : bestScoreForProgress / minScoreRequired;

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
    interpreter: {
      completedRuns: interpreterRuns.length + legacyInterpreterSessions.length,
      totalPracticeDurationSeconds: interpreterDurationSeconds,
      averageScore: interpreterAverageScore,
      bestScore: interpreterBestScore,
      lastPlayed: interpreterLastPlayed?.toISOString() ?? null,
    },
    listening: {
      playsCompleted: listeningPlaysCompleted,
    },
    games: {
      total: generatedGamesTotal,
      byType: gamesByTypeStatus.map((r) => ({
        gameType: r.gameType,
        status: r.status,
        count: r._count._all,
      })),
    },
    diary: {
      totalDurationSeconds: diaryTotalDurationSeconds,
      averageWordScore: diaryAverageWordScore,
    },
    levelProgress: {
      level: user.level ?? "Beginner",
      targetSessions,
      minScoreRequired,
      progress: Math.round(Math.min(sessionProgress, scoreProgress) * 100) / 100,
    },
    vocabSummary: {
      total: learnedWordsCount,
      masteryBuckets: { low: vocabMasteryLow, medium: vocabMasteryMedium, high: vocabMasteryHigh },
      bySource: vocabBySource.map((r) => ({
        vocabularySource: r.vocabularySource,
        count: r._count._all,
      })),
      byLexicalBand: vocabByLexicalBand.map((r) => ({
        lexicalBand: r.lexicalBand,
        count: r._count._all,
      })),
    },
    stages: stagesRows.map((r) => ({ language: r.languageCode, lexicalStage: r.lexicalStage })),
  };
}
