// src/utils/sportsbookCalculations.js
// Advanced calculations for sportsbook odds

// src/utils/sportsbookCalculations.js
// Advanced calculations for sportsbook odds using keeper league dynamics

import { calculateAllLeagueMetrics } from './calculations';

// Cache for DPR calculations to prevent expensive recalculation
let dprCache = {
    data: {},
    timestamp: null,
    season: null,
    cacheKey: null
};

/**
 * Calculate team DPR values for current season with early season adjustments (with caching)
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @param {Function} getTeamName - Function to get team names
 * @param {Object} nflState - Current NFL state
 * @returns {Object} Team DPR values keyed by rosterId
 */
export const calculateTeamDPRValues = (historicalData, currentSeason, getTeamName, nflState) => {
    if (!historicalData || !currentSeason) {
        return {};
    }

    // Create cache key based on season and week
    const currentWeek = nflState?.week || 1;
    const cacheKey = `${currentSeason}-${currentWeek}`;
    const now = Date.now();
    
    // Check if we have valid cached data (cache for 30 seconds to prevent excessive recalculation)
    if (dprCache.cacheKey === cacheKey && 
        dprCache.timestamp && 
        (now - dprCache.timestamp) < 30000) {
        return dprCache.data;
    }

    try {
        console.log(`Calculating DPR values for season ${currentSeason}, week ${currentWeek}`);
        const { seasonalMetrics } = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
        const currentSeasonMetrics = seasonalMetrics[currentSeason] || {};
        
        const teamDPRValues = {};
        
        Object.keys(currentSeasonMetrics).forEach(rosterId => {
            const teamData = currentSeasonMetrics[rosterId];
            if (teamData) {
                // Use adjusted DPR which is normalized to league average (1.0 = average)
                const adjustedDPR = teamData.adjustedDPR || 1.0;
                const gamesPlayed = teamData.totalGames || 0;
                
                // Early season confidence adjustment - less confidence in DPR early in season
                let confidenceMultiplier = 1.0;
                if (gamesPlayed <= 3) {
                    confidenceMultiplier = 0.6; // Very low confidence early
                } else if (gamesPlayed <= 6) {
                    confidenceMultiplier = 0.8; // Moderate confidence mid-season
                } else if (gamesPlayed <= 10) {
                    confidenceMultiplier = 0.9; // High confidence late season
                }
                
                teamDPRValues[rosterId] = {
                    adjustedDPR,
                    rawDPR: teamData.rawDPR || 0,
                    gamesPlayed,
                    confidenceMultiplier,
                    averageScore: teamData.averageScore || 0,
                    winPercentage: teamData.winPercentage || 0,
                    allPlayWinPercentage: teamData.allPlayWinPercentage || 0,
                    luckRating: teamData.luckRating || 0,
                    highScore: teamData.highScore || 0,
                    lowScore: teamData.lowScore || 0
                };
            }
        });
        
        // Cache the results
        dprCache = {
            data: teamDPRValues,
            timestamp: now,
            season: currentSeason,
            cacheKey: cacheKey
        };
        
        console.log(`DPR calculation complete. Cached ${Object.keys(teamDPRValues).length} teams.`);
        return teamDPRValues;
    } catch (error) {
        console.error('Error calculating team DPR values:', error);
        return {};
    }
};

/**
 * Clear the DPR cache (useful when data changes)
 */
export const clearDPRCache = () => {
    dprCache = {
        data: {},
        timestamp: null,
        season: null,
        cacheKey: null
    };
    console.log('DPR cache cleared');
};

/**
 * Calculate win probability between two teams using DPR and multiple factors
 * @param {String} team1RosterId - Team 1 roster ID
 * @param {String} team2RosterId - Team 2 roster ID
 * @param {Object} teamStats - Team statistics (legacy parameter for compatibility)
 * @param {Object} eloRatings - Elo ratings
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @param {Object} teamDPRValues - DPR values for teams (optional, will calculate if not provided)
 * @param {Function} getTeamName - Function to get team names
 * @param {Object} nflState - Current NFL state
 * @returns {Number} Team 1 win probability (0-1)
 */
export const calculateWinProbability = (team1RosterId, team2RosterId, teamStats, eloRatings, historicalData, currentSeason, teamDPRValues = null, getTeamName = null, nflState = null) => {
    // Calculate DPR values if not provided
    let dprValues = teamDPRValues;
    if (!dprValues && historicalData && currentSeason && getTeamName && nflState) {
        dprValues = calculateTeamDPRValues(historicalData, currentSeason, getTeamName, nflState);
    }
    
    // Get DPR data for both teams
    const team1DPR = dprValues?.[team1RosterId];
    const team2DPR = dprValues?.[team2RosterId];
    
    // Fallback to legacy team stats if DPR data unavailable
    const team1Stats = teamStats[team1RosterId];
    const team2Stats = teamStats[team2RosterId];
    
    if (!team1DPR && !team1Stats || !team2DPR && !team2Stats) {
        return 0.5; // Default 50/50 if no data
    }
    
    // Use DPR data if available, otherwise fall back to basic stats
    const team1Data = team1DPR || {
        adjustedDPR: 1.0,
        averageScore: team1Stats?.averageScore || 100,
        gamesPlayed: team1Stats?.gamesPlayed || 0,
        confidenceMultiplier: 0.5,
        winPercentage: 0.5,
        allPlayWinPercentage: 0.5,
        luckRating: 0
    };
    
    const team2Data = team2DPR || {
        adjustedDPR: 1.0,
        averageScore: team2Stats?.averageScore || 100,
        gamesPlayed: team2Stats?.gamesPlayed || 0,
        confidenceMultiplier: 0.5,
        winPercentage: 0.5,
        allPlayWinPercentage: 0.5,
        luckRating: 0
    };
    
    const maxGamesPlayed = Math.max(team1Data.gamesPlayed, team2Data.gamesPlayed);
    
    // 1. DPR component (50% weight) - This is the primary factor using the Oberon Mt. formula
    const dprDiff = team1Data.adjustedDPR - team2Data.adjustedDPR;
    const dprComponent = Math.tanh(dprDiff * 2) * 0.5; // Stronger weighting for DPR
    
    // 2. Elo rating component (20% weight) - Reduced from 25%
    const team1Elo = eloRatings[team1RosterId] || 1500;
    const team2Elo = eloRatings[team2RosterId] || 1500;
    const eloDiff = team1Elo - team2Elo;
    const eloComponent = Math.tanh(eloDiff / 200) * 0.2;
    
    // 3. Recent momentum component (15% weight) - Reduced from 20%
    const team1Momentum = calculateTeamMomentum(team1RosterId, currentSeason, historicalData, 4);
    const team2Momentum = calculateTeamMomentum(team2RosterId, currentSeason, historicalData, 4);
    const momentumDiff = team1Momentum - team2Momentum;
    const momentumComponent = momentumDiff * 0.15;
    
    // 4. Head-to-head record component (10% weight) - Same
    const h2hComponent = calculateHeadToHeadAdvantage(team1RosterId, team2RosterId, historicalData, currentSeason) * 0.1;
    
    // 5. All-play win percentage component (5% weight) - Replaces luck component
    const allPlayDiff = (team1Data.allPlayWinPercentage || 0.5) - (team2Data.allPlayWinPercentage || 0.5);
    const allPlayComponent = Math.tanh(allPlayDiff * 2) * 0.05;
    
    // Combine all components
    let totalAdvantage = dprComponent + eloComponent + momentumComponent + h2hComponent + allPlayComponent;
    
    // Confidence multiplier based on sample size and DPR confidence
    let confidenceMultiplier = Math.min(team1Data.confidenceMultiplier, team2Data.confidenceMultiplier);
    
    // Early season adjustments - reduce advantage certainty
    if (maxGamesPlayed <= 3) {
        confidenceMultiplier *= 0.7; // Very uncertain early
    } else if (maxGamesPlayed <= 6) {
        confidenceMultiplier *= 0.85; // Moderately uncertain
    } else if (maxGamesPlayed <= 10) {
        confidenceMultiplier *= 0.95; // Slightly uncertain
    }
    
    totalAdvantage *= confidenceMultiplier;
    
    // Convert to probability (0.5 = even, add advantage)
    const baseProbability = 0.5 + totalAdvantage;
    
    // Apply dynamic error coefficient - more variance early season, less late
    // Use deterministic "randomness" based on team IDs to ensure consistent results
    let errorCoefficient = 0.12; // Base 12% random variance (reduced from 15%)
    if (maxGamesPlayed <= 3) {
        errorCoefficient = 0.25; // High variance early
    } else if (maxGamesPlayed <= 6) {
        errorCoefficient = 0.18; // Moderate variance mid-season
    } else if (maxGamesPlayed <= 10) {
        errorCoefficient = 0.15; // Lower variance late season
    }
    
    // Create deterministic "random" value based on team IDs
    const seedValue = parseInt(team1RosterId) * 7 + parseInt(team2RosterId) * 11;
    const pseudoRandom = ((seedValue * 9301 + 49297) % 233280) / 233280; // Linear congruential generator
    const deterministicError = (pseudoRandom - 0.5) * errorCoefficient;
    const finalProbability = baseProbability + deterministicError;
    
    // Clamp to reasonable bounds (5% to 95% max certainty)
    return Math.max(0.05, Math.min(0.95, finalProbability));
};

/**
 * Calculate head-to-head advantage between two teams
 * @param {String} team1RosterId - Team 1 roster ID
 * @param {String} team2RosterId - Team 2 roster ID
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @returns {Number} H2H advantage (-1 to 1)
 */
export const calculateHeadToHeadAdvantage = (team1RosterId, team2RosterId, historicalData, currentSeason) => {
    if (!historicalData?.matchupsBySeason) return 0;
    
    // Look at last 2 seasons for H2H data
    const seasons = [currentSeason, (parseInt(currentSeason) - 1).toString()];
    let team1Wins = 0;
    let team2Wins = 0;
    let totalGames = 0;
    
    seasons.forEach(season => {
        const seasonGames = historicalData.matchupsBySeason[season] || [];
        const h2hGames = seasonGames.filter(game => 
            (String(game.team1_roster_id) === String(team1RosterId) && String(game.team2_roster_id) === String(team2RosterId)) ||
            (String(game.team1_roster_id) === String(team2RosterId) && String(game.team2_roster_id) === String(team1RosterId))
        );
        
        h2hGames.forEach(game => {
            if (game.team1_score > 0 || game.team2_score > 0) { // Completed game
                totalGames++;
                const team1IsTeam1 = String(game.team1_roster_id) === String(team1RosterId);
                const team1Score = team1IsTeam1 ? game.team1_score : game.team2_score;
                const team2Score = team1IsTeam1 ? game.team2_score : game.team1_score;
                
                if (team1Score > team2Score) {
                    team1Wins++;
                } else {
                    team2Wins++;
                }
            }
        });
    });
    
    if (totalGames === 0) return 0;
    
    // Convert to advantage (-1 to 1)
    const winPercentage = team1Wins / totalGames;
    return (winPercentage - 0.5) * 2;
};
export const calculateEloRatings = (historicalData, currentSeason) => {
    const K_FACTOR = 32; // Standard Elo K-factor
    const INITIAL_RATING = 1500; // Starting Elo rating
    
    // Initialize all teams with base rating
    const eloRatings = {};
    const seasonRosters = historicalData?.rostersBySeason?.[currentSeason] || [];
    
    seasonRosters.forEach(roster => {
        eloRatings[roster.roster_id] = INITIAL_RATING;
    });

    // Process games chronologically to update Elo ratings
    if (historicalData?.matchupsBySeason?.[currentSeason]) {
        const games = historicalData.matchupsBySeason[currentSeason]
            .filter(game => game.team1_score > 0 || game.team2_score > 0) // Only completed games
            .sort((a, b) => parseInt(a.week) - parseInt(b.week)); // Chronological order

        games.forEach(game => {
            const team1Id = String(game.team1_roster_id);
            const team2Id = String(game.team2_roster_id);
            
            if (!eloRatings[team1Id] || !eloRatings[team2Id]) return;

            const team1Rating = eloRatings[team1Id];
            const team2Rating = eloRatings[team2Id];
            
            // Calculate expected scores
            const team1Expected = 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
            const team2Expected = 1 - team1Expected;
            
            // Determine actual scores (1 for win, 0.5 for tie, 0 for loss)
            let team1Actual, team2Actual;
            if (game.team1_score > game.team2_score) {
                team1Actual = 1;
                team2Actual = 0;
            } else if (game.team2_score > game.team1_score) {
                team1Actual = 0;
                team2Actual = 1;
            } else {
                team1Actual = 0.5;
                team2Actual = 0.5;
            }
            
            // Update Elo ratings
            eloRatings[team1Id] = team1Rating + K_FACTOR * (team1Actual - team1Expected);
            eloRatings[team2Id] = team2Rating + K_FACTOR * (team2Actual - team2Expected);
        });
    }

    return eloRatings;
};

/**
 * Classify team strategy in keeper league context
 * @param {String} rosterId - Team roster ID
 * @param {Object} teamStats - Team statistics for current season
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @returns {Object} Team classification and strategy metrics
 */
