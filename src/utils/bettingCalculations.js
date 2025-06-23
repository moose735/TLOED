// bettingCalculations.js

// Defensive average function
function average(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Defensive variance function (sigma squared)
function variance(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const avg = average(arr);
  if (avg === null) return null;
  const varSum = arr.reduce((sum, val) => sum + (val - avg) ** 2, 0);
  return varSum / arr.length;
}

// Defensive standard deviation
function standardDeviation(arr) {
  const varr = variance(arr);
  return varr === null ? null : Math.sqrt(varr);
}

// Helper: Error function approximation (erf)
function erf(x) {
  // Abramowitz and Stegun formula 7.1.26 approximation
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// Exported functions

export function calculateMoneylineOdds(teamADiff, teamBDiff) {
  // Simple example: positive diff means team favored
  if (teamADiff == null || teamBDiff == null) return null;

  const diff = teamADiff - teamBDiff;
  // Example formula: convert difference to moneyline odds
  if (diff === 0) return 100; // pick'em
  if (diff > 0) {
    return Math.round(100 / diff);
  } else {
    return Math.round(-100 * diff);
  }
}

export function calculateOverUnder(teamAScores, teamBScores) {
  if (!Array.isArray(teamAScores) || !Array.isArray(teamBScores)) return null;
  const avgA = average(teamAScores);
  const avgB = average(teamBScores);
  if (avgA === null || avgB === null) return null;
  return parseFloat((avgA + avgB).toFixed(1));
}

// Pull player/team metrics for a specific year from matchup data
export function getPlayerMetricsForYear(matchups, year) {
  if (!Array.isArray(matchups) || !year) return {};
  // Gather all scores per team for that year (regular season only)
  const teamScores = {};
  matchups.forEach(game => {
    if (game.year === year && game.regSeason) {
      if (!teamScores[game.team1]) teamScores[game.team1] = [];
      if (!teamScores[game.team2]) teamScores[game.team2] = [];
      if (typeof game.team1Score === "number") teamScores[game.team1].push(game.team1Score);
      if (typeof game.team2Score === "number") teamScores[game.team2].push(game.team2Score);
    }
  });
  return teamScores;
}

export function calculateTeamAverageDifferenceVsOpponent(teamScores, schedule, year) {
  // teamScores: { teamName: [scores] }
  // schedule: array with schedule info for year
  // returns { team: avgDiffVsOpp }
  if (!teamScores || !schedule) return {};
  const avgDiffs = {};

  Object.keys(teamScores).forEach(team => {
    const scores = teamScores[team];
    if (!Array.isArray(scores) || scores.length === 0) {
      avgDiffs[team] = null;
      return;
    }
    // Compute average points scored by team
    const avgTeamScore = average(scores);

    // Find opponents and their avg scores for this team in this year's schedule
    let totalDiff = 0;
    let gamesCounted = 0;

    // For each week, find opponent of 'team' from schedule and subtract averages
    for (const weekKey in schedule) {
      // schedule is expected to be an array of player schedule objects, so skip if not an object
      const playerSchedule = schedule.find(p => p.Player === team);
      if (!playerSchedule) continue;

      // Go through each week column in playerSchedule for the current year
      for (let week = 1; week <= 14; week++) {
        const opp = playerSchedule[`Week_${week}`];
        if (!opp) continue;

        // Get average opponent score
        const oppScores = teamScores[opp];
        if (!Array.isArray(oppScores) || oppScores.length === 0) continue;

        const avgOppScore = average(oppScores);
        if (avgOppScore === null) continue;

        // Difference for that week is team's average score - opponent's average score
        const diff = avgTeamScore - avgOppScore;
        totalDiff += diff;
        gamesCounted++;
      }
      break; // break after first found player schedule to avoid repeated loops
    }

    avgDiffs[team] = gamesCounted > 0 ? totalDiff / gamesCounted : null;
  });

  return avgDiffs;
}

export function calculateSigmaSquaredOverCount(teamScores) {
  // teamScores is array of numbers (scores for weeks)
  if (!Array.isArray(teamScores) || teamScores.length === 0) return null;
  const avg = average(teamScores);
  if (avg === null) return null;
  const squaredDiffs = teamScores.map(score => (score - avg) ** 2);
  const sigmaSquared = average(squaredDiffs);
  return sigmaSquared;
}

export function calculateFutureOpponentAverageScoringDifference(teamScores, futureOpponentsScores) {
  // teamScores: array of numbers (team points)
  // futureOpponentsScores: array of arrays [[opp1 scores], [opp2 scores], ...]
  if (!Array.isArray(teamScores) || teamScores.length === 0) return null;
  if (!Array.isArray(futureOpponentsScores) || futureOpponentsScores.length === 0) return null;

  const avgTeamScore = average(teamScores);
  if (avgTeamScore === null) return null;

  // Average opponent scores across all future opponents
  let allOppScores = [];
  futureOpponentsScores.forEach(oppScores => {
    if (Array.isArray(oppScores)) {
      allOppScores = allOppScores.concat(oppScores);
    }
  });

  const avgOppScore = average(allOppScores);
  if (avgOppScore === null) return null;

  return avgTeamScore - avgOppScore;
}

export function calculateErrorFunctionCoefficient(mx, mf) {
  // mx and mf are numbers, coefficients in error function calculation
  if (typeof mx !== 'number' || typeof mf !== 'number' || mf === 0) return null;
  return mf > 0 ? (mx / mf) / Math.sqrt(2) : (mx / Math.abs(mf)) / Math.sqrt(2);
}

export function calculateWeeklyWinPercentageProjection(mx, mf) {
  // mx and mf are numbers, used in erf formula for weekly win %
  if (typeof mx !== 'number' || typeof mf !== 'number' || mf === 0) return null;
  const coeff = calculateErrorFunctionCoefficient(mx, mf);
  if (coeff === null) return null;

  if (mf === 0) return 0.5;
  if (mf > 0) return erf(coeff) / 2 + 0.5;
  else return 1 - (erf(coeff) / 2 + 0.5);
}
