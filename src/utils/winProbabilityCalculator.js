// Calculate win probabilities based on current season performance
// Uses DPR, scoring averages, consistency, and other factors
// Refactored to use dynamic stats system with roster ID support

import { getStatsByTeamName, mapTeamNamesToRosterIds } from './dynamicSeasonStats.js';
import { currentSeasonStats } from './currentSeasonStats.js'; // Fallback for backward compatibility

/**
 * Calculate win probability between two teams based on current season performance
 * Supports both team names and roster IDs, with dynamic stats system
 * @param {string} team1Identifier - Team name or roster ID
 * @param {string} team2Identifier - Team name or roster ID
 * @param {Object} dynamicStats - Dynamic stats from buildDynamicSeasonStats
 * @returns {number} Win probability for team1 (0-1 scale)
 */
export function calculateWinProbability(team1Identifier, team2Identifier, dynamicStats = null) {
    // Handle legacy team name lookups or direct roster ID access
    let team1, team2;
    
    if (dynamicStats) {
        // Try roster ID lookup first (more reliable)
        team1 = dynamicStats[team1Identifier];
        team2 = dynamicStats[team2Identifier];
        
        // Fallback to team name lookup
        if (!team1) team1 = getStatsByTeamName(dynamicStats, team1Identifier);
        if (!team2) team2 = getStatsByTeamName(dynamicStats, team2Identifier);
    } else {
        // Fallback to hardcoded stats for backward compatibility
        team1 = currentSeasonStats[team1Identifier];
        team2 = currentSeasonStats[team2Identifier];
    }
    
    if (!team1 || !team2) {
        console.warn(`Missing stats for ${team1Identifier} or ${team2Identifier}`);
        return 0.5; // Default to coin flip
    }
    
    // 1. DPR-based probability (primary factor - 50% weight)
    // DPR already accounts for strength of schedule and efficiency
    const dprDiff = team1.dpr - team2.dpr;
    // Convert DPR difference to probability using logistic function
    // More conservative curve for fantasy football (reduced from 8 to 5)
    const dprProb = 1 / (1 + Math.exp(-dprDiff * 5)); 
    
    // 2. Scoring average probability (30% weight)
    const avgDiff = team1.avgPerGame - team2.avgPerGame;
    // More conservative: 20 point difference should be ~60% probability (reduced from 0.08 to 0.05)
    const avgProb = 1 / (1 + Math.exp(-avgDiff * 0.05));
    
    // 3. Recent form adjustment (10% weight)
    let formProb = 0.5;
    if (team1.isHot && team2.isCold) formProb = 0.75;
    else if (team1.isCold && team2.isHot) formProb = 0.25;
    else if (team1.isHot && !team2.isHot) formProb = 0.6;
    else if (team2.isHot && !team1.isHot) formProb = 0.4;
    else if (team1.isCold && !team2.isCold) formProb = 0.4;
    else if (team2.isCold && !team1.isCold) formProb = 0.6;
    
    // 4. Record-based adjustment (10% weight)
    const team1Wins = parseInt(team1.record.split('-')[0]);
    const team2Wins = parseInt(team2.record.split('-')[0]);
    const recordDiff = team1Wins - team2Wins;
    const recordProb = Math.max(0.2, Math.min(0.8, 0.5 + (recordDiff * 0.1)));
    
    // Weighted combination
    const finalProb = (dprProb * 0.5) + (avgProb * 0.3) + (formProb * 0.1) + (recordProb * 0.1);
    
    // Ensure reasonable bounds
    return Math.max(0.05, Math.min(0.95, finalProb));
}

/**
 * Calculate win probability with detailed breakdown for analysis
 * Supports both team names and roster IDs, with dynamic stats system
 * @param {string} team1Identifier - Team name or roster ID  
 * @param {string} team2Identifier - Team name or roster ID
 * @param {Object} dynamicStats - Dynamic stats from buildDynamicSeasonStats
 * @returns {Object} Detailed probability breakdown
 */
