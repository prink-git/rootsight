// Mirrors the deterministic health-score formula computed in
// backend/app/engine.py (_compute_health_and_metrics), so the Impact
// Simulator can project "after" numbers instantly in the browser as the
// user toggles which fixes are planned - no extra API round-trip needed.

export const SEVERITY_WEIGHT = { critical: 1.0, high: 0.65, medium: 0.35, low: 0.12 };

export function computeProjection(clusters, plannedIds) {
  const totalBefore = clusters.reduce((sum, c) => sum + c.size, 0);

  let totalAfter = 0;
  let csatWeightedAfter = 0;
  let frictionAfter = 0;
  let ticketsReduced = 0;

  for (const c of clusters) {
    const isPlanned = plannedIds.has(c.cluster_id);
    const reduction = isPlanned ? c.expected_reduction_tickets : 0;
    const remaining = Math.max(0, c.size - reduction);

    ticketsReduced += reduction;
    totalAfter += remaining;
    csatWeightedAfter += remaining * (c.avg_csat || 0);

    const sevWeight = SEVERITY_WEIGHT[c.ai?.severity] ?? 0.35;
    frictionAfter += remaining * sevWeight; // normalized by totalAfter after the loop
  }

  const avgCsatAfter = totalAfter > 0 ? csatWeightedAfter / totalAfter : 0;
  const csatNormalizedAfter = Math.max(0, Math.min(1, (avgCsatAfter - 1) / 4)) * 100;
  const frictionScoreAfter = totalAfter > 0 ? Math.min((frictionAfter / totalAfter) * 100, 100) : 0;

  let healthAfter = 0.65 * (100 - frictionScoreAfter) + 0.35 * csatNormalizedAfter;
  healthAfter = Math.max(0, Math.min(100, Math.round(healthAfter)));

  return {
    totalBefore,
    totalAfter,
    ticketsReduced,
    pctReduced: totalBefore > 0 ? Math.round((ticketsReduced / totalBefore) * 1000) / 10 : 0,
    avgCsatAfter: Math.round(avgCsatAfter * 100) / 100,
    healthAfter,
    frictionScoreAfter: Math.round(frictionScoreAfter * 10) / 10,
  };
}
