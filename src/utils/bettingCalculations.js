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
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);

  return sign * y;
};

/**
 * Helper function to return default zero metrics if data is unavailable.
 */
const getDefaultMetrics = () => ({
  currentDPR: 0,
  averageScore: 0,
  projectedScore: 0,
  averageDifferenceVsOpponent: 0,
  sigmaSquaredOverCount: 0,
  errorFunctionCoefficient: 0,
});

/**
 * Retrieves specific player metrics for a given year from the seasonal metrics.
 * @param {string} playerName - The name of the player.
 * @param {number} year - The year for which to retrieve metrics.
 * @param {Array<Object>} historicalMatchups - All historical matchup data (used to infer latest year).
 * @param {Object} seasonalMetrics - The overall seasonal metrics object, structured as {year: {dprData: [...], weeklyGameScores: {...}}}.
 * @param {Object} weeklyGameScoresByYearAndWeek - Weekly game scores object for calculating future opponent average.
 * @param {Function} getMappedTeamName - Function to get the consistent mapped team name.
 * @returns {Object} Player's metrics for the specified year, or default zeros if not found.
 */
export const getPlayerMetricsForYear = (playerName, year, historicalMatchups, seasonalMetrics, weeklyGameScoresByYearAndWeek, getMappedTeamName) => {
  const mappedPlayerName = getMappedTeamName(playerName);

  // Check if historicalMatchups and seasonalMetrics are valid
  if (!historicalMatchups || historicalMatchups.length === 0 || !seasonalMetrics) {
    console.warn(`getPlayerMetricsForYear: Invalid input - historicalMatchups or seasonalMetrics missing for ${playerName}, Year ${year}`);
    return getDefaultMetrics();
  }

  // MODIFIED: Access the dprData within the seasonalMetrics[year] object
  const seasonDataForYear = seasonalMetrics[year];
  if (!seasonDataForYear || !seasonDataForYear.dprData) {
    console.warn(`getPlayerMetricsForYear: No season data object or dprData found for Year ${year}. Returning default metrics.`);
    return getDefaultMetrics();
  }

  // Find the player's specific data within the dprData array for that year
  const playerSeasonalData = seasonDataForYear.dprData.find(player => getMappedTeamName(player.team) === mappedPlayerName);

  if (!playerSeasonalData) {
    console.warn(`getPlayerMetricsForYear: No player-specific data found for ${mappedPlayerName} in Year ${year}. Returning default metrics.`);
    return getDefaultMetrics();
  }

  // Calculate the average difference vs opponent for the player
  // This value is 'avgPointDifferential' from the player's season data
  const averageDifferenceVsOpponent = playerSeasonalData.avgPointDifferential || 0;

  // Calculate Sigma Squared Over Count for the player
  const sigmaSquaredOverCount = calculateSigmaSquaredOverCount(mappedPlayerName, year, historicalMatchups, getMappedTeamName);

  // Calculate Error Function Coefficient for the player
  const errorFunctionCoefficient = calculateErrorFunctionCoefficient(averageDifferenceVsOpponent, sigmaSquaredOverCount);

  // Get the latest available year from historical matchups to ensure calculations use current context
  const latestYear = historicalMatchups.reduce((maxYear, match) => Math.max(maxYear, parseInt(match.year)), 0);

  // Calculate Future Opponent Average Scoring Difference for projected score
  const futureOpponentAverageScoringDifference = calculateFutureOpponentAverageScoringDifference(mappedPlayerName, latestYear, weeklyGameScoresByYearAndWeek, getMappedTeamName);


  const projectedScore = playerSeasonalData.averageScore + (futureOpponentAverageScoringDifference);


  return {
    currentDPR: playerSeasonalData.dpr || 0,
    averageScore: playerSeasonalData.averageScore || 0,
    projectedScore: projectedScore || 0,
    averageDifferenceVsOpponent: averageDifferenceVsOpponent,
    sigmaSquaredOverCount: sigmaSquaredOverCount,
    errorFunctionCoefficient: errorFunctionCoefficient,
  };
};


