// src/utils/bettingCalculations.js

// Approximate error function implementation for ERF, used in formula
function erf(x) {
  // Abramowitz and Stegun formula 7.1.26 approximation
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);

  return sign * y;
}

/**
 * Calculate Moneyline odds and Over/Under for matchup.
 *
 * @param {string} teamA
 * @param {string} teamB
 * @param {number} week
 * @param {object} historicalData - Your historical matchup / points data
 * @returns {object} - { mlTeam, mlOpponent, overUnder }
 */
export function calculateMatchupOdds(teamA, teamB, week, historicalData) {
  if (!historicalData) {
    // fallback dummy odds if no data loaded yet
    return { mlTeam: "-120", mlOpponent: "+110", overUnder: 220 };
  }

  // This example assumes historicalData is a map:
  // { [teamName]: { pointsByWeek: { [week]: number }, avgPoints: number, stdDev: number } }

  // Get average points and std deviation (sigma) for each team for all weeks up to current
  const teamAData = historicalData[teamA];
  const teamBData = historicalData[teamB];

  if (!teamAData || !teamBData) {
    // If missing data, return neutral odds
    return { mlTeam: "-110", mlOpponent: "-110", overUnder: 0 };
  }

  // Calculate average difference in points for teamA vs teamB up to this week
  // Simplified: avgDiff = teamA avg points - teamB avg points
  const avgDiff = (teamAData.avgPoints || 0) - (teamBData.avgPoints || 0);

  // Standard deviation (sigma) — combine both teams
  const sigma = Math.sqrt(
    (teamAData.stdDev ** 2 || 0) + (teamBData.stdDev ** 2 || 0)
  );

  // Calculate "error function coefficient" MX215 from your formula
  // Approximate coefficient = avgDiff / sigma
  const coefficient = sigma === 0 ? 0 : avgDiff / sigma;

  // Calculate win probability for teamA using your formula with erf:
  // winProb = 0.5 + 0.5 * erf(coefficient / sqrt(2))
  const winProb =
    0.5 + 0.5 * erf(coefficient / Math.sqrt(2));

  // Moneyline conversion:
  // If winProb > 0.5, ML negative for teamA (favorite), else positive
  let mlTeam, mlOpponent;

  function probToMoneyline(p) {
    if (p === 0) return "+10000";
    if (p === 1) return "-10000";
    if (p > 0.5) {
      return Math.round(-100 / (p / (1 - p)));
    } else {
      return Math.round(100 * ((1 - p) / p));
    }
  }

  mlTeam = probToMoneyline(winProb);
  mlOpponent = probToMoneyline(1 - winProb);

  // Over/Under — sum of average points plus a margin (simplified)
  const overUnder = (teamAData.avgPoints || 0) + (teamBData.avgPoints || 0) + 10;

  return { mlTeam, mlOpponent, overUnder };
}
