import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import type {
  B2bAssignmentWhereInput,
  TransactionClient,
} from "../../../types/prisma-derived.js";
import { buildPagination, skipFor } from "../../b2b/shared/pagination.js";
import { assertModuleEnabled } from "../../b2b/quota-service.js";
import type {
  CreateAssignmentBody,
  ListAssignmentsQuery,
  UpdateAssignmentBody,
  UpdateProgressBody,
} from "./schemas.js";

const assignmentInclude = {
  module: { select: { id: true, key: true, name: true } },
  cohorts: { include: { cohort: { select: { id: true, name: true } } } },
  _count: { select: { progress: true } },
} as const;

type AssignmentRow = Awaited<
  ReturnType<typeof prisma.b2bAssignment.findFirstOrThrow<{ include: typeof assignmentInclude }>>
>;

function mapAssignment(row: AssignmentRow, doneCount = 0) {
  const total = row._count.progress;
  return {
    id: row.id,
    title: row.title,
    moduleId: row.moduleId,
    moduleKey: row.module.key,
    moduleName: (row.module.name ?? {}) as Record<string, string>,
    deadline: row.deadline.toISOString(),
    message: row.message,
    contentType: row.contentType,
    contentId: row.contentId,
    status: row.status,
    targetsAllCohorts: row.targetsAllCohorts,
    cohorts: row.cohorts.map((c) => c.cohort),
    learnersTotal: total,
    learnersDone: doneCount,
    completionPct: total > 0 ? Math.round((doneCount / total) * 100) : 0,
    createdAt: row.createdAt.toISOString(),
  };
}

async function resolveTargetCohortIds(
  companyId: string,
  cohortIds: string[],
  targetsAllCohorts: boolean
): Promise<string[]> {
  if (targetsAllCohorts) {
    const rows = await prisma.cohort.findMany({
      where: { companyId, status: { in: ["upcoming", "active"] } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const count = await prisma.cohort.count({ where: { companyId, id: { in: cohortIds } } });
  if (count !== cohortIds.length) throw httpError(400, "Unknown cohortId for this company");
  return cohortIds;
}

export async function listAssignments(companyId: string, params: ListAssignmentsQuery) {
  const where: B2bAssignmentWhereInput = { companyId };
  if (params.status) where.status = params.status;
  if (params.moduleId) where.moduleId = params.moduleId;
  if (params.cohortId) where.cohorts = { some: { cohortId: params.cohortId } };
  const q = params.search?.trim();
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.b2bAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { deadline: "desc" },
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.b2bAssignment.count({ where }),
  ]);

  const doneCounts = await prisma.assignmentProgress.groupBy({
    by: ["assignmentId"],
    where: { assignmentId: { in: rows.map((r) => r.id) }, status: "done" },
    _count: { _all: true },
  });
  const doneByAssignment = new Map(doneCounts.map((d) => [d.assignmentId, d._count._all]));

  return {
    assignments: rows.map((row) => mapAssignment(row, doneByAssignment.get(row.id) ?? 0)),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function getAssignmentDetail(companyId: string, assignmentId: string) {
  const row = await prisma.b2bAssignment.findFirst({
    where: { id: assignmentId, companyId },
    include: assignmentInclude,
  });
  if (!row) return null;

  // Les lignes de progression existent en base : plus de fabrication côté front.
  const progress = await prisma.assignmentProgress.findMany({
    where: { assignmentId },
    include: {
      learner: {
        select: { id: true, name: true, email: true, cohortId: true, cefrLevel: true },
      },
    },
    orderBy: { learner: { name: "asc" } },
  });

  const done = progress.filter((p) => p.status === "done").length;

  return {
    ...mapAssignment(row, done),
    learners: progress.map((p) => ({
      learnerId: p.learnerId,
      name: p.learner.name,
      email: p.learner.email,
      cohortId: p.learner.cohortId,
      cefrLevel: p.learner.cefrLevel,
      status: p.status,
      score: p.score,
      submittedAt: p.submittedAt?.toISOString() ?? null,
    })),
  };
}

export async function createAssignment(
  companyId: string,
  partnerUserId: string,
  body: CreateAssignmentBody
) {
  // Vérification serveur : le prototype ne masquait le module qu'à l'écran.
  await assertModuleEnabled(companyId, body.moduleId);

  const cohortIds = await resolveTargetCohortIds(
    companyId,
    body.cohortIds,
    body.targetsAllCohorts
  );
  if (cohortIds.length === 0) throw httpError(400, "Aucune cohorte cible");

  const learners = await prisma.companyLearner.findMany({
    where: { companyId, cohortId: { in: cohortIds } },
    select: { id: true },
  });

  const created = await prisma.$transaction(async (tx: TransactionClient) => {
    const assignment = await tx.b2bAssignment.create({
      data: {
        companyId,
        moduleId: body.moduleId,
        title: body.title,
        deadline: body.deadline,
        message: body.message || null,
        contentType: body.contentType ?? null,
        contentId: body.contentId ?? null,
        targetsAllCohorts: body.targetsAllCohorts,
        createdByPartnerUserId: partnerUserId,
        cohorts: { create: cohortIds.map((cohortId) => ({ cohortId })) },
      },
    });

    if (learners.length > 0) {
      await tx.assignmentProgress.createMany({
        data: learners.map((l) => ({ assignmentId: assignment.id, learnerId: l.id })),
        skipDuplicates: true,
      });
    }

    return assignment;
  });

  return getAssignmentDetail(companyId, created.id);
}

export async function updateAssignment(
  companyId: string,
  assignmentId: string,
  body: UpdateAssignmentBody
) {
  const current = await prisma.b2bAssignment.findFirst({
    where: { id: assignmentId, companyId },
  });
  if (!current) return null;

  // Changer de module reste soumis à l'activation côté entreprise.
  if (body.moduleId && body.moduleId !== current.moduleId) {
    await assertModuleEnabled(companyId, body.moduleId);
  }

  const cohortIds =
    body.cohortIds || body.targetsAllCohorts !== undefined
      ? await resolveTargetCohortIds(
          companyId,
          body.cohortIds ?? [],
          body.targetsAllCohorts ?? current.targetsAllCohorts
        )
      : null;

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.b2bAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(body.moduleId !== undefined ? { moduleId: body.moduleId } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.deadline !== undefined ? { deadline: body.deadline } : {}),
        ...(body.message !== undefined ? { message: body.message || null } : {}),
        ...(body.contentType !== undefined ? { contentType: body.contentType || null } : {}),
        ...(body.contentId !== undefined ? { contentId: body.contentId || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.targetsAllCohorts !== undefined
          ? { targetsAllCohorts: body.targetsAllCohorts }
          : {}),
      },
    });

    if (!cohortIds) return;

    await tx.assignmentCohort.deleteMany({
      where: { assignmentId, cohortId: { notIn: cohortIds } },
    });
    for (const cohortId of cohortIds) {
      await tx.assignmentCohort.upsert({
        where: { assignmentId_cohortId: { assignmentId, cohortId } },
        create: { assignmentId, cohortId },
        update: {},
      });
    }

    // Les nouveaux apprenants ciblés reçoivent leur ligne de progression.
    const learners = await tx.companyLearner.findMany({
      where: { companyId, cohortId: { in: cohortIds } },
      select: { id: true },
    });
    if (learners.length > 0) {
      await tx.assignmentProgress.createMany({
        data: learners.map((l) => ({ assignmentId, learnerId: l.id })),
        skipDuplicates: true,
      });
    }
  });

  return getAssignmentDetail(companyId, assignmentId);
}