export const classifyKeeperLeagueTeam = (rosterId, teamStats, historicalData, currentSeason) => {
    const team = teamStats[rosterId];
    if (!team) return { strategy: 'unknown', confidence: 0, metrics: {} };
    
    const gamesPlayed = team.gamesPlayed || 0;
    const wins = team.wins || 0;
    const losses = team.losses || 0;
    const avgScore = team.averageScore || 0;
    const powerScore = team.powerScore || 0;
    
    // Calculate win percentage and performance trends
    const winPct = gamesPlayed > 0 ? wins / gamesPlayed : 0;
    const pointsFor = team.pointsFor || 0;
    const pointsAgainst = team.pointsAgainst || 0;
    
    // Get recent trend (last 4 games)
    const recentMomentum = calculateTeamMomentum(rosterId, currentSeason, historicalData, 4);
    
    // Calculate league position relative to others
    const allPowerScores = Object.values(teamStats).map(t => t.powerScore || 0);
    const avgPowerScore = allPowerScores.reduce((sum, score) => sum + score, 0) / allPowerScores.length;
    const powerScorePercentile = allPowerScores.filter(score => score < powerScore).length / allPowerScores.length;
    
    // Metrics for classification
    const metrics = {
        winPct,
        avgScore,
        powerScore,
        powerScorePercentile,
        recentMomentum,
        pointsDifferential: pointsFor - pointsAgainst,
        gamesPlayed
    };
    
    // Classification logic for keeper leagues
    let strategy = 'middle';
    let confidence = 0.5;
    
    // Championship contenders ("selling out")
    if (winPct >= 0.7 && powerScorePercentile >= 0.75 && recentMomentum > 0.2) {
        strategy = 'contender';
        confidence = 0.9;
    } else if (winPct >= 0.6 && powerScorePercentile >= 0.7) {
        strategy = 'contender';
        confidence = 0.7;
    } else if (powerScorePercentile >= 0.8 && avgScore > (avgPowerScore * 1.15)) {
        strategy = 'contender';
        confidence = 0.6;
    }
    // Tanking teams
    else if (winPct <= 0.3 && powerScorePercentile <= 0.25 && recentMomentum < -0.2) {
        strategy = 'rebuilding';
        confidence = 0.9;
    } else if (winPct <= 0.4 && powerScorePercentile <= 0.3) {
        strategy = 'rebuilding';
        confidence = 0.7;
    } else if (powerScorePercentile <= 0.2 && avgScore < (avgPowerScore * 0.85)) {
        strategy = 'rebuilding';
        confidence = 0.6;
    }
    // Middle teams (stuck in mediocrity)
    else {
        // Further classify middle teams
        if (recentMomentum > 0.1 && winPct > 0.45) {
            strategy = 'rising';
            confidence = 0.6;
        } else if (recentMomentum < -0.1 && winPct < 0.55) {
            strategy = 'declining';
            confidence = 0.6;
        } else {
            strategy = 'middle';
            confidence = 0.8;
        }
    }
    
    // Adjust confidence based on sample size
    const sampleSizeMultiplier = Math.min(1.0, gamesPlayed / 6);
    confidence *= sampleSizeMultiplier;
    
    return {
        strategy,
        confidence,
        metrics,
        description: getStrategyDescription(strategy, confidence)
    };
};

/**
 * Get human-readable description of team strategy
 * @param {String} strategy - Team strategy classification
 * @param {Number} confidence - Confidence in classification
 * @returns {String} Description of team strategy
 */
const getStrategyDescription = (strategy, confidence) => {
    const confidenceLevel = confidence > 0.8 ? 'Very' : confidence > 0.6 ? 'Moderately' : 'Somewhat';
    
    switch (strategy) {
        case 'contender':
            return `${confidenceLevel} likely championship contender - selling out to win now`;
        case 'rebuilding':
            return `${confidenceLevel} likely rebuilding - tanking for future assets`;
        case 'rising':
            return `${confidenceLevel} likely on the rise - building momentum`;
        case 'declining':
            return `${confidenceLevel} likely declining - losing momentum`;
        case 'middle':
            return `${confidenceLevel} likely stuck in the middle - mediocre performance`;
        default:
            return 'Unknown strategy - insufficient data';
    }
};

/**
 * Calculate team consistency score based on multiple factors
 * @param {String} rosterId - Team roster ID
 * @param {Object} teamStats - Team statistics
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @returns {Object} Consistency metrics
 */
