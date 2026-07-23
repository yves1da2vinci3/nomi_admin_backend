import { prisma } from "../../lib/prisma.js";
import { getMultilingualField } from "../scenarios/utils.js";

type SessionType = "scenario" | "interpreter";

export type SessionListRow = {
  id: string;
  type: SessionType;
  userId: string;
  user: string;
  scenarioId: string;
  scenarioTitle: string;
  learningLanguage: string;
  difficulty: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  score: number | null;
  durationSec: number;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
};

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

export async function listSessions(params: {
  type: SessionType;
  skip: number;
  take: number;
  userId?: string;
  status?: string;
  language?: string;
}): Promise<{ rows: SessionListRow[]; total: number }> {
  const { type, skip, take, userId, status, language } = params;

  if (type === "scenario") {
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (language) where.learningLanguage = language;

    const [rows, total] = await Promise.all([
      prisma.scenarioSession.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: "desc" },
        include: { scenario: true, user: true },
      }),
      prisma.scenarioSession.count({ where }),
    ]);

    return {
      total,
      rows: rows.map((s) => ({
        id: s.id,
        type: "scenario" as const,
        userId: s.userId,
        user: s.user.displayName || s.user.email,
        scenarioId: s.scenarioId,
        scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
        learningLanguage: s.learningLanguage,
        difficulty: s.difficulty,
        status: s.status,
        currentStep: s.currentStep,
        totalSteps: s.totalSteps,
        score: s.score,
        durationSec: s.duration,
        completed: s.completed,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    };
  }

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (language) where.learningLanguage = language;

  const [rows, total] = await Promise.all([
    prisma.interpreterSession.findMany({
      where,
      skip,
      take,
      orderBy: { startedAt: "desc" },
      include: { scenario: true, user: true },
    }),
    prisma.interpreterSession.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((s) => ({
      id: s.id,
      type: "interpreter" as const,
      userId: s.userId,
      user: s.user.displayName || s.user.email,
      scenarioId: s.scenarioId,
      scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
      learningLanguage: s.learningLanguage,
      difficulty: s.scenario.difficulty,
      status: s.status,
      currentStep: Object.keys((s.scoresPerObjective as Record<string, unknown>) ?? {}).length,
      totalSteps: s.totalObjectives,
      score: averageObjectiveScore(s.scoresPerObjective),
      durationSec: durationSecondsBetween(s.startedAt, s.completedAt),
      completed: s.completed,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
  };
}

export type SessionDetail = SessionListRow & {
  nativeLanguage: string;
  transcript: {
    id: string;
    role: "user" | "ai" | "npc";
    content: string;
    step: number;
    timestamp: string;
    corrections: {
      id: string;
      wrong: string;
      correction: string;
      reason: string | null;
      errorType: string | null;
      confidence: number | null;
      severity: number;
    }[];
  }[];
  feedback: unknown;
};

export async function getSessionDetail(
  id: string,
  type: SessionType
): Promise<SessionDetail | null> {
  if (type === "scenario") {
    const s = await prisma.scenarioSession.findUnique({
      where: { id },
      include: {
        scenario: true,
        user: true,
        messages: { orderBy: { step: "asc" }, include: { corrections: true } },
      },
    });
    if (!s) return null;

    return {
      id: s.id,
      type: "scenario",
      userId: s.userId,
      user: s.user.displayName || s.user.email,
      scenarioId: s.scenarioId,
      scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
      learningLanguage: s.learningLanguage,
      nativeLanguage: s.nativeLanguage,
      difficulty: s.difficulty,
      status: s.status,
      currentStep: s.currentStep,
      totalSteps: s.totalSteps,
      score: s.score,
      durationSec: s.duration,
      completed: s.completed,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      transcript: s.messages.map((m) => ({
        id: m.id,
        role: m.type === "user" ? "user" : m.type === "ai" ? "ai" : "npc",
        content: m.content,
        step: m.step,
        timestamp: m.timestamp.toISOString(),
        corrections: m.corrections.map((c) => ({
          id: c.id,
          wrong: c.wrong,
          correction: c.correction,
          reason: c.reason,
          errorType: c.errorType,
          confidence: c.confidence,
          severity: c.severity,
        })),
      })),
      feedback: null,
    };
  }

  const s = await prisma.interpreterSession.findUnique({
    where: { id },
    include: {
      scenario: true,
      user: true,
      messages: { orderBy: { step: "asc" } },
    },
  });
  if (!s) return null;

  return {
    id: s.id,
    type: "interpreter",
    userId: s.userId,
    user: s.user.displayName || s.user.email,
    scenarioId: s.scenarioId,
    scenarioTitle: getMultilingualField(s.scenario.title, "fr"),
    learningLanguage: s.learningLanguage,
    nativeLanguage: s.nativeLanguage,
    difficulty: s.scenario.difficulty,
    status: s.status,
    currentStep: Object.keys((s.scoresPerObjective as Record<string, unknown>) ?? {}).length,
    totalSteps: s.totalObjectives,
    score: averageObjectiveScore(s.scoresPerObjective),
    durationSec: durationSecondsBetween(s.startedAt, s.completedAt),
    completed: s.completed,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    transcript: s.messages.map((m) => ({
      id: m.id,
      role: m.type === "user" ? "user" : "npc",
      content: m.content,
      step: m.step,
      timestamp: m.timestamp.toISOString(),
      corrections: [],
    })),
    feedback: s.feedback,
  };
}
