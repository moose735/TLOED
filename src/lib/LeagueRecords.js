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
  const [weeklyHighScoresData, setWeeklyHighScoresData] = useState({});
  const [weeklyTop3ScoresData, setWeeklyTop3ScoresData] = useState({});
  const [seasonRecordsSummary, setSeasonRecordsSummary] = useState({});
  const [allPlayWinPercentage, setAllPlayWinPercentage] = useState({});

  useEffect(() => {
    console.log("LeagueRecords: historicalMatchups received:", historicalMatchups);

    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setTotalPointsData({});
      setWeeklyHighScoresData({});
      setWeeklyTop3ScoresData({});
      setSeasonRecordsSummary({});
      setAllPlayWinPercentage({});
      return;
    }

    const newAllTimeRecords = {};
    const newTotalPointsData = {}; // { teamName: { scored: 0, against: 0 } }
    const newWeeklyHighScoresData = {}; // { teamName: count }
    const newWeeklyTop3ScoresData = {}; // { teamName: count }
    const tempSeasonRecords = {}; // { year: { team: { wins, losses, ties } } }
    const allWeeklyScores = {}; // { year_week: [{ team, score }] }

    historicalMatchups.forEach(match => {
      // Ensure data is valid before processing
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data in LeagueRecords:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize records for all teams involved in this match for all data structures
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = { wins: 0, losses: 0, ties: 0 };
        }
        if (!newTotalPointsData[team]) {
          newTotalPointsData[team] = { scored: 0, against: 0 };
        }
        if (!newWeeklyHighScoresData[team]) {
          newWeeklyHighScoresData[team] = 0;
        }
        if (!newWeeklyTop3ScoresData[team]) {
            newWeeklyTop3ScoresData[team] = 0;
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

      // Store scores for All-Play and Weekly High/Top 3
      const weekKey = `${year}_${week}`;
      if (!allWeeklyScores[weekKey]) {
          allWeeklyScores[weekKey] = [];
      }
      allWeeklyScores[weekKey].push({ team: team1, score: team1Score });
      allWeeklyScores[weekKey].push({ team: team2, score: team2Score });

      // Update Temporary Season Records (ONLY for regular season games)
      if (match.regSeason) { // Only count if it's a regular season game
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
      }
    });

    // After iterating all matches, calculate win percentage for allTimeRecords
    Object.keys(newAllTimeRecords).forEach(team => {
        const record = newAllTimeRecords[team];
        const totalGames = record.wins + record.losses + record.ties;
        // Calculation for win percentage
        record.winPercentage = totalGames > 0 ? ((record.wins + (record.ties / 2)) / totalGames) : 0;
    });


    // Calculate Weekly High Scores and Top 3 Scores
    Object.values(allWeeklyScores).forEach(weeklyMatchups => {
        const sortedWeeklyScores = [...weeklyMatchups].sort((a, b) => b.score - a.score);

        if (sortedWeeklyScores.length > 0) {
            // Most Weekly High Scores
            newWeeklyHighScoresData[sortedWeeklyScores[0].team] = (newWeeklyHighScoresData[sortedWeeklyScores[0].team] || 0) + 1;

            // Most Weekly Top 3 Scores
            for (let i = 0; i < Math.min(3, sortedWeeklyScores.length); i++) {
                newWeeklyTop3ScoresData[sortedWeeklyScores[i].team] = (newWeeklyTop3ScoresData[sortedWeeklyScores[i].team] || 0) + 1;
            }
        }
    });

    // Calculate All-Play Win Percentage
    const newAllPlayWinPercentage = {};
    Object.keys(newAllTimeRecords).forEach(team => {
        let totalAllPlayWins = 0;
        let totalAllPlayGames = 0;

        Object.values(allWeeklyScores).forEach(weeklyMatchups => {
            const teamCurrentWeekScore = weeklyMatchups.find(m => m.team === team)?.score;
            if (teamCurrentWeekScore !== undefined) {
                weeklyMatchups.forEach(opponentEntry => {
                    if (opponentEntry.team !== team) {
                        totalAllPlayGames++;
                        if (teamCurrentWeekScore > opponentEntry.score) {
                            totalAllPlayWins++;
                        } else if (teamCurrentWeekScore === opponentEntry.score) {
                            totalAllPlayWins += 0.5;
                        }
                    }
                });
            }
        });
        newAllPlayWinPercentage[team] = totalAllPlayGames > 0 ? (totalAllPlayWins / totalAllPlayGames) : 0;
    });

    // Calculate Season Records Summary
    const newSeasonRecordsSummary = {};
    Object.keys(tempSeasonRecords).forEach(year => {
        Object.keys(tempSeasonRecords[year]).forEach(team => {
            const record = tempSeasonRecords[year][team];
            if (!newSeasonRecordsSummary[team]) newSeasonRecordsSummary[team] = { winningSeasons: 0, losingSeasons: 0, tiedSeasons: 0 };
            const totalGamesInSeason = record.wins + record.losses + record.ties; // This now only counts regular season games
            if (totalGamesInSeason > 0) {
                // A season with a winning record has more wins than losses
                if (record.wins > record.losses) {
                    newSeasonRecordsSummary[team].winningSeasons++;
                }
                // A season with a losing record has more losses than wins
                else if (record.losses > record.wins) {
                    newSeasonRecordsSummary[team].losingSeasons++;
                }
                // Tied seasons are where wins === losses and there are ties (no explicit ties needed, just equality)
                else if (record.wins === record.losses) { // If wins === losses, it's a tied record season (could have 0 ties)
                    newSeasonRecordsSummary[team].tiedSeasons++;
                }
            }
        });
    });

    setAllTimeRecords(newAllTimeRecords);
    setTotalPointsData(newTotalPointsData);
    setWeeklyHighScoresData(newWeeklyHighScoresData);
    setWeeklyTop3ScoresData(newWeeklyTop3ScoresData);
    setSeasonRecordsSummary(newSeasonRecordsSummary);
    setAllPlayWinPercentage(newAllPlayWinPercentage);

  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to format leaderboard data for display
  const getLeaderboardData = (dataMap, sortKey, ascending = false, isPercentage = false) => {
    const rawData = Object.keys(dataMap).map(team => {
      let value;
      // Safely access value, defaulting to 0 if undefined/null
      if (sortKey === null) { // Direct value (e.g., weeklyHighScoresData, allPlayWinPercentage)
        value = dataMap[team] || 0;
      } else if (dataMap[team] && dataMap[team][sortKey] !== undefined) { // Nested value (e.g., allTimeRecords.wins, allTimeRecords.winPercentage)
        value = dataMap[team][sortKey];
      } else {
        value = 0; // Default if data is missing
      }
      return { team, value };
    });

    // Sort to find the top value(s)
    rawData.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

    // Filter to get only the top unique value(s)
    const topValue = rawData.length > 0 ? rawData[0].value : null;
    // Ensure topValue is not null/undefined before filtering, and handle cases where topValue is 0 (valid)
    const topEntries = rawData.filter(entry => entry.value === topValue && (topValue !== null || entry.value === 0));


    // Group by value (though for "top only", it will likely be one group)
    const groupedData = new Map();
    topEntries.forEach(entry => {
        const key = entry.value;
        if (!groupedData.has(key)) {
            groupedData.set(key, []);
        }
        groupedData.get(key).push(entry.team);
    });

    const result = [];
    const sortedUniqueValues = Array.from(groupedData.keys()).sort((a, b) => ascending ? a - b : b - a);

    sortedUniqueValues.forEach(value => {
        const teams = groupedData.get(value);
        teams.sort(); // Sort tied teams alphabetically

        let finalDisplayValue;
        if (isPercentage) {
            // Display as .xxx% format (e.g., 0.679%)
            finalDisplayValue = `${value.toFixed(3)}%`;
        } else if (sortKey === 'scored' || sortKey === 'against') {
            // Format with commas and 2 decimal places using toLocaleString on the number directly
            finalDisplayValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            finalDisplayValue = value; // Other numbers (wins, losses, counts) as is (integers)
        }

        result.push({
            value: value,
            displayValue: finalDisplayValue,
            teams: teams, // Array of team names
            memberDisplay: (
                <span className="flex items-center space-x-1">
                    {teams.map(teamName => (
                        <img
                            key={teamName}
                            src={'https://placehold.co/20x20/cccccc/333333?text=M'} // Generic placeholder
                            alt={`${teamName} avatar`}
                            className="w-5 h-5 rounded-full object-cover"
                            title={teamName}
                        />
                    ))}
                     <span className="ml-1">{teams.join(' , ')}</span>
                </span>
            )
        });
    });

    return result; // This will return only the top entry/tied entries
  };


  // Prepare data for specific leaderboards
  const mostWinsLeaderboard = getLeaderboardData(allTimeRecords, 'wins');
  const mostLossesLeaderboard = getLeaderboardData(allTimeRecords, 'losses');
  const bestWinPctLeaderboard = getLeaderboardData(allTimeRecords, 'winPercentage', false, true);
  const bestAllPlayWinPctLeaderboard = getLeaderboardData(allPlayWinPercentage, null, false, true);
  const mostWeeklyHighScoresLeaderboard = getLeaderboardData(weeklyHighScoresData, null);
  const mostWeeklyTop3ScoresLeaderboard = getLeaderboardData(weeklyTop3ScoresData, null);
  const mostWinningSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'winningSeasons');
  const mostLosingSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'losingSeasons');
  const mostTotalPointsScoredLeaderboard = getLeaderboardData(totalPointsData, 'scored');
  const mostTotalPointsAgainstLeaderboard = getLeaderboardData(totalPointsData, 'against');


  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">ALL-TIME RECORD HOLDERS - ( LEAGUE )</h3>
      <p className="text-sm text-gray-600 mb-6">Records members hold across your entire league history.</p>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-2/5">Record</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/5">Value</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-2/5">Team</th>
            </tr>
          </thead>
          <tbody>
            {mostWinsLeaderboard.map((entry, index) => (
              <tr key={`most-wins-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Wins</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostLossesLeaderboard.map((entry, index) => (
              <tr key={`most-losses-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Losses</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {bestWinPctLeaderboard.map((entry, index) => (
              <tr key={`best-win-pct-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Best Win Percentage</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {bestAllPlayWinPctLeaderboard.map((entry, index) => (
              <tr key={`best-all-play-win-pct-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Best All-Play Win Percentage</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostWeeklyHighScoresLeaderboard.map((entry, index) => (
              <tr key={`most-weekly-high-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Weekly High Scores</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostWeeklyTop3ScoresLeaderboard.map((entry, index) => (
              <tr key={`most-weekly-top3-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Weekly Top 3 Scores</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostWinningSeasonsLeaderboard.map((entry, index) => (
              <tr key={`most-winning-seasons-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Seasons with Winning Record</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostLosingSeasonsLeaderboard.map((entry, index) => (
              <tr key={`most-losing-seasons-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Seasons with Losing Record</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostTotalPointsScoredLeaderboard.map((entry, index) => (
              <tr key={`most-total-points-scored-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Total Points Scored</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {mostTotalPointsAgainstLeaderboard.map((entry, index) => (
              <tr key={`most-total-points-against-${index}`} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Total Points Against</td>
                <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {/* Conditional message if no data is available across all leaderboards */}
            {mostWinsLeaderboard.length === 0 &&
             mostLossesLeaderboard.length === 0 &&
             bestWinPctLeaderboard.length === 0 &&
             bestAllPlayWinPctLeaderboard.length === 0 &&
             mostWeeklyHighScoresLeaderboard.length === 0 &&
             mostWeeklyTop3ScoresLeaderboard.length === 0 &&
             mostWinningSeasonsLeaderboard.length === 0 &&
             mostLosingSeasonsLeaderboard.length === 0 &&
             mostTotalPointsScoredLeaderboard.length === 0 &&
             mostTotalPointsAgainstLeaderboard.length === 0 && (
                <tr>
                    <td colSpan="3" className="py-4 text-center text-gray-500">No data available for any league records.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeagueRecords;
