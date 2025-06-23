// TLOED/src/utils/bettingCalculations.js

const erf = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
};

export const calculateSigmaSquaredOverCount = (teamName, year, currentWeek, matchups, getMappedName) => {
  const scores = [];
  matchups.forEach(match => {
    if (+match.year !== year || +match.week >= currentWeek) return;
    const t1 = getMappedName(match.team1), t2 = getMappedName(match.team2);
    if (t1 === teamName) scores.push(+match.team1Score || 0);
    else if (t2 === teamName) scores.push(+match.team2Score || 0);
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length || 0;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / (scores.length || 1);
  return variance;
};

export const calculateAverageScore = (teamName, year, currentWeek, matchups, getMappedName) => {
  let total = 0, count = 0;
  matchups.forEach(match => {
    if (+match.year !== year || +match.week >= currentWeek) return;
    const t1 = getMappedName(match.team1), t2 = getMappedName(match.team2);
    if (t1 === teamName) { total += +match.team1Score || 0; count++; }
    else if (t2 === teamName) { total += +match.team2Score || 0; count++; }
  });
  return count > 0 ? total / count : 0;
};

export const calculateErrorFunctionCoefficient = (diff, oppStdDev) => {
  if (!oppStdDev || isNaN(oppStdDev)) return 0;
  return (diff / oppStdDev) * (diff / 2);
};

export const calculateWinPercentage = (diff, coeff) => {
  if (!isFinite(diff) || !isFinite(coeff)) return 0.5;
  if (diff === 0) return 0.5;
  const sqrt2 = Math.sqrt(2);
  const arg = Math.abs(coeff / diff) / sqrt2;
  const erfVal = erf(arg) / 2 + 0.5;
  return diff > 0 ? erfVal : 1 - erfVal;
};

export const calculateMoneylineOdds = (p1Win, p2Win, overround = 0.0909) => {
  const total = p1Win + p2Win;
  if (total === 0) return { team1Formatted: 'N/A', team2Formatted: 'N/A' };
  const n1 = p1Win / total, n2 = p2Win / total;
  const d1 = 1 / n1 * (1 + overround), d2 = 1 / n2 * (1 + overround);

  const convert = d => d >= 2 ? `+${Math.round((d - 1) * 100)}` : `${Math.round(-100 / (d - 1))}`;
  return {
    team1Formatted: convert(d1),
    team2Formatted: convert(d2),
  };
};

export const calculateOverUnder = (avg1, avg2) => {
  return (avg1 + avg2).toFixed(2);
};
