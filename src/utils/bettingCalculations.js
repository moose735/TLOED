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

/**
 * Converts win probability (0 to 1) to American moneyline odds.
 * @param {number} winProb - Probability of winning (0 to 1)
 * @returns {number} Moneyline odds (positive or negative integer)
 */
export function calculateMoneylineOdds(winProb) {
  if (winProb <= 0 || winProb >= 1) return null;

  if (winProb >= 0.5) {
    return Math.round(-100 * (winProb / (1 - winProb)));
  } else {
    return Math.round(100 * ((1 - winProb) / winProb));
  }
}

/**
 * Calculate the over/under line for two teams based on their average points scored.
 * @param {number[]} teamAScores - Array of historical points scored by team A this season.
 * @param {number[]} teamBScores - Array of historical points scored by team B this season.
 * @returns {number|null} Over/Under line rounded to 1 decimal place, or null if no data.
 */
export function calculateOverUnder(teamAScores, teamBScores) {
  if (!teamAScores.length || !teamBScores.length) return null; // no data

  const avgA = average(teamAScores);
  const avgB = average(teamBScores);

  const overUnder = avgA + avgB;

  return parseFloat(overUnder.toFixed(1));
}

async function getMatchupsData() {
  const res = await fetch(MATCHUPS_URL);
  const json = await res.json();
  const allMatchups = json.data;

  // Find the latest year in the dataset to represent the current season
  const currentYear = Math.max(...allMatchups.map(g => g.year));
  // Filter only matchups from the current year
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

/**
 * Generate betting lines including:
 * - Point spread (line)
 * - Win probability (%)
 * - Over/Under line (total points)
 * - Moneyline odds (American odds)
 */
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
      const overUnder = calculateOverUnder(scoresA, scoresB);
      const moneylineA = calculateMoneylineOdds(winProb);
      const moneylineB = calculateMoneylineOdds(1 - winProb);

      lines.push({
        matchup: `${teamA} vs ${teamB}`,
        line: avgDiff.toFixed(1),
        winProb: (winProb * 100).toFixed(1) + '%',
        overUnder: overUnder !== null ? overUnder : 'N/A',
        moneyline: {
          [teamA]: moneylineA !== null ? moneylineA : 'N/A',
          [teamB]: moneylineB !== null ? moneylineB : 'N/A'
        }
      });
    }
  }
  return lines;
}

// Main export: generate betting lines for current season
export default async function getBettingLines() {
  const { currentSeason } = await getMatchupsData();
  const teamScores = buildTeamScoresMap(currentSeason);
  return generateLines(teamScores);
}

// Exported function to get per-team player metrics by year (needed for your build)
export async function getPlayerMetricsForYear(year) {
  const res = await fetch(MATCHUPS_URL);
  const json = await res.json();
  const games = json.data.filter(g => g.year === year);

  const stats = {};

  for (const game of games) {
    const { team1, team2, team1Score, team2Score } = game;

    if (!stats[team1]) stats[team1] = [];
    if (!stats[team2]) stats[team2] = [];

    stats[team1].push(team1Score);
    stats[team2].push(team2Score);
  }

  return Object.entries(stats).map(([team, scores]) => {
    const avg = average(scores);
    const std = standardDeviation(scores);
    return {
      team,
      average: parseFloat(avg.toFixed(2)),
      stdDev: parseFloat(std.toFixed(2)),
      gamesPlayed: scores.length
    };
  });
}