export const calculateTeamConsistency = (rosterId, teamStats, historicalData, currentSeason) => {
    const team = teamStats[rosterId];
    if (!team) return { consistency: 0.5, variance: 0, reliability: 0.5 };
    
    // Get weekly scores for consistency calculation
    let weeklyScores = [];
    if (historicalData?.matchupsBySeason?.[currentSeason]) {
        const teamGames = historicalData.matchupsBySeason[currentSeason]
            .filter(game => 
                (String(game.team1_roster_id) === String(rosterId) || String(game.team2_roster_id) === String(rosterId)) &&
                (game.team1_score > 0 || game.team2_score > 0)
            )
            .sort((a, b) => parseInt(a.week) - parseInt(b.week));
        
        weeklyScores = teamGames.map(game => {
            const isTeam1 = String(game.team1_roster_id) === String(rosterId);
            return isTeam1 ? game.team1_score : game.team2_score;
        });
    }
    
    if (weeklyScores.length < 3) {
        return { consistency: 0.5, variance: 0, reliability: 0.5, sampleSize: weeklyScores.length };
    }
    
    // Calculate scoring variance
    const avgScore = weeklyScores.reduce((sum, score) => sum + score, 0) / weeklyScores.length;
    const variance = weeklyScores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / weeklyScores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate coefficient of variation (lower = more consistent)
    const coefficientOfVariation = avgScore > 0 ? standardDeviation / avgScore : 1;
    
    // Consistency score (0 = very inconsistent, 1 = very consistent)
    // Good keeper league teams typically have CV between 0.1-0.25
    const consistency = Math.max(0, Math.min(1, 1 - (coefficientOfVariation / 0.4)));
    
    // Calculate week-to-week reliability (looking at score differences)
    let weekToWeekDiffs = [];
    for (let i = 1; i < weeklyScores.length; i++) {
        weekToWeekDiffs.push(Math.abs(weeklyScores[i] - weeklyScores[i-1]));
    }
    
    const avgWeekToWeekDiff = weekToWeekDiffs.length > 0 
        ? weekToWeekDiffs.reduce((sum, diff) => sum + diff, 0) / weekToWeekDiffs.length 
        : 0;
    
    // Reliability score (lower week-to-week differences = higher reliability)
    const reliability = Math.max(0, Math.min(1, 1 - (avgWeekToWeekDiff / (avgScore * 0.4))));
    
    // Calculate trend stability (are they trending up, down, or stable?)
    let trendStability = 0.5;
    if (weeklyScores.length >= 4) {
        const firstHalf = weeklyScores.slice(0, Math.floor(weeklyScores.length / 2));
        const secondHalf = weeklyScores.slice(Math.floor(weeklyScores.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
        
        const trendDiff = Math.abs(secondHalfAvg - firstHalfAvg);
        trendStability = Math.max(0, Math.min(1, 1 - (trendDiff / (avgScore * 0.3))));
    }
    
    return {
        consistency,
        variance,
        reliability,
        trendStability,
        coefficientOfVariation,
        avgScore,
        standardDeviation,
        sampleSize: weeklyScores.length,
        weeklyScores
    };
};

/**
 * Calculate enhanced team momentum with better weighting
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Season to analyze
 * @param {Object} historicalData - Historical matchup data
 * @param {Number} gameCount - Number of recent games to consider
 * @returns {Number} Momentum score between -1 and 1
 */
export const calculateTeamMomentum = (rosterId, season, historicalData, gameCount = 6) => {
    if (!historicalData?.matchupsBySeason?.[season]) return 0;

    const teamGames = historicalData.matchupsBySeason[season]
        .filter(game => 
            (String(game.team1_roster_id) === String(rosterId) || String(game.team2_roster_id) === String(rosterId)) &&
            (game.team1_score > 0 || game.team2_score > 0) // Only completed games
        )
        .sort((a, b) => parseInt(b.week) - parseInt(a.week)) // Most recent first
        .slice(0, gameCount);

    if (teamGames.length === 0) return 0;

    let momentumScore = 0;
    let weightSum = 0;
    const gameScores = [];

    teamGames.forEach((game, index) => {
        const isTeam1 = String(game.team1_roster_id) === String(rosterId);
        const teamScore = isTeam1 ? game.team1_score : game.team2_score;
        const opponentScore = isTeam1 ? game.team2_score : game.team1_score;
        
        gameScores.push({ teamScore, opponentScore, week: game.week });
        
        // Enhanced weight calculation - more recent games matter much more
        const recencyWeight = Math.pow(0.7, index); // Stronger decay than before
        
        // Performance weight - scoring relative to expectation matters
        const scoreDiff = teamScore - opponentScore;
        
        // Normalize performance using tanh for better distribution
        let gameResult = Math.tanh(scoreDiff / 50);
        
        // Bonus for dominant wins, penalty for close losses
        if (scoreDiff > 30) {
            gameResult *= 1.2; // Boost for blowout wins
        } else if (scoreDiff < -30) {
            gameResult *= 1.2; // Amplify blowout losses (negative)
        } else if (Math.abs(scoreDiff) < 10) {
            gameResult *= 0.8; // Slight penalty for close games (they're less indicative)
        }
        
        momentumScore += gameResult * recencyWeight;
        weightSum += recencyWeight;
    });

    // Calculate base momentum
    let baseMomentum = weightSum > 0 ? momentumScore / weightSum : 0;
    
    // Enhanced streak detection
    let currentStreak = 0;
    let streakType = 'none'; // 'win', 'loss', 'high', 'low'
    
    if (gameScores.length >= 3) {
        // Check for win/loss streaks
        const recentResults = gameScores.slice(0, 3).map(g => g.teamScore > g.opponentScore);
        if (recentResults.every(result => result === true)) {
            streakType = 'win';
            currentStreak = recentResults.length;
        } else if (recentResults.every(result => result === false)) {
            streakType = 'loss';
            currentStreak = recentResults.length;
        }
        
        // Check for scoring streaks (hot/cold)
        const avgTeamScore = gameScores.reduce((sum, g) => sum + g.teamScore, 0) / gameScores.length;
        const recentScores = gameScores.slice(0, 3);
        const recentAvg = recentScores.reduce((sum, g) => sum + g.teamScore, 0) / recentScores.length;
        
        if (recentAvg > avgTeamScore * 1.15) {
            streakType = streakType === 'none' ? 'hot' : streakType;
            currentStreak = Math.max(currentStreak, 2);
        } else if (recentAvg < avgTeamScore * 0.85) {
            streakType = streakType === 'none' ? 'cold' : streakType;
            currentStreak = Math.max(currentStreak, 2);
        }
    }
    
    // Apply streak bonus/penalty
    let streakAdjustment = 0;
    if (currentStreak >= 3) {
        switch (streakType) {
            case 'win':
            case 'hot':
                streakAdjustment = 0.2 * Math.min(currentStreak / 3, 2); // Max +0.4
                break;
            case 'loss':
            case 'cold':
                streakAdjustment = -0.2 * Math.min(currentStreak / 3, 2); // Max -0.4
                break;
        }
    }
    
    // Calculate trend improvement/decline
    let trendAdjustment = 0;
    if (gameScores.length >= 4) {
        const firstHalf = gameScores.slice(-Math.floor(gameScores.length / 2));
        const secondHalf = gameScores.slice(0, Math.floor(gameScores.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, g) => sum + (g.teamScore - g.opponentScore), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, g) => sum + (g.teamScore - g.opponentScore), 0) / secondHalf.length;
        
        const improvement = (secondHalfAvg - firstHalfAvg) / 50; // Normalize
        trendAdjustment = Math.tanh(improvement) * 0.15; // Max ±0.15
    }
    
    // Combine all momentum factors
    const finalMomentum = baseMomentum + streakAdjustment + trendAdjustment;
    
    // Clamp to reasonable bounds
    return Math.max(-1, Math.min(1, finalMomentum));
};

/**
 * Calculate advanced matchup context for keeper leagues
 * @param {Object} team1Stats - Team 1 statistics and classification
 * @param {Object} team2Stats - Team 2 statistics and classification
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @returns {Object} Matchup context and adjustments
 */
export const calculateKeeperMatchupContext = (team1Stats, team2Stats, historicalData, currentSeason) => {
    // Analyze the strategic matchup
    const team1Classification = team1Stats.classification || { strategy: 'middle', confidence: 0.5 };
    const team2Classification = team2Stats.classification || { strategy: 'middle', confidence: 0.5 };
    
    let contextAdjustments = {
        spreadMultiplier: 1.0,
        totalAdjustment: 0,
        confidenceBonus: 0,
        varianceAdjustment: 1.0,
        description: ''
    };
    
    // Contender vs Rebuilder - massive spread potential
    if ((team1Classification.strategy === 'contender' && team2Classification.strategy === 'rebuilding') ||
        (team1Classification.strategy === 'rebuilding' && team2Classification.strategy === 'contender')) {
        contextAdjustments.spreadMultiplier = 1.6;
        contextAdjustments.confidenceBonus = 0.2;
        contextAdjustments.varianceAdjustment = 0.8; // Less variance in lopsided matchups
        contextAdjustments.description = 'Championship contender vs rebuilding team - expect large spread';
    }
    // Contender vs Contender - close game, higher total
    else if (team1Classification.strategy === 'contender' && team2Classification.strategy === 'contender') {
        contextAdjustments.spreadMultiplier = 0.7;
        contextAdjustments.totalAdjustment = 15; // Both teams likely to score well
        contextAdjustments.varianceAdjustment = 1.2; // More variance in competitive games
        contextAdjustments.description = 'Championship contenders facing off - expect high-scoring close game';
    }
    // Rebuilder vs Rebuilder - unpredictable, lower total
    else if (team1Classification.strategy === 'rebuilding' && team2Classification.strategy === 'rebuilding') {
        contextAdjustments.spreadMultiplier = 0.8;
        contextAdjustments.totalAdjustment = -10; // Both teams likely to score poorly
        contextAdjustments.varianceAdjustment = 1.4; // High variance in bad team matchups
        contextAdjustments.description = 'Rebuilding teams battle - expect low-scoring unpredictable game';
    }
    // Rising vs Declining - momentum matchup
    else if ((team1Classification.strategy === 'rising' && team2Classification.strategy === 'declining') ||
             (team1Classification.strategy === 'declining' && team2Classification.strategy === 'rising')) {
        contextAdjustments.spreadMultiplier = 1.3;
        contextAdjustments.confidenceBonus = 0.1;
        contextAdjustments.description = 'Momentum mismatch - rising team vs declining team';
    }
    
    // Factor in team consistency for variance adjustments
    const team1Consistency = team1Stats.consistency || { consistency: 0.5, reliability: 0.5 };
    const team2Consistency = team2Stats.consistency || { consistency: 0.5, reliability: 0.5 };
    
    const avgConsistency = (team1Consistency.consistency + team2Consistency.consistency) / 2;
    const avgReliability = (team1Consistency.reliability + team2Consistency.reliability) / 2;
    
    // Adjust variance based on team consistency
    if (avgConsistency > 0.7 && avgReliability > 0.7) {
        contextAdjustments.varianceAdjustment *= 0.8; // Very consistent teams = lower variance
        contextAdjustments.confidenceBonus += 0.1;
    } else if (avgConsistency < 0.4 || avgReliability < 0.4) {
        contextAdjustments.varianceAdjustment *= 1.3; // Inconsistent teams = higher variance
    }
    
    return contextAdjustments;
};

/**
 * Calculate strength of schedule for a team
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Season to analyze
 * @param {Object} historicalData - Historical matchup data
 * @param {Object} teamPowerScores - Power scores for all teams
 * @returns {Number} Strength of schedule (average opponent power score)
 */
export const calculateStrengthOfSchedule = (rosterId, season, historicalData, teamPowerScores) => {
    if (!historicalData?.matchupsBySeason?.[season]) return 0;

    const teamGames = historicalData.matchupsBySeason[season]
        .filter(game => String(game.team1_roster_id) === String(rosterId) || String(game.team2_roster_id) === String(rosterId));

    if (teamGames.length === 0) return 0;

    let totalOpponentPower = 0;
    let gameCount = 0;

    teamGames.forEach(game => {
        const isTeam1 = String(game.team1_roster_id) === String(rosterId);
        const opponentId = isTeam1 ? String(game.team2_roster_id) : String(game.team1_roster_id);
        
        if (teamPowerScores[opponentId]) {
            totalOpponentPower += teamPowerScores[opponentId];
            gameCount++;
        }
    });

    return gameCount > 0 ? totalOpponentPower / gameCount : 0;
};

/**
 * Calculate injury/lineup stability factor
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Season to analyze
 * @param {Object} historicalData - Historical matchup data
 * @returns {Number} Stability factor between 0 and 1
 */
export const calculateLineupStability = (rosterId, season, historicalData) => {
    // This is a placeholder - in a real implementation, you'd analyze
    // starting lineup consistency, player availability, etc.
    // For now, return a baseline stability
    return 0.85; // Default high stability
};

/**
 * Calculate playoff probability using Monte Carlo simulation with hybrid playoff format
 * @param {String} rosterId - Team roster ID
 * @param {Object} teamPowerRankings - Current team power rankings
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @param {Number} simulations - Number of simulations to run
 * @returns {Number} Probability of making playoffs
 */
export const calculatePlayoffProbabilityMonteCarlo = (
    rosterId, 
    teamPowerRankings, 
    historicalData, 
    currentSeason, 
    simulations = 1000 // Reduced for performance
) => {
    const currentGamesPlayed = teamPowerRankings[rosterId]?.gamesPlayed || 0;
    const totalGames = 14; // Assume 14-week season
    const remainingGames = Math.max(0, totalGames - currentGamesPlayed);
    
    // Use the new hybrid playoff probability calculation
    return calculateHybridPlayoffProbability(
        rosterId,
        teamPowerRankings,
        remainingGames,
        simulations
    );
};

/**
 * Convert win probability to betting odds with vig
 * @param {Number} probability - Win probability (0-1)
 * @param {Number} vig - Sportsbook vig/juice (default 10%)
 * @returns {Object} American odds and implied probability
 */
export const calculateBookmakerOdds = (probability, vig = 0.10) => {
    // Adjust probability for vig
    const adjustedProb = probability * (1 + vig);
    const clampedProb = Math.max(0.01, Math.min(0.99, adjustedProb));
    
    let americanOdds;
    if (clampedProb >= 0.5) {
        americanOdds = Math.round(-100 * clampedProb / (1 - clampedProb));
    } else {
        americanOdds = Math.round(100 * (1 - clampedProb) / clampedProb);
    }
    
    // Calculate implied probability from the odds
    let impliedProbability;
    if (americanOdds < 0) {
        impliedProbability = (-americanOdds) / ((-americanOdds) + 100);
    } else {
        impliedProbability = 100 / (americanOdds + 100);
    }
    
    return {
        americanOdds,
        impliedProbability,
        originalProbability: probability,
        edge: impliedProbability - probability // House edge
    };
};

/**
 * Calculate live betting odds adjustments based on game state
 * @param {Object} gameState - Current game information
 * @param {Object} baseOdds - Pre-game odds
 * @returns {Object} Adjusted odds
 */
export const calculateLiveOdds = (gameState, baseOdds) => {
    // This would be used for in-game betting odds adjustments
    // Based on current score, time remaining, player performance, etc.
    // Placeholder implementation
    return baseOdds;
};

/**
 * Generate comprehensive betting markets for keeper leagues with enhanced analysis
 * @param {Object} matchup - Matchup information
 * @param {Object} teamStats - Team statistics
 * @param {Object} eloRatings - Elo ratings
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @returns {Object} Enhanced betting markets with keeper league context
 */
export const generateKeeperBettingMarkets = (matchup, teamStats, eloRatings = {}, historicalData = null, currentSeason = null, getTeamName = null, nflState = null) => {
    const team1Stats = teamStats[matchup.team1.rosterId];
    const team2Stats = teamStats[matchup.team2.rosterId];
    
    if (!team1Stats || !team2Stats) {
        return generateBettingMarkets(matchup, teamStats, eloRatings, historicalData, currentSeason, getTeamName, nflState);
    }
    
    // Enhanced team analysis for keeper leagues
    const team1Classification = classifyKeeperLeagueTeam(matchup.team1.rosterId, teamStats, historicalData, currentSeason);
    const team2Classification = classifyKeeperLeagueTeam(matchup.team2.rosterId, teamStats, historicalData, currentSeason);
    
    const team1Consistency = calculateTeamConsistency(matchup.team1.rosterId, teamStats, historicalData, currentSeason);
    const team2Consistency = calculateTeamConsistency(matchup.team2.rosterId, teamStats, historicalData, currentSeason);
    
    const team1Momentum = calculateTeamMomentum(matchup.team1.rosterId, currentSeason, historicalData, 6);
    const team2Momentum = calculateTeamMomentum(matchup.team2.rosterId, currentSeason, historicalData, 6);
    
    // Get matchup context for keeper leagues
    const matchupContext = calculateKeeperMatchupContext(
        { classification: team1Classification, consistency: team1Consistency },
        { classification: team2Classification, consistency: team2Consistency },
        historicalData,
        currentSeason
    );
    
    // Calculate DPR values for enhanced team evaluation
    let teamDPRValues = {};
    if (historicalData && currentSeason && getTeamName && nflState) {
        try {
            teamDPRValues = calculateTeamDPRValues(historicalData, currentSeason, getTeamName, nflState);
        } catch (error) {
            console.warn('DPR calculation failed, using fallback', error);
            // Continue without DPR values - function will fallback to basic stats
        }
    }
    
    // Enhanced win probability calculation with DPR
    const team1WinProb = calculateWinProbability(
        matchup.team1.rosterId,
        matchup.team2.rosterId,
        teamStats,
        eloRatings,
        historicalData,
        currentSeason,
        teamDPRValues, // Add DPR values
        getTeamName,   // Add getTeamName function
        nflState       // Add NFL state
    );
    
    const team2WinProb = 1 - team1WinProb;
    
    // Calculate base spread with keeper league adjustments - MORE AGGRESSIVE
    const probDiff = team1WinProb - 0.5;
    
    // Get scoring differential for enhanced spread calculation
    const team1AvgScore = team1Stats.averageScore || 100;
    const team2AvgScore = team2Stats.averageScore || 100;
    const scoringDiff = team1AvgScore - team2AvgScore;
    
    // More aggressive base spread calculation
    let rawSpread = probDiff * 15; // Increased from 8 to 15
    
    // Add scoring differential component (major factor for large point differences)
    const scoringSpreadComponent = scoringDiff * 0.4; // 40% of scoring difference becomes spread
    rawSpread += scoringSpreadComponent;
    
    // Apply keeper league context multipliers
    rawSpread *= matchupContext.spreadMultiplier;
    
    // Apply team momentum adjustments
    const momentumDiff = team1Momentum - team2Momentum;
    rawSpread += momentumDiff * 5; // Momentum can add ±5 points to spread
    
    // Apply consistency adjustments
    const consistencyDiff = (team1Consistency.consistency + team1Consistency.reliability) - 
                          (team2Consistency.consistency + team2Consistency.reliability);
    rawSpread += consistencyDiff * 3; // Consistency can add ±3 points
    
    // Season-based adjustments
    const team1GamesPlayed = team1Stats.gamesPlayed || 0;
    const team2GamesPlayed = team2Stats.gamesPlayed || 0;
    const maxGamesPlayed = Math.max(team1GamesPlayed, team2GamesPlayed);
    
    let seasonMultiplier = 1.0;
    if (maxGamesPlayed <= 3) {
        seasonMultiplier = 0.7; // Early season - more conservative
    } else if (maxGamesPlayed <= 6) {
        seasonMultiplier = 1.0; // Mid-early season
    } else if (maxGamesPlayed <= 10) {
        seasonMultiplier = 1.3; // Mid season - patterns emerging
    } else {
        seasonMultiplier = 1.6; // Late season - big disparities
    }
    
    rawSpread *= seasonMultiplier;
    
    // Apply variance for unpredictability (deterministic based on team IDs)
    const varianceRange = 3 * matchupContext.varianceAdjustment;
    const seedValue = parseInt(matchup.team1.rosterId) * 13 + parseInt(matchup.team2.rosterId) * 17;
    const pseudoRandom = ((seedValue * 9301 + 49297) % 233280) / 233280;
    const deterministicVariance = (pseudoRandom - 0.5) * varianceRange;
    rawSpread += deterministicVariance;
    
    // Soft cap extremely large spreads (but allow them in extreme cases)
    const softCapSpread = (spread) => {
        const maxReasonable = 20 + (maxGamesPlayed * 1.5);
        if (Math.abs(spread) <= maxReasonable) return spread;
        
        const excess = Math.abs(spread) - maxReasonable;
        const softCapped = maxReasonable + (excess / (1 + excess / 15));
        return spread > 0 ? softCapped : -softCapped;
    };
    
    rawSpread = softCapSpread(rawSpread);
    const pointSpread = Math.round(Math.abs(rawSpread) * 2) / 2;
    const hasSpread = pointSpread >= 0.5;
    
    // Enhanced total calculation
    let baseTotalPoints = team1AvgScore + team2AvgScore;
    
    // Apply matchup context adjustments
    baseTotalPoints += matchupContext.totalAdjustment;
    
    // Apply momentum to totals (hot teams score more)
    const avgMomentum = (team1Momentum + team2Momentum) / 2;
    baseTotalPoints += avgMomentum * 15; // ±15 points based on momentum
    
    // Apply consistency to totals (consistent teams more predictable)
    const avgConsistency = (team1Consistency.consistency + team2Consistency.consistency) / 2;
    if (avgConsistency > 0.7) {
        // Very consistent teams - slight boost to total (more predictable offense)
        baseTotalPoints += 5;
    } else if (avgConsistency < 0.4) {
        // Inconsistent teams - lower total (unreliable offense)
        baseTotalPoints -= 8;
    }
    
    // Strategy-based total adjustments
    if (team1Classification.strategy === 'contender' && team2Classification.strategy === 'contender') {
        baseTotalPoints += 12; // Two good teams = higher scoring
    } else if (team1Classification.strategy === 'rebuilding' && team2Classification.strategy === 'rebuilding') {
        baseTotalPoints -= 12; // Two bad teams = lower scoring
    }
    
    // Season progression adjustments
    const leagueAverage = 240;
    let seasonalTotal = baseTotalPoints;
    if (maxGamesPlayed <= 3) {
        seasonalTotal = (baseTotalPoints * 0.6) + (leagueAverage * 0.4);
    } else if (maxGamesPlayed <= 6) {
        seasonalTotal = (baseTotalPoints * 0.8) + (leagueAverage * 0.2);
    } else {
        seasonalTotal = (baseTotalPoints * 0.95) + (leagueAverage * 0.05);
    }
    
    // Add variance to total (deterministic based on team IDs)
    const totalVariance = 8 * matchupContext.varianceAdjustment;
    const seedValueTotal = parseInt(matchup.team1.rosterId) * 19 + parseInt(matchup.team2.rosterId) * 23;
    const pseudoRandomTotal = ((seedValueTotal * 9301 + 49297) % 233280) / 233280;
    const deterministicTotalVariance = (pseudoRandomTotal - 0.5) * totalVariance;
    seasonalTotal += deterministicTotalVariance;
    
    seasonalTotal = Math.max(180, Math.min(320, seasonalTotal));
    const overUnder = Math.round(seasonalTotal * 2) / 2;
    
    // Calculate confidence for spread odds
    const baseConfidence = Math.abs(probDiff) * 2;
    const adjustedConfidence = baseConfidence + matchupContext.confidenceBonus;
    
    // Calculate spread odds with proper juice
    const spreadOdds = calculateSpreadOdds(pointSpread, adjustedConfidence);
    
    // Build markets object with enhanced data
    let markets = {
        overUnder: {
            total: overUnder,
            overOdds: -122, // 10% edge
            underOdds: -122,
            confidence: adjustedConfidence,
            context: matchupContext.description
        },
        winProbabilities: {
            team1: team1WinProb,
            team2: team2WinProb,
            confidence: adjustedConfidence,
            momentum: { team1: team1Momentum, team2: team2Momentum }
        },
        teamAnalysis: {
            team1: {
                classification: team1Classification,
                consistency: team1Consistency,
                momentum: team1Momentum
            },
            team2: {
                classification: team2Classification,
                consistency: team2Consistency,
                momentum: team2Momentum
            },
            matchupContext: matchupContext
        }
    };
    
    // Add spread if meaningful and calculate proper moneylines
    if (hasSpread) {
        const isFavoriteTeam1 = rawSpread > 0;
        const favoriteTeam = isFavoriteTeam1 ? matchup.team1 : matchup.team2;
        
        // Calculate moneylines that match the spread with proper sportsbook edge
        const favoriteML = convertSpreadToMoneyline(pointSpread, true);
        const underdogML = convertSpreadToMoneyline(pointSpread, false);
        
        // Validate consistency and ensure proper edge
        const validatedOdds = validateOddsConsistency(pointSpread, favoriteML, underdogML);
        
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: pointSpread,
            odds: spreadOdds,
            confidence: adjustedConfidence,
            rawSpread: rawSpread,
            context: matchupContext.description,
            edgeInfo: {
                edge: validatedOdds.edge,
                adjusted: validatedOdds.adjusted
            }
        };
        
        // Set moneyline odds that match the spread
        if (isFavoriteTeam1) {
            matchup.team1.odds = validatedOdds.favoriteML;
            matchup.team2.odds = validatedOdds.underdogML;
        } else {
            matchup.team1.odds = validatedOdds.underdogML;
            matchup.team2.odds = validatedOdds.favoriteML;
        }
    } else {
        // Pick'em game - close odds with standard pick'em lines
        if (team1WinProb > team2WinProb) {
            matchup.team1.odds = -110; // Slight favorite gets standard vig
            matchup.team2.odds = -105;  // Slight underdog gets better odds
        } else {
            matchup.team1.odds = -105;  // Slight underdog gets better odds
            matchup.team2.odds = -110;  // Slight favorite gets standard vig
        }
        
        // Set pick'em spread with proper odds
        markets.pointSpread = {
            favorite: null, // No favorite in pick'em
            spread: 0,
            odds: -110, // Standard pick'em spread odds
            confidence: 0.1, // Low confidence for pick'em
            isPickEm: true,
            context: 'Pick\'em game - teams are evenly matched'
        };
    }
    
    return markets;
};

