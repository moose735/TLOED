// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});
  // New state to manage expanded records
  const [expandedRecords, setExpandedRecords] = useState({});

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
        const seasonData = seasonalMetrics[year][team]; // Corrected: Access team data within the specific year

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


    // Helper to process a temporary array into the record format (top 1 + potentially other top entries)
    // This helper should be defined before its first use.
    const processRecord = (tempArray, isAscending = false) => {
        if (tempArray.length === 0) return { value: null, entries: [], allRankedEntries: [] };

        // Sort based on value (descending for max, ascending for min)
        tempArray.sort((a, b) => isAscending ? a.value - b.value : b.value - a.value);

        const topValue = tempArray[0].value;
        const topEntries = tempArray.filter(item => item.value === topValue).map(item => ({ team: item.team }));

        // For the dropdown, collect up to the next 5 unique values or teams
        const allRankedEntries = [];
        let currentRankValue = null;
        let uniqueRanksAdded = 0; // Track unique ranks

        for (const item of tempArray) {
            if (item.value !== currentRankValue) {
                uniqueRanksAdded++;
                currentRankValue = item.value;
            }
            if (uniqueRanksAdded <= 6) { // Top 1 + next 5 unique ranks
                allRankedEntries.push({ team: item.team, value: item.value });
            } else {
                break;
            }
        }

        return { value: topValue, entries: topEntries, allRankedEntries: allRankedEntries };
    };

    // Highest/Lowest Career DPR (Uses calculatedCareerDPRs directly)
    // We now use processRecord for these too for consistency and dropdown functionality
    if (Array.isArray(calculatedCareerDPRs) && calculatedCareerDPRs.length > 0) {
      newCalculatedRecords.highestDPR = processRecord(calculatedCareerDPRs.map(d => ({ team: d.team, value: d.dpr })));
      newCalculatedRecords.lowestDPR = processRecord(calculatedCareerDPRs.map(d => ({ team: d.team, value: d.dpr })), true); // true for ascending sort
    }

    // Variables to find the max/min across all teams, initialized to safe defaults
    // These are now temporary arrays that will be passed to processRecord
    const tempBestWinPct = [];


    // Iterate over calculatedCareerDPRs for Best Win %
    if (Array.isArray(calculatedCareerDPRs)) {
      calculatedCareerDPRs.forEach(teamData => {
        const team = teamData.team;
        const careerWinPct = teamData.winPercentage; // Directly use the calculated career win percentage

        // Best Win Percentage
        if (typeof careerWinPct === 'number' && !isNaN(careerWinPct)) {
            tempBestWinPct.push({ team: team, value: careerWinPct });
        }
      });
      // Process Best Win Pct after populating tempBestWinPct
      newCalculatedRecords.bestWinPct = processRecord(tempBestWinPct);
    }

    // Now, iterate over aggregatedCareerStats for the remaining count-based records
    // and for Best All-Play Win Percentage
    if (typeof aggregatedCareerStats === 'object' && aggregatedCareerStats !== null) {
      // Create temporary arrays to sort and find top N for each category
      const tempMostWins = [];
      const tempMostLosses = [];
      const tempBestAllPlayWinPct = [];
      const tempMostWeeklyHighScores = [];
      const tempMostWeeklyTop2Scores = [];
      const tempMostWinningSeasons = [];
      const tempMostLosingSeasons = [];
      const tempMostBlowoutWins = [];
      const tempMostBlowoutLosses = [];
      const tempMostSlimWins = []; // Corrected variable name
      const tempMostSlimLosses = [];
      const tempMostTotalPoints = [];
      const tempMostPointsAgainst = [];


      Object.keys(aggregatedCareerStats).forEach(team => {
        const stats = aggregatedCareerStats[team];

        // Best All-Play Win Percentage
        if (stats && stats.allPlayWinPercentages.length > 0) {
            const currentCareerAllPlayWinPct = stats.allPlayWinPercentages.reduce((sum, pct) => sum + pct, 0) / stats.allPlayWinPercentages.length;
            if (typeof currentCareerAllPlayWinPct === 'number' && !isNaN(currentCareerAllPlayWinPct)) {
                tempBestAllPlayWinPct.push({ team: team, value: currentCareerAllPlayWinPct });
            }
        }

        // Most Wins
        tempMostWins.push({ team: team, value: stats.totalWins });

        // Most Losses
        tempMostLosses.push({ team: team, value: stats.totalLosses });

        // Most Weekly High Scores
        tempMostWeeklyHighScores.push({ team: team, value: stats.weeklyHighScores });

        // Most Weekly Top 2 Scores
        tempMostWeeklyTop2Scores.push({ team: team, value: stats.weeklyTop2Scores });

        // Most Winning Seasons
        tempMostWinningSeasons.push({ team: team, value: stats.winningSeasons });

        // Most Losing Seasons
        tempMostLosingSeasons.push({ team: team, value: stats.losingSeasons });

        // Most Blowout Wins
        tempMostBlowoutWins.push({ team: team, value: stats.blowoutWins });

        // Most Blowout Losses
        tempMostBlowoutLosses.push({ team: team, value: stats.blowoutLosses });

        // Most Slim Wins
        tempMostSlimWins.push({ team: team, value: stats.slimWins }); // Corrected push to tempMostSlimWins

        // Most Slim Losses
        tempMostSlimLosses.push({ team: team, value: stats.slimLosses });

        // Most Total Points For
        tempMostTotalPoints.push({ team: team, value: stats.totalPointsFor });

        // Most Points Against
        tempMostPointsAgainst.push({ team: team, value: stats.totalPointsAgainst });
      });

      // Assign processed records
      newCalculatedRecords.mostWins = processRecord(tempMostWins);
      newCalculatedRecords.mostLosses = processRecord(tempMostLosses);
      newCalculatedRecords.bestAllPlayWinPct = processRecord(tempBestAllPlayWinPct);
      newCalculatedRecords.mostWeeklyHighScores = processRecord(tempMostWeeklyHighScores);
      newCalculatedRecords.mostWeeklyTop2Scores = processRecord(tempMostWeeklyTop2Scores);
      newCalculatedRecords.mostWinningSeasons = processRecord(tempMostWinningSeasons);
      newCalculatedRecords.mostLosingSeasons = processRecord(tempMostLosingSeasons);
      newCalculatedRecords.mostBlowoutWins = processRecord(tempMostBlowoutWins);
      newCalculatedRecords.mostBlowoutLosses = processRecord(tempMostBlowoutLosses);
      newCalculatedRecords.mostSlimWins = processRecord(tempMostSlimWins);
      newCalculatedRecords.mostSlimLosses = processRecord(tempMostSlimLosses);
      newCalculatedRecords.mostTotalPoints = processRecord(tempMostTotalPoints);
      newCalculatedRecords.mostPointsAgainst = processRecord(tempMostPointsAgainst);
    }
    console.log("LeagueRecords: Record candidates before final assignment (bestWinPct, bestAllPlayWinPct):", { bestWinPct: newCalculatedRecords.bestWinPct, bestAllPlayWinPct: newCalculatedRecords.bestAllPlayWinPct });


    // The assignments below are no longer strictly necessary if processRecord populates newCalculatedRecords directly,
    // but keeping them for clarity in case newCalculatedRecords was initialized with null/empty values and processRecord
    // might return the default if the input array is empty. However, processRecord itself returns the default.
    // So, the final assignment logic can be simplified as it now directly populates newCalculatedRecords inside the loops.

    console.log("LeagueRecords: Final newCalculatedRecords before setting state:", newCalculatedRecords);
    setAllTimeRecords(newCalculatedRecords);

  }, [historicalMatchups, getDisplayTeamName]);

  // Helper functions for formatting
  const formatDPR = (dpr) => (typeof dpr === 'number' && !isNaN(dpr)) ? dpr.toFixed(3) : 'N/A';

  // Formats as ".xxx" (removes leading zero if present)
  const formatWinPct = (pct) => {
    // console.log("formatWinPct called with value:", pct, "type:", typeof pct);
    if (typeof pct === 'number' && !isNaN(pct) && pct !== -Infinity) {
      let formatted = pct.toFixed(3);
      if (formatted.startsWith('0.')) {
        formatted = formatted.substring(1); // Remove the '0' if it's "0.XXX" -> ".XXX"
      } else if (formatted.startsWith('-0.')) {
        formatted = `-${formatted.substring(2)}`; // Handle negative " -0.XXX" -> "-.XXX"
      }
      return `${formatted}%`;
    }
    return 'N/A';
  };

  // Formats as ".xxx%" (removes leading zero if present)
  const formatAllPlayWinPct = (pct) => {
    // console.log("formatAllPlayWinPct called with value:", pct, "type:", typeof pct);
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
    // console.log("formatPoints called with value:", points, "type:", typeof points);
    if (typeof points === 'number' && !isNaN(points) && points !== -Infinity) {
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        }).format(points);
    }
    return 'N/A';
  };

  // Toggle function for dropdowns
  const toggleExpanded = (recordKey) => {
    setExpandedRecords(prev => ({
      ...prev,
      [recordKey]: !prev[recordKey]
    }));
  };

  // Helper function to render a single record entry, now with dropdown logic
  const renderSingleRecordEntry = (record, label, formatter = (value) => value, isPercentage = false) => {
    // Check if record is valid and has meaningful data
    if (!record || record.entries.length === 0 || record.value === null || record.value === -Infinity) {
      // console.log(`renderSingleRecordEntry: Displaying N/A for "${label}". Record state:`, record);
      return (
        <>
          <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
          <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
        </>
      );
    }

    const isExpanded = expandedRecords[record.key];
    const topEntries = record.entries; // These are already the top ones based on value
    // allRankedEntries now contains all entries sorted, including the top ones.

    return (
      <>
        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
        <td className="py-2 px-3 text-sm text-gray-800 text-right">
          {formatter(record.value)}{isPercentage ? '' : ''}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {topEntries.map((entry, idx) => (
            <span key={`${record.key}-top-${idx}`} className="block">{entry.team}</span>
          ))}

          {/* Only show "Show More" if there are more entries beyond the immediately displayed top ones */}
          {record.allRankedEntries && record.allRankedEntries.length > topEntries.length && (
            <>
              <button
                onClick={() => toggleExpanded(record.key)}
                className="text-blue-500 hover:text-blue-700 text-xs mt-1 focus:outline-none"
              >
                {isExpanded ? 'Show Less ▲' : 'Show More ▼'}
              </button>
              {isExpanded && (
                <div className="mt-2">
                  {(() => {
                    const dropdownEntries = [];
                    let lastValue = record.value;
                    let uniqueRanksCount = 0;

                    // Iterate through all ranked entries to find the next 5 unique ranks/values
                    for (const entry of record.allRankedEntries) {
                        // Skip if it's one of the top entries that are already shown
                        if (topEntries.some(top => top.team === entry.team && top.value === entry.value)) {
                            continue;
                        }

                        // If it's a new unique value/rank
                        if (entry.value !== lastValue) {
                            uniqueRanksCount++;
                            if (uniqueRanksCount > 5) { // We want top 1 + next 5 unique ranks
                                break;
                            }
                            lastValue = entry.value;
                        }
                        dropdownEntries.push(entry);
                    }

                    return dropdownEntries.map((entry, idx) => (
                        <div key={`${record.key}-dropdown-${idx}`} className="flex justify-between items-center text-xs text-gray-600">
                          <span>{entry.team}</span>
                          <span className="font-medium">{formatter(entry.value)}{isPercentage ? '' : ''}</span>
                        </div>
                    ));
                  })()}
                </div>
              )}
            </>
          )}
        </td>
      </>
    );
  };


  const recordDefinitions = [
    { key: 'highestDPR', label: 'Highest DPR', formatter: formatDPR },
    { key: 'lowestDPR', label: 'Lowest DPR', formatter: formatDPR },
    { key: 'mostWins', label: 'Most Wins' },
    { key: 'mostLosses', label: 'Most Losses' },
    { key: 'bestWinPct', label: 'Best Win %', formatter: formatWinPct, isPercentage: true },
    { key: 'bestAllPlayWinPct', label: 'Best All-Play Win %', formatter: formatAllPlayWinPct, isPercentage: true },
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
                // Pass recordKey to renderSingleRecordEntry so toggleExpanded can use it
                return (
                  <tr key={recordDef.key} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {renderSingleRecordEntry(
                      { ...recordData, key: recordDef.key }, // Pass the key here
                      recordDef.label,
                      recordDef.formatter,
                      recordDef.isPercentage // Pass the new prop
                    )}
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
