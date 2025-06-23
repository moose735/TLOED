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
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)); // Corrected calculation based on source
  return sign * y;
};


/**
 * Calculates the average point differential for a given team against their opponents.
 * This is used to determine how well a team performs relative to its competition.
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year for which to calculate the average differential.
 * @param {number} currentWeek - The current week, to consider games up to this point.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {Function} getMappedTeamName - Function to standardize team names.
 * @returns {number} The average point differential.
 */
export const calculateTeamAverageDifferenceVsOpponent = (teamName, year, currentWeek, historicalMatchups, getMappedTeamName) => {
  let totalPointsFor = 0;
  let totalPointsAgainst = 0;
  let gamesCounted = 0;

  // Safeguard getMappedTeamName
  const safeGetMappedTeamName = typeof getMappedTeamName === 'function' ? getMappedTeamName : (name) => String(name || '').trim();

  // Ensure historicalMatchups is an array before iterating
  if (!Array.isArray(historicalMatchups)) {
    console.warn("historicalMatchups is not an array in calculateTeamAverageDifferenceVsOpponent.");
    return 0;
  }

  historicalMatchups.forEach(match => {
    const matchYear = parseInt(match.year);
    const matchWeek = parseInt(match.week);

    // Only consider games for the specified year and up to the current week
    if (matchYear === year && matchWeek <= currentWeek) {
      const displayTeam1 = safeGetMappedTeamName(String(match.team1 || '').trim());
      const displayTeam2 = safeGetMappedTeamName(String(match.team2 || '').trim());
      const score1 = parseFloat(match.team1score);
      const score2 = parseFloat(match.team2score);

      if (displayTeam1 === teamName) {
        totalPointsFor += score1;
        totalPointsAgainst += score2;
        gamesCounted++;
      } else if (displayTeam2 === teamName) {
        totalPointsFor += score2;
        totalPointsAgainst += score1;
        gamesCounted++;
      }
    }
  });

  if (gamesCounted === 0) {
    return 0; // Avoid division by zero
  }

  return (totalPointsFor - totalPointsAgainst) / gamesCounted;
};

/**
 * Calculates the Sigma Squared Over Count for a given team.
 * This represents the variance of the team's point differentials.
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year for which to calculate.
 * @param {number} currentWeek - The current week, to consider games up to this point.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {Function} getMappedTeamName - Function to standardize team names.
 * @returns {number} The calculated Sigma Squared Over Count.
 */
export const calculateSigmaSquaredOverCount = (teamName, year, currentWeek, historicalMatchups, getMappedTeamName) => {
  let differentialsSquaredSum = 0;
  let gamesCounted = 0;

  // Safeguard getMappedTeamName
  const safeGetMappedTeamName = typeof getMappedTeamName === 'function' ? getMappedTeamName : (name) => String(name || '').trim();

  // Ensure historicalMatchups is an array before iterating
  if (!Array.isArray(historicalMatchups)) {
    console.warn("historicalMatchups is not an array in calculateSigmaSquaredOverCount.");
    return 0;
  }

  historicalMatchups.forEach(match => {
    const matchYear = parseInt(match.year);
    const matchWeek = parseInt(match.week);

    if (matchYear === year && matchWeek <= currentWeek) {
      const displayTeam1 = safeGetMappedTeamName(String(match.team1 || '').trim());
      const displayTeam2 = safeGetMappedTeamName(String(match.team2 || '').trim());
      const score1 = parseFloat(match.team1score);
      const score2 = parseFloat(match.team2score);

      let differential;
      if (displayTeam1 === teamName) {
        differential = score1 - score2;
        gamesCounted++;
      } else if (displayTeam2 === teamName) {
        differential = score2 - score1;
        gamesCounted++;
      }
      if (typeof differential === 'number') {
        differentialsSquaredSum += Math.pow(differential, 2);
      }
    }
  });

  if (gamesCounted === 0) {
    return 0; // Avoid division by zero
  }

  return differentialsSquaredSum / gamesCounted;
};

/**
 * Calculates the Error Function Coefficient for a player/team.
 * This is used in win probability calculations.
 * @param {number} sigmaSquaredOverCount - The calculated Sigma Squared Over Count.
 * @returns {number} The Error Function Coefficient.
 */
