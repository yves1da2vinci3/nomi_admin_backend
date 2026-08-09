import type { SeatsUsage } from "./quota-service.js";

/** Calculs de quotas isolés de Prisma pour rester testables sans base. */

export function computeSeatsUsage(seatLimit: number, seatsUsed: number): SeatsUsage {
  return {
    seatLimit,
    seatsUsed,
    seatsAvailable: Math.max(0, seatLimit - seatsUsed),
    usagePct: seatLimit > 0 ? Math.round((seatsUsed / seatLimit) * 100) : 0,
  };
}

/** `seatLimit` à 0 = illimité (aucun pack n'impose de plafond). */
export function exceedsSeats(usage: SeatsUsage, count: number): boolean {
  return usage.seatLimit > 0 && usage.seatsUsed + count > usage.seatLimit;
}

/**
 * Places encore ouvertes, `null` quand le plafond est illimité. Sert à la fois
 * au quota entreprise et au plafond d'une cohorte.
 */
export function remainingCapacity(seatLimit: number, seatsUsed: number): number | null {
  return seatLimit > 0 ? Math.max(0, seatLimit - seatsUsed) : null;
}

/**
 * Découpe une liste d'entrants selon la capacité disponible : import CSV partiel
 * plutôt que refus global.
 */
export function splitByCapacity<T>(
  candidates: T[],
  capacity: number | null
): { accepted: T[]; rejected: T[] } {
  if (capacity === null) return { accepted: candidates, rejected: [] };
  return { accepted: candidates.slice(0, capacity), rejected: candidates.slice(capacity) };
}

export type CreditRow = { id: string; creditsRemaining: number; expiresAt: Date | null };

export type CreditPlan =
  | { ok: false; total: number }
  | { ok: true; total: number; debits: Array<{ id: string; take: number }> };

/**
 * Répartit un débit sur les soldes disponibles, en vidant d'abord ceux qui
 * expirent le plus tôt. Rien n'est débité si le total est insuffisant.
 */
export function planCreditDebit(rows: CreditRow[], credits: number): CreditPlan {
  const total = rows.reduce((sum, r) => sum + r.creditsRemaining, 0);
  if (total < credits) return { ok: false, total };

  const ordered = [...rows].sort(
    (a, b) =>
      (a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) -
      (b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY)
  );

  const debits: Array<{ id: string; take: number }> = [];
  let left = credits;
  for (const row of ordered) {
    if (left <= 0) break;
    const take = Math.min(row.creditsRemaining, left);
    if (take > 0) {
      debits.push({ id: row.id, take });
      left -= take;
    }
  }
  return { ok: true, total, debits };
}

export function defaultExpiryFor(
  period: "monthly" | "quarterly" | "one_time",
  from = new Date()
): Date {
  const d = new Date(from);
  if (period === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (period === "one_time") d.setMonth(d.getMonth() + 12);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** `null` = sans expiration, donc toujours la borne la plus lointaine. */
export function laterOf(a: Date | null, b: Date | null): Date | null {
  if (!a) return null;
  if (!b) return null;
  return a.getTime() > b.getTime() ? a : b;
}
