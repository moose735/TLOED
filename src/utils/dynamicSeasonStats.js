// Dynamic season stats builder - replaces hardcoded currentSeasonStats.js
// Generates team statistics from live Sleeper API data keyed by roster_id
// Handles season key normalization and provides robust fallbacks

/**
 * Normalize season key to handle both string and number formats
 * @param {string|number} season - Season identifier
 * @returns {string} Normalized season key
 */
function normalizeSeasonKey(season) {
    return season != null ? String(season) : season;
}

/**
 * Calculate team hot/cold streaks based on recent performance
 * @param {Array} recentGames - Array of recent game results
 * @returns {Object} Hot/cold status and streak info
 */
function calculateStreaks(recentGames) {
    if (!recentGames || recentGames.length < 2) {
        return { isHot: false, isCold: false, streak: 0 };
    }
    
    const wins = recentGames.filter(game => game.win).length;
    const totalGames = recentGames.length;
    const winRate = wins / totalGames;
    
    // Calculate current streak
    let currentStreak = 0;
    let streakType = null;
    for (let i = recentGames.length - 1; i >= 0; i--) {
        const game = recentGames[i];
        if (streakType === null) {
            streakType = game.win ? 'win' : 'loss';
            currentStreak = 1;
        } else if ((streakType === 'win' && game.win) || (streakType === 'loss' && !game.win)) {
            currentStreak++;
        } else {
            break;
        }
    }
    
    return {
        isHot: winRate >= 0.75 || (currentStreak >= 3 && streakType === 'win'),
        isCold: winRate <= 0.25 || (currentStreak >= 3 && streakType === 'loss'),
        streak: currentStreak,
        streakType,
        winRate
    };
}

/**
 * Calculate DPR (Dominant Performance Rating) from team stats
 * @param {Object} teamStats - Team statistics
 * @param {Object} leagueStats - League-wide statistics for normalization
 * @returns {number} Calculated DPR
 */
function calculateDPR(teamStats, leagueStats) {
    if (!teamStats.gamesPlayed || teamStats.gamesPlayed === 0) return 1.0;
    
    const avgScore = teamStats.averageScore || teamStats.pointsFor / teamStats.gamesPlayed;
    const leagueAvgScore = leagueStats.averageScore || 100;
    
    // Basic DPR calculation: (team average / league average) with win rate adjustment
    const scoringRatio = avgScore / leagueAvgScore;
    const winRate = teamStats.wins / (teamStats.wins + teamStats.losses);
    
    // Combine scoring and winning with 70% scoring, 30% wins
    return (scoringRatio * 0.7) + (winRate * 0.6) + 0.4;
}

/**
 * Build dynamic season statistics from live data
 * @param {Object} params - Parameters object
 * @param {Object} params.processedSeasonalRecords - Season records from context
 * @param {string|number} params.season - Season identifier
 * @param {Object} params.historicalData - Historical matchup data
 * @param {Function} params.getTeamDetails - Function to get team details by owner/roster
 * @param {Object} params.rostersWithDetails - Current roster information
 * @returns {Object} Dynamic stats map keyed by roster_id
 */
