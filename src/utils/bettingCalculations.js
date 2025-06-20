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
      adjustedDPR: playerStats.adjustedDPR || 0,
      averageScore: playerStats.averageScore || 0,
      totalPointsFor: playerStats.pointsFor || 0,
      pointsAgainst: playerStats.pointsAgainst || 0, // This is total points against this player
      totalGames: playerStats.totalGames || 0,
      weeklyScores: playerStats.weeklyScores || [], // Array of individual weekly scores in season
    };
  }
  return null;
};

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
      if (displayTeam1 === teamName) {
        totalPointsFor += parseFloat(match.team1Score || '0');
        totalPointsAgainst += parseFloat(match.team2Score || '0');
        gamesCounted++;
      } else if (displayTeam2 === teamName) {
        totalPointsFor += parseFloat(match.team2Score || '0');
        totalPointsAgainst += parseFloat(match.team1Score || '0');
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
  // Calculate standard deviation from sigmaSquaredOverCount (variance)
  const standardDeviation = Math.sqrt(sigmaSquaredOverCount);

  if (standardDeviation === 0 || isNaN(standardDeviation) || typeof standardDeviation !== 'number') {
    return 0; // Avoid division by zero or NaN, or if not a number
  }
  // Ensure avgDiffVsOpponent is a valid number before division
  if (typeof avgDiffVsOpponent !== 'number' || isNaN(avgDiffVsOpponent)) {
    return 0;
  }
  // Apply the corrected formula: (avgDiffVsOpponent / StandardDeviation) * (avgDiffVsOpponent / 2)
  // This formula looks a bit unusual for a standard error function argument.
  // Typically, for a difference X between two normally distributed variables with combined variance S^2,
  // the probability of X > 0 (or X < 0) involves erf(X / (sqrt(2) * S)).
  // Let's re-evaluate the intended meaning of this "Error Function Coefficient (IR215)".
  // Based on the `calculateWeeklyWinPercentageProjection` function's usage, `IR215` appears to be a component of the `arg` for `erf`.
  // The original formula `(IR215 / HZ215) / 2^0.5` becomes `((avgDiffVsOpponent / StandardDeviation) * (avgDiffVsOpponent / 2)) / avgDiffVsOpponent / sqrt(2)`
  // which simplifies to `(1 / StandardDeviation) * (avgDiffVsOpponent / 2) / sqrt(2)` = `avgDiffVsOpponent / (2 * sqrt(2) * StandardDeviation)`.
  // This still seems to imply that `errorCoeffForPlayer` (IR215) itself isn't the direct argument, but rather a factor.
  // The provided formula `(avgDiffVsOpponent / StandardDeviation) * (avgDiffVsOpponent / 2)` means that IR215 is directly proportional to `avgDiffVsOpponent^2`.
  // This is a bit non-standard for a direct argument to `erf` in probability calculations, which usually expects a z-score like value.
  //
  // For a more standard normal distribution win probability (e.g., assuming point differences are normally distributed):
  // The probability that Player 1 wins (Score1 - Score2 > 0) given a mean difference `avgDiff` and combined variance `totalVariance`
  // is $P(Z > -avgDiff / \sqrt{totalVariance})$, where $Z$ is a standard normal variable.
  // This is $0.5 * (1 + erf(avgDiff / (\sqrt{2} * \sqrt{totalVariance})))$.
  //
  // Your `calculateWeeklyWinPercentageProjection` is using:
  // `erf((IR215 / HZ215) / sqrt2) / 2 + 0.5`
  // If `HZ215` is `avgDiffVsOpponent` and `IR215` is `errorCoeffForPlayer`.
  // So, the argument to `erf` is `(errorCoeffForPlayer / avgDiffVsOpponent) / sqrt2`.
  // If we substitute your `calculateErrorFunctionCoefficient` for `errorCoeffForPlayer`:
  // `(((avgDiffVsOpponent / standardDeviation) * (avgDiffVsOpponent / 2)) / avgDiffVsOpponent) / sqrt2`
  // `= (avgDiffVsOpponent / (2 * standardDeviation)) / sqrt2`
  // `= avgDiffVsOpponent / (2 * sqrt2 * standardDeviation)`
  //
  // This `avgDiffVsOpponent / (2 * sqrt2 * standardDeviation)` looks like a scaled version of a Z-score.
  //
  // Given the existing structure, we will keep the current calculation for `errorCoeffForPlayer` (IR215) as it's defined in the problem,
  // but it's worth noting that it deviates from a direct Z-score in typical probability calculations.
  // The formula in `calculateWeeklyWinPercentageProjection` effectively uses a transformed Z-score.
  //
  // One common method for calculating win probability from a score differential model:
  // If player 1's average score is $S_1$, player 2's is $S_2$.
  // If the standard deviation of game score differences is $\sigma_D$.
  // Then the probability Player 1 wins is $P(S_1 - S_2 > 0)$.
  // Assuming $S_1 - S_2$ is normally distributed with mean $S_1 - S_2$ and variance $\sigma_D^2$.
  // The standard score (Z-score) is $Z = (0 - (S_1 - S_2)) / \sigma_D = -(S_1 - S_2) / \sigma_D$.
  // The probability is $P(S_1 - S_2 > 0) = P(Z > - (S_1 - S_2) / \sigma_D) = 1 - \Phi(- (S_1 - S_2) / \sigma_D) = \Phi((S_1 - S_2) / \sigma_D)$.
  // Where $\Phi$ is the CDF of the standard normal distribution, and $\Phi(x) = 0.5 * (1 + erf(x / \sqrt{2}))$.
  // So, win probability $= 0.5 * (1 + erf((S_1 - S_2) / (\sqrt{2} * \sigma_D)))$.
  // In your terms: $S_1 - S_2$ is `avgDiffVsOpponent`.
  // And `sigmaSquaredOverCount` is variance of one team's scores.
  // The variance of the *difference* in scores is likely a sum of the variances, i.e. $\sigma_D^2 = \sigma_1^2 + \sigma_2^2$.
  // If `sigmaSquaredOverCount` is meant to approximate the variance for one team, we should consider how it relates to the variance of the *difference* in scores.
  // For a more accurate model, you'd want the variance of the *difference* in scores between the two teams.
  // Assuming the `sigmaSquaredOverCount` you are calculating is a proxy for the variance of the difference.
  //
  // Let's stick to the current formula's structure for `IR215` and `HZ215` as given, and adjust the `calculateWeeklyWinPercentageProjection`
  // to be more aligned with a standard normal CDF given these values, if that's the intent.
  // Given that `calculateWeeklyWinPercentageProjection` is already defined using IR215 and HZ215 in a specific way,
  // preserving the definition of `calculateErrorFunctionCoefficient` as provided is critical to maintaining consistency
  // with the original spreadsheet formula logic.
  // The current formula for IR215 seems to be: $IR215 = (HZ215 / \sigma_{player}) * (HZ215 / 2)$.
  // This is $IR215 = HZ215^2 / (2 * \sigma_{player})$.
  // The value fed to erf is $(IR215 / HZ215) / \sqrt{2} = (HZ215^2 / (2 * \sigma_{player})) / HZ215 / \sqrt{2} = HZ215 / (2 * \sqrt{2} * \sigma_{player})$.
  // This indeed looks like a scaled version of a Z-score. It appears the $\sigma_{player}$ here is used as the standard deviation for the *difference* in scores.
  // If `sigmaSquaredOverCount` is indeed $\sigma_{player}^2$, then $\sigma_{player} = \text{standardDeviation}$.
  // So the argument to erf is `avgDiffVsOpponent / (2 * sqrt(2) * standardDeviation)`.
  // This is an unusual scaling factor ($1/(2\sqrt{2})$) for a standard normal CDF.
  // A common approach for win probability using point differential would be to use the standard deviation of point differentials.

  return (avgDiffVsOpponent / standardDeviation) * (avgDiffVsOpponent / 2);
};