export async function cancelAssignment(companyId: string, assignmentId: string) {
  const current = await prisma.b2bAssignment.findFirst({
    where: { id: assignmentId, companyId },
  });
  if (!current) return false;
  await prisma.b2bAssignment.update({
    where: { id: assignmentId },
    data: { status: "cancelled" },
  });
  return true;
}

export async function updateLearnerProgress(
  companyId: string,
  assignmentId: string,
  learnerId: string,
  body: UpdateProgressBody
) {
  const assignment = await prisma.b2bAssignment.findFirst({
    where: { id: assignmentId, companyId },
    select: { id: true },
  });
  if (!assignment) return null;

  const learner = await prisma.companyLearner.findFirst({
    where: { id: learnerId, companyId },
    select: { id: true },
  });
  if (!learner) return null;

  const row = await prisma.assignmentProgress.upsert({
    where: { assignmentId_learnerId: { assignmentId, learnerId } },
    create: {
      assignmentId,
      learnerId,
      status: body.status,
      score: body.score ?? null,
      submittedAt: body.status === "pending" ? null : new Date(),
    },
    update: {
      status: body.status,
      score: body.score ?? null,
      submittedAt: body.status === "pending" ? null : new Date(),
    },
  });

  return {
    assignmentId: row.assignmentId,
    learnerId: row.learnerId,
    status: row.status,
    score: row.score,
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}

/** Passe en `overdue` les devoirs actifs dont l'échéance est dépassée. */
export async function refreshOverdueAssignments(companyId?: string): Promise<number> {
  const now = new Date();
  const scope = companyId ? { companyId } : {};
  const [assignments, progress] = await Promise.all([
    prisma.b2bAssignment.updateMany({
      where: { ...scope, status: "active", deadline: { lt: now } },
      data: { status: "overdue" },
    }),
    prisma.assignmentProgress.updateMany({
      where: {
        status: "pending",
        assignment: { ...scope, deadline: { lt: now } },
      },
      data: { status: "late" },
    }),
  ]);
  return assignments.count + progress.count;
}
