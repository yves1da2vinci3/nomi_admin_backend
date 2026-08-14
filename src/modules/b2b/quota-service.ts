import { prisma } from "../../lib/prisma.js";
import { httpError } from "../../lib/http-error.js";
import type { TransactionClient } from "../../types/prisma-derived.js";
import {
  computeSeatsUsage,
  defaultExpiryFor,
  exceedsSeats,
  laterOf,
  planCreditDebit,
  remainingCapacity,
} from "./quota-math.js";

export type SeatsUsage = {
  seatLimit: number;
  seatsUsed: number;
  seatsAvailable: number;
  usagePct: number;
};

/**
 * `seatsUsed` n'est jamais stocké : il se recompte pour éviter la
 * désynchronisation qu'avait le prototype front.
 */
export async function getSeatsUsage(companyId: string): Promise<SeatsUsage> {
  const [company, seatsUsed] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { seatLimit: true } }),
    prisma.companyLearner.count({ where: { companyId } }),
  ]);
  if (!company) throw httpError(404, "Company not found");

  return computeSeatsUsage(company.seatLimit, seatsUsed);
}

/** Refuse l'ajout de `count` apprenants si le quota de sièges est dépassé. */
export async function assertSeatsAvailable(companyId: string, count = 1): Promise<SeatsUsage> {
  const usage = await getSeatsUsage(companyId);
  if (exceedsSeats(usage, count)) {
    throw httpError(
      409,
      `Quota de sièges atteint (${usage.seatsUsed}/${usage.seatLimit}) — ${count} ajout(s) refusé(s)`
    );
  }
  return usage;
}

export type CohortSeatsUsage = {
  cohortId: string;
  seatLimit: number;
  seatsUsed: number;
  /** `null` quand la cohorte n'a pas de plafond propre. */
  seatsAvailable: number | null;
};

/** Places restantes d'une cohorte, indépendantes du quota de l'entreprise. */
export async function getCohortSeatsUsage(
  companyId: string,
  cohortId: string
): Promise<CohortSeatsUsage> {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, companyId },
    select: { id: true, seatLimit: true, _count: { select: { learners: true } } },
  });
  if (!cohort) throw httpError(404, "Cohort not found");

  return {
    cohortId: cohort.id,
    seatLimit: cohort.seatLimit,
    seatsUsed: cohort._count.learners,
    seatsAvailable: remainingCapacity(cohort.seatLimit, cohort._count.learners),
  };
}

/**
 * Le plafond de cohorte était stocké et affiché sans jamais être appliqué :
 * seul le quota entreprise bloquait.
 */
export async function assertCohortSeatsAvailable(
  companyId: string,
  cohortId: string,
  count = 1
): Promise<CohortSeatsUsage> {
  const usage = await getCohortSeatsUsage(companyId, cohortId);
  if (usage.seatsAvailable !== null && count > usage.seatsAvailable) {
    throw httpError(
      409,
      `Places de la cohorte épuisées (${usage.seatsUsed}/${usage.seatLimit}) — ${count} ajout(s) refusé(s)`
    );
  }
  return usage;
}

export type EnabledModule = {
  moduleId: string;
  key: string;
  name: Record<string, string>;
  creditsRemaining: number;
};

/**
 * Modules débloqués = union des modules des packs dont l'entitlement est
 * `active` et non expiré. Les crédits restants sont sommés sur ces packs.
 */
