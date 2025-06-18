// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      return;
    }

    const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // Aggregate records across all seasons for career stats
    const aggregatedCareerStats = {}; // { teamName: { totalWins, totalLosses, totalTies, totalGames, totalPointsFor, totalPointsAgainst, winPercentages: [], allPlayWinPercentages: [], weeklyHighScores: 0, weeklyTop2Scores: 0, winningSeasons: 0, losingSeasons: 0, blowoutWins: 0, blowoutLosses: 0, slimWins: 0, slimLosses: 0 } }

    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        const seasonData = seasonalMetrics[year][team];

        if (!aggregatedCareerStats[team]) {
          aggregatedCareerStats[team] = {
            totalWins: 0, totalLosses: 0, totalTies: 0, totalGames: 0,
            totalPointsFor: 0, totalPointsAgainst: 0,
            winPercentages: [], allPlayWinPercentages: [],
            weeklyHighScores: 0, // This needs to be calculated in calculateAllLeagueMetrics or here from raw matches
            weeklyTop2Scores: 0, // This needs to be calculated in calculateAllLeagueMetrics or here from raw matches
            winningSeasons: 0, losingSeasons: 0,
            blowoutWins: 0, blowoutLosses: 0,
            slimWins: 0, slimLosses: 0,
          };
        }

        const teamStats = aggregatedCareerStats[team];
        teamStats.totalWins += seasonData.wins;
        teamStats.totalLosses += seasonData.losses;
        teamStats.totalTies += seasonData.ties;
        teamStats.totalGames += seasonData.totalGames;
        teamStats.totalPointsFor += seasonData.pointsFor;
        teamStats.totalPointsAgainst += seasonData.pointsAgainst;
        if (seasonData.winPercentage !== undefined) teamStats.winPercentages.push(seasonData.winPercentage);
        if (seasonData.allPlayWinPercentage !== undefined) teamStats.allPlayWinPercentages.push(seasonData.allPlayWinPercentage);

        // For winning/losing seasons
        if (seasonData.wins > seasonData.losses) {
          teamStats.winningSeasons++;
        } else if (seasonData.losses > seasonData.wins) {
          teamStats.losingSeasons++;
        }
      });
    });

    // Second pass over historicalMatchups to calculate weekly high scores, top 2, and blowout/slim wins/losses
    // This is more efficient than doing it per team per season in the first loop
    const weeklyScores = {}; // { year_week: [{ team, score }] }

    historicalMatchups.forEach(match => {
        const year = parseInt(match.year);
        const week = parseInt(match.week);
        const team1 = getDisplayTeamName(String(match.team1 || '').trim());
        const team2 = getDisplayTeamName(String(match.team2 || '').trim());
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);

        if (isNaN(year) || isNaN(week) || !team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
            return; // Skip invalid or incomplete data
        }

        const weekKey = `${year}_${week}`;
        if (!weeklyScores[weekKey]) {
            weeklyScores[weekKey] = [];
        }
        weeklyScores[weekKey].push({ team: team1, score: team1Score });
        weeklyScores[weekKey].push({ team: team2, score: team2Score });

        // Calculate blowout/slim for individual matches directly here
        const matchesForBlowoutSlim = [
            { team: team1, ownScore: team1Score, opponentScore: team2Score },
            { team: team2, ownScore: team2Score, opponentScore: team1Score }
        ];

        matchesForBlowoutSlim.forEach(entry => {
            if (!aggregatedCareerStats[entry.team]) return; // Ensure team exists in aggregated stats

            const scoreDiff = Math.abs(entry.ownScore - entry.opponentScore);

            if (entry.ownScore > entry.opponentScore) { // Team won
                if (scoreDiff >= 40) { // Example threshold for blowout win
                    aggregatedCareerStats[entry.team].blowoutWins++;
                }
                if (scoreDiff > 0 && scoreDiff <= 5) { // Example threshold for slim win (not a tie)
                    aggregatedCareerStats[entry.team].slimWins++;
                }
            } else if (entry.ownScore < entry.opponentScore) { // Team lost
                if (scoreDiff >= 40) { // Example threshold for blowout loss
                    aggregatedCareerStats[entry.team].blowoutLosses++;
                }
                if (scoreDiff > 0 && scoreDiff <= 5) { // Example threshold for slim loss
                    aggregatedCareerStats[entry.team].slimLosses++;
                }
            }
        });
    });

    // Process weekly scores to find high scores and top 2 scores
    Object.keys(weeklyScores).forEach(weekKey => {
        const scoresInWeek = weeklyScores[weekKey];
        if (scoresInWeek.length === 0) return;

        // Sort scores in descending order
        scoresInWeek.sort((a, b) => b.score - a.score);

        // First place
        const firstPlaceScore = scoresInWeek[0].score;
        scoresInWeek.filter(entry => entry.score === firstPlaceScore).forEach(entry => {
            if (aggregatedCareerStats[entry.team]) {
                aggregatedCareerStats[entry.team].weeklyHighScores++;
                aggregatedCareerStats[entry.team].weeklyTop2Scores++; // High score is also a top 2 score
            }
        });

        // Second place (if distinct from first place)
        if (scoresInWeek.length > 1) {
            let secondPlaceScore = -1; // Initialize with a value lower than any possible score
            for (let i = 1; i < scoresInWeek.length; i++) {
                if (scoresInWeek[i].score < firstPlaceScore) { // Find the first score strictly less than firstPlaceScore
                    secondPlaceScore = scoresInWeek[i].score;
                    break;
                }
            }

            if (secondPlaceScore !== -1) {
                scoresInWeek.filter(entry => entry.score === secondPlaceScore).forEach(entry => {
                    if (aggregatedCareerStats[entry.team]) {
                        aggregatedCareerStats[entry.team].weeklyTop2Scores++;
                    }
                });
            }
        }
    });


    const newCalculatedRecords = {};

    // Highest/Lowest Career DPR
    const sortedCareerDPR = [...careerDPRData].sort((a, b) => b.dpr - a.dpr);
    if (sortedCareerDPR.length > 0) {
      newCalculatedRecords.highestDPR = {
        value: sortedCareerDPR[0].dpr,
        entries: sortedCareerDPR.filter(d => d.dpr === sortedCareerDPR[0].dpr).map(d => ({ team: d.team }))
      };
      newCalculatedRecords.lowestDPR = {
        value: sortedCareerDPR[sortedCareerDPR.length - 1].dpr,
        entries: sortedCareerDPR.filter(d => d.dpr === sortedCareerDPR[sortedCareerDPR.length - 1].dpr).map(d => ({ team: d.team }))
      };
    }

    let maxWins = { value: 0, entries: [] };
    let maxLosses = { value: 0, entries: [] };
    let bestWinPct = { value: 0, entries: [] };
    let bestAllPlayWinPct = { value: 0, entries: [] };
    let maxWeeklyHighScores = { value: 0, entries: [] };
    let maxWeeklyTop2Scores = { value: 0, entries: [] };
    let maxWinningSeasons = { value: 0, entries: [] };
    let maxLosingSeasons = { value: 0, entries: [] };
    let maxBlowoutWins = { value: 0, entries: [] };
    let maxBlowoutLosses = { value: 0, entries: [] };
    let maxSlimWins = { value: 0, entries: [] };
    let maxSlimLosses = { value: 0, entries: [] };
    let maxTotalPoints = { value: 0, entries: [] };
    let maxPointsAgainst = { value: 0, entries: [] };


    if (typeof aggregatedCareerStats === 'object' && aggregatedCareerStats !== null) {
      Object.keys(aggregatedCareerStats).forEach(team => {
        const stats = aggregatedCareerStats[team];

        // Most Wins (Career)
        if (stats.totalWins > maxWins.value) {
          maxWins = { value: stats.totalWins, entries: [{ team: team }] };
        } else if (stats.totalWins === maxWins.value) {
          maxWins.entries.push({ team: team });
        }

        // Most Losses (Career)
        if (stats.totalLosses > maxLosses.value) {
          maxLosses = { value: stats.totalLosses, entries: [{ team: team }] };
        } else if (stats.totalLosses === maxLosses.value) {
          maxLosses.entries.push({ team: team });
        }

        // Best Win Percentage (Career)
        const currentWinPct = stats.totalGames > 0 ? (stats.totalWins + 0.5 * stats.totalTies) / stats.totalGames : 0;
        if (currentWinPct > bestWinPct.value) {
          bestWinPct = { value: currentWinPct, entries: [{ team: team }] };
        } else if (currentWinPct === bestWinPct.value) {
          bestWinPct.entries.push({ team: team });
        }

        // Best All-Play Win Percentage (Career) - Average of seasonal all-play win %
        const careerAllPlayWinPct = stats.allPlayWinPercentages.length > 0 ?
          stats.allPlayWinPercentages.reduce((sum, pct) => sum + pct, 0) / stats.allPlayWinPercentages.length : 0;
        if (careerAllPlayWinPct > bestAllPlayWinPct.value) {
          bestAllPlayWinPct = { value: careerAllPlayWinPct, entries: [{ team: team }] };
        } else if (careerAllPlayWinPct === bestAllPlayWinPct.value) {
          bestAllPlayWinPct.entries.push({ team: team });
        }

        // Most Weekly High Scores (Career)
        if (stats.weeklyHighScores > maxWeeklyHighScores.value) {
            maxWeeklyHighScores = { value: stats.weeklyHighScores, entries: [{ team: team }] };
        } else if (stats.weeklyHighScores === maxWeeklyHighScores.value) {
            maxWeeklyHighScores.entries.push({ team: team });
        }

        // Most Weekly Top 2 Scores (Career)
        if (stats.weeklyTop2Scores > maxWeeklyTop2Scores.value) {
            maxWeeklyTop2Scores = { value: stats.weeklyTop2Scores, entries: [{ team: team }] };
        } else if (stats.weeklyTop2Scores === maxWeeklyTop2Scores.value) {
            maxWeeklyTop2Scores.entries.push({ team: team });
        }

        // Most Winning Seasons (Career)
        if (stats.winningSeasons > maxWinningSeasons.value) {
          maxWinningSeasons = { value: stats.winningSeasons, entries: [{ team: team }] };
        } else if (stats.winningSeasons === maxWinningSeasons.value) {
          maxWinningSeasons.entries.push({ team: team });
        }

        // Most Losing Seasons (Career)
        if (stats.losingSeasons > maxLosingSeasons.value) {
          maxLosingSeasons = { value: stats.losingSeasons, entries: [{ team: team }] };
        } else if (stats.losingSeasons === maxLosingSeasons.value) {
          maxLosingSeasons.entries.push({ team: team });
        }

        // Most Blowout Wins (Career)
        if (stats.blowoutWins > maxBlowoutWins.value) {
          maxBlowoutWins = { value: stats.blowoutWins, entries: [{ team: team }] };
        } else if (stats.blowoutWins === maxBlowoutWins.value) {
          maxBlowoutWins.entries.push({ team: team });
        }

        // Most Blowout Losses (Career)
        if (stats.blowoutLosses > maxBlowoutLosses.value) {
          maxBlowoutLosses = { value: stats.blowoutLosses, entries: [{ team: team }] };
        } else if (stats.blowoutLosses === maxBlowoutLosses.value) {
          maxBlowoutLosses.entries.push({ team: team });
        }

        // Most Slim Wins (Career)
        if (stats.slimWins > maxSlimWins.value) {
          maxSlimWins = { value: stats.slimWins, entries: [{ team: team }] };
        } else if (stats.slimWins === maxSlimWins.value) {
          maxSlimWins.entries.push({ team: team });
        }

        // Most Slim Losses (Career)
        if (stats.slimLosses > maxSlimLosses.value) {
          maxSlimLosses = { value: stats.slimLosses, entries: [{ team: team }] };
        } else if (stats.slimLosses === maxSlimLosses.value) {
          maxSlimLosses.entries.push({ team: team });
        }

        // Most Total Points (Career)
        if (stats.totalPointsFor > maxTotalPoints.value) {
          maxTotalPoints = { value: stats.totalPointsFor, entries: [{ team: team }] };
        } else if (stats.totalPointsFor === maxTotalPoints.value) {
          maxTotalPoints.entries.push({ team: team });
        }

        // Most Points Against (Career)
        if (stats.totalPointsAgainst > maxPointsAgainst.value) {
          maxPointsAgainst = { value: stats.totalPointsAgainst, entries: [{ team: team }] };
        } else if (stats.totalPointsAgainst === maxPointsAgainst.value) {
          maxPointsAgainst.entries.push({ team: team });
        }
      });
    }

    // Consolidate all records for rendering in a single object
    setAllTimeRecords({
      highestDPR: newCalculatedRecords.highestDPR, // Directly use from newCalculatedRecords
      lowestDPR: newCalculatedRecords.lowestDPR,   // Directly use from newCalculatedRecords
      mostWins: maxWins,
      mostLosses: maxLosses,
      bestWinPct: bestWinPct,
      bestAllPlayWinPct: bestAllPlayWinPct,
      mostWeeklyHighScores: maxWeeklyHighScores,
      mostWeeklyTop2Scores: maxWeeklyTop2Scores,
      mostWinningSeasons: maxWinningSeasons,
      mostLosingSeasons: maxLosingSeasons,
      mostBlowoutWins: maxBlowoutWins,
      mostBlowoutLosses: maxBlowoutLosses,
      mostSlimWins: maxSlimWins,
      mostSlimLosses: maxSlimLosses,
      mostTotalPoints: maxTotalPoints,
      mostPointsAgainst: maxPointsAgainst,
    });

  }, [historicalMatchups, getDisplayTeamName]);

  // Helper functions for formatting
  const formatDPR = (dpr) => (typeof dpr === 'number' && !isNaN(dpr)) ? dpr.toFixed(3) : 'N/A';
  const formatWinPct = (pct) => (typeof pct === 'number' && !isNaN(pct)) ? `${(pct * 100).toFixed(2)}%` : 'N/A';
  const formatPoints = (points) => (typeof points === 'number' && !isNaN(points)) ? points.toFixed(2) : 'N/A';

  // Helper function to render a single record entry
  const renderSingleRecordEntry = (record, label, formatter = (value) => value) => {
    // Defensive check to ensure record and record.entries are not null/undefined
    if (!record || !Array.isArray(record.entries) || record.entries.length === 0) {
      return (
        <>
          <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
          <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
        </>
      );
    }
    return (
      <>
        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
        <td className="py-2 px-3 text-sm text-gray-800">{formatter(record.value)}</td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {record.entries.map((entry, idx) => (
            <span key={idx} className="block">{entry.team}</span>
          ))}
        </td>
      </>
    );
  };

  const recordDefinitions = [
    { key: 'highestDPR', label: 'Highest Career DPR', formatter: formatDPR },
    { key: 'lowestDPR', label: 'Lowest Career DPR', formatter: formatDPR },
    { key: 'mostWins', label: 'Most Wins (Career)' },
    { key: 'mostLosses', label: 'Most Losses (Career)' },
    { key: 'bestWinPct', label: 'Best Win % (Career)', formatter: formatWinPct },
    { key: 'bestAllPlayWinPct', label: 'Best All-Play Win % (Career)', formatter: formatWinPct },
    { key: 'mostWeeklyHighScores', label: 'Most Weekly High Scores (Career)' },
    { key: 'mostWeeklyTop2Scores', label: 'Most Weekly Top 2 Scores (Career)' },
    { key: 'mostWinningSeasons', label: 'Most Winning Seasons (Career)' },
    { key: 'mostLosingSeasons', label: 'Most Losing Seasons (Career)' },
    { key: 'mostBlowoutWins', label: 'Most Blowout Wins (Career)' },
    { key: 'mostBlowoutLosses', label: 'Most Blowout Losses (Career)' },
    { key: 'mostSlimWins', label: 'Most Slim Wins (Career)' },
    { key: 'mostSlimLosses', label: 'Most Slim Losses (Career)' },
    { key: 'mostTotalPoints', label: 'Most Total Points (Career)', formatter: formatPoints },
    { key: 'mostPointsAgainst', label: 'Most Points Against (Career)', formatter: formatPoints },
  ];


  return (
    <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center border-b pb-2">
        All-Time League Records
      </h2>

      {Object.keys(allTimeRecords).length > 0 ? (
        <section className="mb-8 overflow-x-auto"> {/* Added overflow-x-auto for responsiveness */}
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Record</th>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Value</th>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Team(s)</th>
              </tr>
            </thead>
            <tbody>
              {recordDefinitions.map((recordDef, index) => {
                const recordData = allTimeRecords[recordDef.key];
                return (
                  <tr key={recordDef.key} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {renderSingleRecordEntry(recordData, recordDef.label, recordDef.formatter)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-center text-gray-600">No career records available to display.</p>
      )}
    </div>
  );
};

export default LeagueRecords;