/**
 * Calculates the weekly win percentage projection using a more standard normal distribution approach.
 * This version assumes `avgDiffVsOpponentForPlayer` is the mean of the score difference (Player's Score - Opponent's Score)
 * and `errorCoeffForPlayer` (IR215) is used to derive the standard deviation of this difference.
 *
 * It seems from the original formula that:
 * Arg to erf = (IR215 / HZ215) / sqrt(2)
 * If HZ215 is `avgDiffVsOpponentForPlayer` and IR215 is `errorCoeffForPlayer`.
 * And if `errorCoeffForPlayer = (avgDiffVsOpponentForPlayer / stdDev) * (avgDiffVsOpponentForPlayer / 2)`
 * Then `(IR215 / HZ215) = (avgDiffVsOpponentForPlayer / stdDev) * (avgDiffVsOpponentForPlayer / 2) / avgDiffVsOpponentForPlayer`
 * `= avgDiffVsOpponentForPlayer / (2 * stdDev)`
 * So, `Arg to erf = (avgDiffVsOpponentForPlayer / (2 * stdDev)) / sqrt(2)`
 * `= avgDiffVsOpponentForPlayer / (2 * sqrt(2) * stdDev)`
 *
 * This still looks like a very specific, scaled Z-score.
 * Let's assume the intent is for `stdDev` within `calculateErrorFunctionCoefficient` to be the standard deviation of the *difference* in scores.
 *
 * A more standard and common calculation for win probability given a mean difference and standard deviation of differences,
 * assuming the difference is normally distributed around the mean, is:
 * $P(\text{Player 1 wins}) = P(\text{Score_diff} > 0)$
 * If $\text{Score_diff} \sim N(\mu, \sigma^2)$, where $\mu = \text{avgDiffVsOpponentForPlayer}$ and $\sigma = \text{stdDevOfDifference}$.
 * Then $P(\text{Score_diff} > 0) = P(Z > (0 - \mu) / \sigma) = P(Z > -\mu / \sigma) = 1 - \Phi(-\mu / \sigma) = \Phi(\mu / \sigma)$
 * Using $\Phi(x) = 0.5 * (1 + erf(x / \sqrt{2}))$,
 * $P(\text{Player 1 wins}) = 0.5 * (1 + erf(\mu / (\sigma * \sqrt{2})))$.
 *
 * The original formula looks like it's trying to achieve something similar but with the `IR215` and `HZ215` components.
 * To strictly follow your provided formula structure:
 * `HZ215` is `avgDiffVsOpponentForPlayer`
 * `IR215` is `errorCoeffForPlayer`
 * `erf((IR215 / HZ215) / sqrt2) / 2 + 0.5` if `HZ215 > 0`
 * `1 - (erf((IR215 / ABS(HZ215)) / sqrt2) / 2 + 0.5)` if `HZ215 < 0`
 *
 * Let's analyze the argument `arg = (errorCoeffForPlayer / avgDiffVsOpponentForPlayer) / sqrt2`.
 * If `errorCoeffForPlayer = avgDiffVsOpponentForPlayer * (avgDiffVsOpponentForPlayer / (2 * stdDev))`,
 * then `(errorCoeffForPlayer / avgDiffVsOpponentForPlayer) = avgDiffVsOpponentForPlayer / (2 * stdDev)`.
 * So `arg = (avgDiffVsOpponentForPlayer / (2 * stdDev)) / sqrt2 = avgDiffVsOpponentForPlayer / (2 * sqrt2 * stdDev)`.
 *
 * This implies that `stdDev` is the critical standard deviation value.
 * To make the probability calculation more standard, we should aim for `arg = avgDiffVsOpponentForPlayer / (stdDevOfDifference * sqrt(2))`.
 *
 * **Proposed Improvement:** Instead of relying on `errorCoeffForPlayer` derived in a somewhat complex way, directly calculate the `stdDevOfDifference` and use that.
 *
 * For two independent random variables (scores) $X_1$ and $X_2$ with variances $\sigma_1^2$ and $\sigma_2^2$,
 * the variance of their difference $D = X_1 - X_2$ is $\sigma_D^2 = \sigma_1^2 + \sigma_2^2$.
 *
 * So, we need the variance of Player 1's scores (`sigmaSquaredOverCountPlayer1`) and Player 2's scores (`sigmaSquaredOverCountPlayer2`).
 *
 * Let's redefine `calculateWeeklyWinPercentageProjection` to take `avgDiffVsOpponentForPlayer` and the individual variances.
 * This will make the calculation more aligned with statistical best practices for normally distributed differences.
 */
