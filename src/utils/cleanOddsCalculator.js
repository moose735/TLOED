// src/utils/cleanOddsCalculator.js
// Clean, consolidated odds calculator with proper spread-to-moneyline relationships
// Enhanced with historical scoring analysis for improved spread calculations

import { calculateTeamStats, calculateVarianceBasedSpread, getHeadToHeadRecord } from './historicalAnalysis.js';
import { calculateEnhancedSpread } from './currentSeasonStats.js';
import { calculateDynamicEnhancedSpread } from './dynamicSeasonStats.js';
import { calculateWinProbability } from './winProbabilityCalculator.js';
import { seededRandomFromString } from './seededRandom';

/**
 * Convert point spread to moneyline odds with realistic sportsbook relationships
 * Based on REAL NFL sportsbook data patterns
 */
export const convertSpreadToMoneyline = (spread, isFavorite = true, vig = SPORTSBOOK_VIG, seedKey = 'default') => {
    const absSpread = Math.abs(spread);
    const rng = seededRandomFromString(seedKey);

    // Handle true pick'em games (spread = 0)
    if (absSpread === 0) {
        // True pick'em: use slightly wider juice to reflect sportsbook vig
        const baseOdds = -120; // Favor -120 for pick'em lines to reflect juice
        const variance = Math.round((rng() - 0.5) * 6); // -3 to +3 deterministic
        return baseOdds + variance; // Range: -123 to -117
    }
    
    // For very large spreads, continue with the piecewise extrapolation below
    // (removed the old hard cap of -1500/+800 so markets can reflect more extreme values)
    
    // More conservative moneyline patterns for fantasy football
    let favoriteOdds, underdogOdds;
    
    if (absSpread <= 1.5) {
        favoriteOdds = -110 - (absSpread * 8);   // -110 to -122
        underdogOdds = 100 + (absSpread * 8);    // +100 to +108
    } else if (absSpread <= 3) {
        favoriteOdds = -122 - ((absSpread - 1.5) * 12); // -122 to -140
        underdogOdds = 108 + ((absSpread - 1.5) * 12);  // +108 to +126
    } else if (absSpread <= 4.5) {
        favoriteOdds = -140 - ((absSpread - 3) * 15); // -140 to -163
        underdogOdds = 126 + ((absSpread - 3) * 15);  // +126 to +149
    } else if (absSpread <= 7) {
        favoriteOdds = -163 - ((absSpread - 4.5) * 18); // -163 to -208
        underdogOdds = 149 + ((absSpread - 4.5) * 18);  // +149 to +194
    } else if (absSpread <= 10) {
        favoriteOdds = -208 - ((absSpread - 7) * 25); // -208 to -283
        underdogOdds = 194 + ((absSpread - 7) * 25);  // +194 to +269
    } else if (absSpread <= 15) {
        favoriteOdds = -283 - ((absSpread - 10) * 30); // -283 to -433
        underdogOdds = 269 + ((absSpread - 10) * 30);  // +269 to +419
    } else {
        favoriteOdds = -433 - ((absSpread - 15) * 20);  // -433+ (capped more reasonably)
        underdogOdds = 419 + ((absSpread - 15) * 20);   // +419+ (consistent with favorite scaling)
    }
    
    // Apply small vig adjustments
    const vigFactor = 1 + (vig * 0.5);
    favoriteOdds = Math.round(favoriteOdds * vigFactor);
    underdogOdds = Math.round(underdogOdds * vigFactor);
    
    // Ensure proper bounds - allow more extreme but keep within safe numeric limits
    favoriteOdds = Math.max(-5000, favoriteOdds);
    underdogOdds = Math.min(5000, Math.max(100, underdogOdds));
    
    return isFavorite ? favoriteOdds : underdogOdds;
};

/**
 * Calculate realistic point spread from win probability
 */
