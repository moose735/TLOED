// src/utils/sleeperApi.js

// Easily configurable current league ID
export const CURRENT_LEAGUE_ID = '1181984921049018368'; // This is the CURRENT league ID for the 2025 season

/**
 * Constructs the full URL for a Sleeper user avatar from a hash.
 * This is used as a fallback if a full URL is not provided in metadata.
 * @param {string} avatarHash The avatar hash from Sleeper user data.
 * @returns {string} The full URL to the avatar image, or a placeholder if hash is missing.
 */
export const getSleeperAvatarUrl = (avatarHash) => {
  return avatarHash ? `https://sleepercdn.com/avatars/thumb_${avatarHash}` : 'https://placehold.co/150x150/cccccc/000000?text=No+Avatar';
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
      let avatarUrl = '';
      // Prefer the full URL from metadata if available and looks like a URL
      if (user.metadata && user.metadata.avatar && user.metadata.avatar.startsWith('http')) {
        avatarUrl = user.metadata.avatar;
      } else {
        // Fallback to constructing from the main avatar hash
        avatarUrl = getSleeperAvatarUrl(user.avatar);
      }

      return {
        userId: user.user_id,
        displayName: user.display_name,
        avatar: user.avatar, // Keep the hash in case it's needed elsewhere
        fullAvatarUrl: avatarUrl, // New field for the full URL
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
