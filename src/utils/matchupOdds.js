// src/utils/matchupOdds.js
// Utility functions for calculating matchup odds and betting markets

/**
 * Calculate head-to-head win probability between two teams
 * @param {String} team1RosterId - First team's roster ID
 * @param {String} team2RosterId - Second team's roster ID
 * @param {Object} teamPowerRankings - Power rankings for all teams
 * @param {Object} eloRatings - Elo ratings for all teams
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @returns {Number} Probability that team1 wins (0-1)
 */
export const calculateWinProbability = (
    team1RosterId, 
    team2RosterId, 
    teamPowerRankings, 
    eloRatings, 
    historicalData,
    currentSeason
) => {
    const team1 = teamPowerRankings[team1RosterId];
    const team2 = teamPowerRankings[team2RosterId];
    
    if (!team1 || !team2) return 0.5; // Default 50/50 if no data

    // 1. Elo-based probability
    const team1Elo = eloRatings[team1RosterId] || 1500;
    const team2Elo = eloRatings[team2RosterId] || 1500;
    const eloProb = 1 / (1 + Math.pow(10, (team2Elo - team1Elo) / 400));

    // 2. Power score comparison
    const powerScoreDiff = (team1.powerScore || 0) - (team2.powerScore || 0);
    const powerScoreProb = 0.5 + (powerScoreDiff / 200); // Normalize around 0.5

    // 3. Recent form comparison
    const team1Form = calculateRecentForm(team1RosterId, currentSeason, historicalData);
    const team2Form = calculateRecentForm(team2RosterId, currentSeason, historicalData);
    const formProb = 0.5 + (team1Form - team2Form) / 4; // Normalize

    // 4. Average points comparison
    const team1Avg = team1.averageScore || 0;
    const team2Avg = team2.averageScore || 0;
    const avgPointsProb = team1Avg > 0 && team2Avg > 0 ? 
        team1Avg / (team1Avg + team2Avg) : 0.5;

    // Weight the factors (early vs late season weighting)
    const gamesPlayed = team1.gamesPlayed || 0;
    const isEarlySeason = gamesPlayed <= 4;
    
    let finalProb;
    if (isEarlySeason) {
        // Early season: More weight on Elo and power score
        finalProb = (
            eloProb * 0.4 +           // Increased from 0.3
            powerScoreProb * 0.35 +   // Increased from 0.25
            avgPointsProb * 0.15 +    // Same
            formProb * 0.1            // Same
        );
    } else {
        // Mid/late season: More weight on current form and power score
        finalProb = (
            powerScoreProb * 0.4 +    // Increased from 0.35
            eloProb * 0.3 +           // Increased from 0.25
            formProb * 0.2 +          // Same
            avgPointsProb * 0.1       // Decreased from 0.15
        );
    }
    
    return Math.min(Math.max(finalProb, 0.05), 0.95); // Clamp between 5% and 95%
};

/**
 * Calculate win probability with bye week adjustments
 * @param {String} team1RosterId - Team 1 roster ID
 * @param {String} team2RosterId - Team 2 roster ID
 * @param {Object} teamPowerRankings - Team power rankings data
 * @param {Object} eloRatings - Elo ratings
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @param {Number} team1ByeImpact - Team 1 bye week impact factor
 * @param {Number} team2ByeImpact - Team 2 bye week impact factor
 * @returns {Number} Probability that team1 wins (0-1)
 */
export const calculateWinProbabilityWithByeWeeks = (
    team1RosterId, 
    team2RosterId, 
    teamPowerRankings, 
    eloRatings, 
    historicalData,
    currentSeason,
    team1ByeImpact = 1.0,
    team2ByeImpact = 1.0
) => {
    // Start with the base probability calculation
    const baseProb = calculateWinProbability(
        team1RosterId, 
        team2RosterId, 
        teamPowerRankings, 
        eloRatings, 
        historicalData,
        currentSeason
    );
    
    // Adjust for bye week impacts
    const team1Adjustment = team1ByeImpact - 1.0; // Convert to adjustment (-0.3 to 0.0)
    const team2Adjustment = team2ByeImpact - 1.0; // Convert to adjustment (-0.3 to 0.0)
    
    // The relative difference in bye week impact affects probability
    const byeWeekAdjustment = (team1Adjustment - team2Adjustment) * 0.25; // Scale the impact
    
    const adjustedProb = baseProb + byeWeekAdjustment;
    
    return Math.max(0.1, Math.min(0.9, adjustedProb));
};

/**
 * Calculate recent form for a team
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Current season
 * @param {Object} historicalData - Historical matchup data
 * @param {Number} gameCount - Number of recent games to consider
 * @returns {Number} Recent form score (-1 to 1)
 */
