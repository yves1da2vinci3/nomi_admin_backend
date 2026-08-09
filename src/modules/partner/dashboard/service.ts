import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { getEnabledModules, getSeatsUsage } from "../../b2b/quota-service.js";

function startOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * KPI du portail, tous calculés en base. La courbe d'activité vient des
 * `ModuleUsageEvent` réels (le prototype générait une série pseudo-aléatoire).
 */
export async function getDashboard(companyId: string, days = 14, cohortId?: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, plan: true, apiQuotaMonth: true, apiUsedMonth: true, renewalDate: true },
  });
  if (!company) throw httpError(404, "Company not found");

  const since = startOfDayUtc(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Filtre cohorte optionnel : mêmes KPI restreints à une promotion.
  const learnerScope = { companyId, ...(cohortId ? { cohortId } : {}) };
  const assignmentScope = {
    companyId,
    ...(cohortId ? { cohorts: { some: { cohortId } } } : {}),
  };

  const [seats, modules, activeLast7d, cohortCount, assignmentStats, progressStats, events] =
    await Promise.all([
      getSeatsUsage(companyId),
      getEnabledModules(companyId),
      prisma.companyLearner.count({
        where: { ...learnerScope, lastActivityAt: { gte: sevenDaysAgo } },
      }),
      prisma.cohort.count({
        where: { companyId, status: "active", ...(cohortId ? { id: cohortId } : {}) },
      }),
      prisma.b2bAssignment.groupBy({
        by: ["status"],
        where: assignmentScope,
        _count: { _all: true },
      }),
      prisma.assignmentProgress.groupBy({
        by: ["status"],
        where: { assignment: assignmentScope },
        _count: { _all: true },
      }),
      prisma.moduleUsageEvent.findMany({
        where: {
          companyId,
          occurredAt: { gte: since },
          ...(cohortId ? { learner: { cohortId } } : {}),
        },
        select: { occurredAt: true, moduleId: true },
      }),
    ]);

  const learnersTotal = cohortId
    ? await prisma.companyLearner.count({ where: learnerScope })
    : seats.seatsUsed;

  const perDay = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    perDay.set(day.toISOString().slice(0, 10), 0);
  }
  for (const event of events) {
    const key = event.occurredAt.toISOString().slice(0, 10);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const doneCount = progressStats.find((p) => p.status === "done")?._count._all ?? 0;
  const progressTotal = progressStats.reduce((sum, p) => sum + p._count._all, 0);

  return {
    company: {
      name: company.name,
      plan: company.plan,
      renewalDate: company.renewalDate?.toISOString() ?? null,
    },
    seats,
    api: {
      quotaMonth: company.apiQuotaMonth,
      usedMonth: company.apiUsedMonth,
      usagePct:
        company.apiQuotaMonth > 0
          ? Math.round((company.apiUsedMonth / company.apiQuotaMonth) * 100)
          : 0,
    },
    learners: {
      total: learnersTotal,
      activeLast7d,
      inactiveLast7d: Math.max(0, learnersTotal - activeLast7d),
    },
    activeCohorts: cohortCount,
    assignments: {
      active: assignmentStats.find((a) => a.status === "active")?._count._all ?? 0,
      overdue: assignmentStats.find((a) => a.status === "overdue")?._count._all ?? 0,
      completed: assignmentStats.find((a) => a.status === "completed")?._count._all ?? 0,
      completionPct: progressTotal > 0 ? Math.round((doneCount / progressTotal) * 100) : 0,
    },
    modules,
    creditsTotal: modules.reduce((sum, m) => sum + m.creditsRemaining, 0),
    activitySeries: [...perDay.entries()].map(([date, sessions]) => ({ date, sessions })),
  };
}