/**
 * Generate betting market varieties for keeper league using win probability (original function)
 * @param {Object} matchup - Matchup information
 * @param {Object} teamStats - Team statistics
 * @param {Object} eloRatings - Elo ratings
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @returns {Object} Various betting markets
 */
export const generateBettingMarkets = (matchup, teamStats, eloRatings = {}, historicalData = null, currentSeason = null, getTeamName = null, nflState = null) => {
    const team1Stats = teamStats[matchup.team1.rosterId];
    const team2Stats = teamStats[matchup.team2.rosterId];
    
    if (!team1Stats || !team2Stats) {
        // Fallback to simple calculation if no stats
        return generateSimpleBettingMarkets(matchup, teamStats);
    }

    // Calculate DPR values for enhanced team evaluation
    let teamDPRValues = {};
    if (historicalData && currentSeason && getTeamName && nflState) {
        try {
            teamDPRValues = calculateTeamDPRValues(historicalData, currentSeason, getTeamName, nflState);
        } catch (error) {
            console.warn('DPR calculation failed, using fallback', error);
            // Continue without DPR values - function will fallback to basic stats
        }
    }
    
    // Calculate win probability using DPR-enhanced analysis
    const team1WinProb = calculateWinProbability(
        matchup.team1.rosterId,
        matchup.team2.rosterId,
        teamStats,
        eloRatings,
        historicalData,
        currentSeason,
        teamDPRValues, // Add DPR values
        getTeamName,   // Add getTeamName function
        nflState       // Add NFL state
    );
    
    const team2WinProb = 1 - team1WinProb;
    
    // Enhanced spread calculation that better reflects large team differences
    const probDiff = team1WinProb - 0.5; // -0.45 to +0.45 range
    
    // More aggressive base spread calculation
    // Use scoring differential as additional factor for spread
    const team1AvgScore = team1Stats.averageScore || 100;
    const team2AvgScore = team2Stats.averageScore || 100;
    const scoringDiff = team1AvgScore - team2AvgScore;
    
    // Base spread from win probability (more aggressive scaling)
    let rawSpread = probDiff * 15; // Increased from 8 to 15 for bigger base spreads
    
    // Add scoring differential component (major factor for large point differences)
    // Each 10-point scoring difference should add ~3-5 points to spread
    const scoringSpreadComponent = scoringDiff * 0.4; // 40% of scoring difference becomes spread
    rawSpread += scoringSpreadComponent;
    
    // Apply keeper league scaling based on games played
    const team1GamesPlayed = team1Stats.gamesPlayed || 0;
    const team2GamesPlayed = team2Stats.gamesPlayed || 0;
    const maxGamesPlayed = Math.max(team1GamesPlayed, team2GamesPlayed);
    
    // Dynamic keeper league spread multipliers - no hard caps, just variance awareness
    let spreadMultiplier = 1.0;
    let varianceAdjustment = 1.0; // How much random variance to apply
    
    if (maxGamesPlayed <= 2) {
        spreadMultiplier = 1.5; // Early season, but keeper advantages still matter
        varianceAdjustment = 1.4; // Higher variance due to small sample size
    } else if (maxGamesPlayed <= 4) {
        spreadMultiplier = 2.0; // Advantages become clearer
        varianceAdjustment = 1.2; // Moderate variance
    } else if (maxGamesPlayed <= 8) {
        spreadMultiplier = 2.5; // Mid-season confidence building
        varianceAdjustment = 1.1; // Low variance
    } else if (maxGamesPlayed <= 12) {
        spreadMultiplier = 3.0; // Late season, high confidence in team differences
        varianceAdjustment = 1.0; // Minimal variance
    } else {
        spreadMultiplier = 3.5; // Very late season, massive confidence in disparities
        varianceAdjustment = 0.9; // Actually reduce variance - patterns are clear
    }
    
    rawSpread *= spreadMultiplier;
    
    // Apply early season variance - larger random swings early, smaller late (deterministic)
    const varianceRange = 0.3 * varianceAdjustment; // 30% base variance, scaled
    const seedValueSpread = parseInt(matchup.team1.rosterId) * 29 + parseInt(matchup.team2.rosterId) * 31;
    const pseudoRandomSpread = ((seedValueSpread * 9301 + 49297) % 233280) / 233280;
    const deterministicVariance = (pseudoRandomSpread - 0.5) * varianceRange;
    rawSpread *= (1 + deterministicVariance);
    
    // Soft limiting instead of hard caps - use sigmoid function to gradually reduce extreme spreads
    // This allows for truly massive spreads in extreme cases, but makes them less likely
    const softLimit = (spread) => {
        const maxReasonable = 25 + (maxGamesPlayed * 2); // Dynamic "reasonable" limit
        if (Math.abs(spread) <= maxReasonable) {
            return spread; // No adjustment for reasonable spreads
        }
        
        // For extreme spreads, use sigmoid to soft-cap but not eliminate
        const excess = Math.abs(spread) - maxReasonable;
        const softCapped = maxReasonable + (excess / (1 + excess / 20)); // Asymptotic approach
        return spread > 0 ? softCapped : -softCapped;
    };
    
    rawSpread = softLimit(rawSpread);
    let pointSpread = Math.round(Math.abs(rawSpread) * 2) / 2; // Round to nearest 0.5
    // For very close games (less than 0.5 point difference), make it a pick'em
    if (pointSpread < 0.5) {
        pointSpread = 0; // Pick'em game
    }
    const hasSpread = true; // Always show spread info, even for pick'em games
    
    // Calculate spread odds based on confidence with proper sportsbook vig
    let spreadOdds = -110; // Standard vig
    const confidence = Math.abs(probDiff) * 2; // 0 to 0.9 base confidence
    
    // Adjust confidence for early season variance
    let adjustedConfidence = confidence;
    if (maxGamesPlayed <= 2) {
        adjustedConfidence *= 0.6; // Much less confident early season
    } else if (maxGamesPlayed <= 4) {
        adjustedConfidence *= 0.8; // Moderately less confident
    } else if (maxGamesPlayed <= 8) {
        adjustedConfidence *= 0.95; // Nearly full confidence
    }
    // Late season keeps full confidence
    
    // Sportsbook adjusts vig based on confidence in the line
    if (adjustedConfidence < 0.15) {
        spreadOdds = -105; // Less confident = better odds for bettors (less vig)
    } else if (adjustedConfidence < 0.3) {
        spreadOdds = -108; // Low confidence
    } else if (adjustedConfidence > 0.7) {
        spreadOdds = -115; // High confidence = worse odds (more vig)
    } else if (adjustedConfidence > 0.8) {
        spreadOdds = -120; // Very high confidence = worst odds
    }
    
    // For very large spreads, sportsbooks often offer better odds to attract action on big underdogs
    if (pointSpread > 20) {
        spreadOdds = Math.max(spreadOdds, -108); // Cap the vig on huge spreads
    } else if (pointSpread > 30) {
        spreadOdds = -105; // Even better odds on massive spreads
    }
    
    // Calculate totals using both team projections and league context
    const baseTotalPoints = team1AvgScore + team2AvgScore;
    
    // Keeper league total adjustments
    const leagueAverage = 240; // Higher for keeper leagues
    let adjustedTotal = baseTotalPoints;
    
    if (maxGamesPlayed <= 2) {
        adjustedTotal = (baseTotalPoints * 0.4) + (leagueAverage * 0.6);
    } else if (maxGamesPlayed <= 4) {
        adjustedTotal = (baseTotalPoints * 0.7) + (leagueAverage * 0.3);
    } else if (maxGamesPlayed <= 8) {
        adjustedTotal = (baseTotalPoints * 0.85) + (leagueAverage * 0.15);
    } else {
        adjustedTotal = (baseTotalPoints * 0.95) + (leagueAverage * 0.05);
    }
    
    // Apply variance based on matchup type (deterministic)
    const competitiveMatchup = Math.abs(probDiff) < 0.15; // Close to 50/50
    const seedValueComp = parseInt(matchup.team1.rosterId) * 37 + parseInt(matchup.team2.rosterId) * 41;
    const pseudoRandomComp = ((seedValueComp * 9301 + 49297) % 233280) / 233280;
    
    if (competitiveMatchup) {
        // Competitive games tend to have higher variance
        adjustedTotal *= (0.95 + pseudoRandomComp * 0.1); // ±5% variance
    } else {
        // Blowouts can have lower totals (favorites rest players, etc.)
        adjustedTotal *= (0.90 + pseudoRandomComp * 0.2); // Wider variance
    }
    
    // Keeper league total bounds (extreme scores possible)
    adjustedTotal = Math.max(160, Math.min(340, adjustedTotal));
    const overUnder = Math.round(adjustedTotal * 2) / 2;
    
    // Calculate over/under odds with vig (10% edge)
    let overOdds = -122; // 55% implied probability for 10% total edge
    let underOdds = -122;
    
    // Adjust total odds based on how much variance we expect
    const totalVariance = competitiveMatchup ? 'high' : 'low';
    
    if (totalVariance === 'high') {
        // Competitive games have more scoring variance - sportsbook less confident
        overOdds = -115; // Still maintain edge but reduce juice slightly
        underOdds = -115;
    } else if (adjustedConfidence > 0.8) {
        // Very confident in outcome - sportsbook might shade totals
        overOdds = -125;
        underOdds = -110; // Slightly favor under in blowouts (favorites rest players)
    }
    
    // For very high totals (shootout games), books often adjust
    if (overUnder > 280) {
        overOdds = -110; // Encourage under betting on astronomical totals but maintain edge
        underOdds = -120;
    }
    
    // Calculate moneyline from win probability with proper sportsbook edge
    const calculateMoneylineFromProbability = (winProb, vigPercentage = 0.045) => {
        // Apply sportsbook edge (vig) - typically 4.5% total, split between both sides
        const vigAdjustment = vigPercentage / 2; // Split the vig
        
        let adjustedProb;
        if (winProb >= 0.5) {
            // Favorite - make the probability higher (worse odds for bettor)
            adjustedProb = Math.min(0.95, winProb + vigAdjustment);
        } else {
            // Underdog - make the probability lower (worse odds for bettor)  
            adjustedProb = Math.max(0.05, winProb - vigAdjustment);
        }
        
        if (adjustedProb >= 0.5) {
            // Favorite odds (negative)
            const impliedOdds = adjustedProb / (1 - adjustedProb);
            return Math.round(-100 * impliedOdds);
        } else {
            // Underdog odds (positive)
            const impliedOdds = (1 - adjustedProb) / adjustedProb;
            return Math.round(100 * impliedOdds);
        }
    };
    
    // Calculate moneyline odds with proper vig
    const team1Odds = calculateMoneylineFromProbability(team1WinProb);
    const team2Odds = calculateMoneylineFromProbability(team2WinProb);
    
    // Convert spread to moneyline relationship for consistency check
    const convertSpreadToMoneyline = (spread, isFavorite) => {
        // Standard spread-to-moneyline conversion used by sportsbooks
        let baseProb;
        
        if (spread <= 1) {
            baseProb = isFavorite ? 0.52 : 0.48;
        } else if (spread <= 2.5) {
            baseProb = isFavorite ? 0.55 : 0.45;
        } else if (spread <= 3.5) {
            baseProb = isFavorite ? 0.58 : 0.42;
        } else if (spread <= 4.5) {
            baseProb = isFavorite ? 0.62 : 0.38;
        } else if (spread <= 6.5) {
            baseProb = isFavorite ? 0.66 : 0.34;
        } else if (spread <= 8.5) {
            baseProb = isFavorite ? 0.70 : 0.30;
        } else if (spread <= 10.5) {
            baseProb = isFavorite ? 0.74 : 0.26;
        } else if (spread <= 13.5) {
            baseProb = isFavorite ? 0.78 : 0.22;
        } else if (spread <= 16.5) {
            baseProb = isFavorite ? 0.82 : 0.18;
        } else if (spread <= 20) {
            baseProb = isFavorite ? 0.85 : 0.15;
        } else if (spread <= 25) {
            baseProb = isFavorite ? 0.88 : 0.12;
        } else if (spread <= 30) {
            baseProb = isFavorite ? 0.91 : 0.09;
        } else {
            baseProb = isFavorite ? 0.94 : 0.06;
        }
        
        return calculateMoneylineFromProbability(baseProb);
    };
    
    // Advanced moneyline calculation with smooth probability scaling
    const calculateAdvancedMoneylineFromSpread = (spread, isFavorite, confidence = 0.7) => {
        // Use a smooth mathematical function instead of hardcoded buckets
        // This creates a continuous probability curve based on spread size
        
        // Base formula: probability increases with spread size using a sigmoid-like curve
        // Spreads of 0-3 points: 50-58% probability
        // Spreads of 3-10 points: 58-78% probability  
        // Spreads of 10-20 points: 78-90% probability
        // Spreads of 20+ points: 90-95+ % probability
        
        const baseProbFavorite = Math.min(0.97, 0.5 + (spread * 0.018) + (spread * spread * 0.0008));
        const baseProb = isFavorite ? baseProbFavorite : (1 - baseProbFavorite);
        
        return calculateMoneylineFromProbability(baseProb);
    };
    
    // Use the spread-derived moneyline if we have a spread, otherwise use probability-based
    let finalTeam1Odds, finalTeam2Odds;
    
    if (hasSpread && pointSpread > 0) {
        // Standard spread game
        const isFavoriteTeam1 = rawSpread > 0;
        finalTeam1Odds = convertSpreadToMoneyline(pointSpread, isFavoriteTeam1);
        finalTeam2Odds = convertSpreadToMoneyline(pointSpread, !isFavoriteTeam1);
    } else {
        // Pick'em game - use standard pick'em odds
        if (team1WinProb > team2WinProb) {
            finalTeam1Odds = -110; // Slight favorite
            finalTeam2Odds = -105;  // Slight underdog
        } else if (team2WinProb > team1WinProb) {
            finalTeam1Odds = -105;  // Slight underdog
            finalTeam2Odds = -110;  // Slight favorite
        } else {
            // Dead even - true pick'em
            finalTeam1Odds = -105;
            finalTeam2Odds = -105;
        }
    }
    
    // Build markets object
    let markets = {
        overUnder: {
            total: overUnder,
            overOdds: overOdds, // Dynamic vig based on confidence and game type
            underOdds: underOdds
        },
        winProbabilities: {
            team1: team1WinProb,
            team2: team2WinProb,
            confidence: adjustedConfidence,
            rawConfidence: confidence
        }
    };
    
    // Add spread info - always include, even for pick'em games
    if (hasSpread) {
        const isFavoriteTeam1 = rawSpread > 0;
        const favoriteTeam = pointSpread === 0 ? null : (isFavoriteTeam1 ? matchup.team1 : matchup.team2);
        
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: pointSpread,
            odds: pointSpread === 0 ? -110 : spreadOdds, // Standard -110 for pick'em spreads
            isPickEm: pointSpread === 0
        };
    }
    
    // Set moneyline odds on matchup object (consistent with spread)
    matchup.team1.odds = finalTeam1Odds;
    matchup.team2.odds = finalTeam2Odds;
    
    return markets;
};

