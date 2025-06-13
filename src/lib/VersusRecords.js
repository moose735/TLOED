// src/lib/VersusRecords.js
import React, { useState, useEffect } from 'react';

const VersusRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedVersusRecords, setAggregatedVersusRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedVersusRecords({});
      return;
    }

    const teamToOpponentStats = {}; // { teamName: { opponentName: { wins, losses, ties, totalPF, totalPA, games: [{ year, week, isWin, isLoss, isTie, scoreDiff }] } } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid matchups
      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data in VersusRecords:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

      // Helper to initialize team-opponent structure
      const initH2H = (team, opponent) => {
        if (!teamToOpponentStats[team]) teamToOpponentStats[team] = {};
        if (!teamToOpponentStats[team][opponent]) {
          teamToOpponentStats[team][opponent] = {
            wins: 0,
            losses: 0,
            ties: 0,
            totalPF: 0,
            totalPA: 0,
            games: [] // Stores individual game results for streak tracking
          };
        }
      };

      // Update for Team 1 vs Team 2
      initH2H(team1, team2);
      if (isTie) {
        teamToOpponentStats[team1][team2].ties++;
      } else if (team1Won) {
        teamToOpponentStats[team1][team2].wins++;
      } else {
        teamToOpponentStats[team1][team2].losses++;
      }
      teamToOpponentStats[team1][team2].totalPF += team1Score;
      teamToOpponentStats[team1][team2].totalPA += team2Score;
      teamToOpponentStats[team1][team2].games.push({
        year, week,
        isWin: team1Won,
        isLoss: team2Won, // isLoss for team1
        isTie: isTie,
        scoreDiff: team1Score - team2Score
      });

      // Update for Team 2 vs Team 1 (mirror)
      initH2H(team2, team1);
      if (isTie) {
        teamToOpponentStats[team2][team1].ties++;
      } else if (team2Won) {
        teamToOpponentStats[team2][team1].wins++;
      } else {
        teamToOpponentStats[team2][team1].losses++;
      }
      teamToOpponentStats[team2][team1].totalPF += team2Score;
      teamToOpponentStats[team2][team1].totalPA += team1Score;
      teamToOpponentStats[team2][team1].games.push({
        year, week,
        isWin: team2Won,
        isLoss: team1Won, // isLoss for team2
        isTie: isTie,
        scoreDiff: team2Score - team1Score
      });
    });

    // Initialize aggregated records
    const newAggregatedRecords = {
      mostWinsVsOpponent: { value: -Infinity, entries: [] }, // { team, opponent, wins }
      bestNetMarginVsOpponent: { value: -Infinity, entries: [] }, // { team, opponent, margin }
      highestAvgNetMarginVsOpponent: { value: -Infinity, entries: [] }, // { team, opponent, avgMargin, minGames }
      longestCurrentWinningStreak: { value: -Infinity, entries: [] }, // { team, opponent, streak }
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

    // Process teamToOpponentStats to find top records
    Object.keys(teamToOpponentStats).forEach(team => {
      Object.keys(teamToOpponentStats[team]).forEach(opponent => {
        const stats = teamToOpponentStats[team][opponent];
        const totalGames = stats.wins + stats.losses + stats.ties;

        if (totalGames === 0) return; // Skip if no games played

        // Most Wins vs Single Opponent
        updateRecord(newAggregatedRecords.mostWinsVsOpponent, stats.wins, { team, opponent, wins: stats.wins });

        // Best Net Margin vs Opponent
        const netMargin = stats.totalPF - stats.totalPA;
        updateRecord(newAggregatedRecords.bestNetMarginVsOpponent, netMargin, { team, opponent, margin: netMargin });

        // Highest Avg. Net Margin (require at least 3 games)
        const MIN_GAMES_FOR_AVG_MARGIN = 3;
        if (totalGames >= MIN_GAMES_FOR_AVG_MARGIN) {
          const avgNetMargin = netMargin / totalGames;
          updateRecord(newAggregatedRecords.highestAvgNetMarginVsOpponent, avgNetMargin, { team, opponent, avgMargin: avgNetMargin, games: totalGames });
        }

        // Longest Current Winning Streak against a single Opponent
        // Sort games chronologically
        stats.games.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.week - b.week;
        });

        let currentStreak = 0;
        // Iterate backwards to find the current streak (must be active)
        for (let i = stats.games.length - 1; i >= 0; i--) {
          const game = stats.games[i];
          if (game.isWin) {
            currentStreak++;
          } else {
            // Streak broken or tied, so this is the current active streak.
            break;
          }
        }
        // Only update if there's an actual current streak
        if (currentStreak > 0) {
          updateRecord(newAggregatedRecords.longestCurrentWinningStreak, currentStreak, { team, opponent, streak: currentStreak });
        }
      });
    });

    // Clean up: filter out initial -Infinity values if no data for a category
    Object.keys(newAggregatedRecords).forEach(key => {
        const record = newAggregatedRecords[key];
        if (record.value === -Infinity || record.value === Infinity) {
            record.value = 0; // Default to 0 for display if no data
            record.entries = [];
        }
        // For records with multiple entries (ties), sort them for consistent display
        if (record.entries.length > 1) {
            record.entries.sort((a, b) => {
                const teamCompare = (a.team || '').localeCompare(b.team || '');
                if (teamCompare !== 0) return teamCompare;
                return (a.opponent || '').localeCompare(b.opponent || '');
            });
        }
    });

    setAggregatedVersusRecords(newAggregatedRecords);
  }, [historicalMatchups, getDisplayTeamName]);


  // Helper to format values for display
  const formatDisplayValue = (value, recordKey) => {
    if (recordKey === 'mostWinsVsOpponent' || recordKey === 'longestCurrentWinningStreak') {
      return value; // Integer
    } else if (recordKey === 'bestNetMarginVsOpponent' || recordKey === 'highestAvgNetMarginVsOpponent') {
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Points with 2 decimals
    }
    return value;
  };

  const recordsToDisplay = [
    { key: 'mostWinsVsOpponent', label: 'Most Wins vs Single Opponent' },
    { key: 'bestNetMarginVsOpponent', label: 'Best Net Margin vs Opponent' },
    { key: 'highestAvgNetMarginVsOpponent', label: 'Highest Avg. Net Margin (min. 3 games)' },
    { key: 'longestCurrentWinningStreak', label: 'Longest Current Winning Streak' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">VERSUS RECORD HOLDERS - ( H2H )</h3>
      <p className="text-sm text-gray-600 mb-6">Records for head-to-head matchups between individual teams.</p>

      {Object.keys(aggregatedVersusRecords).length === 0 && (
        <p className="text-center text-gray-600">No versus matchup data available to display records.</p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Team</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Opponent</th>
            </tr>
          </thead>
          <tbody>
            {recordsToDisplay.map((recordDef) => {
              const recordData = aggregatedVersusRecords[recordDef.key];
              if (!recordData || recordData.entries.length === 0) {
                return (
                  <tr key={recordDef.key}>
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                    <td colSpan="3" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                  </tr>
                );
              }
              // Map through entries, but conditionally render record label and value
              return recordData.entries.map((entry, entryIndex) => (
                <tr
                  key={`${recordDef.key}-${entry.team}-${entry.opponent}-${entryIndex}`}
                  // Apply border-b only if it's the last entry for this record category,
                  // or if it's the only entry for this record.
                  // This ensures no border between tied entries.
                  className={`
                    ${entryIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                    ${entryIndex < recordData.entries.length - 1 ? '' : 'border-b border-gray-100'}
                    last:border-b-0
                  `}
                >
                  <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                    {entryIndex === 0 ? recordDef.label : ''} {/* Show label only for the first entry of a record */}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-800">
                    {entryIndex === 0 ? formatDisplayValue(recordData.value, recordDef.key) : ''} {/* Show value only for the first entry of a record */}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-700">{entry.team}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{entry.opponent}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VersusRecords;
