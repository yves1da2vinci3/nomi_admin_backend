import { prisma } from "../../lib/prisma.js";
import type {
  ScenarioGoalRow,
  ScenarioInclude,
  ScenarioMappedSource,
  ScenarioVocabRow,
  ScenarioWhereInput,
  ScenarioGoalUpdateInput,
  ScenarioVocabularyUpdateInput,
} from "../../types/prisma-derived.js";
import { getMultilingualField } from "./utils.js";

function scenarioIncludeForList(
  includeGoals: boolean,
  includeVocabulary: boolean
): ScenarioInclude {
  const inc: ScenarioInclude = {
    _count: { select: { goals: true, vocabulary: true } },
  };
  if (includeGoals) {
    inc.goals = { where: { isActive: true }, orderBy: { order: "asc" } };
  }
  if (includeVocabulary) {
    inc.vocabulary = {
      orderBy: [{ category: "asc" }, { difficulty: "asc" }],
    };
  }
  return inc;
}

export type ScenarioApiListItem = {
  id: string;
  title: string;
  description: string;
  pnjRole: string;
  pnjPersonality: string;
  pnjTone: string;
  location: string;
  theme: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { goals: number; vocabulary: number };
  goals?: ReturnType<typeof mapGoal>[];
  vocabulary?: ReturnType<typeof mapVocab>[];
};

