import { prisma } from "../../../lib/prisma.js";
import { consumeCredit } from "../quota-service.js";
import {
  cursorFrom,
  matchesAssignment,
  SOURCE_DEFINITIONS,
  startOfMonthUtc,
  type AssignmentCandidate,
  type ModuleKey,
  type SourceType,
  type UsageEventCandidate,
} from "./matching.js";

/**
 * Balayage d'usage B2B.
 *
 * Les cinq sources ne sont pas écrites par le même service : `ScenarioSession`,
 * `InterpreterSession`, `StoryPlay` et `GamePlay` viennent de `nomi_backend`,
 * `diary_entries` d'un service externe (Go). Plutôt que d'injecter la logique de
 * quotas dans chacun, on relit périodiquement les lignes terminées : la clé
 * unique `[sourceType, sourceId]` de `ModuleUsageEvent` rend le rejeu inoffensif.
 */

export type SourceReport = {
  sourceType: SourceType;
  label: string;
  /** Lignes terminées lues après le curseur. */
  scanned: number;
  /** Lignes rattachées à un apprenant B2B. */
  matched: number;
  consumed: number;
  alreadyRecorded: number;
  noCredits: number;
  /** `null` quand le module n'existe pas encore en base (seed non joué). */
  moduleId: string | null;
};

export type IngestReport = {
  startedAt: string;
  durationMs: number;
  perSource: SourceReport[];
  learnersTouched: number;
  assignmentsCompleted: number;
};

export type IngestOptions = {
  /** Force la borne basse au lieu du curseur calculé. */
  since?: Date;
  /** Plafond de lignes lues par source, garde-fou du rattrapage. */
  limit?: number;
};

const DEFAULT_LIMIT = 2000;

/** Dernier événement enregistré pour cette source, base du curseur. */
async function lastEventAt(sourceType: SourceType): Promise<Date | null> {
  const row = await prisma.moduleUsageEvent.findFirst({
    where: { sourceType },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  return row?.occurredAt ?? null;
}

type LearnerRef = { id: string; companyId: string; lastActivityAt: Date | null };

/** `userId` -> apprenant B2B. Les utilisateurs hors B2B sont simplement absents. */
async function learnersByUserId(userIds: string[]): Promise<Map<string, LearnerRef>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.companyLearner.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, companyId: true, userId: true, lastActivityAt: true },
  });
  const map = new Map<string, LearnerRef>();
  for (const row of rows) {
    if (row.userId) {
      map.set(row.userId, {
        id: row.id,
        companyId: row.companyId,
        lastActivityAt: row.lastActivityAt,
      });
    }
  }
  return map;
}

type RawRow = {
  sourceId: string;
  userId: string | null;
  occurredAt: Date;
  score: number | null;
  contentId: string | null;
};

/** Lecture des lignes terminées d'une source, du plus ancien au plus récent. */
async function readSource(
  sourceType: SourceType,
  since: Date,
  limit: number
): Promise<RawRow[]> {
  switch (sourceType) {
    case "scenario_session": {
      const rows = await prisma.scenarioSession.findMany({
        where: { completed: true, completedAt: { gte: since } },
        select: { id: true, userId: true, completedAt: true, score: true, scenarioId: true },
        orderBy: { completedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        sourceId: r.id,
        userId: r.userId,
        occurredAt: r.completedAt ?? since,
        score: r.score,
        contentId: r.scenarioId,
      }));
    }
    case "interpreter_session": {
      const rows = await prisma.interpreterSession.findMany({
        where: { completed: true, completedAt: { gte: since } },
        select: { id: true, userId: true, completedAt: true, scenarioId: true },
        orderBy: { completedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        sourceId: r.id,
        userId: r.userId,
        occurredAt: r.completedAt ?? since,
        score: null,
        contentId: r.scenarioId,
      }));
    }
    case "story_play": {
      const rows = await prisma.storyPlay.findMany({
        where: { completedAt: { gte: since } },
        select: { id: true, userId: true, completedAt: true, score: true, gameId: true },
        orderBy: { completedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        sourceId: r.id,
        userId: r.userId,
        occurredAt: r.completedAt ?? since,
        score: r.score,
        contentId: r.gameId,
      }));
    }
    case "game_play": {
      const rows = await prisma.gamePlay.findMany({
        where: { completedAt: { gte: since } },
        select: { id: true, userId: true, completedAt: true, score: true, gameId: true },
        orderBy: { completedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        sourceId: r.id,
        userId: r.userId,
        occurredAt: r.completedAt,
        score: r.score,
        contentId: r.gameId,
      }));
    }
    case "diary_entry": {
      // `completed` est le seul état terminal écrit par nomi-core
      // (internal/storage/repo.go), et `updatedAt` porte l'instant de fin.
      const rows = await prisma.externalDiaryEntry.findMany({
        where: { status: "completed", updatedAt: { gte: since } },
        select: { id: true, userId: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        sourceId: r.id,
        userId: r.userId,
        occurredAt: r.updatedAt,
        score: null,
        contentId: null,
      }));
    }
  }
}

