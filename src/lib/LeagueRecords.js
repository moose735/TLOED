// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';

// Helper to render record
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [totalPointsData, setTotalPointsData] = useState({});
  const [weeklyHighScoresCount, setWeeklyHighScoresCount] = useState({});
  const [seasonRecordsSummary, setSeasonRecordsSummary] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setTotalPointsData({});
      setWeeklyHighScoresCount({});
      setSeasonRecordsSummary({});
      return;
    }

    const newAllTimeRecords = {};
    const newTotalPointsData = {}; // { teamName: { scored: 0, against: 0 } }
    const newWeeklyHighScoresCount = {}; // { teamName: count }
    const tempSeasonRecords = {}; // { year: { team: { wins, losses, ties } } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip if essential data is missing or invalid
      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data for league records:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize records if team not seen before for all relevant structures
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = { wins: 0, losses: 0, ties: 0 };
        }
        if (!newTotalPointsData[team]) {
          newTotalPointsData[team] = { scored: 0, against: 0 };
        }
        if (!newWeeklyHighScoresCount[team]) {
          newWeeklyHighScoresCount[team] = 0;
        }
        if (!tempSeasonRecords[year]) {
          tempSeasonRecords[year] = {};
        }
        if (!tempSeasonRecords[year][team]) {
          tempSeasonRecords[year][team] = { wins: 0, losses: 0, ties: 0 };
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

      // Update Total Points
      newTotalPointsData[team1].scored += team1Score;
      newTotalPointsData[team1].against += team2Score;
      newTotalPointsData[team2].scored += team2Score;
      newTotalPointsData[team2].against += team1Score;

      // Update Weekly High Scores (most times team had higher score in their matchup)
      if (team1Won) {
        newWeeklyHighScoresCount[team1]++;
      } else if (team2Score > team1Score) {
        newWeeklyHighScoresCount[team2]++;
      }

      // Update Temporary Season Records for later summary
      if (isTie) {
        tempSeasonRecords[year][team1].ties++;
        tempSeasonRecords[year][team2].ties++;
      } else if (team1Won) {
        tempSeasonRecords[year][team1].wins++;
        tempSeasonRecords[year][team2].losses++;
      } else { // team2Won
        tempSeasonRecords[year][team2].wins++;
        tempSeasonRecords[year][team1].losses++;
      }
    });

    // Calculate Season Records Summary
    const newSeasonRecordsSummary = {}; // { teamName: { winningSeasons: 0, losingSeasons: 0, tiedSeasons: 0 } }
    Object.keys(tempSeasonRecords).forEach(year => {
        Object.keys(tempSeasonRecords[year]).forEach(team => {
            const record = tempSeasonRecords[year][team];
            // Ensure team exists in summary
            if (!newSeasonRecordsSummary[team]) newSeasonRecordsSummary[team] = { winningSeasons: 0, losingSeasons: 0, tiedSeasons: 0 };

            // Only count if the team played at least one game in the season (e.g., total games > 0)
            const totalGamesInSeason = record.wins + record.losses + record.ties;
            if (totalGamesInSeason > 0) {
                if (record.wins > record.losses) {
                    newSeasonRecordsSummary[team].winningSeasons++;
                } else if (record.losses > record.wins) {
                    newSeasonRecordsSummary[team].losingSeasons++;
                } else { // Ties
                    newSeasonRecordsSummary[team].tiedSeasons++;
                }
            }
        });
    });


    setAllTimeRecords(newAllTimeRecords);
    setTotalPointsData(newTotalPointsData);
    setWeeklyHighScoresCount(newWeeklyHighScoresCount);
    setSeasonRecordsSummary(newSeasonRecordsSummary);

  }, [historicalMatchups, getDisplayTeamName]); // Recalculate if matchups or mapping changes


  // Sort teams for consistent display in all-time records
  const sortedAllTimeTeams = Object.keys(allTimeRecords).sort();

  // Helper to format leaderboard data for display
  const getLeaderboardData = (dataMap, sortKey, ascending = false) => {
    return Object.keys(dataMap).map(team => ({
      team,
      value: dataMap[team][sortKey] || dataMap[team] // Handle both object values (e.g., .wins) and direct values (e.g., weeklyHighScoresCount)
    })).sort((a, b) => ascending ? a.value - b.value : b.value - a.value);
  };

  // Prepare data for specific leaderboards
  const mostWinsLeaderboard = getLeaderboardData(allTimeRecords, 'wins');
  const mostLossesLeaderboard = getLeaderboardData(allTimeRecords, 'losses');
  const bestWinPctLeaderboard = Object.keys(allTimeRecords).map(team => {
      const record = allTimeRecords[team];
      const totalGames = record.wins + record.losses + record.ties;
      const winPercentage = totalGames > 0 ? ((record.wins + (record.ties / 2)) / totalGames) : 0;
      return { team, value: winPercentage, displayValue: `${(winPercentage * 100).toFixed(1)}%` };
  }).sort((a, b) => b.value - a.value);

  const mostWeeklyHighScoresLeaderboard = getLeaderboardData(weeklyHighScoresCount, null); // No nested key
  const mostWinningSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'winningSeasons');
  const mostLosingSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'losingSeasons');
  const mostTotalPointsScoredLeaderboard = getLeaderboardData(totalPointsData, 'scored');
  const mostTotalPointsAgainstLeaderboard = getLeaderboardData(totalPointsData, 'against');


  // Helper to render a leaderboard section
  const renderLeaderboardSection = (title, data, valueLabel) => (
    <section className="mb-6 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
      <h4 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.slice(0, 5).map((entry, index) => ( // Show top 5 for brevity
          <div key={entry.team} className="flex justify-between items-center bg-white p-3 rounded-md border border-gray-100 shadow-xs">
            <span className="font-medium text-gray-800">{index + 1}. {entry.team}</span>
            <span className="font-semibold text-blue-600">
                {entry.displayValue || (typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value)}
            </span>
          </div>
        ))}
        {data.length === 0 && <p className="text-gray-500 col-span-full text-center">No data available.</p>}
      </div>
    </section>
  );


  return (
    <div className="w-full">
      {/* All-Time Team Records (original table) */}
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

      {/* New League Leaderboards */}
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">League Leaderboards</h3>

      {renderLeaderboardSection("Most Wins (All-Time)", mostWinsLeaderboard, "Wins")}
      {renderLeaderboardSection("Most Losses (All-Time)", mostLossesLeaderboard, "Losses")}
      {renderLeaderboardSection("Best Win % (All-Time)", bestWinPctLeaderboard, "Win %")}
      {renderLeaderboardSection("Most Matchup Wins (Total Games Won)", mostWeeklyHighScoresLeaderboard, "Wins")}
      {renderLeaderboardSection("Most Seasons with Winning Record", mostWinningSeasonsLeaderboard, "Seasons")}
      {renderLeaderboardSection("Most Seasons with Losing Record", mostLosingSeasonsLeaderboard, "Seasons")}
      {renderLeaderboardSection("Most Total Points Scored (All-Time)", mostTotalPointsScoredLeaderboard, "Points")}
      {renderLeaderboardSection("Most Total Points Against (All-Time)", mostTotalPointsAgainstLeaderboard, "Points")}

    </div>
  );
};

export default LeagueRecords;
