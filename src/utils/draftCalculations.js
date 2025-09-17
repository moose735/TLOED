// src/utils/draftCalculations.js

/**
 * Enriches a single draft pick with additional display and calculation properties.
 * This function mirrors some of the pick processing done in DraftAnalysis.jsx
 * to ensure calculations have access to the same enriched data.
 *
 * @param {object} pick - The raw pick object from Sleeper API.
 * @param {object[]} usersData - Array of all league users.
 * @param {object} historicalData - Object containing historical league data (rostersBySeason).
 * @param {number} selectedSeason - The current selected season.
 * @param {function} getTeamName - Utility function to get team name by user ID and season.
 * @returns {object} The enriched pick object.
 */
export const enrichPickForCalculations = (pick, usersData, historicalData, selectedSeason, getTeamName) => {
    // Determine player name based on position, especially for DEF
    let playerName = pick.player_name || 'Unknown Player';
    if (pick.metadata?.position === 'DEF') {
        playerName = `${pick.metadata.first_name || ''} ${pick.metadata.last_name || ''}`.trim();
        if (!playerName) playerName = 'Unknown Defense'; // Fallback if DEF names are empty
    }

    const user = usersData.find(u => u.user_id === pick.picked_by);
    const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.owner_id) === String(pick.picked_by));

    return {
        ...pick,
        player_name: playerName,
        player_position: pick.player_position || '',
        player_team: pick.metadata?.team || pick.player_team || '', // Use metadata.team for drafted team
        picked_by_display_name: user ? (user.display_name || 'Unknown User') : 'Unknown User',
        picked_by_team_name: roster ? (roster.metadata?.team_name || getTeamName(pick.picked_by, selectedSeason)) : getTeamName(pick.picked_by, selectedSeason),
        // Add more properties that might be useful for calculations here
    };
};

/**
 * Calculates a player's value based on their fantasy points.
 * This function now uses the 'fantasy_points' property from the enriched pick.
 *
 * @param {object} enrichedPick - An enriched pick object containing 'fantasy_points'.
 * @returns {number} The calculated player value, which is their fantasy points.
 */
export const calculatePlayerValue = (enrichedPick) => {
    // Return the fantasy_points directly, as this is the "value" we want to display.
    // Ensure it's a number, default to 0 if not available.
    return typeof enrichedPick.fantasy_points === 'number' ? enrichedPick.fantasy_points : 0;
};

/**
 * Calculates a hypothetical value for a specific draft pick slot.
 * This is a placeholder; you'll implement your actual pick value logic here.
 *
 * @param {number} pickNo - The overall pick number (e.g., 1, 2, 3...).
 * @param {number} totalRounds - Total rounds in the draft.
 * @param {number} totalTeams - Total teams in the league.
 * @returns {number} The calculated pick value.
 */
export const calculatePickSlotValue = (pickNo, totalRounds, totalTeams) => {
    // A simple inverse relationship to pick number
    if (pickNo <= 0) return 0;
    const totalPicks = totalRounds * totalTeams;
    return (totalPicks - pickNo + 1) * 5; // Higher picks have higher value
};

/**
 * Generates the expected VORP for each draft pick slot based on a historical logarithmic curve.
 * This curve represents a generalized expectation of VORP return from each pick,
 * independent of the specific players drafted in a given season.
 *
 * The formula used is: Expected VORP = A - B * ln(pick_number)
 * Constants A and B are derived from historical examples (e.g., Pick 1.1 expected ~27.1, Pick 1.10 expected ~0).
 *
 * @param {number} totalDraftPicks - The total number of picks in the draft.
 * @returns {Map<number, number>} A Map where keys are pick numbers (1-indexed) and values are their assigned expected VORP.
 */
export const generateExpectedVorpByPickSlot = (totalDraftPicks) => {
    const expectedVorpByPick = new Map();

    if (totalDraftPicks === 0) {
        try { const logger = require('./logger').default; logger.warn('generateExpectedVorpByPickSlot: No picks to assign expected VORP values.'); } catch(e) {}
        return expectedVorpByPick;
    }

    // Constants derived from user's example:
    // For pick 1: Expected VORP ≈ 27.1
    // For pick 10: Expected VORP ≈ 0
    const A = 27.1;
    const B = A / Math.log(10); // B ≈ 11.769

    for (let i = 1; i <= totalDraftPicks; i++) {
        // Use Math.max(1, i) to prevent Math.log(0) or negative for very low pick numbers if formula is misused
        const assignedVORP = A - B * Math.log(Math.max(1, i));
        expectedVorpByPick.set(i, assignedVORP);
    }

    return expectedVorpByPick;
};

/**
 * Calculates the difference between a player's actual VORP and the VORP assigned to their draft pick.
 * A positive delta means the player provided more value than their draft slot expected.
 *
 * @param {number} playerVORP - The actual VORP of the player.
 * @param {number} draftPickAssignedVORP - The VORP assigned to the draft pick.
 * @returns {number} The VORP delta (playerVORP - draftPickAssignedVORP).
 */
export const calculateVORPDelta = (playerVORP, draftPickAssignedVORP) => {
    return playerVORP - draftPickAssignedVORP;
};

/**
 * Scales a raw VORP delta value into a target range.
 *
 * @param {number} rawValue - The original VORP delta value.
 * @param {number} minRaw - The minimum raw VORP delta found in the dataset.
 * @param {number} maxRaw - The maximum raw VORP delta found in the dataset.
 * @param {number} minTarget - The minimum value of the target scaled range.
 * @param {number} maxTarget - The maximum value of the target scaled range.
 * @returns {number} The scaled VORP delta value.
 */
export const scaleVorpDelta = (rawValue, minRaw, maxRaw, minTarget, maxTarget) => {
    if (maxRaw === minRaw) { // Avoid division by zero if all raw values are the same
        return minTarget; // Or maxTarget, as the range is effectively zero
    }
    return ((rawValue - minRaw) / (maxRaw - minRaw)) * (maxTarget - minTarget) + minTarget;
};
