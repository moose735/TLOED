// src/utils/sleeperApi.js

// Import CURRENT_LEAGUE_ID from your config file.
// Ensure that 'config.js' is in the parent directory of 'utils', or adjust the path accordingly.
import { CURRENT_LEAGUE_ID } from '../config';

// Define the base URL for the Sleeper API.
const BASE_URL = 'https://api.sleeper.app/v1';

// --- Centralized Caching and Fetching Mechanism ---
// This will replace the individual Map caches for API responses
// and provide expiry.
const inMemoryCache = new Map(); // Stores { data: any, timestamp: number, expirationHours: number }

/**
 * Generic function to fetch data from Sleeper API with in-memory caching and expiry.
 * @param {string} url The API endpoint URL.
 * @param {string} cacheKey A unique key for caching this specific data.
 * @param {number} [expirationHours=24] Number of hours after which the cache expires.
 * @returns {Promise<any>} The fetched or cached data.
 */
async function fetchDataWithCache(url, cacheKey, expirationHours = 24) {
    const cachedEntry = inMemoryCache.get(cacheKey);
    const now = Date.now();
    const expiryMs = expirationHours * 60 * 60 * 1000;

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        // console.log(`Using cached data for ${cacheKey}.`);
        return cachedEntry.data;
    }

    console.log(`Fetching ${cacheKey} from API (cache expired or not found)...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url} - ${response.statusText}`);
        }
        const data = await response.json();
        inMemoryCache.set(cacheKey, { data, timestamp: now, expirationHours });
        console.log(`Successfully fetched and cached ${cacheKey}.`);
        return data;
    } catch (error) {
        console.error(`Error fetching ${cacheKey} from ${url}:`, error);
        inMemoryCache.delete(cacheKey); // Clear potentially stale/failed cache entry
        throw error; // Re-throw to be handled by the calling function
    }
}

// --- Image URL Helpers ---

/**
 * Constructs the full URL for a Sleeper user avatar.
 * It intelligently handles both avatar hashes and full URLs found in metadata.
 * @param {string} avatarIdentifier The avatar hash or full URL from Sleeper user data.
 * @returns {string} The full URL to the avatar image, or a placeholder if identifier is missing.
 */
export const getSleeperAvatarUrl = (avatarIdentifier) => {
    if (!avatarIdentifier) {
        return 'https://placehold.co/150x150/cccccc/000000?text=No+Avatar';
    }

    // If the identifier already looks like a full URL, return it directly
    if (avatarIdentifier.startsWith('http://') || avatarIdentifier.startsWith('https://')) {
        return avatarIdentifier;
    }

    // Otherwise, assume it's an avatar hash and construct the URL
    return `https://sleepercdn.com/avatars/thumb_${avatarIdentifier}`;
};

/**
 * Constructs the full URL for a Sleeper NFL player headshot.
 * @param {string} playerId The ID of the NFL player.
 * @returns {string} The full URL to the player's headshot image, or a placeholder if ID is missing.
 */
export const getSleeperPlayerHeadshotUrl = (playerId) => {
    if (!playerId) {
        return 'https://placehold.co/150x150/cccccc/000000?text=No+Headshot';
    }
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
};

// --- Core Sleeper API Fetchers (now using fetchDataWithCache) ---

/**
 * Fetches league details from the Sleeper API for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Object|null>} A promise that resolves to the league data, or null if an error occurs.
 */
