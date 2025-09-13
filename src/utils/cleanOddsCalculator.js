// src/utils/cleanOddsCalculator.js
// Clean, consolidated odds calculator with proper spread-to-moneyline relationships

/**
 * Convert point spread to moneyline odds with realistic sportsbook relationships
 * Based on REAL NFL sportsbook data patterns
 */
export const convertSpreadToMoneyline = (spread, isFavorite = true, vig = 0.045) => {
    const absSpread = Math.abs(spread);
    
    // Handle true pick'em games (spread = 0)
    if (absSpread === 0) {
        // True pick'em should have very close moneylines
        const baseOdds = -110;
        const variance = Math.round((Math.random() - 0.5) * 10); // -5 to +5 variance
        return baseOdds + variance; // Range: -115 to -105
    }
    
    if (absSpread >= 20) {
        return isFavorite ? -1500 : +800; // Extreme spreads
    }
    
    // Real sportsbook moneyline patterns based on actual market data
    let favoriteOdds, underdogOdds;
    
    if (absSpread <= 1.5) {
        favoriteOdds = -115 - (absSpread * 10);  // -115 to -130
        underdogOdds = 100 + (absSpread * 10);   // +100 to +110
    } else if (absSpread <= 3) {
        favoriteOdds = -130 - ((absSpread - 1.5) * 20); // -130 to -160
        underdogOdds = 110 + ((absSpread - 1.5) * 20);  // +110 to +140
    } else if (absSpread <= 4.5) {
        favoriteOdds = -160 - ((absSpread - 3) * 30); // -160 to -205
        underdogOdds = 140 + ((absSpread - 3) * 25);  // +140 to +175
    } else if (absSpread <= 6.5) {
        favoriteOdds = -205 - ((absSpread - 4.5) * 50); // -205 to -305
        underdogOdds = 175 + ((absSpread - 4.5) * 35);  // +175 to +245
    } else if (absSpread <= 10) {
        favoriteOdds = -305 - ((absSpread - 6.5) * 70); // -305 to -550
        underdogOdds = 245 + ((absSpread - 6.5) * 55);  // +245 to +435
    } else if (absSpread <= 14) {
        favoriteOdds = -550 - ((absSpread - 10) * 100); // -550 to -950
        underdogOdds = 435 + ((absSpread - 10) * 90);   // +435 to +795
    } else {
        favoriteOdds = -950 - ((absSpread - 14) * 75);  // -950+
        underdogOdds = 795 + ((absSpread - 14) * 60);   // +795+
    }
    
    // Apply small vig adjustments
    const vigFactor = 1 + (vig * 0.5);
    favoriteOdds = Math.round(favoriteOdds * vigFactor);
    underdogOdds = Math.round(underdogOdds * vigFactor);
    
    // Ensure proper bounds
    favoriteOdds = Math.max(-2000, favoriteOdds);
    underdogOdds = Math.min(2000, Math.max(100, underdogOdds));
    
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

/**
 * Calculate total (over/under) based on team averages and matchup context
 * Enhanced for fantasy football scoring patterns with NFL-like relative scaling
 */
export const calculateTotal = (team1AvgScore, team2AvgScore, matchupContext = {}) => {
    let baseTotal = team1AvgScore + team2AvgScore;
    
    // Fantasy football scaling: NFL totals are ~21-56, fantasy should be ~200-300
    // That's roughly 5-6x multiplier, but we want some variance
    const fantasyMultiplier = 5.2; // Base multiplier
    
    // If we don't have real averages, use reasonable defaults
    if (baseTotal < 150) {
        baseTotal = 200 + (Math.random() * 60); // 200-260 default range
    }
    
    // Convert to "NFL equivalent" for calculation
    const nflEquivalent = baseTotal / fantasyMultiplier; // ~40-50 NFL range
    
    // Adjust for pace and matchup factors (similar to NFL)
    const {
        pace = 1.0,           // Pace factor (1.0 = average)
        defensive = 1.0,      // Defensive factor (1.0 = average, <1.0 = better defense)
        weather = 1.0,        // Weather factor (minimal for fantasy)
        variance = 0.06,      // Expected variance (slightly higher than NFL)
        weekNumber = 3        // Current week
    } = matchupContext;
    
    let adjustedNFL = nflEquivalent * pace * defensive * weather;
    
    // Early season adjustment (weeks 1-4 tend to be slightly higher scoring)
    if (weekNumber <= 4) {
        adjustedNFL *= 1.03; // 3% boost early season (vs NFL's 5%)
    }
    
    // Add realistic variance
    const randomFactor = 1 + ((Math.random() - 0.5) * variance);
    adjustedNFL *= randomFactor;
    
    // Convert back to fantasy scale
    let fantasyTotal = adjustedNFL * fantasyMultiplier;
    
    // Ensure totals are in realistic fantasy football range
    // NFL: 40-50 becomes Fantasy: 208-260 (conservative range)
    fantasyTotal = Math.max(205, Math.min(290, fantasyTotal));
    
    // Round to nearest 0.5 (just like NFL)
    return Math.round(fantasyTotal * 2) / 2;
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
    if (absSpread <= 1.5) {
        // Close games often have asymmetric juice
        const favoriteJuice = -115 - Math.round(Math.random() * 10); // -115 to -125
        const underdogJuice = -105 - Math.round(Math.random() * 10);  // -105 to -115
        return { favoriteJuice, underdogJuice };
    } else if (absSpread >= 10) {
        // Large spreads often have more symmetric juice
        const juice = -108 - Math.round(Math.random() * 8); // -108 to -116
        return { favoriteJuice: juice, underdogJuice: juice };
    } else {
        // Normal spreads with some variance
        const variance = Math.round((Math.random() - 0.5) * 16); // -8 to +8
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
export const generateTotalJuice = (total, marketVolume = 0.5) => {
    // Most totals are symmetric but with slight variance
    const baseJuice = -110;
    const variance = Math.round((Math.random() - 0.5) * 12); // -6 to +6
    
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
        vig = 0.045,
        includePropBets = true,
        includeSpecialMarkets = false,
        weekNumber = 3
    } = options;
    
    // Get team statistics with enhanced data
    const team1Stats = teamStats[team1RosterId] || { averageScore: 120, gamesPlayed: 0, scores: [], rosterId: team1RosterId };
    const team2Stats = teamStats[team2RosterId] || { averageScore: 120, gamesPlayed: 0, scores: [], rosterId: team2RosterId };
    
    // Calculate advanced team power differential based on points, consistency, momentum
    const powerAnalysis = calculateTeamPowerDifferential(team1Stats, team2Stats, teamStats);
    
    // Use power differential to adjust the win probability
    // If power analysis shows a different story than win probability, factor it in
    const powerBasedProbAdjustment = powerAnalysis.powerDiff * 0.02; // 0.02 per power point
    const adjustedWinProbability = Math.max(0.1, Math.min(0.9, winProbability + powerBasedProbAdjustment));
    
    // Calculate spread using the adjusted probability and power differential
    let spread = calculateSpreadFromProbability(adjustedWinProbability, powerAnalysis.powerDiff);
    const isTeam1Favorite = spread < 0;
    const absSpread = Math.abs(spread);
    
    // Handle true pick'em games (spread rounds to 0)
    const isPick = absSpread === 0;
    
    // Calculate moneylines for pick'em vs regular spreads
    let team1ML, team2ML;
    if (isPick) {
        // Pick'em games get close moneylines
        team1ML = convertSpreadToMoneyline(0, true, vig);
        team2ML = convertSpreadToMoneyline(0, false, vig);
    } else {
        // Regular spreads
        team1ML = convertSpreadToMoneyline(absSpread, isTeam1Favorite, vig);
        team2ML = convertSpreadToMoneyline(absSpread, !isTeam1Favorite, vig);
    }
    
    // Calculate total with fantasy football context, using actual scoring data
    const total = calculateTotal(
        team1Stats.averageScore, 
        team2Stats.averageScore,
        { 
            weekNumber, 
            variance: 0.06,
            pace: 1.0 + (powerAnalysis.powerDiff * 0.01), // Higher power teams score more
            defensive: 1.0 // Could add defensive factors later
        }
    );
    
    // Generate realistic juice patterns
    const spreadJuice = generateSpreadJuice(spread, 0.6);
    const totalJuice = generateTotalJuice(total, 0.5);
    
    // Format spread lines for display
    const formatSpreadLine = (spread, isTeam1) => {
        if (isPick) {
            return "PK"; // Show "PK" for pick'em games
        }
        
        if (isTeam1) {
            return spread > 0 ? `+${spread}` : spread.toString();
        } else {
            return spread > 0 ? (-spread).toString() : `+${Math.abs(spread)}`;
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
            adjustedWinProb: adjustedWinProbability,
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
    const expectedTeam1ML = convertSpreadToMoneyline(absSpread, spread < 0);
    const expectedTeam2ML = convertSpreadToMoneyline(absSpread, spread > 0);
    
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
export const probabilityToAmericanOdds = (probability, addVig = true, vigAmount = 0.045) => {
    let adjustedProb = probability;
    
    if (addVig) {
        adjustedProb = probability >= 0.5 ? 
            probability + vigAmount : 
            probability - vigAmount;
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
