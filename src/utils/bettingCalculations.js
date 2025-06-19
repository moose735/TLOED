// TLOED/src/utils/bettingCalculations.js

/**
 * Converts a decimal probability (e.g., 0.75) to American odds (+/-).
 * @param {number} probability - The probability (between 0 and 1).
 * @returns {string} American odds string (e.g., "+300", "-150").
 */
const probToAmericanOdds = (probability) => {
  if (probability <= 0 || probability >= 1) {
    // Edge cases: if prob is 0 or 1, it's effectively infinite odds or no odds.
    // In real sportsbooks, this would indicate a guaranteed win/loss, which is rare.
    // We can return a very high positive or negative number to indicate extreme odds.
    if (probability <= 0) return "+9999"; // Very high underdog odds
    if (probability >= 1) return "-9999"; // Very high favorite odds
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
 * Calculates moneyline odds for a matchup based on the adjusted DPR of two players.
 * Assumes a higher DPR implies a higher probability of winning.
 * Includes a configurable overround (vig) to simulate bookmaker profit margin.
 *
 * @param {number} player1DPR - Adjusted DPR of Player 1.
 * @param {number} player2DPR - Adjusted DPR of Player 2.
 * @param {number} [overround=0.05] - The bookmaker's profit margin (e.g., 0.05 for 5% overround).
 * @returns {{player1Odds: string, player2Odds: string}} Object with American moneyline odds for both players.
 */
export const calculateMoneylineOdds = (player1DPR, player2DPR, overround = 0.05) => {
  if (player1DPR <= 0 && player2DPR <= 0) {
    // Handle cases where both DPRs are zero or negative, indicating no data or invalid data.
    // In such a scenario, we can't reliably calculate odds, so return a default or error indicator.
    return { player1Odds: 'N/A', player2Odds: 'N/A' };
  }

  // Calculate implied probability based on relative DPR
  const totalDPR = player1DPR + player2DPR;
  let prob1 = totalDPR > 0 ? player1DPR / totalDPR : 0.5; // Default to 50/50 if totalDPR is 0
  let prob2 = totalDPR > 0 ? player2DPR / totalDPR : 0.5;

  // Apply overround (vig) to the probabilities
  // The sum of implied probabilities will be > 1.0 (e.g., 1.05 for 5% overround)
  const adjustedProb1 = prob1 * (1 + overround);
  const adjustedProb2 = prob2 * (1 + overround);

  // Normalize probabilities to ensure they don't exceed 1 for the probToAmericanOdds function,
  // while still reflecting the overround in their relative values.
  // This approach ensures the vig is applied while converting to odds.
  const normalizingFactor = adjustedProb1 + adjustedProb2;
  const finalProb1 = adjustedProb1 / normalizingFactor;
  const finalProb2 = adjustedProb2 / normalizingFactor;


  return {
    player1Odds: probToAmericanOdds(finalProb1),
    player2Odds: probToAmericanOdds(finalProb2),
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
 * @returns {{adjustedDPR: number, averageScore: number}|null} Player's metrics for the year, or null if not found.
 */
export const getPlayerMetricsForYear = (seasonalMetrics, playerName, year) => {
  if (seasonalMetrics && seasonalMetrics[year] && seasonalMetrics[year][playerName]) {
    const playerStats = seasonalMetrics[year][playerName];
    return {
      adjustedDPR: playerStats.adjustedDPR || 0,
      averageScore: playerStats.averageScore || 0,
    };
  }
  return null;
};
