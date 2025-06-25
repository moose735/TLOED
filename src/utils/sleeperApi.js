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
  // For example: 'RetiredManagerName1', 'RetiredManagerName2'
]);

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
