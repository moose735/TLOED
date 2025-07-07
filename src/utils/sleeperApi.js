// src/utils/sleeperApi.js

// Easily configurable current league ID
export const CURRENT_LEAGUE_ID = '1181984921049018368'; // This is the CURRENT league ID for the 2025 season

// Centralized map linking your internal team names (e.g., last names) to Sleeper User IDs.
// YOU MUST POPULATE THIS MAP WITH ALL YOUR TEAM NAMES AND THEIR CORRESPONDING SLEEPER USER IDs.
export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
  // Example: 'Ainsworth': '783790952367169536',
  // Make sure this map is complete for all your historical team owners
  'Ainsworth': '783790952367169536',
  'Bjarnar': '783761299275382784',
  'Blumbergs': '783789717920534528',
  'Boilard': '783789669597999104',
  'Dembski': '783767734491127808',
  'Irwin': '467074573125283840',
  'Meer': '783778036578418688',
  'Neufeglise': '783763304463147008',
  'O\'Donoghue': '783758716272009216',
  'ODonoghue': '783758716272009216', // Added alias for "ODonoghue"
  'Randall': '783754997035876352',
  'Schmitt': '783761892693905408',
  'Tomczak': '787044291066380288'
};


// If you have managers who have left the league but you want to reference them, add them here.
// Key should be the Sleeper User ID. Value is their display name.
export const RETIRED_MANAGERS = {
  // '783790952367169536': 'Retired Manager Name',
};

const SLEEPER_API_BASE_URL = 'https://api.sleeper.app/v1';

// Caches for API data
const leagueDetailsCache = new Map();
const usersCache = new Map();
const rostersCache = new Map();
const matchupsCache = new Map();
const playersCache = new Map();
const transactionsCache = new Map();
const draftsCache = new Map();
const winnersBracketCache = new Map();
const losersBracketCache = new Map();
const leagueHistoryCache = new Map(); // New cache for league history

const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Helper to check and clear cache
const getCachedData = (cache, key) => {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_MS)) {
    return cached.data;
  }
  return null;
};

const setCachedData = (cache, key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};


/**
 * Fetches league details for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Object>} A promise that resolves to the league details object.
 */