/** Devoirs ouverts d'une entreprise, chargés une fois par passage. */
async function openAssignments(companyId: string): Promise<AssignmentCandidate[]> {
  const rows = await prisma.b2bAssignment.findMany({
    where: { companyId, status: { in: ["active", "overdue"] } },
    select: { id: true, moduleId: true, status: true, contentId: true },
  });
  return rows;
}

/**
 * Marque `done` les progressions encore ouvertes des devoirs validés par cet
 * usage. Les lignes existent déjà : elles sont créées en masse à la création et
 * à la mise à jour du devoir.
 */
async function completeAssignments(
  event: UsageEventCandidate,
  assignments: AssignmentCandidate[]
): Promise<number> {
  const targets = assignments.filter((a) => matchesAssignment(event, a)).map((a) => a.id);
  if (targets.length === 0) return 0;

  const result = await prisma.assignmentProgress.updateMany({
    where: {
      assignmentId: { in: targets },
      learnerId: event.learnerId,
      status: { in: ["pending", "late"] },
    },
    data: {
      status: "done",
      submittedAt: event.occurredAt,
      ...(event.score !== null ? { score: event.score } : {}),
    },
  });
  return result.count;
}

export async function ingestUsage(options: IngestOptions = {}): Promise<IngestReport> {
  const startedAt = new Date();
  const limit = options.limit ?? DEFAULT_LIMIT;

  const modules = await prisma.b2bModule.findMany({ select: { id: true, key: true } });
  const moduleIdByKey = new Map<string, string>(modules.map((m) => [m.key, m.id]));

  const perSource: SourceReport[] = [];
  const touchedLearners = new Set<string>();
  const assignmentsByCompany = new Map<string, AssignmentCandidate[]>();
  let assignmentsCompleted = 0;

  for (const def of SOURCE_DEFINITIONS) {
    const moduleId = moduleIdByKey.get(def.moduleKey as ModuleKey) ?? null;
    const report: SourceReport = {
      sourceType: def.sourceType,
      label: def.label,
      scanned: 0,
      matched: 0,
      consumed: 0,
      alreadyRecorded: 0,
      noCredits: 0,
      moduleId,
    };
    perSource.push(report);
    if (!moduleId) continue;

    const since = options.since ?? cursorFrom(await lastEventAt(def.sourceType), startedAt);
    const rows = await readSource(def.sourceType, since, limit);
    report.scanned = rows.length;
    if (rows.length === 0) continue;

    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
    const learners = await learnersByUserId(userIds);

    for (const row of rows) {
      if (!row.userId) continue;
      const learner = learners.get(row.userId);
      if (!learner) continue;
      report.matched += 1;

      const event: UsageEventCandidate = {
        sourceType: def.sourceType,
        sourceId: row.sourceId,
        moduleId,
        learnerId: learner.id,
        companyId: learner.companyId,
        occurredAt: row.occurredAt,
        score: row.score,
        contentId: row.contentId,
      };

      const outcome = await consumeCredit({
        companyId: event.companyId,
        moduleId: event.moduleId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        learnerId: event.learnerId,
        occurredAt: event.occurredAt,
      });

      if (outcome.consumed) {
        report.consumed += 1;
        await prisma.company.update({
          where: { id: event.companyId },
          data: { apiUsedMonth: { increment: 1 } },
        });
      } else if (outcome.reason === "already_recorded") {
        report.alreadyRecorded += 1;
        // Déjà comptabilisé : ne pas retoucher activité ni devoirs.
        continue;
      } else {
        report.noCredits += 1;
      }

      if (!learner.lastActivityAt || learner.lastActivityAt < event.occurredAt) {
        await prisma.companyLearner.update({
          where: { id: learner.id },
          data: { lastActivityAt: event.occurredAt },
        });
        learner.lastActivityAt = event.occurredAt;
      }
      touchedLearners.add(learner.id);

      if (!assignmentsByCompany.has(event.companyId)) {
        assignmentsByCompany.set(event.companyId, await openAssignments(event.companyId));
      }
      assignmentsCompleted += await completeAssignments(
        event,
        assignmentsByCompany.get(event.companyId) ?? []
      );
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    perSource,
    learnersTouched: touchedLearners.size,
    assignmentsCompleted,
  };
}

/**
 * Remet `apiUsedMonth` à zéro pour le mois en cours. Le compteur est alimenté
 * par `ingestUsage`, donc il ne doit être remis à zéro qu'une fois par mois :
 * on se base sur la présence d'un usage antérieur au mois courant.
 */
export async function resetMonthlyApiUsage(now: Date = new Date()): Promise<number> {
  const monthStart = startOfMonthUtc(now);
  const companies = await prisma.company.findMany({
    where: { apiUsedMonth: { gt: 0 } },
    select: { id: true },
  });

  let reset = 0;
  for (const company of companies) {
    const usedThisMonth = await prisma.moduleUsageEvent.count({
      where: { companyId: company.id, occurredAt: { gte: monthStart } },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: { apiUsedMonth: usedThisMonth },
    });
    reset += 1;
  }
  return reset;
}
