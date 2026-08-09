import { prisma } from "../../../lib/prisma.js";

/** Détail d'une cohorte avec KPI réels (aucune valeur simulée). */
export async function getCohortDetail(companyId: string, cohortId: string) {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, companyId },
    include: {
      _count: { select: { learners: true } },
      instructors: {
        include: { partnerUser: { select: { id: true, email: true, displayName: true } } },
      },
    },
  });
  if (!cohort) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeLast7d, learners, assignmentLinks, progressRows] = await Promise.all([
    prisma.companyLearner.count({
      where: { cohortId, lastActivityAt: { gte: sevenDaysAgo } },
    }),
    prisma.companyLearner.findMany({
      where: { cohortId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        cefrLevel: true,
        lastActivityAt: true,
        enrolledAt: true,
      },
    }),
    prisma.assignmentCohort.findMany({
      where: { cohortId },
      include: {
        assignment: {
          include: { module: { select: { id: true, key: true, name: true } } },
        },
      },
      orderBy: { assignment: { deadline: "desc" } },
    }),
    prisma.assignmentProgress.groupBy({
      by: ["status"],
      where: { learner: { cohortId } },
      _count: { _all: true },
    }),
  ]);

  const done = progressRows.find((r) => r.status === "done")?._count._all ?? 0;
  const totalProgress = progressRows.reduce((sum, r) => sum + r._count._all, 0);

  return {
    id: cohort.id,
    name: cohort.name,
    inviteCode: cohort.inviteCode,
    startDate: cohort.startDate.toISOString(),
    endDate: cohort.endDate.toISOString(),
    seatLimit: cohort.seatLimit,
    status: cohort.status,
    enrolled: cohort._count.learners,
    activeLast7d,
    assignmentCompletionPct: totalProgress > 0 ? Math.round((done / totalProgress) * 100) : 0,
    instructors: cohort.instructors.map((i) => ({
      id: i.partnerUser.id,
      email: i.partnerUser.email,
      displayName: i.partnerUser.displayName,
    })),
    learners: learners.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      status: l.status,
      cefrLevel: l.cefrLevel,
      lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
      enrolledAt: l.enrolledAt?.toISOString() ?? null,
    })),
    assignments: assignmentLinks.map((link) => ({
      id: link.assignment.id,
      title: link.assignment.title,
      moduleId: link.assignment.moduleId,
      moduleKey: link.assignment.module.key,
      deadline: link.assignment.deadline.toISOString(),
      status: link.assignment.status,
    })),
  };
}