/**
 * Simple fallback betting markets when full analysis isn't available
 * @param {Object} matchup - Matchup information
 * @param {Object} teamStats - Team statistics
 * @returns {Object} Basic betting markets
 */
export const generateSimpleBettingMarkets = (matchup, teamStats) => {
    const team1Stats = teamStats[matchup.team1.rosterId];
    const team2Stats = teamStats[matchup.team2.rosterId];
    
    const team1AvgScore = team1Stats?.averageScore || 120;
    const team2AvgScore = team2Stats?.averageScore || 120;
    const scoreDiff = Math.abs(team1AvgScore - team2AvgScore);
    
    // Simple spread calculation
    const spread = Math.round(scoreDiff * 0.8 * 2) / 2; // 80% of score diff, rounded to 0.5
    const hasSpread = spread >= 1;
    
    let markets = {
        overUnder: {
            total: Math.round((team1AvgScore + team2AvgScore) * 2) / 2,
            overOdds: -110,
            underOdds: -110
        }
    };
    
    if (hasSpread) {
        const favoriteTeam = team1AvgScore > team2AvgScore ? matchup.team1 : matchup.team2;
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: spread,
            odds: -110
        };
        
        // Basic moneyline
        const favoriteOdds = spread <= 3 ? -130 : spread <= 7 ? -180 : -250;
        const underdogOdds = spread <= 3 ? +110 : spread <= 7 ? +160 : +210;
        
        if (team1AvgScore > team2AvgScore) {
            matchup.team1.odds = favoriteOdds;
            matchup.team2.odds = underdogOdds;
        } else {
            matchup.team1.odds = underdogOdds;
            matchup.team2.odds = favoriteOdds;
        }
    } else {
        // Pick'em game
        if (team1WinProb > team2WinProb) {
            matchup.team1.odds = -110;
            matchup.team2.odds = -105;
        } else {
            matchup.team1.odds = -105;
            matchup.team2.odds = -110;
        }
        
        markets.pointSpread = {
            favorite: null,
            spread: 0,
            odds: -110,
            isPickEm: true
        };
    }
    
    return markets;
};

/**
 * Generate aggressive betting markets for keeper leagues (enhanced fallback)
 * @param {Object} matchup - Matchup information
 * @param {Object} teamStats - Team statistics
 * @returns {Object} Enhanced betting markets for keeper leagues
 */
export const generateEnhancedKeeperMarkets = (matchup, teamStats) => {
    const team1Stats = teamStats[matchup.team1.rosterId];
    const team2Stats = teamStats[matchup.team2.rosterId];
    
    console.log('Team stats for enhanced calculation:', {
        team1: team1Stats,
        team2: team2Stats
    });
    
    // Get more detailed stats
    const team1AvgScore = team1Stats?.averageScore || 120;
    const team2AvgScore = team2Stats?.averageScore || 120;
    const team1GamesPlayed = team1Stats?.gamesPlayed || 0;
    const team2GamesPlayed = team2Stats?.gamesPlayed || 0;
    const team1PowerScore = team1Stats?.powerScore || 0;
    const team2PowerScore = team2Stats?.powerScore || 0;
    const team1Wins = team1Stats?.wins || 0;
    const team2Wins = team2Stats?.wins || 0;
    const team1PointsFor = team1Stats?.pointsFor || team1AvgScore * Math.max(1, team1GamesPlayed);
    const team2PointsFor = team2Stats?.pointsFor || team2AvgScore * Math.max(1, team2GamesPlayed);
    
    // More sophisticated differential calculation
    let scoreDifferential = team1AvgScore - team2AvgScore;
    const powerDifferential = team1PowerScore - team2PowerScore;
    const winDifferential = team1GamesPlayed > 0 && team2GamesPlayed > 0 ? 
        (team1Wins / team1GamesPlayed) - (team2Wins / team2GamesPlayed) : 0;
    
    console.log('Differentials:', {
        score: scoreDifferential,
        power: powerDifferential,
        winRate: winDifferential
    });
    
    // Keeper league amplification - teams can be VERY different
    // Use multiple factors to determine true team strength gap
    const maxGamesPlayed = Math.max(team1GamesPlayed, team2GamesPlayed);
    
    // Combine score differential with power rankings and win rate
    let totalDifferential = scoreDifferential + (powerDifferential * 3) + (winDifferential * 15);
    
    console.log('Total differential before adjustments:', totalDifferential);
    
    // Season stage multiplier - trust the data more as season progresses
    let confidenceMultiplier;
    if (maxGamesPlayed <= 2) {
        confidenceMultiplier = 0.6; // Still be somewhat aggressive early in keeper leagues
    } else if (maxGamesPlayed <= 4) {
        confidenceMultiplier = 0.8; // More confidence
    } else if (maxGamesPlayed <= 8) {
        confidenceMultiplier = 1.0; // Full confidence mid-season
    } else {
        confidenceMultiplier = 1.2; // Even more aggressive late season
    }
    
    totalDifferential *= confidenceMultiplier;
    
    // Keeper league specific boosts
    // If one team is clearly better across multiple metrics, amplify the difference
    const metricsWhereTeam1Better = [
        team1AvgScore > team2AvgScore,
        team1PowerScore > team2PowerScore,
        winDifferential > 0.1
    ].filter(Boolean).length;
    
    if (metricsWhereTeam1Better >= 2) {
        // Team 1 is clearly better - boost the differential
        totalDifferential *= 1.3;
    } else if (metricsWhereTeam1Better === 0) {
        // Team 2 is clearly better - boost the differential (negative)
        totalDifferential *= 1.3;
    }
    
    // Extreme team detection - if one team is really good or really bad
    const team1IsExtreme = team1AvgScore > 140 || team1AvgScore < 90;
    const team2IsExtreme = team2AvgScore > 140 || team2AvgScore < 90;
    
    if (team1IsExtreme || team2IsExtreme) {
        totalDifferential *= 1.4; // Big boost for extreme matchups
    }
    
    console.log('Final total differential:', totalDifferential);
    
    // Apply maximums based on season stage (much higher than before)
    let maxSpread;
    if (maxGamesPlayed <= 2) {
        maxSpread = 12; // Early season can still have big gaps
    } else if (maxGamesPlayed <= 4) {
        maxSpread = 18; // Early-mid season
    } else if (maxGamesPlayed <= 8) {
        maxSpread = 25; // Mid season
    } else {
        maxSpread = 35; // Late season - huge spreads possible
    }
    
    // Cap the differential
    totalDifferential = Math.max(-maxSpread, Math.min(maxSpread, totalDifferential));
    
    // Round to nearest 0.5
    const spread = Math.round(Math.abs(totalDifferential) * 2) / 2;
    const hasSpread = spread >= 1; // Minimum 1 point spread
    
    console.log('Final spread calculation:', {
        rawDifferential: totalDifferential,
        spread,
        hasSpread
    });
    
    let markets = {};
    
    if (hasSpread) {
        const isFavoriteTeam1 = totalDifferential > 0;
        const favoriteTeam = isFavoriteTeam1 ? matchup.team1 : matchup.team2;
        
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: spread,
            odds: -110,
            confidence: Math.min(1, Math.abs(totalDifferential) / maxSpread)
        };
        
        // Calculate moneyline based on spread
        const favoriteML = calculateAdvancedMoneylineFromSpread(spread, true);
        const underdogML = calculateAdvancedMoneylineFromSpread(spread, false);
        
        if (isFavoriteTeam1) {
            matchup.team1.odds = favoriteML;
            matchup.team2.odds = underdogML;
        } else {
            matchup.team1.odds = underdogML;
            matchup.team2.odds = favoriteML;
        }
    } else {
        // Pick'em game
        if (Math.abs(totalDifferential) < 2) {
            matchup.team1.odds = -105;
            matchup.team2.odds = +105;
        } else {
            const slightFavorite = totalDifferential > 0 ? matchup.team1 : matchup.team2;
            if (slightFavorite === matchup.team1) {
                matchup.team1.odds = -115;
                matchup.team2.odds = +105;
            } else {
                matchup.team1.odds = +105;
                matchup.team2.odds = -115;
            }
        }
    }
    
    // Enhanced total calculation
    const baseTotal = team1AvgScore + team2AvgScore;
    let adjustedTotal = baseTotal;
    
    // Account for team quality affecting totals
    if (team1AvgScore > 130 && team2AvgScore > 130) {
        // Two high-scoring teams
        adjustedTotal *= 1.05;
    } else if (team1AvgScore < 100 && team2AvgScore < 100) {
        // Two low-scoring teams
        adjustedTotal *= 0.95;
    }
    
    // Clamp total to reasonable range
    adjustedTotal = Math.max(180, Math.min(320, adjustedTotal));
    const total = Math.round(adjustedTotal * 2) / 2;
    
    markets.overUnder = {
        total: total,
        overOdds: -110,
        underOdds: -110,
        projections: {
            team1: team1AvgScore,
            team2: team2AvgScore
        }
    };
    
    console.log('Generated markets:', markets);
    
    return markets;
};

/**
 * Generate betting markets using advanced roster analysis
 * @param {Object} matchup - Matchup information
 * @param {Object} rosterAnalysis - Comprehensive roster analysis
 * @returns {Object} Advanced betting markets
 */
export const generateAdvancedBettingMarkets = (matchup, rosterAnalysis) => {
    const { spread, team1Projection, team2Projection, confidence, analysis } = rosterAnalysis;
    
    // Calculate point spread with proper favorite/underdog assignment
    const hasSpread = Math.abs(spread) >= 0.5;
    let markets = {};
    
    if (hasSpread) {
        const isFavoriteTeam1 = spread > 0;
        const favoriteTeam = isFavoriteTeam1 ? matchup.team1 : matchup.team2;
        const underdogTeam = isFavoriteTeam1 ? matchup.team2 : matchup.team1;
        const pointSpread = Math.abs(spread);
        
        // Calculate spread odds based on confidence
        let spreadOdds = -110; // Default
        if (confidence < 0.3) {
            spreadOdds = -105; // Low confidence = better odds
        } else if (confidence > 0.7) {
            spreadOdds = -115; // High confidence = worse odds
        }
        
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: pointSpread,
            odds: spreadOdds,
            confidence: confidence,
            breakdown: analysis.breakdown
        };
        
        // Calculate moneyline odds based on spread
        const favoriteMLOdds = calculateAdvancedMoneylineFromSpread(pointSpread, true);
        const underdogMLOdds = calculateAdvancedMoneylineFromSpread(pointSpread, false);
        
        if (isFavoriteTeam1) {
            matchup.team1.odds = favoriteMLOdds;
            matchup.team2.odds = underdogMLOdds;
        } else {
            matchup.team1.odds = underdogMLOdds;
            matchup.team2.odds = favoriteMLOdds;
        }
    } else {
        // Pick'em game
        const team1Advantage = analysis.strength.differential;
        if (Math.abs(team1Advantage) < 2) {
            // Very close matchup (deterministic based on team IDs)
            const seedValuePickem = parseInt(matchup.team1.rosterId) * 43 + parseInt(matchup.team2.rosterId) * 47;
            const pseudoRandomPickem = ((seedValuePickem * 9301 + 49297) % 233280) / 233280;
            matchup.team1.odds = pseudoRandomPickem > 0.5 ? -102 : +102;
            matchup.team2.odds = matchup.team1.odds > 0 ? -102 : +102;
        } else {
            // Slight favorite based on analysis
            if (team1Advantage > 0) {
                matchup.team1.odds = -108;
                matchup.team2.odds = +108;
            } else {
                matchup.team1.odds = +108;
                matchup.team2.odds = -108;
            }
        }
    }
    
    // Calculate total points based on projections
    const projectedTotal = team1Projection + team2Projection;
    
    // Adjust for confidence in projections
    let totalAdjustment = 0;
    if (confidence < 0.4) {
        // Low confidence: regress toward league average
        const leagueAverage = 240;
        totalAdjustment = (leagueAverage - projectedTotal) * 0.3;
    }
    
    const adjustedTotal = projectedTotal + totalAdjustment;
    const overUnder = Math.round(adjustedTotal * 2) / 2; // Round to nearest 0.5
    
    markets.overUnder = {
        total: overUnder,
        overOdds: -110,
        underOdds: -110,
        confidence: confidence,
        projections: {
            team1: team1Projection,
            team2: team2Projection
        }
    };
    
    return markets;
};

