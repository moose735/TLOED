// src/scripts/generateHistoricalMatchups.js

// This script fetches all historical matchup data from the Sleeper API
// for the current league and all its preceding seasons.
// It then prints the collected data as a JSON string to the console.
// You can copy this JSON output and save it as a static file (e.g., src/data/historicalMatchups.js)
// to avoid making repeated API calls for historical data in your application.

// Import necessary functions and constants from your existing sleeperApi.js file.
// Make sure the path is correct relative to where this script will be located.
import { CURRENT_LEAGUE_ID, fetchLeagueData } from '../utils/sleeperApi.js';

/**
 * Fetches matchup data for a specific league across a given range of regular season weeks.
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

    // Loop through each regular season week to fetch its matchups.
    for (let week = 1; week <= regularSeasonWeeks; week++) {
        try {
            console.log(`Fetching matchups for league ID: ${leagueId}, Week: ${week}...`);

            // Construct the API URL for the current league and week.
            const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);

            // Check if the network request was successful.
            if (!response.ok) {
                console.error(`Error fetching matchups for league ${leagueId}, Week ${week}: ${response.statusText}`);
                continue; // Skip to the next week if there was an error for this one.
            }

            const data = await response.json(); // Parse the JSON response.

            // Only store the data if it's not empty. An empty array might indicate
            // that the week has not happened yet or there are no matchups for it.
            if (data && data.length > 0) {
                leagueMatchups[week] = data;
            } else {
                console.log(`No matchups found for league ${leagueId}, Week ${week}. Assuming this league's regular season has ended or this week is in the future.`);
                // If a week returns no data, it's often a sign that there are no more regular season
                // weeks to fetch for this league, so we can stop early for efficiency.
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
 * Main function to generate and log all historical matchup data.
 * This function orchestrates the fetching process across all leagues and seasons.
 */
async function generateHistoricalMatchups() {
    console.log('Starting historical matchup data generation process...');
    const allHistoricalMatchups = {}; // This object will hold all the collected data.

    try {
        // Fetch all league details, starting from the CURRENT_LEAGUE_ID and going backwards.
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);

        if (!leagues || leagues.length === 0) {
            console.error('No league data found. Please check CURRENT_LEAGUE_ID and API connectivity. Exiting.');
            return;
        }

        // Iterate through each league (season) found.
        for (const league of leagues) {
            const leagueId = league.league_id;
            const season = league.season; // The season year is a good top-level key for historical data.

            // Determine the number of regular season weeks for the current league.
            // Sleeper API typically provides `settings.playoff_start_week`.
            // The regular season ends the week before playoffs start.
            let regularSeasonWeeks = 14; // Default to 14 weeks if `playoff_start_week` is not defined or invalid.

            if (league.settings && typeof league.settings.playoff_start_week === 'number' && league.settings.playoff_start_week > 1) {
                regularSeasonWeeks = league.settings.playoff_start_week - 1;
                console.log(`Identified league ${season} (${leagueId}) has playoffs starting week ${league.settings.playoff_start_week}. Fetching ${regularSeasonWeeks} regular season weeks.`);
            } else {
                 console.log(`No valid 'playoff_start_week' found for league ${season} (${leagueId}). Defaulting to fetching ${regularSeasonWeeks} regular season weeks.`);
            }

            // Fetch all matchups for the current league and its determined regular season weeks.
            const matchups = await fetchMatchupsForLeague(leagueId, regularSeasonWeeks);

            // If matchups were successfully collected for this season, add them to the main object.
            if (Object.keys(matchups).length > 0) {
                allHistoricalMatchups[season] = matchups;
                console.log(`Successfully collected matchups for season ${season} (${leagueId}).`);
            } else {
                console.warn(`No matchups were collected for season ${season} (${leagueId}). This might indicate no data for that season or an issue.`);
            }
        }

        // Log the entire collected historical data as a pretty-printed JSON string.
        // This makes it easy for you to copy and paste into a new static file.
        console.log('\n--- START OF GENERATED HISTORICAL MATCHUP DATA (COPY THE TEXT BELOW) ---');
        console.log(JSON.stringify(allHistoricalMatchups, null, 2)); // `null, 2` for pretty-printing with 2-space indentation.
        console.log('--- END OF GENERATED DATA ---');

        console.log('\nACTION REQUIRED: Please copy the JSON output above (between "START" and "END" markers).');
        console.log('Then, create a new file (e.g., `src/data/historicalMatchups.js`) and paste the copied JSON into it, like this:');
        console.log('```javascript\nexport const historicalMatchups = <PASTE_JSON_HERE>;\n```');
        console.log('You can then import `historicalMatchups` from this new file in your application.');

    } catch (error) {
        console.error('An unhandled error occurred during historical matchup data generation:', error);
    }
}

// Execute the main function when the script is run.
// This requires a Node.js environment that supports ES modules and the global 'fetch' API,
// or a browser environment (e.g., running via a script tag in an HTML file).
generateHistoricalMatchups();
