import { getSelectableSeasons } from './SeasonBreakdown';

describe('getSelectableSeasons', () => {
  it('hides the current season before week 1 starts', () => {
    expect(getSelectableSeasons([2026, 2025, 2024], 2026, 0)).toEqual([2025, 2024]);
  });

  it('hides the current season when the official week value is set but no real game data exists', () => {
    expect(getSelectableSeasons([2026, 2025, 2024], 2026, 1, false)).toEqual([2025, 2024]);
  });

  it('keeps the current season once real game data exists', () => {
    expect(getSelectableSeasons([2026, 2025, 2024], 2026, 1, true)).toEqual([2026, 2025, 2024]);
  });
});
