import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import type { B2bModuleWhereInput } from "../../../types/prisma-derived.js";
import { buildPagination, skipFor } from "../shared/pagination.js";
import type { CreateModuleBody, ListModulesQuery, UpdateModuleBody } from "./schemas.js";

type ModuleUsageCounts = {
  packItems: number;
  assignments: number;
  learningPathWeeks: number;
  entitlementCredits: number;
  usageEvents: number;
};

type ModuleRowWithCounts = {
  id: string;
  key: string;
  name: unknown;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: ModuleUsageCounts;
};

function mapModule(row: ModuleRowWithCounts) {
  return {
    id: row.id,
    key: row.key,
    name: (row.name ?? {}) as Record<string, string>,
    icon: row.icon,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    usage: row._count
      ? {
          packs: row._count.packItems,
          assignments: row._count.assignments,
          learningPathWeeks: row._count.learningPathWeeks,
          entitlementCredits: row._count.entitlementCredits,
          usageEvents: row._count.usageEvents,
        }
      : undefined,
  };
}

const countSelect = {
  select: {
    packItems: true,
    assignments: true,
    learningPathWeeks: true,
    entitlementCredits: true,
    usageEvents: true,
  },
} as const;

export async function listModules(params: ListModulesQuery) {
  const where: B2bModuleWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  const q = params.search?.trim();
  if (q) where.key = { contains: q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.b2bModule.findMany({
      where,
      include: { _count: countSelect },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.b2bModule.count({ where }),
  ]);

  return {
    modules: rows.map(mapModule),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function getModuleById(id: string) {
  const row = await prisma.b2bModule.findUnique({
    where: { id },
    include: { _count: countSelect },
  });
  return row ? mapModule(row) : null;
}

export async function createModule(body: CreateModuleBody) {
  const existing = await prisma.b2bModule.findUnique({ where: { key: body.key } });
  if (existing) throw httpError(409, `Module key already used: ${body.key}`);

  const created = await prisma.b2bModule.create({
    data: {
      key: body.key,
      name: body.name,
      icon: body.icon ?? null,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    },
    include: { _count: countSelect },
  });
  return mapModule(created);
}

export async function updateModule(id: string, body: UpdateModuleBody) {
  const current = await prisma.b2bModule.findUnique({ where: { id } });
  if (!current) return null;

  if (body.key && body.key !== current.key) {
    const clash = await prisma.b2bModule.findUnique({ where: { key: body.key } });
    if (clash) throw httpError(409, `Module key already used: ${body.key}`);
  }

  const updated = await prisma.b2bModule.update({
    where: { id },
    data: {
      ...(body.key !== undefined ? { key: body.key } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
    include: { _count: countSelect },
  });
  return mapModule(updated);
}

/**
 * Suppression refusée dès qu'un module est référencé : désactiver
 * (`isActive: false`) plutôt que supprimer une fois en production.
 */
export async function deleteModule(id: string) {
  const row = await prisma.b2bModule.findUnique({
    where: { id },
    include: { _count: countSelect },
  });
  if (!row) return false;

  const counts = row._count;
  const referenced =
    counts.packItems + counts.assignments + counts.learningPathWeeks + counts.usageEvents;
  if (referenced > 0) {
    throw httpError(
      409,
      "Module référencé (packs, devoirs, parcours ou consommation) — le désactiver au lieu de le supprimer"
    );
  }

  await prisma.b2bModule.delete({ where: { id } });
  return true;
}
