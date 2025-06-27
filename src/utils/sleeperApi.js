// src/utils/sleeperApi.js

// Easily configurable current league ID - imported from config.js
export { CURRENT_LEAGUE_ID, NICKNAME_TO_SLEEPER_USER } from '../config';

// Centralized map linking your internal team names (e.g., last names) to Sleeper User IDs.
// This is primarily for historical context or specific mapping needs.
export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
    'Ainsworth': '783790952367169536',
    'Bjarnar': '783761299275382784',
    'Blumbergs': '783789717920534528',
    'Boilard': '783789669597999104',
    'Dembski': '783767734491127808',
    'Irwin': '467074573125283840',
    'Meer': '783778036578418688',
    'Neufeglise': '783763304463147008',
    'O\'Donoghue': '783758716272009216',
    'Reis': '783760455581896704',
    'Reynolds': '783760119859560448',
    'Rogers': '783760799793188864',
};

// Managers who are no longer active in the league, for filtering or special handling
export const RETIRED_MANAGERS = []; // Populate with user_ids or team names as needed

// Caching mechanisms for various API calls to reduce redundant fetches
const leagueDetailsCache = new Map();
const usersCache = new Map(); // Cache for all users fetched per league
const rostersCache = new Map(); // Cache for rosters fetched per league
const nflPlayersCache = new Map();
const transactionsCache = new Map();
const winnersBracketCache = new Map();
const losersBracketCache = new Map();
const matchupDataCache = new Map(); // Cache for individual week matchups
const historicalMatchupsAggregatedCache = new Map(); // New: Cache for the entire aggregated historical matchups result

/**
 * Helper to fetch JSON safely with caching.
 * Adds more robust error logging and a simple retry mechanism.
 * @param {string} url The URL to fetch.
 * @param {Map} cacheMap The cache map to use.
 * @param {string} key The key for the cache.
 * @param {number} retries Number of retries on failure.
 * @param {number} delay Delay between retries in ms.
 * @returns {Promise<Object|Array|null>} The fetched data or null if an error occurs.
 */
async function fetchJson(url, cacheMap, key, retries = 3, delay = 500) {
    if (cacheMap.has(key)) {
        // console.log(`Returning data for ${key} from cache.`);
        return cacheMap.get(key);
    }

    for (let i = 0; i < retries; i++) {
        try {
            // console.log(`Fetching data from: ${url} (Attempt ${i + 1}/${retries})`);
            const response = await fetch(url);
            if (!response.ok) {
                // Log specific status codes
                if (response.status === 404) {
                    console.warn(`404 Not Found for ${url}. This might be expected for some endpoints (e.g., empty drafts).`);
                    return null; // For 404, usually means no data, so return null without retrying
                }
                console.error(`Error fetching data from ${url}: ${response.status} ${response.statusText}. Retrying...`);
                // For other non-OK responses, proceed to retry
            } else {
                const data = await response.json();
                cacheMap.set(key, data);
                return data;
            }
        } catch (error) {
            console.error(`Failed to fetch data from ${url} (Attempt ${i + 1}/${retries}):`, error);
        }
        if (i < retries - 1) {
            await new Promise(res => setTimeout(res, delay * (i + 1))); // Exponential backoff
        }
    }
    console.error(`Failed to fetch data from ${url} after ${retries} attempts.`);
    return null;
}

/**
 * Fetches league details for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Object|null>} A promise that resolves to the league details object, or null if an error occurs.
 */
export async function fetchLeagueDetails(leagueId) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}`, leagueDetailsCache, `league-${leagueId}`);
}

/**
 * Fetches ALL user data for a given league ID.
 * This directly uses the /users endpoint for efficiency.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user objects, or an empty array if an error occurs.
 */
export async function fetchUsersData(leagueId) {
    // Correctly fetch all users for a league, not individual users
    const users = await fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/users`, usersCache, `users-${leagueId}`);
    return users || [];
}

/**
 * Fetches raw rosters data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of raw roster data objects, or an empty array if an error occurs.
 */
export async function fetchRosterData(leagueId) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, rostersCache, `rosters-${leagueId}`);
}

/**
 * Fetches roster data for a given league ID and enriches it with user details.
 * This is now more streamlined as fetchUsersData directly fetches all users.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of enriched roster data objects.
 */
export async function fetchRostersWithDetails(leagueId) {
    // Combine raw rosters with user data
    const [rosters, users] = await Promise.all([
        fetchRosterData(leagueId),
        fetchUsersData(leagueId) // This is now efficient
    ]);

    if (!rosters || !users) {
        console.warn(`Missing rosters or users data for league ${leagueId}. Cannot enrich rosters.`);
        return [];
    }

    const userMap = new Map(users.map(user => [user.user_id, user]));

    const enrichedRosters = rosters.map(roster => {
        const owner = userMap.get(roster.owner_id);
        return {
            ...roster,
            ownerDisplayName: owner ? owner.display_name : 'Unknown Owner',
            ownerTeamName: (owner && owner.metadata && owner.metadata.team_name) ? owner.metadata.team_name : (owner ? owner.display_name : 'Unknown Team'),
            ownerAvatar: owner ? getSleeperAvatarUrl(owner.avatar) : getSleeperAvatarUrl(null)
        };
    });
    return enrichedRosters;
}

