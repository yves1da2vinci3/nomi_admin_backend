import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import type { ModulePackWhereInput } from "../../../types/prisma-derived.js";
import { buildPagination, skipFor } from "../shared/pagination.js";
import type { CreatePackBody, ListPacksQuery, PackItemInput, UpdatePackBody } from "./schemas.js";

const packInclude = {
  items: {
    include: { module: { select: { id: true, key: true, name: true } } },
    orderBy: { module: { sortOrder: "asc" } },
  },
  _count: { select: { entitlements: true, purchaseOrders: true } },
} as const;

type PackWithItems = Awaited<
  ReturnType<typeof prisma.modulePack.findFirstOrThrow<{ include: typeof packInclude }>>
>;

function mapPack(row: PackWithItems) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    tier: row.tier,
    billingPeriod: row.billingPeriod,
    priceFcfa: row.priceFcfa,
    priceUsdCents: row.priceUsdCents,
    // Exposé en dollars pour l'UI ; la source de vérité reste en centimes.
    priceUsd: row.priceUsdCents / 100,
    badge: row.badge,
    features: row.features,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      id: item.id,
      moduleId: item.moduleId,
      moduleKey: item.module.key,
      moduleName: (item.module.name ?? {}) as Record<string, string>,
      sessionCredits: item.sessionCredits,
    })),
    usage: {
      entitlements: row._count.entitlements,
      purchaseOrders: row._count.purchaseOrders,
    },
  };
}

async function assertModulesExist(items: PackItemInput[]) {
  const moduleIds = [...new Set(items.map((i) => i.moduleId))];
  const found = await prisma.b2bModule.count({ where: { id: { in: moduleIds } } });
  if (found !== moduleIds.length) throw httpError(400, "Unknown moduleId in items");
}

export async function listPacks(params: ListPacksQuery) {
  const where: ModulePackWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.tier) where.tier = params.tier;
  const q = params.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.modulePack.findMany({
      where,
      include: packInclude,
      orderBy: [{ tier: "asc" }, { priceFcfa: "asc" }],
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.modulePack.count({ where }),
  ]);

  return {
    packs: rows.map(mapPack),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function getPackById(id: string) {
  const row = await prisma.modulePack.findUnique({ where: { id }, include: packInclude });
  return row ? mapPack(row) : null;
}

export async function createPack(body: CreatePackBody) {
  const existing = await prisma.modulePack.findUnique({ where: { slug: body.slug } });
  if (existing) throw httpError(409, `Pack slug already used: ${body.slug}`);
  await assertModulesExist(body.items);

  const created = await prisma.modulePack.create({
    data: {
      slug: body.slug,
      name: body.name,
      tagline: body.tagline ?? null,
      tier: body.tier,
      billingPeriod: body.billingPeriod,
      priceFcfa: body.priceFcfa,
      priceUsdCents: body.priceUsdCents,
      badge: body.badge ?? null,
      features: body.features,
      isActive: body.isActive,
      items: {
        create: body.items.map((item) => ({
          moduleId: item.moduleId,
          sessionCredits: item.sessionCredits,
        })),
      },
    },
    include: packInclude,
  });
  return mapPack(created);
}

export async function updatePack(id: string, body: UpdatePackBody) {
  const current = await prisma.modulePack.findUnique({ where: { id } });
  if (!current) return null;

  if (body.slug && body.slug !== current.slug) {
    const clash = await prisma.modulePack.findUnique({ where: { slug: body.slug } });
    if (clash) throw httpError(409, `Pack slug already used: ${body.slug}`);
  }
  if (body.items) await assertModulesExist(body.items);

  await prisma.$transaction(async (tx) => {
    await tx.modulePack.update({
      where: { id },
      data: {
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
        ...(body.tier !== undefined ? { tier: body.tier } : {}),
        ...(body.billingPeriod !== undefined ? { billingPeriod: body.billingPeriod } : {}),
        ...(body.priceFcfa !== undefined ? { priceFcfa: body.priceFcfa } : {}),
        ...(body.priceUsdCents !== undefined ? { priceUsdCents: body.priceUsdCents } : {}),
        ...(body.badge !== undefined ? { badge: body.badge } : {}),
        ...(body.features !== undefined ? { features: body.features } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    if (!body.items) return;

    // Diff des lignes : upsert des modules fournis, suppression des retirés.
    const keptModuleIds = body.items.map((i) => i.moduleId);
    await tx.modulePackItem.deleteMany({
      where: { packId: id, moduleId: { notIn: keptModuleIds } },
    });
    for (const item of body.items) {
      await tx.modulePackItem.upsert({
        where: { packId_moduleId: { packId: id, moduleId: item.moduleId } },
        create: { packId: id, moduleId: item.moduleId, sessionCredits: item.sessionCredits },
        update: { sessionCredits: item.sessionCredits },
      });
    }
  });

  return getPackById(id);
}

export async function deletePack(id: string) {
  const row = await prisma.modulePack.findUnique({
    where: { id },
    include: { _count: { select: { entitlements: true, purchaseOrders: true } } },
  });
  if (!row) return false;

  if (row._count.entitlements > 0 || row._count.purchaseOrders > 0) {
    throw httpError(
      409,
      "Pack déjà vendu ou octroyé (entitlements / commandes) — le désactiver au lieu de le supprimer"
    );
  }

  await prisma.modulePack.delete({ where: { id } });
  return true;
}
