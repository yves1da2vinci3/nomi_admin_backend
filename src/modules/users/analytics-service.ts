import { prisma } from "../../lib/prisma.js";

const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type UsersAnalyticsMetric = "signups" | "sessions";

export async function getUsersAnalyticsSummary(
  months: number,
  metric: UsersAnalyticsMetric
): Promise<{
  metric: UsersAnalyticsMetric;
  monthlyActivity: { month: string; label: string; count: number }[];
  levelDistribution: { level: string; count: number }[];
}> {
  const n = Math.min(Math.max(months, 1), 36);
  const now = new Date();

  const monthlyActivity: { month: string; label: string; count: number }[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const monthKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = MONTH_LABELS[start.getUTCMonth()] ?? "?";

    let count: number;
    if (metric === "sessions") {
      count = await prisma.scenarioSession.count({
        where: { createdAt: { gte: start, lt: end } },
      });
    } else {
      count = await prisma.user.count({
        where: { createdAt: { gte: start, lt: end } },
      });
    }

    monthlyActivity.push({ month: monthKey, label, count });
  }

  const levelRows = await prisma.user.groupBy({
    by: ["level"],
    _count: { level: true },
  });

  return {
    metric,
    monthlyActivity,
    levelDistribution: levelRows.map((r) => ({
      level: r.level ?? "unknown",
      count: r._count.level,
    })),
  };
}
