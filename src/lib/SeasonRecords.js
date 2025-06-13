// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';

// Helper to render record (W-L-T)
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

const SeasonRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [seasonData, setSeasonData] = useState({}); // Stores all processed data per year and team

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setSeasonData({});
      return;
    }

    const newSeasonData = {}; // { year: { teamName: { wins, losses, ties, totalPointsScored, weeklyScores[], ... } } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid or non-regular season data
      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || !match.regSeason) {
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize year and team data structures
      if (!newSeasonData[year]) newSeasonData[year] = {};
      [team1, team2].forEach(team => {
        if (!newSeasonData[year][team]) {
          newSeasonData[year][team] = {
            wins: 0, losses: 0, ties: 0,
            totalPointsScored: 0,
            totalPointsAgainst: 0,
            weeklyScores: [], // To calculate weekly top scores and All-Play Win %
            blowoutWins: 0, blowoutLosses: 0,
            slimWins: 0, slimLosses: 0,
            highestWeeklyScore: -Infinity,
            lowestWeeklyScore: Infinity,
            weeklyHighScoresCount: 0,
            weeklyTop3ScoresCount: 0,
          };
        }
      });

      // Update regular season records
      if (isTie) {
        newSeasonData[year][team1].ties++;
        newSeasonData[year][team2].ties++;
      } else if (team1Won) {
        newSeasonData[year][team1].wins++;
        newSeasonData[year][team2].losses++;
      } else {
        newSeasonData[year][team2].wins++;
        newSeasonData[year][team1].losses++;
      }

      // Update total points
      newSeasonData[year][team1].totalPointsScored += team1Score;
      newSeasonData[year][team1].totalPointsAgainst += team2Score;
      newSeasonData[year][team2].totalPointsScored += team2Score;
      newSeasonData[year][team2].totalPointsAgainst += team1Score;

      // Store weekly scores for later calculations (All-Play, weekly high/top 3)
      newSeasonData[year][team1].weeklyScores.push({ week, score: team1Score, opponentScore: team2Score, isWin: team1Won, isTie: isTie });
      newSeasonData[year][team2].weeklyScores.push({ week, score: team2Score, opponentScore: team1Score, isWin: team2Score > team1Score, isTie: isTie });

      // Update highest/lowest weekly scores
      newSeasonData[year][team1].highestWeeklyScore = Math.max(newSeasonData[year][team1].highestWeeklyScore, team1Score);
      newSeasonData[year][team1].lowestWeeklyScore = Math.min(newSeasonData[year][team1].lowestWeeklyScore, team1Score);
      newSeasonData[year][team2].highestWeeklyScore = Math.max(newSeasonData[year][team2].highestWeeklyScore, team2Score);
      newSeasonData[year][team2].lowestWeeklyScore = Math.min(newSeasonData[year][team2].lowestWeeklyScore, team2Score);

      // Calculate blowout/slim wins/losses on a per-match basis (only for games that aren't ties)
      if (!isTie) {
          const margin1 = (team1Score - team2Score) / team2Score; // Margin as percentage of opponent's score
          const margin2 = (team2Score - team1Score) / team1Score;

          if (team1Won) {
              if (margin1 >= 0.40) newSeasonData[year][team1].blowoutWins++;
              if (margin1 > 0 && margin1 < 0.025) newSeasonData[year][team1].slimWins++;
              if (margin2 >= 0.40) newSeasonData[year][team2].blowoutLosses++; // Opponent's loss is team2's blowout loss
              if (margin2 > 0 && margin2 < 0.025) newSeasonData[year][team2].slimLosses++;
          } else { // team2Won
              if (margin2 >= 0.40) newSeasonData[year][team2].blowoutWins++;
              if (margin2 > 0 && margin2 < 0.025) newSeasonData[year][team2].slimWins++;
              if (margin1 >= 0.40) newSeasonData[year][team1].blowoutLosses++; // Opponent's loss is team1's blowout loss
              if (margin1 > 0 && margin1 < 0.025) newSeasonData[year][team1].slimLosses++;
          }
      }
    });

    // Post-processing for weekly high/top 3 scores and All-Play Win %
    Object.keys(newSeasonData).forEach(year => {
        const teamsInYear = Object.keys(newSeasonData[year]);
        // Group all scores for the current year by week to find weekly highs
        const weeklyScoresByYear = {}; // { week: [{ team, score }] }
        teamsInYear.forEach(teamName => {
            newSeasonData[year][teamName].weeklyScores.forEach(entry => {
                if (!weeklyScoresByYear[entry.week]) weeklyScoresByYear[entry.week] = [];
                weeklyScoresByYear[entry.week].push({ team: teamName, score: entry.score });
            });
        });

        Object.values(weeklyScoresByYear).forEach(weeklyMatchups => {
            if (weeklyMatchups.length === 0) return;

            const sortedWeeklyScores = [...weeklyMatchups].sort((a, b) => b.score - a.score);

            // Most Weekly High Scores
            newSeasonData[year][sortedWeeklyScores[0].team].weeklyHighScoresCount++;

            // Most Weekly Top 3 Scores
            for (let i = 0; i < Math.min(3, sortedWeeklyScores.length); i++) {
                newSeasonData[year][sortedWeeklyScores[i].team].weeklyTop3ScoresCount++;
            }
        });

        // Calculate All-Play Win Percentage per team per year
        teamsInYear.forEach(teamName => {
            let totalAllPlayWins = 0;
            let totalAllPlayGames = 0;
            newSeasonData[year][teamName].weeklyScores.forEach(teamWeekEntry => {
                const currentTeamScore = teamWeekEntry.score;
                // Compare against all other teams' scores in the same week of the same year
                weeklyScoresByYear[teamWeekEntry.week].forEach(opponentEntry => {
                    if (opponentEntry.team !== teamName) {
                        totalAllPlayGames++;
                        if (currentTeamScore > opponentEntry.score) {
                            totalAllPlayWins++;
                        } else if (currentTeamScore === opponentEntry.score) {
                            totalAllPlayWins += 0.5;
                        }
                    }
                });
            });
            newSeasonData[year][teamName].allPlayWinPercentage = totalAllPlayGames > 0 ? (totalAllPlayWins / totalAllPlayGames) : 0;
        });
    });

    setSeasonData(newSeasonData);
  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to format leaderboard data for display (for a specific year and metric)
  const getLeaderboardData = (year, metricKey, sortKey, ascending = false, isPercentage = false) => {
    if (!seasonData[year]) return [];

    const rawData = Object.keys(seasonData[year]).map(team => {
      let value;
      if (sortKey === null) { // Direct metric key (e.g., 'weeklyHighScoresCount')
        value = seasonData[year][team][metricKey] || 0;
      } else { // Nested metric key (e.g., 'totalPointsData.scored') -- not directly used here but kept for flexibility
        value = (seasonData[year][team][metricKey] && seasonData[year][team][metricKey][sortKey] !== undefined) ? seasonData[year][team][metricKey][sortKey] : 0;
      }
      return { team, value };
    });

    // Sort to find the top value(s)
    rawData.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

    // Filter to get only the top unique value(s) (handles ties)
    const topValue = rawData.length > 0 ? rawData[0].value : null;
    const topEntries = rawData.filter(entry => entry.value === topValue && (topValue !== null || entry.value === 0));

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
        teams.sort();

        let finalDisplayValue;
        if (isPercentage) {
            finalDisplayValue = `${(value * 100).toFixed(3)}%`; // Display as X.XXX%
        } else if (['totalPointsScored', 'totalPointsAgainst', 'highestWeeklyScore', 'lowestWeeklyScore'].includes(metricKey)) {
            finalDisplayValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            finalDisplayValue = value;
        }

        result.push({
            value: value,
            displayValue: finalDisplayValue,
            teams: teams,
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

    return result;
  };

  const sortedYears = Object.keys(seasonData).sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASONAL RECORD HOLDERS - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Records members hold for individual seasons.</p>

      {sortedYears.length === 0 && (
        <p className="text-center text-gray-600">No regular season data available to display season records.</p>
      )}

      {sortedYears.map(year => (
        <section key={year} className="mb-8 bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h4 className="text-2xl font-bold text-blue-700 mb-4 border-b pb-2">{year} Season Records</h4>
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
                {getLeaderboardData(year, 'wins').map((entry, index) => (
                  <tr key={`wins-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Wins</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                 {getLeaderboardData(year, 'losses').map((entry, index) => (
                  <tr key={`losses-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Losses</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'allPlayWinPercentage', null, false, true).map((entry, index) => (
                  <tr key={`allplay-win-pct-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Best All-Play Win %</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'weeklyHighScoresCount').map((entry, index) => (
                  <tr key={`weekly-high-scores-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Weekly Top Scores</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'weeklyTop3ScoresCount').map((entry, index) => (
                  <tr key={`weekly-top3-scores-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Weekly Top 3 Scores</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'blowoutWins').map((entry, index) => (
                  <tr key={`blowout-wins-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Blowout Wins</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'blowoutLosses').map((entry, index) => (
                  <tr key={`blowout-losses-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Blowout Losses</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'slimWins').map((entry, index) => (
                  <tr key={`slim-wins-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Slim Wins</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'slimLosses').map((entry, index) => (
                  <tr key={`slim-losses-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Slim Losses</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'totalPointsScored').map((entry, index) => (
                  <tr key={`most-points-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Most Points</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {getLeaderboardData(year, 'totalPointsScored', true).map((entry, index) => ( // true for ascending (fewest points)
                  <tr key={`fewest-points-${year}-${index}`} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">Fewest Points</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{entry.displayValue}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.memberDisplay}</td>
                  </tr>
                ))}
                {/* No data message for specific year */}
                {Object.keys(seasonData[year]).length === 0 && (
                  <tr>
                    <td colSpan="3" className="py-4 text-center text-gray-500">No record data for this season.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};

export default SeasonRecords;