/**
 * Calculates Moneyline Odds based on win percentages.
 * @param {number} team1WinPercentage - Win percentage of Team 1 (between 0 and 1).
 * @param {number} team2WinPercentage - Win percentage of Team 2 (between 0 and 1).
 * @returns {Object} An object containing moneyline odds for both teams in standard format (+/-).
 */
export const calculateMoneylineOdds = (team1WinPercentage, team2WinPercentage) => {
  if (typeof team1WinPercentage !== 'number' || isNaN(team1WinPercentage) ||
    typeof team2WinPercentage !== 'number' || isNaN(team2WinPercentage) ||
    team1WinPercentage < 0 || team1WinPercentage > 1 ||
    team2WinPercentage < 0 || team2WinPercentage > 1) {
    return { team1Formatted: '+100', team2Formatted: '+100' }; // Default to even odds
  }

  const calculateOdds = (probability) => {
    if (probability === 0) return '+EV'; // Effectively infinite odds against
    if (probability === 1) return '-EV'; // Effectively infinite odds for

    if (probability > 0.5) {
      // Favorite: (Probability / (1 - Probability)) * -100
      return -((probability / (1 - probability)) * 100);
    } else {
      // Underdog: ((1 - Probability) / Probability) * 100
      return ((1 - probability) / probability) * 100;
    }
  };

  const formatOdds = (odds) => {
    if (odds >= 100) {
      return `+${Math.round(odds)}`;
    } else if (odds <= -100) {
      return `${Math.round(odds)}`;
    } else if (odds > 0 && odds < 100) { // Small positive underdogs
      return `+${Math.round(odds)}`;
    } else if (odds < 0 && odds > -100) { // Small negative favorites
      return `${Math.round(odds)}`;
    } else if (odds === 0) { // Exactly 50/50, typically +100 or -100 in some books
      return '+100';
    }
    return String(Math.round(odds)); // Fallback, shouldn't be hit often
  };


  let odds1 = calculateOdds(team1WinPercentage);
  let odds2 = calculateOdds(team2WinPercentage);

  // If one team is a heavy favorite, the other's implied odds might be very low (close to 0 or even negative)
  // We want to ensure fair odds that sum up to roughly 100% implied probability
  // Re-normalize probabilities if they don't sum to 1 due to independent calculations
  const totalProbability = team1WinPercentage + team2WinPercentage;
  let adjustedTeam1WinPercentage = team1WinPercentage;
  let adjustedTeam2WinPercentage = team2WinPercentage;

  if (totalProbability > 0) { // Avoid division by zero
    adjustedTeam1WinPercentage = team1WinPercentage / totalProbability;
    adjustedTeam2WinPercentage = team2WinPercentage / totalProbability;
  } else {
    // If both are zero or invalid, default to 50/50
    adjustedTeam1WinPercentage = 0.5;
    adjustedTeam2WinPercentage = 0.5;
  }

  odds1 = calculateOdds(adjustedTeam1WinPercentage);
  odds2 = calculateOdds(adjustedTeam2WinPercentage);


  return {
    team1Formatted: formatOdds(odds1),
    team2Formatted: formatOdds(odds2),
  };
};

/**
 * Calculates the Over/Under line for a matchup.
 * @param {number} team1ProjectedScore - The projected score for Team 1.
 * @param {number} team2ProjectedScore - The projected score for Team 2.
 * @returns {number} The calculated Over/Under line. Returns 0 if inputs are invalid.
 */
export const calculateOverUnder = (team1ProjectedScore, team2ProjectedScore) => {
  if (typeof team1ProjectedScore !== 'number' || isNaN(team1ProjectedScore) ||
    typeof team2ProjectedScore !== 'number' || isNaN(team2ProjectedScore)) {
    return 0; // Default to 0 for invalid inputs
  }
  return team1ProjectedScore + team2ProjectedScore;
};

/**
 * Calculates the sum of squared differences from the mean, divided by count (variance-like term).
 * This is used for the standard deviation component in the error function.
 * Formula: SUM((DPR of player in game - Average point differential of player for the year)^2) / Count of games
 * This corresponds to the HZ216 column in the spreadsheet (Sigma^2/N).
 * @param {string} playerName - The name of the player.
 * @param {number} year - The year for which to calculate.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {Function} getMappedTeamName - Function to get the consistent mapped team name.
 * @returns {number} The calculated Sigma Squared Over Count.
 */