export async function getEnabledModules(companyId: string): Promise<EnabledModule[]> {
  const now = new Date();
  const entitlements = await prisma.companyEntitlement.findMany({
    where: {
      companyId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      credits: { include: { module: { select: { id: true, key: true, name: true } } } },
      pack: {
        include: { items: { include: { module: { select: { id: true, key: true, name: true } } } } },
      },
    },
  });

  const byModule = new Map<string, EnabledModule>();

  for (const ent of entitlements) {
    // Le pack définit l'accès, `EntitlementCredit` le solde consommable.
    for (const item of ent.pack.items) {
      if (!byModule.has(item.moduleId)) {
        byModule.set(item.moduleId, {
          moduleId: item.moduleId,
          key: item.module.key,
          name: (item.module.name ?? {}) as Record<string, string>,
          creditsRemaining: 0,
        });
      }
    }
    for (const credit of ent.credits) {
      const entry = byModule.get(credit.moduleId) ?? {
        moduleId: credit.moduleId,
        key: credit.module.key,
        name: (credit.module.name ?? {}) as Record<string, string>,
        creditsRemaining: 0,
      };
      entry.creditsRemaining += credit.creditsRemaining;
      byModule.set(credit.moduleId, entry);
    }
  }

  return [...byModule.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function isModuleEnabled(companyId: string, moduleId: string): Promise<boolean> {
  const modules = await getEnabledModules(companyId);
  return modules.some((m) => m.moduleId === moduleId);
}

export async function assertModuleEnabled(companyId: string, moduleId: string): Promise<void> {
  if (!(await isModuleEnabled(companyId, moduleId))) {
    throw httpError(403, "Module non inclus dans les packs actifs de l'entreprise");
  }
}

/** `null` si le module n'est couvert par aucun pack actif. */
export async function getCreditsRemaining(
  companyId: string,
  moduleId: string
): Promise<number | null> {
  const modules = await getEnabledModules(companyId);
  const found = modules.find((m) => m.moduleId === moduleId);
  return found ? found.creditsRemaining : null;
}

export type ConsumeCreditInput = {
  companyId: string;
  moduleId: string;
  /** Type de l'objet consommateur (ex. `scenario_session`, `diary_entry`). */
  sourceType: string;
  /** Id de cet objet — `[sourceType, sourceId]` est unique. */
  sourceId: string;
  learnerId?: string | null;
  credits?: number;
  /** Instant réel de la session — le balayage rejoue des lignes passées. */
  occurredAt?: Date;
};

export type ConsumeCreditResult =
  | { consumed: true; creditsRemaining: number }
  | { consumed: false; reason: "already_recorded" | "no_credits" };

/**
 * Décrémente les crédits d'un module, une seule fois par `[sourceType, sourceId]`.
 * Rejouer le même événement (retry worker, webhook doublé) ne débite pas deux fois.
 */
export async function consumeCredit(input: ConsumeCreditInput): Promise<ConsumeCreditResult> {
  const credits = input.credits ?? 1;
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  return prisma.$transaction(async (tx: TransactionClient): Promise<ConsumeCreditResult> => {
    const existing = await tx.moduleUsageEvent.findUnique({
      where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
    });
    if (existing) return { consumed: false, reason: "already_recorded" };

    // Consommer d'abord l'entitlement qui expire le plus tôt.
    const rows = await tx.entitlementCredit.findMany({
      where: {
        moduleId: input.moduleId,
        creditsRemaining: { gt: 0 },
        entitlement: {
          companyId: input.companyId,
          status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      include: { entitlement: { select: { expiresAt: true } } },
    });

    const plan = planCreditDebit(
      rows.map((r) => ({
        id: r.id,
        creditsRemaining: r.creditsRemaining,
        expiresAt: r.entitlement.expiresAt,
      })),
      credits
    );
    if (!plan.ok) return { consumed: false, reason: "no_credits" };

    for (const debit of plan.debits) {
      await tx.entitlementCredit.update({
        where: { id: debit.id },
        data: { creditsRemaining: { decrement: debit.take } },
      });
    }

    await tx.moduleUsageEvent.create({
      data: {
        companyId: input.companyId,
        moduleId: input.moduleId,
        learnerId: input.learnerId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        creditsConsumed: credits,
        occurredAt,
      },
    });

    return { consumed: true, creditsRemaining: plan.total - credits };
  });
}

/**
 * Crée (ou complète) l'entitlement d'un pack pour une entreprise et crédite les
 * sessions du pack. Un entitlement actif existant est cumulé et prolongé.
 */
export async function grantPackToCompany(params: {
  companyId: string;
  packId: string;
  expiresAt?: Date | null;
}): Promise<string> {
  const pack = await prisma.modulePack.findUnique({
    where: { id: params.packId },
    include: { items: true },
  });
  if (!pack) throw httpError(404, "Pack not found");

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { id: true },
  });
  if (!company) throw httpError(404, "Company not found");

  const expiresAt = params.expiresAt ?? defaultExpiryFor(pack.billingPeriod);

  return prisma.$transaction(async (tx: TransactionClient) => {
    const existing = await tx.companyEntitlement.findFirst({
      where: { companyId: params.companyId, packId: params.packId, status: "active" },
    });

    const entitlement = existing
      ? await tx.companyEntitlement.update({
          where: { id: existing.id },
          data: {
            expiresAt: laterOf(existing.expiresAt, expiresAt),
          },
        })
      : await tx.companyEntitlement.create({
          data: {
            companyId: params.companyId,
            packId: params.packId,
            status: "active",
            purchasedAt: new Date(),
            expiresAt,
          },
        });

    for (const item of pack.items) {
      await tx.entitlementCredit.upsert({
        where: {
          entitlementId_moduleId: { entitlementId: entitlement.id, moduleId: item.moduleId },
        },
        create: {
          entitlementId: entitlement.id,
          moduleId: item.moduleId,
          creditsRemaining: item.sessionCredits,
        },
        update: { creditsRemaining: { increment: item.sessionCredits } },
      });
    }

    return entitlement.id;
  });
}

/** Marque `expired` les entitlements dont la date est passée. */
export async function expireStaleEntitlements(companyId?: string): Promise<number> {
  const result = await prisma.companyEntitlement.updateMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "active",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
  return result.count;
}