/**
 * Fetches NFL players data.
 * @returns {Promise<Object>} A promise that resolves to an object of NFL player data, keyed by player ID.
 */
export async function fetchNFLPlayers() {
    return fetchJson('https://api.sleeper.app/v1/players/nfl', nflPlayersCache, 'nfl-players');
}

/**
 * Fetches transaction data for a specific week in a given league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction objects.
 */
export async function fetchTransactionsForWeek(leagueId, week) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`, transactionsCache, `transactions-${leagueId}-${week}`);
}

/**
 * Fetches league drafts data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft objects.
 */
export async function fetchLeagueDrafts(leagueId) {
    // Drafts rarely change, can be cached longer. Using a dedicated map for this.
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/drafts`, new Map(), `drafts-${leagueId}`);
}

/**
 * Fetches the winners bracket data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects.
 */
export async function fetchWinnersBracket(leagueId) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`, winnersBracketCache, `winners-bracket-${leagueId}`);
}

/**
 * Fetches the losers bracket data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects.
 */
export async function fetchLosersBracket(leagueId) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/losers_bracket`, losersBracketCache, `losers-bracket-${leagueId}`);
}

/**
 * Gets the Sleeper player headshot URL. Provides a placeholder if no player ID.
 * @param {string} playerId The ID of the player.
 * @returns {string} The URL to the player's headshot or a placeholder.
 */
export const getSleeperPlayerHeadshotUrl = (playerId) => {
    return playerId ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : 'https://placehold.co/150x150/cccccc/000000?text=No+Headshot';
};

/**
 * Gets the Sleeper avatar URL for a user. Provides a placeholder if no avatar ID.
 * @param {string} avatarId The avatar ID from user data.
 * @returns {string} The URL to the user's avatar or a placeholder.
 */
export const getSleeperAvatarUrl = (avatarId) => {
    // Sleeper avatar IDs are typically hashes. If it's already a full URL, use it.
    if (avatarId && (avatarId.startsWith('http://') || avatarId.startsWith('https://'))) {
        return avatarId;
    }
    return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : 'https://sleepercdn.com/images/v2/icons/comissioner.png'; // Default placeholder
};

/**
 * Fetches all historical matchups for a league, traversing through previous seasons.
 * This function returns processed matchup data, ready for consumption by components.
 * It also returns a mapping of roster_id to owner_id and owner_id to display name for comprehensive mapping.
 *
 * @param {string} startingLeagueId The ID of the current (or starting) Sleeper league.
 * @returns {Promise<{
 * matchups: Array<Object>,
 * rosterToOwnerMap: Map<string, string>, // Maps roster_id to owner_id
 * ownerToDisplayNameMap: Map<string, string> // Maps owner_id to display name
 * }>} A promise that resolves to an object containing all historical matchup objects
 * and the necessary mapping data.
 */