export const calculateSigmaSquaredOverCount = (playerName, year, historicalMatchups, getMappedTeamName) => {
  const mappedPlayerName = getMappedTeamName(playerName);
  const playerGamesInYear = historicalMatchups.filter(match =>
    parseInt(match.year) === year &&
    (getMappedTeamName(match.team1) === mappedPlayerName || getMappedTeamName(match.team2) === mappedPlayerName)
  );

  if (playerGamesInYear.length === 0) {
    return 0;
  }

  // First, calculate the player's average point differential for the year
  let totalPointDifferential = 0;
  playerGamesInYear.forEach(match => {
    const isTeam1 = getMappedTeamName(match.team1) === mappedPlayerName;
    const playerPoints = isTeam1 ? match.team1score : match.team2score;
    const opponentPoints = isTeam1 ? match.team2score : match.team1score;
    totalPointDifferential += (playerPoints - opponentPoints);
  });
  const averagePointDifferential = totalPointDifferential / playerGamesInYear.length;

  // Then, calculate the sum of squared differences
  let sumOfSquaredDifferences = 0;
  playerGamesInYear.forEach(match => {
    const isTeam1 = getMappedTeamName(match.team1) === mappedPlayerName;
    const playerPoints = isTeam1 ? match.team1score : match.team2score;
    const opponentPoints = isTeam1 ? match.team2score : match.team1score;
    const gamePointDifferential = playerPoints - opponentPoints;
    sumOfSquaredDifferences += Math.pow(gamePointDifferential - averagePointDifferential, 2);
  });

  return playerGamesInYear.length > 0 ? sumOfSquaredDifferences / playerGamesInYear.length : 0;
};

/**
 * Calculates the Error Function Coefficient.
 * This corresponds to the IR215 column in the spreadsheet.
 * Formula: ((HZ216 * (HZ215)^2)^0.5) / HZ215)
 * Simplified: (Sigma^2/N)^0.5
 * Note: If avgPointDifferential is 0, this simplifies to 0 to prevent division by zero.
 * @param {number} avgPointDifferential - The player's average point differential for the year (HZ215).
 * @param {number} sigmaSquaredOverCount - The player's Sigma Squared Over Count (HZ216).
 * @returns {number} The calculated Error Function Coefficient.
 */
export const calculateErrorFunctionCoefficient = (avgPointDifferential, sigmaSquaredOverCount) => {
  if (typeof sigmaSquaredOverCount !== 'number' || isNaN(sigmaSquaredOverCount) || sigmaSquaredOverCount < 0) {
    return 0;
  }

  // In the spreadsheet, IR215 seems to directly correspond to SQRT(HZ216)
  // If HZ215 (avgPointDifferential) is 0, the formula simplifies or needs special handling.
  // Based on the spreadsheet formula (SQRT(HZ216)/HZ215) * HZ215, it simplifies to SQRT(HZ216)
  // if HZ215 != 0, but if HZ215 == 0, it means the result is 0.
  // The spreadsheet formula might be a bit misleading for the IR215 definition.
  // Given that IR215 is used in ERF(IR215 / HZ215), it's likely just the standard deviation term.
  // Re-evaluating the formula based on common probability distributions, the 'errorCoeffForPlayer'
  // should typically be a standard deviation or a related term.
  // The formula for standard deviation is SQRT(variance). Here sigmaSquaredOverCount is variance/N.
  // Let's assume IR215 should effectively be SQRT(HZ216).

  return Math.sqrt(sigmaSquaredOverCount);
};

/**
 * Calculates the future opponent's average scoring difference based on historical data.
 * This is used for the projected score calculation (KZ215).
 * @param {string} playerName - The name of the player.
 * @param {number} year - The current year.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing weekly game scores.
 * @param {Function} getMappedTeamName - Function to get the consistent mapped team name.
 * @returns {number} The calculated future opponent average scoring difference.
 */