export const calculateErrorFunctionCoefficient = (sigmaSquaredOverCount) => {
  return Math.sqrt(2 * sigmaSquaredOverCount);
};

/**
 * Calculates the projected average scoring difference between a team and their future opponent.
 * This might require more sophisticated logic involving future schedules and opponent metrics.
 * For now, a simplified approach is used.
 * @param {string} teamName - The name of the team.
 * @param {string} opponentName - The name of the opponent.
 * @param {Object} seasonalMetrics - Seasonal metrics for all teams.
 * @returns {number} The projected average scoring difference.
 */
export const calculateFutureOpponentAverageScoringDifference = (teamName, opponentName, seasonalMetrics) => {
  // Simplified for now: Assume average score is a good proxy for strength.
  // A more robust calculation would involve team-specific match histories,
  // defensive strengths, etc.
  const teamMetric = seasonalMetrics[teamName];
  const opponentMetric = seasonalMetrics[opponentName];

  if (!teamMetric || !opponentMetric || typeof teamMetric.averageScore !== 'number' || typeof opponentMetric.averageScore !== 'number') {
    return 0; // Return 0 if metrics are missing or invalid
  }

  // This is a very basic projection. Could be improved.
  return teamMetric.averageScore - opponentMetric.averageScore;
};

/**
 * Gathers all necessary metrics for a specific player/team for a given year.
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year for which to get metrics.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {Object} seasonalMetrics - Seasonal metrics calculated by calculateAllLeagueMetrics.
 * @param {Object} weeklyGameScoresByYearAndWeek - Weekly game scores data.
 * @param {Function} getMappedTeamName - Function to standardize team names.
 * @returns {Object} An object containing all relevant metrics for the player/team.
 */
export const getPlayerMetricsForYear = (teamName, year, historicalMatchups, seasonalMetrics, weeklyGameScoresByYearAndWeek, getMappedTeamName) => {
    // Safeguard getMappedTeamName
    const safeGetMappedTeamName = typeof getMappedTeamName === 'function' ? getMappedTeamName : (name) => String(name || '').trim();

    // The current week needs to be determined based on the latest data available or passed as a parameter.
    // For now, let's assume currentWeek is the latest week present in historicalMatchups for the given year.
    let currentWeek = 0;
    historicalMatchups.forEach(match => {
        if (parseInt(match.year) === year && parseInt(match.week) > currentWeek) {
            currentWeek = parseInt(match.week);
        }
    });

    const averageDifferenceVsOpponent = calculateTeamAverageDifferenceVsOpponent(teamName, year, currentWeek, historicalMatchups, safeGetMappedTeamName);
    const sigmaSquaredOverCount = calculateSigmaSquaredOverCount(teamName, year, currentWeek, historicalMatchups, safeGetMappedTeamName);
    const errorFunctionCoefficient = calculateErrorFunctionCoefficient(sigmaSquaredOverCount);

    const teamSeasonMetric = seasonalMetrics[teamName] || {};
    const currentDPR = teamSeasonMetric.dpr || 0; // Get the current DPR from seasonal metrics

    // Projected score might need more specific calculation or come from seasonalMetrics
    // For simplicity, let's use the average score from seasonal metrics as a projected score baseline
    const projectedScore = teamSeasonMetric.averageScore || 0;


    return {
        averageDifferenceVsOpponent,
        sigmaSquaredOverCount,
        errorFunctionCoefficient,
        currentDPR,
        projectedScore, // Include projected score
    };
};

/**
 * Calculates the win percentage projection for a player against a hypothetical opponent,
 * based on their average point differential and error function coefficient.
 * This formula is derived from normal distribution probabilities (e.g., Z-score, CDF).
 *
 * @param {number} avgDiffVsOpponentForPlayer - The player's average point differential (HZ215).
 * @param {number} errorCoeffForPlayer - The player's error function coefficient (IR215).
 * @returns {number} The calculated win percentage projection (between 0 and 1). Returns 0.5 for invalid inputs.
 */
