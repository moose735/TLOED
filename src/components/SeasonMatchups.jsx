// src/components/SeasonMatchups.jsx
import React, { useState, useEffect } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';

const SeasonMatchups = ({ season, leagueId, matchups, users, rosters, getDisplayTeamName }) => {
  const [selectedWeek, setSelectedWeek] = useState('');

  // Update selectedWeek when the season or matchups data changes
  useEffect(() => {
    if (Object.keys(matchups).length > 0) {
      // Set initial selected week to the latest week available in the matchups data
      const latestWeek = Math.max(...Object.keys(matchups).map(Number));
      setSelectedWeek(String(latestWeek));
    } else {
      setSelectedWeek('');
    }
  }, [season, matchups]);

  if (!season || !leagueId || Object.keys(matchups).length === 0) {
    return (
      <div className="text-center p-4 text-gray-600">
        No matchup data available for {season}.
      </div>
    );
  }

  const availableWeeks = Object.keys(matchups).sort((a, b) => Number(a) - Number(b));
  const currentWeekMatchups = selectedWeek ? matchups[selectedWeek] : [];

  // Helper to get roster by ID (necessary for t1/t2 which are roster_ids)
  const getRosterById = (rosterId) => {
    return rosters.find(r => r.roster_id === rosterId);
  };

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
            const team1Roster = getRosterById(matchup.r === 1 ? matchup.t1 : matchup.t1?.roster_id || matchup.t1);
            const team2Roster = getRosterById(matchup.r === 1 ? matchup.t2 : matchup.t2?.roster_id || matchup.t2);

            // In playoffs, t1/t2 can be objects like {w: 1} or {l: 2}
            // For regular season (r=1), t1/t2 are direct roster_ids.
            // For playoff rounds (r > 1), t1/t2 can be direct roster_ids OR objects
            const getParticipantInfo = (participantIdOrObject, fromType) => {
                let rosterObj = null;
                let display = 'TBD';
                let avatar = 'https://placehold.co/50x50/cccccc/000000?text=TBD'; // Default TBD avatar

                if (typeof participantIdOrObject === 'object' && participantIdOrObject !== null) {
                    // This is a playoff progression link {w: matchId} or {l: matchId}
                    const matchId = participantIdOrObject.w || participantIdOrObject.l;
                    display = `${fromType.toUpperCase()} of Match ${matchId}`;
                } else if (participantIdOrObject !== null && participantIdOrObject !== undefined) {
                    // This is a direct roster ID
                    rosterObj = getRosterById(participantIdOrObject);
                    if (rosterObj) {
                        const user = users[rosterObj.owner_id];
                        display = getDisplayTeamName(user?.teamName || user?.displayName);
                        avatar = user ? getSleeperAvatarUrl(user.avatar) : avatar;
                    } else {
                        display = `Roster ${participantIdOrObject}`;
                    }
                }
                return { display, avatar, rosterObj };
            };

            const team1Info = getParticipantInfo(matchup.t1, matchup.t1_from ? Object.keys(matchup.t1_from)[0] : 'seed');
            const team2Info = getParticipantInfo(matchup.t2, matchup.t2_from ? Object.keys(matchup.t2_from)[0] : 'seed');


            const winningTeamRoster = matchup.w ? getRosterById(matchup.w) : null;
            const winningTeamName = winningTeamRoster ? getDisplayTeamName(users[winningTeamRoster.owner_id]?.teamName || users[winningTeamRoster.owner_id]?.displayName) : 'TBD';
            const winningTeamAvatar = winningTeamRoster && users[winningTeamRoster.owner_id] ? getSleeperAvatarUrl(users[winningTeamRoster.owner_id].avatar) : 'https://placehold.co/50x50/cccccc/000000?text=TBD';

            return (
              <div key={matchup.m} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <p className="text-md font-semibold text-gray-800 mb-2">Match {matchup.m} (Round {matchup.r})</p>
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
                    <p className="text-green-700 font-bold">Winner: {winningTeamName}</p>
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
