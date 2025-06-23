// src/utils/bettingCalculations.js

// Dummy odds fallback when no data available
export function calculateMatchupOdds(teamA, teamB) {
  // Just example fixed odds for now:
  return {
    mlTeam: "-110",
    mlOpponent: "+110",
    overUnder: 220.0,
  };
}
