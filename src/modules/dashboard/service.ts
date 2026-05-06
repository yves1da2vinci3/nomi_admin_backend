import { prisma } from "../../lib/prisma.js";

function parseDays(input: unknown, fallback = 30): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 365);
}

export type DashboardMetrics = {
  period: { days: number; since: string };
  users: { total: number; new: number };
  scenarios: {
    total: number;
    active: number;
    sessionsTotal: number;
    sessionsCompleted: number;
    completionRate: number;
  };
  storiesAudio: { total: number; ready: number; failed: number };
  interactiveReview: {
    gamesTotal: number;
    gamesCompleted: number;
    completionRate: number;
    byUser: Array<{
      userId: string;
      gamesCreated: number;
      displayName: string | null;
      email: string | null;
    }>;
  };
  diary: { notificationsEmitted: number; notificationsTotal: number };
  difficultyDistribution: Array<{ level: string; count: number }>;
};

export async function getDashboardMetrics(queryDays: unknown): Promise<DashboardMetrics> {
  const days = parseDays(queryDays, 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersNew,
    scenarioSessionsTotal,
    scenarioSessionsCompleted,
    scenariosActive,
    scenariosTotal,
    gamesTotal,
    gamesCompleted,
    storiesTotal,
    storiesReady,
    storiesFailed,
    notificationsTotal,
    diaryNotifications,
    difficultyRows,
    topUsersByGames,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.scenarioSession.count({ where: { createdAt: { gte: since } } }),
    prisma.scenarioSession.count({
      where: { createdAt: { gte: since }, completed: true },
    }),
    prisma.scenario.count({ where: { isActive: true } }),
    prisma.scenario.count(),
    prisma.generatedGame.count({ where: { createdAt: { gte: since } } }),
    prisma.generatedGame.count({
      where: {
        createdAt: { gte: since },
        OR: [{ status: "ready" }, { status: "completed" }],
      },
    }),
    prisma.generatedGame.count({
      where: { createdAt: { gte: since }, gameType: "story" },
    }),
    prisma.generatedGame.count({
      where: {
        createdAt: { gte: since },
        gameType: "story",
        status: "ready",
      },
    }),
    prisma.generatedGame.count({
      where: {
        createdAt: { gte: since },
        gameType: "story",
        status: "failed",
      },
    }),
    prisma.notification.count({ where: { createdAt: { gte: since } } }),
    prisma.notification.count({
      where: { createdAt: { gte: since }, type: { contains: "diary" } },
    }),
    prisma.user.groupBy({
      by: ["level"],
      _count: { level: true },
    }),
    prisma.generatedGame.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 25,
    }),
  ]);

  const reviewCompletionRate = gamesTotal > 0 ? gamesCompleted / gamesTotal : 0;
  const scenarioCompletionRate =
    scenarioSessionsTotal > 0 ? scenarioSessionsCompleted / scenarioSessionsTotal : 0;

  const topUserIds = topUsersByGames.map((r) => r.userId);
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, displayName: true, email: true },
  });
  const userMap = new Map(topUsers.map((u) => [u.id, u]));

  return {
    period: { days, since: since.toISOString() },
    users: {
      total: usersTotal,
      new: usersNew,
    },
    scenarios: {
      total: scenariosTotal,
      active: scenariosActive,
      sessionsTotal: scenarioSessionsTotal,
      sessionsCompleted: scenarioSessionsCompleted,
      completionRate: scenarioCompletionRate,
    },
    storiesAudio: {
      total: storiesTotal,
      ready: storiesReady,
      failed: storiesFailed,
    },
    interactiveReview: {
      gamesTotal,
      gamesCompleted,
      completionRate: reviewCompletionRate,
      byUser: topUsersByGames.map((r) => ({
        userId: r.userId,
        gamesCreated: r._count.userId,
        displayName: userMap.get(r.userId)?.displayName ?? null,
        email: userMap.get(r.userId)?.email ?? null,
      })),
    },
    diary: {
      notificationsEmitted: diaryNotifications,
      notificationsTotal,
    },
    difficultyDistribution: difficultyRows.map((r) => ({
      level: r.level ?? "unknown",
      count: r._count.level,
    })),
  };
}
