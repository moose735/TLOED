// Minimal no-op badge computation implementation
// Achievements removed per user request to eliminate heavy computation and assets.

export function computeBadges() {
  return { badgesByTeam: {}, recentBadges: [] };
}

export default { computeBadges };
// src/utils/badges.js
