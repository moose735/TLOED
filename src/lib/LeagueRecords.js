// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';

// Helper to render record
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      return;
    }

    const newAllTimeRecords = {};

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip if essential data is missing or invalid
      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data for all-time records:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize records if team not seen before
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = { wins: 0, losses: 0, ties: 0 };
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
    });

    setAllTimeRecords(newAllTimeRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  // Sort teams for consistent display
  const sortedAllTimeTeams = Object.keys(allTimeRecords).sort();

  return (
    <section className="mb-8">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">All-Time Team Records</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-blue-50">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LeagueRecords;
