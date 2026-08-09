import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import type { CompanyLearnerWhereInput } from "../../../types/prisma-derived.js";
import { buildPagination, skipFor } from "../../b2b/shared/pagination.js";
import {
  assertCohortSeatsAvailable,
  assertSeatsAvailable,
  getCohortSeatsUsage,
  getSeatsUsage,
} from "../../b2b/quota-service.js";
import { remainingCapacity, splitByCapacity } from "../../b2b/quota-math.js";
import type {
  ImportLearnersBody,
  InviteLearnerBody,
  ListLearnersQuery,
  UpdateLearnerBody,
} from "./schemas.js";

const learnerInclude = {
  cohort: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      displayName: true,
      level: true,
      userProgress: {
        select: {
          averageScore: true,
          wordsLearned: true,
          totalTimeSpent: true,
          totalSessions: true,
        },
      },
    },
  },
} as const;

type LearnerRow = Awaited<
  ReturnType<typeof prisma.companyLearner.findFirstOrThrow<{ include: typeof learnerInclude }>>
>;

function mapLearner(row: LearnerRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    cohortId: row.cohortId,
    cohortName: row.cohort.name,
    cefrLevel: row.cefrLevel,
    status: row.status,
    invitedAt: row.invitedAt.toISOString(),
    enrolledAt: row.enrolledAt?.toISOString() ?? null,
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    // Renseigné une fois que la personne a créé son compte app Nomi.
    appUserId: row.userId,
    appLevel: row.user?.level ?? null,
    // Métriques app Nomi : nulles tant que le compte n'est pas lié.
    averageScore: row.user?.userProgress
      ? Math.round(row.user.userProgress.averageScore)
      : null,
    wordsLearned: row.user?.userProgress?.wordsLearned ?? null,
    totalMinutes: row.user?.userProgress?.totalTimeSpent ?? null,
    totalSessions: row.user?.userProgress?.totalSessions ?? null,
  };
}

