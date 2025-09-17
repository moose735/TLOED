// src/utils/analytics.js
// Lightweight analytics helpers for draft insights

export function buildHeatmap(picks = [], totalRounds = 0, totalTeams = 12) {
  // Returns matrix [roundIndex][pickInRoundIndex] => { sum, count, avg }
  const rounds = Array.from({ length: totalRounds }, () => Array.from({ length: totalTeams }, () => ({ sum: 0, count: 0 })));

  picks.forEach(p => {
    if (!p || p.is_keeper) return;
    const round = p.round || Math.ceil((p.pick_no || 1) / (totalTeams));
    const pickInRound = p.pick_in_round || ((p.pick_no - 1) % totalTeams) + 1;
    if (round < 1 || round > totalRounds) return;
    const rIdx = round - 1;
    const pIdx = pickInRound - 1;
    const val = typeof p.scaled_vorp_delta === 'number' ? p.scaled_vorp_delta : (typeof p.vorp_delta === 'number' ? p.vorp_delta : null);
    if (val === null) return;
    rounds[rIdx][pIdx].sum += val;
    rounds[rIdx][pIdx].count += 1;
  });

  return rounds.map(row => row.map(cell => ({ avg: cell.count > 0 ? cell.sum / cell.count : null, count: cell.count })));
}

export function playerConsistencyStats(weeklyPoints = []) {
  // weeklyPoints: number[]
  if (!weeklyPoints || weeklyPoints.length === 0) return null;
  const n = weeklyPoints.length;
  const mean = weeklyPoints.reduce((s, v) => s + v, 0) / n;
  const variance = weeklyPoints.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);

  // Percentiles
  const sorted = weeklyPoints.slice().sort((a, b) => a - b);
  const pct = (p) => {
    if (n === 0) return null;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((p / 100) * n)));
    return sorted[idx];
  };

  // Consistency score: mean / (stddev + eps) scaled to 0-100 roughly
  const eps = 1e-6;
  const raw = mean / (stddev + eps);
  // Normalize using arctan to compress extremes
  const normalized = Math.tanh(raw / 5) * 50 + 50; // ~0-100

  return {
    mean,
    stddev,
    consistencyScore: Number.isFinite(normalized) ? normalized : 50,
    p10: pct(10),
    median: pct(50),
    p90: pct(90),
  };
}

export function computeOwnerPickSummaries(picks = []) {
  // returns { [ownerId]: { total: number, count: number, best: pick, worst: pick, picks: [] } }
  const owners = {};
  picks.forEach(p => {
    if (!p || p.is_keeper) return;
    const owner = p.picked_by || 'unknown';
    if (!owners[owner]) owners[owner] = { total: 0, count: 0, picks: [] };
    const val = typeof p.scaled_vorp_delta === 'number' ? p.scaled_vorp_delta : (typeof p.vorp_delta === 'number' ? p.vorp_delta : 0);
    owners[owner].total += val;
    owners[owner].count += 1;
    owners[owner].picks.push({ ...p, value: val });
  });

  Object.keys(owners).forEach(ownerId => {
    const o = owners[ownerId];
    o.picks.sort((a, b) => b.value - a.value);
    o.best = o.picks[0] || null;
    o.worst = o.picks[o.picks.length - 1] || null;
    o.avg = o.count > 0 ? o.total / o.count : 0;
  });

  return owners;
}

export default { buildHeatmap, playerConsistencyStats, computeOwnerPickSummaries };
