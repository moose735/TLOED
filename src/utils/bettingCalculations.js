// TLOED/src/utils/bettingCalculations.js

/**
 * Approximates the error function (erf(x)).
 * Used for calculating probabilities in a normal distribution
 * This is a common approximation for erf(x) for x >= 0.
 * For x < 0, erf(x) = -erf(-x).
 * Source: https://en.wikipedia.org/wiki/Error_function#Approximation_with_elementary_functions
 * @param {number} x - The value for which to calculate erf
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
 * Converts decimal odds to American odds (+/-).
 * This function uses the traditional American odds display.
 * @param {number} decimalOdds - The decimal odds (e.g., 2.0 for +100, 1.5 for -200).
 * @returns {string} American odds string (e.g., "+100", "-200"). Returns 'N/A' for invalid input.
 */
const decimalToAmericanOdds = (decimalOdds) => {
  if (typeof decimalOdds !== 'number' || isNaN(decimalOdds) || decimalOdds < 1) {
    return 'N/A';
  }

  // Traditional Logic:
  if (decimalOdds >= 2.0) { // Underdog (+ve odds) including +100
    return "+" + Math.round((decimalOdds - 1) * 100).toString();
  } else { // Favorite (-ve odds)
    return Math.round(-100 / (decimalOdds - 1)).toString();
  }
};

/**
 * Converts American odds string to implied probability.
 * @param {string} americanOdds - American odds string (e.g., "+100", "-200").
 * @returns {number} Implied probability (between 0 and 1). Returns 0 for invalid input.
 */
export const americanOddsToImpliedProbability = (americanOdds) => {
  if (typeof americanOdds !== 'string' || americanOdds === 'N/A') {
    return 0; // Return 0 for invalid or N/A odds
  }

  const oddsNum = parseFloat(americanOdds);

  if (isNaN(oddsNum)) {
    return 0;
  }

  if (oddsNum >= 0) { // Positive American odds (e.g., +100)
    return 100 / (oddsNum + 100);
  } else { // Negative American odds (e.g., -200)
    return Math.abs(oddsNum) / (Math.abs(oddsNum) + 100);
  }
};


/**
 * Calculates moneyline odds for a matchup based on the win probabilities of two players.
 * Includes a configurable overround (vig) to simulate bookmaker profit margin.
 *
 * @param {number} player1WinProb - Calculated win probability of Player 1 (between 0 and 1).
 * @param {number} player2WinProb - Calculated win probability of Player 2 (between 0 and 1).
 * @param {number} [overround=0.0476] - The bookmaker's profit margin expressed as a decimal (e.g., 0.0476 for ~4.76% hold resulting in -110/-110 for 50/50).
 * @returns {{player1Odds: string, player2Odds: string}} Object with American moneyline odds for both players.
 */
export const calculateMoneylineOdds = (player1WinProb, player2WinProb, overround = 0.0476) => {
  // Validate input probabilities
  if (typeof player1WinProb !== 'number' || isNaN(player1WinProb) || player1WinProb < 0 || player1WinProb > 1 ||
      typeof player2WinProb !== 'number' || isNaN(player2WinProb) || player2WinProb < 0 || player2WinProb > 1) {
    return { player1Odds: 'N/A', player2Odds: 'N/A' };
  }

  // Ensure probabilities sum to 1 for fair odds calculation
  const totalProb = player1WinProb + player2WinProb;
  let normalizedProb1 = totalProb > 0 ? player1WinProb / totalProb : 0.5;
  let normalizedProb2 = totalProb > 0 ? player2WinProb / totalProb : 0.5;

  // Apply the overround by adjusting the probabilities themselves.
  // The sum of implied probabilities will be (1 + overround).
  const impliedProb1 = normalizedProb1 * (1 + overround);
  const impliedProb2 = normalizedProb2 * (1 + overround);

  // Convert implied probabilities to decimal odds: Decimal Odds = 1 / Implied Probability
  const viggedDecimalOdds1 = impliedProb1 > 0 ? (1 / impliedProb1) : Infinity;
  const viggedDecimalOdds2 = impliedProb2 > 0 ? (1 / impliedProb2) : Infinity;

  // Convert vigged decimal odds to American odds
  const americanOdds1 = decimalToAmericanOdds(viggedDecimalOdds1);
  const americanOdds2 = decimalToAmericanOdds(viggedDecimalOdds2);

  return {
    player1Odds: americanOdds1,
    player2Odds: americanOdds2,
  };
};