export async function fetchLeagueDetails(leagueId) {
    if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
        console.warn(`Attempted to fetch league details with an invalid league ID: ${leagueId}`);
        return null;
    }
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}`, `league_details_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch league details for ID ${leagueId}:`, error);
        return null;
    }
}

/**
 * Fetches league data for the current season and all available previous seasons.
 * It recursively fetches previous league details using previous_league_id until no more are found.
 *
 * @param {string} currentLeagueId The ID of the current season's league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of league data objects,
 * ordered from current season to the oldest available season.
 */
export async function fetchLeagueData(currentLeagueId) {
    const leagueData = [];
    let currentId = currentLeagueId;

    while (currentId && typeof currentId === 'string' && currentId !== '0') {
        const details = await fetchLeagueDetails(currentId); // Uses the cached fetchLeagueDetails
        if (details) {
            leagueData.push(details);
            currentId = details.previous_league_id;
        } else {
            break;
        }
    }
    return leagueData;
}

/**
 * Fetches user details for a given league ID from the Sleeper API.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user data objects, or an empty array if an error occurs.
 */
export async function fetchUsersData(leagueId) {
    try {
        const data = await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/users`, `league_users_${leagueId}`, 24);
        const processedUsers = data.map(user => {
            let finalAvatarIdentifier = '';
            if (user.metadata && typeof user.metadata.avatar === 'string' && user.metadata.avatar.trim() !== '') {
                finalAvatarIdentifier = user.metadata.avatar;
            } else {
                finalAvatarIdentifier = user.avatar;
            }
            return {
                userId: user.user_id,
                displayName: user.display_name,
                avatar: getSleeperAvatarUrl(finalAvatarIdentifier),
                teamName: user.metadata ? user.metadata.team_name : user.display_name,
            };
        });
        return processedUsers;
    } catch (error) {
        console.error(`Failed to fetch user details for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches NFL player data from the Sleeper API, using the centralized caching.
 * @returns {Promise<Object>} A promise that resolves to an object containing all NFL player data,
 * keyed by player ID. Returns an empty object on error.
 */
export async function fetchNFLPlayers() {
    try {
        return await fetchDataWithCache(`${BASE_URL}/players/nfl`, 'nfl_players', 72); // Cache for 72 hours
    } catch (error) {
        console.error('Failed to fetch NFL players:', error);
        return {};
    }
}

/**
 * Fetches NFL state data from the Sleeper API, using the centralized caching.
 * @returns {Promise<Object>} A promise that resolves to an object containing NFL state data.
 * Returns an empty object on error.
 */
export async function fetchNFLState() {
    try {
        return await fetchDataWithCache(`${BASE_URL}/state/nfl`, 'nfl_state', 1); // Cache for 1 hour
    } catch (error) {
        console.error('Failed to fetch NFL state:', error);
        return {};
    }
}

/**
 * Fetches raw roster data for a given league ID from the Sleeper API.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of raw roster data objects, or an empty array if an error occurs.
 */
export async function fetchRosterData(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/rosters`, `raw_rosters_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch raw roster data for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches roster data for a given league ID and enriches it with user/team details.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of enriched roster data objects.
 * Each roster object will include 'ownerDisplayName' and 'ownerTeamName' properties.
 * Returns an empty array on error.
 */
export async function fetchRostersWithDetails(leagueId) {
    // Unique cache key for enriched rosters
    const cacheKey = `enriched_rosters_${leagueId}`;
    const cachedEntry = inMemoryCache.get(cacheKey);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours expiry for enriched rosters

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        console.log(`Returning enriched roster data for league ${leagueId} from cache.`);
        return cachedEntry.data;
    }

    console.log(`Fetching and enriching roster data for league ID: ${leagueId}...`);
    try {
        const [rosters, users] = await Promise.all([
            fetchRosterData(leagueId), // This already uses fetchDataWithCache for raw rosters
            fetchUsersData(leagueId)   // This already uses fetchDataWithCache for users
        ]);

        if (!rosters || rosters.length === 0) {
            console.warn(`No raw roster data found for league ${leagueId}.`);
            return [];
        }
        if (!users || users.length === 0) {
            console.warn(`No user data found for league ${leagueId}. Rosters cannot be fully enriched.`);
            const result = rosters.map(roster => ({
                ...roster,
                ownerDisplayName: 'Unknown Owner',
                ownerTeamName: 'Unknown Team',
                ownerAvatar: getSleeperAvatarUrl(null)
            }));
            inMemoryCache.set(cacheKey, { data: result, timestamp: now, expirationHours: 24 });
            return result;
        }

        const userMap = new Map(users.map(user => [user.userId, user]));

        const enrichedRosters = rosters.map(roster => {
            const owner = userMap.get(roster.owner_id);
            return {
                ...roster,
                ownerDisplayName: owner ? owner.displayName : 'Unknown Owner',
                ownerTeamName: owner ? owner.teamName : 'Unknown Team',
                ownerAvatar: owner ? owner.avatar : getSleeperAvatarUrl(null)
            };
        });

        inMemoryCache.set(cacheKey, { data: enrichedRosters, timestamp: now, expirationHours: 24 });
        console.log(`Successfully fetched and enriched roster data for league ID: ${leagueId}.`);
        return enrichedRosters;

    } catch (error) {
        console.error(`Failed to fetch and enrich roster data for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Helper function to process raw matchup data into a structured format (team1 vs team2).
 * Sleeper's /matchups endpoint returns two entries for each matchup (one per team).
 * This function groups them by matchup_id.
 * @param {Array<Object>} rawMatchups An array of raw matchup objects from the Sleeper API.
 * @returns {Array<Object>} An array of structured matchup objects, each containing team1 and team2 details.
 */
function processRawMatchups(rawMatchups) {
    const groupedMatchups = rawMatchups.reduce((acc, current) => {
        if (!acc[current.matchup_id]) {
            acc[current.matchup_id] = { team1: null, team2: null, matchup_id: current.matchup_id };
        }

        if (acc[current.matchup_id].team1 === null) {
            acc[current.matchup_id].team1 = {
                roster_id: current.roster_id,
                points: current.points,
            };
        } else {
            // Optional: Ensure consistent ordering (e.g., lower roster_id as team1)
            if (current.roster_id < acc[current.matchup_id].team1.roster_id) {
                acc[current.matchup_id].team2 = acc[current.matchup_id].team1;
                acc[current.matchup_id].team1 = {
                    roster_id: current.roster_id,
                    points: current.points,
                };
            } else {
                acc[current.matchup_id].team2 = {
                    roster_id: current.roster_id,
                    points: current.points,
                };
            }
        }
        return acc;
    }, {});

    const simplifiedMatchups = Object.values(groupedMatchups).map(grouped => {
        const team1 = grouped.team1;
        const team2 = grouped.team2;

        if (!team1 || !team2) {
            // console.warn(`Incomplete matchup found for ID ${grouped.matchup_id}. Skipping.`);
            return null;
        }

        return {
            matchup_id: grouped.matchup_id,
            team1_roster_id: team1.roster_id,
            team1_score: team1.points,
            team2_roster_id: team2.roster_id,
            team2_score: team2.points,
        };
    }).filter(Boolean);

    return simplifiedMatchups;
}

/**
 * Fetches matchup data for a specific league across a given range of regular season weeks.
 * This is a helper function for `fetchAllHistoricalMatchups`.
 * Uses the centralized caching.
 *
 * @param {string} leagueId The ID of the Sleeper league to fetch matchups for.
 * @param {number} regularSeasonWeeks The total number of regular season weeks for this league.
 * Matchups will be fetched from Week 1 up to this number.
 * @returns {Promise<Object>} A promise that resolves to an object.
 * Keys are week numbers (e.g., '1', '2'), and values are arrays
 * containing the **processed** matchup data for that specific week.
 */
async function fetchMatchupsForLeague(leagueId, regularSeasonWeeks) {
    const leagueMatchups = {}; // Object to store matchups for the current league, keyed by week.

    // Using Promise.all to fetch all weeks concurrently for a given league
    const fetchPromises = [];
    for (let week = 1; week <= regularSeasonWeeks; week++) {
        fetchPromises.push((async (w) => {
            try {
                const rawMatchups = await fetchDataWithCache(
                    `${BASE_URL}/league/${leagueId}/matchups/${w}`,
                    `league_${leagueId}_matchups_week_${w}`,
                    24 // Cache for 24 hours
                );
                if (rawMatchups && rawMatchups.length > 0) {
                    leagueMatchups[w] = processRawMatchups(rawMatchups);
                } else {
                    leagueMatchups[w] = [];
                }
            } catch (error) {
                console.error(`Failed to fetch matchups for league ${leagueId}, Week ${w}:`, error);
                leagueMatchups[w] = [];
            }
        })(week)); // Immediately invoke the async function to create the promise
    }

    await Promise.all(fetchPromises); // Wait for all week fetches to complete

    return leagueMatchups;
}


/**
 * Fetches all historical matchup data for the current league and all its previous seasons.
 * Data is fetched once and then cached in memory for subsequent calls within the same session.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all historical matchups,
 * structured as {
 * matchupsBySeason: { "season_year": { "week_number": [processed_matchup_data], ... }, ... },
 * rostersBySeason: { "season_year": [enriched_roster_data], ... },
 * leaguesMetadataBySeason: { "season_year": { league_details_object }, ... }
 * }.
 * Returns the cached data if already fetched.
 */
export async function fetchAllHistoricalMatchups() {
    const CACHE_KEY = 'all_historical_matchups_details';
    const cachedData = inMemoryCache.get(CACHE_KEY);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours for full historical data

    if (cachedData && (now - cachedData.timestamp < expiryMs)) {
        console.log('Returning historical matchups, rosters, and league metadata from cache.');
        return cachedData.data;
    }

    console.log('Fetching all historical matchup data for the first time...');
    const allHistoricalData = {
        matchupsBySeason: {},
        rostersBySeason: {},
        leaguesMetadataBySeason: {}
    };

    try {
        // Use your existing fetchLeagueData to get the chain of leagues
        // This array is ordered from current to oldest
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);

        if (!leagues || leagues.length === 0) {
            console.error('No league data found for historical matchup fetching. Check CURRENT_LEAGUE_ID in config.js.');
            return allHistoricalData; // Return empty structure
        }

        // Process leagues in chronological order (oldest to newest) or reverse (newest to oldest)
        // For historical data, it's often more intuitive to process from newest to oldest as Sleeper's
        // previous_league_id links backwards from the current league.
        // The `leagues` array from `fetchLeagueData` is already ordered from current (newest) to oldest.
        for (const league of leagues) {
            const leagueId = league.league_id;
            const season = league.season;

            console.log(`Processing historical data for season: ${season} (League ID: ${leagueId})`);

            // Store league metadata
            allHistoricalData.leaguesMetadataBySeason[season] = league;

            // Fetch and store rosters for this specific season (leagueId)
            // Use your existing fetchRostersWithDetails, which already uses centralized caching
            const rosters = await fetchRostersWithDetails(leagueId);
            allHistoricalData.rostersBySeason[season] = rosters;

            // Determine regular season weeks (using playoff_start_week)
            let regularSeasonWeeks = 14; // Default
            if (league.settings && typeof league.settings.playoff_start_week === 'number' && league.settings.playoff_start_week > 1) {
                regularSeasonWeeks = league.settings.playoff_start_week - 1;
            }

            // Only fetch matchups if the season is in the past or current (has actually happened/started)
            // Get current year from NFL state if possible, otherwise use local date
            const nflState = await fetchNFLState(); // This is cached
            const currentNFLSeason = nflState?.season || new Date().getFullYear();

            // Only attempt to fetch matchups if the season is relevant
            if (parseInt(season) <= parseInt(currentNFLSeason)) {
                // Fetch and process matchups for this specific season (leagueId)
                // This uses the internal fetchMatchupsForLeague helper, which uses fetchDataWithCache
                const matchupsByWeek = await fetchMatchupsForLeague(leagueId, regularSeasonWeeks);
                allHistoricalData.matchupsBySeason[season] = matchupsByWeek;

                if (Object.keys(matchupsByWeek).length === 0) {
                    console.warn(`No matchups collected for active/past season ${season} (${leagueId}). This might be expected for early parts of a season.`);
                }
            } else {
                console.log(`Skipping matchup data for future season: ${season} (League ID: ${leagueId}).`);
                allHistoricalData.matchupsBySeason[season] = {}; // Ensure empty object for future seasons
            }
        }

        // Cache the fetched data before returning.
        inMemoryCache.set(CACHE_KEY, { data: allHistoricalData, timestamp: now, expirationHours: 24 });
        console.log('Successfully fetched and cached all historical data (matchups, rosters, league metadata).');
        return allHistoricalData;

    } catch (error) {
        console.error('Critical error in fetchAllHistoricalMatchups:', error);
        inMemoryCache.delete(CACHE_KEY); // Clear potentially bad cache
        return { matchupsBySeason: {}, rostersBySeason: {}, leaguesMetadataBySeason: {} }; // Return empty structure on error
    }
}

/**
 * Fetches transaction data for a specific league and week from the Sleeper API.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number for which to retrieve transactions.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction data objects, or an empty array if an error occurs.
 */
export async function fetchTransactionsForWeek(leagueId, week) {
    try {
        return await fetchDataWithCache(
            `${BASE_URL}/league/${leagueId}/transactions/${week}`,
            `transactions_league_${leagueId}_week_${week}`,
            24 // Cache for 24 hours
        );
    } catch (error) {
        console.error(`Failed to fetch transaction data for league ID ${leagueId}, Week ${week}:`, error);
        return [];
    }
}

/**
 * Fetches all drafts for a given league ID.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft objects, or an empty array if an error occurs.
 */
export async function fetchLeagueDrafts(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/drafts`, `league_drafts_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch league drafts for ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches details for a specific draft ID.
 * Uses the centralized caching.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Object|null>} A promise that resolves to the draft details object, or null if an error occurs.
 */
export async function fetchDraftDetails(draftId) {
    if (!draftId) return null;
    try {
        return await fetchDataWithCache(`${BASE_URL}/draft/${draftId}`, `draft_details_${draftId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch draft details for ID ${draftId}:`, error);
        return null;
    }
}

/**
 * Fetches all picks for a specific draft ID.
 * Uses the centralized caching.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft pick objects, or an empty array if an error occurs.
 */
export async function fetchDraftPicks(draftId) {
    if (!draftId) return [];
    try {
        return await fetchDataWithCache(`${BASE_URL}/draft/${draftId}/picks`, `draft_picks_${draftId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch draft picks for ID ${draftId}:`, error);
        return [];
    }
}

/**
 * Fetches all traded picks for a specific draft ID.
 * Uses the centralized caching.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of traded pick objects, or an empty array if an error occurs.
 */
export async function fetchTradedPicks(draftId) {
    if (!draftId) return [];
    try {
        return await fetchDataWithCache(`${BASE_URL}/draft/${draftId}/traded_picks`, `traded_picks_${draftId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch traded picks for ID ${draftId}:`, error);
        return [];
    }
}

/**
 * Fetches all draft history (details, picks, traded picks) for all leagues.
 * This is a comprehensive function that consolidates all draft-related data.
 * Uses the centralized caching.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all historical draft data,
 * structured as { season: { draftId: { details, picks, tradedPicks } } }.
 * Returns an empty object on error.
 */
export async function fetchAllDraftHistory() {
    const CACHE_KEY = 'all_draft_history';
    const cachedData = inMemoryCache.get(CACHE_KEY);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours expiry for full draft history

    if (cachedData && (now - cachedData.timestamp < expiryMs)) {
        console.log('Returning all draft history from cache.');
        return cachedData.data;
    }

    console.log('Fetching all draft history for the first time... ');
    const allDraftHistory = {};

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
        if (!leagues || leagues.length === 0) {
            console.warn('No league data found to fetch draft history. Check CURRENT_LEAGUE_ID in config.js.');
            return {};
        }

        for (const league of leagues) {
            const season = league.season;
            allDraftHistory[season] = {}; // Initialize season object

            const drafts = await fetchLeagueDrafts(league.league_id); // Uses centralized caching
            if (!drafts || drafts.length === 0) {
                console.log(`No drafts found for league ${league.league_id} (${season}).`);
                continue;
            }

            // Fetch details, picks, and traded picks concurrently for all drafts within this league (season)
            const draftPromises = drafts.map(async (draft) => {
                const draftId = draft.draft_id;
                // console.log(`Fetching data for draft ID: ${draftId} (Season: ${season})...`);
                const [details, picks, tradedPicks] = await Promise.all([
                    fetchDraftDetails(draftId),    // Uses centralized caching
                    fetchDraftPicks(draftId),      // Uses centralized caching
                    fetchTradedPicks(draftId)      // Uses centralized caching
                ]);
                return { draftId, details, picks, tradedPicks };
            });

            const draftResults = await Promise.all(draftPromises);

            draftResults.forEach(({ draftId, details, picks, tradedPicks }) => {
                allDraftHistory[season][draftId] = {
                    details: details,
                    picks: picks,
                    tradedPicks: tradedPicks
                };
            });
        }

        inMemoryCache.set(CACHE_KEY, { data: allDraftHistory, timestamp: now, expirationHours: 24 });
        console.log('Successfully fetched and cached all draft history.');
        return allDraftHistory;

    } catch (error) {
        console.error('Error fetching all draft history:', error);
        inMemoryCache.delete(CACHE_KEY); // Clear potentially bad cache
        return {};
    }
}

/**
 * Fetches the winners bracket data for a given league ID.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchWinnersBracket(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/winners_bracket`, `winners_bracket_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch winners bracket for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches the losers bracket data for a given league ID.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchLosersBracket(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/losers_bracket`, `losers_bracket_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch losers bracket for league ID ${leagueId}:`, error);
        return [];
    }
}
