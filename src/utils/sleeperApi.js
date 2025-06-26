// src/utils/sleeperApi.js

// Easily configurable current league ID
export const CURRENT_LEAGUE_ID = '1181984921049018368'; // This is the CURRENT league ID for the 2025 season

// Centralized map linking your internal team names (e.g., last names) to Sleeper User IDs.
// YOU MUST POPULATE THIS MAP WITH ALL YOUR TEAM NAMES AND THEIR CORRESPONDING SLEEPER USER IDs.
export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
  'Ainsworth': '783790952367169536',
  'Bjarnar': '783761299275382784',
  'Blumbergs': '783789717920534528',
  'Boilard': '783789669597999104',
  'Dembski': '783767734491127808',
  'Irwin': '467074573125283840',
  'Meer': '783778036578418688',
  'Neufeglise': '783763304463147008',
  'O\'Donoghue': '783758716272009216', // Fixed syntax: ensure commas between entries.
  'ODonoghue': '783758716272009216', // Added alias for "ODonoghue"
  'Randall': '783754997035876352',
  'Schmitt': '783761892693905408',
  'Tomczak': '787044291066380288',
};

// Set of internal team names for managers who are retired.
// Teams listed here will generally be excluded from current season calculations
// like Power Rankings, but their historical data will still be processed.
export const RETIRED_MANAGERS = new Set([
  // Add internal team names of retired managers here:
  // For example: 'RetiredManagerName1', 'RetiredManager2'
]);

// Internal cache for historical matchup data to avoid repeated API calls within the session.
let historicalMatchupsCache = null;

// Internal cache for roster data (per league ID) to avoid repeated API calls within the session.
const rosterDataCache = new Map();

// Internal cache for transaction data (per league ID and week)
// Structure: Map<leagueId, Map<week, transactionsArray>>
const transactionDataCache = new Map();

// Internal caches for draft data
// Structure: Map<leagueId, Array<drafts>>
const leagueDraftsCache = new Map();
// Structure: Map<draftId, draftDetailsObject>
const draftDetailsCache = new Map();
// Structure: Map<draftId, Array<draftPicks>>
const draftPicksCache = new Map();
// Structure: Map<draftId, Array<tradedPicks>>
const tradedPicksCache = new Map();
// Master cache for all historical draft data
let allDraftHistoryCache = null;

// Constants for NFL player cache in localStorage
const NFL_PLAYERS_CACHE_KEY = 'nflPlayersCache';
const NFL_PLAYERS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

/**
 * Fetches league details from the Sleeper API for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Object|null>} A promise that resolves to the league data, or null if an error occurs.
 */
export async function fetchLeagueDetails(leagueId) {
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    if (!response.ok) {
      console.error(`Error fetching league details for ID ${leagueId}: ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data;
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

  // Loop continues as long as there's a currentId to fetch
  while (currentId) {
    const details = await fetchLeagueDetails(currentId);
    if (details) {
      leagueData.push(details);
      currentId = details.previous_league_id; // Move to the previous league ID
    } else {
      // Stop if a league cannot be fetched (e.g., invalid ID, network error)
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
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    if (!response.ok) {
      console.error(`Error fetching user details for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();

    const processedUsers = data.map(user => {
      let finalAvatarIdentifier = ''; // This can be a hash or a full URL

      // Prefer the full URL from metadata if available
      if (user.metadata && typeof user.metadata.avatar === 'string' && user.metadata.avatar.trim() !== '') {
        finalAvatarIdentifier = user.metadata.avatar;
      } else {
        // Fallback to the main avatar hash
        finalAvatarIdentifier = user.avatar;
      }

      return {
        userId: user.user_id,
        displayName: user.display_name,
        // Pass the identifier (which might be a hash or a full URL) to getSleeperAvatarUrl
        avatar: getSleeperAvatarUrl(finalAvatarIdentifier),
        // 'team_name' is typically found in the user.metadata object for Sleeper
        teamName: user.metadata ? user.metadata.team_name : user.display_name, // Fallback to display_name if no team_name
      };
    });

    return processedUsers;
  } catch (error) {
    console.error(`Failed to fetch user details for league ID ${leagueId}:`, error);
    return [];
  }
}


/**
 * Fetches matchup data for a specific league across a given range of regular season weeks.
 * This is a helper function for `fetchAllHistoricalMatchups`.
 *
 * @param {string} leagueId The ID of the Sleeper league to fetch matchups for.
 * @param {number} regularSeasonWeeks The total number of regular season weeks for this league.
 * Matchups will be fetched from Week 1 up to this number.
 * @returns {Promise<Object>} A promise that resolves to an object.
 * Keys are week numbers (e.g., '1', '2'), and values are arrays
 * containing the matchup data for that specific week.
 */
async function fetchMatchupsForLeague(leagueId, regularSeasonWeeks) {
    const leagueMatchups = {}; // Object to store matchups for the current league, keyed by week.

    for (let week = 1; week <= regularSeasonWeeks; week++) {
        try {
            // console.log(`Fetching matchups for league ID: ${leagueId}, Week: ${week}...`); // Commented out for less console noise during normal app use
            const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);

            if (!response.ok) {
                console.warn(`Warning: Could not fetch matchups for league ${leagueId}, Week ${week}: ${response.statusText}`);
                continue;
            }

            const data = await response.json();
            if (data && data.length > 0) {
                leagueMatchups[week] = data;
            } else {
                // If a week returns no data, it often means the regular season for that league/year has ended.
                // We can break early as there's likely no more data for subsequent weeks.
                console.log(`No matchups found for league ${leagueId}, Week ${week}. Stopping further week fetches for this league.`);
                break;
            }
        } catch (error) {
            console.error(`Failed to fetch matchups for league ${leagueId}, Week ${week}:`, error);
            // Continue to the next week even if a specific week's fetch fails.
        }
    }
    return leagueMatchups;
}