export function buildDynamicSeasonStats({ 
    processedSeasonalRecords, 
    season, 
    historicalData, 
    getTeamDetails,
    rostersWithDetails = null 
}) {
    if (!processedSeasonalRecords || season == null) {
        console.warn('[DynamicStats] Missing required data for stats generation');
        return {};
    }
    
    const seasonKey = normalizeSeasonKey(season);
    const altSeasonKey = typeof season === 'string' ? parseInt(season) : season;
    
    // Try both string and numeric season keys
    let seasonData = processedSeasonalRecords[seasonKey] || processedSeasonalRecords[altSeasonKey];
    if (!seasonData) {
        console.warn(`[DynamicStats] No season data found for ${seasonKey}`);
        return {};
    }
    
    // Get matchup data with season key normalization
    const matchupData = historicalData?.matchupsBySeason;
    let seasonMatchups = [];
    if (matchupData) {
        seasonMatchups = matchupData[seasonKey] || matchupData[altSeasonKey] || [];
    }
    
    // Calculate league-wide statistics for normalization
    const allTeams = Object.values(seasonData);
    const leagueStats = {
        averageScore: allTeams.reduce((sum, team) => sum + (team.averageScore || 0), 0) / allTeams.length,
        averageWins: allTeams.reduce((sum, team) => sum + (team.wins || 0), 0) / allTeams.length
    };
    
    // Process recent form data from matchups
    const recentFormByRoster = {};
    if (seasonMatchups.length > 0) {
        const gamesByRoster = {};
        
        seasonMatchups.forEach(matchup => {
            const team1Id = String(matchup.team1_roster_id || matchup.t1 || '');
            const team2Id = String(matchup.team2_roster_id || matchup.t2 || '');
            
            if (!team1Id || !team2Id) return;
            
            const score1 = matchup.team1_score || matchup.score1 || 0;
            const score2 = matchup.team2_score || matchup.score2 || 0;
            const week = parseInt(matchup.week) || 0;
            
            if (!gamesByRoster[team1Id]) gamesByRoster[team1Id] = [];
            if (!gamesByRoster[team2Id]) gamesByRoster[team2Id] = [];
            
            gamesByRoster[team1Id].push({ 
                week, 
                scored: score1, 
                allowed: score2, 
                win: score1 > score2 
            });
            gamesByRoster[team2Id].push({ 
                week, 
                scored: score2, 
                allowed: score1, 
                win: score2 > score1 
            });
        });
        
        // Calculate recent form (last 3-4 games)
        Object.keys(gamesByRoster).forEach(rosterId => {
            const games = gamesByRoster[rosterId].sort((a, b) => a.week - b.week);
            const recentGames = games.slice(-4); // Last 4 games
            recentFormByRoster[rosterId] = calculateStreaks(recentGames);
        });
    }
    
    // Build stats for each roster
    const dynamicStats = {};
    const rosterIds = Object.keys(seasonData);
    
    // Sort by average score for ranking
    const sortedRosters = rosterIds.sort((a, b) => {
        const avgA = seasonData[a].averageScore || 0;
        const avgB = seasonData[b].averageScore || 0;
        return avgB - avgA;
    });
    
    sortedRosters.forEach((rosterId, index) => {
        const teamData = seasonData[rosterId];
        const recentForm = recentFormByRoster[rosterId] || { isHot: false, isCold: false };
        
        // Get team details (name, owner info)
        let teamDetails = null;
        try {
            if (typeof getTeamDetails === 'function') {
                // Try with roster ID first, then owner ID
                teamDetails = getTeamDetails(rosterId, season) || 
                            getTeamDetails(teamData.owner_id || teamData.ownerId, season);
            }
        } catch (error) {
            console.warn(`[DynamicStats] Error getting team details for ${rosterId}:`, error);
        }
        
        // Calculate derived statistics
        const wins = teamData.wins || 0;
        const losses = teamData.losses || 0;
        const ties = teamData.ties || 0;
        const gamesPlayed = wins + losses + ties;
        const winPercentage = gamesPlayed > 0 ? wins / gamesPlayed : 0;
        
        const pointsFor = teamData.totalPointsFor || teamData.pointsFor || 0;
        const pointsAgainst = teamData.totalPointsAgainst || teamData.pointsAgainst || 0;
        const avgPerGame = teamData.averageScore || (gamesPlayed > 0 ? pointsFor / gamesPlayed : 0);
        
        // Calculate DPR
        const dpr = teamData.dpr || teamData.DPR || calculateDPR(teamData, leagueStats);
        
        // Build the stats object
        dynamicStats[rosterId] = {
            rosterId: String(rosterId),
            ownerId: teamData.owner_id || teamData.ownerId || null,
            name: teamDetails?.name || teamDetails?.team_name || `Team ${rosterId}`,
            
            // Rankings and ratings
            rank: index + 1,
            dpr: Number(dpr.toFixed(3)),
            
            // Record and performance
            record: `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`,
            wins,
            losses,
            ties,
            winPercentage: Number(winPercentage.toFixed(3)),
            
            // Scoring statistics
            pointsFor: Number(pointsFor.toFixed(2)),
            pointsAgainst: Number(pointsAgainst.toFixed(2)),
            avgPerGame: Number(avgPerGame.toFixed(2)),
            // Compatibility with cleanOddsCalculator
            averageScore: Number(avgPerGame.toFixed(2)),
            
            // Advanced metrics
            luck: teamData.luck || teamData.luckRating || 0,
            allPlayWinPercentage: teamData.allPlayWinPercentage || winPercentage,
            
            // Recent form and trends
            isHot: recentForm.isHot,
            isCold: recentForm.isCold,
            streak: recentForm.streak || 0,
            streakType: recentForm.streakType || null,
            
            // Metadata
            gamesPlayed,
            tier: teamData.tier || (index < 4 ? 1 : index < 8 ? 2 : 3),
            
            // Raw data for advanced calculations
            scores: teamData.scores || [],
            weeklyScores: teamData.weeklyScores || []
        };
    });
    
    return dynamicStats;
}