/**
 * Legacy betting markets calculation (fallback) - Enhanced for keeper leagues
 * @param {Object} matchup - Matchup information
 * @param {Object} teamStats - Team statistics
 * @returns {Object} Enhanced betting markets for keeper leagues
 */
export const generateLegacyBettingMarkets = (matchup, teamStats) => {
    console.log('Using legacy calculation with keeper league enhancements');
    
    const team1Stats = teamStats[matchup.team1.rosterId];
    const team2Stats = teamStats[matchup.team2.rosterId];
    
    // Use more aggressive calculation for keeper leagues
    const team1AvgScore = team1Stats?.averageScore || 120;
    const team2AvgScore = team2Stats?.averageScore || 120;
    const team1PowerScore = team1Stats?.powerScore || 0;
    const team2PowerScore = team2Stats?.powerScore || 0;
    
    // Combine multiple factors for a stronger differential
    const scoreDiff = team1AvgScore - team2AvgScore;
    const powerDiff = (team1PowerScore - team2PowerScore) * 2; // Weight power scores heavily
    
    const totalDiff = scoreDiff + powerDiff;
    
    // Much more aggressive multiplier for keeper leagues
    const rawSpread = totalDiff * 1.2; // Increased from 0.6
    const spread = Math.round(Math.abs(rawSpread) * 2) / 2;
    const hasSpread = spread >= 1; // Minimum 1 point spread
    
    console.log('Legacy calculation:', {
        scoreDiff,
        powerDiff,
        totalDiff,
        rawSpread,
        finalSpread: spread
    });
    
    let markets = {};
    
    if (hasSpread && spread > 0.5) {
        const isFavoriteTeam1 = rawSpread > 0;
        const favoriteTeam = isFavoriteTeam1 ? matchup.team1 : matchup.team2;
        
        markets.pointSpread = {
            favorite: favoriteTeam,
            spread: spread,
            odds: -110
        };
        
        // More aggressive moneyline calculation
        const favoriteML = spread <= 2 ? -120 : spread <= 4 ? -150 : spread <= 7 ? -200 : spread <= 10 ? -280 : -400;
        const underdogML = spread <= 2 ? +100 : spread <= 4 ? +130 : spread <= 7 ? +170 : spread <= 10 ? +230 : +320;
        
        if (isFavoriteTeam1) {
            matchup.team1.odds = favoriteML;
            matchup.team2.odds = underdogML;
        } else {
            matchup.team1.odds = underdogML;
            matchup.team2.odds = favoriteML;
        }
    } else {
        // Pick'em but still consider small differences
        if (Math.abs(totalDiff) > 1) {
            const slightFavorite = totalDiff > 0;
            if (slightFavorite) {
                matchup.team1.odds = -115;
                matchup.team2.odds = +105;
            } else {
                matchup.team1.odds = +105;
                matchup.team2.odds = -115;
            }
        } else {
            matchup.team1.odds = -105;
            matchup.team2.odds = +105;
        }
    }
    
    // Enhanced total calculation
    const baseTotal = team1AvgScore + team2AvgScore;
    let total = baseTotal;
    
    // Adjust for extreme teams
    if (team1AvgScore > 140 || team2AvgScore > 140) {
        total *= 1.05; // High-scoring game
    } else if (team1AvgScore < 100 || team2AvgScore < 100) {
        total *= 0.95; // Low-scoring game
    }
    
    total = Math.round(Math.max(180, Math.min(320, total)) * 2) / 2;
    
    markets.overUnder = {
        total: total,
        overOdds: -110,
        underOdds: -110
    };
    
    return markets;
};

/**
 * Convert point spread to moneyline odds with proper sportsbook relationship
 * @param {Number} spread - Point spread (always positive, represents favorite's spread)
 * @param {Boolean} isFavorite - Whether calculating for the favorite or underdog
 * @param {Number} juicePercent - Sportsbook edge percentage (default 10%)
 * @returns {Number} American odds
 */
export const convertSpreadToMoneyline = (spread, isFavorite, juicePercent = 0.10) => {
    // Standard NFL spread-to-moneyline conversion table (fair odds)
    let fairProbability;
    
    if (spread <= 1) {
        fairProbability = isFavorite ? 0.525 : 0.475;
    } else if (spread <= 2.5) {
        fairProbability = isFavorite ? 0.58 : 0.42;
    } else if (spread <= 3.5) {
        fairProbability = isFavorite ? 0.62 : 0.38;
    } else if (spread <= 4.5) {
        fairProbability = isFavorite ? 0.66 : 0.34;
    } else if (spread <= 6.5) {
        fairProbability = isFavorite ? 0.70 : 0.30;
    } else if (spread <= 7.5) {
        fairProbability = isFavorite ? 0.73 : 0.27;
    } else if (spread <= 9.5) {
        fairProbability = isFavorite ? 0.76 : 0.24;
    } else if (spread <= 10.5) {
        fairProbability = isFavorite ? 0.78 : 0.22;
    } else if (spread <= 13.5) {
        fairProbability = isFavorite ? 0.82 : 0.18;
    } else if (spread <= 16.5) {
        fairProbability = isFavorite ? 0.85 : 0.15;
    } else if (spread <= 20) {
        fairProbability = isFavorite ? 0.88 : 0.12;
    } else if (spread <= 24) {
        fairProbability = isFavorite ? 0.91 : 0.09;
    } else {
        fairProbability = isFavorite ? 0.94 : 0.06;
    }
    
    // Apply sportsbook edge (juice)
    const edgeAdjustment = juicePercent / 2;
    let adjustedProbability;
    
    if (isFavorite) {
        // Make favorite's implied probability higher (worse odds for bettor)
        adjustedProbability = Math.min(0.95, fairProbability + edgeAdjustment);
    } else {
        // Make underdog's implied probability lower (worse odds for bettor)
        adjustedProbability = Math.max(0.05, fairProbability - edgeAdjustment);
    }
    
    // Convert to American odds
    if (adjustedProbability >= 0.5) {
        // Favorite odds (negative)
        return Math.round(-100 * adjustedProbability / (1 - adjustedProbability));
    } else {
        // Underdog odds (positive)
        return Math.round(100 * (1 - adjustedProbability) / adjustedProbability);
    }
};

/**
 * Calculate spread odds with proper juice/vig
 * @param {Number} spread - Point spread
 * @param {Number} confidence - Confidence level (0-1)
 * @param {Number} baseJuice - Base juice percentage
 * @returns {Number} Spread odds (typically around -110)
 */
export const calculateSpreadOdds = (spread, confidence = 0.5, baseJuice = 0.10) => {
    // Base spread odds start at -122 (10% vig split = 5% each side)
    let impliedProb = 0.55; // -122 = 55% implied probability
    
    // Adjust based on confidence and spread size
    if (confidence > 0.8 || spread > 14) {
        // Very confident or large spread - increase juice
        impliedProb = 0.58; // Higher juice for 10% edge
    } else if (confidence < 0.3 || spread < 3) {
        // Low confidence or close spread - reduce juice to attract action
        impliedProb = 0.52; // Still maintain substantial edge
    }
    
    // Convert to American odds
    return Math.round(-100 * impliedProb / (1 - impliedProb));
};

/**
 * Validate and ensure moneyline/spread consistency with proper edges
 * @param {Number} spread - Point spread
 * @param {Number} favoriteML - Favorite moneyline odds
 * @param {Number} underdogML - Underdog moneyline odds
 * @returns {Object} Validated and potentially adjusted odds
 */
export const validateOddsConsistency = (spread, favoriteML, underdogML) => {
    // Calculate expected moneyline from spread
    const expectedFavoriteML = convertSpreadToMoneyline(spread, true);
    const expectedUnderdogML = convertSpreadToMoneyline(spread, false);
    
    // Check if provided odds are reasonably close to expected
    const favoriteDiff = Math.abs(favoriteML - expectedFavoriteML);
    const underdogDiff = Math.abs(underdogML - expectedUnderdogML);
    
    // If odds are too far off, use the spread-derived odds
    const finalFavoriteML = favoriteDiff > 50 ? expectedFavoriteML : favoriteML;
    const finalUnderdogML = underdogDiff > 50 ? expectedUnderdogML : underdogML;
    
    // Ensure proper sportsbook edge exists
    const favoriteImplied = Math.abs(finalFavoriteML) / (Math.abs(finalFavoriteML) + 100);
    const underdogImplied = 100 / (finalUnderdogML + 100);
    const totalImplied = favoriteImplied + underdogImplied;
    
    // Total should be > 1.0 for sportsbook edge (typically 1.10 for 10% edge)
    const edge = totalImplied - 1.0;
    const minEdge = 0.10; // 10% minimum edge
    
    if (edge < minEdge) {
        // Adjust odds to ensure minimum edge
        const adjustment = (minEdge - edge) / 2;
        
        // Make both sides worse for bettors
        const adjustedFavoriteML = Math.round(finalFavoriteML * (1 + adjustment));
        const adjustedUnderdogML = Math.round(finalUnderdogML * (1 - adjustment));
        
        return {
            favoriteML: adjustedFavoriteML,
            underdogML: adjustedUnderdogML,
            edge: minEdge,
            adjusted: true
        };
    }
    
    return {
        favoriteML: finalFavoriteML,
        underdogML: finalUnderdogML,
        edge: edge,
        adjusted: false
    };
};

/**
 * Determine playoff teams using hybrid format for 12-team league:
 * - Top 4 teams by record get seeds 1-4 (from all 12 teams)
 * - Top 2 teams by points from remaining 8 teams get wildcard spots 5-6
 * @param {Object} teamPowerRankings - Current team power rankings with wins/losses/points
 * @returns {Array} Array of 6 playoff teams with their seeds [1-6]
 */
export const determineHybridPlayoffSeeding = (teamPowerRankings) => {
    const teams = Object.keys(teamPowerRankings).map(rosterId => ({
        rosterId,
        wins: teamPowerRankings[rosterId].wins || 0,
        losses: teamPowerRankings[rosterId].losses || 0,
        pointsFor: teamPowerRankings[rosterId].pointsFor || 0,
        gamesPlayed: teamPowerRankings[rosterId].gamesPlayed || 0
    }));

    // Calculate win percentage for proper record-based sorting
    teams.forEach(team => {
        team.winPercentage = team.gamesPlayed > 0 ? team.wins / team.gamesPlayed : 0;
    });

    // Sort all 12 teams by record (win percentage, then total wins as tiebreaker)
    const sortedByRecord = [...teams].sort((a, b) => {
        if (a.winPercentage !== b.winPercentage) {
            return b.winPercentage - a.winPercentage;
        }
        // If win percentage is tied, use total wins
        if (a.wins !== b.wins) {
            return b.wins - a.wins;
        }
        // If wins are tied, use points as final tiebreaker
        return b.pointsFor - a.pointsFor;
    });

    // Top 4 teams by record (from all 12) get seeds 1-4
    const recordBasedSeeds = sortedByRecord.slice(0, 4).map((team, index) => ({
        ...team,
        seed: index + 1,
        qualifyMethod: 'record'
    }));

    // Get the remaining 8 teams (those not in top 4 by record)
    const recordBasedRosterIds = new Set(recordBasedSeeds.map(team => team.rosterId));
    const remaining8Teams = teams.filter(team => !recordBasedRosterIds.has(team.rosterId));

    // Sort the remaining 8 teams by total points to find wildcards
    const sortedByPoints = remaining8Teams.sort((a, b) => b.pointsFor - a.pointsFor);
    
    // Top 2 teams by points from the remaining 8 get wildcard spots (seeds 5-6)
    const wildcardSeeds = sortedByPoints.slice(0, 2).map((team, index) => ({
        ...team,
        seed: index + 5, // Seeds 5 and 6
        qualifyMethod: 'wildcard'
    }));

    // Combine and sort by seed
    const playoffTeams = [...recordBasedSeeds, ...wildcardSeeds].sort((a, b) => a.seed - b.seed);

    return playoffTeams;
};

/**
 * Calculate probability that a team makes playoffs under hybrid format
 * @param {String} rosterId - Team roster ID to calculate probability for
 * @param {Object} teamPowerRankings - Current team power rankings
 * @param {Number} remainingGames - Number of games left in season
 * @param {Number} simulations - Number of Monte Carlo simulations to run
 * @returns {Number} Probability of making playoffs (0-1)
 */
