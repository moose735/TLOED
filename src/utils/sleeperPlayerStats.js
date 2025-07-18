// src/utils/sleeperPlayerStats.js

/**
 * Fetches weekly player statistics from the Sleeper API for a given player and season.
 *
 * @param {string} playerId - The ID of the player (e.g., 'SF' for 49ers DEF, or a numerical ID for individual players).
 * @param {number} season - The season year (e.g., 2023).
 * @param {string} seasonType - The type of season (e.g., 'regular', 'preseason', 'postseason').
 * @param {string} [playerNameForLog='Unknown Player'] - Optional: The player's name for clearer console logs.
 * @returns {Promise<object | null>} A promise that resolves to an object of weekly stats, or null if an error occurs.
 */
export const fetchPlayerStats = async (playerId, season, seasonType = 'regular', playerNameForLog = 'Unknown Player') => {
    if (!playerId || !season) {
        console.warn('fetchPlayerStats: Player ID and season are required.');
        return null;
    }

    const url = `https://api.sleeper.app/stats/nfl/player/${playerId}?season_type=${seasonType}&season=${season}&grouping=week`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Log more details if the HTTP response is not OK
            console.error(`Error fetching stats for ${playerNameForLog} (ID: ${playerId}), season ${season}: HTTP Status ${response.status} - ${response.statusText}`);
            // Attempt to read the response body for more error details, but don't block
            try {
                const errorBody = await response.text();
                console.error(`Error response body for ${playerNameForLog} (ID: ${playerId}):`, errorBody);
            } catch (readError) {
                console.error(`Could not read error response body for ${playerNameForLog} (ID: ${playerId}):`, readError);
            }
            return null;
        }

        const stats = await response.json();
        console.log(`Successfully fetched stats for ${playerNameForLog} (ID: ${playerId}), season ${season}:`, stats); // Log the fetched data
        return stats;
    } catch (error) {
        console.error(`Failed to fetch stats for ${playerNameForLog} (ID: ${playerId}), season ${season} (network or JSON parse error):`, error);
        return null;
    }
};

/**
 * Fetches the scoring settings for a given league ID from the Sleeper API.
 *
 * @param {string} leagueId - The ID of the Sleeper league.
 * @returns {Promise<object | null>} A promise that resolves to the scoring settings object, or null if an error occurs.
 */
export const fetchLeagueScoringSettings = async (leagueId) => {
    if (!leagueId) {
        console.error('fetchLeagueScoringSettings: League ID is required.');
        return null;
    }
    const url = `https://api.sleeper.app/v1/league/${leagueId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching league settings for league ${leagueId}: HTTP Status ${response.status} - ${response.statusText}`);
            return null;
        }
        const leagueData = await response.json();
        console.log(`Successfully fetched league settings for league ${leagueId}:`, leagueData.scoring_settings);
        return leagueData.scoring_settings || null;
    } catch (error) {
        console.error(`Failed to fetch league settings for league ${leagueId}:`, error);
        return null;
    }
};

/**
 * Fetches the roster positions and total rosters for a given league ID from the Sleeper API.
 *
 * @param {string} leagueId - The ID of the Sleeper league.
 * @returns {Promise<object | null>} A promise that resolves to an object containing roster_positions and total_rosters, or null if an error occurs.
 */
export const fetchLeagueRosterSettings = async (leagueId) => {
    if (!leagueId) {
        console.error('fetchLeagueRosterSettings: League ID is required.');
        return null;
    }
    const url = `https://api.sleeper.app/v1/league/${leagueId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching league roster settings for league ${leagueId}: HTTP Status ${response.status} - ${response.statusText}`);
            return null;
        }
        const leagueData = await response.json();
        const rosterSettings = {
            roster_positions: leagueData.roster_positions || [],
            total_rosters: leagueData.total_rosters || 0
        };
        console.log(`Successfully fetched league roster settings for league ${leagueId}:`, rosterSettings);
        return rosterSettings;
    } catch (error) {
        console.error(`Failed to fetch league roster settings for league ${leagueId}:`, error);
        return null;
    }
};


/**
 * Calculates fantasy points for a player based on their stats and league scoring settings.
 *
 * @param {object} playerStats - The raw player stats object (e.g., { "1": { stats: { ... } }, "2": { stats: { ... } } }).
 * @param {object} scoringSettings - The league's scoring settings.
 * @param {string} playerPosition - The player's position (e.g., 'QB', 'RB', 'DEF').
 * @returns {number} The total fantasy points for the player.
 */