export function calculateDetailedWinProbability(team1Identifier, team2Identifier, dynamicStats = null) {
    // Handle legacy team name lookups or direct roster ID access
    let team1, team2;
    
    if (dynamicStats) {
        // Try roster ID lookup first (more reliable)
        team1 = dynamicStats[team1Identifier];
        team2 = dynamicStats[team2Identifier];
        
        // Fallback to team name lookup
        if (!team1) team1 = getStatsByTeamName(dynamicStats, team1Identifier);
        if (!team2) team2 = getStatsByTeamName(dynamicStats, team2Identifier);
    } else {
        // Fallback to hardcoded stats for backward compatibility
        team1 = currentSeasonStats[team1Identifier];
        team2 = currentSeasonStats[team2Identifier];
    }
    
    if (!team1 || !team2) {
        return {
            winProbability: 0.5,
            breakdown: { error: `Missing team data for ${team1Identifier} or ${team2Identifier}` }
        };
    }
    
    // Calculate each component
    const dprDiff = team1.dpr - team2.dpr;
    const dprProb = 1 / (1 + Math.exp(-dprDiff * 8));
    
    const avgDiff = team1.avgPerGame - team2.avgPerGame;
    const avgProb = 1 / (1 + Math.exp(-avgDiff * 0.08));
    
    let formProb = 0.5;
    let formReason = 'neutral';
    if (team1.isHot && team2.isCold) {
        formProb = 0.75;
        formReason = 'team1 hot vs team2 cold';
    } else if (team1.isCold && team2.isHot) {
        formProb = 0.25;
        formReason = 'team1 cold vs team2 hot';
    } else if (team1.isHot && !team2.isHot) {
        formProb = 0.6;
        formReason = 'team1 hot';
    } else if (team2.isHot && !team1.isHot) {
        formProb = 0.4;
        formReason = 'team2 hot';
    } else if (team1.isCold && !team2.isCold) {
        formProb = 0.4;
        formReason = 'team1 cold';
    } else if (team2.isCold && !team1.isCold) {
        formProb = 0.6;
        formReason = 'team2 cold';
    }
    
    const team1Wins = parseInt(team1.record.split('-')[0]);
    const team2Wins = parseInt(team2.record.split('-')[0]);
    const recordDiff = team1Wins - team2Wins;
    const recordProb = Math.max(0.2, Math.min(0.8, 0.5 + (recordDiff * 0.1)));
    
    const finalProb = (dprProb * 0.5) + (avgProb * 0.3) + (formProb * 0.1) + (recordProb * 0.1);
    const boundedProb = Math.max(0.05, Math.min(0.95, finalProb));
    
    return {
        winProbability: boundedProb,
        breakdown: {
            dpr: { diff: dprDiff.toFixed(3), prob: dprProb.toFixed(3), weight: '50%' },
            scoring: { diff: avgDiff.toFixed(1), prob: avgProb.toFixed(3), weight: '30%' },
            form: { prob: formProb.toFixed(3), reason: formReason, weight: '10%' },
            record: { diff: recordDiff, prob: recordProb.toFixed(3), weight: '10%' },
            team1Stats: {
                rank: team1.rank,
                dpr: team1.dpr,
                avgPerGame: team1.avgPerGame.toFixed(1),
                record: team1.record,
                isHot: team1.isHot || false,
                isCold: team1.isCold || false
            },
            team2Stats: {
                rank: team2.rank,
                dpr: team2.dpr,
                avgPerGame: team2.avgPerGame.toFixed(1),
                record: team2.record,
                isHot: team2.isHot || false,
                isCold: team2.isCold || false
            }
        }
    };
}

/**
 * Calculate win probability using roster IDs directly (preferred method)
 * @param {string} team1RosterId - First team's roster ID
 * @param {string} team2RosterId - Second team's roster ID  
 * @param {Object} dynamicStats - Dynamic stats from buildDynamicSeasonStats
 * @returns {number} Win probability for team1 (0-1 scale)
 */
export function calculateWinProbabilityByRosterId(team1RosterId, team2RosterId, dynamicStats) {
    return calculateWinProbability(team1RosterId, team2RosterId, dynamicStats);
}

/**
 * Convert team names to roster IDs and calculate win probability
 * @param {string} team1Name - First team name
 * @param {string} team2Name - Second team name
 * @param {Object} dynamicStats - Dynamic stats from buildDynamicSeasonStats
 * @returns {Object} Win probability and roster mapping info
 */
export function calculateWinProbabilityByNames(team1Name, team2Name, dynamicStats) {
    const mapping = mapTeamNamesToRosterIds(dynamicStats, team1Name, team2Name);
    
    if (!mapping.team1RosterId || !mapping.team2RosterId) {
        return {
            winProbability: 0.5,
            error: 'Could not map team names to roster IDs',
            mapping
        };
    }
    
    const winProb = calculateWinProbabilityByRosterId(
        mapping.team1RosterId, 
        mapping.team2RosterId, 
        dynamicStats
    );
    
    return {
        winProbability: winProb,
        mapping,
        team1Stats: mapping.team1Stats,
        team2Stats: mapping.team2Stats
    };
}