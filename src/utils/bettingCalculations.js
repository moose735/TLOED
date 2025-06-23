// bettingCalculations.js

// Existing imports and functions assumed here...

// --- Begin Added functions for your exact calculation ---

// Approximate error function (erf)
export function erf(x) {
  const sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);

  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const t = 1.0/(1.0 + p*x);
  const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

  return sign * y;
}

// Get weekly scores for a team in a year before currentWeek
export function getWeeklyScores(teamName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const scores = [];
  for (const match of historicalMatchups) {
    const matchYear = parseInt(match.year);
    const matchWeek = parseInt(match.week);
    if (matchYear === year && matchWeek < currentWeek) {
      const t1 = getMappedTeamName(match.team1?.trim());
      const t2 = getMappedTeamName(match.team2?.trim());
      if (t1 === teamName) {
        scores.push(parseFloat(match.team1Score) || 0);
      } else if (t2 === teamName) {
        scores.push(parseFloat(match.team2Score) || 0);
      }
    }
  }
  return scores;
}

// Calculate average weekly score
export function calculateWeeklyAverage(teamName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const scores = getWeeklyScores(teamName, year, currentWeek, historicalMatchups, getMappedTeamName);
  if (scores.length === 0) return 0;
  const total = scores.reduce((a, b) => a + b, 0);
  return total / scores.length;
}

// Calculate variance (sigma squared over count)
export function calculateVariance(teamName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const scores = getWeeklyScores(teamName, year, currentWeek, historicalMatchups, getMappedTeamName);
  const average = calculateWeeklyAverage(teamName, year, currentWeek, historicalMatchups, getMappedTeamName);
  if (scores.length === 0) return 0;
  const squaredDiffs = scores.map(score => Math.pow(score - average, 2));
  const sumSquaredDiffs = squaredDiffs.reduce((a, b) => a + b, 0);
  return sumSquaredDiffs / scores.length;
}

// Calculate standard deviation = sqrt(variance)
export function calculateStdDev(teamName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const variance = calculateVariance(teamName, year, currentWeek, historicalMatchups, getMappedTeamName);
  return Math.sqrt(variance);
}

// Calculate average difference vs opponent
export function calculateAvgDiffVsOpponent(teamName, opponentName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const teamAvg = calculateWeeklyAverage(teamName, year, currentWeek, historicalMatchups, getMappedTeamName);
  const oppAvg = calculateWeeklyAverage(opponentName, year, currentWeek, historicalMatchups, getMappedTeamName);
  return teamAvg - oppAvg;
}

// Calculate error function coefficient
export function calculateErrorCoeff(avgDiffVsOpponent, opponentName, year, currentWeek, historicalMatchups, getMappedTeamName) {
  const opponentStdDev = calculateStdDev(opponentName, year, currentWeek, historicalMatchups, getMappedTeamName);
  if (opponentStdDev === 0) return 0;
  return (avgDiffVsOpponent / opponentStdDev) * (avgDiffVsOpponent / 2);
}

// Calculate weekly win % projection using erf
export function calculateWeeklyWinPercentage(avgDiffVsOpponent, errorCoeff) {
  if (avgDiffVsOpponent === 0) return 0.5;
  const sqrt2 = Math.sqrt(2);
  if (avgDiffVsOpponent > 0) {
    return erf(errorCoeff / avgDiffVsOpponent / sqrt2) / 2 + 0.5;
  } else {
    return 1 - (erf(errorCoeff / Math.abs(avgDiffVsOpponent) / sqrt2) / 2 + 0.5);
  }
}

// Existing calculateMoneylineOdds function
export function calculateMoneylineOdds(winPct1, winPct2) {
  // Simple odds conversion based on probabilities:
  // American odds formula:
  // Positive odds: (100 / probability) - 100
  // Negative odds: - (probability / (1 - probability)) * 100
  const odds1 = winPct1 > 0.5 ? -Math.round((winPct1 / (1 - winPct1)) * 100) : Math.round(((1 - winPct1) / winPct1) * 100);
  const odds2 = winPct2 > 0.5 ? -Math.round((winPct2 / (1 - winPct2)) * 100) : Math.round(((1 - winPct2) / winPct2) * 100);

  return {
    team1Formatted: odds1 > 0 ? `+${odds1}` : odds1.toString(),
    team2Formatted: odds2 > 0 ? `+${odds2}` : odds2.toString(),
  };
}
