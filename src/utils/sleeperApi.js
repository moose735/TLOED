// src/utils/sleeperApi.js

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
 * Fetches league data for the current season and specified previous seasons.
 * It recursively fetches previous league details using previous_league_id.
 *
 * @param {string} currentLeagueId The ID of the current season's league.
 * @param {number} numPreviousSeasons The number of previous seasons to fetch data for (e.g., 2 for 2024 and 2023).
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of league data objects,
 * ordered from current season to oldest requested previous season.
 */
export async function fetchLeagueData(currentLeagueId, numPreviousSeasons = 2) {
  const leagueData = [];
  let currentId = currentLeagueId;
  let seasonsFetched = 0;

  while (currentId && seasonsFetched <= numPreviousSeasons) {
    const details = await fetchLeagueDetails(currentId);
    if (details) {
      leagueData.push(details);
      currentId = details.previous_league_id;
      seasonsFetched++;
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

    // Extracting specific fields as requested: team_name, display_name, avatar, user_id
    const processedUsers = data.map(user => ({
      userId: user.user_id,
      displayName: user.display_name,
      avatar: user.avatar,
      // 'team_name' is typically found in the user.metadata object for Sleeper
      teamName: user.metadata ? user.metadata.team_name : user.display_name, // Fallback to display_name if no team_name
    }));

    return processedUsers;
  } catch (error) {
    console.error(`Failed to fetch user details for league ID ${leagueId}:`, error);
    return [];
  }
}

// Example usage (you would typically call these from a React component's useEffect or similar)
/*
(async () => {
  const currentLeagueId = '1181984921049018368'; // 2025 season ID

  console.log("Fetching league data for current and 2 previous seasons...");
  const allLeagueData = await fetchLeagueData(currentLeagueId, 2);
  allLeagueData.forEach(league => {
    console.log(`League: ${league.name} (ID: ${league.league_id})`);
    console.log(`  Status: ${league.status}`);
    console.log(`  Season: ${league.season}`);
    console.log(`  Previous League ID: ${league.previous_league_id}`);
    console.log('---');
  });

  console.log(`Fetching users for current league ID: ${currentLeagueId}`);
  const users = await fetchUsersData(currentLeagueId);
  users.forEach(user => {
    console.log(`User ID: ${user.userId}`);
    console.log(`  Display Name: ${user.displayName}`);
    console.log(`  Team Name: ${user.teamName}`);
    console.log(`  Avatar URL: https://sleepercdn.com/avatars/thumb_${user.avatar}`);
    console.log('---');
  });
})();
*/
