// TLOED/src/utils/bettingCalculations.js

/**
 * Approximates the error function (erf(x)).
 * Used for calculating probabilities in a normal distribution.
 * This is a common approximation for erf(x) for x >= 0.
 * For x < 0, erf(x) = -erf(-x).
 * Source: https://en.wikipedia.org/wiki/Error_function#Approximation_with_elementary_functions
 * @param {number} x - The value for which to calculate erf.
 * @returns {number} The approximate erf(x) value.
 */
const erf = (x) => {
  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Handle negative x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  // Approximation calculation
  const t = 1.0 / (1.0 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
};


/**
 * Converts a decimal probability (e.g., 0.75) to American odds (+/-).
 * @param {number} probability - The probability (between 0 and 1).
 * @returns {string} American odds string (e.g., "+300", "-150").
 */
const probToAmericanOdds = (probability) => {
  if (typeof probability !== 'number' || isNaN(probability) || probability <= 0 || probability >= 1) {
    return 'N/A';
  }

  if (probability > 0.5) {
    // Favorite: -ve odds (e.g., -150)
    const odds = (probability / (1 - probability)) * -100;
    return Math.round(odds).toString();
  } else {
    // Underdog: +ve odds (e.g., +200)
    const odds = ((1 - probability) / probability) * 100;
    return "+" + Math.round(odds).toString();
  }
};

/**
 * Calculates moneyline odds for a matchup based on the win probabilities of two players.
 * Includes a configurable overround (vig) to simulate bookmaker profit margin.
 *
 * @param {number} player1WinProb - Calculated win probability of Player 1 (between 0 and 1).
 * @param {number} player2WinProb - Calculated win probability of Player 2 (between 0 and 1).
 * @param {number} [overround=0.20] - The bookmaker's profit margin (e.g., 0.20 for 20% overround).
 * @returns {{player1Odds: string, player2Odds: string}} Object with American moneyline odds for both players.
 */
export const calculateMoneylineOdds = (player1WinProb, player2WinProb, overround = 0.20) => {
  if (typeof player1WinProb !== 'number' || isNaN(player1WinProb) || player1WinProb < 0 || player1WinProb > 1 ||
      typeof player2WinProb !== 'number' || isNaN(player2WinProb) || player2WinProb < 0 || player2WinProb > 1) {
    return { player1Odds: 'N/A', player2Odds: 'N/A' };
  }

  // Apply overround (vig) to the probabilities by increasing the sum of probabilities above 1.0
  // First, convert probabilities to implied odds without vig (decimal format, sum to 1)
  const impliedOdds1 = 1 / player1WinProb;
  const impliedOdds2 = 1 / player2WinProb;

  // Calculate true probabilities considering ties or other outcomes if necessary.
  // Here, we assume a two-outcome scenario (win/loss).
  // The overround is applied by inflating the probabilities, then re-normalizing.
  const totalProb = player1WinProb + player2WinProb;
  let adjustedProb1 = player1WinProb / totalProb; // Normalize true probabilities first
  let adjustedProb2 = player2WinProb / totalProb;

  // Apply the overround by increasing the denominators of the implied odds.
  // This effectively reduces the payout.
  const vigFactor = 1 + overround;
  const viggedProb1 = adjustedProb1 * vigFactor;
  const viggedProb2 = adjustedProb2 * vigFactor;

  // Re-normalize these vigged probabilities to sum up to 1 for conversion to American odds,
  // but the *relative* difference incorporates the vig.
  const finalNormFactor = viggedProb1 + viggedProb2;
  const finalPlayer1Prob = viggedProb1 / finalNormFactor;
  const finalPlayer2Prob = viggedProb2 / finalNormFactor;


  return {
    player1Odds: probToAmericanOdds(finalPlayer1Prob),
    player2Odds: probToAmericanOdds(finalPlayer2Prob),
  };
};

/**
 * Calculates the Over/Under (O/U) total for a matchup based on the average scores of two players.
 *
 * @param {number} player1AvgScore - Average score of Player 1.
 * @param {number} player2AvgScore - Average score of Player 2.
 * @param {number} [lineAdjustment=0] - Optional adjustment to the total line (e.g., -0.5 for a slightly lower line).
 * @returns {number} The calculated O/U total. Returns 'N/A' if scores are invalid.
 */
export const calculateOverUnder = (player1AvgScore, player2AvgScore, lineAdjustment = 0) => {
  if (typeof player1AvgScore !== 'number' || isNaN(player1AvgScore) ||
      typeof player2AvgScore !== 'number' || isNaN(player2AvgScore)) {
    return 'N/A';
  }
  const totalScore = player1AvgScore + player2AvgScore;
  return (totalScore + lineAdjustment).toFixed(2); // Format to 2 decimal places
};

/**
 * Helper function to retrieve a player's adjusted DPR and average score for a specific year.
 * @param {Object} seasonalMetrics - The seasonalMetrics object from calculateAllLeagueMetrics.
 * @param {string} playerName - The name of the player.
 * @param {number} year - The year for which to get data.
 * @returns {{adjustedDPR: number, averageScore: number, totalPointsFor: number, pointsAgainst: number, totalGames: number, weeklyScores: Array<number>}|null} Player's metrics for the year, or null if not found.
 */
export const getPlayerMetricsForYear = (seasonalMetrics, playerName, year) => {
  if (seasonalMetrics && seasonalMetrics[year] && seasonalMetrics[year][playerName]) {
    const playerStats = seasonalMetrics[year][playerName];
    return {
      adjustedDPR: playerStats.adjustedDPR || 0,
      averageScore: playerStats.averageScore || 0,
      totalPointsFor: playerStats.pointsFor || 0,
      pointsAgainst: playerStats.pointsAgainst || 0, // This is total points against
      totalGames: playerStats.totalGames || 0,
      weeklyScores: playerStats.weeklyScores || [], // Array of individual weekly scores
    };
  }
  return null;
};

/**
 * Calculates the average difference in points scored vs all of their opponents for a team in a given season.
 * This is interpreted as the team's average point differential (Points For - Points Against) per game.
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year.
 * @param {Object} seasonalMetrics - The seasonalMetrics object.
 * @returns {number} The average point differential.
 */
export const calculateTeamAverageDifferenceVsOpponent = (teamName, year, seasonalMetrics) => {
  const playerMetrics = getPlayerMetricsForYear(seasonalMetrics, teamName, year);
  if (!playerMetrics || playerMetrics.totalGames === 0) {
    return 0; // Return 0 if no games or metrics
  }
  const totalPointDifferential = playerMetrics.totalPointsFor - playerMetrics.pointsAgainst;
  return totalPointDifferential / playerMetrics.totalGames;
};

/**
 * Calculates Sigma Squared over Count, interpreted as the variance of a team's weekly scores
 * relative to its own seasonal average score, divided by the number of games.
 * Formula: Sum((WeeklyScore - SeasonalAverage)^2) / NumberOfWeeks
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year.
 * @param {Object} seasonalMetrics - The seasonalMetrics object.
 * @returns {number} The calculated Sigma Squared over Count.
 */
export const calculateSigmaSquaredOverCount = (teamName, year, seasonalMetrics) => {
  const playerMetrics = getPlayerMetricsForYear(seasonalMetrics, teamName, year);
  if (!playerMetrics || playerMetrics.totalGames === 0 || playerMetrics.weeklyScores.length === 0) {
    return 0;
  }

  const { weeklyScores, averageScore } = playerMetrics;
  let sumOfSquaredDifferences = 0;

  for (const score of weeklyScores) {
    if (typeof score === 'number' && !isNaN(score)) {
      sumOfSquaredDifferences += Math.pow(score - averageScore, 2);
    }
  }

  // Using population variance (N) as implied by "over Count"
  return sumOfSquaredDifferences / weeklyScores.length;
};


/**
 * Finds the average scoring difference for a team vs a specific opponent in a given year.
 * This is interpreted as (Team's Season Average Score) - (Opponent's Season Average Score).
 * @param {string} team1Name - The name of the first team.
 * @param {string} team2Name - The name of the second team (opponent).
 * @param {number} year - The year.
 * @param {Object} seasonalMetrics - The seasonalMetrics object.
 * @returns {number} The difference in average scores.
 */
export const calculateFutureOpponentAverageScoringDifference = (team1Name, team2Name, year, seasonalMetrics) => {
  const player1Metrics = getPlayerMetricsForYear(seasonalMetrics, team1Name, year);
  const player2Metrics = getPlayerMetricsForYear(seasonalMetrics, team2Name, year);

  if (!player1Metrics || !player2Metrics) {
    return 0; // Return 0 if metrics are not available
  }

  return player1Metrics.averageScore - player2Metrics.averageScore;
};

/**
 * Calculates an error function coefficient based on average difference vs opponent and sigma squared over count.
 * Formula: (avgDiffVsOpponent / sigmaSquaredOverCount) * (avgDiffVsOpponent / 2)
 * @param {number} avgDiffVsOpponent - The average difference in points scored vs opponents (HZ215).
 * @param {number} sigmaSquaredOverCount - The sigma squared over count value (variance).
 * @returns {number} The calculated error function coefficient (IR215).
 */
export const calculateErrorFunctionCoefficient = (avgDiffVsOpponent, sigmaSquaredOverCount) => {
  if (sigmaSquaredOverCount === 0) {
    return 0; // Avoid division by zero
  }
  return (avgDiffVsOpponent / sigmaSquaredOverCount) * (avgDiffVsOpponent / 2);
};

/**
 * Calculates the weekly win percentage projection using the provided ERF-based formula.
 * Formula: =IFERROR(
 *   IF(
 *     HZ215 = 0,
 *     0.5,
 *     IF(
 *       HZ215 > 0,
 *       ERF((IR215 / HZ215) / 2^0.5) / 2 + 0.5,
 *       1 - (ERF((IR215 / ABS(HZ215)) / 2^0.5) / 2 + 0.5)
 *     )
 *   ),
 * "")
 * HZ215 = Player's Average difference vs opponent for the current week/season
 * IR215 = Player's Error Function Coefficient for the current week/season
 * @param {number} avgDiffVsOpponentForPlayer - The player's average point differential (HZ215).
 * @param {number} errorCoeffForPlayer - The player's error function coefficient (IR215).
 * @returns {number} The calculated win percentage projection (between 0 and 1).
 */
export const calculateWeeklyWinPercentageProjection = (avgDiffVsOpponentForPlayer, errorCoeffForPlayer) => {
  if (avgDiffVsOpponentForPlayer === 0) {
    return 0.5; // If difference is 0, 50% chance
  }

  let probability;
  const sqrt2 = Math.sqrt(2);

  if (avgDiffVsOpponentForPlayer > 0) {
    // ERF((IR215 / HZ215) / 2^0.5) / 2 + 0.5
    const arg = (errorCoeffForPlayer / avgDiffVsOpponentForPlayer) / sqrt2;
    probability = erf(arg) / 2 + 0.5;
  } else {
    // 1 - (ERF((IR215 / ABS(HZ215)) / 2^0.5) / 2 + 0.5)
    const arg = (errorCoeffForPlayer / Math.abs(avgDiffVsOpponentForPlayer)) / sqrt2;
    probability = 1 - (erf(arg) / 2 + 0.5);
  }

  // Ensure probability is within [0, 1] range due to approximations or extreme values
  return Math.max(0, Math.min(1, probability));
};
