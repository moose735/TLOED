// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';

// Helper to render record
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

// Removed leagueManagers from props again to fix the bug
const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [totalPointsData, setTotalPointsData] = useState({});
  const [weeklyHighScoresData, setWeeklyHighScoresData] = useState({});
  const [weeklyTop3ScoresData, setWeeklyTop3ScoresData] = useState({});
  const [seasonRecordsSummary, setSeasonRecordsSummary] = useState({});
  const [allPlayWinPercentage, setAllPlayWinPercentage] = useState({});

  useEffect(() => {
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
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const week = match.week;
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

    // Calculate Weekly High Scores and Top 3 Scores
    Object.values(allWeeklyScores).forEach(weeklyMatchups => {
        // Sort scores descending
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
                    if (opponentEntry.team !== team) { // Don't compare against self
                        totalAllPlayGames++;
                        if (teamCurrentWeekScore > opponentEntry.score) {
                            totalAllPlayWins++;
                        } else if (teamCurrentWeekScore === opponentEntry.score) {
                            totalAllPlayWins += 0.5; // Half win for a tie
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
            const totalGamesInSeason = record.wins + record.losses + record.ties;
            if (totalGamesInSeason > 0) {
                if (record.wins > record.losses) {
                    newSeasonRecordsSummary[team].winningSeasons++;
                } else if (record.losses > record.wins) {
                    newSeasonRecordsSummary[team].losingSeasons++;
                } else {
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
  // Modified to handle multiple members for ties and include avatar (placeholder for now)
  const getLeaderboardData = (dataMap, sortKey, ascending = false, isPercentage = false) => {
    const rawData = Object.keys(dataMap).map(team => {
      let value;
      let displayValue;

      if (sortKey === null) { // Direct value (e.g., weeklyHighScoresData)
        value = dataMap[team];
        displayValue = value;
      } else if (isPercentage) { // For win %
        value = dataMap[team];
        displayValue = `${(value * 100).toFixed(1)}%`;
      } else { // Nested object value (e.g., allTimeRecords.wins)
        value = dataMap[team][sortKey];
        displayValue = value;
      }
      return { team, value, displayValue };
    });

    rawData.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

    // Group by value to handle ties
    const groupedData = new Map();
    rawData.forEach(entry => {
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
        // Sort tied teams alphabetically for consistent display
        teams.sort();

        const displayValue = isPercentage ? `${(value * 100).toFixed(3)}%` : value; // Ensure 3 decimal places for percentage
        result.push({
            value: value,
            displayValue: displayValue,
            teams: teams, // Array of team names
            memberDisplay: (
                <span className="flex items-center space-x-1">
                    {teams.map(teamName => (
                        // Placeholder avatar since leagueManagers are not available
                        <img
                            key={teamName}
                            src={'https://placehold.co/20x20/cccccc/333333?text=M'} // Generic placeholder
                            alt={`${teamName} avatar`}
                            className="w-5 h-5 rounded-full object-cover"
                            title={teamName}
                        />
                    ))}
                     <span className="ml-1">{teams.join(' , ')}</span> {/* Show text names as well */}
                </span>
            )
        });
    });

    return result;
  };


  // Prepare data for specific leaderboards
  const mostWinsLeaderboard = getLeaderboardData(allTimeRecords, 'wins');
  const mostLossesLeaderboard = getLeaderboardData(allTimeRecords, 'losses');
  const bestWinPctLeaderboard = getLeaderboardData(allTimeRecords, 'winPercentage', false, true); // True for percentage
  const bestAllPlayWinPctLeaderboard = getLeaderboardData(allPlayWinPercentage, null, false, true); // All-Play is direct percentage
  const mostWeeklyHighScoresLeaderboard = getLeaderboardData(weeklyHighScoresData, null);
  const mostWeeklyTop3ScoresLeaderboard = getLeaderboardData(weeklyTop3ScoresData, null);
  const mostWinningSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'winningSeasons');
  const mostLosingSeasonsLeaderboard = getLeaderboardData(seasonRecordsSummary, 'losingSeasons');
  const mostTotalPointsScoredLeaderboard = getLeaderboardData(totalPointsData, 'scored');
  const mostTotalPointsAgainstLeaderboard = getLeaderboardData(totalPointsData, 'against');


  // Helper to render a leaderboard section with the new layout
  const renderLeaderboardSection = (title, description, data) => (
    <section className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <h4 className="text-xl font-bold text-gray-800 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-3/4">Member</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((entry, index) => ( // Show top 5 for brevity
              <tr key={index} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{entry.displayValue}</td>
                <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
              </tr>
            ))}
            {data.length === 0 && (
                <tr>
                    <td colSpan="2" className="py-4 text-center text-gray-500">No data available.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );


  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">ALL-TIME RECORD HOLDERS - ( LEAGUE )</h3>
      <p className="text-sm text-gray-600 mb-6">Records members hold across your entire league history.</p>

      {renderLeaderboardSection("Most Wins", "Most total league wins.", mostWinsLeaderboard)}
      {renderLeaderboardSection("Most Losses", "Most total league losses.", mostLossesLeaderboard)}
      {renderLeaderboardSection("Best Win Percentage", "Highest win % in league.", bestWinPctLeaderboard)}
      {renderLeaderboardSection("Best All-Play Win Percentage", "Highest win % playing every team each week in league.", bestAllPlayWinPctLeaderboard)}
      {renderLeaderboardSection("Most Weekly High Scores", "Most weeks with the highest score in league (regular season).", mostWeeklyHighScoresLeaderboard)}
      {renderLeaderboardSection("Most Weekly Top 3 Scores", "Most weeks scoring in the top 3 in league (regular season).", mostWeeklyTop3ScoresLeaderboard)}
      {renderLeaderboardSection("Most Seasons with Winning Record", "Most seasons finishing with a winning record.", mostWinningSeasonsLeaderboard)}
      {renderLeaderboardSection("Most Seasons with Losing Record", "Most seasons finishing with a losing record.", mostLosingSeasonsLeaderboard)}
      {renderLeaderboardSection("Most Total Points Scored", "Most total points scored across all seasons.", mostTotalPointsScoredLeaderboard)}
      {renderLeaderboardSection("Most Total Points Against", "Most total points scored against across all seasons.", mostTotalPointsAgainstLeaderboard)}

    </div>
  );
};

export default LeagueRecords;