export const calculateSpreadFromProbability = (winProbability, teamPowerDiff = 0) => {
    // Simple, clear logic:
    // winProbability > 0.5 → team1 is favored → NEGATIVE spread
    // winProbability < 0.5 → team1 is underdog → POSITIVE spread
    
    const probDiff = winProbability - 0.5; // How much team1 favored/unfavored
    
    // Convert probability advantage to point spread
    // Positive probDiff (team1 favored) should create NEGATIVE spread
    let spread;
    const absProbDiff = Math.abs(probDiff);
    
    if (absProbDiff <= 0.05) {
        // Very close games: 0-3 point spreads
        spread = -probDiff * 60; // 0.05 diff = 3 point spread
    } else if (absProbDiff <= 0.15) {
        // Moderate favorites: 3-7 point spreads  
        const baseSpread = 3;
        const additionalSpread = (absProbDiff - 0.05) * 40;
        spread = -(baseSpread + additionalSpread) * Math.sign(probDiff);
    } else if (absProbDiff <= 0.30) {
        // Strong favorites: 7-14 point spreads
        const baseSpread = 7;
        const additionalSpread = (absProbDiff - 0.15) * 30;
        spread = -(baseSpread + additionalSpread) * Math.sign(probDiff);
    } else {
        // Heavy favorites: 14+ point spreads
        const baseSpread = 14;
        const additionalSpread = (absProbDiff - 0.30) * 20;
        spread = -(baseSpread + additionalSpread) * Math.sign(probDiff);
    }
    
    // Minor adjustment for power differential (should not override probability)
    spread -= teamPowerDiff * 0.2;
    
    // Round to nearest 0.5
    return Math.round(spread * 2) / 2;
};

// Inverse error function approximation (Winitzki, good enough for our use)
const erfinv = (x) => {
    const a = 0.147; // approximation constant
    const sign = x < 0 ? -1 : 1;
    const ln = Math.log(1 - x * x);
    const part1 = (2 / (Math.PI * a)) + (ln / 2);
    const insideSqrt = (part1 * part1) - (ln / a);
    const result = sign * Math.sqrt(Math.sqrt(insideSqrt) - part1);
    return result;
};

// Inverse of standard normal CDF using erfinv
const inverseNormal = (p) => {
    // Clamp
    const q = Math.max(1e-10, Math.min(1 - 1e-10, p));
    return Math.SQRT2 * erfinv(2 * q - 1);
};

/**
 * Calculate total (over/under) based on team averages and matchup context
 * Enhanced for fantasy football scoring patterns with NFL-like relative scaling
 */
export const calculateTotal = (team1AvgScore, team2AvgScore, matchupContext = {}) => {
    // Simple and predictable: use team averages as the base
    let baseTotal = team1AvgScore + team2AvgScore;
    
    // If we don't have real averages, use reasonable defaults
    if (!team1AvgScore || !team2AvgScore || baseTotal < 150) {
        baseTotal = 220; // Default reasonable total
    }
    
    // Add small variance for realism (±5%)
    const {
        variance = 0.03,      // Smaller, more predictable variance
        weekNumber = 3,       // Current week
        seedKey = 'total-default'
    } = matchupContext;
    
    // Early season adjustment is minimal
    if (weekNumber <= 3) {
        baseTotal *= 1.02; // Just 2% boost early season
    }
    
    // Deterministic small realistic variance (±3%) based on seedKey
    const rng = seededRandomFromString(seedKey);
    const randomFactor = 1 + ((rng() - 0.5) * variance * 2);
    let finalTotal = baseTotal * randomFactor;
    
    // Keep totals in reasonable fantasy range but closer to team averages
    finalTotal = Math.max(180, Math.min(320, finalTotal));
    
    // Round to nearest 0.5
    return Math.round(finalTotal * 2) / 2;
};

/**
 * Generate realistic spread juice based on sportsbook confidence
 * Real sportsbooks vary juice based on market confidence and action
 */
export const generateSpreadJuice = (spread, marketConfidence = 0.5) => {
    const absSpread = Math.abs(spread);
    
    // Base juice patterns from real sportsbooks
    let baseJuice = -110;
    
    // Adjust based on spread size and confidence
    const rng = seededRandomFromString(seedKey);
    if (absSpread <= 1.5) {
        // Close games often have asymmetric juice (deterministic)
        const favoriteJuice = -115 - Math.round(rng() * 10); // -115 to -125 deterministic
        const underdogJuice = -105 - Math.round(rng() * 10);  // -105 to -115 deterministic
        return { favoriteJuice, underdogJuice };
    } else if (absSpread >= 10) {
        // Large spreads often have more symmetric juice
        const juice = -108 - Math.round(rng() * 8); // -108 to -116 deterministic
        return { favoriteJuice: juice, underdogJuice: juice };
    } else {
        // Normal spreads with some deterministic variance
        const variance = Math.round((rng() - 0.5) * 16); // -8 to +8
        const favoriteJuice = baseJuice + variance;
        const underdogJuice = baseJuice - variance; // Opposite direction
        
        return { 
            favoriteJuice: Math.max(-125, Math.min(-100, favoriteJuice)),
            underdogJuice: Math.max(-125, Math.min(-100, underdogJuice))
        };
    }
};

