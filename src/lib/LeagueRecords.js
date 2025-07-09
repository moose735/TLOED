// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LeagueRecords = ({ historicalMatchups, historicalRosters, leaguesMetadata, usersBySeason, getTeamName }) => {
    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [expandedRecords, setExpandedRecords] = useState({});

    // IMPORTANT: Now using getTeamName from context, not getDisplayTeamName prop
    // This is aligned with the RecordBook.js changes

    useEffect(() => {
        console.log("LeagueRecords: useEffect triggered.");

        // Flatten historicalMatchups from { 'year': [matchup1, ...], ... } to a single array
        const allMatchups = Object.values(historicalMatchups || {}).flat();

        if (!allMatchups || allMatchups.length === 0) {
            console.log("LeagueRecords: No historicalMatchups or empty after flattening. Setting records to empty.");
            setAllTimeRecords({});
            return;
        }

        // Pass the correct getTeamName function to calculations.js
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(allMatchups, getTeamName);
        console.log("LeagueRecords: Raw seasonalMetrics from calculations.js:", seasonalMetrics);
        console.log("LeagueRecords: Raw careerDPRData from calculations.js (enhanced):", calculatedCareerDPRs);

        const aggregatedCareerStats = {};

        Object.keys(seasonalMetrics).forEach(year => {
            Object.keys(seasonalMetrics[year]).forEach(team => {
                const seasonData = seasonalMetrics[year][team];

                if (!aggregatedCareerStats[team]) {
                    aggregatedCareerStats[team] = {
                        totalWins: 0, totalLosses: 0, totalTies: 0, totalGames: 0,
                        totalPointsFor: 0, totalPointsAgainst: 0,
                        allPlayWinPercentages: [],
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

        const weeklyScores = {};

        // Iterate over the flattened allMatchups
        allMatchups.forEach(match => {
            const year = parseInt(match.year);
            const week = parseInt(match.week);
            // Use getTeamName consistent with the rest of the application
            const team1 = getTeamName(String(match.team1 || '').trim());
            const team2 = getTeamName(String(match.team2 || '').trim());
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
                if (!aggregatedCareerStats[entry.team]) {
                    // Initialize if team not already in aggregatedCareerStats (e.g., if a team only played a few games)
                    aggregatedCareerStats[entry.team] = {
                        totalWins: 0, totalLosses: 0, totalTies: 0, totalGames: 0,
                        totalPointsFor: 0, totalPointsAgainst: 0,
                        allPlayWinPercentages: [],
                        weeklyHighScores: 0,
                        weeklyTop2Scores: 0,
                        winningSeasons: 0, losingSeasons: 0,
                        blowoutWins: 0, blowoutLosses: 0,
                        slimWins: 0, slimLosses: 0,
                    };
                }

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
                for (let i = 1; i < scoresInWeek.length; i++) {
                    if (scoresInWeek[i].score < firstPlaceScore) {
                        secondPlaceScore = scoresInWeek[i].score;
                        break;
                    }
                }

                if (secondPlaceScore !== -Infinity) {
                    scoresInWeek.filter(entry => entry.score === secondPlaceScore).forEach(entry => {
                        if (aggregatedCareerStats[entry.team]) {
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

        const processRecord = (tempArray, isAscending = false) => {
            if (tempArray.length === 0) return { value: null, entries: [], allRankedEntries: [] };

            tempArray.sort((a, b) => isAscending ? a.value - b.value : b.value - a.value);

            const topValue = tempArray[0].value;
            const topEntries = tempArray.filter(item => item.value === topValue).map(item => ({ team: item.team, value: item.value })); // Include value here for clarity

            const allRankedEntries = [];
            let currentRankValue = null;
            let uniqueRanksAdded = 0;

            for (const item of tempArray) {
                if (item.value !== currentRankValue) {
                    uniqueRanksAdded++;
                    currentRankValue = item.value;
                }
                if (uniqueRanksAdded <= 6) {
                    allRankedEntries.push({ team: item.team, value: item.value });
                } else {
                    break;
                }
            }
            return { value: topValue, entries: topEntries, allRankedEntries: allRankedEntries };
        };

        if (Array.isArray(calculatedCareerDPRs) && calculatedCareerDPRs.length > 0) {
            newCalculatedRecords.highestDPR = processRecord(calculatedCareerDPRs.map(d => ({ team: d.team, value: d.dpr })));
            newCalculatedRecords.lowestDPR = processRecord(calculatedCareerDPRs.map(d => ({ team: d.team, value: d.dpr })), true);
        }

        const tempBestWinPct = [];
        if (Array.isArray(calculatedCareerDPRs)) {
            calculatedCareerDPRs.forEach(teamData => {
                const team = teamData.team;
                const careerWinPct = teamData.winPercentage;

                if (typeof careerWinPct === 'number' && !isNaN(careerWinPct)) {
                    tempBestWinPct.push({ team: team, value: careerWinPct });
                }
            });
            newCalculatedRecords.bestWinPct = processRecord(tempBestWinPct);
        }

        if (typeof aggregatedCareerStats === 'object' && aggregatedCareerStats !== null) {
            const tempMostWins = [];
            const tempMostLosses = [];
            const tempBestAllPlayWinPct = [];
            const tempMostWeeklyHighScores = [];
            const tempMostWeeklyTop2Scores = [];
            const tempMostWinningSeasons = [];
            const tempMostLosingSeasons = [];
            const tempMostBlowoutWins = [];
            const tempMostBlowoutLosses = [];
            const tempMostSlimWins = [];
            const tempMostSlimLosses = [];
            const tempMostTotalPoints = [];
            const tempMostPointsAgainst = [];

            Object.keys(aggregatedCareerStats).forEach(team => {
                const stats = aggregatedCareerStats[team];

                if (stats && stats.allPlayWinPercentages.length > 0) {
                    const currentCareerAllPlayWinPct = stats.allPlayWinPercentages.reduce((sum, pct) => sum + pct, 0) / stats.allPlayWinPercentages.length;
                    if (typeof currentCareerAllPlayWinPct === 'number' && !isNaN(currentCareerAllPlayWinPct)) {
                        tempBestAllPlayWinPct.push({ team: team, value: currentCareerAllPlayWinPct });
                    }
                }

                tempMostWins.push({ team: team, value: stats.totalWins });
                tempMostLosses.push({ team: team, value: stats.totalLosses });
                tempMostWeeklyHighScores.push({ team: team, value: stats.weeklyHighScores });
                tempMostWeeklyTop2Scores.push({ team: team, value: stats.weeklyTop2Scores });
                tempMostWinningSeasons.push({ team: team, value: stats.winningSeasons });
                tempMostLosingSeasons.push({ team: team, value: stats.losingSeasons });
                tempMostBlowoutWins.push({ team: team, value: stats.blowoutWins });
                tempMostBlowoutLosses.push({ team: team, value: stats.blowoutLosses });
                tempMostSlimWins.push({ team: team, value: stats.slimWins });
                tempMostSlimLosses.push({ team: team, value: stats.slimLosses });
                tempMostTotalPoints.push({ team: team, value: stats.totalPointsFor });
                tempMostPointsAgainst.push({ team: team, value: stats.totalPointsAgainst });
            });

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

        console.log("LeagueRecords: Final newCalculatedRecords before setting state:", newCalculatedRecords);
        setAllTimeRecords(newCalculatedRecords);

    }, [historicalMatchups, getTeamName]); // Dependency array: historicalMatchups (now an object), getTeamName


    const formatDPR = (dpr) => (typeof dpr === 'number' && !isNaN(dpr)) ? dpr.toFixed(3) : 'N/A';

    const formatWinPct = (pct) => {
        if (typeof pct === 'number' && !isNaN(pct) && pct !== -Infinity) {
            let formatted = (pct * 100).toFixed(1); // Format as percentage with one decimal place
            return `${formatted}%`;
        }
        return 'N/A';
    };

    const formatAllPlayWinPct = (pct) => {
        if (typeof pct === 'number' && !isNaN(pct) && pct !== -Infinity) {
            let formatted = (pct * 100).toFixed(1); // Format as percentage with one decimal place
            return `${formatted}%`;
        }
        return 'N/A';
    };

    const formatPoints = (points) => {
        if (typeof points === 'number' && !isNaN(points) && points !== -Infinity) {
            return new Intl.NumberFormat(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true
            }).format(points);
        }
        return 'N/A';
    };

    const toggleExpanded = (recordKey) => {
        setExpandedRecords(prev => ({
            ...prev,
            [recordKey]: !prev[recordKey]
        }));
    };

    const renderSingleRecordEntry = (record, label, formatter = (value) => value) => { // Removed isPercentage as it's not used in this function for rendering logic. Formatter handles it.
        if (!record || record.entries.length === 0 || record.value === null || record.value === -Infinity) {
            return (
                <>
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
                    <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                </>
            );
        }

        const isExpanded = expandedRecords[record.key];
        const topEntries = record.entries;

        return (
            <>
                <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
                <td className="py-2 px-3 text-sm text-gray-800 text-right">
                    {formatter(record.value)}
                </td>
                <td className="py-2 px-3 text-sm text-gray-700">
                    {topEntries.map((entry, idx) => (
                        <span key={`${record.key}-top-${idx}`} className="block">{entry.team}</span>
                    ))}

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
                                        let lastValue = record.value; // Initialize with the top value
                                        let uniqueRanksCount = 0;

                                        // Filter out entries that are already shown as top entries
                                        const entriesToShowInDropdown = record.allRankedEntries.filter(
                                            entry => !topEntries.some(top => top.team === entry.team && top.value === entry.value)
                                        );

                                        for (const entry of entriesToShowInDropdown) {
                                            if (entry.value !== lastValue) {
                                                uniqueRanksCount++;
                                                if (uniqueRanksCount > 5) {
                                                    break;
                                                }
                                                lastValue = entry.value;
                                            }
                                            dropdownEntries.push(entry);
                                        }

                                        return dropdownEntries.map((entry, idx) => (
                                            <div key={`${record.key}-dropdown-${idx}`} className="flex justify-between items-center text-xs text-gray-600">
                                                <span>{entry.team}</span>
                                                <span className="font-medium">{formatter(entry.value)}</span>
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
                                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-wider">Value</th>
                                <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Team(s)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recordDefinitions.map((recordDef, index) => {
                                const recordData = allTimeRecords[recordDef.key];
                                return (
                                    <tr key={recordDef.key} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        {renderSingleRecordEntry(
                                            { ...recordData, key: recordDef.key },
                                            recordDef.label,
                                            recordDef.formatter
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
