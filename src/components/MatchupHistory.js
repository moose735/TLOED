// src/components/MatchupHistory.js
import React, { useState, useEffect } from 'react';
import { fetchUsersData, fetchRostersData } from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config'; // Import CURRENT_LEAGUE_ID

const MatchupHistory = ({ sleeperHistoricalMatchups, loading, error }) => {
  const [users, setUsers] = useState({});
  const [rosters, setRosters] = useState({});
  const [loadingLeagueData, setLoadingLeagueData] = useState(true);
  const [leagueDataError, setLeagueDataError] = useState(null);

  useEffect(() => {
    const loadLeagueData = async () => {
      setLoadingLeagueData(true);
      setLeagueDataError(null);
      try {
        if (!CURRENT_LEAGUE_ID || CURRENT_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID') {
          throw new Error("CURRENT_LEAGUE_ID not configured in config.js. Cannot fetch league data.");
        }

        const fetchedUsers = await fetchUsersData(CURRENT_LEAGUE_ID);
        const fetchedRosters = await fetchRostersData(CURRENT_LEAGUE_ID);

        if (fetchedUsers) {
          setUsers(fetchedUsers);
        } else {
          setLeagueDataError("Failed to load user data from Sleeper API.");
        }
        if (fetchedRosters) {
          setRosters(fetchedRosters);
        } else {
          setLeagueDataError(prev => prev ? prev + " And failed to load roster data." : "Failed to load roster data from Sleeper API.");
        }

      } catch (err) {
        console.error("Error fetching league user/roster data for MatchupHistory:", err);
        setLeagueDataError(`Failed to load league data: ${err.message}. Please check CURRENT_LEAGUE_ID.`);
      } finally {
        setLoadingLeagueData(false);
      }
    };
    loadLeagueData();
  }, []); // Run once on component mount

  // Helper function to get team display name
  const getTeamDisplayName = (rosterId) => {
    const roster = rosters[rosterId];
    if (roster && roster.ownerId) {
      const user = users[roster.ownerId];
      if (user) {
        return user.teamName || user.username; // Prefer teamName from metadata, fallback to username
      }
    }
    return `Roster ${rosterId}`; // Fallback if no user or owner found
  };


  if (loading || loadingLeagueData) {
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
    return (
      <div className="text-center text-red-600 p-4 bg-red-100 border border-red-400 rounded-md">
        <p className="font-semibold text-lg">Error loading Matchup History:</p>
        <p>{error || leagueDataError}</p>
        <p className="mt-2">Please ensure `CURRENT_LEAGUE_ID` in `config.js` is correct and Sleeper API is accessible.</p>
      </div>
    );
  }

  if (!sleeperHistoricalMatchups || Object.keys(sleeperHistoricalMatchups).length === 0) {
    return (
      <div className="text-center p-4 bg-yellow-100 border border-yellow-400 rounded-md">
        <p className="text-lg font-medium text-yellow-800">No historical matchup data available from Sleeper API.</p>
        <p className="text-yellow-700">This might mean the league ID is incorrect, or there's no data for previous seasons.</p>
      </div>
    );
  }

  const sortedSeasons = Object.keys(sleeperHistoricalMatchups).sort((a, b) => b - a); // Sort seasons descending

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Historical Matchup Data (Sleeper API)</h2>
      <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl mx-auto">
        This section displays historical fantasy football matchup data directly fetched from the Sleeper API for all available seasons linked to the current league.
      </p>

      {sortedSeasons.map(season => (
        <div key={season} className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-blue-700 mb-5 border-b-2 border-blue-100 pb-3">Season: {season}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(sleeperHistoricalMatchups[season]).length > 0 ? (
              Object.keys(sleeperHistoricalMatchups[season])
                .sort((a, b) => parseInt(a) - parseInt(b)) // Sort weeks numerically
                .map(week => (
                  <div key={`${season}-week-${week}`} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Week {week}</h4>
                    {sleeperHistoricalMatchups[season][week].length > 0 ? (
                      <ul className="space-y-3">
                        {/* Group matchups by matchup_id to display as pairs */}
                        {Object.values(
                          sleeperHistoricalMatchups[season][week].reduce((acc, current) => {
                            if (!acc[current.matchup_id]) {
                              acc[current.matchup_id] = [];
                            }
                            acc[current.matchup_id].push(current);
                            return acc;
                          }, {})
                        ).map((matchupPair, index) => (
                          <li key={`matchup-${week}-${index}`} className="flex flex-col space-y-1 p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                            {matchupPair.map(teamData => (
                              <div key={teamData.roster_id} className="flex justify-between text-sm text-gray-700">
                                <span className="font-medium">
                                  {getTeamDisplayName(teamData.roster_id)} {/* <--- Call getTeamDisplayName */}
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
      ))}
    </div>
  );
};

export default MatchupHistory;
