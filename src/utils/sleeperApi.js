// src/utils/sleeperApi.js

// Easily configurable current league ID - moved from config.js for direct access if needed, though App.js pulls it from config.
export { CURRENT_LEAGUE_ID, NICKNAME_TO_SLEEPER_USER } from '../config';

// Centralized map linking your internal team names (e.g., last names) to Sleeper User IDs.
// This is used for functions that need to map display names back to Sleeper IDs,
// or for initial population if you want a direct map.
// For display, `NICKNAME_TO_SLEEPER_USER` in config.js is preferred.
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
export const RETIRED_MANAGERS = [
    // Add retired manager Sleeper User IDs or display names if needed for specific logic
    // 'RetiredManagerUserId1',
];

// Caching mechanisms for various API calls to reduce redundant fetches
const leagueDetailsCache = new Map();
const usersCache = new Map();
const rostersCache = new Map();
const nflPlayersCache = new Map();
const transactionsCache = new Map();
const winnersBracketCache = new Map();
const losersBracketCache = new Map();
const matchupDataCache = new Map(); // Cache for individual week matchups
const historicalMatchupsAggregatedCache = new Map(); // New: Cache for the entire aggregated historical matchups result

/**
 * Helper to fetch JSON safely with caching.
 * @param {string} url The URL to fetch.
 * @param {Map} cacheMap The cache map to use.
 * @param {string} key The key for the cache.
 * @returns {Promise<Object|Array|null>} The fetched data or null if an error occurs.
 */
