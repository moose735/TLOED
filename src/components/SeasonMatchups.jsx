// src/components/SeasonMatchups.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';

const SeasonMatchups = ({ season, leagueId, matchups, users, rosters, getDisplayTeamName }) => {
  const [selectedWeek, setSelectedWeek] = useState('');

  console.log(`SeasonMatchups: Render for season ${season}, selectedWeek: ${selectedWeek}`);
  console.log('SeasonMatchups: Received matchups prop:', matchups);

  // Helper to get roster by ID (necessary for t1/t2 which are roster_ids)
  // Memoized to prevent unnecessary re-creations
  const getRosterById = useCallback((rosterId) => {
    if (typeof rosterId === 'number' && rosterId > 0) {
      const foundRoster = rosters.find(r => r.roster_id === rosterId);
      console.log(`  getRosterById(${rosterId}): Found ${foundRoster ? 'roster' : 'nothing'}`);
      return foundRoster;
    }
    console.log(`  getRosterById(${rosterId}): Invalid rosterId type or value.`);
    return null;
  }, [rosters]); // Dependency on 'rosters' prop

  // Memoized helper to get participant info (display name and avatar)
  const getParticipantInfo = useCallback((participantIdOrObject) => {
      let display = 'TBD';
      let avatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD';

      console.log("  getParticipantInfo called with participantIdOrObject:", participantIdOrObject); // CRITICAL DEBUG LOG

      if (typeof participantIdOrObject === 'object' && participantIdOrObject !== null) {
          // This case handles playoff progression links like {w: 123} or {l: 456}
          const type = participantIdOrObject.w ? 'Winner' : (participantIdOrObject.l ? 'Loser' : null);
          const matchId = participantIdOrObject.w || participantIdOrObject.l;
          if (type && matchId) {
              display = `${type} of Match ${matchId}`;
          } else {
              display = 'Invalid Playoff Link';
          }
      } else if (participantIdOrObject !== null && participantIdOrObject !== undefined) {
          // This case handles direct roster IDs (should be a number)
          const numericRosterId = Number(participantIdOrObject);
          if (!isNaN(numericRosterId) && numericRosterId > 0) {
            const rosterObj = getRosterById(numericRosterId);
            if (rosterObj) {
                const user = users[rosterObj.owner_id];
                console.log(`    Resolved roster ${numericRosterId}, owner_id: ${rosterObj.owner_id}, found user: ${!!user}, user data:`, user); // CRITICAL DEBUG LOG
                if (user) {
                    display = getDisplayTeamName(user.teamName || user.displayName);
                    avatar = getSleeperAvatarUrl(user.avatar);
                } else {
                    display = `Roster ${numericRosterId} (User not found)`;
                }
            } else {
                display = `Roster ${numericRosterId} (Roster not found)`;
            }
          } else {
              display = `Invalid Roster ID (${participantIdOrObject})`;
          }
      } else {
          // Default for undefined or null inputs
          display = 'TBD (No Participant)';
      }
      console.log(`  getParticipantInfo returning: Display: ${display}, Avatar: ${avatar}`); // CRITICAL DEBUG LOG
      return { display, avatar };
  }, [getRosterById, users, getDisplayTeamName]);

  // Update selectedWeek when the season or matchups data changes
  useEffect(() => {
    console.log('SeasonMatchups useEffect [season, matchups] triggered.');
    if (Object.keys(matchups).length > 0) {
      const latestWeek = Math.max(...Object.keys(matchups).map(Number));
      if (String(latestWeek) !== selectedWeek) {
        setSelectedWeek(String(latestWeek));
        console.log(`  setSelectedWeek to: ${latestWeek}`);
      } else {
        console.log(`  selectedWeek already set to: ${selectedWeek}, no update needed.`);
      }
    } else {
      if (selectedWeek !== '') {
        setSelectedWeek('');
        console.log('  matchups is empty, setting selectedWeek to empty.');
      } else {
        console.log('  matchups is empty and selectedWeek is already empty.');
      }
    }
  }, [season, matchups, selectedWeek]);


  if (!season || !leagueId || Object.keys(matchups).length === 0) {
    console.log(`SeasonMatchups: Displaying "No matchup data available" for ${season}.`);
    return (
      <div className="text-center p-4 text-gray-600">
        No matchup data available for {season}.
      </div>
    );
  }

  const availableWeeks = Object.keys(matchups).sort((a, b) => Number(a) - Number(b));
  const currentWeekMatchups = selectedWeek ? matchups[selectedWeek] : [];

  console.log(`SeasonMatchups: availableWeeks: ${availableWeeks.join(', ')}, currentWeekMatchups length: ${currentWeekMatchups.length}`);
  console.log('SeasonMatchups: currentWeekMatchups content:', currentWeekMatchups); // CRITICAL DEBUG LOG

  return (
    <div className="p-4">
      <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
        {season} Season Matchups
      </h3>

      <div className="mb-6 flex flex-col md:flex-row items-center justify-start space-y-4 md:space-y-0 md:space-x-4">
        <label htmlFor="week-select" className="font-semibold text-gray-700">Select Week:</label>
        <select
          id="week-select"
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
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
            console.log("  Mapping individual matchup:", matchup); // CRITICAL DEBUG LOG

            // Defensive checks before passing to getParticipantInfo
            const team1Id = matchup && matchup.t1 !== undefined ? matchup.t1 : null;
            const team2Id = matchup && matchup.t2 !== undefined ? matchup.t2 : null;
            const winnerId = matchup && matchup.w !== undefined ? matchup.w : null;


            const team1Info = getParticipantInfo(team1Id);
            const team2Info = getParticipantInfo(team2Id);

            let winningTeamDisplay = 'TBD';
            let winningTeamAvatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD';

            if (winnerId) { // Only try to resolve if winnerId exists
                const winnerRoster = getRosterById(winnerId);
                if (winnerRoster) {
                    const winnerUser = users[winnerRoster.owner_id];
                    if (winnerUser) {
                        winningTeamDisplay = getDisplayTeamName(winnerUser.teamName || winnerUser.displayName);
                        winningTeamAvatar = getSleeperAvatarUrl(winnerUser.avatar);
                    } else {
                        console.warn(`Could not find user data for winning roster owner_id: ${winnerRoster.owner_id}`); // DEBUG
                    }
                } else {
                    console.warn(`Could not find roster for winner ID: ${winnerId}`); // DEBUG
                }
            } else {
                console.log(`No winner ID (matchup.w) present for matchup ${matchup.m}.`); // DEBUG
            }


            return (
              <div key={matchup.m} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <p className="text-md font-semibold text-gray-800 mb-2">Match {matchup.m} (Round {matchup.r || 'N/A'})</p>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <img src={team1Info.avatar} alt={team1Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700">{team1Info.display}</span>
                  </div>
                  <span className="font-bold text-lg text-gray-800">VS</span>
                  <div className="flex items-center space-x-2">
                    <img src={team2Info.avatar} alt={team2Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700">{team2Info.display}</span>
                  </div>
                </div>
                <div className="mt-3 text-center text-sm">
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
