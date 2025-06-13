// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [highestDPRCareerRecord, setHighestDPRCareerRecord] = useState(null);
  const [lowestDPRCareerRecord, setLowestDPRCareerRecord] = useState(null);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setHighestDPRCareerRecord(null);
      setLowestDPRCareerRecord(null);
      return;
    }

    const newAllTimeRecords = {}; // { team: { wins, losses, ties, totalPointsFor, totalGames, careerRawDPR, adjustedDPR } }
    let allGameScoresOverall = []; // For calculating overall max/min score for career DPR

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize records if team not seen before
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = {
            wins: 0,
            losses: 0,
            ties: 0,
            totalPointsFor: 0,
            totalGames: 0,
            careerRawDPR: 0,
            adjustedDPR: 0, // All-Time DPR Rank
          };
        }
      });

      // Update All-Time Records
      if (isTie) {
        newAllTimeRecords[team1].ties++;
        newAllTimeRecords[team2].ties++;
      } else if (team1Won) {
        newAllTimeRecords[team1].wins++;
        newAllTimeRecords[team2].losses++;
      } else { // team2Won
        newAllTimeRecords[team2].wins++;
        newAllTimeRecords[team1].losses++;
      }

      newAllTimeRecords[team1].totalPointsFor += team1Score;
      newAllTimeRecords[team2].totalPointsFor += team2Score;
      newAllTimeRecords[team1].totalGames++;
      newAllTimeRecords[team2].totalGames++;

      // Collect all game scores across all seasons for overall max/min
      allGameScoresOverall.push(team1Score, team2Score);
    });

    // Calculate Overall Max/Min Scores for Career DPR
    const maxScoreOverall = Math.max(...allGameScoresOverall);
    const minScoreOverall = Math.min(...allGameScoresOverall);

    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    // Calculate Career Raw DPR for each team
    Object.keys(newAllTimeRecords).forEach(team => {
      const stats = newAllTimeRecords[team];
      const totalGames = stats.totalGames;

      if (totalGames === 0) {
        return;
      }

      const careerWinPercentage = (stats.wins + 0.5 * stats.ties) / totalGames;

      // Raw DPR Calculation: ((Points Scored * 6) + ((Points Scored Max + Points Scored Min) * 2) + ((Win% * 200) * 2)) / 10
      stats.careerRawDPR = (
        (stats.totalPointsFor * 6) +
        ((maxScoreOverall + minScoreOverall) * 2) +
        ((careerWinPercentage * 200) * 2)
      ) / 10;

      totalRawDPROverall += stats.careerRawDPR;
      teamsWithValidCareerDPR++;
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;

    let currentHighestDPRCareer = { value: -Infinity, entries: [] };
    let currentLowestDPRCareer = { value: Infinity, entries: [] };

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

    // Calculate Adjusted DPR (All-Time DPR Rank) for each team
    Object.keys(newAllTimeRecords).forEach(team => {
      const stats = newAllTimeRecords[team];
      if (avgRawDPROverall > 0) {
        stats.adjustedDPR = stats.careerRawDPR / avgRawDPROverall;
      } else {
        stats.adjustedDPR = 0; // Avoid division by zero
      }

      // Update highest/lowest adjusted DPR career records
      if (stats.adjustedDPR !== 0) {
        updateRecord(currentHighestDPRCareer, stats.adjustedDPR, { team, dpr: stats.adjustedDPR });
        updateRecord(currentLowestDPRCareer, stats.adjustedDPR, { team, dpr: stats.adjustedDPR }, true);
      }
    });

    // Clean up highest/lowest DPR records
    [currentHighestDPRCareer, currentLowestDPRCareer].forEach(record => {
      if (record.value === -Infinity || record.value === Infinity) {
        record.value = 0;
        record.entries = [];
      }
      if (record.entries.length > 1) {
        record.entries.sort((a, b) => (a.team || '').localeCompare(b.team || ''));
      }
    });


    setAllTimeRecords(newAllTimeRecords);
    setHighestDPRCareerRecord(currentHighestDPRCareer);
    setLowestDPRCareerRecord(currentLowestDPRCareer);

  }, [historicalMatchups, getDisplayTeamName]); // Recalculate if matchups or mapping changes

  // Helper to render record
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  // Sort teams for consistent display in all-time records by adjustedDPR (descending)
  const sortedAllTimeTeams = Object.keys(allTimeRecords).sort((a, b) => {
      const dprA = allTimeRecords[a].adjustedDPR;
      const dprB = allTimeRecords[b].adjustedDPR;
      // Sort by DPR descending, then by team name alphabetically for ties
      if (dprB !== dprA) return dprB - dprA;
      return a.localeCompare(b);
  });


  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">LEAGUE RECORDS - ( ALL-TIME )</h3>
      <p className="text-sm text-gray-600 mb-6">Overall league performance and ranking records.</p>

      {(highestDPRCareerRecord?.entries.length > 0 || lowestDPRCareerRecord?.entries.length > 0) && (
        <section className="mb-8 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200">
          <h4 className="text-lg font-bold text-blue-800 mb-3">Career DPR Highlights</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {highestDPRCareerRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Highest Adjusted DPR (Career)</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDPR(highestDPRCareerRecord.value)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    {highestDPRCareerRecord.entries.map((entry, idx) => (
                      <div key={idx}>{entry.team}</div>
                    ))}
                  </td>
                </tr>
              )}
              {lowestDPRCareerRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Lowest Adjusted DPR (Career)</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDPR(lowestDPRCareerRecord.value)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    {lowestDPRCareerRecord.entries.map((entry, idx) => (
                      <div key={idx}>{entry.team}</div>
                    ))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* All-Time Records */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">All-Time Team Records</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-blue-50">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Total Points For</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th> {/* New column */}
              </tr>
            </thead>
            <tbody>
              {sortedAllTimeTeams.map(team => {
                const record = allTimeRecords[team];
                const totalGames = record.wins + record.losses + record.ties;
                const winPercentage = totalGames > 0 ? ((record.wins + (record.ties / 2)) / totalGames * 100).toFixed(1) : '0.0';
                return (
                  <tr key={team} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800">{team}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(record)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{winPercentage}%</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{record.totalPointsFor.toFixed(2)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(record.adjustedDPR)}</td> {/* Display Adjusted DPR */}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default LeagueRecords;