/**
 * Calculates the Over/Under (O/U) total for a matchup based on the average scores of two players.
 *
 * @param {number} player1AvgScore - Average score of Player 1.
 * @param {number} player2AvgScore - Average score of Player 2.
 * @param {number} [lineAdjustment=0] - Optional adjustment to the total line (e.g., -0.5 for a slightly lower line).
 * @returns {string} The calculated O/U total formatted to two decimal places. Returns 'N/A' if scores are invalid.
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
 * Helper function to retrieve a player's all seasonal metrics for a specific year.
 * Updated to return more details needed for advanced calculations.
 * @param {Object} seasonalMetrics - The seasonalMetrics object from calculateAllLeagueMetrics.
 * @param {string} playerName - The name of the player.
 * @param {number} year - The year for which to get data.
 * @returns {{adjustedDPR: number, averageScore: number, totalPointsFor: number, pointsAgainst: number, totalGames: number, weeklyScores: Array<number>}|null} Player's metrics for the year, or null if not found.
 */
export const getPlayerMetricsForYear = (seasonalMetrics, playerName, year) => {
  if (seasonalMetrics && seasonalMetrics[year] && seasonalMetrics[year][playerName]) {
    const playerStats = seasonalMetrics[year][playerName];
    return {
      adjustedDPR: playerStats.adjustedDPR || 0, // Using adjustedDPR for win probability
      averageScore: playerStats.averageScore || 0,
      totalPointsFor: playerStats.pointsFor || 0,
      pointsAgainst: playerStats.pointsAgainst || 0,
      totalGames: playerStats.totalGames || 0,
      weeklyScores: playerStats.weeklyScores || [],
    };
  }
  return null;
};

/**
 * Calculates the weekly win percentage projection purely based on the relative seasonal DPR/average scores of two players.
 * A higher DPR/average score implies a higher win probability.
 *
 * @param {number} player1DPR - Player 1's seasonal Adjusted DPR or average score.
 * @param {number} player2DPR - Player 2's seasonal Adjusted DPR or average score.
 * @returns {number} The calculated win percentage for Player 1 (between 0 and 1). Returns 0.5 for invalid or equal inputs.
 */
export const calculateWeeklyWinPercentageProjection = (player1DPR, player2DPR) => {
  if (typeof player1DPR !== 'number' || isNaN(player1DPR) ||
      typeof player2DPR !== 'number' || isNaN(player2DPR)) {
    return 0.5; // Default to 50% if inputs are invalid
  }

  // If both DPRs are zero or equal, it's a 50/50
  if (player1DPR === player2DPR) {
    return 0.5;
  }

  // Simple proportional probability:
  // Prob1 = DPR1 / (DPR1 + DPR2)
  // This approach makes the player with higher DPR have a higher probability.
  const totalDPR = player1DPR + player2DPR;

  if (totalDPR === 0) {
    // If both DPRs are 0 (e.g., very early season before data), treat as 50/50
    return 0.5;
  }

  const player1WinProbability = player1DPR / totalDPR;

  // Ensure probability is within [0, 1] range due to potential floating point quirks
  return Math.max(0, Math.min(1, player1WinProbability));
};

// The following functions are no longer directly used by the simplified calculateWeeklyWinPercentageProjection
// but are kept here for reference or if they are used elsewhere in your application.
// If they are not used anywhere else, you can remove them to reduce code size.

/**
 * Calculates the average difference in points scored by a team vs all of their opponents for a given season up to a certain week.
 * This is interpreted as the team's average point differential (Points For - Points Against) per game.
 * It uses historical matchups to get *actual* scores up to the given week for a more accurate rolling average.
 *
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year.
 * @param {number} currentWeek - The current week to calculate stats up to.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Helper function to map team names.
 * @returns {number} The average point differential for the team up to the current week.
 */
export const calculateTeamAverageDifferenceVsOpponent = (teamName, year, currentWeek, historicalMatchups, getMappedTeamName) => {
  let totalPointsFor = 0;
  let totalPointsAgainst = 0;
  let gamesCounted = 0;

  historicalMatchups.forEach(match => {
    const matchYear = parseInt(match.year);
    const matchWeek = parseInt(match.week);
    const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
    const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());

    if (matchYear === year && matchWeek < currentWeek && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
      let score = 0;
      if (displayTeam1 === teamName) {
        score = parseFloat(match.team1Score || '0');
        totalPointsAgainst += parseFloat(match.team2Score || '0');
      } else if (displayTeam2 === teamName) {
        score = parseFloat(match.team2Score || '0');
        totalPointsAgainst += parseFloat(match.team1Score || '0');
      }

      if (score !== 0) { // Only count if a valid score
        totalPointsFor += score;
        gamesCounted++;
      }
    }
  });

  return gamesCounted > 0 ? (totalPointsFor - totalPointsAgainst) / gamesCounted : 0;
};