export const calculateFantasyPoints = (playerStats, scoringSettings, playerPosition) => {
    if (!playerStats || !scoringSettings) {
        return 0;
    }

    let totalPoints = 0;

    // Iterate through each week's stats if available (Sleeper returns weekly data as keys '1', '2', etc.)
    for (const week in playerStats) {
        if (playerStats[week] && playerStats[week].stats) {
            const weeklyStats = playerStats[week].stats;

            // Apply general scoring rules
            for (const statKey in scoringSettings) {
                // Skip tiered defensive scoring keys for now, they are handled separately
                if (statKey.startsWith('pts_allow_') || statKey.startsWith('yds_allow_')) {
                    continue;
                }

                const statValue = weeklyStats[statKey];
                const scoreValue = scoringSettings[statKey];

                if (typeof statValue === 'number' && typeof scoreValue === 'number') {
                    totalPoints += statValue * scoreValue;
                }
            }

            // Handle tiered defensive scoring for DEF position
            if (playerPosition.toUpperCase() === 'DEF') {
                const ptsAllowed = weeklyStats.pts_allow;
                const ydsAllowed = weeklyStats.yds_allow;

                // Points Allowed tiers
                if (typeof ptsAllowed === 'number') {
                    if (ptsAllowed === 0 && typeof scoringSettings.pts_allow_0 === 'number') {
                        totalPoints += scoringSettings.pts_allow_0;
                    } else if (ptsAllowed >= 1 && ptsAllowed <= 6 && typeof scoringSettings.pts_allow_1_6 === 'number') {
                        totalPoints += scoringSettings.pts_allow_1_6;
                    } else if (ptsAllowed >= 7 && ptsAllowed <= 13 && typeof scoringSettings.pts_allow_7_13 === 'number') {
                        totalPoints += scoringSettings.pts_allow_7_13;
                    } else if (ptsAllowed >= 14 && ptsAllowed <= 20 && typeof scoringSettings.pts_allow_14_20 === 'number') {
                        totalPoints += scoringSettings.pts_allow_14_20;
                    } else if (ptsAllowed >= 21 && ptsAllowed <= 27 && typeof scoringSettings.pts_allow_21_27 === 'number') {
                        totalPoints += scoringSettings.pts_allow_21_27;
                    } else if (ptsAllowed >= 28 && ptsAllowed <= 34 && typeof scoringSettings.pts_allow_28_34 === 'number') {
                        totalPoints += scoringSettings.pts_allow_28_34;
                    } else if (ptsAllowed >= 35 && typeof scoringSettings.pts_allow_35p === 'number') {
                        totalPoints += scoringSettings.pts_allow_35p;
                    }
                }

                // Yards Allowed tiers
                if (typeof ydsAllowed === 'number') {
                    if (ydsAllowed >= 0 && ydsAllowed <= 100 && typeof scoringSettings.yds_allow_0_100 === 'number') {
                        totalPoints += scoringSettings.yds_allow_0_100;
                    } else if (ydsAllowed >= 101 && ydsAllowed <= 199 && typeof scoringSettings.yds_allow_100_199 === 'number') {
                        totalPoints += scoringSettings.yds_allow_100_199;
                    } else if (ydsAllowed >= 200 && ydsAllowed <= 299 && typeof scoringSettings.yds_allow_200_299 === 'number') {
                        totalPoints += scoringSettings.yds_allow_200_299;
                    } else if (ydsAllowed >= 300 && ydsAllowed <= 349 && typeof scoringSettings.yds_allow_300_349 === 'number') {
                        totalPoints += scoringSettings.yds_allow_300_349;
                    } else if (ydsAllowed >= 350 && ydsAllowed <= 399 && typeof scoringSettings.yds_allow_350_399 === 'number') {
                        totalPoints += scoringSettings.yds_allow_350_399;
                    } else if (ydsAllowed >= 400 && ydsAllowed <= 449 && typeof scoringSettings.yds_allow_400_449 === 'number') {
                        totalPoints += scoringSettings.yds_allow_400_449;
                    } else if (ydsAllowed >= 450 && ydsAllowed <= 499 && typeof scoringSettings.yds_allow_450_499 === 'number') {
                        totalPoints += scoringSettings.yds_allow_450_499;
                    } else if (ydsAllowed >= 500 && ydsAllowed <= 549 && typeof scoringSettings.yds_allow_500_549 === 'number') {
                        totalPoints += scoringSettings.yds_allow_500_549;
                    } else if (ydsAllowed >= 550 && typeof scoringSettings.yds_allow_550p === 'number') {
                        totalPoints += scoringSettings.yds_allow_550p;
                    }
                }
            }
        }
    }

    return totalPoints;
};


