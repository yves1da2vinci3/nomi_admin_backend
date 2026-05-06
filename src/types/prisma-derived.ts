/**
 * Point unique pour types Prisma (`ScenarioWhereInput`, etc.).
 * Le service métier importe depuis ce fichier — pas depuis `@prisma/client` directement.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type ScenarioWhereInput = Prisma.ScenarioWhereInput;
export type ScenarioInclude = Prisma.ScenarioInclude;
export type ScenarioGoalUpdateInput = Prisma.ScenarioGoalUpdateInput;
export type ScenarioVocabularyUpdateInput = Prisma.ScenarioVocabularyUpdateInput;

export type ScenarioBase = NonNullable<
  Awaited<ReturnType<typeof prisma.scenario.findUnique>>
>;

export type ScenarioGoalRow = NonNullable<
  Awaited<ReturnType<typeof prisma.scenarioGoal.findUnique>>
>;

export type ScenarioVocabRow = NonNullable<
  Awaited<ReturnType<typeof prisma.scenarioVocabulary.findUnique>>
>;

/** Row liste/détail avec includes optionnels pour `mapScenarioToApiItem`. */
export type ScenarioMappedSource = ScenarioBase & {
  _count?: { goals: number; vocabulary: number };
  goals?: ScenarioGoalRow[];
  vocabulary?: ScenarioVocabRow[];
};
