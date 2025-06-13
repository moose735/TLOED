// src/lib/DPRHistory.js
import React, { useState, useEffect } from 'react';

const DPRHistory = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedDPRRecords, setAggregatedDPRRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedDPRRecords({});
      return;
    }

    // Stores aggregated data per team per season
    const seasonalTeamStats = {}; // { year: { teamName: { totalPointsFor, wins, losses, ties, totalGames, weeklyScores: [] } } }
    const seasonLeagueScores = {}; // { year: { allGameScores: [] } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(year) || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid matchups
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize structures for year and teams
      if (!seasonalTeamStats[year]) seasonalTeamStats[year] = {};
      if (!seasonLeagueScores[year]) seasonLeagueScores[year] = { allGameScores: [] };

      [team1, team2].forEach(team => {
        if (!seasonalTeamStats[year][team]) {
          seasonalTeamStats[year][team] = {
            totalPointsFor: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            totalGames: 0,
          };
        }
      });

      // Update team stats
      seasonalTeamStats[year][team1].totalGames++;
      seasonalTeamStats[year][team2].totalGames++;

      seasonalTeamStats[year][team1].totalPointsFor += team1Score;
      seasonalTeamStats[year][team2].totalPointsFor += team2Score; // Corrected: team2's score for team2

      if (isTie) {
        seasonalTeamStats[year][team1].ties++;
        seasonalTeamStats[year][team2].ties++;
      } else if (team1Won) {
        seasonalTeamStats[year][team1].wins++;
        seasonalTeamStats[year][team2].losses++;
      } else { // team2Won
        seasonalTeamStats[year][team2].wins++;
        seasonalTeamStats[year][team1].losses++;
      }

      // Collect all game scores for the season to find max/min
      seasonLeagueScores[year].allGameScores.push(team1Score, team2Score);
    });

    // Initialize overall DPR records
    const newAggregatedDPRRecords = {
      highestAdjustedDPRSeason: { value: -Infinity, entries: [] }, // { team, year, dpr }
      lowestAdjustedDPRSeason: { value: Infinity, entries: [] }, // { team, year, dpr }
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

    // Calculate Raw DPR and Adjusted DPR for each team per season
    Object.keys(seasonalTeamStats).forEach(year => {
      const teamsInSeason = Object.keys(seasonalTeamStats[year]);
      if (teamsInSeason.length === 0) return;

      const maxScoreInSeason = Math.max(...seasonLeagueScores[year].allGameScores);
      const minScoreInSeason = Math.min(...seasonLeagueScores[year].allGameScores);

      let totalRawDPRForSeason = 0;
      let teamsWithValidDPR = 0;

      teamsInSeason.forEach(team => {
        const stats = seasonalTeamStats[year][team];
        const totalGames = stats.totalGames;

        if (totalGames === 0) { // Skip teams with no games
          stats.rawDPR = 0;
          stats.adjustedDPR = 0;
          return;
        }

        const seasonWinPercentage = (stats.wins + 0.5 * stats.ties) / totalGames;

        // Raw DPR Calculation: ((Points Scored * 6) + ((Points Scored Max + Points Scored Min) * 2) + ((Win% * 200) * 2)) / 10
        stats.rawDPR = (
          (stats.totalPointsFor * 6) +
          ((maxScoreInSeason + minScoreInSeason) * 2) +
          ((seasonWinPercentage * 200) * 2)
        ) / 10;

        totalRawDPRForSeason += stats.rawDPR;
        teamsWithValidDPR++;
      });

      const avgRawDPRForSeason = teamsWithValidDPR > 0 ? totalRawDPRForSeason / teamsWithValidDPR : 0;

      teamsInSeason.forEach(team => {
        const stats = seasonalTeamStats[year][team];
        if (avgRawDPRForSeason > 0) {
          stats.adjustedDPR = stats.rawDPR / avgRawDPRForSeason;
        } else {
          stats.adjustedDPR = 0; // Avoid division by zero
        }

        // Update overall highest/lowest adjusted DPR records
        if (stats.adjustedDPR !== 0) { // Only consider if DPR is actually calculated
          updateRecord(newAggregatedDPRRecords.highestAdjustedDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR });
          updateRecord(newAggregatedDPRRecords.lowestAdjustedDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR }, true);
        }
      });
    });

    // Clean up: filter out initial -Infinity/Infinity values, sort entries
    Object.keys(newAggregatedDPRRecords).forEach(key => {
        const record = newAggregatedDPRRecords[key];
        if (record.value === -Infinity || record.value === Infinity) {
            record.value = 0; // Default to 0 if no valid data for the record
            record.entries = [];
        }
        if (record.entries.length > 1) {
            record.entries.sort((a, b) => {
                // Sort by year, then by team name for consistent display of ties
                if (a.year !== b.year) return a.year - b.year;
                return (a.team || '').localeCompare(b.team || '');
            });
        }
    });

    setAggregatedDPRRecords(newAggregatedDPRRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  const formatDisplayValue = (value) => {
    if (typeof value === 'number') {
      return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return value;
  };

  const recordsToDisplay = [
    { key: 'highestAdjustedDPRSeason', label: 'Highest Adjusted DPR (Season)' },
    { key: 'lowestAdjustedDPRSeason', label: 'Lowest Adjusted DPR (Season)' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">DPR HISTORY - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Highest and Lowest Adjusted DPR values per team per season.</p>

      {Object.keys(aggregatedDPRRecords).length === 0 || recordsToDisplay.every(r => aggregatedDPRRecords[r.key]?.entries.length === 0) ? (
        <p className="text-center text-gray-600">No DPR data available to display records. Ensure your historical matchups data is complete.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Team</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Season</th>
              </tr>
            </thead>
            <tbody>
              {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                const recordData = aggregatedDPRRecords[recordDef.key];
                if (!recordData || recordData.entries.length === 0) {
                  return (
                    <tr key={recordDef.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                      <td colSpan="3" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                    </tr>
                  );
                }
                return recordData.entries.map((entry, entryIndex) => (
                  <tr
                    key={`${recordDef.key}-${entry.team}-${entry.year}-${entryIndex}`}
                    className={`
                      ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      ${entryIndex === recordData.entries.length - 1 ? 'border-b border-gray-100' : ''}
                    `}
                  >
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                      {entryIndex === 0 ? recordDef.label : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800">
                      {entryIndex === 0 ? formatDisplayValue(recordData.value) : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.team}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.year}</td>
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

export default DPRHistory;
