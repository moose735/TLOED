// src/lib/PlayoffRecords.js
import React, { useState, useEffect } from 'react';

const PlayoffRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedPlayoffRecords, setAggregatedPlayoffRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedPlayoffRecords({});
      return;
    }

    const teamPlayoffStats = {}; // { teamName: { appearances: Set<year>, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, medals: { 1: 0, 2: 0, 3: 0 }, championships: 0 } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid matchups or non-playoff games
      if (!team1 || !team2 || isNaN(year) || isNaN(team1Score) || isNaN(team2Score) || !match.playoffs) {
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize team stats if not present
      [team1, team2].forEach(team => {
        if (!teamPlayoffStats[team]) {
          teamPlayoffStats[team] = {
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

      // Track Playoff Appearances
      teamPlayoffStats[team1].appearances.add(year);
      teamPlayoffStats[team2].appearances.add(year);

      // Track Playoff Wins/Losses/Ties, Points For/Against
      if (isTie) {
        teamPlayoffStats[team1].ties++;
        teamPlayoffStats[team2].ties++;
      } else if (team1Won) {
        teamPlayoffStats[team1].wins++;
        teamPlayoffStats[team2].losses++;
      } else { // team2Won
        teamPlayoffStats[team2].wins++;
        teamPlayoffStats[team1].losses++;
      }

      teamPlayoffStats[team1].pointsFor += team1Score;
      teamPlayoffStats[team1].pointsAgainst += team2Score;
      teamPlayoffStats[team2].pointsFor += team2Score;
      teamPlayoffStats[team2].pointsAgainst += team1Score;

      // Handle Medals and Championships based on finalSeedingGame
      if (match.finalSeedingGame) {
        let winner = '';
        let loser = '';
        if (team1Won) {
          winner = team1;
          loser = team2;
        } else if (team2Score > team1Score) {
          winner = team2;
          loser = team1;
        }

        const finalPlacement = parseInt(match.finalSeedingGame);
        if (!isNaN(finalPlacement)) {
          if (finalPlacement === 1) {
            if (winner) { // If there's a winner (not a tie for 1st)
              teamPlayoffStats[winner].medals[1]++;
              teamPlayoffStats[winner].championships++;
              if (loser) { // The loser of the 1st place game gets 2nd place
                teamPlayoffStats[loser].medals[2]++;
              }
            }
          } else if (finalPlacement === 3) {
            if (winner) { // Winner of the 3rd place game gets 3rd place
              teamPlayoffStats[winner].medals[3]++;
            }
          }
          // Can add logic for other final placements (e.g., 5th place) if desired
        }
      }
    });

    // Initialize aggregated records for top performers
    const newAggregatedRecords = {
      mostPlayoffAppearances: { value: 0, entries: [] }, // team, appearances
      mostPlayoffWins: { value: 0, entries: [] }, // team, wins
      totalPlayoffPoints: { value: 0, entries: [] }, // team, points
      mostPlayoffPointsAgainst: { value: -Infinity, entries: [] }, // Changed to Most, initialized to -Infinity
      mostChampionships: { value: 0, entries: [] }, // team, championships
      most2ndPlaceFinishes: { value: 0, entries: [] }, // team, 2nd places
      most3rdPlaceFinishes: { value: 0, entries: [] }, // team, 3rd places
    };

    // Helper to update a record (max/min)
    const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
      if (isMin) {
        if (newValue < recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      } else {
        if (newValue > recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      }
    };

    // Populate aggregated records from teamPlayoffStats
    Object.keys(teamPlayoffStats).forEach(team => {
      const stats = teamPlayoffStats[team];

      updateRecord(newAggregatedRecords.mostPlayoffAppearances, stats.appearances.size, { team, appearances: stats.appearances.size });
      updateRecord(newAggregatedRecords.mostPlayoffWins, stats.wins, { team, wins: stats.wins });
      updateRecord(newAggregatedRecords.totalPlayoffPoints, stats.pointsFor, { team, points: stats.pointsFor });
      updateRecord(newAggregatedRecords.mostPlayoffPointsAgainst, stats.pointsAgainst, { team, pointsAgainst: stats.pointsAgainst }); // Removed 'true' for isMin
      updateRecord(newAggregatedRecords.mostChampionships, stats.championships, { team, championships: stats.championships });
      updateRecord(newAggregatedRecords.most2ndPlaceFinishes, stats.medals[2], { team, place: stats.medals[2] });
      updateRecord(newAggregatedRecords.most3rdPlaceFinishes, stats.medals[3], { team, place: stats.medals[3] });
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
                // If teams are the same, order by value if necessary
                if (record.value === 'N/A' || isNaN(record.value)) return 0; // Can't sort by value if N/A
                return b.value - a.value; // Descending for most, ascending for lowest
            });
        }
    });

    setAggregatedPlayoffRecords(newAggregatedRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to format values for display
  const formatDisplayValue = (value, recordKey) => {
    if (value === 'N/A') return value;
    if (recordKey.includes('points') || recordKey === 'totalPlayoffPoints' || recordKey === 'mostPlayoffPointsAgainst') { // Ensure pointsAgainst is covered
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value;
  };

  const recordsToDisplay = [
    { key: 'mostPlayoffAppearances', label: 'Most Playoff Appearances' },
    { key: 'mostPlayoffWins', label: 'Most Playoff Wins' },
    { key: 'totalPlayoffPoints', label: 'Total Playoff Points For' },
    { key: 'mostPlayoffPointsAgainst', label: 'Most Playoff Points Against Total' }, // Changed label
    { key: 'mostChampionships', label: 'Most Championships' },
    { key: 'most2ndPlaceFinishes', label: 'Most 2nd Place Finishes' },
    { key: 'most3rdPlaceFinishes', label: 'Most 3rd Place Finishes' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">PLAYOFF RECORD HOLDERS - ( SEASON )</h3>
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