/**
 * Fetches all historical matchup data for the current league and all its previous seasons.
 * Data is fetched once and then cached in memory for subsequent calls within the same session.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all historical matchups,
 * structured as { "season_year": { "week_number": [matchup_data], ... }, ... }.
 * Returns the cached data if already fetched.
 */
export async function fetchAllHistoricalMatchups() {
    // If data is already in cache, return it immediately.
    if (historicalMatchupsCache) {
        console.log('Returning historical matchups from cache.');
        return historicalMatchupsCache;
    }

    console.log('Fetching all historical matchup data for the first time...');
    const allHistoricalMatchups = {};

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);

        if (!leagues || leagues.length === 0) {
            console.error('No league data found for historical matchup fetching. Check CURRENT_LEAGUE_ID.');
            return {};
        }

        for (const league of leagues) {
            const leagueId = league.league_id;
            const season = league.season;

            // Determine the number of regular season weeks for the current league.
            // Sleeper API typically provides `settings.playoff_start_week`.
            // The regular season ends the week before playoffs start.
            let regularSeasonWeeks = 14; // Default based on common fantasy league lengths.

            if (league.settings && typeof league.settings.playoff_start_week === 'number' && league.settings.playoff_start_week > 1) {
                regularSeasonWeeks = league.settings.playoff_start_week - 1;
                console.log(`For season ${season} (${leagueId}), fetching ${regularSeasonWeeks} regular season weeks.`);
            } else {
                 console.log(`No valid 'playoff_start_week' found for league ${season} (${leagueId}). Defaulting to fetching ${regularSeasonWeeks} regular season weeks.`);
            }

            const matchups = await fetchMatchupsForLeague(leagueId, regularSeasonWeeks);

            if (Object.keys(matchups).length > 0) {
                allHistoricalMatchups[season] = matchups;
            } else {
                console.warn(`No matchups collected for season ${season} (${leagueId}).`);
            }
        }

        // Cache the fetched data before returning.
        historicalMatchupsCache = allHistoricalMatchups;
        console.log('Successfully fetched and cached all historical matchup data.');
        return allHistoricalMatchups;

    } catch (error) {
        console.error('Error fetching all historical matchups:', error);
        return {}; // Return empty object on error
    }
}

/**
 * Fetches NFL player data from the Sleeper API, using localStorage for daily caching.
 * This function will only hit the Sleeper API once every 24 hours.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all NFL player data,
 * keyed by player ID. Returns an empty object on error.
 */
export async function fetchNFLPlayers() {
    try {
        const cachedDataString = localStorage.getItem(NFL_PLAYERS_CACHE_KEY);
        const now = Date.now();

        if (cachedDataString) {
            const cachedData = JSON.parse(cachedDataString);
            // Check if the cached data exists and is still valid (less than 24 hours old)
            if (cachedData.timestamp && (now - cachedData.timestamp < NFL_PLAYERS_CACHE_EXPIRY_MS)) {
                console.log('Returning NFL players from localStorage cache (still valid).');
                return cachedData.players;
            }
        }

        console.log('Fetching NFL players from Sleeper API (cache expired or not found)...');
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');

        if (!response.ok) {
            console.error(`Error fetching NFL players: ${response.statusText}`);
            return {};
        }

        const players = await response.json();

        // Store the new players data and the current timestamp in localStorage
        localStorage.setItem(NFL_PLAYERS_CACHE_KEY, JSON.stringify({
            players,
            timestamp: now
        }));

        console.log('Successfully fetched and cached NFL players in localStorage.');
        return players;

    } catch (error) {
        console.error('Failed to fetch or cache NFL players:', error);
        // Clear corrupted cache in case of parsing errors or other issues
        localStorage.removeItem(NFL_PLAYERS_CACHE_KEY);
        return {};
    }
}