export const calculateRecentForm = (rosterId, season, historicalData, gameCount = 4) => {
    if (!historicalData?.matchupsBySeason?.[season]) return 0;

    const teamGames = historicalData.matchupsBySeason[season]
        .filter(game => 
            (String(game.team1_roster_id) === String(rosterId) || String(game.team2_roster_id) === String(rosterId)) &&
            (game.team1_score > 0 || game.team2_score > 0)
        )
        .sort((a, b) => parseInt(b.week) - parseInt(a.week))
        .slice(0, gameCount);

    if (teamGames.length === 0) return 0;

    let formScore = 0;
    teamGames.forEach((game, index) => {
        const isTeam1 = String(game.team1_roster_id) === String(rosterId);
        const teamScore = isTeam1 ? game.team1_score : game.team2_score;
        const opponentScore = isTeam1 ? game.team2_score : game.team1_score;
        
        const scoreDiff = teamScore - opponentScore;
        const gameResult = Math.tanh(scoreDiff / 50); // Normalize
        const weight = Math.pow(0.8, index); // Recent games weighted more
        
        formScore += gameResult * weight;
    });

    return formScore / teamGames.length;
};


/**
 * Convert probability to American odds
 * @param {Number} probability - Win probability (0-1)
 * @returns {Number} American odds
 */
export const probabilityToAmericanOdds = (probability) => {
    const clampedProb = Math.max(0.01, Math.min(0.99, probability));
    
    if (clampedProb >= 0.5) {
        return Math.round(-100 * clampedProb / (1 - clampedProb));
    } else {
        return Math.round(100 * (1 - clampedProb) / clampedProb);
    }
};

/**
 * Format odds for display
 * @param {Number} odds - American odds
 * @returns {String} Formatted odds string
 */
export const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
};

/**
 * Calculate league historical scoring averages to avoid early season skew
 * @param {Object} historicalData - Historical matchup data
 * @param {String} currentSeason - Current season
 * @returns {Object} Historical scoring statistics
 */
export const calculateLeagueHistoricalAverages = (historicalData, currentSeason) => {
    if (!historicalData?.matchupsBySeason) {
        return { avgTeamScore: 110, avgGameTotal: 220, stdDev: 25 };
    }

    let allScores = [];
    let allGameTotals = [];
    
    // Get data from last 3 seasons (excluding current to avoid early season bias)
    const seasons = Object.keys(historicalData.matchupsBySeason)
        .filter(season => parseInt(season) < parseInt(currentSeason))
        .sort((a, b) => b - a)
        .slice(0, 3);

    seasons.forEach(season => {
        const seasonGames = historicalData.matchupsBySeason[season]
            .filter(game => game.team1_score > 0 && game.team2_score > 0);
        
        seasonGames.forEach(game => {
            allScores.push(game.team1_score, game.team2_score);
            allGameTotals.push(game.team1_score + game.team2_score);
        });
    });

    if (allScores.length === 0) {
        // Fallback to reasonable defaults
        return { avgTeamScore: 110, avgGameTotal: 220, stdDev: 25 };
    }

    const avgTeamScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    const avgGameTotal = allGameTotals.reduce((sum, total) => sum + total, 0) / allGameTotals.length;
    
    // Calculate standard deviation for variance understanding
    const variance = allScores.reduce((sum, score) => sum + Math.pow(score - avgTeamScore, 2), 0) / allScores.length;
    const stdDev = Math.sqrt(variance);

    return { avgTeamScore, avgGameTotal, stdDev };
};

/**
 * Get NFL bye weeks for a given season and week
 * @param {String} season - NFL season
 * @param {Number} week - NFL week
 * @returns {Array} Array of NFL team abbreviations on bye
 */
export const getNFLByeWeeks = (season, week) => {
    // 2024 NFL bye weeks (you'd want to update this each season or fetch from API)
    const byeWeekSchedule = {
        2024: {
            5: ['DET', 'LAC'],
            6: ['BYE', 'KC', 'LAR', 'MIA', 'MIN', 'WAS'],
            7: ['CHI', 'DAL'],
            8: ['CAR', 'DEN', 'LV', 'NE', 'NYG', 'SEA'],
            9: ['CLE', 'GB', 'HOU', 'IND', 'JAX', 'TEN'],
            10: ['ARI', 'SF'],
            11: ['ATL', 'BUF', 'CIN', 'JAX', 'NO', 'NYJ'],
            12: ['BAL', 'PIT'],
            13: [],
            14: ['TB'],
            15: [],
            16: [],
            17: [],
            18: []
        },
        2025: {
            // Will need to be updated when 2025 schedule is released
            5: ['DET', 'LAC'],
            6: ['BYE', 'KC', 'LAR', 'MIA', 'MIN', 'WAS'],
            7: ['CHI', 'DAL'],
            8: ['CAR', 'DEN', 'LV', 'NE', 'NYG', 'SEA'],
            9: ['CLE', 'GB', 'HOU', 'IND', 'JAX', 'TEN'],
            10: ['ARI', 'SF'],
            11: ['ATL', 'BUF', 'CIN', 'JAX', 'NO', 'NYJ'],
            12: ['BAL', 'PIT'],
            13: [],
            14: ['TB']
        }
    };
    
    return byeWeekSchedule[season]?.[week] || [];
};