/** Compteurs B2B par apprenant, en deux `groupBy` au lieu d'une requête par ligne. */
async function statsForLearners(learnerIds: string[]) {
  if (learnerIds.length === 0) {
    return new Map<
      string,
      { sessionsThisWeek: number; assignmentsDone: number; assignmentsTotal: number }
    >();
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [sessions, progress] = await Promise.all([
    prisma.moduleUsageEvent.groupBy({
      by: ["learnerId"],
      where: { learnerId: { in: learnerIds }, occurredAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.assignmentProgress.groupBy({
      by: ["learnerId", "status"],
      where: { learnerId: { in: learnerIds } },
      _count: { _all: true },
    }),
  ]);

  const out = new Map<
    string,
    { sessionsThisWeek: number; assignmentsDone: number; assignmentsTotal: number }
  >();
  const ensure = (id: string) => {
    const current = out.get(id) ?? {
      sessionsThisWeek: 0,
      assignmentsDone: 0,
      assignmentsTotal: 0,
    };
    out.set(id, current);
    return current;
  };

  for (const row of sessions) {
    if (!row.learnerId) continue;
    ensure(row.learnerId).sessionsThisWeek = row._count._all;
  }
  for (const row of progress) {
    if (!row.learnerId) continue;
    const entry = ensure(row.learnerId);
    entry.assignmentsTotal += row._count._all;
    if (row.status === "done") entry.assignmentsDone += row._count._all;
  }
  return out;
}

async function assertCohortInCompany(companyId: string, cohortId: string) {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, companyId },
    include: { _count: { select: { learners: true } } },
  });
  if (!cohort) throw httpError(404, "Cohort not found");
  return cohort;
}

export async function listLearners(companyId: string, params: ListLearnersQuery) {
  const where: CompanyLearnerWhereInput = { companyId };
  if (params.cohortId) where.cohortId = params.cohortId;
  if (params.status) where.status = params.status;
  const q = params.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.companyLearner.findMany({
      where,
      include: learnerInclude,
      orderBy: { name: "asc" },
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.companyLearner.count({ where }),
  ]);

  const stats = await statsForLearners(rows.map((r) => r.id));

  return {
    learners: rows.map((row) => ({
      ...mapLearner(row),
      ...(stats.get(row.id) ?? {
        sessionsThisWeek: 0,
        assignmentsDone: 0,
        assignmentsTotal: 0,
      }),
    })),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function getLearnerDetail(companyId: string, learnerId: string) {
  const learner = await prisma.companyLearner.findFirst({
    where: { id: learnerId, companyId },
    include: learnerInclude,
  });
  if (!learner) return null;

  const [progress, usage, certificates] = await Promise.all([
    prisma.assignmentProgress.findMany({
      where: { learnerId },
      include: {
        assignment: {
          include: { module: { select: { id: true, key: true } } },
        },
      },
      orderBy: { assignment: { deadline: "desc" } },
      take: 50,
    }),
    prisma.moduleUsageEvent.findMany({
      where: { learnerId },
      include: { module: { select: { id: true, key: true } } },
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
    prisma.companyCertificate.findMany({
      where: { learnerId },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  const scores = progress.filter((p) => p.score !== null).map((p) => p.score as number);

  return {
    ...mapLearner(learner),
    stats: {
      assignmentsTotal: progress.length,
      assignmentsDone: progress.filter((p) => p.status === "done").length,
      assignmentsLate: progress.filter((p) => p.status === "late").length,
      averageScore:
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      sessionsRecorded: usage.length,
    },
    assignments: progress.map((p) => ({
      assignmentId: p.assignmentId,
      title: p.assignment.title,
      moduleKey: p.assignment.module.key,
      deadline: p.assignment.deadline.toISOString(),
      status: p.status,
      score: p.score,
      submittedAt: p.submittedAt?.toISOString() ?? null,
    })),
    // Timeline issue de la base, plus des sessions importées d'un mock.
    timeline: usage.map((event) => ({
      id: event.id,
      moduleKey: event.module.key,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      occurredAt: event.occurredAt.toISOString(),
    })),
    certificates: certificates.map((c) => ({
      id: c.id,
      issuedAt: c.issuedAt.toISOString(),
      averageScore: c.averageScore,
      status: c.status,
    })),
  };
}

export async function inviteLearner(companyId: string, body: InviteLearnerBody) {
  await assertCohortInCompany(companyId, body.cohortId);
  // Le prototype ne vérifiait les sièges qu'à l'import CSV.
  await assertSeatsAvailable(companyId, 1);
  await assertCohortSeatsAvailable(companyId, body.cohortId, 1);

  const existing = await prisma.companyLearner.findFirst({
    where: { companyId, email: body.email },
  });
  if (existing) throw httpError(409, `Apprenant déjà invité : ${body.email}`);

  const appUser = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true },
  });

  const created = await prisma.companyLearner.create({
    data: {
      companyId,
      cohortId: body.cohortId,
      email: body.email,
      name: body.name,
      cefrLevel: body.cefrLevel ?? null,
      userId: appUser?.id ?? null,
      status: appUser ? "inactive" : "never",
      enrolledAt: appUser ? new Date() : null,
    },
    include: learnerInclude,
  });
  return mapLearner(created);
}

export type ImportResult = {
  imported: number;
  skipped: { email: string; reason: string }[];
  seats: Awaited<ReturnType<typeof getSeatsUsage>>;
};

export async function importLearners(
  companyId: string,
  body: ImportLearnersBody
): Promise<ImportResult> {
  await assertCohortInCompany(companyId, body.cohortId);

  const emails = body.learners.map((l) => l.email);
  const alreadyThere = await prisma.companyLearner.findMany({
    where: { companyId, email: { in: emails } },
    select: { email: true },
  });
  const known = new Set(alreadyThere.map((l) => l.email));

  const skipped = body.learners
    .filter((l) => known.has(l.email))
    .map((l) => ({ email: l.email, reason: "déjà invité" }));
  const toCreate = body.learners.filter((l) => !known.has(l.email));

  if (toCreate.length === 0) {
    return { imported: 0, skipped, seats: await getSeatsUsage(companyId) };
  }

  const [usage, cohortUsage] = await Promise.all([
    getSeatsUsage(companyId),
    getCohortSeatsUsage(companyId, body.cohortId),
  ]);
  const companyCapacity = remainingCapacity(usage.seatLimit, usage.seatsUsed);
  const cohortCapacity = cohortUsage.seatsAvailable;
  // La contrainte la plus stricte des deux plafonds décide, et nomme le refus.
  const capacity =
    companyCapacity === null
      ? cohortCapacity
      : cohortCapacity === null
        ? companyCapacity
        : Math.min(companyCapacity, cohortCapacity);
  const reason =
    capacity !== null && capacity === cohortCapacity && capacity !== companyCapacity
      ? "places de la cohorte épuisées"
      : "quota de sièges atteint";

  const { accepted, rejected } = splitByCapacity(toCreate, capacity);
  for (const entry of rejected) {
    skipped.push({ email: entry.email, reason });
  }

  if (accepted.length > 0) {
    const appUsers = await prisma.user.findMany({
      where: { email: { in: accepted.map((l) => l.email) } },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(appUsers.map((u) => [u.email, u.id]));

    await prisma.companyLearner.createMany({
      data: accepted.map((l) => {
        const userId = userByEmail.get(l.email) ?? null;
        return {
          companyId,
          cohortId: body.cohortId,
          email: l.email,
          name: l.name,
          cefrLevel: l.cefrLevel ?? null,
          userId,
          status: userId ? ("inactive" as const) : ("never" as const),
          enrolledAt: userId ? new Date() : null,
        };
      }),
      skipDuplicates: true,
    });
  }

  return {
    imported: accepted.length,
    skipped,
    seats: await getSeatsUsage(companyId),
  };
}

export async function updateLearner(
  companyId: string,
  learnerId: string,
  body: UpdateLearnerBody
) {
  const current = await prisma.companyLearner.findFirst({ where: { id: learnerId, companyId } });
  if (!current) return null;
  if (body.cohortId) {
    await assertCohortInCompany(companyId, body.cohortId);
    // Un déplacement consomme une place dans la cohorte d'arrivée.
    if (body.cohortId !== current.cohortId) {
      await assertCohortSeatsAvailable(companyId, body.cohortId, 1);
    }
  }

  // Changer l'email relie l'apprenant à un autre compte app (ou à aucun).
  let relink: { email: string; userId: string | null } | null = null;
  if (body.email !== undefined && body.email !== current.email) {
    const duplicate = await prisma.companyLearner.findFirst({
      where: { companyId, email: body.email, id: { not: learnerId } },
    });
    if (duplicate) throw httpError(409, `Cet email est déjà inscrit : ${body.email}`);
    const appUser = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    relink = { email: body.email, userId: appUser?.id ?? null };
  }

  const updated = await prisma.companyLearner.update({
    where: { id: learnerId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(relink ? { email: relink.email, userId: relink.userId } : {}),
      ...(body.cohortId !== undefined ? { cohortId: body.cohortId } : {}),
      ...(body.cefrLevel !== undefined ? { cefrLevel: body.cefrLevel || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: learnerInclude,
  });
  return mapLearner(updated);
}

/** Libère le siège occupé par l'apprenant. */
export async function removeLearner(companyId: string, learnerId: string) {
  const current = await prisma.companyLearner.findFirst({ where: { id: learnerId, companyId } });
  if (!current) return false;
  await prisma.companyLearner.delete({ where: { id: learnerId } });
  return true;
}

export async function listInactiveLearners(companyId: string, days: number) {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.companyLearner.findMany({
    where: {
      companyId,
      OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: threshold } }],
    },
    include: learnerInclude,
    orderBy: [{ lastActivityAt: "asc" }, { name: "asc" }],
  });

  return {
    days,
    learners: rows.map((row) => ({
      ...mapLearner(row),
      inactiveDays: row.lastActivityAt
        ? Math.floor((Date.now() - row.lastActivityAt.getTime()) / (24 * 60 * 60 * 1000))
        : null,
    })),
  };
}