/**
 * Fetches raw roster data for a given league ID from the Sleeper API.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of raw roster data objects, or an empty array if an error occurs.
 */
export async function fetchRosterData(leagueId) {
    try {
        console.log(`Fetching raw roster data for league ID: ${leagueId}...`);
        const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);

        if (!response.ok) {
            console.error(`Error fetching raw roster data for league ID ${leagueId}: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        console.log(`Successfully fetched raw roster data for league ID: ${leagueId}.`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch raw roster data for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches roster data for a given league ID and enriches it with user/team details.
 * Data is fetched once per league ID and then cached in memory for subsequent calls within the same session.
 *
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of enriched roster data objects.
 * Each roster object will include 'ownerDisplayName' and 'ownerTeamName' properties.
 * Returns an empty array on error.
 */
export async function fetchRostersWithDetails(leagueId) {
    // Check if data for this leagueId is already in cache
    if (rosterDataCache.has(leagueId)) {
        console.log(`Returning enriched roster data for league ${leagueId} from cache.`);
        return rosterDataCache.get(leagueId);
    }

    console.log(`Fetching and enriching roster data for league ID: ${leagueId}...`);
    try {
        // Fetch raw rosters and users concurrently
        const [rosters, users] = await Promise.all([
            fetchRosterData(leagueId),
            fetchUsersData(leagueId)
        ]);

        if (!rosters || rosters.length === 0) {
            console.warn(`No raw roster data found for league ${leagueId}.`);
            return [];
        }
        if (!users || users.length === 0) {
            console.warn(`No user data found for league ${leagueId}. Rosters cannot be fully enriched.`);
            // Even without user data, return raw rosters to avoid blocking
            rosterDataCache.set(leagueId, rosters);
            return rosters;
        }

        // Create a map for quick user lookup by userId
        const userMap = new Map(users.map(user => [user.userId, user]));

        // Enrich each roster with owner details
        const enrichedRosters = rosters.map(roster => {
            const owner = userMap.get(roster.owner_id);
            return {
                ...roster,
                ownerDisplayName: owner ? owner.displayName : 'Unknown Owner',
                ownerTeamName: owner ? owner.teamName : 'Unknown Team',
                ownerAvatar: owner ? owner.avatar : getSleeperAvatarUrl(null) // Provide a fallback avatar
            };
        });

        // Cache the enriched data
        rosterDataCache.set(leagueId, enrichedRosters);
        console.log(`Successfully fetched and enriched roster data for league ID: ${leagueId}.`);
        return enrichedRosters;

    } catch (error) {
        console.error(`Failed to fetch and enrich roster data for league ID ${leagueId}:`, error);
        return []; // Return empty array on error
    }
}

/**
 * Fetches transaction data for a specific league and week from the Sleeper API.
 * Data is cached in memory for subsequent calls within the same session.
 *
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number for which to retrieve transactions.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction data objects, or an empty array if an error occurs.
 */
export async function fetchTransactionsForWeek(leagueId, week) {
    // Initialize cache for this leagueId if it doesn't exist
    if (!transactionDataCache.has(leagueId)) {
        transactionDataCache.set(leagueId, new Map());
    }

    const leagueTransactionsCache = transactionDataCache.get(leagueId);

    // Check if data for this week is already in cache
    if (leagueTransactionsCache.has(week)) {
        console.log(`Returning transaction data for league ${leagueId}, week ${week} from cache.`);
        return leagueTransactionsCache.get(week);
    }

    try {
        console.log(`Fetching transaction data for league ID: ${leagueId}, Week: ${week}...`);
        const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);

        if (!response.ok) {
            console.error(`Error fetching transaction data for league ${leagueId}, Week ${week}: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        console.log(`Successfully fetched transaction data for league ID: ${leagueId}, Week: ${week}.`);

        // Store in cache
        leagueTransactionsCache.set(week, data);
        return data;
    } catch (error) {
        console.error(`Failed to fetch transaction data for league ID ${leagueId}, Week ${week}:`, error);
        return [];
    }
}

/**
 * Fetches all drafts for a given league ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft objects, or an empty array if an error occurs.
 */
export async function fetchLeagueDrafts(leagueId) {
    if (leagueDraftsCache.has(leagueId)) {
        console.log(`Returning league drafts for ${leagueId} from cache.`);
        return leagueDraftsCache.get(leagueId);
    }

    try {
        console.log(`Fetching league drafts for ID: ${leagueId}...`);
        const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
        if (!response.ok) {
            console.error(`Error fetching drafts for league ID ${leagueId}: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        leagueDraftsCache.set(leagueId, data);
        console.log(`Successfully fetched league drafts for ID: ${leagueId}.`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch league drafts for ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches details for a specific draft ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Object|null>} A promise that resolves to the draft details object, or null if an error occurs.
 */
export async function fetchDraftDetails(draftId) {
    if (draftDetailsCache.has(draftId)) {
        console.log(`Returning draft details for ${draftId} from cache.`);
        return draftDetailsCache.get(draftId);
    }

    try {
        console.log(`Fetching draft details for ID: ${draftId}...`);
        const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}`);
        if (!response.ok) {
            console.error(`Error fetching draft details for ID ${draftId}: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        draftDetailsCache.set(draftId, data);
        console.log(`Successfully fetched draft details for ID: ${draftId}.`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch draft details for ID ${draftId}:`, error);
        return null;
    }
}

/**
 * Fetches all picks for a specific draft ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft pick objects, or an empty array if an error occurs.
 */
export async function fetchDraftPicks(draftId) {
    if (draftPicksCache.has(draftId)) {
        console.log(`Returning draft picks for ${draftId} from cache.`);
        return draftPicksCache.get(draftId);
    }

    try {
        console.log(`Fetching draft picks for ID: ${draftId}...`);
        const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
        if (!response.ok) {
            console.error(`Error fetching draft picks for ID ${draftId}: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        draftPicksCache.set(draftId, data);
        console.log(`Successfully fetched draft picks for ID: ${draftId}.`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch draft picks for ID ${draftId}:`, error);
        return [];
    }
}

/**
 * Fetches all traded picks for a specific draft ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of traded pick objects, or an empty array if an error occurs.
 */
export async function fetchTradedPicks(draftId) {
    if (tradedPicksCache.has(draftId)) {
        console.log(`Returning traded picks for ${draftId} from cache.`);
        return tradedPicksCache.get(draftId);
    }

    try {
        console.log(`Fetching traded picks for ID: ${draftId}...`);
        const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/traded_picks`);
        if (!response.ok) {
            console.error(`Error fetching traded picks for ID ${draftId}: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        tradedPicksCache.set(draftId, data);
        console.log(`Successfully fetched traded picks for ID: ${draftId}.`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch traded picks for ID ${draftId}:`, error);
        return [];
    }
}

/**
 * Fetches all draft history (details, picks, traded picks) for all leagues.
 * This is a comprehensive function that consolidates all draft-related data.
 * Data is cached in memory for subsequent calls within the same session.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all historical draft data,
 * structured as { season: { draftId: { details, picks, tradedPicks } } }.
 * Returns an empty object on error.
 */
export async function fetchAllDraftHistory() {
    if (allDraftHistoryCache) {
        console.log('Returning all draft history from cache.');
        return allDraftHistoryCache;
    }

    console.log('Fetching all draft history for the first time... '); // Minor change for re-deploy
    const allDraftHistory = {};

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
        if (!leagues || leagues.length === 0) {
            console.warn('No league data found to fetch draft history.');
            return {};
        }

        for (const league of leagues) {
            const season = league.season;
            allDraftHistory[season] = {}; // Initialize season object

            const drafts = await fetchLeagueDrafts(league.league_id);
            if (!drafts || drafts.length === 0) {
                console.log(`No drafts found for league ${league.league_id} (${season}).`);
                continue; // Skip to next league if no drafts
            }

            for (const draft of drafts) {
                const draftId = draft.draft_id;
                console.log(`Fetching data for draft ID: ${draftId} (Season: ${season})...`);

                // Fetch details, picks, and traded picks concurrently for the current draft
                const [details, picks, tradedPicks] = await Promise.all([
                    fetchDraftDetails(draftId),
                    fetchDraftPicks(draftId),
                    fetchTradedPicks(draftId)
                ]);

                allDraftHistory[season][draftId] = {
                    details: details,
                    picks: picks,
                    tradedPicks: tradedPicks
                };
            }
        }

        allDraftHistoryCache = allDraftHistory;
        console.log('Successfully fetched and cached all draft history.');
        return allDraftHistory;

    } catch (error) {
        console.error('Error fetching all draft history:', error);
        return {};
    }
}
