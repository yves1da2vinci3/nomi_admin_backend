import { prisma } from "../../../lib/prisma.js";
import { getEnabledModules } from "../../b2b/quota-service.js";

/**
 * Catalogue vu par le partenaire : packs actifs + état d'acquisition et crédits
 * réels (le prototype affichait un total de 300 codé en dur).
 */
export async function getCatalog(companyId: string) {
  const now = new Date();
  const [packs, entitlements, enabledModules] = await Promise.all([
    prisma.modulePack.findMany({
      where: { isActive: true },
      include: {
        items: { include: { module: { select: { id: true, key: true, name: true } } } },
      },
      orderBy: [{ tier: "asc" }, { priceFcfa: "asc" }],
    }),
    prisma.companyEntitlement.findMany({
      where: { companyId },
      select: {
        id: true,
        packId: true,
        status: true,
        purchasedAt: true,
        expiresAt: true,
        credits: { include: { module: { select: { id: true, key: true } } } },
      },
      orderBy: { purchasedAt: "desc" },
    }),
    getEnabledModules(companyId),
  ]);

  const activeByPack = new Map(
    entitlements
      .filter(
        (e) => e.status === "active" && (!e.expiresAt || e.expiresAt.getTime() > now.getTime())
      )
      .map((e) => [e.packId, e])
  );

  return {
    packs: packs.map((pack) => {
      const owned = activeByPack.get(pack.id);
      return {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        tagline: pack.tagline,
        tier: pack.tier,
        billingPeriod: pack.billingPeriod,
        priceFcfa: pack.priceFcfa,
        priceUsd: pack.priceUsdCents / 100,
        badge: pack.badge,
        features: pack.features,
        modules: pack.items.map((item) => ({
          moduleId: item.moduleId,
          key: item.module.key,
          name: (item.module.name ?? {}) as Record<string, string>,
          sessionCredits: item.sessionCredits,
        })),
        owned: Boolean(owned),
        expiresAt: owned?.expiresAt?.toISOString() ?? null,
      };
    }),
    entitlements: entitlements.map((ent) => ({
      id: ent.id,
      packId: ent.packId,
      status: ent.status,
      purchasedAt: ent.purchasedAt.toISOString(),
      expiresAt: ent.expiresAt?.toISOString() ?? null,
      credits: ent.credits.map((c) => ({
        moduleId: c.moduleId,
        moduleKey: c.module.key,
        creditsRemaining: c.creditsRemaining,
      })),
    })),
    enabledModules,
    creditsTotal: enabledModules.reduce((sum, m) => sum + m.creditsRemaining, 0),
  };
}

export async function listOrders(companyId: string) {
  const rows = await prisma.purchaseOrder.findMany({
    where: { companyId },
    include: { pack: { select: { id: true, slug: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    pack: row.pack,
    amountFcfa: row.amountFcfa,
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripeSessionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