/**
 * Get team stats by name (fallback lookup)
 * @param {Object} dynamicStats - Stats map from buildDynamicSeasonStats
 * @param {string} teamName - Team name to lookup
 * @returns {Object|null} Team stats or null if not found
 */
export function getStatsByTeamName(dynamicStats, teamName) {
    if (!dynamicStats || !teamName) return null;
    
    const entries = Object.values(dynamicStats);
    return entries.find(team => team.name === teamName) || null;
}

/**
 * Convert team names to roster IDs
 * @param {Object} dynamicStats - Stats map from buildDynamicSeasonStats
 * @param {string} team1Name - First team name
 * @param {string} team2Name - Second team name
 * @returns {Object} Object with team1RosterId and team2RosterId
 */
export function mapTeamNamesToRosterIds(dynamicStats, team1Name, team2Name) {
    const team1Stats = getStatsByTeamName(dynamicStats, team1Name);
    const team2Stats = getStatsByTeamName(dynamicStats, team2Name);
    
    return {
        team1RosterId: team1Stats?.rosterId || null,
        team2RosterId: team2Stats?.rosterId || null,
        team1Stats,
        team2Stats
    };
}

/**
 * Normalize season key access for data lookups
 * @param {Object} dataObject - Object with season keys
 * @param {string|number} season - Season to lookup
 * @returns {*} Data for the season or null
 */
export function getSeasonData(dataObject, season) {
    if (!dataObject || season == null) return null;
    
    const seasonKey = normalizeSeasonKey(season);
    const altKey = typeof season === 'string' ? parseInt(season) : season;
    
    return dataObject[seasonKey] || dataObject[altKey] || null;
}

/**
 * Calculate enhanced spread using dynamic team stats
 * @param {string} team1Identifier - Team name or roster ID
 * @param {string} team2Identifier - Team name or roster ID
 * @param {number} winProbability - Win probability for team1
 * @param {Object} dynamicStats - Dynamic stats from buildDynamicSeasonStats
 * @returns {Object} Spread calculation result with confidence and basis
 */
