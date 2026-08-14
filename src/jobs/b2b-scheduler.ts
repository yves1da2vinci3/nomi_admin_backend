import type { Env } from "../config/env.js";
import { expireStaleEntitlements } from "../modules/b2b/quota-service.js";
import { ingestUsage, resetMonthlyApiUsage } from "../modules/b2b/usage/service.js";
import { startOfMonthUtc } from "../modules/b2b/usage/matching.js";
import { refreshOverdueAssignments } from "../modules/partner/assignments/service.js";

/**
 * Tâches de fond B2B. Un simple `setInterval` suffit : chaque passage est
 * idempotent et sans état persistant, une file BullMQ n'apporterait rien.
 */

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
/** Mois du dernier recalcul de `apiUsedMonth`, `null` au démarrage. */
let lastMonthlyReset: number | null = null;

export async function runB2bMaintenance(now: Date = new Date()): Promise<void> {
  const monthStart = startOfMonthUtc(now).getTime();

  // Premier passage après un démarrage, ou changement de mois : le compteur est
  // recalculé depuis les `ModuleUsageEvent`, donc rejouable sans risque.
  if (lastMonthlyReset !== monthStart) {
    const companies = await resetMonthlyApiUsage(now);
    lastMonthlyReset = monthStart;
    if (companies > 0) console.log(`[b2b] apiUsedMonth recalculé pour ${companies} entreprise(s)`);
  }

  const expired = await expireStaleEntitlements();
  if (expired > 0) console.log(`[b2b] ${expired} entitlement(s) expiré(s)`);

  const overdue = await refreshOverdueAssignments();
  if (overdue > 0) console.log(`[b2b] ${overdue} ligne(s) de devoir passée(s) en retard`);

  const report = await ingestUsage();
  const consumed = report.perSource.reduce((sum, s) => sum + s.consumed, 0);
  if (consumed > 0 || report.assignmentsCompleted > 0) {
    console.log(
      `[b2b] usage ingéré : ${consumed} session(s), ${report.learnersTouched} apprenant(s), ` +
        `${report.assignmentsCompleted} devoir(s) validé(s) en ${report.durationMs} ms`
    );
  }
}

export function startB2bScheduler(env: Env): void {
  if (env.USAGE_INGEST_INTERVAL_MS <= 0) {
    console.log("[b2b] ordonnanceur désactivé (USAGE_INGEST_INTERVAL_MS=0)");
    return;
  }
  if (timer) return;

  const tick = async () => {
    // Un passage lent ne doit pas se superposer au suivant.
    if (running) return;
    running = true;
    try {
      await runB2bMaintenance();
    } catch (e) {
      console.error("[b2b] maintenance échouée", e);
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, env.USAGE_INGEST_INTERVAL_MS);
  timer.unref?.();
  void tick();
  console.log(`[b2b] ordonnanceur démarré (toutes les ${env.USAGE_INGEST_INTERVAL_MS} ms)`);
}

export function stopB2bScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