/**
 * Calculates Sigma Squared over Count, representing the variance of a team's weekly scores
 * relative to its own seasonal average score, up to a given week.
 * Formula: Sum((WeeklyScore - SeasonalAverage)^2) / NumberOfWeeksPlayed
 *
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year.
 * @param {number} currentWeek - The current week to calculate stats up to.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Helper function to map team names.
 * @returns {number} The calculated Sigma Squared over Count.
 */
export const calculateSigmaSquaredOverCount = (teamName, year, currentWeek, historicalMatchups, getMappedTeamName) => {
  let weeklyScoresForSeasonUpToWeek = [];
  let totalScoreUpToWeek = 0;
  let gamesCounted = 0;

  historicalMatchups.forEach(match => {
    const matchYear = parseInt(match.year);
    const matchWeek = parseInt(match.week);
    const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
    const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());

    if (matchYear === year && matchWeek < currentWeek && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
      let score = 0;
      if (displayTeam1 === teamName) {
        score = parseFloat(match.team1Score || '0');
      } else if (displayTeam2 === teamName) {
        score = parseFloat(match.team2Score || '0');
      }

      if (score !== 0) { // Only count if a valid score
        weeklyScoresForSeasonUpToWeek.push(score);
        totalScoreUpToWeek += score;
        gamesCounted++;
      }
    }
  });

  if (gamesCounted < 2) { // Need at least 2 data points for variance calculation to be meaningful, avoid division by zero for population variance if gamesCounted = 1
    return 0;
  }

  const averageScoreUpToWeek = totalScoreUpToWeek / gamesCounted;
  let sumOfSquaredDifferences = 0;

  for (const score of weeklyScoresForSeasonUpToWeek) {
    sumOfSquaredDifferences += Math.pow(score - averageScoreUpToWeek, 2);
  }

  // Using population variance (N) as implied by "over Count"
  return sumOfSquaredDifferences / gamesCounted;
};


/**
 * Finds the average scoring difference for a specific matchup in a given year,
 * using the average scores *for that week/season* up to the current week.
 * This is interpreted as (Team's Season Average Score Up To Week) - (Opponent's Season Average Score Up To Week).
 *
 * @param {string} team1Name - The name of the first team.
 * @param {string} team2Name - The name of the second team (opponent).
 * @param {number} year - The year.
 * @param {number} currentWeek - The current week to calculate averages up to.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Helper function to map team names.
 * @returns {number} The difference in average scores.
 */
export const calculateFutureOpponentAverageScoringDifference = (team1Name, team2Name, year, currentWeek, historicalMatchups, getMappedTeamName) => {
  const getAverageScoreUpToWeek = (team, year, week, matches, mapper) => {
    let totalScore = 0;
    let games = 0;
    matches.forEach(match => {
      const matchYear = parseInt(match.year);
      const matchWeek = parseInt(match.week);
      const displayTeam1 = mapper(String(match.team1 || '').trim());
      const displayTeam2 = mapper(String(match.team2 || '').trim());

      if (matchYear === year && matchWeek < week && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
        if (displayTeam1 === team) {
          totalScore += parseFloat(match.team1Score || '0');
          games++;
        } else if (displayTeam2 === team) {
          totalScore += parseFloat(match.team2Score || '0');
          games++;
        }
      }
    });
    return games > 0 ? totalScore / games : 0;
  };

  const player1AvgScore = getAverageScoreUpToWeek(team1Name, year, currentWeek, historicalMatchups, getMappedTeamName);
  const player2AvgScore = getAverageScoreUpToWeek(team2Name, year, currentWeek, historicalMatchups, getMappedTeamName);

  return player1AvgScore - player2AvgScore;
};


/**
 * Calculates an error function coefficient based on average difference vs opponent and standard deviation.
 * Formula: (avgDiffVsOpponent / StandardDeviation) * (avgDiffVsOpponent / 2)
 * StandardDeviation is derived from sigmaSquaredOverCount (variance).
 * @param {number} avgDiffVsOpponent - The average difference in points scored vs opponents (HZ215).
 * @param {number} sigmaSquaredOverCount - The sigma squared over count value (variance).
 * @returns {number} The calculated error function coefficient (IR215).
 */
export const calculateErrorFunctionCoefficient = (avgDiffVsOpponent, sigmaSquaredOverCount) => {
  const standardDeviation = Math.sqrt(sigmaSquaredOverCount);

  if (standardDeviation === 0 || isNaN(standardDeviation) || typeof standardDeviation !== 'number') {
    return 0;
  }
  if (typeof avgDiffVsOpponent !== 'number' || isNaN(avgDiffVsOpponent)) {
    return 0;
  }
  return (avgDiffVsOpponent / standardDeviation) * (avgDiffVsOpponent / 2);
};
