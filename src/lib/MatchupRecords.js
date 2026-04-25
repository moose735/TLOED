// src/lib/MatchupRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

const MatchupRecords = () => {
    const { historicalData, getTeamName, loading, error } = useSleeperData();
    const [aggregatedMatchupRecords, setAggregatedMatchupRecords] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [allMatchupData, setAllMatchupData] = useState({});

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ── All logic untouched ───────────────────────────────────────────────────
    function updateRecord(recordObj, newValue, entryDetails, isMin = false) {
        if (typeof newValue !== 'number' || isNaN(newValue)) return;
        if (isMin) {
            if (newValue < recordObj.value) { recordObj.value = newValue; recordObj.entries = [entryDetails]; }
            else if (newValue === recordObj.value) {
                const isDuplicate = recordObj.entries.some(e => e.year === entryDetails.year && e.week === entryDetails.week && e.team1RosterId === entryDetails.team1RosterId && e.team2RosterId === entryDetails.team2RosterId);
                if (!isDuplicate) recordObj.entries.push(entryDetails);
            }
        } else {
            if (newValue > recordObj.value) { recordObj.value = newValue; recordObj.entries = [entryDetails]; }
            else if (newValue === recordObj.value) {
                const isDuplicate = recordObj.entries.some(e => e.year === entryDetails.year && e.week === entryDetails.week && e.team1RosterId === entryDetails.team1RosterId && e.team2RosterId === entryDetails.team2RosterId);
                if (!isDuplicate) recordObj.entries.push(entryDetails);
            }
        }
    }

    useEffect(() => {
        if (loading || error || !historicalData || !historicalData.matchupsBySeason) {
            setAggregatedMatchupRecords({});
            setAllMatchupData({});
            return;
        }

        const tempAllMatchupData = {
            mostPointsScored: [], fewestPointsScored: [], mostPointsInLoss: [], fewestPointsInWin: [],
            highestCombinedScore: [], lowestCombinedScore: [], biggestBlowout: [], slimmestWin: []
        };

        const addToAllMatchupData = (recordKey, value, entryDetails) => {
            if (typeof value === 'number' && !isNaN(value) && tempAllMatchupData[recordKey])
                tempAllMatchupData[recordKey].push({ ...entryDetails, value });
        };

        const currentYear = new Date().getFullYear().toString();
        const allHistoricalMatchupsFlat = [];
        for (const year in historicalData.matchupsBySeason) {
            const yearMatchupsArray = historicalData.matchupsBySeason[year];
            if (Array.isArray(yearMatchupsArray)) allHistoricalMatchupsFlat.push(...yearMatchupsArray);
        }
        if (allHistoricalMatchupsFlat.length === 0) { setAggregatedMatchupRecords({}); return; }

        const newAggregatedRecords = {
            mostPointsScored: { value: -Infinity, entries: [] },
            fewestPointsScored: { value: Infinity, entries: [] },
            mostPointsInLoss: { value: -Infinity, entries: [] },
            fewestPointsInWin: { value: Infinity, entries: [] },
            highestCombinedScore: { value: -Infinity, entries: [] },
            lowestCombinedScore: { value: Infinity, entries: [] },
            biggestBlowout: { value: -Infinity, entries: [] },
            slimmestWin: { value: Infinity, entries: [] },
        };

        allHistoricalMatchupsFlat.forEach(match => {
            const year = parseInt(match.season);
            const week = parseInt(match.week);
            const team1RosterId = String(match.team1_roster_id);
            const team2RosterId = String(match.team2_roster_id);
            const team1Score = parseFloat(match.team1_score);
            const team2Score = parseFloat(match.team2_score);
            const rosterForTeam1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId);
            const team1OwnerId = rosterForTeam1?.owner_id;
            const rosterForTeam2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId);
            const team2OwnerId = rosterForTeam2?.owner_id;
            const team1Name = getTeamName(team1OwnerId, year);
            const team2Name = getTeamName(team2OwnerId, year);
            let skipReason = [];
            if (!team1OwnerId) skipReason.push(`Missing team1OwnerId for roster ${team1RosterId} in year ${year}`);
            if (!team2OwnerId) skipReason.push(`Missing team2OwnerId for roster ${team2RosterId} in year ${year}`);
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) skipReason.push(`Invalid data point (year: ${year}, week: ${week}, scores: ${team1Score}, ${team2Score})`);
            if (skipReason.length > 0) { logger.warn('MatchupRecords: Skipping matchup due to:', skipReason.join('; '), '. Match:', match); return; }

            const combinedScore = team1Score + team2Score;
            const scoreDifference = Math.abs(team1Score - team2Score);
            const isTie = team1Score === team2Score && team1Score > 0;
            let winnerName = '', loserName = '';
            if (!isTie) { winnerName = team1Score > team2Score ? team1Name : team2Name; loserName = team1Score > team2Score ? team2Name : team1Name; }

            const baseEntryDetails = { matchup: `${team1Name} vs ${team2Name}`, year, week, team1: team1Name, team2: team2Name, team1Score, team2Score, team1RosterId, team2RosterId };
            const team1Details = { ...baseEntryDetails, team: team1Name, score: team1Score };
            const team2Details = { ...baseEntryDetails, team: team2Name, score: team2Score };
            updateRecord(newAggregatedRecords.mostPointsScored, team1Score, team1Details);
            updateRecord(newAggregatedRecords.mostPointsScored, team2Score, team2Details);
            addToAllMatchupData('mostPointsScored', team1Score, team1Details);
            addToAllMatchupData('mostPointsScored', team2Score, team2Details);
            if (team1Score > 0) { updateRecord(newAggregatedRecords.fewestPointsScored, team1Score, team1Details, true); addToAllMatchupData('fewestPointsScored', team1Score, team1Details); }
            if (team2Score > 0) { updateRecord(newAggregatedRecords.fewestPointsScored, team2Score, team2Details, true); addToAllMatchupData('fewestPointsScored', team2Score, team2Details); }
            if (!isTie) {
                const loserIsTeam1 = team1Score < team2Score;
                const losingTeam = loserIsTeam1 ? team1Name : team2Name;
                const losingScore = loserIsTeam1 ? team1Score : team2Score;
                const winningTeam = loserIsTeam1 ? team2Name : team1Name;
                const winningScore = loserIsTeam1 ? team2Score : team1Score;
                const lossDetails = { ...baseEntryDetails, team: losingTeam, score: losingScore, opponent: winningTeam, opponentScore: winningScore };
                updateRecord(newAggregatedRecords.mostPointsInLoss, losingScore, lossDetails);
                addToAllMatchupData('mostPointsInLoss', losingScore, lossDetails);
                const winnerIsTeam1 = team1Score > team2Score;
                const wTeam = winnerIsTeam1 ? team1Name : team2Name;
                const wScore = winnerIsTeam1 ? team1Score : team2Score;
                const lTeam = winnerIsTeam1 ? team2Name : team1Name;
                const lScore = winnerIsTeam1 ? team2Score : team1Score;
                if (wScore > 0) { const winDetails = { ...baseEntryDetails, team: wTeam, score: wScore, opponent: lTeam, opponentScore: lScore }; updateRecord(newAggregatedRecords.fewestPointsInWin, wScore, winDetails, true); addToAllMatchupData('fewestPointsInWin', wScore, winDetails); }
            }
            const combinedDetails = { ...baseEntryDetails, combinedScore };
            updateRecord(newAggregatedRecords.highestCombinedScore, combinedScore, combinedDetails);
            addToAllMatchupData('highestCombinedScore', combinedScore, combinedDetails);
            if (combinedScore > 0 && team1Score > 0 && team2Score > 0) { updateRecord(newAggregatedRecords.lowestCombinedScore, combinedScore, combinedDetails, true); addToAllMatchupData('lowestCombinedScore', combinedScore, combinedDetails); }
            if (!isTie) {
                const blowoutDetails = { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName };
                updateRecord(newAggregatedRecords.biggestBlowout, scoreDifference, blowoutDetails);
                addToAllMatchupData('biggestBlowout', scoreDifference, blowoutDetails);
                const slimDetails = { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName };
                updateRecord(newAggregatedRecords.slimmestWin, scoreDifference, slimDetails, true);
                addToAllMatchupData('slimmestWin', scoreDifference, slimDetails);
            }
        });

        Object.keys(newAggregatedRecords).forEach(key => {
            const record = newAggregatedRecords[key];
            if (record.value === -Infinity || record.value === Infinity) { record.value = 0; record.entries = []; }
            record.entries.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                if (a.week !== b.week) return a.week - b.week;
                if (a.team && b.team && ['mostPointsScored','fewestPointsScored','mostPointsInLoss','fewestPointsInWin'].includes(key)) return a.team.localeCompare(b.team);
                if (a.team1 && b.team1 && ['highestCombinedScore','lowestCombinedScore'].includes(key)) return a.team1.localeCompare(b.team1);
                if (a.winner && b.winner && ['biggestBlowout','slimmestWin'].includes(key)) return a.winner.localeCompare(b.winner);
                return 0;
            });
        });

        setAggregatedMatchupRecords(newAggregatedRecords);
        setAllMatchupData(tempAllMatchupData);
    }, [historicalData, getTeamName, loading, error]);

    const formatDisplayValue = (value) =>
        value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const recordsToDisplay = [
        { key: 'mostPointsScored',    label: 'Most Points Scored by a Team' },
        { key: 'mostPointsInLoss',    label: 'Most Points Scored in a Loss' },
        { key: 'fewestPointsScored',  label: 'Fewest Points Scored by a Team' },
        { key: 'fewestPointsInWin',   label: 'Fewest Points Scored in a Win' },
        { key: 'highestCombinedScore',label: 'Highest Combined Score' },
        { key: 'lowestCombinedScore', label: 'Lowest Combined Score' },
        { key: 'biggestBlowout',      label: 'Biggest Blowout' },
        { key: 'slimmestWin',         label: 'Slimmest Win' },
    ];

    const MIN_RECORDS = new Set(['fewestPointsScored','fewestPointsInWin','lowestCombinedScore','slimmestWin']);

    // ── Loading / error / empty ───────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading game records…</p>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400">Error loading matchup data: {error.message}</p>
            </div>
        );
    }
    if (Object.keys(aggregatedMatchupRecords).length === 0 || recordsToDisplay.every(r => aggregatedMatchupRecords[r.key]?.entries.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">⚔️</div>
                <p className="text-sm text-gray-500">No matchup data available to display records.</p>
            </div>
        );
    }

    // ── Shared helpers ────────────────────────────────────────────────────────
    const rankBadgeClass = (idx) => {
        if (idx === 0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        if (idx === 1) return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
        if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
        return 'bg-white/5 text-gray-500 border-white/10';
    };

    // Compact score row used in both mobile and desktop matchup detail cells
    const ScoreRow = ({ name, score, highlight }) => (
        <div className="flex items-center justify-between gap-2">
            <span className={`text-xs truncate ${highlight ? 'font-semibold text-gray-100' : 'text-gray-400'}`}>{name}</span>
            <span className={`text-xs tabular-nums font-bold flex-shrink-0 ${highlight ? 'text-blue-300' : 'text-gray-500'}`}>{score}</span>
        </div>
    );

    // Build the matchup detail cell for a given entry + record key
    const MatchupDetail = ({ entry, recordKey }) => {
        const t1 = entry.team1Score?.toFixed(2) ?? '—';
        const t2 = entry.team2Score?.toFixed(2) ?? '—';
        const wScore = (entry.winner === entry.team1 ? entry.team1Score : entry.team2Score)?.toFixed(2) ?? '—';
        const lScore = (entry.loser === entry.team1 ? entry.team1Score : entry.team2Score)?.toFixed(2) ?? '—';

        if (['mostPointsScored','fewestPointsScored','mostPointsInLoss','fewestPointsInWin'].includes(recordKey)) {
            const holder = entry.team;
            const holderScore = entry.score?.toFixed(2) ?? '—';
            const opp = holder === entry.team1 ? entry.team2 : entry.team1;
            const oppScore = (holder === entry.team1 ? entry.team2Score : entry.team1Score)?.toFixed(2) ?? '—';
            return (
                <div className="bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2 space-y-1">
                    <ScoreRow name={holder} score={holderScore} highlight />
                    <ScoreRow name={opp} score={oppScore} />
                </div>
            );
        }
        if (['biggestBlowout','slimmestWin'].includes(recordKey)) {
            return (
                <div className="bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2 space-y-1">
                    <ScoreRow name={entry.winner} score={wScore} highlight />
                    <ScoreRow name={entry.loser} score={lScore} />
                </div>
            );
        }
        // Combined score records — show higher scorer first
        const team1Top = entry.team1Score >= entry.team2Score;
        return (
            <div className="bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2 space-y-1">
                <ScoreRow name={team1Top ? entry.team1 : entry.team2} score={team1Top ? t1 : t2} highlight />
                <ScoreRow name={team1Top ? entry.team2 : entry.team1} score={team1Top ? t2 : t1} />
            </div>
        );
    };

    // Top-5 display text helper
    const top5Text = (key, d) => {
        if (key === 'mostPointsScored' || key === 'fewestPointsScored') return d.team;
        if (key === 'mostPointsInLoss' || key === 'fewestPointsInWin') return d.opponent ? `${d.team} vs ${d.opponent}` : d.team;
        if (key === 'biggestBlowout' || key === 'slimmestWin') return `${d.winner} def ${d.loser}`;
        return `${d.team1} vs ${d.team2}`;
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-1">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Single-Game Records</span>
            </div>

            {/* ── Mobile: stacked cards ── */}
            <div className="sm:hidden space-y-1.5 pt-2">
                {recordsToDisplay.map((recordDef) => {
                    const recordData = aggregatedMatchupRecords[recordDef.key];
                    const isExpanded = !!expandedSections[recordDef.key];
                    const hasTop5 = allMatchupData[recordDef.key]?.length > 0;

                    if (!recordData || recordData.entries.length === 0) {
                        return (
                            <div key={recordDef.key} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
                                <div className="text-xs font-semibold text-gray-500">{recordDef.label}</div>
                                <div className="text-[10px] text-gray-600 mt-0.5">No data</div>
                            </div>
                        );
                    }

                    return (
                        <div key={recordDef.key} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                            <div className="flex items-start gap-3 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-300 leading-tight mb-1.5">{recordDef.label}</div>
                                    <div className="space-y-1.5">
                                        {recordData.entries.map((holder, idx) => (
                                            <div key={idx} className={idx > 0 ? 'pt-1.5 border-t border-white/5' : ''}>
                                                <MatchupDetail entry={holder} recordKey={recordDef.key} />
                                                <div className="text-[10px] text-gray-600 mt-1 pl-0.5">{holder.year} · W{holder.week}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mt-0.5">
                                    <div className="px-2.5 py-1 bg-orange-500/15 border border-orange-500/25 rounded-lg">
                                        <span className="text-xs font-bold text-orange-300 tabular-nums whitespace-nowrap">
                                            {formatDisplayValue(recordData.value)}
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
                                    {[...allMatchupData[recordDef.key]]
                                        .sort((a, b) => MIN_RECORDS.has(recordDef.key) ? a.value - b.value : b.value - a.value)
                                        .slice(0, 5)
                                        .map((d, idx) => (
                                            <div key={`${recordDef.key}-m5-${d.year}-${d.week}-${idx}`} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <span className="text-xs text-gray-300 truncate block">{top5Text(recordDef.key, d)}</span>
                                                        <span className="text-[10px] text-gray-600">{d.year} W{d.week}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-semibold text-gray-400 tabular-nums flex-shrink-0">{d.value.toFixed(2)}</span>
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
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[14%]">Value</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[36%]">Game</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[14%]">Season</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[14%]">Week</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {recordsToDisplay.map((recordDef, ri) => {
                            const recordData = aggregatedMatchupRecords[recordDef.key];
                            const isExpanded = !!expandedSections[recordDef.key];
                            const hasTop5 = allMatchupData[recordDef.key]?.length > 0;

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
                                        <tr key={`${recordDef.key}-${ei}`}
                                            className={`hover:bg-white/[0.025] transition-colors ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>

                                            {/* Record name */}
                                            <td className="py-2.5 px-3 align-top">
                                                {ei === 0 ? (
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <span className="font-semibold text-gray-200">{recordDef.label}</span>
                                                        {hasTop5 && (
                                                            <button
                                                                onClick={() => toggleSection(recordDef.key)}
                                                                className="text-gray-600 hover:text-orange-400 transition-colors"
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

                                            {/* Value */}
                                            <td className="py-2.5 px-3 text-center align-top">
                                                {ei === 0 && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/25 font-bold text-orange-300 tabular-nums">
                                                        {formatDisplayValue(recordData.value)}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Game detail */}
                                            <td className="py-2 px-3">
                                                <MatchupDetail entry={entry} recordKey={recordDef.key} />
                                            </td>

                                            {/* Season */}
                                            <td className="py-2.5 px-3 text-center align-top">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium tabular-nums">
                                                    {entry.year}
                                                </span>
                                            </td>

                                            {/* Week */}
                                            <td className="py-2.5 px-3 text-center align-top">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-medium tabular-nums">
                                                    W{entry.week}
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
                                                    {[...allMatchupData[recordDef.key]]
                                                        .sort((a, b) => MIN_RECORDS.has(recordDef.key) ? a.value - b.value : b.value - a.value)
                                                        .slice(0, 5)
                                                        .map((d, idx) => (
                                                            <div key={`${recordDef.key}-dt5-${d.year}-${d.week}-${idx}`}
                                                                className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2">
                                                                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                                    {idx + 1}
                                                                </span>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-medium text-gray-200 truncate">{top5Text(recordDef.key, d)}</div>
                                                                    <div className="text-[10px] text-gray-500 tabular-nums">
                                                                        {d.value.toFixed(2)} · {d.year} W{d.week}
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

export default MatchupRecords;