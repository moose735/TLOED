// src/lib/StreaksRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

const StreaksRecords = ({ historicalMatchups }) => {
    const { historicalData, getTeamName, loading, error, nflState } = useSleeperData();
    const [aggregatedStreaks, setAggregatedStreaks] = useState({});
    const [allStreaksData, setAllStreaksData] = useState({});
    const [expandedSections, setExpandedSections] = useState({});

    const toggleSection = (recordKey) => {
        setExpandedSections(prev => ({ ...prev, [recordKey]: !prev[recordKey] }));
    };

    // ── All logic untouched ───────────────────────────────────────────────────
    useEffect(() => {
        if (loading || error || !historicalMatchups || historicalMatchups.length === 0) {
            setAggregatedStreaks({});
            return;
        }

        const allHistoricalMatchupsFlat = historicalMatchups;
        const teamGameLogs = {};
        const weeklyScoresAcrossLeague = {};

        allHistoricalMatchupsFlat.forEach(match => {
            if (!match || !match.matchup_id || !match.team1_roster_id || match.team1_score === undefined || !match.team2_roster_id || match.team2_score === undefined || match.season === undefined || match.week === undefined) {
                logger.warn("StreaksRecords: Skipping invalid or incomplete matchup. Missing data:", { matchup_id: match?.matchup_id, team1_roster_id: match?.team1_roster_id, team1_score: match?.team1_score, team2_roster_id: match?.team2_roster_id, team2_score: match?.team2_score, season: match?.season, week: match?.week, fullMatch: match });
                return;
            }
            const year = parseInt(match.season);
            const week = parseInt(match.week);
            const team1RosterId = String(match.team1_roster_id);
            const team2RosterId = String(match.team2_roster_id);
            const team1Score = parseFloat(match.team1_score);
            const team2Score = parseFloat(match.team2_score);
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) { logger.warn(`StreaksRecords: Skipping matchup due to invalid numerical data. Match:`, match); return; }
            const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
            const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId)?.owner_id;
            if (!team1OwnerId || !team2OwnerId) { logger.warn(`StreaksRecords: Skipping matchup due to missing owner ID for year ${year}. Team1Roster: ${team1RosterId}, Team2Roster: ${team2RosterId}`); return; }
            if (team1Score === 0 && team2Score === 0 && year >= new Date().getFullYear()) return;
            const isTie = team1Score === team2Score;
            if (!teamGameLogs[team1OwnerId]) teamGameLogs[team1OwnerId] = [];
            if (!teamGameLogs[team2OwnerId]) teamGameLogs[team2OwnerId] = [];
            teamGameLogs[team1OwnerId].push({ year, week, isWin: team1Score > team2Score, isLoss: team1Score < team2Score, isTie, score: team1Score, opponentScore: team2Score, rosterId: team1RosterId });
            teamGameLogs[team2OwnerId].push({ year, week, isWin: team2Score > team1Score, isLoss: team2Score < team1Score, isTie, score: team2Score, opponentScore: team1Score, rosterId: team2RosterId });
            if (!weeklyScoresAcrossLeague[year]) weeklyScoresAcrossLeague[year] = {};
            if (!weeklyScoresAcrossLeague[year][week]) weeklyScoresAcrossLeague[year][week] = [];
            weeklyScoresAcrossLeague[year][week].push({ rosterId: team1RosterId, score: team1Score });
            weeklyScoresAcrossLeague[year][week].push({ rosterId: team2RosterId, score: team2Score });
        });

        Object.keys(teamGameLogs).forEach(ownerId => {
            teamGameLogs[ownerId].sort((a, b) => { if (a.year !== b.year) return a.year - b.year; return a.week - b.week; });
        });

        const weeklyRankings = {};
        Object.keys(weeklyScoresAcrossLeague).forEach(year => {
            weeklyRankings[year] = {};
            Object.keys(weeklyScoresAcrossLeague[year]).forEach(week => {
                const scoresInWeek = weeklyScoresAcrossLeague[year][week];
                const sortedScores = [...scoresInWeek].sort((a, b) => b.score - a.score);
                weeklyRankings[year][week] = { highestScore: sortedScores.length > 0 ? sortedScores[0].score : -Infinity, lowestScore: sortedScores.length > 0 ? sortedScores[sortedScores.length - 1].score : Infinity, top3Scores: sortedScores.slice(0, Math.min(3, sortedScores.length)).map(s => s.score) };
            });
        });

        const newAggregatedStreaks = {
            longestWinStreak: { value: 0, entries: [] },
            longestLosingStreak: { value: 0, entries: [] },
            longestConsecutiveHighestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveLowestScoreWeeks: { value: 0, entries: [] },
            longestConsecutiveTop3Weeks: { value: 0, entries: [] },
        };
        const allStreaks = { longestWinStreak: [], longestLosingStreak: [], longestConsecutiveHighestScoreWeeks: [], longestConsecutiveLowestScoreWeeks: [], longestConsecutiveTop3Weeks: [] };

        const updateStreakRecord = (recordObj, newStreak, entryDetails, ownerId, getTeamNameFn) => {
            const teamName = getTeamNameFn(ownerId, entryDetails.startYear);
            const newEntry = { ...entryDetails, team: teamName, ownerId };
            if (newStreak > recordObj.value) { recordObj.value = newStreak; recordObj.entries = [newEntry]; }
            else if (newStreak === recordObj.value && newStreak > 0) {
                const isDuplicate = recordObj.entries.some(e => e.team === newEntry.team && e.startYear === newEntry.startYear && e.startWeek === newEntry.startWeek && e.endYear === newEntry.endYear && e.endWeek === newEntry.endWeek);
                if (!isDuplicate) recordObj.entries.push(newEntry);
            }
        };

        const addToAllStreaks = (category, streak, entryDetails, ownerId, getTeamNameFn) => {
            if (streak > 0) { const teamName = getTeamNameFn(ownerId, entryDetails.startYear); allStreaks[category].push({ ...entryDetails, team: teamName, ownerId, streak }); }
        };

        Object.keys(teamGameLogs).forEach(ownerId => {
            const games = teamGameLogs[ownerId];
            let currentWinStreak = 0, currentLossStreak = 0;
            let winStreakStartYear = null, winStreakStartWeek = null, lossStreakStartYear = null, lossStreakStartWeek = null;
            for (let i = 0; i < games.length; i++) {
                const game = games[i];
                if (game.isWin) {
                    if (currentWinStreak === 0) { winStreakStartYear = game.year; winStreakStartWeek = game.week; }
                    currentWinStreak++;
                    if (currentLossStreak > 0) { const d = { streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lossStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lossStreakStartWeek }; updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, d, ownerId, getTeamName); addToAllStreaks('longestLosingStreak', currentLossStreak, d, ownerId, getTeamName); }
                    currentLossStreak = 0; lossStreakStartYear = null; lossStreakStartWeek = null;
                } else if (game.isLoss) {
                    if (currentLossStreak === 0) { lossStreakStartYear = game.year; lossStreakStartWeek = game.week; }
                    currentLossStreak++;
                    if (currentWinStreak > 0) { const d = { streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[i-1] ? games[i-1].year : winStreakStartYear, endWeek: games[i-1] ? games[i-1].week : winStreakStartWeek }; updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, d, ownerId, getTeamName); addToAllStreaks('longestWinStreak', currentWinStreak, d, ownerId, getTeamName); }
                    currentWinStreak = 0; winStreakStartYear = null; winStreakStartWeek = null;
                } else if (game.isTie) {
                    if (currentWinStreak > 0) updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[i-1] ? games[i-1].year : winStreakStartYear, endWeek: games[i-1] ? games[i-1].week : winStreakStartYear }, ownerId, getTeamName);
                    currentWinStreak = 0; winStreakStartYear = null; winStreakStartWeek = null;
                    if (currentLossStreak > 0) updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lossStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lossStreakStartYear }, ownerId, getTeamName);
                    currentLossStreak = 0; lossStreakStartYear = null; lossStreakStartWeek = null;
                }
            }
            if (currentWinStreak > 0) updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }, ownerId, getTeamName);
            if (currentLossStreak > 0) updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }, ownerId, getTeamName);

            let currentHighestScoreStreak = 0, currentLowestScoreStreak = 0, currentTop3Streak = 0;
            let highestScoreStreakStartYear = null, highestScoreStreakStartWeek = null;
            let lowestScoreStreakStartYear = null, lowestScoreStreakStartWeek = null;
            let top3StreakStartYear = null, top3StreakStartWeek = null;
            let highestPrevYear = null, highestPrevWeek = null, lowestPrevYear = null, lowestPrevWeek = null, top3PrevYear = null, top3PrevWeek = null;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];
                const scoresInWeek = weeklyScoresAcrossLeague[game.year]?.[game.week];
                const teamScoreInWeek = scoresInWeek?.find(s => s.rosterId === game.rosterId)?.score;
                if (teamScoreInWeek === undefined || teamScoreInWeek === null) {
                    if (currentHighestScoreStreak > 0) updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName);
                    currentHighestScoreStreak = 0; highestScoreStreakStartYear = null; highestScoreStreakStartWeek = null;
                    if (currentLowestScoreStreak > 0) updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName);
                    currentLowestScoreStreak = 0; lowestScoreStreakStartYear = null; lowestScoreStreakStartWeek = null;
                    if (currentTop3Streak > 0) updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName);
                    currentTop3Streak = 0; top3StreakStartYear = null; top3StreakStartWeek = null;
                    continue;
                }
                const weekRanking = weeklyRankings[game.year]?.[game.week];
                const currentYear = new Date().getFullYear();
                const currentWeek = nflState?.week || 1;
                const isCurrentIncompleteWeek = game.year === currentYear && game.week === currentWeek;

                if (!isCurrentIncompleteWeek && teamScoreInWeek === weekRanking.highestScore) {
                    if (currentHighestScoreStreak === 0) { highestScoreStreakStartYear = game.year; highestScoreStreakStartWeek = game.week; currentHighestScoreStreak = 1; }
                    else if (game.year === highestPrevYear && game.week === highestPrevWeek + 1) { currentHighestScoreStreak++; }
                    else { updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); highestScoreStreakStartYear = game.year; highestScoreStreakStartWeek = game.week; currentHighestScoreStreak = 1; }
                    highestPrevYear = game.year; highestPrevWeek = game.week;
                } else {
                    if (currentHighestScoreStreak > 0) { updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartYear }, ownerId, getTeamName); }
                    currentHighestScoreStreak = 0; highestScoreStreakStartYear = null; highestScoreStreakStartWeek = null; highestPrevYear = null; highestPrevWeek = null;
                }

                if (!isCurrentIncompleteWeek && teamScoreInWeek === weekRanking.lowestScore) {
                    if (currentLowestScoreStreak === 0) { lowestScoreStreakStartYear = game.year; lowestScoreStreakStartWeek = game.week; currentLowestScoreStreak = 1; }
                    else if (game.year === lowestPrevYear && game.week === lowestPrevWeek + 1) { currentLowestScoreStreak++; }
                    else { updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); lowestScoreStreakStartYear = game.year; lowestScoreStreakStartWeek = game.week; currentLowestScoreStreak = 1; }
                    lowestPrevYear = game.year; lowestPrevWeek = game.week;
                } else {
                    if (currentLowestScoreStreak > 0) { updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartYear }, ownerId, getTeamName); }
                    currentLowestScoreStreak = 0; lowestScoreStreakStartYear = null; lowestScoreStreakStartWeek = null; lowestPrevYear = null; lowestPrevWeek = null;
                }

                if (!isCurrentIncompleteWeek && weekRanking.top3Scores.includes(teamScoreInWeek)) {
                    if (currentTop3Streak === 0) { top3StreakStartYear = game.year; top3StreakStartWeek = game.week; currentTop3Streak = 1; }
                    else if (game.year === top3PrevYear && game.week === top3PrevWeek + 1) { currentTop3Streak++; }
                    else { updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); top3StreakStartYear = game.year; top3StreakStartWeek = game.week; currentTop3Streak = 1; }
                    top3PrevYear = game.year; top3PrevWeek = game.week;
                } else {
                    if (currentTop3Streak > 0) { updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartYear }, ownerId, getTeamName); }
                    currentTop3Streak = 0; top3StreakStartYear = null; top3StreakStartWeek = null; top3PrevYear = null; top3PrevWeek = null;
                }
            }
            if (currentHighestScoreStreak > 0) { const d = { streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }; updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, d, ownerId, getTeamName); addToAllStreaks('longestConsecutiveHighestScoreWeeks', currentHighestScoreStreak, d, ownerId, getTeamName); }
            if (currentLowestScoreStreak > 0) { const d = { streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }; updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, d, ownerId, getTeamName); addToAllStreaks('longestConsecutiveLowestScoreWeeks', currentLowestScoreStreak, d, ownerId, getTeamName); }
            if (currentTop3Streak > 0) { const d = { streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week }; updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, d, ownerId, getTeamName); addToAllStreaks('longestConsecutiveTop3Weeks', currentTop3Streak, d, ownerId, getTeamName); }
        });

        Object.keys(newAggregatedStreaks).forEach(key => {
            const record = newAggregatedStreaks[key];
            if (record.value === 0 && record.entries.length === 0) record.entries = [];
            record.entries.sort((a, b) => { const tc = (a.team || '').localeCompare(b.team || ''); if (tc !== 0) return tc; if (a.startYear !== b.startYear) return a.startYear - b.startYear; return a.startWeek - b.startWeek; });
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

    // ── Loading / error / empty ───────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading streak records…</p>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400">Error loading streak data: {error.message}</p>
            </div>
        );
    }
    if (Object.keys(aggregatedStreaks).length === 0 || recordsToDisplay.every(r => aggregatedStreaks[r.key]?.entries.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">🔥</div>
                <p className="text-sm text-gray-500">No streak data available to display.</p>
            </div>
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const rankBadgeClass = (idx) => {
        if (idx === 0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        if (idx === 1) return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
        if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
        return 'bg-white/5 text-gray-500 border-white/10';
    };

    const streakRange = (entry) => {
        if (entry.endYear && entry.endWeek && (entry.startYear !== entry.endYear || entry.startWeek !== entry.endWeek))
            return `${entry.startYear} W${entry.startWeek} – ${entry.endYear} W${entry.endWeek}`;
        return `${entry.startYear} W${entry.startWeek}`;
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-1">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Streak Records</span>
            </div>

            {/* ── Mobile: stacked cards ── */}
            <div className="sm:hidden space-y-1.5 pt-2">
                {recordsToDisplay.map((recordDef) => {
                    const recordData = aggregatedStreaks[recordDef.key];
                    const isExpanded = !!expandedSections[recordDef.key];
                    const hasTop5 = allStreaksData[recordDef.key]?.length > 0;

                    if (!recordData || recordData.entries.length === 0) {
                        return (
                            <div key={recordDef.key} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
                                <div className="text-xs font-semibold text-gray-500">{recordDef.label}</div>
                                <div className="text-[10px] text-gray-600 mt-0.5">No data</div>
                            </div>
                        );
                    }

                    const primary = recordData.entries[0];

                    return (
                        <div key={recordDef.key} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                            <div className="flex items-start gap-3 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-300 leading-tight">{recordDef.label}</div>
                                    <div className="mt-1 space-y-0.5">
                                        {recordData.entries.map((holder, idx) => (
                                            <div key={idx}>
                                                <span className="text-[10px] text-gray-400 font-medium">{holder.team}</span>
                                                {holder.startYear !== undefined && (
                                                    <span className="text-[10px] text-gray-600 ml-1">· {streakRange(holder)}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                                    <div className="px-2.5 py-1 bg-purple-500/15 border border-purple-500/25 rounded-lg">
                                        <span className="text-xs font-bold text-purple-300 tabular-nums whitespace-nowrap">
                                            {primary.streak} <span className="font-normal opacity-70">games</span>
                                        </span>
                                    </div>
                                    {hasTop5 && (
                                        <button
                                            onClick={() => toggleSection(recordDef.key)}
                                            className="p-1 rounded-md text-gray-600 hover:text-gray-300 transition-colors"
                                            aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5`}
                                        >
                                            <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Top-5 mobile panel */}
                            {isExpanded && hasTop5 && (
                                <div className="border-t border-white/8 px-3 py-3 bg-black/20 space-y-1.5">
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5</div>
                                    {allStreaksData[recordDef.key]
                                        .filter(s => s.streak > 0)
                                        .sort((a, b) => b.streak - a.streak)
                                        .slice(0, 5)
                                        .map((streak, idx) => (
                                            <div key={`${recordDef.key}-m5-${streak.team}-${streak.streak}-${idx}`} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <span className="text-xs text-gray-300 truncate block">{streak.team}</span>
                                                        <span className="text-[10px] text-gray-600">{streakRange(streak)}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-semibold text-gray-400 tabular-nums flex-shrink-0">{streak.streak}g</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden sm:block pt-2">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Record</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[14%]">Length</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Team</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[21%]">Started</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[21%]">Ended</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {recordsToDisplay.map((recordDef, ri) => {
                            const recordData = aggregatedStreaks[recordDef.key];
                            const isExpanded = !!expandedSections[recordDef.key];
                            const hasTop5 = allStreaksData[recordDef.key]?.length > 0;

                            if (!recordData || recordData.entries.length === 0) {
                                return (
                                    <tr key={recordDef.key} className={ri % 2 === 0 ? '' : 'bg-white/[0.015]'}>
                                        <td className="py-2.5 px-3 font-semibold text-gray-500">{recordDef.label}</td>
                                        <td colSpan={4} className="py-2.5 px-3 text-center text-gray-600 text-[10px] italic">No data available</td>
                                    </tr>
                                );
                            }

                            return (
                                <React.Fragment key={recordDef.key}>
                                    {recordData.entries.map((entry, ei) => (
                                        <tr key={`${recordDef.key}-${entry.team}-${entry.startYear}-${entry.startWeek}-${ei}`}
                                            className={`hover:bg-white/[0.025] transition-colors ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>

                                            {/* Record label */}
                                            <td className="py-2.5 px-3">
                                                {ei === 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-200">{recordDef.label}</span>
                                                        {hasTop5 && (
                                                            <button
                                                                onClick={() => toggleSection(recordDef.key)}
                                                                className="text-gray-600 hover:text-purple-400 transition-colors"
                                                                aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5`}
                                                            >
                                                                <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 pl-1">· Tied</span>
                                                )}
                                            </td>

                                            {/* Streak length */}
                                            <td className="py-2.5 px-3 text-center">
                                                {ei === 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 font-bold text-purple-300 tabular-nums">
                                                        {entry.streak}
                                                        <span className="text-[10px] font-normal opacity-70">games</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Team */}
                                            <td className="py-2.5 px-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/8 border border-white/10 text-gray-200 text-xs font-medium">
                                                    {entry.team}
                                                </span>
                                            </td>

                                            {/* Started */}
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium tabular-nums">
                                                    {entry.startYear} · W{entry.startWeek}
                                                </span>
                                            </td>

                                            {/* Ended */}
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium tabular-nums">
                                                    {entry.endYear} · W{entry.endWeek}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Top-5 expansion */}
                                    {isExpanded && hasTop5 && (
                                        <tr className="bg-black/20 border-b border-white/8">
                                            <td colSpan={5} className="px-4 py-3">
                                                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5 Rankings</div>
                                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                    {allStreaksData[recordDef.key]
                                                        .filter(s => s.streak > 0)
                                                        .sort((a, b) => b.streak - a.streak)
                                                        .slice(0, 5)
                                                        .map((streak, idx) => (
                                                            <div key={`${recordDef.key}-dt5-${streak.team}-${streak.streak}-${idx}`}
                                                                className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2">
                                                                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                                    {idx + 1}
                                                                </span>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-medium text-gray-200 truncate">{streak.team}</div>
                                                                    <div className="text-[10px] text-gray-500 tabular-nums">
                                                                        {streak.streak}g · {streakRange(streak)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
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
    );
};

export default StreaksRecords;