export const calculateWeeklyWinPercentageProjection = (avgDiffVsOpponentForPlayer, errorCoeffForPlayer) => {
  if (typeof avgDiffVsOpponentForPlayer !== 'number' || isNaN(avgDiffVsOpponentForPlayer) ||
      typeof errorCoeffForPlayer !== 'number' || isNaN(errorCoeffForPlayer)) {
    return 0.5; // Default to 50% if inputs are invalid
  }

  if (avgDiffVsOpponentForPlayer === 0 && errorCoeffForPlayer === 0) {
    return 0.5; // If both are 0, 50% chance
  }

  let probability;
  const sqrt2 = Math.sqrt(2);

  try {
    if (errorCoeffForPlayer === 0) { // Avoid division by zero if errorCoeffForPlayer is 0
        probability = avgDiffVsOpponentForPlayer > 0 ? 1 : (avgDiffVsOpponentForPlayer < 0 ? 0 : 0.5);
    } else {
        // This formula seems to be derived from the Cumulative Distribution Function (CDF)
        // of a normal distribution. ERF((AvgDiff / ErrorCoeff) / sqrt(2)) / 2 + 0.5
        // If avgDiffVsOpponentForPlayer is positive, erf(positive) is positive, resulting in > 0.5
        // If avgDiffVsOpponentForPlayer is negative, erf(negative) is negative, resulting in < 0.5
        const arg = avgDiffVsOpponentForPlayer / (errorCoeffForPlayer * sqrt2);
        probability = erf(arg) / 2 + 0.5;
    }

  } catch (e) {
    console.error("Error in calculateWeeklyWinPercentageProjection:", e);
    return 0.5; // Fallback in case of calculation error
  }

  // Ensure probability is within [0, 1] range
  return Math.max(0, Math.min(1, probability));
};


/**
 * Calculates moneyline odds from win probabilities.
 * @param {number} team1WinProbability - Win probability for Team 1 (0-1).
 * @param {number} team2WinProbability - Win probability for Team 2 (0-1).
 * @returns {Object} An object containing moneyline odds for both teams.
 */
export const calculateMoneylineOdds = (team1WinProbability, team2WinProbability) => {
    if (typeof team1WinProbability !== 'number' || typeof team2WinProbability !== 'number' ||
        isNaN(team1WinProbability) || isNaN(team2WinProbability) ||
        team1WinProbability < 0 || team1WinProbability > 1 ||
        team2WinProbability < 0 || team2WinProbability > 1) {
        return { team1: null, team2: null, team1Formatted: 'N/A', team2Formatted: 'N/A' };
    }

    // Normalize probabilities if they don't sum to 1 (due to independent calculations or rounding)
    let totalProbability = team1WinProbability + team2WinProbability;
    if (totalProbability === 0) {
        // If both probabilities are zero, perhaps a default 50/50 odds or 'N/A'
        return { team1: 100, team2: 100, team1Formatted: '+100', team2Formatted: '+100' };
    }
    team1WinProbability /= totalProbability;
    team2WinProbability /= totalProbability;

    const toMoneyline = (probability) => {
        if (probability === 0) return '+99999'; // Effectively infinite underdog
        if (probability === 1) return '-99999'; // Effectively infinite favorite

        let odds;
        if (probability > 0.5) {
            // Favorite (e.g., -200)
            odds = (probability / (1 - probability)) * -100;
        } else {
            // Underdog (e.g., +200)
            odds = ((1 - probability) / probability) * 100;
        }
        return Math.round(odds);
    };

    const formatMoneyline = (odds) => {
        if (odds === null) return 'N/A';
        return odds > 0 ? `+${odds}` : String(odds);
    };

    const team1Odds = toMoneyline(team1WinProbability);
    const team2Odds = toMoneyline(team2WinProbability);

    return {
        team1: team1Odds,
        team2: team2Odds,
        team1Formatted: formatMoneyline(team1Odds),
        team2Formatted: formatMoneyline(team2Odds)
    };
};

/**
 * Calculates the over/under total for a game based on projected scores.
 * @param {number} team1ProjectedScore - Projected score for Team 1.
 * @param {number} team2ProjectedScore - Projected score for Team 2.
 * @returns {number} The calculated over/under total.
 */
export const calculateOverUnder = (team1ProjectedScore, team2ProjectedScore) => {
  if (typeof team1ProjectedScore !== 'number' || isNaN(team1ProjectedScore) ||
      typeof team2ProjectedScore !== 'number' || isNaN(team2ProjectedScore)) {
    return null; // Or some default value like 0 or 'N/A'
  }
  return (team1ProjectedScore + team2ProjectedScore).toFixed(2); // Format to 2 decimal places
};