export const calculateHybridPlayoffProbability = (
    rosterId,
    teamPowerRankings,
    remainingGames = 0,
    simulations = 1000 // Reduced for performance
) => {
    if (remainingGames === 0) {
        // Season is complete, just check current playoff status
        const playoffTeams = determineHybridPlayoffSeeding(teamPowerRankings);
        return playoffTeams.some(team => team.rosterId === rosterId) ? 1.0 : 0.0;
    }

    let playoffAppearances = 0;
    const totalTeams = Object.keys(teamPowerRankings).length;
    const teamIds = Object.keys(teamPowerRankings);

    for (let sim = 0; sim < simulations; sim++) {
        // Create simulation copy of current standings
        const simStandings = {};
        
        Object.keys(teamPowerRankings).forEach(id => {
            simStandings[id] = {
                wins: teamPowerRankings[id].wins || 0,
                losses: teamPowerRankings[id].losses || 0,
                pointsFor: teamPowerRankings[id].pointsFor || 0,
                gamesPlayed: teamPowerRankings[id].gamesPlayed || 0,
                averageScore: teamPowerRankings[id].averageScore || 100, // Default if no data
                powerScore: teamPowerRankings[id].powerScore || 0
            };
        });

        // Calculate team strength ratings for this simulation
        const teamStrengths = {};
        Object.keys(simStandings).forEach(id => {
            const team = simStandings[id];
            const gamesPlayed = team.gamesPlayed || 1;
            
            // Early season: heavily reduce power score influence, later: more on actual performance
            const earlySeasonWeight = Math.max(0, (14 - gamesPlayed) / 14);
            const lateSeasonWeight = 1 - earlySeasonWeight;
            
            // Very minimal power score impact early in season
            const powerStrength = ((team.powerScore || 0) / 5) * 0.15; // Further reduced
            
            // Performance strength from current record
            const winRate = gamesPlayed > 0 ? team.wins / gamesPlayed : 0.5;
            
            // Base strength calculation with heavy regression to mean early season
            let baseStrength;
            if (gamesPlayed <= 2) {
                // First 2 games: very minimal power influence, heavy regression to 50%
                baseStrength = 0.5 + (powerStrength * 0.05) + ((winRate - 0.5) * 0.1);
            } else if (gamesPlayed <= 5) {
                // Games 3-5: slightly more influence
                baseStrength = 0.5 + (powerStrength * 0.15) + ((winRate - 0.5) * 0.25);
            } else {
                // Later games: normal weighting
                baseStrength = (earlySeasonWeight * powerStrength) + (lateSeasonWeight * winRate);
            }
            
            // Add significant random variance for unpredictability 
            const randomVariance = (Math.random() - 0.5) * 0.3; // ±15% variance
            
            teamStrengths[id] = Math.max(0.25, Math.min(0.75, baseStrength + randomVariance));
        });

        // Simulate remaining weeks of head-to-head matchups
        for (let week = 0; week < remainingGames; week++) {
            // Create random matchups for this week (each team plays once)
            const availableTeams = [...teamIds];
            const weekMatchups = [];
            
            // Pair up teams randomly
            while (availableTeams.length >= 2) {
                const team1Index = Math.floor(Math.random() * availableTeams.length);
                const team1 = availableTeams.splice(team1Index, 1)[0];
                
                const team2Index = Math.floor(Math.random() * availableTeams.length);
                const team2 = availableTeams.splice(team2Index, 1)[0];
                
                weekMatchups.push([team1, team2]);
            }
            
            // If odd number of teams, one team gets a bye
            if (availableTeams.length === 1) {
                // Team with bye gets an average result
                const byeTeam = availableTeams[0];
                const team = simStandings[byeTeam];
                const avgScore = team.averageScore || 100;
                
                // Bye weeks typically result in league-average performance
                if (Math.random() < 0.5) {
                    team.wins++;
                    team.pointsFor += avgScore + (Math.random() - 0.5) * 20;
                } else {
                    team.losses++;
                    team.pointsFor += avgScore * 0.9 + (Math.random() - 0.5) * 20;
                }
                team.gamesPlayed++;
                team.averageScore = team.pointsFor / team.gamesPlayed;
            }
            
            // Simulate each matchup
            weekMatchups.forEach(([team1Id, team2Id]) => {
                const team1 = simStandings[team1Id];
                const team2 = simStandings[team2Id];
                const strength1 = teamStrengths[team1Id];
                const strength2 = teamStrengths[team2Id];
                
                // Calculate win probability based on strength differential
                const strengthDiff = strength1 - strength2;
                const baseProbability = 0.5 + (strengthDiff * 0.4); // Max 90% for huge strength diff
                
                // Add weekly variance (any given Sunday effect)
                const variance = (Math.random() - 0.5) * 0.2; // ±10% weekly variance
                const winProb1 = Math.max(0.15, Math.min(0.85, baseProbability + variance));
                
                // Simulate the game
                const team1Wins = Math.random() < winProb1;
                
                // Generate realistic scores based on team averages with variance
                const baseScore1 = team1.averageScore + (strength1 - 0.5) * 30;
                const baseScore2 = team2.averageScore + (strength2 - 0.5) * 30;
                
                const score1 = Math.max(40, baseScore1 + (Math.random() - 0.5) * 50);
                const score2 = Math.max(40, baseScore2 + (Math.random() - 0.5) * 50);
                
                // Update records
                if (team1Wins) {
                    team1.wins++;
                    team2.losses++;
                    // Winner typically scores more
                    team1.pointsFor += Math.max(score1, score2 + 5);
                    team2.pointsFor += Math.min(score1 - 5, score2);
                } else {
                    team2.wins++;
                    team1.losses++;
                    // Winner typically scores more
                    team2.pointsFor += Math.max(score1, score2 + 5);
                    team1.pointsFor += Math.min(score1, score2 - 5);
                }
                
                team1.gamesPlayed++;
                team2.gamesPlayed++;
                team1.averageScore = team1.pointsFor / team1.gamesPlayed;
                team2.averageScore = team2.pointsFor / team2.gamesPlayed;
                
                // Slightly adjust team strengths based on performance (teams get hot/cold)
                const performanceDiff = team1Wins ? 0.02 : -0.02;
                teamStrengths[team1Id] = Math.max(0.1, Math.min(0.9, teamStrengths[team1Id] + performanceDiff));
                teamStrengths[team2Id] = Math.max(0.1, Math.min(0.9, teamStrengths[team2Id] - performanceDiff));
            });
        }

        // After simulating all remaining games, check if our team made playoffs
        const finalPlayoffTeams = determineHybridPlayoffSeeding(simStandings);
        if (finalPlayoffTeams.some(team => team.rosterId === rosterId)) {
            playoffAppearances++;
        }
    }

    return playoffAppearances / simulations;
};

/**
 * Calculate championship odds based on playoff probability and seeding position
 * Now includes DPR values, strength of schedule, current performance trends, and remaining schedule difficulty
 * @param {String} rosterId - Team roster ID
 * @param {Object} teamPowerRankings - Current team power rankings
 * @param {Number} remainingGames - Number of games left in season
 * @param {Number} simulations - Number of simulations to run
 * @param {Object} historicalData - Historical matchup data for strength of schedule
 * @param {String} currentSeason - Current season for trend analysis
 * @param {Function} getTeamName - Function to get team names
 * @param {Object} nflState - Current NFL state
 * @returns {Object} Championship probability and odds breakdown
 */
