// utils/bettingCalculations.js

const MATCHUPS_URL = 'https://script.google.com/macros/s/AKfycbxpo21zzZgNamYShESfqe-SX09miJz2LK7SpdlYrtHXQplneB3bF2xu2byy0HhjM8e-/exec';

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
  const avg = average(arr);
  const variance = arr.reduce((sum, score) => sum + (score - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function winProbability(diff, combinedStdDev) {
  if (diff === 0) return 0.5;
  const z = diff / (Math.sqrt(2) * combinedStdDev);
  return diff > 0 ? (erf(z) / 2 + 0.5) : (1 - (erf(Math.abs(z)) / 2 + 0.5));
}

async function getMatchupsData() {
  const res = await fetch(MATCHUPS_URL);
  const json = await res.json();
  const allMatchups = json.data;

  const currentYear = Math.max(...allMatchups.map(g => g.year));
  const currentSeason = allMatchups.filter(g => g.year === currentYear);

  return { currentSeason, currentYear };
}

function buildTeamScoresMap(matchups) {
  const scores = {};
  matchups.forEach(g => {
    if (!scores[g.team1]) scores[g.team1] = [];
    if (!scores[g.team2]) scores[g.team2] = [];
    scores[g.team1].push(g.team1Score);
    scores[g.team2].push(g.team2Score);
  });
  return scores;
}

function generateLines(teamScores) {
  const lines = [];
  const teams = Object.keys(teamScores);

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i], teamB = teams[j];
      const scoresA = teamScores[teamA], scoresB = teamScores[teamB];
      const avgA = average(scoresA), avgB = average(scoresB);
      const stdA = standardDeviation(scoresA), stdB = standardDeviation(scoresB);
      const avgDiff = avgA - avgB;
      const combinedStd = Math.sqrt(stdA ** 2 + stdB ** 2);
      const winProb = winProbability(avgDiff, combinedStd);

      lines.push({
        matchup: `${teamA} vs ${teamB}`,
        line: avgDiff.toFixed(1),
        winProb: (winProb * 100).toFixed(1) + '%'
      });
    }
  }
  return lines;
}

export default async function getBettingLines() {
  const { currentSeason, currentYear } = await getMatchupsData();
  const teamScores = buildTeamScoresMap(currentSeason);
  const lines = generateLines(teamScores);
  return lines;
}