/**
 * Calculate bye week impact on team strength
 * @param {String} rosterId - Team roster ID
 * @param {String} season - Current season
 * @param {Number} week - Current week
 * @param {Object} historicalData - Historical matchup data
 * @param {Object} nflPlayers - NFL player data
 * @returns {Number} Bye week impact factor (0.7-1.0, where 1.0 = no impact)
 */
export const calculateByeWeekImpact = (rosterId, season, week, historicalData, nflPlayers) => {
    // Get teams on bye this week
    const byeTeams = getNFLByeWeeks(season, week);
    if (byeTeams.length === 0) return 1.0; // No byes this week
    
    // Find the team's roster for this season
    const teamRoster = historicalData?.rostersBySeason?.[season]?.find(
        r => String(r.roster_id) === String(rosterId)
    );
    
    if (!teamRoster?.players) return 1.0; // No roster data
    
    let byePlayerCount = 0;
    let totalKeyPlayers = 0;
    
    // Check each player on the roster
    teamRoster.players.forEach(playerId => {
        const player = nflPlayers?.[playerId];
        if (!player) return;
        
        // Count key fantasy positions
        const keyPositions = ['QB', 'RB', 'WR', 'TE'];
        if (keyPositions.includes(player.position)) {
            totalKeyPlayers++;
            
            // Check if player's NFL team is on bye
            if (byeTeams.includes(player.team)) {
                byePlayerCount++;
            }
        }
    });
    
    if (totalKeyPlayers === 0) return 1.0; // No key players found
    
    // Calculate impact based on percentage of key players on bye
    const byePercentage = byePlayerCount / totalKeyPlayers;
    
    // Impact scale:
    // 0% players on bye = 1.0 (no impact)
    // 25% players on bye = 0.95 (slight impact)
    // 50% players on bye = 0.85 (moderate impact)
    // 75%+ players on bye = 0.7 (significant impact)
    
    let impactFactor = 1.0;
    if (byePercentage > 0) {
        impactFactor = Math.max(0.7, 1.0 - (byePercentage * 0.4));
    }
    
    return impactFactor;
};

/**
 * Generate comprehensive betting markets for a matchup
 * @param {Object} matchup - Matchup data
 * @param {Object} team1Details - Team 1 details
 * @param {Object} team2Details - Team 2 details
 * @param {Object} teamPowerRankings - Power rankings
 * @param {Object} eloRatings - Elo ratings
 * @param {Object} historicalData - Historical data
 * @param {String} currentSeason - Current season
 * @param {Number} week - Current week (optional)
 * @param {Object} nflPlayers - NFL player data (optional)
 * @returns {Object} Betting markets
 */