/**
 * Groups players by position and ranks them by fantasy points scored.
 * Also provides an overall ranking across all positions.
 *
 * @param {Array<object>} processedPicks - An array of pick objects, each including 'fantasy_points' and 'player_position'.
 * @returns {object} An object containing positional and overall rankings.
 * {
 * positional: {
 * 'QB': [{ player_name: '...', fantasy_points: ..., rank: 1 }, ...],
 * 'RB': [...],
 * // ... other positions
 * },
 * overall: [{ player_name: '...', fantasy_points: ..., rank: 1 }, ...]
 * }
 */
export const rankPlayersByFantasyPoints = (processedPicks) => {
    const positionalRankings = {};
    const overallRankings = [];

    // Filter out picks without fantasy points or position, and add to overall
    const playersWithPoints = processedPicks.filter(pick =>
        typeof pick.fantasy_points === 'number' && pick.player_position
    );

    // Populate overall rankings
    overallRankings.push(...playersWithPoints);

    // Group by position
    playersWithPoints.forEach(pick => {
        const position = pick.player_position.toUpperCase();
        if (!positionalRankings[position]) {
            positionalRankings[position] = [];
        }
        positionalRankings[position].push(pick);
    });

    // Sort and assign ranks
    overallRankings.sort((a, b) => b.fantasy_points - a.fantasy_points);
    overallRankings.forEach((player, index) => {
        player.overall_rank = index + 1;
    });

    for (const position in positionalRankings) {
        positionalRankings[position].sort((a, b) => b.fantasy_points - a.fantasy_points);
        positionalRankings[position].forEach((player, index) => {
            player.positional_rank = index + 1;
        });
    }

    return {
        positional: positionalRankings,
        overall: overallRankings
    };
};

/**
 * Calculates Value Over Replacement Player (VORP) for each player.
 * The replacement level is defined by fixed waiver-wire-level ranks for each position.
 *
 * @param {object} positionalRankings - Object with players ranked by position, including 'fantasy_points'.
 * @param {object} leagueRosterSettings - Object containing roster_positions (array of strings) and total_rosters (number).
 * @returns {object} An object where keys are positions and values are arrays of players with added 'vorp' property.
 * {
 * 'QB': [{ player_name: '...', fantasy_points: ..., vorp: ..., positional_rank: ... }, ...],
 * 'RB': [...],
 * // ... and so on
 * }
 */
export const calculateVORP = (positionalRankings, leagueRosterSettings) => {
    if (!positionalRankings || !leagueRosterSettings || !Array.isArray(leagueRosterSettings.roster_positions) || typeof leagueRosterSettings.total_rosters !== 'number') {
        console.warn('calculateVORP: Missing or invalid positional rankings or league roster settings.');
        return {};
    }

    const vorpResults = {};

    // Define fixed replacement level ranks for common positions (waiver wire caliber)
    const fixedReplacementRanks = {
        'QB': 18, // QB18
        'RB': 36, // RB36
        'WR': 48, // WR48
        'TE': 12, // TE12
        'K': 12,  // K12 (assuming 12 team league, 1 starter per team)
        'DEF': 12 // DEF12 (assuming 12 team league, 1 starter per team)
    };

    console.log('VORP Calculation - Fixed Replacement Ranks:', fixedReplacementRanks);

    for (const position in positionalRankings) {
        const playersForPosition = positionalRankings[position];
        const upperPos = position.toUpperCase(); // Ensure position key is uppercase for lookup

        // Get the replacement rank for this position, default to 0 if not defined
        const replacementRank = fixedReplacementRanks[upperPos] || 0;

        // The replacement level index is replacementRank - 1 (because arrays are 0-indexed)
        // If replacementRank is 0, replacementLevelIndex will be -1, which will be handled by the bounds check.
        const replacementLevelIndex = replacementRank > 0 ? replacementRank - 1 : -1;

        let replacementPoints = 0;
        let replacementPlayerName = 'N/A';

        // Check if the calculated replacement index is valid and within the array bounds
        if (replacementLevelIndex >= 0 && replacementLevelIndex < playersForPosition.length) {
            const replacementPlayer = playersForPosition[replacementLevelIndex];
            replacementPoints = replacementPlayer.fantasy_points;
            replacementPlayerName = replacementPlayer.player_name;
            console.log(`Replacement player for ${upperPos} (rank ${replacementLevelIndex + 1}): ${replacementPlayerName} with ${replacementPoints.toFixed(2)} points.`);
        } else {
            console.warn(`Could not find a valid replacement player for ${upperPos} at calculated rank ${replacementRank}. Not enough players ranked or rank is 0. Setting replacement points to 0.`);
            // If no valid replacement player is found, replacement points default to 0.
            // This means VORP for all players in this position will be their raw fantasy points.
        }

        vorpResults[upperPos] = playersForPosition.map(player => ({
            ...player,
            // VORP is player's fantasy points minus replacement points
            vorp: player.fantasy_points - replacementPoints
        }));
    }

    return vorpResults;
};
