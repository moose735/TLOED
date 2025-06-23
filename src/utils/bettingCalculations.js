// TLOED/src/utils/bettingCalculations.js

// Error function approximation (used for win %)
const erf = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
};

export const calculateAverageScore = (teamName, year, currentWeek, matchups, mapName) => {
  const scores = matchups
    .filter(m => +m.year === year && +m.week < currentWeek)
    .flatMap(m => {
      const t1 = mapName(m.team1), t2 = mapName(m.team2);
      if (t1 === teamName) return [+m.team1Score || 0];
      if (t2 === teamName) return [+m.team2Score || 0];
      return [];
    });
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
};

export const calculateSigmaSquaredOverCount = (teamName, year, currentWeek, matchups, mapName) => {
  const scores = matchups
    .filter(m => +m.year === year && +m.week < currentWeek)
    .flatMap(m => {
      const t1 = mapName(m.team1), t2 = mapName(m.team2);
      if (t1 === teamName) return [+m.team1Score || 0];
      if (t2 === teamName) return [+m.team2Score || 0];
      return [];
    });
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return scores.length ? scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length : 0;
};

export const calculateErrorFunctionCoefficient = (avgDiff, opponentStdDev) => {
  if (!opponentStdDev || isNaN(opponentStdDev)) return 0;
  return (avgDiff / opponentStdDev) * (avgDiff / 2);
};

export const calculateWinPercentage = (avgDiff, coefficient) => {
  if (!isFinite(avgDiff) || !isFinite(coefficient)) return 0.5;
  if (avgDiff === 0) return 0.5;
  const arg = Math.abs(coefficient / avgDiff) / Math.sqrt(2);
  const erfVal = erf(arg) / 2 + 0.5;
  return avgDiff > 0 ? erfVal : 1 - erfVal;
};

export const calculateMoneylineOdds = (p1, p2, overround = 0.0909) => {
  const normalize = p => (p / (p1 + p2)) * (1 + overround);
  const d1 = 1 / normalize(p1), d2 = 1 / normalize(p2);
  const toAmerican = d => (d >= 2 ? `+${Math.round((d - 1) * 100)}` : `${Math.round(-100 / (d - 1))}`);
  return {
    team1Formatted: toAmerican(d1),
    team2Formatted: toAmerican(d2),
  };
};

export const calculateOverUnder = (avg1, avg2) => (avg1 + avg2).toFixed(2);
