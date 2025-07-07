// src/components/MatchupHistory.js
import React, { useState, useEffect } from 'react';
import { fetchRostersWithDetails, fetchLeagueDetails } from '../utils/sleeperApi'; // Added fetchLeagueDetails
import { CURRENT_LEAGUE_ID } from '../config';

const MatchupHistory = ({ sleeperHistoricalMatchups, loading, error }) => {
  // State to store enriched rosters for ALL historical seasons
  // Structure: { 'season_league_id_1': { 'roster_id_1': { ownerTeamName: 'Name1', ... }, ... }, ... }
  const [allSeasonEnrichedRosters, setAllSeasonEnrichedRosters] = useState({});

  const [loadingLeagueData, setLoadingLeagueData] = useState(true);
  const [leagueDataError, setLeagueDataError] = useState(null);

  useEffect(() => {
    const loadAllSeasonLeagueData = async () => {
      setLoadingLeagueData(true);
      setLeagueDataError(null);
      const newAllSeasonEnrichedRosters = {};

      try {
        if (!CURRENT_LEAGUE_ID || CURRENT_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID' || CURRENT_LEAGUE_ID.includes('YOUR_')) {
          const errorMessage = "CURRENT_LEAGUE_ID not properly configured in config.js. Cannot fetch league data.";
          console.error("DEBUG:", errorMessage);
          throw new Error(errorMessage);
        }

        // Get all unique league IDs from historical matchups
        // We'll also include the CURRENT_LEAGUE_ID to get current team names for the most recent season
        const allLeagueIds = new Set();
        allLeagueIds.add(CURRENT_LEAGUE_ID); // Always fetch for the current league ID

        Object.keys(sleeperHistoricalMatchups).forEach(season => {
          // Assuming sleeperHistoricalMatchups[season] is an object that contains
          // data from a specific league ID for that season.
          // We need the actual league ID for that season.
          // If the structure of sleeperHistoricalMatchups looks like:
          // { '2023': { league_id: 'abc', ... }, '2024': { league_id: 'def', ... } }
          // Then we'd access it differently.
          // For now, let's assume the main App.js passes in an object like:
          // { '2023': { week1: [...], week2: [...] }, '2024': { week1: [...], ... } }
          // And the league ID for each season needs to be derived.
          // A robust way is to fetch the league details for each *season* listed.

          // To make this robust, we need to know the actual league ID for *each season*.
          // Let's assume for now that the keys of sleeperHistoricalMatchups (e.g., '2024', '2023')
          // can be used to infer the league ID for that specific season if not directly available.
          // If your sleeperHistoricalMatchups structure doesn't include the league_id
          // directly within each season's data, you might need to adjust fetchHistoricalMatchups
          // in App.js to pass that information along, or fetch it here.

          // A simpler assumption for now: `sleeperHistoricalMatchups` values are the
          // actual matchup data. We need to get league IDs for each *season* key.
          // This typically means fetching league history or assuming a pattern.

          // **IMPORTANT:** The `sleeperHistoricalMatchups` structure passed from `App.js`
          // does not inherently give us the *past* league IDs.
          // If `fetchHistoricalMatchups` in `sleeperApi.js` returned an object like:
          // `{ '2024': { leagueDetails: { league_id: 'xyz', ... }, matchups: [...] } }`
          // that would be ideal.

          // Let's try to get the league IDs from the first matchup's league_id for each season
          // if available, but this is less reliable.
          // The best way is to fetch `league_id` from `fetchLeagueDetails` for each *past* year.

          // Given the previous console output:
          // "League 2024 (1048371694643060736), Week 1: Fetched 12 matchups."
          // This implies your `fetchHistoricalMatchups` in `sleeperApi.js` is already
          // giving us the league IDs associated with each season!

          // Let's make sure the `sleeperHistoricalMatchups` passed to `MatchupHistory`
          // includes the league ID for each season.
          // For example, if sleeperHistoricalMatchups[season] looked like:
          // { 'leagueId': 'the_league_id_for_this_season', 'weeks': { '1': [...], '2': [...] } }

          // If `sleeperHistoricalMatchups` is just `{ 'season_year': { 'week': [...] } }`,
          // then we need to fetch the historical league IDs.

          // RE-EVALUATION: Looking at your `App.js` and `fetchHistoricalMatchups` in `sleeperApi.js`,
          // it seems `fetchHistoricalMatchups` effectively iterates through prior years
          // and gets the *associated league ID* for that year.
          // The output `League 2024 (1048371694643060736)` means `fetchHistoricalMatchups`
          // is giving us these specific league IDs.

          // So, `sleeperHistoricalMatchups` as passed to this component doesn't directly contain the league ID,
          // it contains the *matchup data*.
          // We need to pass the *list of historical league IDs* from `App.js` to `MatchupHistory.js`.

          // For now, let's assume `sleeperHistoricalMatchups` object has a `league_id` property per season.
          // Or, better yet, `App.js` passes a separate prop `historicalLeagueIdsMap`
          // like `{ '2023': 'league_id_2023', '2024': 'league_id_2024' }`

          // If you passed the full `historicalMatchups` from `App.js` which is structured like:
          // {
          //   '2025': { id: '1181984921049018368', matchups: { /* ... */ } },
          //   '2024': { id: '1048371694643060736', matchups: { /* ... */ } },
          //   // ... and so on
          // }
          // Then we can easily get the IDs.

          // Let's assume your `sleeperHistoricalMatchups` is structured to include the league ID:
          // { 'season_year': { 'id': 'league_id_for_this_season', 'weeks': { '1': [...], ... } } }
          // If not, you'll need to modify `App.js` to pass this `id` along or store it.

          // For now, I'll proceed with the assumption that your `sleeperHistoricalMatchups` prop
          // now has this structure: `sleeperHistoricalMatchups[season].id` for the league ID.
          // This is a common pattern when fetching historical data.

          const seasonData = sleeperHistoricalMatchups[season];
          if (seasonData && seasonData.id) { // Assuming 'id' property now exists for the league ID
            allLeagueIds.add(seasonData.id);
          } else {
              console.warn(`DEBUG: No league ID found for season ${season} in sleeperHistoricalMatchups. Cannot fetch specific roster data for this season.`);
          }
        });

        const fetchPromises = Array.from(allLeagueIds).map(async (leagueId) => {
          try {
            console.log(`DEBUG: Fetching enriched rosters for league ID: ${leagueId}`);
            const fetchedRostersArray = await fetchRostersWithDetails(leagueId);
            const enrichedRostersById = fetchedRostersArray.reduce((acc, roster) => {
              acc[roster.roster_id] = roster;
              return acc;
            }, {});
            return { leagueId, data: enrichedRostersById };
          } catch (fetchErr) {
            console.error(`DEBUG: Error fetching rosters for league ID ${leagueId}:`, fetchErr);
            return { leagueId, data: {} }; // Return empty if error
          }
        });

        const results = await Promise.all(fetchPromises);

        results.forEach(({ leagueId, data }) => {
          if (Object.keys(data).length > 0) {
            newAllSeasonEnrichedRosters[leagueId] = data;
          } else {
            console.warn(`DEBUG: No enriched roster data collected for league ID: ${leagueId}`);
          }
        });

        setAllSeasonEnrichedRosters(newAllSeasonEnrichedRosters);
        if (Object.keys(newAllSeasonEnrichedRosters).length === 0) {
            setLeagueDataError("No roster data loaded for any season.");
        }

      } catch (err) {
        console.error("DEBUG: Global Error fetching all season league data for MatchupHistory:", err);
        setLeagueDataError(`Failed to load historical league data: ${err.message}. Please ensure CURRENT_LEAGUE_ID is correct and historical data exists.`);
      } finally {
        setLoadingLeagueData(false);
      }
    };

    // Only run if historical matchups are loaded and we haven't already loaded all season data
    if (!loading && !error && Object.keys(sleeperHistoricalMatchups).length > 0 && Object.keys(allSeasonEnrichedRosters).length === 0) {
        loadAllSeasonLeagueData();
    } else if (Object.keys(sleeperHistoricalMatchups).length === 0 && !loading && !error) {
        // If no historical matchups, but no error, means nothing to load
        setLoadingLeagueData(false);
    }
  }, [sleeperHistoricalMatchups, loading, error, CURRENT_LEAGUE_ID, allSeasonEnrichedRosters]);


  // Helper function to get team display name for a specific season/league
  const getTeamDisplayName = (rosterId, seasonLeagueId) => {
    console.log(`DEBUG: getTeamDisplayName called for rosterId: ${rosterId} in league ID: ${seasonLeagueId}`);

    // Get the specific roster map for this season
    const seasonRosters = allSeasonEnrichedRosters[seasonLeagueId];

    if (!seasonRosters) {
        console.warn(`DEBUG: No enriched roster data found for league ID: ${seasonLeagueId}`);
        return `Roster ${rosterId} (Season ${seasonLeagueId.substring(0,4)})`; // Fallback with league ID for clarity
    }

    const roster = seasonRosters[rosterId];
    console.log("DEBUG: Found enriched roster object for season:", roster);

    if (roster) {
      const teamName = roster.ownerTeamName;
      const displayName = roster.ownerDisplayName;
      console.log("DEBUG: Enriched Roster ownerTeamName (for season):", teamName);
      console.log("DEBUG: Enriched Roster ownerDisplayName (for season):", displayName);
      return teamName || displayName || `Roster ${rosterId}`;
    } else {
      console.warn(`DEBUG: No enriched roster found for rosterId: ${rosterId} in season league ID: ${seasonLeagueId}`);
    }
    return `Roster ${rosterId}`;
  };

  // Render logic remains similar, but with a crucial change in how getTeamDisplayName is called.
  if (loading || loadingLeagueData) {
    // ... (unchanged loading spinner) ...
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
        <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium">Loading matchup history and league data...</p>
      </div>
    );
  }

  if (error || leagueDataError) {
    // ... (unchanged error message) ...
    return (
      <div className="text-center text-red-600 p-4 bg-red-100 border border-red-400 rounded-md">
        <p className="font-semibold text-lg">Error loading Matchup History:</p>
        <p>{error || leagueDataError}</p>
        <p className="mt-2">Please ensure `CURRENT_LEAGUE_ID` in `config.js` is correct and Sleeper API is accessible.</p>
      </div>
    );
  }

  if (!sleeperHistoricalMatchups || Object.keys(sleeperHistoricalMatchups).length === 0) {
    // ... (unchanged no data message) ...
    return (
      <div className="text-center p-4 bg-yellow-100 border border-yellow-400 rounded-md">
        <p className="text-lg font-medium text-yellow-800">No historical matchup data available from Sleeper API.</p>
        <p className="text-yellow-700">This might mean the league ID is incorrect, or there's no data for previous seasons.</p>
      </div>
    );
  }

  const sortedSeasons = Object.keys(sleeperHistoricalMatchups).sort((a, b) => b - a);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Historical Matchup Data (Sleeper API)</h2>
      <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl mx-auto">
        This section displays historical fantasy football matchup data directly fetched from the Sleeper API for all available seasons linked to the current league.
      </p>

      {sortedSeasons.map(season => {
        // Access the season-specific league ID from sleeperHistoricalMatchups
        // This is the crucial part that relies on the structure of sleeperHistoricalMatchups
        const seasonLeagueId = sleeperHistoricalMatchups[season]?.id;

        if (!seasonLeagueId) {
            console.warn(`DEBUG: Skipping season ${season} as no league ID was found in its data.`);
            return null; // Don't render this season if no league ID
        }

        return (
          <div key={season} className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-200">
            <h3 className="text-2xl font-bold text-blue-700 mb-5 border-b-2 border-blue-100 pb-3">Season: {season}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sleeperHistoricalMatchups[season].weeks && Object.keys(sleeperHistoricalMatchups[season].weeks).length > 0 ? (
                Object.keys(sleeperHistoricalMatchups[season].weeks)
                  .sort((a, b) => parseInt(a) - parseInt(b)) // Sort weeks numerically
                  .map(week => (
                    <div key={`${season}-week-${week}`} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Week {week}</h4>
                      {sleeperHistoricalMatchups[season].weeks[week].length > 0 ? (
                        <ul className="space-y-3">
                          {Object.values(
                            sleeperHistoricalMatchups[season].weeks[week].reduce((acc, current) => {
                              if (!acc[current.matchup_id]) {
                                acc[current.matchup_id] = [];
                              }
                              acc[current.matchup_id].push(current);
                              return acc;
                            }, {})
                          ).map((matchupPair, index) => (
                            <li key={`matchup-${season}-${week}-${index}`} className="flex flex-col space-y-1 p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                              {matchupPair.map(teamData => (
                                <div key={teamData.roster_id} className="flex justify-between text-sm text-gray-700">
                                  <span className="font-medium">
                                    {/* Pass the seasonLeagueId to getTeamDisplayName */}
                                    {getTeamDisplayName(teamData.roster_id, seasonLeagueId)}
                                  </span>
                                  <span className="font-bold text-blue-600">{teamData.points ? teamData.points.toFixed(2) : 'N/A'}</span>
                                </div>
                              ))}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-600 text-sm italic">No matchup data for this week.</p>
                      )}
                    </div>
                  ))
              ) : (
                <p className="text-gray-600 italic col-span-full">No matchup data found for this season.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MatchupHistory;