export const calculateChampionshipOdds = (
    rosterId,
    teamPowerRankings,
    remainingGames = 0,
    simulations = 1000, // Reduced for performance
    historicalData = null,
    currentSeason = null,
    getTeamName = null,
    nflState = null
) => {
    // Calculate DPR values for enhanced team evaluation (skip for performance if needed)
    let teamDPRValues = {};
    if (historicalData && currentSeason && getTeamName && nflState && simulations >= 500) {
        // Only calculate DPR for high-precision requests to save time on UI updates
        teamDPRValues = calculateTeamDPRValues(historicalData, currentSeason, getTeamName, nflState);
    }
    
    // First, get playoff probability
    const playoffProbability = calculateHybridPlayoffProbability(
        rosterId,
        teamPowerRankings,
        remainingGames,
        simulations
    );

    const teamStats = teamPowerRankings[rosterId];
    const teamDPR = teamDPRValues[rosterId];
    
    if (!teamStats) {
        return { 
            championshipProbability: 0, 
            playoffProbability: 0,
            expectedSeed: null,
            strengthOfSchedule: 0,
            momentum: 0,
            recentForm: 0.5,
            dprAdjustedRating: 1.0,
            odds: {
                american: +50000, // Very long odds but not null
                decimal: 501,
                implied: 0.002
            }
        };
    }

    // Even if playoff probability is 0, teams can still have long-shot championship odds
    // unless they are mathematically eliminated (which we'll check below)
    
    // Calculate current strength of schedule (simplified for performance)
    const currentSOS = historicalData && simulations >= 500 ? 
        calculateStrengthOfSchedule(rosterId, currentSeason, historicalData, teamPowerRankings) : 50;
    
    // Calculate team momentum and recent performance (simplified for performance)
    const momentum = historicalData && simulations >= 500 ? 
        calculateTeamMomentum(rosterId, currentSeason, historicalData, 4) : 0;
    const recentForm = simulations >= 500 ? 
        calculateRecentForm(rosterId, currentSeason, 4, historicalData) : 0.5;
    
    // DPR-based team evaluation
    const dprAdjustedRating = teamDPR?.adjustedDPR || 1.0;
    const dprConfidence = teamDPR?.confidenceMultiplier || 0.5;
    
    // Check if team is mathematically eliminated from BOTH playoff paths
    const gamesPlayed = teamStats.gamesPlayed || 0;
    const wins = teamStats.wins || 0;
    const losses = teamStats.losses || 0;
    const pointsFor = teamStats.pointsFor || 0;
    const averageScore = teamStats.averageScore || 100;
    const totalGames = 14; // Assume 14-week season
    const gamesLeft = totalGames - gamesPlayed;
    const maxPossibleWins = wins + gamesLeft;
    
    // Get all teams for elimination analysis
    const allTeams = Object.keys(teamPowerRankings).map(id => ({
        rosterId: id,
        wins: teamPowerRankings[id].wins || 0,
        losses: teamPowerRankings[id].losses || 0,
        pointsFor: teamPowerRankings[id].pointsFor || 0,
        gamesPlayed: teamPowerRankings[id].gamesPlayed || 0,
        averageScore: teamPowerRankings[id].averageScore || 100
    })).sort((a, b) => {
        // Sort by win percentage, then by total wins, then by points
        const aWinPct = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
        const bWinPct = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
        if (aWinPct !== bWinPct) return bWinPct - aWinPct;
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
    });
    
    let isEliminatedFromRecord = false;
    let isEliminatedFromPoints = false;
    
    // Only check elimination if season is far enough along
    if (gamesPlayed >= 8) { // Only check elimination after week 8
        // Check if eliminated from top 4 by record
        const currentTop4ByRecord = allTeams.slice(0, 4);
        const fourthBestRecord = currentTop4ByRecord[3];
        const fourthBestWinPct = fourthBestRecord.gamesPlayed > 0 ? fourthBestRecord.wins / fourthBestRecord.gamesPlayed : 0;
        const fourthBestWins = fourthBestRecord.wins;
        
        // Can this team possibly tie the 4th place team's final record?
        const maxPossibleWinPct = totalGames > 0 ? maxPossibleWins / totalGames : 0;
        const canTieByWinPct = maxPossibleWinPct >= fourthBestWinPct;
        const canTieByWins = maxPossibleWins >= fourthBestWins;
        
        // If 4th place team still has games left, they could improve their record
        const fourthPlaceRemainingGames = totalGames - fourthBestRecord.gamesPlayed;
        const fourthPlaceMaxWins = fourthBestRecord.wins + fourthPlaceRemainingGames;
        
        isEliminatedFromRecord = !canTieByWinPct || maxPossibleWins < fourthPlaceMaxWins;
        
        // Check if eliminated from wildcard by points (seeds 5-6)
        if (isEliminatedFromRecord) {
            // Get teams NOT in top 4 by record (the 8 teams competing for wildcards)
            const currentTop4RosterIds = new Set(currentTop4ByRecord.map(t => t.rosterId));
            const wildcardContenders = allTeams.filter(t => !currentTop4RosterIds.has(t.rosterId));
            
            // Sort wildcard contenders by points
            wildcardContenders.sort((a, b) => b.pointsFor - a.pointsFor);
            
            if (wildcardContenders.length >= 2) {
                const secondWildcardTeam = wildcardContenders[1]; // 6th seed
                const secondWildcardPoints = secondWildcardTeam.pointsFor;
                
                // Calculate maximum possible points for our team
                const maxPossiblePoints = pointsFor + (gamesLeft * Math.max(averageScore * 1.5, 150)); // Optimistic scoring
                
                // Calculate minimum possible points for 6th seed team (if they have remaining games)
                const secondWildcardRemainingGames = totalGames - secondWildcardTeam.gamesPlayed;
                const secondWildcardMinPoints = secondWildcardPoints + (secondWildcardRemainingGames * Math.max(secondWildcardTeam.averageScore * 0.7, 60)); // Pessimistic scoring
                
                isEliminatedFromPoints = maxPossiblePoints < secondWildcardMinPoints;
            } else {
                isEliminatedFromPoints = false; // Not enough teams to fill wildcards yet
            }
        }
    }
    
    const isMathematicallyEliminated = isEliminatedFromRecord && isEliminatedFromPoints;
    
    if (isMathematicallyEliminated) {
        console.log(`Team ${rosterId} mathematically eliminated: Record path blocked: ${isEliminatedFromRecord}, Points path blocked: ${isEliminatedFromPoints}`);
        return {
            championshipProbability: 0,
            playoffProbability: 0,
            expectedSeed: null,
            strengthOfSchedule: currentSOS,
            momentum,
            recentForm,
            dprAdjustedRating,
            eliminationStatus: {
                isEliminated: true,
                eliminatedFromRecord: isEliminatedFromRecord,
                eliminatedFromPoints: isEliminatedFromPoints,
                maxPossibleWins,
                remainingGames: gamesLeft
            },
            odds: {
                american: null, // Only null when truly mathematically eliminated
                decimal: null,
                implied: 0
            }
        };
    }
    
    // Team quality factors - prioritize DPR over basic stats
    const winPct = gamesPlayed > 0 ? teamStats.wins / gamesPlayed : 0.5;
    const avgScore = teamDPR?.averageScore || teamStats.averageScore || 100;
    const dprQuality = dprAdjustedRating; // Use DPR as primary quality metric
    
    // Proper season simulation for championship odds
    let championships = 0;
    let totalPlayoffAppearances = 0;
    let seedCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    // Use a more reliable approach: base championship odds on playoff probability and team strength
    if (playoffProbability > 0) {
        // Calculate team strength relative to league (cache league average for performance)
        const teamScore = teamStats.averageScore || 100;
        const leagueAvgScore = teamPowerRankings._leagueAvgScore || 
            (() => {
                const avg = Object.values(teamPowerRankings)
                    .reduce((sum, team) => sum + (team.averageScore || 100), 0) / Object.keys(teamPowerRankings).length;
                teamPowerRankings._leagueAvgScore = avg; // Cache for subsequent calls
                return avg;
            })();
        
        const relativeStrength = teamScore / leagueAvgScore;
        const strengthMultiplier = Math.max(0.5, Math.min(2.0, relativeStrength)); // Cap between 0.5x and 2.0x
        
        // Factor in DPR if available
        const dprMultiplier = dprAdjustedRating > 0 ? dprAdjustedRating : 1.0;
        
        // Factor in momentum and recent form
        const momentumMultiplier = 1.0 + (momentum * 0.2); // ±20% based on momentum
        const formMultiplier = 1.0 + ((recentForm - 0.5) * 0.3); // ±15% based on recent form
        
        // Base championship probability calculation
        // Championship odds should be roughly playoff probability * (1/6) * quality adjustments
        // Since there are 6 playoff teams, average team has ~16.7% championship odds if they make playoffs
        const baseChampionshipGivenPlayoffs = 1.0 / 6.0; // 16.67%
        
        const qualityAdjustedChampionshipProb = baseChampionshipGivenPlayoffs * 
            strengthMultiplier * 
            dprMultiplier * 
            momentumMultiplier * 
            formMultiplier;
        
        // Final championship probability is playoff probability * championship probability given playoffs
        const championshipProbabilityCalculated = playoffProbability * qualityAdjustedChampionshipProb;
        
        // Simulate playoff appearances for seed distribution
        const simulatedPlayoffAppearances = Math.round(playoffProbability * simulations);
        totalPlayoffAppearances = simulatedPlayoffAppearances;
        
        // Create realistic seed distribution based on team's relative strength
        if (totalPlayoffAppearances > 0) {
            // Simplified team ranking calculation for performance
            // Calculate where this team ranks relative to all other teams
            const allTeams = Object.keys(teamPowerRankings);
            const thisTeamScore = teamStats.averageScore || 100;
            const thisTeamWins = teamStats.wins || 0;
            const thisTeamLosses = teamStats.losses || 0;
            const thisTeamWinPct = (thisTeamWins + thisTeamLosses) > 0 ? thisTeamWins / (thisTeamWins + thisTeamLosses) : 0.5;
            const thisTeamStrength = (thisTeamScore / leagueAvgScore) * 0.7 + thisTeamWinPct * 0.3;
            
            // Count how many teams are stronger (simplified ranking)
            let betterTeams = 0;
            for (const id of allTeams) {
                if (id === rosterId) continue;
                const stats = teamPowerRankings[id];
                const score = stats.averageScore || 100;
                const wins = stats.wins || 0;
                const losses = stats.losses || 0;
                const winPct = (wins + losses) > 0 ? wins / (wins + losses) : 0.5;
                const strength = (score / leagueAvgScore) * 0.7 + winPct * 0.3;
                if (strength > thisTeamStrength) betterTeams++;
            }
            
            const teamRank = betterTeams + 1; // 1 = strongest, 12 = weakest
            
            // Calculate seed probabilities based on team rank and playoff probability
            // Better teams are more likely to get better seeds when they make playoffs
            const rank = teamRank; // 1-12
            
            // Seed probability distribution based on team rank
            if (rank <= 2) {
                // Top 2 teams: heavily favored for 1-2 seeds
                seedCounts[1] = Math.round(totalPlayoffAppearances * 0.6);
                seedCounts[2] = Math.round(totalPlayoffAppearances * 0.25);
                seedCounts[3] = Math.round(totalPlayoffAppearances * 0.10);
                seedCounts[4] = Math.round(totalPlayoffAppearances * 0.05);
            } else if (rank <= 4) {
                // Teams 3-4: likely top 4 seeds
                seedCounts[1] = Math.round(totalPlayoffAppearances * 0.2);
                seedCounts[2] = Math.round(totalPlayoffAppearances * 0.35);
                seedCounts[3] = Math.round(totalPlayoffAppearances * 0.3);
                seedCounts[4] = Math.round(totalPlayoffAppearances * 0.15);
            } else if (rank <= 6) {
                // Teams 5-6: mix of record and wildcard seeds
                seedCounts[2] = Math.round(totalPlayoffAppearances * 0.15);
                seedCounts[3] = Math.round(totalPlayoffAppearances * 0.25);
                seedCounts[4] = Math.round(totalPlayoffAppearances * 0.3);
                seedCounts[5] = Math.round(totalPlayoffAppearances * 0.2);
                seedCounts[6] = Math.round(totalPlayoffAppearances * 0.1);
            } else if (rank <= 8) {
                // Teams 7-8: mainly wildcards when they make it
                seedCounts[4] = Math.round(totalPlayoffAppearances * 0.2);
                seedCounts[5] = Math.round(totalPlayoffAppearances * 0.4);
                seedCounts[6] = Math.round(totalPlayoffAppearances * 0.4);
            } else {
                // Teams 9-12: almost always 5-6 seeds (wildcards only)
                seedCounts[5] = Math.round(totalPlayoffAppearances * 0.6);
                seedCounts[6] = Math.round(totalPlayoffAppearances * 0.4);
            }
        }
        
        championships = Math.round(championshipProbabilityCalculated * simulations);
    }

    const championshipProbability = simulations > 0 ? championships / simulations : 0;
    const averageSeed = totalPlayoffAppearances > 0 ? 
        Object.keys(seedCounts).reduce((sum, seed) => sum + (parseInt(seed) * seedCounts[seed]), 0) / totalPlayoffAppearances : 
        null;

    // Convert to betting odds with 10% house edge
    let odds = { american: null, decimal: null, implied: championshipProbability };
    
    // For early season or teams with decent playoff chances, ensure they get reasonable championship odds
    let finalProbability = championshipProbability;
    
    // Calculate final championship probability
    finalProbability = championshipProbability;
    
    // Ensure reasonable minimum odds for teams with playoff chances
    if (finalProbability < 0.005 && playoffProbability > 0.05) {
        // Use a more conservative fallback based on playoff probability
        finalProbability = Math.max(0.005, playoffProbability * 0.12); // 12% of playoff probability as championship probability
    } else if (finalProbability === 0 && !isMathematicallyEliminated) {
        finalProbability = 0.001; // 0.1% minimum chance for non-eliminated teams
    }
    
    // Always give teams odds unless they're mathematically eliminated
    if (finalProbability > 0) {
        // Apply 10% house edge consistently with other odds
        const vigAdjustedProb = Math.min(0.95, finalProbability * 1.10);
        
        if (vigAdjustedProb >= 0.5) {
            odds.american = Math.round(-100 * vigAdjustedProb / (1 - vigAdjustedProb));
        } else {
            odds.american = Math.round(100 * (1 - vigAdjustedProb) / vigAdjustedProb);
        }
        odds.decimal = vigAdjustedProb > 0 ? 1 / vigAdjustedProb : null;
        odds.implied = vigAdjustedProb;
    }

    return {
        championshipProbability,
        playoffProbability,
        expectedSeed: averageSeed,
        strengthOfSchedule: currentSOS,
        momentum,
        recentForm,
        dprAdjustedRating,
        dprConfidence,
        seedDistribution: seedCounts,
        eliminationStatus: {
            isEliminated: false,
            eliminatedFromRecord: false,
            eliminatedFromPoints: false,
            maxPossibleWins,
            remainingGames: gamesLeft
        },
        odds
    };
};

/**
 * Enhanced playoff tournament simulation that considers team quality, momentum, and experience
 * @param {Number} seed - Team's playoff seed (1-6)
 * @param {Array} playoffTeams - All playoff teams with their data
 * @param {Object} simStandings - Simulated final standings
 * @param {String} rosterId - Team roster ID
 * @returns {Number} Probability of winning championship
 */
const simulateEnhancedPlayoffTournament = (seed, playoffTeams, simStandings, rosterId) => {
    const team = simStandings[rosterId];
    if (!team) return 0;
    
    // Base probability by seed (improved from original)
    const baseProbability = {
        1: 0.35,  // Top seed has good but not overwhelming advantage
        2: 0.25,  // Second seed strong
        3: 0.20,  // Third seed competitive  
        4: 0.15,  // Fourth seed viable
        5: 0.03,  // Fifth seed long shot
        6: 0.02   // Sixth seed very long shot
    };
    
    let championshipProb = baseProbability[seed] || 0;
    
    // Adjust for team quality factors
    const avgScore = team.averageScore || 100;
    const powerScore = team.powerScore || 50;
    const momentum = team.momentum || 0;
    
    // Quality bonus (great teams can overcome seed disadvantages)
    if (avgScore > 130) {
        championshipProb *= 1.4; // Elite scoring
    } else if (avgScore > 120) {
        championshipProb *= 1.2; // Very good scoring
    } else if (avgScore < 90) {
        championshipProb *= 0.7; // Poor scoring hurts
    }
    
    // Power score bonus
    if (powerScore > 70) {
        championshipProb *= 1.3; // Elite overall team
    } else if (powerScore > 60) {
        championshipProb *= 1.1; // Strong team
    } else if (powerScore < 40) {
        championshipProb *= 0.8; // Weak team
    }
    
    // Momentum factor (hot teams can go on runs)
    if (momentum > 0.6) {
        championshipProb *= 1.25; // Very hot team
    } else if (momentum > 0.3) {
        championshipProb *= 1.1;  // Good momentum
    } else if (momentum < -0.3) {
        championshipProb *= 0.8;  // Cold team struggles
    }
    
    // Strength of schedule factor (teams that played tough schedule are battle-tested)
    const sos = team.strengthOfSchedule || 50;
    if (sos > 55) {
        championshipProb *= 1.1; // Tough schedule = playoff ready
    } else if (sos < 45) {
        championshipProb *= 0.9; // Weak schedule = less tested
    }
    
    // Cap maximum probability (even great teams can lose)
    return Math.min(0.6, Math.max(0.01, championshipProb));
};

/**
 * Calculate recent form for a team
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Current season
 * @param {Number} gameCount - Number of recent games to analyze
 * @param {Object} historicalData - Historical matchup data
 * @returns {Number} Recent form score (0-1, where 1 is perfect record)
 */
const calculateRecentForm = (rosterId, season, gameCount = 4, historicalData = null) => {
    if (!historicalData?.matchupsBySeason?.[season]) return 0.5; // Default neutral

    const teamMatchups = historicalData.matchupsBySeason[season]
        .filter(m => String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId))
        .sort((a, b) => parseInt(b.week) - parseInt(a.week)) // Most recent first
        .slice(0, gameCount);

    if (teamMatchups.length === 0) return 0.5;

    const wins = teamMatchups.filter(matchup => {
        const isTeam1 = String(matchup.team1_roster_id) === String(rosterId);
        if (isTeam1) {
            return parseFloat(matchup.team1_score) > parseFloat(matchup.team2_score);
        } else {
            return parseFloat(matchup.team2_score) > parseFloat(matchup.team1_score);
        }
    }).length;

    return wins / teamMatchups.length;
};

/**
 * Simulate playoff tournament outcome probability based on seed
 * @param {Number} seed - Team's playoff seed (1-6)
 * @param {Array} playoffTeams - All playoff teams with their stats
 * @param {Object} teamStats - Final regular season stats
 * @returns {Number} Probability of winning championship (0-1)
 */
const simulatePlayoffTournament = (seed, playoffTeams, teamStats) => {
    // Seed-based championship probabilities (12-team keeper league)
    const baseProbabilities = {
        1: 0.30,  // Top seed gets big advantage
        2: 0.25,  // Second seed strong
        3: 0.20,  // Third seed decent
        4: 0.15,  // Fourth seed lower
        5: 0.07,  // Wildcard #1 - points-based, can be dangerous
        6: 0.03   // Wildcard #2 - least likely but possible
    };
    
    // Adjust for team strength relative to other playoff teams
    const team = playoffTeams.find(t => t.seed === seed);
    if (!team) return 0;
    
    const teamStrength = teamStats[team.rosterId];
    const avgPlayoffScore = playoffTeams.reduce((sum, t) => 
        sum + (teamStats[t.rosterId]?.averageScore || 100), 0) / playoffTeams.length;
    
    const strengthMultiplier = teamStrength?.averageScore ? 
        Math.min(1.5, Math.max(0.5, teamStrength.averageScore / avgPlayoffScore)) : 1.0;
    
    return baseProbabilities[seed] * strengthMultiplier;
};

export default {
    calculateEloRatings,
    calculateWinProbability,
    calculateHeadToHeadAdvantage,
    calculateTeamMomentum,
    calculateStrengthOfSchedule,
    calculateLineupStability,
    calculatePlayoffProbabilityMonteCarlo,
    calculateBookmakerOdds,
    calculateLiveOdds,
    generateBettingMarkets,
    generateKeeperBettingMarkets,
    generateSimpleBettingMarkets,
    classifyKeeperLeagueTeam,
    calculateTeamConsistency,
    calculateKeeperMatchupContext,
    convertSpreadToMoneyline,
    calculateSpreadOdds,
    validateOddsConsistency,
    determineHybridPlayoffSeeding,
    calculateHybridPlayoffProbability,
    calculateChampionshipOdds,
    calculateTeamDPRValues,
    clearDPRCache
};