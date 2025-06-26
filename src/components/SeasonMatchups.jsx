// src/components/SeasonMatchups.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';

const SeasonMatchups = ({ season, leagueId, matchups, users, rosters, getDisplayTeamName }) => {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [processedMatchups, setProcessedMatchups] = useState({}); // New state for processed matchups

  console.log(`SeasonMatchups: Render for season ${season}, selectedWeek: ${selectedWeek}`);
  console.log('SeasonMatchups: Received raw matchups prop:', matchups);

  // Helper to get roster by ID (necessary for t1/t2 which are roster_ids)
  // Memoized to prevent unnecessary re-creations
  const getRosterById = useCallback((rosterId) => {
    if (typeof rosterId === 'number' && rosterId > 0) {
      const foundRoster = rosters.find(r => r.roster_id === rosterId);
      // console.log(`  getRosterById(${rosterId}): Found ${foundRoster ? 'roster' : 'nothing'}`); // Debugging log
      return foundRoster;
    }
    // console.log(`  getRosterById(${rosterId}): Invalid rosterId type or value: ${rosterId}`); // Debugging log
    return null;
  }, [rosters]); // Dependency on 'rosters' prop

  // Memoized helper to get participant info (display name and avatar)
  const getParticipantInfo = useCallback((participantIdOrObject) => {
      let display = 'TBD';
      let avatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD';

      // console.log("  getParticipantInfo called with participantIdOrObject:", participantIdOrObject); // Debugging log

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
          // This case handles direct roster IDs (should be a number or string that can be parsed)
          const numericRosterId = Number(participantIdOrObject);
          if (!isNaN(numericRosterId) && numericRosterId > 0) {
            const rosterObj = getRosterById(numericRosterId);
            if (rosterObj) {
                const user = users[rosterObj.owner_id];
                // console.log(`    Resolved roster ${numericRosterId}, owner_id: ${rosterObj.owner_id}, found user: ${!!user}, user data:`, user); // Debugging log
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
      // console.log(`  getParticipantInfo returning: Display: ${display}, Avatar: ${avatar}`); // Debugging log
      return { display, avatar };
  }, [getRosterById, users, getDisplayTeamName]);

  // Effect to process raw matchups into a more usable format (group by matchup_id)
  useEffect(() => {
    console.log('SeasonMatchups: Processing raw matchups...');
    const groupedMatchups = {}; // Store processed matchups here: { week: [ {team1_id, team2_id, ...} ] }

    for (const week in matchups) {
      if (Object.prototype.hasOwnProperty.call(matchups, week)) {
        const weekData = matchups[week];
        const currentWeekProcessed = {}; // { matchup_id: { roster1, roster2 } }

        weekData.forEach(entry => {
          if (!currentWeekProcessed[entry.matchup_id]) {
            currentWeekProcessed[entry.matchup_id] = [];
          }
          currentWeekProcessed[entry.matchup_id].push(entry);
        });

        const weekMatchupsArray = Object.values(currentWeekProcessed).map(matchupPair => {
          // matchupPair will be an array of two roster entries for a given matchup_id
          const team1Entry = matchupPair[0];
          const team2Entry = matchupPair[1]; // Should always have two entries for a completed matchup

          // Determine the winner based on points if not explicitly provided by 'w'
          let winnerRosterId = null;
          if (team1Entry.w) { // 'w' property exists in playoff matchups
              winnerRosterId = team1Entry.w;
          } else if (team1Entry.points !== undefined && team2Entry.points !== undefined) {
              winnerRosterId = team1Entry.points > team2Entry.points ? team1Entry.roster_id : team2Entry.roster_id;
          }

          return {
            m: team1Entry.matchup_id, // Matchup ID
            r: team1Entry.leg, // Round/Week (Sleeper uses 'leg' for week number in matchups)
            t1: team1Entry.roster_id, // Roster ID of team 1
            t2: team2Entry ? team2Entry.roster_id : null, // Roster ID of team 2, or null if only one entry
            t1_points: team1Entry.points,
            t2_points: team2Entry ? team2Entry.points : null,
            w: winnerRosterId, // Winner roster ID
            // Add other relevant properties from raw entries if needed, e.g., metadata
            rawTeam1: team1Entry,
            rawTeam2: team2Entry
          };
        }).filter(matchup => matchup.t1 && matchup.t2); // Only include full matchups

        groupedMatchups[week] = weekMatchupsArray;
      }
    }
    setProcessedMatchups(groupedMatchups);
    console.log('SeasonMatchups: Finished processing matchups. Result:', groupedMatchups);
  }, [matchups]); // Re-run when the raw 'matchups' prop changes

  // Update selectedWeek when the season or processed matchups data changes
  useEffect(() => {
    console.log('SeasonMatchups useEffect [season, processedMatchups] triggered.');
    if (Object.keys(processedMatchups).length > 0) {
      const latestWeek = Math.max(...Object.keys(processedMatchups).map(Number));
      if (String(latestWeek) !== selectedWeek) {
        setSelectedWeek(String(latestWeek));
        console.log(`  setSelectedWeek to: ${latestWeek}`);
      } else {
        console.log(`  selectedWeek already set to: ${selectedWeek}, no update needed.`);
      }
    } else {
      if (selectedWeek !== '') {
        setSelectedWeek('');
        console.log('  processedMatchups is empty, setting selectedWeek to empty.');
      } else {
        console.log('  processedMatchups is empty and selectedWeek is already empty.');
      }
    }
  }, [season, processedMatchups, selectedWeek]);


  if (!season || !leagueId || Object.keys(processedMatchups).length === 0) {
    console.log(`SeasonMatchups: Displaying "No matchup data available" for ${season}.`);
    return (
      <div className="text-center p-4 text-gray-600">
        No matchup data available for {season}.
      </div>
    );
  }

  const availableWeeks = Object.keys(processedMatchups).sort((a, b) => Number(a) - Number(b));
  const currentWeekMatchups = selectedWeek ? processedMatchups[selectedWeek] : [];

  console.log(`SeasonMatchups: availableWeeks: ${availableWeeks.join(', ')}, currentWeekMatchups length: ${currentWeekMatchups.length}`);
  console.log('SeasonMatchups: currentWeekMatchups content (processed):', currentWeekMatchups);

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
            console.log("  Mapping individual processed matchup:", matchup); // Critical debug log for processed data

            // Now matchup has t1, t2, and w as direct roster_ids
            const team1Info = getParticipantInfo(matchup.t1);
            const team2Info = getParticipantInfo(matchup.t2);

            let winningTeamDisplay = 'TBD';
            let winningTeamAvatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD';

            if (matchup.w) { // matchup.w is now the roster_id of the winner
                const winnerRoster = getRosterById(matchup.w);
                if (winnerRoster) {
                    const winnerUser = users[winnerRoster.owner_id];
                    if (winnerUser) {
                        winningTeamDisplay = getDisplayTeamName(winnerUser.teamName || winnerUser.displayName);
                        winningTeamAvatar = getSleeperAvatarUrl(winnerUser.avatar);
                    } else {
                        console.warn(`Could not find user data for winning roster owner_id: ${winnerRoster.owner_id}`);
                    }
                } else {
                    console.warn(`Could not find roster for winner ID: ${matchup.w}`);
                }
            } else if (matchup.t1_points !== null && matchup.t2_points !== null) {
                // If no explicit winner 'w' but points exist, determine winner
                if (matchup.t1_points > matchup.t2_points) {
                    const winnerRoster = getRosterById(matchup.t1);
                    if (winnerRoster) {
                        const winnerUser = users[winnerRoster.owner_id];
                        winningTeamDisplay = getDisplayTeamName(winnerUser?.teamName || winnerUser?.displayName);
                        winningTeamAvatar = getSleeperAvatarUrl(winnerUser?.avatar);
                    }
                } else if (matchup.t2_points > matchup.t1_points) {
                    const winnerRoster = getRosterById(matchup.t2);
                    if (winnerRoster) {
                        const winnerUser = users[winnerRoster.owner_id];
                        winningTeamDisplay = getDisplayTeamName(winnerUser?.teamName || winnerUser?.displayName);
                        winningTeamAvatar = getSleeperAvatarUrl(winnerUser?.avatar);
                    }
                }
            }


            return (
              <div key={matchup.m} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <p className="text-md font-semibold text-gray-800 mb-2">Match {matchup.m} (Round {matchup.r || 'N/A'})</p>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex flex-col items-center space-y-1">
                    <img src={team1Info.avatar} alt={team1Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700 text-center">{team1Info.display}</span>
                    <span className="text-sm font-bold text-blue-800">{matchup.t1_points !== null ? matchup.t1_points.toFixed(2) : 'N/A'}</span>
                  </div>
                  <span className="font-bold text-lg text-gray-800 mx-2">VS</span>
                  <div className="flex flex-col items-center space-y-1">
                    <img src={team2Info.avatar} alt={team2Info.display} className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                    <span className="font-medium text-gray-700 text-center">{team2Info.display}</span>
                    <span className="text-sm font-bold text-blue-800">{matchup.t2_points !== null ? matchup.t2_points.toFixed(2) : 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-3 text-center text-sm">
                  {matchup.w || (matchup.t1_points !== null && matchup.t2_points !== null && matchup.t1_points !== matchup.t2_points) ? (
                    <p className="text-green-700 font-bold flex items-center justify-center">
                      Winner:
                      <img src={winningTeamAvatar} alt={winningTeamDisplay} className="w-6 h-6 rounded-full ml-2 mr-1" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; }} />
                      {winningTeamDisplay}
                    </p>
                  ) : (
                    <p className="text-gray-500 italic">Match not yet played or tie.</p>
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