async function fetchJson(url, cacheMap, key) {
    if (cacheMap.has(key)) {
        // console.log(`Returning data for ${key} from cache.`);
        return cacheMap.get(key);
    }
    try {
        // console.log(`Fetching data from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching data from ${url}: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        cacheMap.set(key, data);
        return data;
    } catch (error) {
        console.error(`Failed to fetch data from ${url}:`, error);
        return null;
    }
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
 * Fetches user data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user objects, or an empty array if an error occurs.
 */
export async function fetchUsersData(leagueId = CURRENT_LEAGUE_ID) {
    // Note: Users are typically global or can be fetched per league.
    // For historical purposes, fetching users linked to a league's rosters is more reliable.
    // However, the Sleeper API /users endpoint needs user IDs directly,
    // so we usually get user IDs from rosters first, or from league details if provided.
    // If you need *all* users ever, it's more complex. For a specific league's users:
    const rosters = await fetchRostersWithDetails(leagueId);
    if (!rosters) return [];
    const userIds = rosters.map(r => r.owner_id).filter(id => id);
    const userPromises = userIds.map(id => fetchJson(`https://api.sleeper.app/v1/user/${id}`, usersCache, `user-${id}`));
    const users = await Promise.all(userPromises);
    return users.filter(user => user !== null);
}

/**
 * Fetches rosters data with owner_id (user_id) for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of roster objects, or an empty array if an error occurs.
 */
export async function fetchRostersWithDetails(leagueId) {
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, rostersCache, `rosters-${leagueId}`);
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
    return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/drafts`, new Map(), `drafts-${leagueId}`); // Don't cache drafts too aggressively as they change
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
 * Gets the Sleeper player headshot URL.
 * @param {string} playerId The ID of the player.
 * @returns {string} The URL to the player's headshot.
 */
export const getSleeperPlayerHeadshotUrl = (playerId) => {
    return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
};

/**
 * Gets the Sleeper avatar URL for a user.
 * @param {string} avatarId The avatar ID from user data.
 * @returns {string} The URL to the user's avatar.
 */
export const getSleeperAvatarUrl = (avatarId) => {
    return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : 'https://sleepercdn.com/images/v2/icons/comissioner.png'; // Default if no avatar
};

/**
 * Fetches all historical matchups for a league, traversing through previous seasons.
 * This function will replace the Google Sheets API for historical matchups.
 * It returns raw matchup data with roster_ids, which App.js will then map to display names.
 *
 * @param {string} startingLeagueId The ID of the current (or starting) Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of all historical matchup objects.
 */
export async function fetchAllHistoricalMatchups(startingLeagueId) {
    if (historicalMatchupsAggregatedCache.has(startingLeagueId)) {
        console.log(`Returning all historical matchups for starting league ${startingLeagueId} from aggregated cache.`);
        return historicalMatchupsAggregatedCache.get(startingLeagueId);
    }

    let allMatchups = [];
    let currentLeagueId = startingLeagueId;

    while (currentLeagueId) {
        console.log(`Processing league ID: ${currentLeagueId}`);
        const leagueDetails = await fetchLeagueDetails(currentLeagueId);
        if (!leagueDetails) {
            console.error(`Failed to fetch details for league ID: ${currentLeagueId}. Stopping history traversal.`);
            break;
        }

        const season = leagueDetails.season;
        const regularSeasonWeeks = leagueDetails.settings?.playoff_week_start
            ? leagueDetails.settings.playoff_week_start - 1
            : leagueDetails.settings?.last_idx; // Fallback

        console.log(`Fetching regular season matchups for ${season} (Weeks 1 to ${regularSeasonWeeks})`);
        for (let week = 1; week <= regularSeasonWeeks; week++) {
            const weekMatchups = await fetchJson(
                `https://api.sleeper.app/v1/league/${currentLeagueId}/matchups/${week}`,
                matchupDataCache,
                `${currentLeagueId}-matchups-${week}`
            );

            if (weekMatchups) {
                weekMatchups.forEach(match => {
                    // Each match has data for one team. We need to pair them up by matchup_id.
                    // This is a common pattern for Sleeper matchup data.
                    const existingMatchupIndex = allMatchups.findIndex(
                        m => m.matchup_id === match.matchup_id && m.year === season && m.week === week && m.league_id === currentLeagueId && m.roster_id_1 && !m.roster_id_2
                    );

                    if (existingMatchupIndex !== -1) {
                        // Found the other half of the matchup
                        const existingMatch = allMatchups[existingMatchupIndex];
                        existingMatch.roster_id_2 = match.roster_id;
                        existingMatch.team2Score = match.points;
                        // Assuming team1 and team2 were set correctly on the first half
                    } else {
                        // This is the first half of a matchup
                        allMatchups.push({
                            year: parseInt(season),
                            week: week,
                            league_id: currentLeagueId, // Store league_id to help with context
                            roster_id_1: match.roster_id,
                            team1Score: match.points,
                            // team2 and team2Score will be filled by its counterpart
                            matchup_id: match.matchup_id,
                            playoffs: false,
                            finalSeedingGame: null,
                            // You might want to include custom_points if used
                            custom_points_1: match.custom_points,
                        });
                    }
                });
            }
        }

        console.log(`Fetching playoff brackets for ${season}`);
        const winnersBracket = await fetchWinnersBracket(currentLeagueId);
        const losersBracket = await fetchLosersBracket(currentLeagueId);

        // Process playoff matchups. Bracket data is usually more consolidated.
        // Winner and loser bracket games often have 'r' (roster ID), 'p' (opponent roster ID), 's' (score), 's_p' (opponent score), 'm' (matchup ID), 'w' (week played in)
        const processBracket = (bracket, isLosersBracket = false) => {
            if (!bracket) return;
            bracket.forEach(match => {
                // Ensure valid data for bracket games
                if (match.r && match.p && typeof match.s === 'number' && typeof match.s_p === 'number') {
                     // Determine the playoff week. Sleeper bracket 'w' key typically indicates the week.
                    const playoffWeek = match.w || match.l; // 'w' for winner bracket, 'l' for loser bracket
                    if (playoffWeek === undefined || isNaN(playoffWeek)) {
                         console.warn(`Skipping bracket game with undefined or invalid week for league ${currentLeagueId}, matchup ${match.m}`);
                         return;
                    }

                    allMatchups.push({
                        year: parseInt(season),
                        week: playoffWeek, // Playoff week number
                        league_id: currentLeagueId,
                        roster_id_1: match.r,
                        team1Score: match.s,
                        roster_id_2: match.p,
                        team2Score: match.s_p,
                        matchup_id: match.m, // Sleeper bracket matchup ID
                        playoffs: true,
                        // Determine finalSeedingGame based on actual playoff structure (e.g., final round, 3rd place game etc.)
                        // This might require more complex logic based on bracket structure and desired "place"
                        // For simplicity, we can default it or derive it based on the matchup ID or round.
                        // Example: 1st place is usually the final game of the winners bracket.
                        // You'd need to map match.r and match.p to team names later in App.js
                        finalSeedingGame: (winnersBracket && winnersBracket.length > 0 && match.m === winnersBracket[winnersBracket.length - 1]?.m && winnersBracket.length === 15) ? 1 : null, // Very basic check for championship
                        isLosersBracket: isLosersBracket // Useful for specific styling/logic
                    });
                }
            });
        };

        processBracket(winnersBracket, false);
        processBracket(losersBracket, true);

        currentLeagueId = leagueDetails.previous_league_id; // Move to the previous season's league
    }

    // Sort all matchups by year and then by week for chronological processing in calculations.
    allMatchups.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
    });

    historicalMatchupsAggregatedCache.set(startingLeagueId, allMatchups);
    return allMatchups;
}
