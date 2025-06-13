// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';

const SeasonRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [seasonRecords, setSeasonRecords] = useState({});
  const [highestDPRSeasonRecord, setHighestDPRSeasonRecord] = useState(null);
  const [lowestDPRSeasonRecord, setLowestDPRSeasonRecord] = useState(null);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setSeasonRecords({});
      setHighestDPRSeasonRecord(null);
      setLowestDPRSeasonRecord(null);
      return;
    }

    const newSeasonRecords = {}; // { year: { team: { wins, losses, ties, pointsFor, totalGames, rawDPR, adjustedDPR } } }
    const seasonLeagueScores = {}; // { year: { allGameScores: [] } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize records if team/year not seen before
      [team1, team2].forEach(team => {
        if (!newSeasonRecords[year]) {
          newSeasonRecords[year] = {};
        }
        if (!newSeasonRecords[year][team]) {
          newSeasonRecords[year][team] = {
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            totalGames: 0,
            rawDPR: 0,
            adjustedDPR: 0,
          };
        }
      });

      // Update Season Records
      if (isTie) {
        newSeasonRecords[year][team1].ties++;
        newSeasonRecords[year][team2].ties++;
      } else if (team1Won) {
        newSeasonRecords[year][team1].wins++;
        newSeasonRecords[year][team2].losses++;
      } else { // team2Won
        newSeasonRecords[year][team2].wins++;
        newSeasonRecords[year][team1].losses++;
      }

      newSeasonRecords[year][team1].pointsFor += team1Score;
      newSeasonRecords[year][team2].pointsFor += team2Score;
      newSeasonRecords[year][team1].totalGames++;
      newSeasonRecords[year][team2].totalGames++;

      // Collect all game scores for the season to find max/min for DPR calculation
      if (!seasonLeagueScores[year]) seasonLeagueScores[year] = { allGameScores: [] };
      seasonLeagueScores[year].allGameScores.push(team1Score, team2Score);
    });

    let currentHighestDPRSeason = { value: -Infinity, entries: [] };
    let currentLowestDPRSeason = { value: Infinity, entries: [] };

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

    Object.keys(newSeasonRecords).sort().forEach(year => {
      const teamsInSeason = Object.keys(newSeasonRecords[year]);
      if (teamsInSeason.length === 0) return;

      const maxScoreInSeason = Math.max(...seasonLeagueScores[year].allGameScores);
      const minScoreInSeason = Math.min(...seasonLeagueScores[year].allGameScores);

      let totalRawDPRForSeason = 0;
      let teamsWithValidDPR = 0;

      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        const totalGames = stats.totalGames;

        if (totalGames === 0) {
          return;
        }

        const seasonWinPercentage = (stats.wins + 0.5 * stats.ties) / totalGames;

        // Raw DPR Calculation: ((Points Scored * 6) + ((Points Scored Max + Points Scored Min) * 2) + ((Win% * 200) * 2)) / 10
        stats.rawDPR = (
          (stats.pointsFor * 6) +
          ((maxScoreInSeason + minScoreInSeason) * 2) +
          ((seasonWinPercentage * 200) * 2)
        ) / 10;

        totalRawDPRForSeason += stats.rawDPR;
        teamsWithValidDPR++;
      });

      const avgRawDPRForSeason = teamsWithValidDPR > 0 ? totalRawDPRForSeason / teamsWithValidDPR : 0;

      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        if (avgRawDPRForSeason > 0) {
          stats.adjustedDPR = stats.rawDPR / avgRawDPRForSeason;
        } else {
          stats.adjustedDPR = 0;
        }

        // Update highest/lowest adjusted DPR season records
        if (stats.adjustedDPR !== 0) {
          updateRecord(currentHighestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR });
          updateRecord(currentLowestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR }, true);
        }
      });
    });

    setSeasonRecords(newSeasonRecords);
    setHighestDPRSeasonRecord(currentHighestDPRSeason);
    setLowestDPRSeasonRecord(currentLowestDPRSeason);

  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to render record
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  // Sort years for consistent display
  const sortedYears = Object.keys(seasonRecords).sort((a, b) => parseInt(b) - parseInt(a)); // Descending year

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Team performance records calculated per season.</p>

      {(highestDPRSeasonRecord?.entries.length > 0 || lowestDPRSeasonRecord?.entries.length > 0) && (
        <section className="mb-8 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200">
          <h4 className="text-lg font-bold text-blue-800 mb-3">Season DPR Highlights</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {highestDPRSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Highest Adjusted DPR (Season)</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDPR(highestDPRSeasonRecord.value)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    {highestDPRSeasonRecord.entries.map((entry, idx) => (
                      <div key={idx}>{entry.team} ({entry.year})</div>
                    ))}
                  </td>
                </tr>
              )}
              {lowestDPRSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Lowest Adjusted DPR (Season)</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDPR(lowestDPRSeasonRecord.value)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    {lowestDPRSeasonRecord.entries.map((entry, idx) => (
                      <div key={idx}>{entry.team} ({entry.year})</div>
                    ))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {sortedYears.map(year => (
        <div key={year} className="mb-6">
          <h4 className="text-lg font-bold text-gray-700 mb-3 bg-gray-50 p-2 rounded-md border-l-4 border-blue-500">{year} Season</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th>
                </tr>
              </thead>
              <tbody>
                {/* Corrected: Access seasonRecords state instead of newSeasonRecords local variable */}
                {Object.keys(seasonRecords[year]).sort().map(team => {
                  const record = seasonRecords[year][team];
                  const totalGames = record.wins + record.losses + record.ties;
                  const winPercentage = totalGames > 0 ? ((record.wins + (record.ties / 2)) / totalGames * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={team} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-3 text-sm text-gray-800">{team}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(record)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{winPercentage}%</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.pointsFor.toFixed(2)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(record.adjustedDPR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SeasonRecords;
