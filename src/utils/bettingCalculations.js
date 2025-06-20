// src/utils/bettingCalculations.js

// Re-introducing erf for a more robust probabilistic model
// This is a common approximation for the error function.
// For production, consider using a more robust math library like 'numeric-js'
const erf = (x) => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    // A slightly improved version for handling negative x
    const sign = (x < 0) ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
};


// Standard Normal Cumulative Distribution Function (CDF)
// P(X <= x) for a standard normal random variable X ~ N(0,1)
const normalCDF = (x) => {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
};


/**
 * Calculates the total score projection for a matchup.
 * This is typically the sum of the average scores of the two teams.
 * @param {number} player1AverageScore - Average score of player 1.
 * @param {number} player2AverageScore - Average score of player 2.
 * @returns {number} The projected total score.
 */
export const calculateOverUnder = (player1AverageScore, player2AverageScore) => {
    if (typeof player1AverageScore !== 'number' || isNaN(player1AverageScore)) player1AverageScore = 0;
    if (typeof player2AverageScore !== 'number' || isNaN(player2AverageScore)) player2AverageScore = 0;
    return player1AverageScore + player2AverageScore;
};

/**
 * Calculates American odds from decimal odds.
 * @param {number} decimalOdds - The decimal odds.
 * @returns {string} American odds string.
 */
export const decimalToAmericanOdds = (decimalOdds) => {
    if (typeof decimalOdds !== 'number' || isNaN(decimalOdds) || decimalOdds <= 1) { // Changed decimalOdds < 1 to decimalOdds <= 1
        // If probability is 100% (decimalOdds = 1), American odds should be -Infinity if truly 1.
        // But for practical purposes in betting, anything below 1 is invalid or indicates a very strong favorite.
        // We'll return N/A for those cases to signify an invalid or too-certain probability.
        return 'N/A';
    }
    if (decimalOdds >= 2) {
        return `+${Math.round((decimalOdds - 1) * 100)}`;
    } else {
        return `${Math.round(-100 / (decimalOdds - 1))}`;
    }
};

/**
 * Calculates moneyline odds for two teams based on their win probabilities.
 * @param {number} player1WinProbability - The calculated win probability for player 1 (0 to 1).
 * @param {number} player2WinProbability - The calculated win probability for player 2 (0 to 1).
 * @param {number} [overround=0.0476] - The "vig" or house edge. 4.76% overround results in approx -110 for 50/50.
 * @returns {{player1Odds: string, player2Odds: string}} Object with American odds for both players.
 */
export const calculateMoneylineOdds = (player1WinProbability, player2WinProbability, overround = 0.0476) => {
    if (typeof player1WinProbability !== 'number' || isNaN(player1WinProbability) ||
        typeof player2WinProbability !== 'number' || isNaN(player2WinProbability) ||
        player1WinProbability < 0 || player1WinProbability > 1 ||
        player2WinProbability < 0 || player2WinProbability > 1 ||
        player1WinProbability + player2WinProbability === 0 // Avoid division by zero if both are 0
    ) {
        return { player1Odds: 'N/A', player2Odds: 'N/A' };
    }

    // Normalize probabilities to sum to 1, if they don't exactly (due to rounding/precision)
    const sumProbs = player1WinProbability + player2WinProbability;
    let normalizedProb1 = player1WinProbability;
    let normalizedProb2 = player2WinProbability;

    if (sumProbs > 0) { // Should always be true if inputs are valid, but defensive
        normalizedProb1 = player1WinProbability / sumProbs;
        normalizedProb2 = player2WinProbability / sumProbs;
    } else {
        // If sumProbs is 0 (both are 0), assign 50/50 chance
        normalizedProb1 = 0.5;
        normalizedProb2 = 0.5;
    }

    // Apply overround (vig)
    // Vigged probabilities are higher than 100% combined, reflecting the house edge.
    // decimalOdds = 1 / (probability * (1 + overround))
    // So, implied probability for the bookmaker = probability * (1 + overround)
    const viggedDecimalOdds1 = normalizedProb1 > 0 ? (1 / (normalizedProb1 * (1 + overround))) : Infinity;
    const viggedDecimalOdds2 = normalizedProb2 > 0 ? (1 / (normalizedProb2 * (1 + overround))) : Infinity;

    const player1Odds = decimalToAmericanOdds(viggedDecimalOdds1);
    const player2Odds = decimalToAmericanOdds(viggedDecimalOdds2);

    return { player1Odds, player2Odds };
};