export async function fetchAllHistoricalMatchups(startingLeagueId) {
    if (historicalMatchupsAggregatedCache.has(startingLeagueId)) {
        console.log(`Returning all historical matchups for starting league ${startingLeagueId} from aggregated cache.`);
        return historicalMatchupsAggregatedCache.get(startingLeagueId);
    }

    let allMatchups = [];
    let rosterToOwnerMap = new Map();
    let ownerToDisplayNameMap = new Map();
    let currentLeagueId = startingLeagueId;

    while (currentLeagueId) {
        console.log(`Processing league ID: ${currentLeagueId}`);
        const [leagueDetails, users, rosters] = await Promise.all([
            fetchLeagueDetails(currentLeagueId),
            fetchUsersData(currentLeagueId),
            fetchRosterData(currentLeagueId) // Fetch raw rosters here for mapping
        ]);

        if (!leagueDetails) {
            console.error(`Failed to fetch details for league ID: ${currentLeagueId}. Stopping history traversal.`);
            break;
        }

        // Populate ownerToDisplayNameMap and rosterToOwnerMap for the current league
        users.forEach(user => {
            // Prioritize custom nickname from NICKNAME_TO_SLEEPER_USER if available
            const displayName = NICKNAME_TO_SLEEPER_USER[user.user_id] || (user.metadata && user.metadata.team_name) || user.display_name;
            ownerToDisplayNameMap.set(user.user_id, displayName);
        });

        rosters.forEach(roster => {
            if (roster.roster_id && roster.owner_id) {
                rosterToOwnerMap.set(roster.roster_id.toString(), roster.owner_id);
            }
        });

        const season = leagueDetails.season;
        const regularSeasonWeeks = leagueDetails.settings?.playoff_week_start
            ? leagueDetails.settings.playoff_week_start - 1
            : leagueDetails.settings?.last_idx; // Fallback if playoff_week_start isn't set

        console.log(`Fetching regular season matchups for ${season} (Weeks 1 to ${regularSeasonWeeks || 'N/A'})`);
        for (let week = 1; week <= regularSeasonWeeks; week++) {
            const weekMatchups = await fetchJson(
                `https://api.sleeper.app/v1/league/${currentLeagueId}/matchups/${week}`,
                matchupDataCache,
                `${currentLeagueId}-matchups-${week}`
            );

            if (weekMatchups && weekMatchups.length > 0) {
                // Group matchups by matchup_id to find pairs
                const groupedByMatchupId = new Map();
                weekMatchups.forEach(match => {
                    if (!groupedByMatchupId.has(match.matchup_id)) {
                        groupedByMatchupId.set(match.matchup_id, []);
                    }
                    groupedByMatchupId.get(match.matchup_id).push(match);
                });

                groupedByMatchupId.forEach(matchGroup => {
                    if (matchGroup.length === 2) { // Standard head-to-head matchup
                        const team1Raw = matchGroup[0];
                        const team2Raw = matchGroup[1]; // Assumes two entries per matchup_id

                        allMatchups.push({
                            year: parseInt(season),
                            week: week,
                            league_id: currentLeagueId,
                            roster_id_1: team1Raw.roster_id,
                            team1Score: team1Raw.points,
                            roster_id_2: team2Raw.roster_id,
                            team2Score: team2Raw.points,
                            matchup_id: team1Raw.matchup_id,
                            playoffs: false,
                            regSeason: true, // Mark as regular season
                            finalSeedingGame: null,
                            custom_points_1: team1Raw.custom_points || 0,
                            custom_points_2: team2Raw.custom_points || 0,
                        });
                    } else if (matchGroup.length === 1 && matchGroup[0].matchup_id === null) {
                        // This might be a bye week or points-only week where matchup_id is null
                        const teamRaw = matchGroup[0];
                         allMatchups.push({
                            year: parseInt(season),
                            week: week,
                            league_id: currentLeagueId,
                            roster_id_1: teamRaw.roster_id,
                            team1Score: teamRaw.points,
                            roster_id_2: null, // No opponent
                            team2Score: null,
                            matchup_id: null,
                            playoffs: false,
                            regSeason: true,
                            pointsOnlyBye: true, // Mark as points-only bye
                            finalSeedingGame: null,
                            custom_points_1: teamRaw.custom_points || 0,
                            custom_points_2: null,
                        });
                    } else {
                        console.warn(`Unusual matchup group size (${matchGroup.length}) for league ${currentLeagueId}, season ${season}, week ${week}, matchup_id ${matchGroup[0]?.matchup_id}.`);
                    }
                });
            } else {
                // console.log(`No matchups found for league ${currentLeagueId}, season ${season}, week ${week}.`);
            }
        }

        console.log(`Fetching playoff brackets for ${season}`);
        const winnersBracket = await fetchWinnersBracket(currentLeagueId);
        const losersBracket = await fetchLosersBracket(currentLeagueId);

        const processBracket = (bracket, isLosersBracket = false) => {
            if (!bracket) return;
            bracket.forEach(match => {
                if (match.r && match.p && typeof match.s === 'number' && typeof match.s_p === 'number' && match.m && match.w) {
                    // Match.w in bracket data typically represents the playoff week number
                    const playoffWeek = match.w;
                    allMatchups.push({
                        year: parseInt(season),
                        week: playoffWeek,
                        league_id: currentLeagueId,
                        roster_id_1: match.r,
                        team1Score: match.s,
                        roster_id_2: match.p,
                        team2Score: match.s_p,
                        matchup_id: match.m, // Sleeper bracket matchup ID
                        playoffs: true,
                        regSeason: false, // Not regular season
                        // You'll need more logic here if 'finalSeedingGame' maps to specific bracket types
                        // For example, if match.t === 1 in winners bracket it could be championship
                        // This might also be determined by the bracket structure and max playoff week.
                        finalSeedingGame: null, // Placeholder - needs more sophisticated logic if exact place is required
                        isLosersBracket: isLosersBracket,
                    });
                }
            });
        };

        processBracket(winnersBracket, false);
        processBracket(losersBracket, true);

        currentLeagueId = leagueDetails.previous_league_id; // Move to the previous season's league
    }

    // Sort all matchups by year and then by week for chronological processing
    allMatchups.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
    });

    const result = {
        matchups: allMatchups,
        rosterToOwnerMap: rosterToOwnerMap,
        ownerToDisplayNameMap: ownerToDisplayNameMap
    };
    historicalMatchupsAggregatedCache.set(startingLeagueId, result);
    return result;
}
