// src/lib/StreaksRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook
import logger from '../utils/logger';

const StreaksRecords = ({ historicalMatchups }) => { // historicalMatchups is now the primary data source
    // Consume historicalData, getTeamName, loading, error, and nflState from the context
    const { historicalData, getTeamName, loading, error, nflState } = useSleeperData();
    const [aggregatedStreaks, setAggregatedStreaks] = useState({});
    const [allStreaksData, setAllStreaksData] = useState({});
    const [expandedSections, setExpandedSections] = useState({});

    const toggleSection = (recordKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [recordKey]: !prev[recordKey]
        }));
    };

    useEffect(() => {
        // Check for loading, error, or missing historical data
        if (loading || error || !historicalMatchups || historicalMatchups.length === 0) {
            setAggregatedStreaks({});
            return;
        }

        const allHistoricalMatchupsFlat = historicalMatchups; // Use the prop directly

        // Helper to store chronological game data for each team
        // We'll use ownerId as the primary key for teamGameLogs to ensure consistency across seasons
        const teamGameLogs = {}; // { ownerId: [{ year, week, isWin, isLoss, score, opponentScore, rosterId }] }
        const weeklyScoresAcrossLeague = {}; // { year: { week: [{ rosterId, score }] } }

        allHistoricalMatchupsFlat.forEach(match => {
            // Ensure match has necessary properties (season and week are now expected to be on the object)
            if (!match || !match.matchup_id || !match.team1_roster_id || match.team1_score === undefined || !match.team2_roster_id || match.team2_score === undefined || match.season === undefined || match.week === undefined) {
                logger.warn("StreaksRecords: Skipping invalid or incomplete matchup. Missing data:", {
                    matchup_id: match?.matchup_id,
                    team1_roster_id: match?.team1_roster_id,
                    team1_score: match?.team1_score,
                    team2_roster_id: match?.team2_roster_id,
                    team2_score: match?.team2_score,
                    season: match?.season,
                    week: match?.week,
                    fullMatch: match
                });
                return;
            }

            const year = parseInt(match.season);
            const week = parseInt(match.week);
            const team1RosterId = String(match.team1_roster_id);
            const team2RosterId = String(match.team2_roster_id);
            const team1Score = parseFloat(match.team1_score);
            const team2Score = parseFloat(match.team2_score);

            // Skip if data is not valid numbers
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
                logger.warn(`StreaksRecords: Skipping matchup due to invalid numerical data. Match:`, match);
                return;
            }

            // Get owner IDs for consistent tracking across seasons
            const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
            const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId)?.owner_id;

            if (!team1OwnerId || !team2OwnerId) {
                logger.warn(`StreaksRecords: Skipping matchup due to missing owner ID for year ${year}. Team1Roster: ${team1RosterId}, Team2Roster: ${team2RosterId}`);
                return;
            }

            // Skip if it's a future season with no actual games played (points are 0 for both teams)
            if (team1Score === 0 && team2Score === 0 && year >= new Date().getFullYear()) {
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
                rosterId: team1RosterId
            });

            teamGameLogs[team2OwnerId].push({
                year,
                week,
                isWin: team2Score > team1Score,
                isLoss: team2Score < team1Score,
                isTie: isTie,
                score: team2Score,
                opponentScore: team1Score,
                rosterId: team2RosterId
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
        const weeklyRankings = {};
        Object.keys(weeklyScoresAcrossLeague).forEach(year => {
            weeklyRankings[year] = {};
            Object.keys(weeklyScoresAcrossLeague[year]).forEach(week => {
                const scoresInWeek = weeklyScoresAcrossLeague[year][week];
                const sortedScores = [...scoresInWeek].sort((a, b) => b.score - a.score);

                weeklyRankings[year][week] = {
                    highestScore: sortedScores.length > 0 ? sortedScores[0].score : -Infinity,
                    lowestScore: sortedScores.length > 0 ? sortedScores[sortedScores.length - 1].score : Infinity,
                    top3Scores: sortedScores.slice(0, Math.min(3, sortedScores.length)).map(s => s.score)
                };
            });
        });


        // Initialize results for aggregated streaks
        const newAggregatedStreaks = {
            longestWinStreak: { value: 0, entries: [] },
            longestLosingStreak: { value: 0, entries: [] },
            longestConsecutiveHighestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveLowestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveTop3Weeks: { value: 0, entries: [] },
        };

        // Track all streaks for top 5 rankings
        const allStreaks = {
            longestWinStreak: [],
            longestLosingStreak: [],
            longestConsecutiveHighestScoreWeeks: [],
            longestConsecutiveLowestScoreWeeks: [],
            longestConsecutiveTop3Weeks: [],
        };

        // Helper to update a streak record (max)
        // MODIFIED: Now accepts getTeamNameFn and ownerId to dynamically get team name
        const updateStreakRecord = (recordObj, newStreak, entryDetails, ownerId, getTeamNameFn) => {
            // Get the team name based on the start year of the streak
            const teamName = getTeamNameFn(ownerId, entryDetails.startYear);
            const newEntry = { ...entryDetails, team: teamName, ownerId }; // Add the correct team name to the entry

            if (newStreak > recordObj.value) {
                recordObj.value = newStreak;
                recordObj.entries = [newEntry];
            } else if (newStreak === recordObj.value && newStreak > 0) {
                const isDuplicate = recordObj.entries.some(existingEntry =>
                    existingEntry.team === newEntry.team &&
                    existingEntry.startYear === newEntry.startYear &&
                    existingEntry.startWeek === newEntry.startWeek &&
                    existingEntry.endYear === newEntry.endYear &&
                    existingEntry.endWeek === newEntry.endWeek
                );
                if (!isDuplicate) {
                    recordObj.entries.push(newEntry);
                }
            }
        };

        // Helper to add all streaks for top 5 tracking
        const addToAllStreaks = (category, streak, entryDetails, ownerId, getTeamNameFn) => {
            if (streak > 0) {
                const teamName = getTeamNameFn(ownerId, entryDetails.startYear);
                allStreaks[category].push({
                    ...entryDetails,
                    team: teamName,
                    ownerId,
                    streak
                });
            }
        };


        // --- Calculate Streaks ---
        Object.keys(teamGameLogs).forEach(ownerId => {
            const games = teamGameLogs[ownerId];
            // Removed: const teamNameForOwner = getTeamName(ownerId, games[0]?.year); // This is now dynamic in updateStreakRecord

            let currentWinStreak = 0;
            let currentLossStreak = 0;
            let winStreakStartYear = null;
            let winStreakStartWeek = null;
            let lossStreakStartYear = null;
            let lossStreakStartWeek = null;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];

                if (game.isWin) {
                    if (currentWinStreak === 0) {
                        winStreakStartYear = game.year;
                        winStreakStartWeek = game.week;
                    }
                    currentWinStreak++;
                    // If a win occurs, end any active losing streak
                    if (currentLossStreak > 0) {
                        const losingStreakData = {
                            streak: currentLossStreak,
                            startYear: lossStreakStartYear,
                            startWeek: lossStreakStartWeek,
                            endYear: games[i-1] ? games[i-1].year : lossStreakStartYear,
                            endWeek: games[i-1] ? games[i-1].week : lossStreakStartWeek
                        };
                        updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, losingStreakData, ownerId, getTeamName);
                        addToAllStreaks('longestLosingStreak', currentLossStreak, losingStreakData, ownerId, getTeamName);
                    }
                    currentLossStreak = 0;
                    lossStreakStartYear = null;
                    lossStreakStartWeek = null;
                } else if (game.isLoss) {
                    if (currentLossStreak === 0) {
                        lossStreakStartYear = game.year;
                        lossStreakStartWeek = game.week;
                    }
                    currentLossStreak++;
                    // If a loss occurs, end any active winning streak
                    if (currentWinStreak > 0) {
                        const winStreakData = {
                            streak: currentWinStreak,
                            startYear: winStreakStartYear,
                            startWeek: winStreakStartWeek,
                            endYear: games[i-1] ? games[i-1].year : winStreakStartYear,
                            endWeek: games[i-1] ? games[i-1].week : winStreakStartWeek
                        };
                        updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, winStreakData, ownerId, getTeamName);
                        addToAllStreaks('longestWinStreak', currentWinStreak, winStreakData, ownerId, getTeamName);
                    }
                    currentWinStreak = 0;
                    winStreakStartYear = null;
                    winStreakStartWeek = null;
                } else if (game.isTie) { // Ties break both win and loss streaks
                    if (currentWinStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, {
                            streak: currentWinStreak,
                            startYear: winStreakStartYear,
                            startWeek: winStreakStartWeek,
                            endYear: games[i-1] ? games[i-1].year : winStreakStartYear,
                            endWeek: games[i-1] ? games[i-1].week : winStreakStartYear
                        }, ownerId, getTeamName); // Pass ownerId and getTeamName
                    }
                    currentWinStreak = 0;
                    winStreakStartYear = null;
                    winStreakStartWeek = null;

                    if (currentLossStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, {
                            streak: currentLossStreak,
                            startYear: lossStreakStartYear,
                            startWeek: lossStreakStartWeek,
                            endYear: games[i-1] ? games[i-1].year : lossStreakStartYear,
                            endWeek: games[i-1] ? games[i-1].week : lossStreakStartYear
                        }, ownerId, getTeamName); // Pass ownerId and getTeamName
                    }
                    currentLossStreak = 0;
                    lossStreakStartYear = null;
                    lossStreakStartWeek = null;
                }
            }
            // After loop, check for any active streaks that extend to the end of the season
            if (currentWinStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }, ownerId, getTeamName); // Pass ownerId and getTeamName
            }
            if (currentLossStreak > 0) {
                updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }, ownerId, getTeamName); // Pass ownerId and getTeamName
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

            // Track previous week/year for each score-based streak to ensure consecutive weeks
            let highestPrevYear = null;
            let highestPrevWeek = null;
            let lowestPrevYear = null;
            let lowestPrevWeek = null;
            let top3PrevYear = null;
            let top3PrevWeek = null;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];
                const scoresInWeek = weeklyScoresAcrossLeague[game.year]?.[game.week];
                const teamScoreInWeek = scoresInWeek?.find(s => s.rosterId === game.rosterId)?.score;

                if (teamScoreInWeek === undefined || teamScoreInWeek === null) {
                    // Reset all score-based streaks if data is missing for the current game
                    if (currentHighestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                    }
                    currentHighestScoreStreak = 0;
                    highestScoreStreakStartYear = null;
                    highestScoreStreakStartWeek = null;

                    if (currentLowestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                    }
                    currentLowestScoreStreak = 0;
                    lowestScoreStreakStartYear = null;
                    lowestScoreStreakStartWeek = null;

                    if (currentTop3Streak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                    }
                    currentTop3Streak = 0;
                    top3StreakStartYear = null;
                    top3StreakStartWeek = null;

                    continue; // Skip if no ranking data for this week
                }

                const weekRanking = weeklyRankings[game.year]?.[game.week];

                // Skip current incomplete week for high score streaks
                const currentYear = new Date().getFullYear();
                const currentWeek = nflState?.week || 1;
                const isCurrentIncompleteWeek = game.year === currentYear && game.week === currentWeek;

                // Highest Score Streak (must be consecutive weeks)
                if (!isCurrentIncompleteWeek && teamScoreInWeek === weekRanking.highestScore) {
                    if (currentHighestScoreStreak === 0) {
                        highestScoreStreakStartYear = game.year;
                        highestScoreStreakStartWeek = game.week;
                        currentHighestScoreStreak = 1;
                    } else if (game.year === highestPrevYear && game.week === highestPrevWeek + 1) {
                        // consecutive week -> continue streak
                        currentHighestScoreStreak++;
                    } else {
                        // non-consecutive qualifying week: close previous streak and start a new one
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName);
                        addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName);

                        highestScoreStreakStartYear = game.year;
                        highestScoreStreakStartWeek = game.week;
                        currentHighestScoreStreak = 1;
                    }
                    highestPrevYear = game.year;
                    highestPrevWeek = game.week;
                } else {
                    if (currentHighestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                        addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName);
                    }
                    currentHighestScoreStreak = 0;
                    highestScoreStreakStartYear = null;
                    highestScoreStreakStartWeek = null;
                    highestPrevYear = null;
                    highestPrevWeek = null;
                }

                // Lowest Score Streak (must be consecutive weeks)
                if (!isCurrentIncompleteWeek && teamScoreInWeek === weekRanking.lowestScore) {
                    if (currentLowestScoreStreak === 0) {
                        lowestScoreStreakStartYear = game.year;
                        lowestScoreStreakStartWeek = game.week;
                        currentLowestScoreStreak = 1;
                    } else if (game.year === lowestPrevYear && game.week === lowestPrevWeek + 1) {
                        currentLowestScoreStreak++;
                    } else {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName);
                        addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName);

                        lowestScoreStreakStartYear = game.year;
                        lowestScoreStreakStartWeek = game.week;
                        currentLowestScoreStreak = 1;
                    }
                    lowestPrevYear = game.year;
                    lowestPrevWeek = game.week;
                } else {
                    if (currentLowestScoreStreak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                        addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName);
                    }
                    currentLowestScoreStreak = 0;
                    lowestScoreStreakStartYear = null;
                    lowestScoreStreakStartWeek = null;
                    lowestPrevYear = null;
                    lowestPrevWeek = null;
                }

                // Top 3 Score Streak (must be consecutive weeks)
                if (!isCurrentIncompleteWeek && weekRanking.top3Scores.includes(teamScoreInWeek)) {
                    if (currentTop3Streak === 0) {
                        top3StreakStartYear = game.year;
                        top3StreakStartWeek = game.week;
                        currentTop3Streak = 1;
                    } else if (game.year === top3PrevYear && game.week === top3PrevWeek + 1) {
                        currentTop3Streak++;
                    } else {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                        addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName);

                        top3StreakStartYear = game.year;
                        top3StreakStartWeek = game.week;
                        currentTop3Streak = 1;
                    }
                    top3PrevYear = game.year;
                    top3PrevWeek = game.week;
                } else {
                    if (currentTop3Streak > 0) {
                        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); // Pass ownerId and getTeamName
                        addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName);
                    }
                    currentTop3Streak = 0;
                    top3StreakStartYear = null;
                    top3StreakStartWeek = null;
                    top3PrevYear = null;
                    top3PrevWeek = null;
                }
            }

            // After loop, check for any ending streaks
            if (currentHighestScoreStreak > 0) {
                const endingStreak = { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week };
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, endingStreak, ownerId, getTeamName);
                addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, endingStreak, ownerId, getTeamName);
            }
            if (currentLowestScoreStreak > 0) {
                const endingStreak = { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week };
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, endingStreak, ownerId, getTeamName);
                addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, endingStreak, ownerId, getTeamName);
            }
            if (currentTop3Streak > 0) {
                const endingStreak = { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week };
                updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, endingStreak, ownerId, getTeamName);
                addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, endingStreak, ownerId, getTeamName);
            }
        });

        // Filter out records that are 0 (no streaks found) and sort entries
        Object.keys(newAggregatedStreaks).forEach(key => {
            const record = newAggregatedStreaks[key];
            if (record.value === 0 && record.entries.length === 0) {
                record.entries = [];
            }
            record.entries.sort((a, b) => {
                // Sort by team name first, then by start year and week
                const teamCompare = (a.team || '').localeCompare(b.team || '');
                if (teamCompare !== 0) return teamCompare;
                if (a.startYear !== b.startYear) return a.startYear - b.startYear;
                return a.startWeek - b.startWeek;
            });
        });

        setAggregatedStreaks(newAggregatedStreaks);
        setAllStreaksData(allStreaks);

    }, [historicalMatchups, historicalData, getTeamName, loading, error]);


    const recordsToDisplay = [
        { key: 'longestWinStreak', label: 'Win Streak' },
        { key: 'longestLosingStreak', label: 'Losing Streak' },
        { key: 'longestConsecutiveHighestScoreWeeks', label: 'High Score Streak' },
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
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        🔥
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Streak Records</h3>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Longest consecutive achievements in league history
                        </p>
                    </div>
                </div>
            </div>

                    {/* Records Table (mobile-first) */}

                    {/* Mobile: compact card list */}
                    <div className="space-y-3 sm:hidden">
                        {recordsToDisplay.map((recordDef) => {
                            const recordData = aggregatedStreaks[recordDef.key];
                            if (!recordData || recordData.entries.length === 0) {
                                return (
                                    <div key={recordDef.key} className="bg-white border border-gray-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-700">{recordDef.label}</div>
                                                <div className="text-xs text-gray-500">No data</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Get all tied holders (same value as the record)
                            const recordValue = recordData.value;
                            const tiedHolders = recordData.entries.filter(entry => entry.streak === recordValue);
                            const primary = tiedHolders[0];

                            return (
                                <div key={recordDef.key} className="bg-white border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="text-sm font-semibold text-gray-900">{recordDef.label}</div>
                                            {tiedHolders.length > 0 && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {tiedHolders.map((holder, idx) => (
                                                        <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                                                            <span className="font-medium">{holder.team}</span>
                                                            {holder.startYear !== undefined && (
                                                                <div className="text-xs text-gray-500 mt-0.5">
                                                                    {holder.endYear && holder.endWeek && 
                                                                     (holder.startYear !== holder.endYear || holder.startWeek !== holder.endWeek) ? (
                                                                        `${holder.startYear} W${holder.startWeek} - ${holder.endYear} W${holder.endWeek}`
                                                                    ) : (
                                                                        `${holder.startYear} W${holder.startWeek}`
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {primary && (
                                                <div className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200">
                                                    <span className="font-bold text-gray-900 text-sm">{primary.streak}</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => toggleSection(recordDef.key)}
                                                aria-label={`${expandedSections[recordDef.key] ? 'Hide' : 'Show'} top 5 for ${recordDef.label}`}
                                                className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
                                            >
                                                <svg className={`w-4 h-4 text-gray-600 transition-transform ${expandedSections[recordDef.key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expandable Top5 for mobile */}
                                    {expandedSections[recordDef.key] && allStreaksData[recordDef.key] && allStreaksData[recordDef.key].length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {allStreaksData[recordDef.key]
                                                .filter(streak => streak.streak > 0)
                                                .sort((a, b) => b.streak - a.streak)
                                                .slice(0, 5)
                                                .map((streak, idx) => (
                                                    <div key={`${recordDef.key}-mobile-top5-${streak.team}-${streak.streak}-${idx}`} className="flex items-start justify-between bg-gray-50 rounded-md p-2 border border-gray-100">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold mt-0.5">{idx + 1}</div>
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{streak.team}</div>
                                                                {streak.startYear !== undefined && (
                                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                                        {streak.endYear && streak.endWeek && 
                                                                         (streak.startYear !== streak.endYear || streak.startWeek !== streak.endWeek) ? (
                                                                            `${streak.startYear} W${streak.startWeek} - ${streak.endYear} W${streak.endWeek}`
                                                                        ) : (
                                                                            `${streak.startYear} W${streak.startWeek}`
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-sm font-semibold text-gray-900 flex-shrink-0">{streak.streak}</div>
                                                    </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop/table: hidden on small screens */}
                    <div className="hidden sm:block bg-gradient-to-r from-gray-50 to-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🏆</span> Record
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📊</span> Length
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">👑</span> Team
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🎯</span> Started
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🏁</span> Ended
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                                const recordData = aggregatedStreaks[recordDef.key];
                                const isExpanded = expandedSections[recordDef.key];
                                
                                if (!recordData || recordData.entries.length === 0) {
                                    return (
                                        <React.Fragment key={recordDef.key}>
                                            <tr className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{recordDef.label}</span>
                                                </td>
                                                <td colSpan="4" className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                    <span className="text-gray-500 text-xs sm:text-sm italic">No data available</span>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                }
                                
                                return (
                                    <React.Fragment key={recordDef.key}>
                                        {recordData.entries.map((entry, entryIndex) => (
                                            <tr
                                                key={`${recordDef.key}-${entry.team}-${entry.startYear}-${entry.startWeek}-${entryIndex}`}
                                                className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                                            >
                                                <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                    {entryIndex === 0 ? (
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                                                {recordDef.label}
                                                            </span>
                                                            <button
                                                                onClick={() => toggleSection(recordDef.key)}
                                                                className="ml-2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                                                                aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${recordDef.label}`}
                                                            >
                                                                <svg
                                                                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-400 text-xs sm:text-sm">• Tied Record</div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                    {entryIndex === 0 ? (
                                                        <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200">
                                                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                                {entry.streak}
                                                            </span>
                                                            <span className="text-gray-600 text-xs ml-1">games</span>
                                                        </div>
                                                    ) : ''}
                                                </td>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <span className="font-medium text-gray-900 text-xs sm:text-sm">{entry.team}</span>
                                                </td>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                                                        <span>{entry.startYear}</span>
                                                        <span className="text-green-600">•</span>
                                                        <span>Week {entry.startWeek}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium">
                                                        <span>{entry.endYear}</span>
                                                        <span className="text-red-600">•</span>
                                                        <span>Week {entry.endWeek}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        
                                        {/* Collapsible Top 5 Section */}
                                        {isExpanded && allStreaksData[recordDef.key] && allStreaksData[recordDef.key].length > 0 && (
                                            <tr className={`${recordGroupIndex % 2 === 0 ? 'bg-gray-50' : 'bg-gray-75'}`}>
                                                <td colSpan="5" className="p-0">
                                                    <div className="px-3 py-4 sm:px-6 sm:py-6">
                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                            Top 5 {recordDef.label}s
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {allStreaksData[recordDef.key]
                                                                .filter(streak => streak.streak > 0)
                                                                .sort((a, b) => b.streak - a.streak)
                                                                .slice(0, 5)
                                                                .map((streak, index) => (
                                                                    <div key={`${streak.team}-${streak.streak}-${streak.startYear}-${streak.startWeek}-${index}`} 
                                                                         className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                                                                {index + 1}
                                                                            </span>
                                                                            <span className="font-medium text-gray-900 text-sm">{streak.team}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <span className="font-bold text-gray-900">{streak.streak} games</span>
                                                                            <div className="text-xs text-gray-500">
                                                                                {streak.startYear} Week {streak.startWeek} - {streak.endYear} Week {streak.endWeek}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StreaksRecords;
