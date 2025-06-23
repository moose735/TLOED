// utils/bettingCalculations.js

const MATCHUPS_URL = 'https://script.google.com/macros/s/AKfycbxpo21zzZgNamYShESfqe-SX09miJz2LK7SpdlYrtHXQplneB3bF2xu2byy0HhjM8e-/exec';

// Basic helpers
function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function standardDeviation(arr) {
  if (!arr.length) return null;
  const avg = average(arr);
  const variance = arr.reduce((sum, val) => sum + (val - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// 1) calculateMoneylineOdds: converts probability to American odds
export function calculateMoneylineOdds(prob) {
  if (prob <= 0 || prob >= 1) return null;
  if (prob >= 0.5) {
    return Math.round(-100 * (prob / (1 - prob)));
  } else {
    return Math.round(100 * ((1 - prob) / prob));
  }
}

// 2) calculateOverUnder: sum of average points for both teams
export function calculateOverUnder(teamAScores, teamBScores) {
  const avgA = average(teamAScores);
  const avgB = average(teamBScores);
  if (avgA === null || avgB === null) return null;
  return parseFloat((avgA + avgB).toFixed(1));
}

// 3) getPlayerMetricsForYear: averages and std dev for all teams in a given year
export async function getPlayerMetricsForYear(year) {
  const res = await fetch(MATCHUPS_URL);
  const json = await res.json();
  const games = json.data.filter(g => g.year === year);
  const stats = {};

  for (const game of games) {
    if (!stats[game.team1]) stats[game.team1] = [];
    if (!stats[game.team2]) stats[game.team2] = [];
    stats[game.team1].push(game.team1Score);
    stats[game.team2].push(game.team2Score);
  }

  return Object.entries(stats).map(([team, scores]) => ({
    team,
    average: parseFloat(average(scores).toFixed(2)),
    stdDev: parseFloat(standardDeviation(scores).toFixed(2)),
    gamesPlayed: scores.length
  }));
}

// 4) calculateTeamAverageDifferenceVsOpponent: average (team score - opponent score) for given matchups
export function calculateTeamAverageDifferenceVsOpponent(teamName, matchups) {
  const games = matchups.filter(g => g.team1 === teamName || g.team2 === teamName);
  if (!games.length) return null;

  let totalDiff = 0;
  games.forEach(g => {
    if (g.team1 === teamName) {
      totalDiff += g.team1Score - g.team2Score;
    } else {
      totalDiff += g.team2Score - g.team1Score;
    }
  });
  return totalDiff / games.length;
}

// 5) calculateSigmaSquaredOverCount: variance divided by count
export function calculateSigmaSquaredOverCount(scores) {
  if (!scores.length) return null;
  const avg = average(scores);
  const variance = scores.reduce((sum, val) => sum + (val - avg) ** 2, 0) / scores.length;
  return variance / scores.length;
}

// 6) calculateFutureOpponentAverageScoringDifference
// Given a team, their schedule, and points scored so far, calculate avg scoring difference for future opponents
export function calculateFutureOpponentAverageScoringDifference(teamName, schedule, playerMetrics) {
  // Get future opponents from schedule (e.g., weeks after current)
  // playerMetrics: [{team, average, stdDev}, ...]
  // For simplicity, just average differences for remaining opponents

  const playerIndex = schedule.findIndex(p => p.Player === teamName);
  if (playerIndex === -1) return null;

  // Find weeks ahead (for example, weeks with no scores yet)
  // We'll just average all remaining opponents' average scoring - team average scoring

  // Get current week (could be passed or calculated externally)
  const currentWeek = new Date().getWeekNumber() || 1; // placeholder

  const playerSchedule = schedule[playerIndex];
  const futureOpponents = [];
  for (let wk = currentWeek; wk <= 14; wk++) {
    const wkKey = `Week_${wk}`;
    if (playerSchedule[wkKey]) futureOpponents.push(playerSchedule[wkKey]);
  }

  const teamMetric = playerMetrics.find(m => m.team === teamName);
  if (!teamMetric) return null;

  const opponentMetrics = futureOpponents
    .map(opp => playerMetrics.find(m => m.team === opp))
    .filter(Boolean);

  if (!opponentMetrics.length) return null;

  // average difference = avg(team scoring) - avg(opponent scoring)
  const differences = opponentMetrics.map(opp => teamMetric.average - opp.average);

  return average(differences);
}

// 7) calculateErrorFunctionCoefficient
// Inputs: average difference (MF215), sigma squared over count (MX215), std dev of opponent (lookup)
// Formula as per your description
export function calculateErrorFunctionCoefficient(averageDiff, sigmaSquaredOverCount, opponentStdDev) {
  if (averageDiff === 0) return 0;
  if (!averageDiff || !sigmaSquaredOverCount || !opponentStdDev) return null;

  return (averageDiff / (opponentStdDev * sigmaSquaredOverCount)) * (averageDiff / 2);
}

// 8) calculateWeeklyWinPercentageProjection
// Uses error function (erf) and error function coefficient
export function calculateWeeklyWinPercentageProjection(averageDiff, errorFuncCoeff) {
  if (averageDiff === 0) return 0.5;
  if (!averageDiff || errorFuncCoeff === null) return null;

  // Simple approximation of error function using JavaScript's Math.erf if available (or custom)
  const erf = x => {
    // Abramowitz and Stegun formula 7.1.26 approximation:
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  };

  if (averageDiff > 0) {
    return erf((errorFuncCoeff / averageDiff) / Math.sqrt(2)) / 2 + 0.5;
  } else {
    return 1 - (erf((errorFuncCoeff / Math.abs(averageDiff)) / Math.sqrt(2)) / 2 + 0.5);
  }
}