export function calculateDynamicEnhancedSpread(team1Identifier, team2Identifier, winProbability = 0.5, dynamicStats = null) {
    if (!dynamicStats) {
        console.warn('No dynamic stats provided for enhanced spread calculation');
        return { spread: 0, confidence: 0.3, basis: 'no-stats' };
    }

    // Get team stats (roster ID lookup first, then name fallback)
    let team1Stats = dynamicStats[team1Identifier] || getStatsByTeamName(dynamicStats, team1Identifier);
    let team2Stats = dynamicStats[team2Identifier] || getStatsByTeamName(dynamicStats, team2Identifier);
    
    if (!team1Stats || !team2Stats) {
        console.warn(`Missing dynamic stats for ${team1Identifier} or ${team2Identifier}`);
        return { spread: 0, confidence: 0.3, basis: 'missing-teams' };
    }

    // PURE STATISTICAL APPROACH: Based on this year's actual scoring data
    const avgDiff = team1Stats.avgPerGame - team2Stats.avgPerGame; // Raw score difference
    
    // Calculate actual variance from season data (if available) or estimate
    // Use coefficient of variation to estimate consistency
    let team1Variance, team2Variance;
    
    if (team1Stats.scores && team1Stats.scores.length > 2) {
        // Use actual scores if available
        const team1Mean = team1Stats.scores.reduce((a, b) => a + b) / team1Stats.scores.length;
        team1Variance = team1Stats.scores.reduce((sum, x) => sum + Math.pow(x - team1Mean, 2), 0) / team1Stats.scores.length;
    } else {
        // Estimate variance based on typical fantasy patterns
        // Higher scoring teams tend to be more variable
        const team1CoeffVar = 0.12 + (team1Stats.avgPerGame / 1000); // 12-25% typical range
        team1Variance = Math.pow(team1Stats.avgPerGame * team1CoeffVar, 2);
    }
    
    if (team2Stats.scores && team2Stats.scores.length > 2) {
        const team2Mean = team2Stats.scores.reduce((a, b) => a + b) / team2Stats.scores.length;
        team2Variance = team2Stats.scores.reduce((sum, x) => sum + Math.pow(x - team2Mean, 2), 0) / team2Stats.scores.length;
    } else {
        const team2CoeffVar = 0.12 + (team2Stats.avgPerGame / 1000);
        team2Variance = Math.pow(team2Stats.avgPerGame * team2CoeffVar, 2);
    }
    
    // Standard deviations and error coefficients
    const team1StdDev = Math.sqrt(team1Variance);
    const team2StdDev = Math.sqrt(team2Variance);
    const team1ErrorCoeff = team1StdDev / team1Stats.avgPerGame; // Lower = more predictable
    const team2ErrorCoeff = team2StdDev / team2Stats.avgPerGame;
    
    // Combined variance for matchup uncertainty
    const combinedVariance = team1Variance + team2Variance;
    const combinedStdDev = Math.sqrt(combinedVariance);
    
    // Base spread using statistical confidence (more uncertain = smaller spreads)
    // The more variable the teams, the less confident we are in large spreads
    const uncertaintyFactor = Math.min(1.0, combinedStdDev / 50); // Cap uncertainty impact
    let baseSpread = avgDiff * (1 - uncertaintyFactor * 0.3); // Reduce spread for high variance
    
    // PURE PERFORMANCE ADJUSTMENTS (no DPR, no head-to-head)
    
    // 1. Consistency reward/penalty (consistent teams get spread favor, but volatile teams can explode)
    const consistencyDiff = team2ErrorCoeff - team1ErrorCoeff; // Positive if team1 more consistent
    // But in fantasy, sometimes volatile teams are harder to bet against due to upside potential
    const volatilityFactor = Math.max(team1ErrorCoeff, team2ErrorCoeff) > 0.15 ? 0.8 : 1.0; // Reduce consistency impact for very volatile matchups
    const consistencyAdjustment = consistencyDiff * avgDiff * 0.25 * volatilityFactor; // Increased from 15% to 25%
    
    // 2. Recent form weighting (last 25% of games matter 2x more)
    let recentFormAdjustment = 0;
    if (team1Stats.scores && team2Stats.scores && team1Stats.scores.length >= 3) {
        const recentGames = Math.max(1, Math.floor(team1Stats.gamesPlayed * 0.25));
        const team1Recent = team1Stats.scores.slice(-recentGames);
        const team2Recent = team2Stats.scores.slice(-recentGames);
        
        const team1RecentAvg = team1Recent.reduce((a, b) => a + b) / team1Recent.length;
        const team2RecentAvg = team2Recent.reduce((a, b) => a + b) / team2Recent.length;
        
        const recentDiff = team1RecentAvg - team2RecentAvg;
        const seasonDiff = team1Stats.avgPerGame - team2Stats.avgPerGame;
        
        // If recent form differs significantly from season average, weight it
        const formDivergence = recentDiff - seasonDiff;
        recentFormAdjustment = formDivergence * 0.3; // Recent form can swing spread
    }
    
    // 3. Score trend analysis (are teams trending up or down?)
    let trendAdjustment = 0;
    if (team1Stats.scores && team2Stats.scores && team1Stats.scores.length >= 3) {
        // Calculate scoring trends (recent games vs early games)
        const halfPoint = Math.floor(team1Stats.scores.length / 2);
        
        const team1Early = team1Stats.scores.slice(0, halfPoint);
        const team1Late = team1Stats.scores.slice(halfPoint);
        const team1EarlyAvg = team1Early.reduce((a, b) => a + b) / team1Early.length;
        const team1LateAvg = team1Late.reduce((a, b) => a + b) / team1Late.length;
        const team1Trend = team1LateAvg - team1EarlyAvg; // Positive = improving
        
        const team2Early = team2Stats.scores.slice(0, halfPoint);
        const team2Late = team2Stats.scores.slice(halfPoint);
        const team2EarlyAvg = team2Early.reduce((a, b) => a + b) / team2Early.length;
        const team2LateAvg = team2Late.reduce((a, b) => a + b) / team2Late.length;
        const team2Trend = team2LateAvg - team2EarlyAvg;
        
        // Favor the team with better trend
        trendAdjustment = (team1Trend - team2Trend) * 0.2; // 20% weight on trends
    }
    
    // 4. Cold streak momentum (cold teams often stay cold in short term, but can also break out)
    let momentumAdjustment = 0;
    if (team1Stats.isCold && !team2Stats.isCold) momentumAdjustment -= 2.5; // Increased cold penalty
    if (team2Stats.isCold && !team1Stats.isCold) momentumAdjustment += 2.5;
    
    // 5. Variance-based uncertainty (high variance teams are harder to predict, spreads should be smaller)
    const avgVariance = (team1Variance + team2Variance) / 2;
    const varianceUncertainty = Math.min(avgVariance / 200, 0.3); // Cap at 30% uncertainty
    const variancePenalty = (team1ErrorCoeff - team2ErrorCoeff) * avgDiff * (0.2 + varianceUncertainty); // Stronger variance impact
    
    // Combine all statistical adjustments
    const totalAdjustment = consistencyAdjustment + recentFormAdjustment + trendAdjustment + momentumAdjustment + variancePenalty;
    let finalSpread = -(baseSpread + totalAdjustment); // Negative because team1 favorite = negative spread
    
    // Let statistical analysis determine spread size without artificial caps
    // Removed maxSpread cap - let true performance differences show through
    
    // Calculate confidence based on data quality and consistency
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for more games played
    const minGames = Math.min(team1Stats.gamesPlayed, team2Stats.gamesPlayed);
    if (minGames >= 4) confidence += 0.2;
    else if (minGames >= 2) confidence += 0.1;
    
    // Adjust for large spreads (less confident in extreme values)
    const absSpread = Math.abs(finalSpread);
    if (absSpread > 20) confidence -= 0.3;
    else if (absSpread > 12) confidence -= 0.2;
    else if (absSpread > 6) confidence -= 0.1;
    
    confidence = Math.max(0.1, Math.min(0.95, confidence));
    
    return {
        spread: Number(finalSpread.toFixed(1)),
        confidence: Number(confidence.toFixed(2)),
        basis: 'enhanced', // Changed from 'statistical-analysis' to match expected value
        breakdown: {
            baseSpread: Number(baseSpread.toFixed(1)),
            avgDiff: Number(avgDiff.toFixed(1)),
            team1Variance: Number(team1Variance.toFixed(1)),
            team2Variance: Number(team2Variance.toFixed(1)),
            team1ErrorCoeff: Number(team1ErrorCoeff.toFixed(3)),
            team2ErrorCoeff: Number(team2ErrorCoeff.toFixed(3)),
            consistencyAdjustment: Number(consistencyAdjustment.toFixed(1)),
            recentFormAdjustment: Number(recentFormAdjustment.toFixed(1)),
            trendAdjustment: Number(trendAdjustment.toFixed(1)),
            momentumAdjustment: Number(momentumAdjustment.toFixed(1)),
            totalAdjustment: Number(totalAdjustment.toFixed(1))
        }
    };
}

export default {
    buildDynamicSeasonStats,
    getStatsByTeamName,
    mapTeamNamesToRosterIds,
    getSeasonData,
    normalizeSeasonKey,
    calculateDynamicEnhancedSpread
};
