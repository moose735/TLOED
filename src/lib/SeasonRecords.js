// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';

// Helper to render record (W-L-T) - Not used in this component's final display
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

const SeasonRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedSeasonRecords, setAggregatedSeasonRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedSeasonRecords({});
      return;
    }

    const newSeasonData = {}; // Intermediate: { year: { teamName: { wins, losses, ... } } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid or non-regular season data (only count regular season for these records)
      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || !match.regSeason) {
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize year and team data structures in newSeasonData
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
            highestWeeklyScore: -Infinity, // For Most Points (Single Game) - not requested now but good to track
            lowestWeeklyScore: Infinity, // For Fewest Points (Single Game) - not requested now but good to track
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
      } else { // team2Won
        newSeasonData[year][team2].wins++;
        newSeasonData[year][team1].losses++;
      }

      // Update total points for the season
      newSeasonData[year][team1].totalPointsScored += team1Score;
      newSeasonData[year][team1].totalPointsAgainst += team2Score;
      newSeasonData[year][team2].totalPointsScored += team2Score;
      newSeasonData[year][team2].totalPointsAgainst += team1Score;

      // Store weekly scores for later calculations (All-Play, weekly high/top 3)
      newSeasonData[year][team1].weeklyScores.push({ week, score: team1Score, opponentScore: team2Score });
      newSeasonData[year][team2].weeklyScores.push({ week, score: team2Score, opponentScore: team1Score });

      // Calculate blowout/slim wins/losses on a per-match basis (only for regular season games that aren't ties)
      if (!isTie) {
          const margin1 = team1Score > 0 ? (team1Score - team2Score) / team1Score : (team1Score - team2Score); // Margin as percentage of winner's score, handle zero score
          const margin2 = team2Score > 0 ? (team2Score - team1Score) / team2Score : (team2Score - team1Score);

          // Blowout win/loss: Win/lose by 40% or more
          if (team1Won) {
              if (margin1 >= 0.40) newSeasonData[year][team1].blowoutWins++;
              if (Math.abs(margin1) >= 0.40) newSeasonData[year][team2].blowoutLosses++; // Team2 lost by 40% to Team1
          } else { // team2Won
              if (margin2 >= 0.40) newSeasonData[year][team2].blowoutWins++;
              if (Math.abs(margin2) >= 0.40) newSeasonData[year][team1].blowoutLosses++; // Team1 lost by 40% to Team2
          }

          // Slim win/loss: Win/lose by less than 2.5%
          if (team1Won) {
              if (margin1 > 0 && margin1 < 0.025) newSeasonData[year][team1].slimWins++;
              if (Math.abs(margin1) > 0 && Math.abs(margin1) < 0.025) newSeasonData[year][team2].slimLosses++;
          } else { // team2Won
              if (margin2 > 0 && margin2 < 0.025) newSeasonData[year][team2].slimWins++;
              if (Math.abs(margin2) > 0 && Math.abs(margin2) < 0.025) newSeasonData[year][team1].slimLosses++;
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

            // Most Weekly High Scores (the highest score in that specific week)
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

    // --- AGGREGATE SEASON RECORDS ACROSS ALL YEARS ---
    const newAggregatedRecords = {
        mostWins: { value: -Infinity, teams: [], years: [] },
        mostLosses: { value: -Infinity, teams: [], years: [] },
        bestAllPlayWinPct: { value: -Infinity, teams: [], years: [] },
        mostWeeklyTopScores: { value: -Infinity, teams: [], years: [] },
        mostWeeklyTop3Scores: { value: -Infinity, teams: [], years: [] },
        mostBlowoutWins: { value: -Infinity, teams: [], years: [] },
        mostBlowoutLosses: { value: -Infinity, teams: [], years: [] },
        mostSlimWins: { value: -Infinity, teams: [], years: [] },
        mostSlimLosses: { value: -Infinity, teams: [], years: [] },
        mostPoints: { value: -Infinity, teams: [], years: [] },
        fewestPoints: { value: Infinity, teams: [], years: [] },
        highestWeeklyScore: { value: -Infinity, teams: [], years: [] }, // Individual highest weekly score
        lowestWeeklyScore: { value: Infinity, teams: [], years: [] }, // Individual lowest weekly score
    };

    Object.keys(newSeasonData).forEach(year => {
        Object.keys(newSeasonData[year]).forEach(teamName => {
            const teamStats = newSeasonData[year][teamName];

            // Helper to update a record if current value is better (or equal for ties)
            const updateRecord = (recordObj, newValue, isMin = false) => {
                if (isMin) { // For "fewest" / "lowest"
                    if (newValue < recordObj.value) {
                        recordObj.value = newValue;
                        recordObj.teams = [teamName];
                        recordObj.years = [year];
                    } else if (newValue === recordObj.value) {
                        recordObj.teams.push(teamName);
                        recordObj.years.push(year);
                    }
                } else { // For "most" / "best" (max)
                    if (newValue > recordObj.value) {
                        recordObj.value = newValue;
                        recordObj.teams = [teamName];
                        recordObj.years = [year];
                    } else if (newValue === recordObj.value) {
                        recordObj.teams.push(teamName);
                        recordObj.years.push(year);
                    }
                }
            };

            // Update all aggregated records
            updateRecord(newAggregatedRecords.mostWins, teamStats.wins);
            updateRecord(newAggregatedRecords.mostLosses, teamStats.losses);
            updateRecord(newAggregatedRecords.bestAllPlayWinPct, teamStats.allPlayWinPercentage);
            updateRecord(newAggregatedRecords.mostWeeklyTopScores, teamStats.weeklyHighScoresCount);
            updateRecord(newAggregatedRecords.mostWeeklyTop3Scores, teamStats.weeklyTop3ScoresCount);
            updateRecord(newAggregatedRecords.mostBlowoutWins, teamStats.blowoutWins);
            updateRecord(newAggregatedRecords.mostBlowoutLosses, teamStats.blowoutLosses);
            updateRecord(newAggregatedRecords.mostSlimWins, teamStats.slimWins);
            updateRecord(newAggregatedRecords.mostSlimLosses, teamStats.slimLosses);
            updateRecord(newAggregatedRecords.mostPoints, teamStats.totalPointsScored);
            updateRecord(newAggregatedRecords.fewestPoints, teamStats.totalPointsScored, true);
            updateRecord(newAggregatedRecords.highestWeeklyScore, teamStats.highestWeeklyScore);
            updateRecord(newAggregatedRecords.lowestWeeklyScore, teamStats.lowestWeeklyScore, true);

        });
    });

    // Clean up: filter out initial -Infinity/Infinity values if no data for a category
    Object.keys(newAggregatedRecords).forEach(key => {
        const record = newAggregatedRecords[key];
        if (record.value === -Infinity || record.value === Infinity) {
            record.value = 0; // Default to 0 for display if no data
            record.teams = [];
            record.years = [];
        }
        // Sort teams and years arrays for consistent display
        record.teams.sort();
        record.years.sort((a, b) => parseInt(a) - parseInt(b)); // Sort years numerically
    });

    setAggregatedSeasonRecords(newAggregatedRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to format values for display
  const formatDisplayValue = (value, metricKey) => {
      if (metricKey === 'bestAllPlayWinPct') {
          return `${(value * 100).toFixed(3)}%`; // Percentage format
      } else if (['mostPoints', 'fewestPoints', 'highestWeeklyScore', 'lowestWeeklyScore'].includes(metricKey)) {
          return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Points with 2 decimals and commas
      } else {
          return value; // Integer for counts/wins/losses
      }
  };

  // Define the order and labels for the records to display
  const recordsToDisplay = [
    { key: 'mostWins', label: 'Most Wins' },
    { key: 'mostLosses', label: 'Most Losses' },
    { key: 'bestAllPlayWinPct', label: 'Best All-Play Win %' },
    { key: 'mostWeeklyTopScores', label: 'Most Weekly Top Scores' },
    { key: 'mostWeeklyTop3Scores', label: 'Most Weekly Top 3 Scores' },
    { key: 'mostBlowoutWins', label: 'Most Blowout Wins' },
    { key: 'mostBlowoutLosses', label: 'Most Blowout Losses' },
    { key: 'mostSlimWins', label: 'Most Slim Wins' },
    { key: 'mostSlimLosses', label: 'Most Slim Losses' },
    { key: 'mostPoints', label: 'Most Points' },
    { key: 'fewestPoints', label: 'Fewest Points' },
    { key: 'highestWeeklyScore', label: 'Highest Single Game Score' },
    { key: 'lowestWeeklyScore', label: 'Lowest Single Game Score' },
  ];


  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASONAL RECORD HOLDERS - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Records members hold for individual seasons, by the best value across all seasons.</p>

      {Object.keys(aggregatedSeasonRecords).length === 0 && (
        <p className="text-center text-gray-600">No regular season data available to display season records.</p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-2/5">Record</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/5">Value</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/5">Team</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/5">Season</th>
            </tr>
          </thead>
          <tbody>
            {recordsToDisplay.map((recordDef) => {
              const recordData = aggregatedSeasonRecords[recordDef.key];
              if (!recordData || recordData.teams.length === 0) {
                return (
                  <tr key={recordDef.key}>
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                    <td colSpan="3" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                  </tr>
                );
              }
              return (
                <tr key={recordDef.key} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{formatDisplayValue(recordData.value, recordDef.key)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">
                    <span className="flex items-center space-x-1">
                      {recordData.teams.map(teamName => (
                        <img
                          key={teamName}
                          src={'https://placehold.co/20x20/cccccc/333333?text=M'} // Generic placeholder
                          alt={`${teamName} avatar`}
                          className="w-5 h-5 rounded-full object-cover"
                          title={teamName}
                        />
                      ))}
                      <span className="ml-1">{recordData.teams.join(' , ')}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-700">{recordData.years.join(' , ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeasonRecords;