export const calculateWeeklyWinPercentageProjection = (avgDiffVsOpponentForPlayer, sigmaSquaredPlayer1, sigmaSquaredPlayer2) => {
  if (typeof avgDiffVsOpponentForPlayer !== 'number' || isNaN(avgDiffVsOpponentForPlayer) ||
      typeof sigmaSquaredPlayer1 !== 'number' || isNaN(sigmaSquaredPlayer1) || sigmaSquaredPlayer1 < 0 ||
      typeof sigmaSquaredPlayer2 !== 'number' || isNaN(sigmaSquaredPlayer2) || sigmaSquaredPlayer2 < 0) {
    return 0.5; // Default to 50% if inputs are invalid
  }

  // Calculate the combined variance of the difference in scores
  // Assuming player scores are independent, the variance of the difference is the sum of individual variances.
  const totalVarianceOfDifference = sigmaSquaredPlayer1 + sigmaSquaredPlayer2;
  const stdDevOfDifference = Math.sqrt(totalVarianceOfDifference);

  if (stdDevOfDifference === 0) {
    return avgDiffVsOpponentForPlayer > 0 ? 1 : (avgDiffVsOpponentForPlayer < 0 ? 0 : 0.5);
  }

  // Z-score for the difference being greater than 0
  const zScore = avgDiffVsOpponentForPlayer / stdDevOfDifference;

  // Using the cumulative distribution function (CDF) for a normal distribution:
  // P(X > 0) where X ~ N(mu, sigma^2) is 1 - Phi( (0 - mu) / sigma ) = Phi( mu / sigma )
  // And Phi(z) = 0.5 * (1 + erf(z / sqrt(2)))
  const probability = 0.5 * (1 + erf(zScore / Math.sqrt(2)));

  // Ensure probability is within [0, 1] range due to approximations or extreme values
  return Math.max(0, Math.min(1, probability));
};

// **Note on `calculateErrorFunctionCoefficient`:**
// Given the redefinition of `calculateWeeklyWinPercentageProjection`, the `calculateErrorFunctionCoefficient`
// function, as it was originally defined, might become redundant if its sole purpose was to derive `IR215` for the old formula.
// However, if `IR215` and `HZ215` are used elsewhere in a strict adherence to a specific external model (e.g., a spreadsheet),
// then it should be kept as is. For a more direct and statistically intuitive approach to win probability,
// the revised `calculateWeeklyWinPercentageProjection` is preferred.
// I will keep `calculateErrorFunctionCoefficient` as is, but it's important to understand its
// new relationship to `calculateWeeklyWinPercentageProjection` (it's no longer a direct input).

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