export async function fetchLeagueDetails(leagueId) {
  const cached = getCachedData(leagueDetailsCache, leagueId);
  if (cached) {
    console.log(`Returning league details for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching league details for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}`);
    if (!response.ok) {
      console.error(`Error fetching league details for league ID ${leagueId}: ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    setCachedData(leagueDetailsCache, leagueId, data);
    console.log(`Successfully fetched league details for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch league details for league ID ${leagueId}:`, error);
    return null;
  }
}

/**
 * Fetches historical league IDs for a given league lineage.
 * @param {string} leagueId The ID of the Sleeper league (current or past).
 * @returns {Promise<Array<string>>} A promise that resolves to an array of historical league IDs.
 */
export async function fetchLeagueHistory(leagueId) {
  const cached = getCachedData(leagueHistoryCache, leagueId);
  if (cached) {
    console.log(`Returning league history for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching league history for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/history`);
    if (!response.ok) {
      console.error(`Error fetching league history for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    const historicalLeagueIds = data.map(league => league.league_id);
    setCachedData(leagueHistoryCache, leagueId, historicalLeagueIds);
    console.log(`Successfully fetched league history for league ID: ${leagueId}.`);
    return historicalLeagueIds;
  } catch (error) {
    console.error(`Failed to fetch league history for league ID ${leagueId}:`, error);
    return [];
  }
}


/**
 * Fetches users data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user objects.
 */
export async function fetchUsersData(leagueId) {
  const cacheKey = `users-${leagueId}`;
  const cached = getCachedData(usersCache, cacheKey);
  if (cached) {
    console.log(`Returning users for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching users for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/users`);
    if (!response.ok) {
      console.error(`Error fetching users for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(usersCache, cacheKey, data);
    console.log(`Successfully fetched users for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch users for league ID ${leagueId}:`, error);
    return [];
  }
}

/**
 * Fetches rosters data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of roster objects.
 */
export async function fetchRostersWithDetails(leagueId) {
  const cacheKey = `rosters-${leagueId}`;
  const cached = getCachedData(rostersCache, cacheKey);
  if (cached) {
    console.log(`Returning rosters for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching rosters for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/rosters`);
    if (!response.ok) {
      console.error(`Error fetching rosters for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(rostersCache, cacheKey, data);
    console.log(`Successfully fetched rosters for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch rosters for league ID ${leagueId}:`, error);
    return [];
  }
}

/**
 * Fetches NFL players data.
 * @returns {Promise<Object>} A promise that resolves to an object of NFL players.
 */
export async function fetchNFLPlayers() {
  const cacheKey = 'nflPlayers';
  const cached = getCachedData(playersCache, cacheKey);
  if (cached) {
    console.log("Returning NFL players from cache.");
    return cached;
  }

  try {
    console.log("Fetching NFL players data...");
    const response = await fetch(`${SLEEPER_API_BASE_URL}/stats/nfl/players/2023`); // Consider making year dynamic
    if (!response.ok) {
      console.error(`Error fetching NFL players: ${response.statusText}`);
      return {};
    }
    const data = await response.json();
    setCachedData(playersCache, cacheKey, data);
    console.log("Successfully fetched NFL players data.");
    return data;
  } catch (error) {
    console.error("Failed to fetch NFL players data:", error);
    return {};
  }
}

/**
 * Fetches matchup data for a given week and league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of matchup objects.
 */
export async function fetchMatchupsForWeek(leagueId, week) {
  const cacheKey = `matchups-${leagueId}-${week}`;
  const cached = getCachedData(matchupsCache, cacheKey);
  if (cached) {
    console.log(`Returning matchups for league ${leagueId}, week ${week} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching matchups for league ID: ${leagueId}, week: ${week}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/matchups/${week}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No matchups found for league ID ${leagueId}, week ${week}. (Likely end of season or pre-season)`);
        return [];
      }
      console.error(`Error fetching matchups for league ID ${leagueId}, week ${week}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(matchupsCache, cacheKey, data);
    console.log(`Successfully fetched matchups for league ID: ${leagueId}, week: ${week}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch matchups for league ID ${leagueId}, week ${week}:`, error);
    return [];
  }
}

/**
 * Fetches transactions for a given week in a league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction objects.
 */
export async function fetchTransactionsForWeek(leagueId, week) {
  const cacheKey = `transactions-${leagueId}-${week}`;
  const cached = getCachedData(transactionsCache, cacheKey);
  if (cached) {
    console.log(`Returning transactions for league ${leagueId}, week ${week} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching transactions for league ID: ${leagueId}, week: ${week}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/transactions/${week}`);
    if (!response.ok) {
      console.error(`Error fetching transactions for league ID ${leagueId}, week ${week}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(transactionsCache, cacheKey, data);
    console.log(`Successfully fetched transactions for league ID: ${leagueId}, week: ${week}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch transactions for league ID ${leagueId}, week ${week}:`, error);
    return [];
  }
}

/**
 * Fetches league drafts for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft objects.
 */
export async function fetchLeagueDrafts(leagueId) {
  const cacheKey = `drafts-${leagueId}`;
  const cached = getCachedData(draftsCache, cacheKey);
  if (cached) {
    console.log(`Returning drafts for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching drafts for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/drafts`);
    if (!response.ok) {
      console.error(`Error fetching drafts for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(draftsCache, cacheKey, data);
    console.log(`Successfully fetched drafts for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch drafts for league ID ${leagueId}:`, error);
    return [];
  }
}

/**
 * Helper to get the Sleeper player headshot URL.
 * @param {string} playerId The Sleeper player ID.
 * @returns {string} The URL to the player's headshot.
 */
export function getSleeperPlayerHeadshotUrl(playerId) {
  if (!playerId) {
    return 'https://sleeper.app/img/content/default_avatar.jpg'; // Default avatar if no player ID
  }
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

/**
 * Helper to get the Sleeper user avatar URL.
 * @param {string} avatarId The Sleeper avatar ID from user object.
 * @returns {string} The URL to the user's avatar.
 */
export function getSleeperAvatarUrl(avatarId) {
  if (!avatarId) {
    return 'https://sleeper.app/img/content/default_avatar.jpg'; // Default avatar if no avatarId
  }
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}


// New function to fetch all historical matchups
/**
 * Fetches all historical matchups for a given league lineage from Sleeper API.
 * Transforms data into a consistent format for the application.
 * @param {string} currentLeagueId The current season's league ID.
 * @returns {Promise<Array<Object>>} An array of historical matchup objects.
 */
export async function fetchHistoricalMatchups(currentLeagueId) {
  const allHistoricalMatchups = [];
  const processedLeagueIds = new Set(); // To avoid processing the same league ID twice

  try {
    // 1. Get current league details
    const currentLeagueDetails = await fetchLeagueDetails(currentLeagueId);
    if (!currentLeagueDetails) {
      console.error("Could not fetch current league details. Cannot proceed with historical matchups.");
      return [];
    }

    // 2. Get historical league IDs for this league lineage
    const historicalLeagueIds = await fetchLeagueHistory(currentLeagueId);

    // Combine current and historical league IDs, then sort by season (assuming chronological order is useful)
    // The history endpoint returns past seasons, so currentLeagueId might not be in it.
    // Also, ensure unique IDs just in case.
    const allRelevantLeagueIds = [...new Set([currentLeagueId, ...historicalLeagueIds])]
      .sort((a, b) => {
        // Fetch details for sorting, or make an assumption about ID structure/creation date
        // For now, a simple lexicographical sort on IDs might work if they're sequentially assigned,
        // but fetching league details for each to get the actual 'season' is more robust.
        // This is an intensive operation if not cached. Let's rely on fetchLeagueDetails caching.
        return 0; // Will sort after fetching details
      });

    const leagueDetailsMap = new Map(); // Cache for league details during iteration
    for (const leagueId of allRelevantLeagueIds) {
      const details = await fetchLeagueDetails(leagueId);
      if (details) {
        leagueDetailsMap.set(leagueId, details);
      }
    }

    // Sort by season year
    const sortedLeagueIds = [...leagueDetailsMap.values()]
      .sort((a, b) => a.season - b.season)
      .map(details => details.league_id);


    console.log("All relevant league IDs for historical data:", sortedLeagueIds);

    for (const leagueId of sortedLeagueIds) {
      if (processedLeagueIds.has(leagueId)) {
        continue;
      }
      processedLeagueIds.add(leagueId);

      console.log(`Processing historical data for league ID: ${leagueId}`);
      const leagueDetails = leagueDetailsMap.get(leagueId);
      if (!leagueDetails) {
        console.warn(`Skipping league ${leagueId}: details not found.`);
        continue;
      }

      const season = parseInt(leagueDetails.season);
      const lastRegularSeasonWeek = leagueDetails.settings?.playoff_week_start ? leagueDetails.settings.playoff_week_start -1 : leagueDetails.settings?.last_regular_season_week || 14; // Default to 14 if not specified
      const playoffStartWeek = leagueDetails.settings?.playoff_week_start || 15; // Default to 15


      // Fetch users and rosters for this specific season/league ID
      const users = await fetchUsersData(leagueId);
      const rosters = await fetchRostersWithDetails(leagueId);

      const userIdToDisplayName = new Map();
      users.forEach(user => {
        // Prioritize custom name from TEAM_NAME_TO_SLEEPER_ID_MAP, then display_name, then first_name, then 'Unknown Manager'
        const customName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(key => TEAM_NAME_TO_SLEEPER_ID_MAP[key] === user.user_id);
        if (customName) {
            userIdToDisplayName.set(user.user_id, customName);
        } else if (user.metadata?.team_name) {
            userIdToDisplayName.set(user.user_id, user.metadata.team_name);
        } else if (user.display_name) {
            userIdToDisplayName.set(user.user_id, user.display_name);
        } else if (user.first_name) {
            userIdToDisplayName.set(user.user_id, user.first_name);
        } else {
            userIdToDisplayName.set(user.user_id, `User ${user.user_id}`);
        }
      });
      // Add retired managers if they are not already in the active users
      Object.entries(RETIRED_MANAGERS).forEach(([userId, displayName]) => {
          if (!userIdToDisplayName.has(userId)) {
              userIdToDisplayName.set(userId, displayName);
          }
      });

      const rosterIdToUserId = new Map(rosters.map(r => [r.roster_id, r.owner_id]));

      // Fetch matchups for regular season
      for (let week = 1; week <= lastRegularSeasonWeek; week++) {
        const matchups = await fetchMatchupsForWeek(leagueId, week);

        // Group matchups by matchup_id to get head-to-head pairs
        const groupedMatchups = {};
        matchups.forEach(m => {
          if (!groupedMatchups[m.matchup_id]) {
            groupedMatchups[m.matchup_id] = [];
          }
          groupedMatchups[m.matchup_id].push(m);
        });

        for (const matchupId in groupedMatchups) {
          const game = groupedMatchups[matchupId];
          if (game.length === 2) { // Ensure it's a valid head-to-head matchup
            const team1Data = game[0];
            const team2Data = game[1];

            const team1UserId = rosterIdToUserId.get(team1Data.roster_id);
            const team2UserId = rosterIdToUserId.get(team2Data.roster_id);

            if (team1UserId && team2UserId) {
              allHistoricalMatchups.push({
                year: season,
                week: week,
                team1: userIdToDisplayName.get(team1UserId) || `Unknown Team (${team1Data.roster_id})`,
                team2: userIdToDisplayName.get(team2UserId) || `Unknown Team (${team2Data.roster_id})`,
                team1Score: team1Data.points,
                team2Score: team2Data.points,
                playoffs: false, // Regular season games
                finalSeedingGame: null, // As discussed, complex to derive accurately from Sleeper API
                team1RosterId: team1Data.roster_id,
                team2RosterId: team2Data.roster_id,
                team1UserId: team1UserId,
                team2UserId: team2UserId,
              });
            } else {
                console.warn(`Skipping matchup for league ${leagueId}, week ${week}, matchup ${matchupId}: Could not find user IDs for roster IDs. Team1 Roster: ${team1Data.roster_id}, Team2 Roster: ${team2Data.roster_id}`);
            }
          }
        }
      }

      // Fetch matchups for playoff weeks (if they exist)
      // Sleeper typically has a `playoff_week_start` setting.
      // We can iterate from `playoff_week_start` up to a reasonable max like week 18 or until 404
      for (let week = playoffStartWeek; week <= playoffStartWeek + 4; week++) { // Assuming max 4 playoff weeks
        const matchups = await fetchMatchupsForWeek(leagueId, week);
        if (matchups.length === 0) {
          break; // No more playoff matchups for this season
        }

        const groupedMatchups = {};
        matchups.forEach(m => {
          if (!groupedMatchups[m.matchup_id]) {
            groupedMatchups[m.matchup_id] = [];
          }
          groupedMatchups[m.matchup_id].push(m);
        });

        for (const matchupId in groupedMatchups) {
          const game = groupedMatchups[matchupId];
          if (game.length === 2) {
            const team1Data = game[0];
            const team2Data = game[1];

            const team1UserId = rosterIdToUserId.get(team1Data.roster_id);
            const team2UserId = rosterIdToUserId.get(team2Data.roster_id);

            if (team1UserId && team2UserId) {
                allHistoricalMatchups.push({
                    year: season,
                    week: week,
                    team1: userIdToDisplayName.get(team1UserId) || `Unknown Team (${team1Data.roster_id})`,
                    team2: userIdToDisplayName.get(team2UserId) || `Unknown Team (${team2Data.roster_id})`,
                    team1Score: team1Data.points,
                    team2Score: team2Data.points,
                    playoffs: true, // Mark as playoff game
                    finalSeedingGame: null, // Still setting to null for simplicity.
                    team1RosterId: team1Data.roster_id,
                    team2RosterId: team2Data.roster_id,
                    team1UserId: team1UserId,
                    team2UserId: team2UserId,
                });
            } else {
                console.warn(`Skipping playoff matchup for league ${leagueId}, week ${week}, matchup ${matchupId}: Could not find user IDs for roster IDs.`);
            }
          }
        }
      }
    }

    console.log("Finished fetching all historical matchups.", allHistoricalMatchups);
    return allHistoricalMatchups;

  } catch (error) {
    console.error("Error fetching historical matchups from Sleeper:", error);
    return [];
  }
}


/**
 * Fetches the winners bracket data for a given league ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchWinnersBracket(leagueId) {
  const cacheKey = `winnersBracket-${leagueId}`;
  const cached = getCachedData(winnersBracketCache, cacheKey);
  if (cached) {
    console.log(`Returning winners bracket for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching winners bracket for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/winners_bracket`);
    if (!response.ok) {
      console.error(`Error fetching winners bracket for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(winnersBracketCache, cacheKey, data);
    console.log(`Successfully fetched winners bracket for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch winners bracket for league ID ${leagueId}:`, error);
    return [];
  }
}

/**
 * Fetches the losers bracket data for a given league ID.
 * Data is cached in memory for subsequent calls within the same session.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchLosersBracket(leagueId) {
  const cacheKey = `losersBracket-${leagueId}`;
  const cached = getCachedData(losersBracketCache, cacheKey);
  if (cached) {
    console.log(`Returning losers bracket for league ${leagueId} from cache.`);
    return cached;
  }

  try {
    console.log(`Fetching losers bracket for league ID: ${leagueId}...`);
    const response = await fetch(`${SLEEPER_API_BASE_URL}/league/${leagueId}/losers_bracket`);
    if (!response.ok) {
      console.error(`Error fetching losers bracket for league ID ${leagueId}: ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    setCachedData(losersBracketCache, cacheKey, data);
    console.log(`Successfully fetched losers bracket for league ID: ${leagueId}.`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch losers bracket for league ID ${leagueId}:`, error);
    return [];
  }
}
