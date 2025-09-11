/**
 * dataUtils.js
 * Centralized utility functions for transforming and formatting fantasy football data.
 * @module dataUtils
 */

/**
 * Filter out future and unplayed matchups
 * @param {Array} matchups - Array of matchup objects
 * @param {Object} nflState - { season, week }
 * @returns {Array} - Filtered matchups
 */
export function filterValidMatchups(matchups, nflState) {
    return matchups.filter(m => (
        parseInt(m.year) < parseInt(nflState.season) ||
        (parseInt(m.year) === parseInt(nflState.season) && parseInt(m.week) <= parseInt(nflState.week))
    ) && !(parseFloat(m.team1_score) === 0 && parseFloat(m.team2_score) === 0));
}

/**
 * Format score to two decimals
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
    return typeof score === 'number' && !isNaN(score) ? score.toFixed(2) : 'N/A';
}

// Add more utilities as needed (grouping, sorting, win/loss/tie calculations, etc.)