export const calculateFutureOpponentAverageScoringDifference = (playerName, year, weeklyGameScoresByYearAndWeek, getMappedTeamName) => {
  const mappedPlayerName = getMappedTeamName(playerName);
  const relevantYearScores = weeklyGameScoresByYearAndWeek[year];

  if (!relevantYearScores) {
    return 0;
  }

  let totalOpponentScoreDifferential = 0;
  let opponentGamesCount = 0;

  // Iterate through all weeks in the current year
  for (const week in relevantYearScores) {
    const gamesInWeek = relevantYearScores[week];
    gamesInWeek.forEach(game => {
      const team1Mapped = getMappedTeamName(game.team1);
      const team2Mapped = getMappedTeamName(game.team2);

      let opponentScore = 0;
      let playerScore = 0;

      // Find the game where the current player was involved, and get their opponent's score.
      if (team1Mapped === mappedPlayerName) {
        playerScore = game.team1score;
        opponentScore = game.team2score;
      } else if (team2Mapped === mappedPlayerName) {
        playerScore = game.team2score;
        opponentScore = game.team1score;
      }

      if (playerScore > 0 || opponentScore > 0) { // Ensure it's a valid game with scores
        totalOpponentScoreDifferential += (opponentScore - playerScore); // Opponent's score minus player's score
        opponentGamesCount++;
      }
    });
  }

  return opponentGamesCount > 0 ? totalOpponentScoreDifferential / opponentGamesCount : 0;
};


/**
 * Calculates the weekly win percentage projection based on the average differential and error coefficient.
 * This corresponds to column IG215 in the spreadsheet.
 * Formula: ERF((IR215 / HZ215) / SQRT(2)) / 2 + 0.5 if HZ215 > 0
 * 1 - (ERF((IR215 / ABS(HZ215)) / SQRT(2)) / 2 + 0.5) if HZ215 < 0
 * 0.5 if HZ215 = 0
 * Where HZ215 is avgDiffVsOpponentForPlayer, and IR215 is errorCoeffForPlayer
 * @param {number} avgDiffVsOpponentForPlayer - The player's average point differential (HZ215).
 * @param {number} errorCoeffForPlayer - The player's error function coefficient (IR215).
 * @returns {number} The calculated win percentage projection (between 0 and 1). Returns 0.5 for invalid inputs.
 */
export const calculateWeeklyWinPercentageProjection = (avgDiffVsOpponentForPlayer, errorCoeffForPlayer) => {
  if (typeof avgDiffVsOpponentForPlayer !== 'number' || isNaN(avgDiffVsOpponentForPlayer) ||
    typeof errorCoeffForPlayer !== 'number' || isNaN(errorCoeffForPlayer)) {
    return 0.5; // Default to 50% if inputs are invalid
  }

  if (errorCoeffForPlayer === 0) {
    // If errorCoeffForPlayer is 0, it means there's no variability.
    // If avgDiffVsOpponentForPlayer > 0, 100% win. If < 0, 0% win. If 0, 50%.
    if (avgDiffVsOpponentForPlayer > 0) return 1;
    if (avgDiffVsOpponentForPlayer < 0) return 0;
    return 0.5; // If difference is 0 and no error, 50% chance
  }


  let probability;
  const sqrt2 = Math.sqrt(2);

  try {
    if (avgDiffVsOpponentForPlayer > 0) {
      // ERF((IR215 / HZ215) / 2^0.5) / 2 + 0.5
      const arg = (errorCoeffForPlayer / avgDiffVsOpponentForPlayer) / sqrt2;
      probability = erf(arg) / 2 + 0.5;
    } else if (avgDiffVsOpponentForPlayer < 0) {
      // 1 - (ERF((IR215 / ABS(HZ215)) / 2^0.5) / 2 + 0.5)
      const arg = (errorCoeffForPlayer / Math.abs(avgDiffVsOpponentForPlayer)) / sqrt2;
      probability = 1 - (erf(arg) / 2 + 0.5);
    } else {
      probability = 0.5; // If difference is 0, 50% chance
    }
  } catch (e) {
    console.error("Error in calculateWeeklyWinPercentageProjection:", e);
    probability = 0.5; // Fallback in case of unexpected errors
  }

  // Ensure probability is within [0, 1] range due to approximation
  return Math.max(0, Math.min(1, probability));
};
