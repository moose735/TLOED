// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});

  useEffect(() => {
    console.log("LeagueRecords: useEffect triggered.");
    if (!historicalMatchups || historicalMatchups.length === 0) {
      console.log("LeagueRecords: No historicalMatchups or empty. Setting records to empty.");
      setAllTimeRecords({});
      return;
    }

    // Get seasonal and career metrics from the centralized utility
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);
    console.log("LeagueRecords: Raw seasonalMetrics from calculations.js:", seasonalMetrics);
    console.log("LeagueRecords: Raw careerDPRData from calculations.js (enhanced):", calculatedCareerDPRs);


    // Aggregate records across all seasons for career stats that are counts or need seasonal averaging
    const aggregatedCareerStats = {};

    // First pass to aggregate basic seasonal data for counts and seasonal all-play averages
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        const seasonData = seasonalMetrics[year][year][team]; // Corrected: Access team data within the specific year

        if (!aggregatedCareerStats[team]) {
          aggregatedCareerStats[team] = {
            totalWins: 0, totalLosses: 0, totalTies: 0, totalGames: 0,
            totalPointsFor: 0, totalPointsAgainst: 0,
            allPlayWinPercentages: [], // Still needed for averaging for career all-play %
            weeklyHighScores: 0,
            weeklyTop2Scores: 0,
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
        
        // Collect seasonal all-play percentages for later averaging
        if (typeof seasonData.allPlayWinPercentage === 'number' && !isNaN(seasonData.allPlayWinPercentage)) {
            teamStats.allPlayWinPercentages.push(seasonData.allPlayWinPercentage);
        } else {
            // console.warn(`LeagueRecords: Skipping invalid allPlayWinPercentage for ${team} in ${year} (Type: ${typeof seasonData.allPlayWinPercentage}, Value: ${seasonData.allPlayWinPercentage}).`);
        }

        if (seasonData.wins > seasonData.losses) {
          teamStats.winningSeasons++;
        } else if (seasonData.losses > seasonData.wins) {
          teamStats.losingSeasons++;
        }
      });
    });
    console.log("LeagueRecords: Aggregated Career Stats after first pass (for counts and all-play avg):", aggregatedCareerStats);


    // Second pass over historicalMatchups to calculate weekly high scores, top 2, and blowout/slim wins/losses
    const weeklyScores = {}; // { year_week: [{ team, score }] }

    historicalMatchups.forEach(match => {
        const year = parseInt(match.year);
        const week = parseInt(match.week);
        const team1 = getDisplayTeamName(String(match.team1 || '').trim());
        const team2 = getDisplayTeamName(String(match.team2 || '').trim());
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);

        if (isNaN(year) || isNaN(week) || !team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
            return;
        }

        const weekKey = `${year}_${week}`;
        if (!weeklyScores[weekKey]) {
            weeklyScores[weekKey] = [];
        }
        weeklyScores[weekKey].push({ team: team1, score: team1Score });
        weeklyScores[weekKey].push({ team: team2, score: team2Score });

        const matchesForBlowoutSlim = [
            { team: team1, ownScore: team1Score, opponentScore: team2Score },
            { team: team2, ownScore: team2Score, opponentScore: team1Score }
        ];

        matchesForBlowoutSlim.forEach(entry => {
            if (!aggregatedCareerStats[entry.team]) return; // Ensure team exists in aggregated stats

            const scoreDiff = Math.abs(entry.ownScore - entry.opponentScore);

            if (entry.ownScore > entry.opponentScore) { // Team won
                if (scoreDiff >= 40) {
                    aggregatedCareerStats[entry.team].blowoutWins++;
                }
                if (scoreDiff > 0 && scoreDiff <= 5) {
                    aggregatedCareerStats[entry.team].slimWins++;
                }
            } else if (entry.ownScore < entry.opponentScore) { // Team lost
                if (scoreDiff >= 40) {
                    aggregatedCareerStats[entry.team].blowoutLosses++;
                }
                if (scoreDiff > 0 && scoreDiff <= 5) {
                    aggregatedCareerStats[entry.team].slimLosses++;
                }
            }
        });
    });

    // Process weekly scores to find high scores and top 2 scores
    Object.keys(weeklyScores).forEach(weekKey => {
        const scoresInWeek = weeklyScores[weekKey];
        if (scoresInWeek.length === 0) return;

        scoresInWeek.sort((a, b) => b.score - a.score);

        const firstPlaceScore = scoresInWeek[0].score;
        scoresInWeek.filter(entry => entry.score === firstPlaceScore).forEach(entry => {
            if (aggregatedCareerStats[entry.team]) {
                aggregatedCareerStats[entry.team].weeklyHighScores++;
                aggregatedCareerStats[entry.team].weeklyTop2Scores++; // Top score is also a top 2 score
            }
        });

        if (scoresInWeek.length > 1) {
            let secondPlaceScore = -Infinity;
            // Find the highest score that is not the firstPlaceScore
            for (let i = 1; i < scoresInWeek.length; i++) {
                if (scoresInWeek[i].score < firstPlaceScore) {
                    secondPlaceScore = scoresInWeek[i].score;
                    break;
                }
            }

            if (secondPlaceScore !== -Infinity) {
                scoresInWeek.filter(entry => entry.score === secondPlaceScore).forEach(entry => {
                    if (aggregatedCareerStats[entry.team]) {
                        // Only add if it wasn't already counted as a first place score
                        const isAlreadyCounted = scoresInWeek.filter(s => s.score === firstPlaceScore).some(s => s.team === entry.team);
                        if (!isAlreadyCounted) {
                           aggregatedCareerStats[entry.team].weeklyTop2Scores++;
                        }
                    }
                });
            }
        }
    });

    console.log("LeagueRecords: Aggregated Career Stats after second pass (weekly scores, counts):", aggregatedCareerStats);

    const newCalculatedRecords = {};

    // Initialize all record objects with proper null/empty or -Infinity defaults for calculation
    newCalculatedRecords.highestDPR = { value: null, entries: [] };
    newCalculatedRecords.lowestDPR = { value: null, entries: [] };
    newCalculatedRecords.mostWins = { value: null, entries: [] };
    newCalculatedRecords.mostLosses = { value: null, entries: [] };
    newCalculatedRecords.bestWinPct = { value: -Infinity, entries: [] };
    newCalculatedRecords.bestAllPlayWinPct = { value: -Infinity, entries: [] };
    newCalculatedRecords.mostWeeklyHighScores = { value: null, entries: [] };
    newCalculatedRecords.mostWeeklyTop2Scores = { value: null, entries: [] };
    newCalculatedRecords.mostWinningSeasons = { value: null, entries: [] };
    newCalculatedRecords.mostLosingSeasons = { value: null, entries: [] };
    newCalculatedRecords.mostBlowoutWins = { value: null, entries: [] };
    newCalculatedRecords.mostBlowoutLosses = { value: null, entries: [] };
    newCalculatedRecords.mostSlimWins = { value: null, entries: [] };
    newCalculatedRecords.mostSlimLosses = { value: null, entries: [] };
    newCalculatedRecords.mostTotalPoints = { value: -Infinity, entries: [] };
    newCalculatedRecords.mostPointsAgainst = { value: -Infinity, entries: [] };


    // Highest/Lowest Career DPR (Uses calculatedCareerDPRs directly)
    const sortedCareerDPR = [...calculatedCareerDPRs].sort((a, b) => b.dpr - a.dpr);
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

    // Variables to find the max/min across all teams, initialized to safe defaults
    let maxWins = { value: -Infinity, entries: [] };
    let maxLosses = { value: -Infinity, entries: [] };
    let bestWinPct = { value: -Infinity, entries: [] }; // This one will be populated from careerDPRData
    let bestAllPlayWinPct = { value: -Infinity, entries: [] }; // This one will be populated from aggregatedCareerStats
    let maxWeeklyHighScores = { value: -Infinity, entries: [] };
    let maxWeeklyTop2Scores = { value: -Infinity, entries: [] };
    let maxWinningSeasons = { value: -Infinity, entries: [] };
    let maxLosingSeasons = { value: -Infinity, entries: [] };
    let maxBlowoutWins = { value: -Infinity, entries: [] };
    let maxBlowoutLosses = { value: -Infinity, entries: [] };
    let maxSlimWins = { value: -Infinity, entries: [] };
    let maxSlimLosses = { value: -Infinity, entries: [] };
    let maxTotalPoints = { value: -Infinity, entries: [] };
    let maxPointsAgainst = { value: -Infinity, entries: [] };

    // Iterate over calculatedCareerDPRs for Best Win %
    if (Array.isArray(calculatedCareerDPRs)) {
      calculatedCareerDPRs.forEach(teamData => {
        const team = teamData.team;
        const careerWinPct = teamData.winPercentage; // Directly use the calculated career win percentage

        // Best Win Percentage
        if (typeof careerWinPct === 'number' && !isNaN(careerWinPct)) {
            if (careerWinPct > bestWinPct.value) {
                bestWinPct = { value: careerWinPct, entries: [{ team: team }] };
            } else if (careerWinPct === bestWinPct.value) {
                bestWinPct.entries.push({ team: team });
            }
        }
      });
    }

    // Now, iterate over aggregatedCareerStats for the remaining count-based records
    // and for Best All-Play Win Percentage
    if (typeof aggregatedCareerStats === 'object' && aggregatedCareerStats !== null) {
      Object.keys(aggregatedCareerStats).forEach(team => {
        const stats = aggregatedCareerStats[team];

        // Best All-Play Win Percentage (Calculated from aggregated seasonal all-play percentages)
        if (stats && stats.allPlayWinPercentages.length > 0) {
            const currentCareerAllPlayWinPct = stats.allPlayWinPercentages.reduce((sum, pct) => sum + pct, 0) / stats.allPlayWinPercentages.length;
            if (typeof currentCareerAllPlayWinPct === 'number' && !isNaN(currentCareerAllPlayWinPct)) {
                if (currentCareerAllPlayWinPct > bestAllPlayWinPct.value) {
                    bestAllPlayWinPct = { value: currentCareerAllPlayWinPct, entries: [{ team: team }] };
                } else if (currentCareerAllPlayWinPct === bestAllPlayWinPct.value) {
                    bestAllPlayWinPct.entries.push({ team: team });
                }
            }
        }

        // Most Wins
        if (stats.totalWins > maxWins.value) {
          maxWins = { value: stats.totalWins, entries: [{ team: team }] };
        } else if (stats.totalWins === maxWins.value) {
          maxWins.entries.push({ team: team });
        }

        // Most Losses
        if (stats.totalLosses > maxLosses.value) {
          maxLosses = { value: stats.totalLosses, entries: [{ team: team }] };
        } else if (stats.totalLosses === maxLosses.value) {
          maxLosses.entries.push({ team: team });
        }

        // Most Weekly High Scores
        if (stats.weeklyHighScores > maxWeeklyHighScores.value) {
            maxWeeklyHighScores = { value: stats.weeklyHighScores, entries: [{ team: team }] };
        } else if (stats.weeklyHighScores === maxWeeklyHighScores.value) {
            maxWeeklyHighScores.entries.push({ team: team });
        }

        // Most Weekly Top 2 Scores
        if (stats.weeklyTop2Scores > maxWeeklyTop2Scores.value) {
            maxWeeklyTop2Scores = { value: stats.weeklyTop2Scores, entries: [{ team: team }] };
        } else if (stats.weeklyTop2Scores === maxWeeklyTop2Scores.value) {
            maxWeeklyTop2Scores.entries.push({ team: team });
        }

        // Most Winning Seasons
        if (stats.winningSeasons > maxWinningSeasons.value) {
          maxWinningSeasons = { value: stats.winningSeasons, entries: [{ team: team }] };
        } else if (stats.winningSeasons === maxWinningSeasons.value) {
          maxWinningSeasons.entries.push({ team: team });
        }

        // Most Losing Seasons
        if (stats.losingSeasons > maxLosingSeasons.value) {
          maxLosingSeasons = { value: stats.losingSeasons, entries: [{ team: team }] };
        } else if (stats.losingSeasons === maxLosingSeasons.value) {
          maxLosingSeasons.entries.push({ team: team });
        }

        // Most Blowout Wins
        if (stats.blowoutWins > maxBlowoutWins.value) {
          maxBlowoutWins = { value: stats.blowoutWins, entries: [{ team: team }] };
        } else if (stats.blowoutWins === maxBlowoutWins.value) {
          maxBlowoutWins.entries.push({ team: team });
        }

        // Most Blowout Losses
        if (stats.blowoutLosses > maxBlowoutLosses.value) {
          maxBlowoutLosses = { value: stats.blowoutLosses, entries: [{ team: team }] };
        } else if (stats.blowoutLosses === maxBlowoutLosses.value) {
          maxBlowoutLosses.entries.push({ team: team });
        }

        // Most Slim Wins
        if (stats.slimWins > maxSlimWins.value) {
          maxSlimWins = { value: stats.slimWins, entries: [{ team: team }] };
        } else if (stats.slimWins === maxSlimWins.value) {
          maxSlimWins.entries.push({ team: team });
        }

        // Most Slim Losses
        if (stats.slimLosses > maxSlimLosses.value) {
          maxSlimLosses = { value: stats.slimLosses, entries: [{ team: team }] };
        } else if (stats.slimLosses === maxSlimLosses.value) {
          maxSlimLosses.entries.push({ team: team });
        }

        // Most Total Points For
        if (stats.totalPointsFor > maxTotalPoints.value) {
          maxTotalPoints = { value: stats.totalPointsFor, entries: [{ team: team }] };
        } else if (stats.totalPointsFor === maxTotalPoints.value) {
          maxTotalPoints.entries.push({ team: team });
        }

        // Most Points Against
        if (stats.totalPointsAgainst > maxPointsAgainst.value) {
          maxPointsAgainst = { value: stats.totalPointsAgainst, entries: [{ team: team }] };
        } else if (stats.totalPointsAgainst === maxPointsAgainst.value) {
          maxPointsAgainst.entries.push({ team: team });
        }
      });
    }
    console.log("LeagueRecords: Record candidates before final assignment (bestWinPct, bestAllPlayWinPct):", { bestWinPct, bestAllPlayWinPct });


    // Now, assign the calculated values to newCalculatedRecords
    // Only assign if a valid record was found (i.e., not -Infinity or empty entries for numerical records)
    if (maxWins.entries.length > 0) newCalculatedRecords.mostWins = maxWins;
    if (maxLosses.entries.length > 0) newCalculatedRecords.mostLosses = maxLosses;

    // These were initialized to -Infinity, so if they are still -Infinity, it means no valid data was found
    if (bestWinPct.value !== -Infinity) newCalculatedRecords.bestWinPct = bestWinPct;
    if (bestAllPlayWinPct.value !== -Infinity) newCalculatedRecords.bestAllPlayWinPct = bestAllPlayWinPct;

    if (maxWeeklyHighScores.entries.length > 0) newCalculatedRecords.mostWeeklyHighScores = maxWeeklyHighScores;
    if (maxWeeklyTop2Scores.entries.length > 0) newCalculatedRecords.mostWeeklyTop2Scores = maxWeeklyTop2Scores;
    if (maxWinningSeasons.entries.length > 0) newCalculatedRecords.mostWinningSeasons = maxWinningSeasons;
    if (maxLosingSeasons.entries.length > 0) newCalculatedRecords.mostLosingSeasons = maxLosingSeasons;
    if (maxBlowoutWins.entries.length > 0) newCalculatedRecords.mostBlowoutWins = maxBlowoutWins;
    if (maxBlowoutLosses.entries.length > 0) newCalculatedRecords.mostBlowoutLosses = maxBlowoutLosses;
    if (maxSlimWins.entries.length > 0) newCalculatedRecords.mostSlimWins = maxSlimWins;
    if (maxSlimLosses.entries.length > 0) newCalculatedRecords.mostSlimLosses = maxSlimLosses;

    if (maxTotalPoints.value !== -Infinity) newCalculatedRecords.mostTotalPoints = maxTotalPoints;
    if (maxPointsAgainst.value !== -Infinity) newCalculatedRecords.mostPointsAgainst = maxPointsAgainst;

    console.log("LeagueRecords: Final newCalculatedRecords before setting state:", newCalculatedRecords);
    setAllTimeRecords(newCalculatedRecords);

  }, [historicalMatchups, getDisplayTeamName]);

  // Helper functions for formatting
  const formatDPR = (dpr) => (typeof dpr === 'number' && !isNaN(dpr)) ? dpr.toFixed(3) : 'N/A';

  // Formats as ".xxx" (removes leading zero if present)
  const formatWinPct = (pct) => {
    console.log("formatWinPct called with value:", pct, "type:", typeof pct);
    if (typeof pct === 'number' && !isNaN(pct) && pct !== -Infinity) {
      let formatted = pct.toFixed(3);
      if (formatted.startsWith('0.')) {
        formatted = formatted.substring(1); // Remove the '0' if it's "0.XXX" -> ".XXX"
      } else if (formatted.startsWith('-0.')) {
        formatted = `-${formatted.substring(2)}`; // Handle negative " -0.XXX" -> "-.XXX"
      }
      return formatted;
    }
    return 'N/A';
  };

  // Formats as ".xxx%" (removes leading zero if present)
  const formatAllPlayWinPct = (pct) => {
    console.log("formatAllPlayWinPct called with value:", pct, "type:", typeof pct);
    if (typeof pct === 'number' && !isNaN(pct) && pct !== -Infinity) {
      let formatted = pct.toFixed(3);
      if (formatted.startsWith('0.')) {
        formatted = formatted.substring(1); // Remove the '0'
      } else if (formatted.startsWith('-0.')) {
        formatted = `-${formatted.substring(2)}`; // Handle negative
      }
      return `${formatted}%`; // Appended '%'
    }
    return 'N/A';
  };

  // Modified to format with commas and two decimal places using Intl.NumberFormat
  const formatPoints = (points) => {
    console.log("formatPoints called with value:", points, "type:", typeof points);
    if (typeof points === 'number' && !isNaN(points) && points !== -Infinity) {
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        }).format(points);
    }
    return 'N/A';
  };


  // Helper function to render a single record entry
  const renderSingleRecordEntry = (record, label, formatter = (value) => value) => {
    // Check if record is valid and has meaningful data
    if (!record || record.entries.length === 0 || record.value === null || record.value === -Infinity) {
      console.log(`renderSingleRecordEntry: Displaying N/A for "${label}". Record state:`, record);
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
        {/* Added text-right for numerical values */}
        <td className="py-2 px-3 text-sm text-gray-800 text-right">{formatter(record.value)}</td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {record.entries.map((entry, idx) => (
            <span key={idx} className="block">{entry.team}</span>
          ))}
        </td>
      </>
    );
  };

  const recordDefinitions = [
    { key: 'highestDPR', label: 'Highest DPR', formatter: formatDPR },
    { key: 'lowestDPR', label: 'Lowest DPR', formatter: formatDPR },
    { key: 'mostWins', label: 'Most Wins' },
    { key: 'mostLosses', label: 'Most Losses' },
    { key: 'bestWinPct', label: 'Best Win %', formatter: formatWinPct },
    { key: 'bestAllPlayWinPct', label: 'Best All-Play Win %', formatter: formatAllPlayWinPct },
    { key: 'mostWeeklyHighScores', label: 'Most Weekly High Scores' },
    { key: 'mostWeeklyTop2Scores', label: 'Most Weekly Top 2 Scores' },
    { key: 'mostWinningSeasons', label: 'Most Winning Seasons' },
    { key: 'mostLosingSeasons', label: 'Most Losing Seasons' },
    { key: 'mostBlowoutWins', label: 'Most Blowout Wins' },
    { key: 'mostBlowoutLosses', label: 'Most Blowout Losses' },
    { key: 'mostSlimWins', label: 'Most Slim Wins' },
    { key: 'mostSlimLosses', label: 'Most Slim Losses' },
    { key: 'mostTotalPoints', label: 'Most Total Points', formatter: formatPoints },
    { key: 'mostPointsAgainst', label: 'Most Points Against', formatter: formatPoints },
  ];


  return (
    <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center border-b pb-2">
        All-Time League Records
      </h2>

      {Object.keys(allTimeRecords).length > 0 ? (
        <section className="mb-8 overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Record</th>
                {/* Aligned 'Value' header to the right */}
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">Value</th>
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
