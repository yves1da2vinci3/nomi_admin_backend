import { prisma } from "../../lib/prisma.js";
import { getMultilingualField } from "../scenarios/utils.js";

function durationSecondsBetween(startedAt: Date, completedAt: Date | null): number {
  if (!completedAt) return 0;
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
}

function averageObjectiveScore(scoresPerObjective: unknown): number | null {
  if (!scoresPerObjective || typeof scoresPerObjective !== "object") return null;
  const values = Object.values(scoresPerObjective as Record<string, unknown>);
  const scores = values
    .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>).score : null))
    .map((n) => (typeof n === "number" ? n : Number(n)))
    .filter((n) => Number.isFinite(n));
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function extractOverallScore(feedback: unknown): number | null {
  if (!feedback || typeof feedback !== "object") return null;
  const f = feedback as Record<string, unknown>;
  const raw = f.overallScore ?? f.total;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

export async function listInterpreterSessions(params: {
  scenarioId?: string;
  userId?: string;
  status?: string;
  skip: number;
  take: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.scenarioId) where.scenarioId = params.scenarioId;
  if (params.userId) where.userId = params.userId;
  if (params.status) where.status = params.status;

  const [rows, total] = await Promise.all([
    prisma.interpreterSession.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { startedAt: "desc" },
      include: { scenario: true, user: true },
    }),
    prisma.interpreterSession.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((s) => ({
      id: s.id,
      userId: s.userId,
      user: s.user.displayName || s.user.email,
      scenarioId: s.scenarioId,
      scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
      learningLanguage: s.learningLanguage,
      status: s.status,
      completed: s.completed,
      score: averageObjectiveScore(s.scoresPerObjective),
      durationSec: durationSecondsBetween(s.startedAt, s.completedAt),
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function getInterpreterSessionDetail(id: string) {
  const s = await prisma.interpreterSession.findUnique({
    where: { id },
    include: { scenario: true, user: true, messages: { orderBy: { step: "asc" } } },
  });
  if (!s) return null;
  return {
    id: s.id,
    userId: s.userId,
    user: s.user.displayName || s.user.email,
    scenarioId: s.scenarioId,
    scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
    learningLanguage: s.learningLanguage,
    nativeLanguage: s.nativeLanguage,
    status: s.status,
    completed: s.completed,
    score: averageObjectiveScore(s.scoresPerObjective),
    durationSec: durationSecondsBetween(s.startedAt, s.completedAt),
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    feedback: s.feedback,
    llmEval: s.llmEval,
    vocabularySpotlight: s.vocabularySpotlight,
    transcript: s.messages.map((m) => ({
      id: m.id,
      role: m.type === "user" ? "user" : "npc",
      speaker: m.speaker,
      content: m.content,
      step: m.step,
      timestamp: m.timestamp.toISOString(),
    })),
  };
}

export async function listPracticeRuns(params: {
  scenarioId?: string;
  userId?: string;
  status?: string;
  skip: number;
  take: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.scenarioId) where.practice = { scenarioId: params.scenarioId };
  if (params.userId) where.userId = params.userId;
  if (params.status) where.status = params.status;

  const [rows, total] = await Promise.all([
    prisma.interpreterPracticeRun.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { startedAt: "desc" },
      include: { practice: { include: { scenario: true } }, user: true },
    }),
    prisma.interpreterPracticeRun.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: r.user.displayName || r.user.email,
      practiceId: r.practiceId,
      scenarioId: r.practice.scenarioId,
      scenarioTitle: getMultilingualField(r.practice.scenario.title, "fr"),
      status: r.status,
      score: extractOverallScore(r.feedback),
      durationSec: durationSecondsBetween(r.startedAt, r.completedAt),
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      errorMessage: r.errorMessage,
    })),
  };
}

export async function getPracticeRunDetail(id: string) {
  const r = await prisma.interpreterPracticeRun.findUnique({
    where: { id },
    include: {
      practice: { include: { scenario: true } },
      user: true,
      segments: { orderBy: [{ roundIndex: "asc" }, { segmentInRound: "asc" }] },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    user: r.user.displayName || r.user.email,
    practiceId: r.practiceId,
    scenarioId: r.practice.scenarioId,
    scenarioTitle: getMultilingualField(r.practice.scenario.title, "fr"),
    status: r.status,
    score: extractOverallScore(r.feedback),
    durationSec: durationSecondsBetween(r.startedAt, r.completedAt),
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    feedback: r.feedback,
    errorMessage: r.errorMessage,
    segments: r.segments.map((s) => ({
      id: s.id,
      roundIndex: s.roundIndex,
      segmentInRound: s.segmentInRound,
      pnjSpeech: s.pnjSpeech,
      objectiveTitle: s.objectiveTitle,
      userTranscript: s.userTranscript,
      sttStatus: s.sttStatus,
      scores: s.scores,
    })),
  };
}

const PASS_THRESHOLD = 70;

export async function getScenarioAnalytics(scenarioId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [sessions, runs] = await Promise.all([
    prisma.interpreterSession.findMany({
      where: { scenarioId, startedAt: { gte: since } },
      select: { userId: true, startedAt: true, completedAt: true, scoresPerObjective: true, completed: true },
    }),
    prisma.interpreterPracticeRun.findMany({
      where: { practice: { scenarioId }, startedAt: { gte: since } },
      select: { userId: true, startedAt: true, completedAt: true, feedback: true, status: true },
    }),
  ]);

  type Entry = { userId: string; startedAt: Date; completedAt: Date | null; score: number | null };
  const entries: Entry[] = [
    ...sessions.map((s) => ({
      userId: s.userId,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      score: averageObjectiveScore(s.scoresPerObjective),
    })),
    ...runs.map((r) => ({
      userId: r.userId,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      score: extractOverallScore(r.feedback),
    })),
  ];

  const totalSessions = entries.length;
  const durations = entries
    .filter((e) => e.completedAt)
    .map((e) => durationSecondsBetween(e.startedAt, e.completedAt));
  const avgDurationSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const scored = entries.filter((e) => e.score != null) as (Entry & { score: number })[];
  const passRate = scored.length
    ? scored.filter((e) => e.score >= PASS_THRESHOLD).length / scored.length
    : 0;

  const byUser = new Map<string, number>();
  for (const e of entries) byUser.set(e.userId, (byUser.get(e.userId) ?? 0) + 1);
  const totalRepeats = [...byUser.values()].filter((c) => c > 1).length;

  const dayBuckets = new Map<string, { sessions: number; scored: number; passed: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets.set(d.toISOString().slice(0, 10), { sessions: 0, scored: 0, passed: 0 });
  }
  for (const e of entries) {
    const key = e.startedAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    bucket.sessions += 1;
    if (e.score != null) {
      bucket.scored += 1;
      if (e.score >= PASS_THRESHOLD) bucket.passed += 1;
    }
  }

  const daily = [...dayBuckets.entries()].map(([day, b]) => ({
    day,
    sessions: b.sessions,
    successRate: b.scored > 0 ? Math.round((b.passed / b.scored) * 100) : 0,
  }));

  return {
    totalSessions,
    avgDurationSec,
    passRate: Math.round(passRate * 100) / 100,
    totalRepeats,
    daily,
  };
}