export const generateMatchupBettingMarkets = (
    matchup,
    team1Details,
    team2Details,
    teamPowerRankings,
    eloRatings,
    historicalData,
    currentSeason,
    week = null,
    nflPlayers = null
) => {
    const team1RosterId = String(matchup.team1_roster_id);
    const team2RosterId = String(matchup.team2_roster_id);
    
    const team1Stats = teamPowerRankings[team1RosterId];
    const team2Stats = teamPowerRankings[team2RosterId];
    
    if (!team1Stats || !team2Stats) return null;

    // Calculate bye week impacts if we have the data
    let team1ByeImpact = 1.0;
    let team2ByeImpact = 1.0;
    
    if (week && nflPlayers) {
        team1ByeImpact = calculateByeWeekImpact(team1RosterId, currentSeason, week, historicalData, nflPlayers);
        team2ByeImpact = calculateByeWeekImpact(team2RosterId, currentSeason, week, historicalData, nflPlayers);
    }

    // Adjust team stats for bye week impacts
    const adjustedTeam1Stats = {
        ...team1Stats,
        powerScore: (team1Stats.powerScore || 0) * team1ByeImpact,
        averageScore: (team1Stats.averageScore || 0) * team1ByeImpact
    };
    
    const adjustedTeam2Stats = {
        ...team2Stats,
        powerScore: (team2Stats.powerScore || 0) * team2ByeImpact,
        averageScore: (team2Stats.averageScore || 0) * team2ByeImpact
    };

    // Calculate win probability with bye week adjustments
    const team1WinProb = calculateWinProbabilityWithByeWeeks(
        team1RosterId, 
        team2RosterId, 
        teamPowerRankings, 
        eloRatings, 
        historicalData,
        currentSeason,
        team1ByeImpact,
        team2ByeImpact
    );
    
    const team2WinProb = 1 - team1WinProb;

    // Moneyline odds with vig
    const vigAdjustment = 0.045; // 4.5% vig
    const team1AdjustedProb = Math.min(0.98, team1WinProb * (1 + vigAdjustment));
    const team2AdjustedProb = Math.min(0.98, team2WinProb * (1 + vigAdjustment));
    
    const team1MoneylineOdds = probabilityToAmericanOdds(team1AdjustedProb);
    const team2MoneylineOdds = probabilityToAmericanOdds(team2AdjustedProb);

    // Point spread calculation with bye week adjustments
    const avgScoreDiff = (adjustedTeam1Stats.averageScore || 0) - (adjustedTeam2Stats.averageScore || 0);
    const powerScoreDiff = (adjustedTeam1Stats.powerScore || 0) - (adjustedTeam2Stats.powerScore || 0);
    const spreadAdjustment = (avgScoreDiff + powerScoreDiff / 10) / 2;
    
    let pointSpread = Math.round(spreadAdjustment * 2) / 2; // Round to nearest 0.5
    pointSpread = Math.max(-20, Math.min(20, pointSpread)); // Cap spread
    
    const favoriteTeam = pointSpread > 0 ? team1Details : team2Details;
    const underdogTeam = pointSpread > 0 ? team2Details : team1Details;
    const absSpread = Math.abs(pointSpread);

    // Over/under total - use historical averages to avoid early season skew and adjust for bye weeks
    const historicalAverages = calculateLeagueHistoricalAverages(historicalData, currentSeason);
    
    // Get current season averages for teams (with bye week adjustments)
    const team1AvgScore = adjustedTeam1Stats.averageScore || 0;
    const team2AvgScore = adjustedTeam2Stats.averageScore || 0;
    const currentSeasonTotal = team1AvgScore + team2AvgScore;
    
    // Blend current season data with historical averages
    const gamesPlayed = Math.max(team1Stats.gamesPlayed || 0, team2Stats.gamesPlayed || 0);
    let totalPoints;
    
    if (gamesPlayed <= 3) {
        // Early season: 70% historical, 30% current
        totalPoints = (historicalAverages.avgGameTotal * 0.7) + (currentSeasonTotal * 0.3);
    } else if (gamesPlayed <= 6) {
        // Mid-early season: 50% historical, 50% current
        totalPoints = (historicalAverages.avgGameTotal * 0.5) + (currentSeasonTotal * 0.5);
    } else {
        // Later season: 30% historical, 70% current
        totalPoints = (historicalAverages.avgGameTotal * 0.3) + (currentSeasonTotal * 0.7);
    }
    
    // Ensure reasonable bounds and round to nearest 0.5
    totalPoints = Math.max(150, Math.min(300, totalPoints)); // Reasonable fantasy football range
    const overUnder = Math.round(totalPoints * 2) / 2;

    return {
        moneyline: {
            team1: {
                name: team1Details.name,
                odds: team1MoneylineOdds,
                probability: team1WinProb
            },
            team2: {
                name: team2Details.name,
                odds: team2MoneylineOdds,
                probability: team2WinProb
            }
        },
        spread: {
            favorite: {
                name: favoriteTeam.name,
                spread: absSpread,
                odds: -110
            },
            underdog: {
                name: underdogTeam.name,
                spread: absSpread,
                odds: -110
            }
        },
        total: {
            over: {
                total: overUnder,
                odds: -110
            },
            under: {
                total: overUnder,
                odds: -110
            }
        },
        metadata: {
            team1WinProb,
            team2WinProb,
            pointSpread,
            totalPoints: overUnder
        }
    };
};

export default {
    calculateWinProbability,
    calculateWinProbabilityWithByeWeeks,
    calculateRecentForm,
    probabilityToAmericanOdds,
    formatOdds,
    generateMatchupBettingMarkets,
    calculateLeagueHistoricalAverages,
    getNFLByeWeeks,
    calculateByeWeekImpact
};