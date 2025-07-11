// src/lib/PlayoffRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook

const PlayoffRecords = ({ historicalMatchups }) => { // Removed getDisplayTeamName from props as it's now from context
  const { historicalData, getTeamName, loading, error } = useSleeperData(); // Get historicalData and getTeamName from context
  const [aggregatedPlayoffRecords, setAggregatedPlayoffRecords] = useState({});

  useEffect(() => {
    if (loading || error || !historicalMatchups || historicalMatchups.length === 0 || !historicalData || !historicalData.rostersBySeason) {
      setAggregatedPlayoffRecords({});
      return;
    }

    // teamPlayoffStats will now be keyed by ownerId for consistent aggregation
    const teamPlayoffStats = {}; // { ownerId: { appearances: Set<year>, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, medals: { 1: 0, 2: 0, 3: 0 }, championships: 0 } }

    historicalMatchups.forEach((match, index) => {
      const year = parseInt(match.year);
      const team1RosterId = String(match.team1_roster_id);
      const team2RosterId = String(match.team2_roster_id);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Get owner IDs for consistent tracking across seasons
      const rosterForTeam1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId);
      const team1OwnerId = rosterForTeam1?.owner_id;
      const rosterForTeam2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId);
      const team2OwnerId = rosterForTeam2?.owner_id;

      // Basic validation for any playoff match
      if (!team1OwnerId || !team2OwnerId || isNaN(year) || isNaN(team1Score) || isNaN(team2Score) || !match.playoffs) {
        console.warn(`PlayoffRecords useEffect: Skipping match ${index} due to invalid data, not a playoff game, or missing owner IDs. Match:`, match, `Team1 Owner: ${team1OwnerId}, Team2 Owner: ${team2OwnerId}`);
        return;
      }

      // Initialize team stats if not present for any owner involved in a playoff game
      [team1OwnerId, team2OwnerId].forEach(ownerId => {
        if (!teamPlayoffStats[ownerId]) {
          teamPlayoffStats[ownerId] = {
            appearances: new Set(),
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            medals: { 1: 0, 2: 0, 3: 0 },
            championships: 0
          };
        }
      });

      // --- Track Playoff Appearances (ONLY for Winners Bracket games) ---
      // An appearance is counted if they played in a winners bracket playoff game in a season.
      if (match.isWinnersBracket) {
        teamPlayoffStats[team1OwnerId].appearances.add(year);
        teamPlayoffStats[team2OwnerId].appearances.add(year);
        console.log(`PlayoffRecords: Counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Winners Bracket). Match:`, match);
      } else if (match.isLosersBracket) {
          console.log(`PlayoffRecords: NOT counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Losers Bracket). Match:`, match);
      }


      // --- Track Wins/Losses/Ties, Points For/Against, Medals, Championships (ONLY for Winners Bracket games) ---
      if (match.isWinnersBracket) {
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (isTie) {
          teamPlayoffStats[team1OwnerId].ties++;
          teamPlayoffStats[team2OwnerId].ties++;
        } else if (team1Won) {
          teamPlayoffStats[team1OwnerId].wins++;
          teamPlayoffStats[team2OwnerId].losses++;
        } else { // team2Won
          teamPlayoffStats[team2OwnerId].wins++;
          teamPlayoffStats[team1OwnerId].losses++;
        }

        teamPlayoffStats[team1OwnerId].pointsFor += team1Score;
        teamPlayoffStats[team1OwnerId].pointsAgainst += team2Score;
        teamPlayoffStats[team2OwnerId].pointsFor += team2Score;
        teamPlayoffStats[team2OwnerId].pointsAgainst += team1Score;

        console.log(`PlayoffRecords: Processing winners bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}). Match:`, match);

        // Handle Medals and Championships based on finalSeedingGame
        if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
          let winnerOwnerId = '';
          let loserOwnerId = '';
          if (team1Won) {
            winnerOwnerId = team1OwnerId;
            loserOwnerId = team2OwnerId;
          } else if (team2Score > team1Score) {
            winnerOwnerId = team2OwnerId;
            loserOwnerId = team1OwnerId;
          }

          const finalPlacement = match.finalSeedingGame;

          if (finalPlacement === 1) { // Championship Game
            if (winnerOwnerId) {
              teamPlayoffStats[winnerOwnerId].medals[1]++;
              teamPlayoffStats[winnerOwnerId].championships++;
              if (loserOwnerId) {
                teamPlayoffStats[loserOwnerId].medals[2]++;
              }
            }
          } else if (finalPlacement === 3) { // 3rd Place Game
            if (winnerOwnerId) {
              teamPlayoffStats[winnerOwnerId].medals[3]++;
            }
          }
          // Can add logic for other final placements (e.g., 5th place) if desired
        }
      } else if (match.isLosersBracket) {
          console.log(`PlayoffRecords: Skipping losers bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) (only counting appearance). Match:`, match);
      }
    });

    // --- DEBUGGING: Log aggregated playoff stats for each team ---
    console.log("PlayoffRecords: Aggregated Playoff Stats Per Team:");
    Object.entries(teamPlayoffStats).forEach(([ownerId, stats]) => {
      // Use getTeamName(ownerId, null) to get the most current team name for display
      const currentTeamName = getTeamName(ownerId, null);
      console.log(`  Team: ${currentTeamName} (Owner ID: ${ownerId})`);
      console.log(`    Playoff Appearances: ${stats.appearances.size} (Years: ${Array.from(stats.appearances).join(', ')})`);
      console.log(`    Wins: ${stats.wins}`);
      console.log(`    Losses: ${stats.losses}`);
      console.log(`    Ties: ${stats.ties}`);
      console.log(`    Points For: ${stats.pointsFor.toFixed(2)}`);
      console.log(`    Points Against: ${stats.pointsAgainst.toFixed(2)}`);
      console.log(`    Championships: ${stats.championships}`);
      console.log(`    2nd Place Finishes: ${stats.medals[2]}`);
      console.log(`    3rd Place Finishes: ${stats.medals[3]}`);
    });
    // --- END DEBUGGING ---


    // Initialize aggregated records for top performers
    const newAggregatedRecords = {
      mostPlayoffAppearances: { value: 0, entries: [] }, // team, appearances
      mostPlayoffWins: { value: 0, entries: [] }, // team, wins
      totalPlayoffPoints: { value: 0, entries: [] }, // team, points
      mostPlayoffPointsAgainst: { value: 0, entries: [] },
      mostChampionships: { value: 0, entries: [] }, // team, championships
      most2ndPlaceFinishes: { value: 0, entries: [] }, // team, 2nd places
      most3rdPlaceFinishes: { value: 0, entries: [] }, // team, 3rd places
    };

    // Helper to update a record (max/min)
    const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
      if (typeof newValue !== 'number' || isNaN(newValue)) return; // Ensure value is a number

      if (isMin) {
        if (newValue < recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          // Prevent duplicates for ties
          if (!recordObj.entries.some(e => e.team === entryDetails.team)) {
            recordObj.entries.push(entryDetails);
          }
        }
      } else { // Max
        if (newValue > recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          // Prevent duplicates for ties
          if (!recordObj.entries.some(e => e.team === entryDetails.team)) {
            recordObj.entries.push(entryDetails);
          }
        }
      }
    };

    // Populate aggregated records from teamPlayoffStats
    Object.keys(teamPlayoffStats).forEach(ownerId => { // Iterate through ownerIds
      const stats = teamPlayoffStats[ownerId];
      const currentTeamName = getTeamName(ownerId, null); // Get the current team name for display

      updateRecord(newAggregatedRecords.mostPlayoffAppearances, stats.appearances.size, { team: currentTeamName, appearances: stats.appearances.size });
      updateRecord(newAggregatedRecords.mostPlayoffWins, stats.wins, { team: currentTeamName, wins: stats.wins });
      updateRecord(newAggregatedRecords.totalPlayoffPoints, stats.pointsFor, { team: currentTeamName, points: stats.pointsFor });
      updateRecord(newAggregatedRecords.mostPlayoffPointsAgainst, stats.pointsAgainst, { team: currentTeamName, pointsAgainst: stats.pointsAgainst });
      updateRecord(newAggregatedRecords.mostChampionships, stats.championships, { team: currentTeamName, championships: stats.championships });
      updateRecord(newAggregatedRecords.most2ndPlaceFinishes, stats.medals[2], { team: currentTeamName, place: stats.medals[2] });
      updateRecord(newAggregatedRecords.most3rdPlaceFinishes, stats.medals[3], { team: currentTeamName, place: stats.medals[3] });
    });

    // Clean up: filter out initial -Infinity/Infinity values, sort entries
    Object.keys(newAggregatedRecords).forEach(key => {
        const record = newAggregatedRecords[key];
        // If a record has -Infinity or Infinity value and no entries, it means no valid record was found
        if ((record.value === -Infinity || record.value === Infinity) && record.entries.length === 0) {
            record.value = 0; // Default to 0 for display if no data
            record.entries = [];
        } else if (record.value === Infinity) { // If it's still Infinity, means no data, set to N/A for display
            record.value = 'N/A';
        }

        // Sort entries consistently for tied records
        if (record.entries.length > 1) {
            record.entries.sort((a, b) => {
                const teamCompare = (a.team || '').localeCompare(b.team || '');
                if (teamCompare !== 0) return teamCompare;
                // If teams are the same, order by value (desc for most, asc for lowest)
                // The value to compare depends on the record key, e.g., 'appearances', 'wins', 'points', etc.
                let valueA, valueB;
                if (key === 'mostPlayoffAppearances') {
                    valueA = a.appearances;
                    valueB = b.appearances;
                } else if (key === 'mostPlayoffWins') {
                    valueA = a.wins;
                    valueB = b.wins;
                } else if (key === 'totalPlayoffPoints') {
                    valueA = a.points;
                    valueB = b.points;
                } else if (key === 'mostPlayoffPointsAgainst') {
                    valueA = a.pointsAgainst;
                    valueB = b.pointsAgainst;
                } else if (key === 'mostChampionships') {
                    valueA = a.championships;
                    valueB = b.championships;
                } else if (key === 'most2ndPlaceFinishes' || key === 'most3rdPlaceFinishes') {
                    valueA = a.place;
                    valueB = b.place;
                } else {
                    valueA = a.value; // Fallback to general 'value' if specific key not found
                    valueB = b.value;
                }

                if (typeof valueA === 'number' && typeof valueB === 'number') {
                    return valueB - valueA; // Always descending for "most" records
                }
                return 0;
            });
        }
    });

    setAggregatedPlayoffRecords(newAggregatedRecords);
  }, [historicalMatchups, historicalData, getTeamName, loading, error]); // Add historicalData, loading, error to dependencies

  // Helper to format values for display
  const formatDisplayValue = (value, recordKey) => {
    if (value === 'N/A') return value;
    if (recordKey.includes('points') || recordKey === 'totalPlayoffPoints' || recordKey === 'mostPlayoffPointsAgainst') {
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value;
  };

  const recordsToDisplay = [
    { key: 'mostPlayoffAppearances', label: 'Most Playoff Appearances' },
    { key: 'mostPlayoffWins', label: 'Most Playoff Wins' },
    { key: 'totalPlayoffPoints', label: 'Total Playoff Points For' },
    { key: 'mostPlayoffPointsAgainst', label: 'Most Playoff Points Against Total' },
    { key: 'mostChampionships', label: 'Most Championships' },
    { key: 'most2ndPlaceFinishes', label: 'Most 2nd Place Finishes' },
    { key: 'most3rdPlaceFinishes', label: 'Most 3rd Place Finishes' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">ALL-TIME PLAYOFF RECORD HOLDERS</h3>
      <p className="text-sm text-gray-600 mb-6">Historical playoff performance records.</p>

      {Object.keys(aggregatedPlayoffRecords).length === 0 || recordsToDisplay.every(r => aggregatedPlayoffRecords[r.key]?.entries.length === 0) ? (
        <p className="text-center text-gray-600">No playoff data available to display records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/2">Team</th>
              </tr>
            </thead>
            <tbody>
              {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                const recordData = aggregatedPlayoffRecords[recordDef.key];
                if (!recordData || recordData.entries.length === 0) {
                  return (
                    <tr key={recordDef.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                      <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                    </tr>
                  );
                }
                return recordData.entries.map((entry, entryIndex) => (
                  <tr
                    key={`${recordDef.key}-${entry.team}-${entryIndex}`}
                    className={`
                      ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      ${entryIndex === recordData.entries.length - 1 ? 'border-b border-gray-100' : ''}
                    `}
                  >
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                      {entryIndex === 0 ? recordDef.label : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800">
                      {entryIndex === 0 ? formatDisplayValue(recordData.value, recordDef.key) : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.team}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayoffRecords;
