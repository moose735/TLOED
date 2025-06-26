// src/components/SeasonMatchups.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';

const SeasonMatchups = ({ season, leagueId, matchups, users, rosters, getDisplayTeamName }) => {
  const [selectedWeek, setSelectedWeek] = useState('');

  // Helper to get roster by ID (necessary for t1/t2 which are roster_ids)
  // Memoized to prevent unnecessary re-creations
  const getRosterById = useCallback((rosterId) => {
    // Ensure rosterId is a valid number and greater than 0 before attempting to find
    if (typeof rosterId === 'number' && rosterId > 0) {
      return rosters.find(r => r.roster_id === rosterId);
    }
    return null; // Return null if not a valid rosterId number
  }, [rosters]); // Dependency on 'rosters' prop

  // Memoized helper to get participant info (display name and avatar)
  // This function handles both direct roster IDs and playoff progression objects ({w: matchId}, {l: matchId})
  const getParticipantInfo = useCallback((participantIdOrObject) => {
      let display = 'TBD';
      let avatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; // Default TBD avatar

      // Check if the participant is a playoff progression object (e.g., {w: 1}, {l: 2})
      if (typeof participantIdOrObject === 'object' && participantIdOrObject !== null) {
          const type = participantIdOrObject.w ? 'Winner' : 'Loser';
          const matchId = participantIdOrObject.w || participantIdOrObject.l;
          display = `${type} of Match ${matchId}`;
      }
      // Check if the participant is a direct roster ID (number)
      else if (typeof participantIdOrObject === 'number' && participantIdOrObject > 0) {
          const rosterObj = getRosterById(participantIdOrObject);
          if (rosterObj) {
              const user = users[rosterObj.owner_id]; // 'users' is passed as a map/object with userId as keys
              if (user) {
                  display = getDisplayTeamName(user.teamName || user.displayName);
                  avatar = getSleeperAvatarUrl(user.avatar);
              } else {
                  // Fallback if user data not found for the roster owner
                  display = `Roster ${participantIdOrObject} (User not found)`;
              }
          } else {
              // Fallback if roster object not found for the given ID
              display = `Roster ${participantIdOrObject} (Roster not found)`;
          }
      }
      // If none of the above, it remains 'TBD' with default avatar

      return { display, avatar };
  }, [getRosterById, users, getDisplayTeamName]); // Dependencies for useCallback


  // Update selectedWeek when the season or matchups data changes
  useEffect(() => {
    if (Object.keys(matchups).length > 0) {
      // Set initial selected week to the latest week available in the matchups data
      const latestWeek = Math.max(...Object.keys(matchups).map(Number));
      setSelectedWeek(String(latestWeek));
    } else {
      setSelectedWeek('');
    }
  }, [season, matchups]); // Re-run when season or matchups data changes

  // Display message if no matchup data is available for the season
  if (!season || !leagueId || Object.keys(matchups).length === 0) {
    return (
      <div className="text-center p-4 text-gray-600">
        No matchup data available for {season}.
      </div>
    );
  }

  // Sort available weeks numerically for the dropdown
  const availableWeeks = Object.keys(matchups).sort((a, b) => Number(a) - Number(b));
  // Get matchups for the currently selected week
  const currentWeekMatchups = selectedWeek ? matchups[selectedWeek] : [];

  return (
    <div className="p-4">
      <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
        {season} Season Matchups
      </h3>

      {/* Week Selection Dropdown */}
      <div className="mb-6 flex flex-col md:flex-row items-center justify-start space-y-4 md:space-y-0 md:space-x-4">
        <label htmlFor="week-select" className="font-semibold text-gray-700">Select Week:</label>
        <select
          id="week-select"
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          {/* Display a default option if no weeks are available */}
          {availableWeeks.length === 0 && <option value="">No Weeks Available</option>}
          {availableWeeks.map(week => (
            <option key={week} value={week}>
              Week {week}
            </option>
          ))}
        </select>
      </div>

      {selectedWeek && currentWeekMatchups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentWeekMatchups.map((matchup) => {
            // Get info for Team 1 and Team 2 using the helper function
            const team1Info = getParticipantInfo(matchup.t1);
            const team2Info = getParticipantInfo(matchup.t2);

            // Determine winning team info
            let winningTeamDisplay = 'TBD';
            let winningTeamAvatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD';

            // If a winner (w) is present in the matchup data, resolve their info
            if (matchup.w) {
                const winnerRoster = getRosterById(matchup.w);
                if (winnerRoster) {
                    const winnerUser = users[winnerRoster.owner_id];
                    if (winnerUser) {
                        winningTeamDisplay = getDisplayTeamName(winnerUser.teamName || winnerUser.displayName);
                        winningTeamAvatar = getSleeperAvatarUrl(winnerUser.avatar);
                    }
                }
            }

            return (
              <div key={matchup.m} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                {/* Display Match Round, defaulting to 'N/A' if not available */}
                <p className="text-md font-semibold text-gray-800 mb-2">Match {matchup.m} (Round {matchup.r || 'N/A'})</p>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  {/* Display Team 1 Info */}
                  <div className="flex items-center space-x-2">
                    <img src={team1Info.avatar} alt={team1Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700">{team1Info.display}</span>
                  </div>
                  {/* VS Separator */}
                  <span className="font-bold text-lg text-gray-800">VS</span>
                  {/* Display Team 2 Info */}
                  <div className="flex items-center space-x-2">
                    <img src={team2Info.avatar} alt={team2Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700">{team2Info.display}</span>
                  </div>
                </div>
                <div className="mt-3 text-center text-sm">
                  {/* Conditionally display winner or "Match not yet played" */}
                  {matchup.w || matchup.l ? (
                    <p className="text-green-700 font-bold flex items-center justify-center">
                      Winner:
                      <img src={winningTeamAvatar} alt={winningTeamDisplay} className="w-6 h-6 rounded-full ml-2 mr-1" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                      {winningTeamDisplay}
                    </p>
                  ) : (
                    <p className="text-gray-500 italic">Match not yet played.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center p-4 text-gray-500">
          Select a week to view matchups, or no matchups available for Week {selectedWeek} in {season}.
        </p>
      )}
    </div>
  );
};

export default SeasonMatchups;