/**
 * Generate realistic total juice based on market factors
 */
export const generateTotalJuice = (total, marketVolume = 0.5, seedKey = 'total-default') => {
    // Most totals are symmetric but with slight deterministic variance
    const baseJuice = -110;
    const rng = seededRandomFromString(seedKey);
    const variance = Math.round((rng() - 0.5) * 12); // -6 to +6 deterministic
    
    const overJuice = baseJuice + variance;
    const underJuice = baseJuice - variance;
    
    return {
        overJuice: Math.max(-120, Math.min(-105, overJuice)),
        underJuice: Math.max(-120, Math.min(-105, underJuice))
    };
};
/**
 * Calculate advanced team power score based on points, consistency, and momentum
 * This is the core fantasy football team evaluation that drives odds
 */
export const calculateAdvancedTeamPower = (teamStats, rosterId, allTeamStats = {}) => {
    if (!teamStats) {
        return {
            powerScore: 50, // Default neutral score
            pointsComponent: 0,
            consistencyComponent: 0,
            momentumComponent: 0
        };
    }
    
    const {
        averageScore = 100,
        scores = [],
        gamesPlayed = 0,
        wins = 0,
        losses = 0
    } = teamStats;
    
    // 1. POINTS COMPONENT (60% weight) - Primary driver
    // Scale relative to league average
    const allScores = Object.values(allTeamStats).map(t => t.averageScore || 100);
    const leagueAverage = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    const pointsAdvantage = (averageScore - leagueAverage) / leagueAverage;
    const pointsComponent = Math.tanh(pointsAdvantage * 3) * 60; // 60% max weight
    
    // 2. CONSISTENCY COMPONENT (25% weight) - Lower variance = better
    let consistencyComponent = 0;
    if (scores.length >= 2) {
        const variance = scores.reduce((sum, score) => {
            return sum + Math.pow(score - averageScore, 2);
        }, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / averageScore;
        
        // Lower CV = more consistent = higher score
        // Typical fantasy CV ranges from 0.15 (very consistent) to 0.4 (very inconsistent)
        const consistencyScore = Math.max(0, 1 - (coefficientOfVariation / 0.3));
        consistencyComponent = consistencyScore * 25; // 25% max weight
    }
    
    // 3. MOMENTUM COMPONENT (15% weight) - Recent performance trend
    let momentumComponent = 0;
    if (scores.length >= 2) {
        const recentGames = Math.min(3, scores.length);
        const recentScores = scores.slice(-recentGames);
        const earlyScores = scores.slice(0, -recentGames);
        
        if (earlyScores.length > 0) {
            const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
            const earlyAvg = earlyScores.reduce((sum, score) => sum + score, 0) / earlyScores.length;
            const momentumTrend = (recentAvg - earlyAvg) / earlyAvg;
            momentumComponent = Math.tanh(momentumTrend * 2) * 15; // 15% max weight
        }
    }
    
    const totalPowerScore = 50 + pointsComponent + consistencyComponent + momentumComponent;
    
    return {
        powerScore: Math.max(0, Math.min(100, totalPowerScore)),
        pointsComponent,
        consistencyComponent,
        momentumComponent,
        details: {
            averageScore,
            leagueAverage,
            pointsAdvantage: pointsAdvantage * 100, // As percentage
            consistency: consistencyComponent / 25, // As ratio
            momentum: momentumComponent / 15 // As ratio
        }
    };
};

/**
 * Enhanced spread calculation using historical scoring data
 * Combines variance analysis, hot/cold streaks, and head-to-head records
 * Updated to support dynamic stats system
 */
export const calculateHistoricalSpread = (team1Identifier, team2Identifier, winProbability = 0.5, dynamicStats = null) => {
    try {
        // First try dynamic enhanced calculation if available
        let enhancedSpread;
        if (dynamicStats && Object.keys(dynamicStats).length > 0) {
            enhancedSpread = calculateDynamicEnhancedSpread(team1Identifier, team2Identifier, winProbability, dynamicStats);
            console.log(`Using dynamic enhanced spread for ${team1Identifier} vs ${team2Identifier}: ${enhancedSpread.spread}`);
        } else {
            // Fallback to hardcoded current season calculation (expects team names)
            enhancedSpread = calculateEnhancedSpread(team1Identifier, team2Identifier, winProbability);
            console.log(`Using legacy enhanced spread for ${team1Identifier} vs ${team2Identifier}: ${enhancedSpread.spread}`);
        }
        if (enhancedSpread.basis === 'enhanced' || enhancedSpread.basis === 'dynamic-stats') {
            console.log(`Using enhanced current season spread for ${team1Identifier} vs ${team2Identifier}: ${enhancedSpread.spread}`);
            // For dynamic stats, get team stats from the dynamic stats object
            const team1StatsData = dynamicStats ? dynamicStats[team1Identifier] : enhancedSpread.team1Stats;
            const team2StatsData = dynamicStats ? dynamicStats[team2Identifier] : enhancedSpread.team2Stats;
            
            return {
                spread: enhancedSpread.spread,
                confidence: enhancedSpread.confidence,
                historicalBasis: true,
                team1Stats: {
                    mean: team1StatsData?.averageScore || team1StatsData?.avgPerGame || 120,
                    stdDev: 20, // Estimate
                    isHot: team1StatsData?.isHot || false,
                    isCold: team1StatsData?.isCold || false,
                    consistency: 95 // Estimate
                },
                team2Stats: {
                    mean: team2StatsData?.averageScore || team2StatsData?.avgPerGame || 120,
                    stdDev: 20, // Estimate
                    isHot: team2StatsData?.isHot || false,
                    isCold: team2StatsData?.isCold || false,
                    consistency: 95 // Estimate
                },
                enhancedBasis: enhancedSpread
            };
        }
        
        // Fallback to historical variance analysis (this expects team names)
        const historicalTeamStats = calculateTeamStats();
        // For historical analysis fallback, we need team names, so derive them if we have roster IDs
        const team1Name = (dynamicStats && dynamicStats[team1Identifier]) ? dynamicStats[team1Identifier].name : team1Identifier;
        const team2Name = (dynamicStats && dynamicStats[team2Identifier]) ? dynamicStats[team2Identifier].name : team2Identifier;
        const varianceSpread = calculateVarianceBasedSpread(team1Name, team2Name, historicalTeamStats);
        
        let spread = varianceSpread.spread;
        
        // Let enhanced spread calculation stand without probability override
        // Removed conservative probability adjustment that was watering down statistical analysis
        
        spread = Math.round(spread * 2) / 2; // Keep rounding but remove artificial cap
        
        return {
            spread,
            confidence: varianceSpread.confidence,
            historicalBasis: true,
            team1Stats: varianceSpread.team1Stats,
            team2Stats: varianceSpread.team2Stats
        };
        
    } catch (error) {
        console.warn('Enhanced analysis failed, falling back to probability-based spread:', error);
        return {
            spread: calculateSpreadFromProbability(winProbability),
            confidence: 0.5,
            historicalBasis: false
        };
    }
};

/**
 * Calculate team power differential for spread calculation
 * Now uses advanced power scoring instead of simple average difference
 */
export const calculateTeamPowerDifferential = (team1Stats, team2Stats, allTeamStats = {}) => {
    const team1Power = calculateAdvancedTeamPower(team1Stats, team1Stats?.rosterId, allTeamStats);
    const team2Power = calculateAdvancedTeamPower(team2Stats, team2Stats?.rosterId, allTeamStats);
    
    // Power differential on 0-100 scale, convert to reasonable spread factor
    const powerDiff = (team1Power.powerScore - team2Power.powerScore) / 10;
    
    return {
        powerDiff,
        team1Power: team1Power.powerScore,
        team2Power: team2Power.powerScore,
        team1Details: team1Power.details,
        team2Details: team2Power.details
    };
};
/**
 * Generate complete betting markets for a matchup
 */
export const generateCleanBettingMarkets = (matchup, teamStats, options = {}) => {
    const {
        team1RosterId,
        team2RosterId,
        team1Name,
        team2Name,
        winProbability = 0.5
    } = matchup;
    
    const {
        vig = 0.055,
        includePropBets = true,
        includeSpecialMarkets = false,
        weekNumber = 3
    } = options;
    
    // Get team statistics with enhanced data and better fallbacks
    let team1Stats = teamStats[team1RosterId];
    let team2Stats = teamStats[team2RosterId];
    
    // Debug: Check if roster IDs exist in the stats object
    if (team1Name && (team1Name.includes('Michael Vick') || !team1Stats || !team2Stats)) {
        console.log(`[CLEAN ODDS DEBUG] Looking up teams:`);
        console.log(`  Team1: ${team1Name} (ID: ${team1RosterId}) - Direct lookup: ${team1Stats ? 'FOUND' : 'MISSING'}`);
        console.log(`  Team2: ${team2Name} (ID: ${team2RosterId}) - Direct lookup: ${team2Stats ? 'FOUND' : 'MISSING'}`);
        console.log(`  Available stats keys:`, Object.keys(teamStats).slice(0, 10)); // Show first 10 keys
        console.log(`  Stats structure sample:`, Object.values(teamStats)[0]);
    }
    
    // If not found by roster ID, try to find by team name (more robust matching)
    if (!team1Stats && team1Name) {
        team1Stats = Object.values(teamStats).find(team => 
            team && team.name && team.name.toLowerCase().trim() === team1Name.toLowerCase().trim()
        );
        if (team1Stats) {
            console.log(`[FALLBACK] Found ${team1Name} by name lookup (roster ID: ${team1Stats.rosterId})`);
        }
    }
    if (!team2Stats && team2Name) {
        team2Stats = Object.values(teamStats).find(team => 
            team && team.name && team.name.toLowerCase().trim() === team2Name.toLowerCase().trim()
        );
        if (team2Stats) {
            console.log(`[FALLBACK] Found ${team2Name} by name lookup (roster ID: ${team2Stats.rosterId})`);
        }
    }
    
    // Final fallback to default values if still not found
    if (!team1Stats) {
        console.log(`[WARNING] No stats found for ${team1Name} (ID: ${team1RosterId}), using defaults`);
        team1Stats = { averageScore: 120, gamesPlayed: 0, scores: [], rosterId: team1RosterId };
    }
    if (!team2Stats) {
        console.log(`[WARNING] No stats found for ${team2Name} (ID: ${team2RosterId}), using defaults`);
        team2Stats = { averageScore: 120, gamesPlayed: 0, scores: [], rosterId: team2RosterId };
    }
    
    // Calculate realistic win probability based on current season performance
    let adjustedWinProbability = winProbability;
    if (team1RosterId && team2RosterId) {
        // Check if teamStats is dynamic stats format and pass it accordingly
        const isDynamicStats = Object.values(teamStats).some(team => team && typeof team.dpr === 'number');
        const dynamicStatsToPass = isDynamicStats ? teamStats : null;
        
        // Use roster IDs for dynamic stats, team names for legacy stats
        const team1Identifier = isDynamicStats ? team1RosterId : team1Name;
        const team2Identifier = isDynamicStats ? team2RosterId : team2Name;
        
        const calculatedProb = calculateWinProbability(team1Identifier, team2Identifier, dynamicStatsToPass);
        // Use calculated probability if it seems reasonable, otherwise blend with provided prob
        adjustedWinProbability = Math.abs(calculatedProb - 0.5) > 0.05 ? calculatedProb : 
                                 (calculatedProb * 0.7 + winProbability * 0.3);
        
        console.log(`Using calculated win probability for ${team1Name}: ${(adjustedWinProbability * 100).toFixed(1)}%`);
    }
    
    // Try to use enhanced spread calculation with realistic probability
    let historicalSpreadResult = null;
    if (team1RosterId && team2RosterId) {
        // Check if teamStats is dynamic stats format (has dpr field) vs legacy format
        const isDynamicStats = Object.values(teamStats).some(team => team && typeof team.dpr === 'number');
        const dynamicStatsToPass = isDynamicStats ? teamStats : null;
        
        // Use roster IDs for dynamic stats, team names for legacy stats
        const team1Identifier = isDynamicStats ? team1RosterId : team1Name;
        const team2Identifier = isDynamicStats ? team2RosterId : team2Name;
        
        historicalSpreadResult = calculateHistoricalSpread(team1Identifier, team2Identifier, adjustedWinProbability, dynamicStatsToPass);
    }
    
    // Calculate advanced team power differential based on points, consistency, momentum
    const powerAnalysis = calculateTeamPowerDifferential(team1Stats, team2Stats, teamStats);
    
    // Use power differential to adjust the win probability
    // If power analysis shows a different story than win probability, factor it in
    const powerBasedProbAdjustment = powerAnalysis.powerDiff * 0.02; // 0.02 per power point
    const finalWinProbability = Math.max(0.1, Math.min(0.9, adjustedWinProbability + powerBasedProbAdjustment));
    
    // Calculate spread using score distribution (means + variances) so the line
    // better reflects how final scores end up (not just a mapping from win probability)
    // Compute sample variances from scores if available, otherwise use sensible defaults
    // Compute variances from scores if available, otherwise use sensible defaults
    const computeVariance = (scores) => {
        if (!Array.isArray(scores) || scores.length < 2) return 400; // std ~20
        const n = scores.length;
        const mean = scores.reduce((s, v) => s + v, 0) / n;
        const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n; // population variance
        return Math.max(100, variance); // floor variance
    };

    const t1Var = computeVariance(team1Stats.scores);
    const t2Var = computeVariance(team2Stats.scores);

    // Expected margin (mu) and combined sigma (game-to-game variation)
    const team1Avg = team1Stats.averageScore || 120;
    const team2Avg = team2Stats.averageScore || 120;
    const rawMu = team1Avg - team2Avg;
    const baseSigma = Math.sqrt(t1Var + t2Var);

    // Use power analysis components to adjust mu and sigma
    // powerDiff is (team1Score - team2Score) / 10 from calculateTeamPowerDifferential
    const powerDiff = powerAnalysis.powerDiff; // roughly 0-10 scale
    const team1Details = powerAnalysis.team1Details || { pointsAdvantage: 0, consistency: 0.5, momentum: 0 };
    const team2Details = powerAnalysis.team2Details || { pointsAdvantage: 0, consistency: 0.5, momentum: 0 };

    // Points-based margin (convert powerDiff into points). Tunable scale: ~2.5 points per power point
    const powerMarginPoints = powerDiff * 2.5;

    // Momentum influence (recent form) - small additive effect in points
    const momentumDiff = (team1Details.momentum || 0) - (team2Details.momentum || 0); // -1..1 ranges
    const momentumBoost = momentumDiff * 4.0; // each 0.25 momentum ~1 point

    // Combine raw scoring margin with power/momentum influence
    // Keep majority weight on raw scoring (averages) but blend in power and momentum
    const MU_WEIGHT_RAW = 0.65;
    const MU_WEIGHT_POWER = 0.30;
    const MU_WEIGHT_MOMENTUM = 0.05;

    let mu = (rawMu * MU_WEIGHT_RAW) + (powerMarginPoints * MU_WEIGHT_POWER) + (momentumBoost * MU_WEIGHT_MOMENTUM);
    
    // Cap mu to prevent unrealistic spreads (no team should be 20+ points better on average)
    mu = Math.max(-20, Math.min(20, mu));

    // Consistency reduces variance: higher consistency => lower sigma
    const t1Consistency = Math.max(0, Math.min(1, team1Details.consistency || 0.5));
    const t2Consistency = Math.max(0, Math.min(1, team2Details.consistency || 0.5));
    const avgConsistency = (t1Consistency + t2Consistency) / 2; // 0..1 (higher = more consistent)

    // Reduce sigma up to 30% for highly consistent matchups; increase slightly for volatile matchups
    const CONSISTENCY_MAX_REDUCTION = 0.30;
    const consistencyFactor = 1 - (avgConsistency * CONSISTENCY_MAX_REDUCTION);

    // Also slightly reduce sigma when teams have positive momentum (recent stable high scoring)
    const momentumSigmaFactor = 1 - (Math.abs(momentumDiff) * 0.05);

    const sigma = Math.max(6, baseSigma * consistencyFactor * momentumSigmaFactor);

    // Use historical spread calculation if available, otherwise fall back to statistical method
    let spread, spreadConfidence;
    if (historicalSpreadResult && historicalSpreadResult.historicalBasis) {
        // Use historical analysis result
        spread = historicalSpreadResult.spread;
        spreadConfidence = historicalSpreadResult.confidence;
        
        console.log(`Using historical spread for ${team1Name} vs ${team2Name}: ${spread}`);
    } else {
        // Fall back to original statistical calculation
        let spreadRaw;
        try {
            const inv = inverseNormal(1 - finalWinProbability);
            spreadRaw = mu + sigma * inv;
        } catch (e) {
            // Fallback to probability mapping if numerical issues
            spreadRaw = Math.abs(calculateSpreadFromProbability(finalWinProbability, powerAnalysis.powerDiff));
        }

        // Maintain sign convention: negative spread means team1 is favorite
        const isTeam1Favorite = finalWinProbability > 0.5;
        spread = isTeam1Favorite ? -spreadRaw : spreadRaw;
        spreadConfidence = 0.6; // Default confidence
    }
    
    let absSpread = Math.abs(spread);

    // Round to nearest 0.5 but be more aggressive about creating spreads
    absSpread = Math.round(absSpread * 2) / 2;
    
    // Let algorithm spreads through without artificial capping
    // absSpread = Math.min(absSpread, 20); // REMOVED: Let true statistical differences show
    
    // Determine favorite based on final spread (negative spread means team1 is favorite)
    const isTeam1Favorite = spread < 0;
    
    // Only treat as pick'em if teams are truly equal (much stricter threshold)
    // Also check if the teams have meaningful statistical differences
    const team1AvgScore = team1Stats.averageScore || team1Stats.avgPerGame || 120;
    const team2AvgScore = team2Stats.averageScore || team2Stats.avgPerGame || 120;
    const scoringDiff = Math.abs(team1AvgScore - team2AvgScore);
    const absPowerDiff = Math.abs(powerAnalysis.powerDiff);
    
    // Trust the enhanced algorithm results - no conservative overrides
    // Only set truly equal teams (absSpread < 0.5) to pick'em if they have no meaningful differences
    if (absSpread < 0.5 && scoringDiff < 5 && absPowerDiff < 1.0) {
        absSpread = 0;
        spread = 0;
    }
    // Otherwise, let the enhanced statistical algorithm determine the spread
    
    if (absSpread > 0) {
        // Ensure spread maintains proper sign
        spread = isTeam1Favorite ? -absSpread : absSpread;
    }
    
    // Handle true pick'em games (spread rounds to 0)
    const isPick = absSpread === 0;
    
    // Log spread calculation for debugging
    if (team1Name && team2Name) {
        console.log(`[Spread Debug] ${team1Name} vs ${team2Name}: scoringDiff=${scoringDiff.toFixed(1)}, powerDiff=${absPowerDiff.toFixed(2)}, finalSpread=${spread}, isPick=${isPick}`);
    }
    
    // Deterministic seed key per matchup for stable markets
    const seedKey = `${team1RosterId || team1Name}-${team2RosterId || team2Name}-${weekNumber}`;

    // Calculate moneylines for pick'em vs regular spreads
    let team1ML, team2ML;
    if (isPick) {
        // Pick'em games get close moneylines (deterministic)
        team1ML = convertSpreadToMoneyline(0, true, vig, `${seedKey}-pick`);
        team2ML = convertSpreadToMoneyline(0, false, vig, `${seedKey}-pick`);
    } else {
        // Regular spreads
        team1ML = convertSpreadToMoneyline(absSpread, isTeam1Favorite, vig, `${seedKey}-spread`);
        team2ML = convertSpreadToMoneyline(absSpread, !isTeam1Favorite, vig, `${seedKey}-spread`);
    }
    
    // Calculate total with fantasy football context, using actual scoring data
    const total = calculateTotal(
        team1Stats.averageScore, 
        team2Stats.averageScore,
        { 
            weekNumber, 
            variance: 0.06,
            seedKey: `${seedKey}-total`,
            pace: 1.0 + (powerAnalysis.powerDiff * 0.01), // Higher power teams score more
            defensive: 1.0 // Could add defensive factors later
        }
    );
    
    // Generate realistic juice patterns (deterministic)
    const spreadJuice = generateSpreadJuice(spread, 0.6, `${seedKey}-juice`);
    const totalJuice = generateTotalJuice(total, 0.5, `${seedKey}-total`);
    
    // Format spread lines for display
    const formatSpreadLine = (spread, isTeam1) => {
        if (isPick) {
            return "PK"; // Show "PK" for pick'em games
        }
        
        if (isTeam1) {
            // Team1 gets the spread as calculated
            return spread > 0 ? `+${spread}` : spread.toString();
        } else {
            // Team2 gets the opposite spread
            const team2Spread = -spread;
            return team2Spread > 0 ? `+${team2Spread}` : team2Spread.toString();
        }
    };
    
    const markets = {
        spread: {
            team1: {
                name: team1Name,
                line: formatSpreadLine(spread, true),
                odds: isPick ? spreadJuice.favoriteJuice : (isTeam1Favorite ? spreadJuice.favoriteJuice : spreadJuice.underdogJuice)
            },
            team2: {
                name: team2Name,
                line: formatSpreadLine(spread, false),
                odds: isPick ? spreadJuice.underdogJuice : (isTeam1Favorite ? spreadJuice.underdogJuice : spreadJuice.favoriteJuice)
            }
        },
        moneyline: {
            team1: {
                name: team1Name,
                odds: team1ML
            },
            team2: {
                name: team2Name,
                odds: team2ML
            }
        },
        total: {
            over: {
                line: total,
                odds: totalJuice.overJuice
            },
            under: {
                line: total,
                odds: totalJuice.underJuice
            }
        },
        // Include power analysis for debugging/display
        powerAnalysis: {
            team1Power: powerAnalysis.team1Power,
            team2Power: powerAnalysis.team2Power,
            powerDiff: powerAnalysis.powerDiff,
            team1Details: powerAnalysis.team1Details,
            team2Details: powerAnalysis.team2Details,
            originalWinProb: winProbability,
            adjustedWinProb: finalWinProbability,
            isPick: isPick
        }
    };
    
    // Add prop bets if requested
    if (includePropBets) {
        markets.props = generatePropBets(team1Stats, team2Stats, team1Name, team2Name);
    }
    
    return markets;
};

/**
 * Generate prop bets for teams
 */
export const generatePropBets = (team1Stats, team2Stats, team1Name, team2Name) => {
    const team1Avg = team1Stats.averageScore || 100;
    const team2Avg = team2Stats.averageScore || 100;
    
    return {
        teamTotals: {
            team1: {
                name: team1Name,
                over: { line: Math.round((team1Avg - 5) * 2) / 2, odds: -115 },
                under: { line: Math.round((team1Avg - 5) * 2) / 2, odds: -105 }
            },
            team2: {
                name: team2Name,
                over: { line: Math.round((team2Avg - 5) * 2) / 2, odds: -115 },
                under: { line: Math.round((team2Avg - 5) * 2) / 2, odds: -105 }
            }
        },
        marginOfVictory: {
            under7: { odds: +140 },
            "7to14": { odds: +180 },
            over14: { odds: +250 }
        }
    };
};

/**
 * Validate that spread and moneyline odds are consistent
 */
export const validateOddsConsistency = (spread, team1ML, team2ML) => {
    const absSpread = Math.abs(spread);
    const expectedSeedKey = `validate-${spread}`;
    const expectedTeam1ML = convertSpreadToMoneyline(absSpread, spread < 0, SPORTSBOOK_VIG, `${expectedSeedKey}-1`);
    const expectedTeam2ML = convertSpreadToMoneyline(absSpread, spread > 0, SPORTSBOOK_VIG, `${expectedSeedKey}-2`);
    
    const team1Diff = Math.abs(team1ML - expectedTeam1ML);
    const team2Diff = Math.abs(team2ML - expectedTeam2ML);
    
    // Allow for some variance but flag major inconsistencies
    const tolerance = spread < 3 ? 50 : spread < 7 ? 100 : 200;
    
    return {
        isConsistent: team1Diff <= tolerance && team2Diff <= tolerance,
        team1Expected: expectedTeam1ML,
        team2Expected: expectedTeam2ML,
        team1Actual: team1ML,
        team2Actual: team2ML,
        adjustmentNeeded: team1Diff > tolerance || team2Diff > tolerance
    };
};

/**
 * Convert American odds to implied probability
 */
export const oddsToImpliedProbability = (americanOdds) => {
    if (americanOdds > 0) {
        return 100 / (americanOdds + 100);
    } else {
        return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
};

/**
 * Convert implied probability to American odds
 */
import { SPORTSBOOK_VIG } from '../config';

export const probabilityToAmericanOdds = (probability, addVig = true, vigAmount = SPORTSBOOK_VIG) => {
    let adjustedProb = probability;

    if (addVig) {
        // Apply vig multiplicatively so the market overround equals (1 + vig)
        adjustedProb = probability * (1 + vigAmount);
    }

    adjustedProb = Math.max(0.01, Math.min(0.99, adjustedProb));

    if (adjustedProb >= 0.5) {
        return Math.round(-(adjustedProb / (1 - adjustedProb)) * 100);
    } else {
        return Math.round(((1 - adjustedProb) / adjustedProb) * 100);
    }
};

export default {
    convertSpreadToMoneyline,
    calculateSpreadFromProbability,
    calculateTotal,
    generateCleanBettingMarkets,
    generatePropBets,
    validateOddsConsistency,
    oddsToImpliedProbability,
    probabilityToAmericanOdds,
    calculateAdvancedTeamPower,
    calculateTeamPowerDifferential,
    generateSpreadJuice,
    generateTotalJuice
};
