/**
 * Logique pure du balayage d'usage : correspondance source -> module B2B,
 * calcul du curseur et rattachement d'un événement à un devoir. Aucune requête
 * ici, pour rester testable sans base.
 */

/** Clés de `B2bModule` seedées par `scripts/seed-b2b.ts`. */
export const MODULE_KEYS = [
  "scenario",
  "diary",
  "interpreter",
  "listening_story",
  "review_game",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** `sourceType` de `ModuleUsageEvent` — l'unicité `[sourceType, sourceId]` en dépend. */
export const SOURCE_TYPES = [
  "scenario_session",
  "diary_entry",
  "interpreter_session",
  "story_play",
  "game_play",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type SourceDefinition = {
  sourceType: SourceType;
  moduleKey: ModuleKey;
  /** Libellé lisible dans le rapport d'ingestion. */
  label: string;
};

export const SOURCE_DEFINITIONS: readonly SourceDefinition[] = [
  { sourceType: "scenario_session", moduleKey: "scenario", label: "Sessions scénario" },
  { sourceType: "diary_entry", moduleKey: "diary", label: "Entrées de journal" },
  { sourceType: "interpreter_session", moduleKey: "interpreter", label: "Sessions interprète" },
  { sourceType: "story_play", moduleKey: "listening_story", label: "Écoutes d'histoire" },
  { sourceType: "game_play", moduleKey: "review_game", label: "Parties de révision" },
] as const;

/** Recouvrement du curseur : une session finalisée en retard reste captée. */
export const DEFAULT_OVERLAP_MS = 60 * 60 * 1000;

/** Première ingestion : on ne remonte pas plus loin que cette fenêtre. */
export const DEFAULT_BOOTSTRAP_DAYS = 90;

/**
 * Borne basse du balayage. Le rejeu d'une fenêtre déjà traitée est sans effet
 * (`consumeCredit` est idempotent sur `[sourceType, sourceId]`), donc on préfère
 * relire un peu trop que rater une ligne.
 */
export function cursorFrom(
  lastEventAt: Date | null,
  now: Date = new Date(),
  options: { overlapMs?: number; bootstrapDays?: number } = {}
): Date {
  const overlapMs = options.overlapMs ?? DEFAULT_OVERLAP_MS;
  const bootstrapDays = options.bootstrapDays ?? DEFAULT_BOOTSTRAP_DAYS;
  const bootstrap = new Date(now.getTime() - bootstrapDays * 24 * 60 * 60 * 1000);

  if (!lastEventAt) return bootstrap;

  const withOverlap = new Date(lastEventAt.getTime() - overlapMs);
  return withOverlap.getTime() < bootstrap.getTime() ? bootstrap : withOverlap;
}

export type UsageEventCandidate = {
  sourceType: SourceType;
  sourceId: string;
  moduleId: string;
  learnerId: string;
  companyId: string;
  occurredAt: Date;
  score: number | null;
  /** Contenu travaillé (scénario, histoire, jeu) quand la source en désigne un. */
  contentId: string | null;
};

export type AssignmentCandidate = {
  id: string;
  moduleId: string;
  status: string;
  /** `null` = n'importe quel contenu du module valide le devoir. */
  contentId: string | null;
};

/**
 * Un usage valide un devoir s'il porte sur le même module, que le devoir est
 * encore ouvert, et que le contenu ciblé correspond — un devoir sans contenu
 * précis accepte toute session du module.
 */
export function matchesAssignment(
  event: Pick<UsageEventCandidate, "moduleId" | "contentId">,
  assignment: AssignmentCandidate
): boolean {
  if (assignment.moduleId !== event.moduleId) return false;
  if (assignment.status !== "active" && assignment.status !== "overdue") return false;
  if (assignment.contentId === null) return true;
  return assignment.contentId === event.contentId;
}

/** Premier jour du mois courant, en UTC — borne de remise à zéro de `apiUsedMonth`. */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
