import { buildHeatmap, playerConsistencyStats, computeOwnerPickSummaries } from '../analytics';

describe('analytics helpers', () => {
  test('buildHeatmap basic', () => {
    const picks = [
      { round: 1, pick_in_round: 1, scaled_vorp_delta: 2 },
      { round: 1, pick_in_round: 1, scaled_vorp_delta: 4 },
      { round: 1, pick_in_round: 2, scaled_vorp_delta: -1 },
    ];
    const heat = buildHeatmap(picks, 2, 3);
    expect(heat[0][0].avg).toBeCloseTo(3);
    expect(heat[0][1].avg).toBeCloseTo(-1);
    expect(heat[1][0].avg).toBeNull();
  });

  test('playerConsistencyStats basic', () => {
    const weeks = [10, 12, 8, 11, 9];
    const stats = playerConsistencyStats(weeks);
    expect(stats).toHaveProperty('mean');
    expect(stats).toHaveProperty('stddev');
    expect(stats).toHaveProperty('consistencyScore');
    expect(stats.median).toBeGreaterThanOrEqual(8);
  });

  test('computeOwnerPickSummaries basic', () => {
    const picks = [
      { picked_by: 'A', scaled_vorp_delta: 3, pick_no: 1 },
      { picked_by: 'A', scaled_vorp_delta: -2, pick_no: 2 },
      { picked_by: 'B', scaled_vorp_delta: 1, pick_no: 3 },
    ];
    const owners = computeOwnerPickSummaries(picks);
    expect(Object.keys(owners)).toContain('A');
    expect(owners['A'].best.value).toBe(3);
    expect(owners['A'].worst.value).toBe(-2);
  });
});
