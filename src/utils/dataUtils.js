// src/utils/dataUtils.js
/**
 * Utility functions for data formatting and manipulation
 */

/**
 * Format a date string to a readable format
 * @param {string|number} dateString - Date string or timestamp
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Format player transaction for display
 * @param {string} playerId - The player ID
 * @param {Object} playerMap - Map of player IDs to player objects
 * @returns {string} Formatted player name
 */
export const formatPlayerTransaction = (playerId, playerMap) => {
    if (!playerId || !playerMap) return 'Unknown Player';
    
    const player = playerMap[playerId];
    if (!player) return `Player ${playerId}`;
    
    // Return player name if available, otherwise use player ID
    return player.full_name || player.name || `Player ${playerId}`;
};

/**
 * Get a readable label for transaction type
 * @param {string} type - Transaction type from Sleeper
 * @returns {string} Human-readable transaction type
 */
export const getTransactionTypeLabel = (type) => {
    const typeMap = {
        'trade': 'Trade',
        'waiver': 'Waiver Claim',
        'free_agent': 'Free Agent Pickup',
        'commissioner': 'Commissioner Move',
        'draft': 'Draft Pick'
    };
    
    return typeMap[type] || type || 'Unknown';
};

/**
 * Get team name from roster data
 * @param {string} rosterId - Roster ID
 * @param {Array} rostersData - Array of roster objects
 * @returns {string} Team name
 */
export const getTeamNameFromRoster = (rosterId, rostersData) => {
    if (!rosterId || !rostersData) return 'Unknown Team';
    
    const roster = rostersData.find(r => r.roster_id === parseInt(rosterId));
    if (!roster) return `Team ${rosterId}`;
    
    return roster.metadata?.team_name || `Team ${rosterId}`;
};

/**
 * Calculate total points for a roster in a specific week
 * @param {Object} matchup - Matchup data
 * @param {string} rosterId - Roster ID
 * @returns {number} Total points scored
 */
export const calculateRosterPoints = (matchup, rosterId) => {
    if (!matchup || !rosterId) return 0;
    
    return matchup.points || 0;
};

export default {
    formatDate,
    formatPlayerTransaction,
    getTransactionTypeLabel,
    getTeamNameFromRoster,
    calculateRosterPoints
};