/**
 * Calculates win percentage projection based on adjusted DPR, average scores,
 * and a measure of score variability (e.g., standard deviation).
 *
 * This version uses a simplified Normal Distribution approach, where we estimate
 * the probability of Team1's score being higher than Team2's score.
 *
 * @param {number} player1AdjustedDPR - Adjusted DPR for player 1.
 * @param {number} player1AverageScore - Average score for player 1.
 * @param {number} player1TotalGames - Total games played by player 1 for the season.
 * @param {number} player2AdjustedDPR - Adjusted DPR for player 2.
 * @param {number} player2AverageScore - Average score for player 2.
 * @param {number} player2TotalGames - Total games played by player 2 for the season.
 * @returns {number} Win probability for player 1 (0 to 1).
 */
export const calculateWeeklyWinPercentageProjection = (
    player1AdjustedDPR, player1AverageScore, player1TotalGames,
    player2AdjustedDPR, player2AverageScore, player2TotalGames
) => {
    // Input validation and fallback to a neutral state if data is missing or invalid
    if (
        typeof player1AdjustedDPR !== 'number' || isNaN(player1AdjustedDPR) || player1AdjustedDPR <= 0 ||
        typeof player2AdjustedDPR !== 'number' || isNaN(player2AdjustedDPR) || player2AdjustedDPR <= 0
    ) {
        // If we don't have valid DPRs, fall back to 50/50.
        // The check playerDPR <= 0 is crucial since adjustedDPR can be 0 or 0.001
        // for teams with no data or very poor performance.
        return 0.5;
    }

    // Use adjustedDPR as the primary strength indicator.
    // If you want average score to factor in more, you can combine them.
    // For now, let's keep it simple: adjustedDPR is our "mean".

    const player1ExpectedScore = player1AdjustedDPR; // Treat adjustedDPR as the mean for this simplified model
    const player2ExpectedScore = player2AdjustedDPR;

    // This is the tricky part: estimating variance/standard deviation.
    // We need a proxy for how much scores fluctuate.
    // A simple approach is to use a fixed "league average" standard deviation for score differences,
    // or one that scales with the number of games played.
    // For now, let's use a "fudge factor" standard deviation for score differences.
    // This value needs to be tuned based on historical data. A larger value means more upsets possible.
    // A smaller value means more predictable outcomes.
    const LEAGUE_AVERAGE_STD_DEV_SCORE_DIFFERENCE = 0.2; // This is a placeholder! Tune this.
    // Maybe scale by games played for confidence? More games -> lower effective std dev?
    // Let's use a very simple approach first: assume the difference of two normal variables.
    // If scores are N(mean, var), then score_diff is N(mean_diff, var1+var2).
    // Let's assume individual score variance is roughly constant for now.
    // This `combinedStdDev` value is the most important for controlling the spread of probabilities.

    // A very simple heuristic: std dev decreases as more games are played (more confident in performance)
    const confidenceFactor1 = player1TotalGames > 0 ? Math.sqrt(Math.max(1, 17 - player1TotalGames) / 17) : 1; // Max 17 weeks in regular season
    const confidenceFactor2 = player2TotalGames > 0 ? Math.sqrt(Math.max(1, 17 - player2TotalGames) / 17) : 1;

    // Use a baseline standard deviation and scale it by confidence
    // Higher confidenceFactor means less games played, so higher std dev
    const baselineIndividualStdDev = 0.2; // Tune this based on actual score data variance
    const player1StdDev = baselineIndividualStdDev * confidenceFactor1;
    const player2StdDev = baselineIndividualStdDev * confidenceFactor2;

    const combinedStdDev = Math.sqrt(player1StdDev * player1StdDev + player2StdDev * player2StdDev);

    if (combinedStdDev === 0) { // Avoid division by zero if all stddevs are 0
        return player1ExpectedScore === player2ExpectedScore ? 0.5 : (player1ExpectedScore > player2ExpectedScore ? 1 : 0);
    }

    // Calculate the Z-score: (Team1_Expected_Score - Team2_Expected_Score) / Combined_Standard_Deviation
    const zScore = (player1ExpectedScore - player2ExpectedScore) / combinedStdDev;

    // Use the Normal CDF to get the probability that Team1 outscores Team2
    const player1WinProbability = normalCDF(zScore);

    // Ensure probability is within [0, 1] range and handle edge cases gracefully
    return Math.max(0.001, Math.min(0.999, player1WinProbability)); // Avoid 0 or 1 for infinite odds
};
