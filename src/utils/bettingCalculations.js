// src/utils/bettingCalculations.js

// Approximate error function (erf)
export function erf(x) {
  const sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// ...rest of your code below, unchanged

// Helper: Get weekly scores by team and year
export function getWeeklyScoresByTeam(historicalMatchups, getMappedTeamName) {
  const weeklyScores = {};
  historicalMatchups.forEach(game => {
    const year = game.year;
    const week = game.week;
    const team1 = getMappedTeamName(game.team1);
    const team2 = getMappedTeamName(game.team2);
    const score1 = parseFloat(game.score1);
    const score2 = parseFloat(game.score2);

    if (!weeklyScores[year]) weeklyScores[year] = {};
    if (!weeklyScores[year][team1]) weeklyScores[year][team1] = {};
    if (!weeklyScores[year][team2]) weeklyScores[year][team2] = {};

    weeklyScores[year][team1][week] = score1;
    weeklyScores[year][team2][week] = score2;
  });
  return weeklyScores;
}

function getAverage(scores) {
  const values = Object.values(scores);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getStandardDeviation(scores) {
  const avg = getAverage(scores);
  const values = Object.values(scores);
  const variance = values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function getPlayerMetricsForYear(team, opponent, year, weeklyScores) {
  const teamScores = weeklyScores[year]?.[team] || {};
  const opponentScores = weeklyScores[year]?.[opponent] || {};

  const teamAvg = getAverage(teamScores);
  const opponentAvg = getAverage(opponentScores);

  const sigma = getStandardDeviation(opponentScores);
  const avgDiff = teamAvg - opponentAvg;

  const errorFnCoefficient = sigma === 0 ? 0 : (avgDiff / sigma) * (avgDiff / 2);
  const winPct = avgDiff === 0 ? 0.5 : (avgDiff > 0
    ? erf(errorFnCoefficient / Math.sqrt(2)) / 2 + 0.5
    : 1 - (erf(Math.abs(errorFnCoefficient) / Math.sqrt(2)) / 2 + 0.5)
  );

  return {
    teamAvg,
    opponentAvg,
    sigma,
    avgDiff,
    errorFnCoefficient,
    winPct
  };
}

export function calculateMoneylineOdds(team1Pct, team2Pct) {
  const pctToOdds = (pct) => {
    if (pct === 0.5) return '-110';
    return pct > 0.5
      ? `-${Math.round((pct / (1 - pct)) * 100)}`
      : `+${Math.round(((1 - pct) / pct) * 100)}`;
  };
  return {
    team1: pctToOdds(team1Pct),
    team2: pctToOdds(team2Pct)
  };
}

export function calculateOverUnder(team1Avg, team2Avg) {
  return (team1Avg + team2Avg).toFixed(2);
}