function mapGoal(g: ScenarioGoalRow, lang: string) {
  return {
    id: g.id,
    scenarioId: g.scenarioId,
    title: getMultilingualField(g.title, lang),
    description: getMultilingualField(g.description, lang),
    order: g.order,
    expectedWords: g.expectedWords,
    expectedPhrases: g.expectedPhrases,
    minWords: g.minWords,
    requiredWords: g.requiredWords,
    optionalWords: g.optionalWords,
    successMessage: getMultilingualField(g.successMessage, lang),
    failureMessage: getMultilingualField(g.failureMessage, lang),
    isActive: g.isActive,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

function mapVocab(v: ScenarioVocabRow, lang: string) {
  return {
    id: v.id,
    scenarioId: v.scenarioId,
    word: v.word,
    translation: getMultilingualField(v.translation, lang),
    category: v.category,
    difficulty: v.difficulty,
    context: v.context,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function mapScenarioToApiItem(
  scenario: ScenarioMappedSource,
  language: string,
  includeGoals?: boolean,
  includeVocabulary?: boolean
): ScenarioApiListItem {
  const base: ScenarioApiListItem = {
    id: scenario.id,
    title: getMultilingualField(scenario.title, language),
    description: getMultilingualField(scenario.description, language),
    pnjRole: scenario.pnjRole,
    pnjPersonality: scenario.pnjPersonality,
    pnjTone: scenario.pnjTone,
    location: scenario.location,
    theme: scenario.theme,
    imageUrl: scenario.imageUrl,
    isActive: scenario.isActive,
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString(),
  };
  if (scenario._count) base._count = scenario._count;
  if (includeGoals && scenario.goals) {
    base.goals = scenario.goals.map((g: ScenarioGoalRow) => mapGoal(g, language));
  }
  if (includeVocabulary && scenario.vocabulary) {
    base.vocabulary = scenario.vocabulary.map((v: ScenarioVocabRow) =>
      mapVocab(v, language)
    );
  }
  return base;
}

export async function listScenarios(params: {
  page: number;
  limit: number;
  theme?: string;
  search?: string;
  isActive?: boolean;
  language: string;
  includeGoals: boolean;
  includeVocabulary: boolean;
}) {
  const skip = (params.page - 1) * params.limit;
  const where: ScenarioWhereInput = {};
  if (params.theme) where.theme = params.theme;
  if (params.isActive !== undefined) where.isActive = params.isActive;
  const q = params.search?.trim();
  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { theme: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { pnjRole: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const include = scenarioIncludeForList(
    params.includeGoals,
    params.includeVocabulary
  );

  const [rows, total] = await Promise.all([
    prisma.scenario.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.limit,
    }),
    prisma.scenario.count({ where }),
  ]);

  return {
    scenarios: rows.map((s: ScenarioMappedSource) =>
      mapScenarioToApiItem(s, params.language, params.includeGoals, params.includeVocabulary)
    ),
    pagination: {
      currentPage: params.page,
      totalPages: Math.ceil(total / params.limit) || 1,
      totalItems: total,
      itemsPerPage: params.limit,
      hasNextPage: params.page < Math.ceil(total / params.limit),
      hasPrevPage: params.page > 1,
    },
  };
}

export async function getScenarioById(
  id: string,
  language: string,
  includeGoals: boolean,
  includeVocabulary: boolean
) {
  const include = scenarioIncludeForList(includeGoals, includeVocabulary);
  const s = await prisma.scenario.findUnique({
    where: { id },
    include,
  });
  return s
    ? mapScenarioToApiItem(s, language, includeGoals, includeVocabulary)
    : null;
}

export async function createScenarioRaw(data: {
  title: Record<string, string>;
  description: Record<string, string>;
  pnjRole: string;
  pnjPersonality: string;
  pnjTone: string;
  location: string;
  theme: string;
  imageUrl?: string | null;
  isActive?: boolean;
}) {
  return prisma.scenario.create({
    data: {
      title: data.title,
      description: data.description,
      pnjRole: data.pnjRole,
      pnjPersonality: data.pnjPersonality,
      pnjTone: data.pnjTone,
      location: data.location,
      theme: data.theme,
      imageUrl: data.imageUrl ?? undefined,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateScenarioRaw(
  id: string,
  patch: Partial<{
    title: Record<string, string>;
    description: Record<string, string>;
    pnjRole: string;
    pnjPersonality: string;
    pnjTone: string;
    location: string;
    theme: string;
    imageUrl: string | null;
    isActive: boolean;
  }>
) {
  return prisma.scenario.update({ where: { id }, data: patch });
}

export async function deleteScenarioRaw(id: string) {
  return prisma.scenario.delete({ where: { id } });
}

export async function createGoalRaw(
  scenarioId: string,
  body: {
    title: Record<string, string>;
    description: Record<string, string>;
    order: number;
    expectedWords: unknown;
    expectedPhrases: unknown;
    minWords?: number;
    requiredWords: unknown;
    optionalWords: unknown;
    successMessage: Record<string, string>;
    failureMessage: Record<string, string>;
    isActive?: boolean;
  }
) {
  return prisma.scenarioGoal.create({
    data: {
      scenarioId,
      title: body.title,
      description: body.description,
      order: body.order,
      expectedWords: body.expectedWords as object,
      expectedPhrases: body.expectedPhrases as object,
      minWords: body.minWords ?? 1,
      requiredWords: body.requiredWords as object,
      optionalWords: body.optionalWords as object,
      successMessage: body.successMessage,
      failureMessage: body.failureMessage,
      isActive: body.isActive ?? true,
    },
  });
}

export async function updateGoalRaw(
  goalId: string,
  patch: Record<string, unknown>
) {
  return prisma.scenarioGoal.update({
    where: { id: goalId },
    data: patch as ScenarioGoalUpdateInput,
  });
}

export async function deleteGoalRaw(goalId: string) {
  return prisma.scenarioGoal.delete({ where: { id: goalId } });
}

export async function createVocabRaw(
  scenarioId: string,
  body: {
    word: string;
    translation: Record<string, string>;
    category: string;
    difficulty?: number;
    context?: string | null;
  }
) {
  return prisma.scenarioVocabulary.create({
    data: {
      scenarioId,
      word: body.word,
      translation: body.translation,
      category: body.category,
      difficulty: body.difficulty ?? 1,
      context: body.context ?? undefined,
    },
  });
}

export async function updateVocabRaw(
  vocabId: string,
  patch: Record<string, unknown>
) {
  return prisma.scenarioVocabulary.update({
    where: { id: vocabId },
    data: patch as ScenarioVocabularyUpdateInput,
  });
}

export async function deleteVocabRaw(vocabId: string) {
  return prisma.scenarioVocabulary.delete({ where: { id: vocabId } });
}
