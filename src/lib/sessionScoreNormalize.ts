/**
 * Aligné sur nomi_backend/src/core/utils/sessionScoreNormalize.ts
 * score ≤ 100 = déjà /100 ; score > 100 = legacy cumulatif / steps.
 */
export function normalizeSessionScore(score: number, totalSteps: number): number {
  if (!Number.isFinite(score) || score < 0) {
    return 0;
  }
  if (score <= 100) {
    return Math.round(Math.min(Math.max(score, 0), 100));
  }
  if (!totalSteps || totalSteps <= 0) {
    return Math.min(100, Math.round(score));
  }
  const maxPossibleScore = totalSteps * 100;
  if (maxPossibleScore <= 0) return 0;
  const normalized = (score / maxPossibleScore) * 100;
  return Math.round(Math.min(Math.max(normalized, 0), 100));
}

export function effectiveSessionTotalSteps(
  totalSteps: number,
  goalsCount: number
): number {
  if (totalSteps > 0) return totalSteps;
  if (goalsCount > 0) return goalsCount;
  return 1;
}
