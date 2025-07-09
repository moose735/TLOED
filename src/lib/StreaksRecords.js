// src/lib/StreaksRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook

const StreaksRecords = ({ historicalMatchups }) => { // historicalMatchups is now the primary data source
    // Consume historicalData, getTeamName, loading, and error from the context
    const { historicalData, getTeamName, loading, error } = useSleeperData();
    const [aggregatedStreaks, setAggregatedStreaks] = useState({});

    useEffect(() => {
        // Log the historicalMatchups prop received by StreaksRecords
        console.log("StreaksRecords useEffect: historicalMatchups prop received:", historicalMatchups);
        console.log("StreaksRecords useEffect: First 5 elements of historicalMatchups prop:", historicalMatchups.slice(0, 5));
        if (historicalMatchups.length > 0) {
            console.log("StreaksRecords useEffect: Structure of first element in historicalMatchups prop:", historicalMatchups[0]);
        }

        // Check for loading, error, or missing historical data
        if (loading || error || !historicalMatchups || historicalMatchups.length === 0) {
            setAggregatedStreaks({});
            console.log("StreaksRecords useEffect: Data not ready or empty. Resetting streaks.");
            return;
        }

        const allHistoricalMatchupsFlat = historicalMatchups; // Use the prop directly

        // Helper to store chronological game data for each team
        // We'll use ownerId as the primary key for teamGameLogs to ensure consistency across seasons
        const teamGameLogs = {}; // { ownerId: [{ year, week, isWin, isLoss, score, opponentScore, rosterId }] }
        const weeklyScoresAcrossLeague = {}; // { year: { week: [{ rosterId, score }] } }

        allHistoricalMatchupsFlat.forEach(match => {
            // Ensure match has necessary properties (season and week are now expected to be on the object)
            // FIXED: Use team1_ and team2_ properties from the already processed matchup object
            if (!match || !match.matchup_id || !match.team1_roster_id || !match.team1_score || !match.team2_roster_id || !match.team2_score || match.season === undefined || match.week === undefined) {
                console.warn("StreaksRecords: Skipping invalid or incomplete matchup:", match);
                return;
            }

            const year = parseInt(match.season); // Assuming 'season' is the year property
            const week = parseInt(match.week);
            const team1RosterId = String(match.team1_roster_id); // FIXED: Use team1_roster_id
            const team2RosterId = String(match.team2_roster_id); // FIXED: Use team2_roster_id
            const team1Score = parseFloat(match.team1_score);   // FIXED: Use team1_score
            const team2Score = parseFloat(match.team2_score);   // FIXED: Use team2_score

            // Skip if data is not valid numbers
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
                console.warn(`StreaksRecords: Skipping matchup due to invalid numerical data. Match:`, match);
                return;
            }

            // Get owner IDs for consistent tracking across seasons
            // Use historicalData from context for rostersBySeason lookup
            const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
            const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId)?.owner_id;

            if (!team1OwnerId || !team2OwnerId) {
                console.warn(`StreaksRecords: Skipping matchup due to missing owner ID for year ${year}. Team1Roster: ${team1RosterId}, Team2Roster: ${team2RosterId}`);
                return;
            }

            // Skip if it's a future season with no actual games played (points are 0)
            if (team1Score === 0 && team2Score === 0 && year >= new Date().getFullYear()) {
                 console.log(`StreaksRecords: Skipping future season matchup with 0 scores for year ${year}.`);
                 return;
            }

            const isTie = team1Score === team2Score;

            // Populate teamGameLogs for both teams
            if (!teamGameLogs[team1OwnerId]) teamGameLogs[team1OwnerId] = [];
            if (!teamGameLogs[team2OwnerId]) teamGameLogs[team2OwnerId] = [];

            teamGameLogs[team1OwnerId].push({
                year,
                week,
                isWin: team1Score > team2Score,
                isLoss: team1Score < team2Score,
                isTie: isTie,
                score: team1Score,
                opponentScore: team2Score,
                rosterId: team1RosterId // Store rosterId for weeklyScoresAcrossLeague lookup
            });

            teamGameLogs[team2OwnerId].push({
                year,
                week,
                isWin: team2Score > team1Score,
                isLoss: team2Score < team1Score,
                isTie: isTie,
                score: team2Score,
                opponentScore: team1Score,
                rosterId: team2RosterId // Store rosterId for weeklyScoresAcrossLeague lookup
            });

            // Populate weeklyScoresAcrossLeague for score-based streaks
            if (!weeklyScoresAcrossLeague[year]) weeklyScoresAcrossLeague[year] = {};
            if (!weeklyScoresAcrossLeague[year][week]) weeklyScoresAcrossLeague[year][week] = [];

            weeklyScoresAcrossLeague[year][week].push({ rosterId: team1RosterId, score: team1Score });
            weeklyScoresAcrossLeague[year][week].push({ rosterId: team2RosterId, score: team2Score });
        });

        // Sort game logs for each team chronologically
        Object.keys(teamGameLogs).forEach(ownerId => {
            teamGameLogs[ownerId].sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.week - b.week;
            });
        });

        // Calculate weekly rankings (highest, lowest, top 3)
        const weeklyRankings = {}; // { year: { week: { highestScore, lowestScore, top3Scores } } }
        Object.keys(weeklyScoresAcrossLeague).forEach(year => {
            weeklyRankings[year] = {};
            Object.keys(weeklyScoresAcrossLeague[year]).forEach(week => {
                const scoresInWeek = weeklyScoresAcrossLeague[year][week];
                const sortedScores = [...scoresInWeek].sort((a, b) => b.score - a.score); // Descending

                weeklyRankings[year][week] = {
                    highestScore: sortedScores.length > 0 ? sortedScores[0].score : -Infinity,
                    lowestScore: sortedScores.length > 0 ? sortedScores[sortedScores.length - 1].score : Infinity,
                    top3Scores: sortedScores.slice(0, Math.min(3, sortedScores.length)).map(s => s.score)
                };
            });
        });


        // Initialize results for aggregated streaks
        const newAggregatedStreaks = {
            longestWinStreak: { value: 0, entries: [] }, // { team, streak, startYear, startWeek, endYear, endWeek }
            longestLosingStreak: { value: 0, entries: [] },
            longestConsecutiveHighestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveLowestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveTop3Weeks: { value: 0, entries: [] },
        };

        // Helper to update a streak record (max)
        const updateStreakRecord = (recordObj, newStreak, entryDetails) => {
            if (newStreak > recordObj.value) {
                recordObj.value = newStreak;
                recordObj.entries = [entryDetails];
            } else if (newStreak === recordObj.value && newStreak > 0) { // Only add if it's a tie for the record and streak is positive
                // Prevent duplicate entries for the same team and start/end period
                const isDuplicate = recordObj.entries.some(existingEntry =>
                    existingEntry.team === entryDetails.team &&
                    existingEntry.startYear === entryDetails.startYear &&
                    existingEntry.startWeek === entryDetails.startWeek &&
                    existingEntry.endYear === entryDetails.endYear &&
                    existingEntry.endWeek === entryDetails.endWeek
                );
                if (!isDuplicate) {
                    recordObj.entries.push(entryDetails);
                }
            }
        };


        // --- Calculate Streaks ---
        Object.keys(teamGameLogs).forEach(ownerId => {
            const games = teamGameLogs[ownerId];
            const teamNameForOwner = getTeamName(ownerId, games[0]?.year); // Get a representative team name for the owner

            // Win Streak & Losing Streak
            let currentWinStreak = 0;
            let currentLossStreak = 0;
            let winStreakStartYear = null;
            let winStreakStartWeek = null;
            let lossStreakStartYear = null;
            let lossStreakStartWeek = null;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];

                // Win Streak Logic
                if (game.isWin) {
                    if (currentWinStreak === 0) {
                        winStreakStartYear = game.year;
                        winStreakStartWeek = game.week;
                    }
                    currentWinStreak++;
                    currentLossStreak = 0; // Reset loss streak
                    lossStreakStartYear = null;
                    lossStreakStartWeek = null;
                } else {
                    // Record longest win streak found so far
                    if (currentWinStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { team: teamNameForOwner, streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[i-1] ? games[i-1].year : winStreakStartYear, endWeek: games[i-1] ? games[i-1].week : winStreakStartWeek });
                    }
                    currentWinStreak = 0; // Reset win streak
                    winStreakStartYear = null;
                    winStreakStartWeek = null;

                    // Loss Streak Logic
                    if (game.isLoss) {
                        if (currentLossStreak === 0) {
                            lossStreakStartYear = game.year;
                            lossStreakStartWeek = game.week;
                        }
                        currentLossStreak++;
                    } else { // Tie or win (should have been handled by isWin)
                        if (currentLossStreak > 0) {
                            updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { team: teamNameForOwner, streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lossStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lossStreakStartWeek });
                        }
                        currentLossStreak = 0;
                        lossStreakStartYear = null;
                        lossStreakStartWeek = null;
                    }
                }
            }
            // After loop, check for any active streaks
            if (currentWinStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { team: teamNameForOwner, streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
            }
            if (currentLossStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { team: teamNameForOwner, streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
            }


            // Consecutive Weeks with Highest/Lowest/Top 3 Score
            let currentHighestScoreStreak = 0;
            let currentLowestScoreStreak = 0;
            let currentTop3Streak = 0;
            let highestScoreStreakStartYear = null;
            let highestScoreStreakStartWeek = null;
            let lowestScoreStreakStartYear = null;
            let lowestScoreStreakStartWeek = null;
            let top3StreakStartYear = null;
            let top3StreakStartWeek = null;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];
                // Use rosterId from the game log to get the correct weekly score
                const scoresInWeek = weeklyScoresAcrossLeague[game.year]?.[game.week];
                const teamScoreInWeek = scoresInWeek?.find(s => s.rosterId === game.rosterId)?.score;

                if (teamScoreInWeek === undefined || teamScoreInWeek === null) {
                    // console.warn(`StreaksRecords: Score not found for roster ${game.rosterId} in ${game.year} Week ${game.week}. Skipping score streak check.`);
                    // Reset streaks if score data is missing for the current game
                    if (currentHighestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { team: teamNameForOwner, streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartWeek });
                    }
                    currentHighestScoreStreak = 0;
                    highestScoreStreakStartYear = null;
                    highestScoreStreakStartWeek = null;

                    if (currentLowestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { team: teamNameForOwner, streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartWeek });
                    }
                    currentLowestScoreStreak = 0;
                    lowestScoreStreakStartYear = null;
                    lowestScoreStreakStartWeek = null;

                    if (currentTop3Streak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { team: teamNameForOwner, streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear });
                    }
                    currentTop3Streak = 0;
                    top3StreakStartYear = null;
                    top3StreakStartWeek = null;

                    continue; // Skip if no ranking data for this week
                }

                const weekRanking = weeklyRankings[game.year]?.[game.week];

                // Highest Score Streak
                if (teamScoreInWeek === weekRanking.highestScore) {
                    if (currentHighestScoreStreak === 0) {
                        highestScoreStreakStartYear = game.year;
                        highestScoreStreakStartWeek = game.week;
                    }
                    currentHighestScoreStreak++;
                } else {
                    if (currentHighestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { team: teamNameForOwner, streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartWeek });
                    }
                    currentHighestScoreStreak = 0;
                    highestScoreStreakStartYear = null;
                    highestScoreStreakStartWeek = null;
                }

                // Lowest Score Streak
                if (teamScoreInWeek === weekRanking.lowestScore) {
                    if (currentLowestScoreStreak === 0) {
                        lowestScoreStreakStartYear = game.year;
                        lowestScoreStreakStartWeek = game.week;
                    }
                    currentLowestScoreStreak++;
                } else {
                    if (currentLowestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { team: teamNameForOwner, streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartWeek });
                    }
                    currentLowestScoreStreak = 0;
                    lowestScoreStreakStartYear = null;
                    lowestScoreStreakStartWeek = null;
                }

                // Top 3 Score Streak
                if (weekRanking.top3Scores.includes(teamScoreInWeek)) {
                    if (currentTop3Streak === 0) {
                        top3StreakStartYear = game.year;
                        top3StreakStartWeek = game.week;
                    }
                    currentTop3Streak++;
                } else {
                    if (currentTop3Streak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { team: teamNameForOwner, streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear });
                    }
                    currentTop3Streak = 0;
                    top3StreakStartYear = null;
                    top3StreakStartWeek = null;
                }
            }

            // Check after loop for any ending streaks
            if (currentHighestScoreStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { team: teamNameForOwner, streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
            }
            if (currentLowestScoreStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { team: teamNameForOwner, streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
            }
            if (currentTop3Streak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { team: teamNameForOwner, streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
            }
        });

        // Filter out records that are 0 (no streaks found) and sort entries
        Object.keys(newAggregatedStreaks).forEach(key => {
            const record = newAggregatedStreaks[key];
            if (record.value === 0 && record.entries.length === 0) {
                record.entries = [];
            }
            record.entries.sort((a, b) => {
                const teamCompare = (a.team || '').localeCompare(b.team || '');
                if (teamCompare !== 0) return teamCompare;
                if (a.startYear !== b.startYear) return a.startYear - b.startYear;
                return a.startWeek - b.startWeek;
            });
        });

        setAggregatedStreaks(newAggregatedStreaks);

    }, [historicalMatchups, historicalData, getTeamName, loading, error]); // Add historicalMatchups to dependencies


    const recordsToDisplay = [
        { key: 'longestWinStreak', label: 'Win Streak' },
        { key: 'longestLosingStreak', label: 'Losing Streak' },
        { key: 'longestConsecutiveHighestScoreWeeks', label: 'High Score Streak' },
        // Removed 'longestConsecutiveLowestScoreWeeks'
        { key: 'longestConsecutiveTop3Weeks', label: 'Top 3 Score Streak' },
    ];

    if (loading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading streak records...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading streak data: {error.message}</div>;
    }

    if (Object.keys(aggregatedStreaks).length === 0 || recordsToDisplay.every(r => aggregatedStreaks[r.key]?.entries.length === 0)) {
        return <p className="text-center text-gray-600">No streak data available to display records.</p>;
    }

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">STREAK RECORDS - ( CONSECUTIVE )</h3>
            <p className="text-sm text-gray-600 mb-6">Longest historical streaks for teams.</p>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Team</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Start</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">End</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                            const recordData = aggregatedStreaks[recordDef.key];
                            if (!recordData || recordData.entries.length === 0) {
                                return (
                                    <tr key={recordDef.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                                        <td colSpan="4" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                                    </tr>
                                );
                            }
                            return recordData.entries.map((entry, entryIndex) => (
                                <tr
                                    key={`${recordDef.key}-${entry.team}-${entry.startYear}-${entry.startWeek}-${entryIndex}`}
                                    className={`
                                        ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                        ${entryIndex === recordData.entries.length - 1 ? 'border-b border-gray-100' : ''}
                                    `}
                                >
                                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                                        {entryIndex === 0 ? recordDef.label : ''}
                                    </td>
                                    <td className="py-2 px-3 text-sm text-gray-800">
                                        {entryIndex === 0 ? entry.streak : ''}
                                    </td>
                                    <td className="py-2 px-3 text-sm text-gray-700">{entry.team}</td>
                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                        <div className="flex items-center justify-center">
                                            <span>{entry.startYear}</span>
                                            <span>-</span>
                                            <span>Week {entry.startWeek}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                        <div className="flex items-center justify-center">
                                            <span>{entry.endYear}</span>
                                            <span>-</span>
                                            <span>Week {entry.endWeek}</span>
                                        </div>
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StreaksRecords;
