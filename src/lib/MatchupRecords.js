// src/lib/MatchupRecords.js
import React, { useState, useEffect } from 'react';

const MatchupRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedMatchupRecords, setAggregatedMatchupRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedMatchupRecords({});
      return;
    }

    // Initialize aggregated records with values for finding min/max
    const newAggregatedRecords = {
      mostPointsScored: { value: -Infinity, entries: [] }, // team, score, matchup, year, week
      fewestPointsScored: { value: Infinity, entries: [] }, // team, score, matchup, year, week
      highestCombinedScore: { value: -Infinity, entries: [] }, // combinedScore, matchup, year, week
      lowestCombinedScore: { value: Infinity, entries: [] }, // combinedScore, matchup, year, week
      biggestBlowout: { value: -Infinity, entries: [] }, // margin, winner, loser, matchup, year, week
      slimmestWin: { value: Infinity, entries: [] }, // margin, winner, loser, matchup, year, week
    };

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid matchups
      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data in MatchupRecords:', match);
        return;
      }

      const combinedScore = team1Score + team2Score;
      const scoreDifference = Math.abs(team1Score - team2Score);
      const isTie = team1Score === team2Score;

      let winner = '';
      let loser = '';
      if (!isTie) {
        winner = team1Score > team2Score ? team1 : team2;
        loser = team1Score > team2Score ? team2 : team1;
      }

      // Helper to update a record
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

      // --- Update Records ---

      // Most Points Scored by a team
      updateRecord(newAggregatedRecords.mostPointsScored, team1Score, { team: team1, score: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week });
      updateRecord(newAggregatedRecords.mostPointsScored, team2Score, { team: team2, score: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week });

      // Fewest Points Scored by a team
      updateRecord(newAggregatedRecords.fewestPointsScored, team1Score, { team: team1, score: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week }, true);
      updateRecord(newAggregatedRecords.fewestPointsScored, team2Score, { team: team2, score: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week }, true);

      // Highest Combined Score
      updateRecord(newAggregatedRecords.highestCombinedScore, combinedScore, { combinedScore: combinedScore, matchup: `${team1} vs ${team2}`, year: year, week: week });

      // Lowest Combined Score
      updateRecord(newAggregatedRecords.lowestCombinedScore, combinedScore, { combinedScore: combinedScore, matchup: `${team1} vs ${team2}`, year: year, week: week }, true);

      // Biggest Blowout (largest absolute score difference in a non-tied game)
      if (!isTie) {
        updateRecord(newAggregatedRecords.biggestBlowout, scoreDifference, { margin: scoreDifference, winner: winner, loser: loser, matchup: `${team1} vs ${team2}`, year: year, week: week });
      }

      // Slimmest Win (smallest positive score difference)
      if (!isTie && scoreDifference > 0) { // Ensure it's a win and not a tie
        updateRecord(newAggregatedRecords.slimmestWin, scoreDifference, { margin: scoreDifference, winner: winner, loser: loser, matchup: `${team1} vs ${team2}`, year: year, week: week }, true);
      }
    });

    // Clean up: filter out initial -Infinity/Infinity values if no data for a category
    Object.keys(newAggregatedRecords).forEach(key => {
        const record = newAggregatedRecords[key];
        if (record.value === -Infinity || record.value === Infinity) {
            record.value = 0; // Default to 0 for display if no data
            record.entries = [];
        }
    });

    setAggregatedMatchupRecords(newAggregatedRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to format values for display
  const formatDisplayValue = (value, recordKey) => {
    if (['mostPointsScored', 'fewestPointsScored', 'highestCombinedScore', 'lowestCombinedScore', 'biggestBlowout', 'slimmestWin'].includes(recordKey)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value;
  };

  // Define the order and labels for the records to display
  const recordsToDisplay = [
    { key: 'mostPointsScored', label: 'Most Points Scored by a Team' },
    { key: 'fewestPointsScored', label: 'Fewest Points Scored by a Team' },
    { key: 'highestCombinedScore', label: 'Highest Combined Score' },
    { key: 'lowestCombinedScore', label: 'Lowest Combined Score' },
    { key: 'biggestBlowout', label: 'Biggest Blowout' },
    { key: 'slimmestWin', label: 'Slimmest Win' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">MATCHUP RECORD HOLDERS - ( GAME )</h3>
      <p className="text-sm text-gray-600 mb-6">Records based on individual game performances across all seasons.</p>

      {Object.keys(aggregatedMatchupRecords).length === 0 && (
        <p className="text-center text-gray-600">No matchup data available to display records.</p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-2/5">Matchup</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/10">Season</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/10">Week</th>
            </tr>
          </thead>
          <tbody>
            {recordsToDisplay.map((recordDef) => {
              const recordData = aggregatedMatchupRecords[recordDef.key];
              if (!recordData || recordData.entries.length === 0) {
                return (
                  <tr key={recordDef.key}>
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                    <td colSpan="4" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                  </tr>
                );
              }

              // Display all tied entries for the record
              return recordData.entries.map((entry, index) => (
                <tr key={`${recordDef.key}-${index}`} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                    {index === 0 ? recordDef.label : ''} {/* Only show label for the first entry if multiple */}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDisplayValue(recordData.value, recordDef.key)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    {recordDef.key === 'mostPointsScored' || recordDef.key === 'fewestPointsScored' ?
                        `${entry.team} (${entry.score.toFixed(2)}) in ${entry.matchup}` :
                    recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin' ?
                        `${entry.winner} def. ${entry.loser} by ${entry.margin.toFixed(2)} pts in ${entry.matchup}` :
                        `${entry.matchup}`
                    }
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-700">{entry.year}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{entry.week}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MatchupRecords;
