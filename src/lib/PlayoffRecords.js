// src/lib/PlayoffRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

const PlayoffRecords = ({ historicalMatchups }) => {
    const { historicalData, getTeamName, loading, error } = useSleeperData();
    const [aggregatedPlayoffRecords, setAggregatedPlayoffRecords] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [allPlayoffData, setAllPlayoffData] = useState({});

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ── All logic untouched ───────────────────────────────────────────────────
    useEffect(() => {
        if (loading || error || !historicalMatchups || historicalMatchups.length === 0 || !historicalData || !historicalData.rostersBySeason) {
            setAggregatedPlayoffRecords({});
            setAllPlayoffData({});
            return;
        }

        const tempAllPlayoffData = {
            mostPlayoffAppearances: [], mostPlayoffWins: [], mostPlayoffLosses: [],
            bestPlayoffWinPercentage: [], worstPlayoffWinPercentage: [],
            mostPlayoffPointsFor: [], mostPlayoffPointsAgainst: [],
            mostChampionships: [], mostFirstPlaceFinishes: [],
            mostSecondPlaceFinishes: [], mostThirdPlaceFinishes: []
        };

        const addToAllPlayoffData = (recordKey, value, teamInfo) => {
            if (typeof value === 'number' && !isNaN(value) && tempAllPlayoffData[recordKey])
                tempAllPlayoffData[recordKey].push({ ...teamInfo, value });
        };

        const teamPlayoffStats = {};

        historicalMatchups.forEach((match, index) => {
            const year = parseInt(match.year);
            const team1RosterId = String(match.team1_roster_id);
            const team2RosterId = String(match.team2_roster_id);
            const team1Score = parseFloat(match.team1Score);
            const team2Score = parseFloat(match.team2Score);
            const rosterForTeam1 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId);
            const team1OwnerId = rosterForTeam1?.owner_id;
            const rosterForTeam2 = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId);
            const team2OwnerId = rosterForTeam2?.owner_id;

            if (!team1OwnerId || !team2OwnerId || isNaN(year) || isNaN(team1Score) || isNaN(team2Score) || !match.playoffs) {
                logger.warn(`PlayoffRecords useEffect: Skipping match ${index} due to invalid data, not a playoff game, or missing owner IDs. Match:`, match, `Team1 Owner: ${team1OwnerId}, Team2 Owner: ${team2OwnerId}`);
                return;
            }

            [team1OwnerId, team2OwnerId].forEach(ownerId => {
                if (!teamPlayoffStats[ownerId])
                    teamPlayoffStats[ownerId] = { appearances: new Set(), wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, medals: { 1: 0, 2: 0, 3: 0 }, championships: 0 };
            });

            if (match.isWinnersBracket) {
                teamPlayoffStats[team1OwnerId].appearances.add(year);
                teamPlayoffStats[team2OwnerId].appearances.add(year);
                logger.debug(`PlayoffRecords: Counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Winners Bracket). Match:`, match);
            } else if (match.isLosersBracket) {
                logger.debug(`PlayoffRecords: NOT counting appearance for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) and Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) in ${year} (Losers Bracket). Match:`, match);
            }

            if (match.isWinnersBracket) {
                const isTie = team1Score === team2Score;
                const team1Won = team1Score > team2Score;
                if (isTie) { teamPlayoffStats[team1OwnerId].ties++; teamPlayoffStats[team2OwnerId].ties++; }
                else if (team1Won) { teamPlayoffStats[team1OwnerId].wins++; teamPlayoffStats[team2OwnerId].losses++; }
                else { teamPlayoffStats[team2OwnerId].wins++; teamPlayoffStats[team1OwnerId].losses++; }
                teamPlayoffStats[team1OwnerId].pointsFor += team1Score;
                teamPlayoffStats[team1OwnerId].pointsAgainst += team2Score;
                teamPlayoffStats[team2OwnerId].pointsFor += team2Score;
                teamPlayoffStats[team2OwnerId].pointsAgainst += team1Score;
                logger.debug(`PlayoffRecords: Processing winners bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}). Match:`, match);

                if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
                    let winnerOwnerId = '', loserOwnerId = '';
                    if (team1Won) { winnerOwnerId = team1OwnerId; loserOwnerId = team2OwnerId; }
                    else if (team2Score > team1Score) { winnerOwnerId = team2OwnerId; loserOwnerId = team1OwnerId; }
                    const finalPlacement = match.finalSeedingGame;
                    if (finalPlacement === 1) {
                        if (winnerOwnerId) { teamPlayoffStats[winnerOwnerId].medals[1]++; teamPlayoffStats[winnerOwnerId].championships++; if (loserOwnerId) teamPlayoffStats[loserOwnerId].medals[2]++; }
                    } else if (finalPlacement === 3) {
                        if (winnerOwnerId) teamPlayoffStats[winnerOwnerId].medals[3]++;
                    }
                }
            } else if (match.isLosersBracket) {
                logger.debug(`PlayoffRecords: Skipping losers bracket stats for Owner ${team1OwnerId} (${getTeamName(team1OwnerId, year)}) vs Owner ${team2OwnerId} (${getTeamName(team2OwnerId, year)}) (only counting appearance). Match:`, match);
            }
        });

        logger.debug("PlayoffRecords: Aggregated Playoff Stats Per Team:");
        Object.entries(teamPlayoffStats).forEach(([ownerId, stats]) => {
            const currentTeamName = getTeamName(ownerId, null);
            logger.debug(`  Team: ${currentTeamName} (Owner ID: ${ownerId})`);
            logger.debug(`    Playoff Appearances: ${stats.appearances.size} (Years: ${Array.from(stats.appearances).join(', ')})`);
            logger.debug(`    Wins: ${stats.wins}`);
            logger.debug(`    Losses: ${stats.losses}`);
            logger.debug(`    Ties: ${stats.ties}`);
            logger.debug(`    Points For: ${stats.pointsFor.toFixed(2)}`);
            logger.debug(`    Points Against: ${stats.pointsAgainst.toFixed(2)}`);
            logger.debug(`    Championships: ${stats.championships}`);
            logger.debug(`    2nd Place Finishes: ${stats.medals[2]}`);
            logger.debug(`    3rd Place Finishes: ${stats.medals[3]}`);
        });

        const newAggregatedRecords = {
            mostPlayoffAppearances: { value: 0, entries: [] },
            mostPlayoffWins: { value: 0, entries: [] },
            totalPlayoffPoints: { value: 0, entries: [] },
            mostPlayoffPointsAgainst: { value: 0, entries: [] },
            mostChampionships: { value: 0, entries: [] },
            most2ndPlaceFinishes: { value: 0, entries: [] },
            most3rdPlaceFinishes: { value: 0, entries: [] },
        };

        const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
            if (typeof newValue !== 'number' || isNaN(newValue)) return;
            if (isMin) {
                if (newValue < recordObj.value) { recordObj.value = newValue; recordObj.entries = [entryDetails]; }
                else if (newValue === recordObj.value) { if (!recordObj.entries.some(e => e.team === entryDetails.team)) recordObj.entries.push(entryDetails); }
            } else {
                if (newValue > recordObj.value) { recordObj.value = newValue; recordObj.entries = [entryDetails]; }
                else if (newValue === recordObj.value) { if (!recordObj.entries.some(e => e.team === entryDetails.team)) recordObj.entries.push(entryDetails); }
            }
        };

        Object.keys(teamPlayoffStats).forEach(ownerId => {
            const stats = teamPlayoffStats[ownerId];
            const currentTeamName = getTeamName(ownerId, null);
            const appearancesEntry = { team: currentTeamName, appearances: stats.appearances.size };
            const winsEntry = { team: currentTeamName, wins: stats.wins };
            const pointsEntry = { team: currentTeamName, points: stats.pointsFor };
            const pointsAgainstEntry = { team: currentTeamName, pointsAgainst: stats.pointsAgainst };
            const championshipsEntry = { team: currentTeamName, championships: stats.championships };
            const secondPlaceEntry = { team: currentTeamName, secondPlaces: stats.medals[2] };
            const thirdPlaceEntry = { team: currentTeamName, thirdPlaces: stats.medals[3] };
            updateRecord(newAggregatedRecords.mostPlayoffAppearances, stats.appearances.size, appearancesEntry);
            updateRecord(newAggregatedRecords.mostPlayoffWins, stats.wins, winsEntry);
            updateRecord(newAggregatedRecords.totalPlayoffPoints, stats.pointsFor, pointsEntry);
            updateRecord(newAggregatedRecords.mostPlayoffPointsAgainst, stats.pointsAgainst, pointsAgainstEntry);
            updateRecord(newAggregatedRecords.mostChampionships, stats.championships, championshipsEntry);
            updateRecord(newAggregatedRecords.most2ndPlaceFinishes, stats.medals[2], secondPlaceEntry);
            updateRecord(newAggregatedRecords.most3rdPlaceFinishes, stats.medals[3], thirdPlaceEntry);
            addToAllPlayoffData('mostPlayoffAppearances', stats.appearances.size, appearancesEntry);
            addToAllPlayoffData('mostPlayoffWins', stats.wins, winsEntry);
            addToAllPlayoffData('mostPlayoffPointsFor', stats.pointsFor, pointsEntry);
            addToAllPlayoffData('mostPlayoffPointsAgainst', stats.pointsAgainst, pointsAgainstEntry);
            addToAllPlayoffData('mostChampionships', stats.championships, championshipsEntry);
            addToAllPlayoffData('mostFirstPlaceFinishes', stats.championships, championshipsEntry);
            addToAllPlayoffData('mostSecondPlaceFinishes', stats.medals[2], secondPlaceEntry);
            addToAllPlayoffData('mostThirdPlaceFinishes', stats.medals[3], thirdPlaceEntry);
        });

        Object.keys(newAggregatedRecords).forEach(key => {
            const record = newAggregatedRecords[key];
            if ((record.value === -Infinity || record.value === Infinity) && record.entries.length === 0) { record.value = 0; record.entries = []; }
            else if (record.value === Infinity) record.value = 'N/A';
            if (record.entries.length > 1) {
                record.entries.sort((a, b) => {
                    const tc = (a.team || '').localeCompare(b.team || '');
                    if (tc !== 0) return tc;
                    let vA, vB;
                    if (key === 'mostPlayoffAppearances') { vA = a.appearances; vB = b.appearances; }
                    else if (key === 'mostPlayoffWins') { vA = a.wins; vB = b.wins; }
                    else if (key === 'totalPlayoffPoints') { vA = a.points; vB = b.points; }
                    else if (key === 'mostPlayoffPointsAgainst') { vA = a.pointsAgainst; vB = b.pointsAgainst; }
                    else if (key === 'mostChampionships') { vA = a.championships; vB = b.championships; }
                    else if (key === 'most2ndPlaceFinishes') { vA = a.secondPlaces; vB = b.secondPlaces; }
                    else if (key === 'most3rdPlaceFinishes') { vA = a.thirdPlaces; vB = b.thirdPlaces; }
                    else { vA = a.value; vB = b.value; }
                    return (typeof vA === 'number' && typeof vB === 'number') ? vB - vA : 0;
                });
            }
        });

        setAggregatedPlayoffRecords(newAggregatedRecords);
        setAllPlayoffData(tempAllPlayoffData);
    }, [historicalMatchups, historicalData, getTeamName, loading, error]);

    const formatDisplayValue = (value, recordKey) => {
        if (typeof value === 'number') {
            if (['mostPlayoffAppearances','mostPlayoffWins','mostChampionships','most2ndPlaceFinishes','most3rdPlaceFinishes'].includes(recordKey)) return value;
            if (['totalPlayoffPoints','mostPlayoffPointsAgainst'].includes(recordKey)) return value.toFixed(2);
            return value;
        }
        return value;
    };

    const recordsToDisplay = [
        { key: 'mostPlayoffAppearances',   label: 'Most Playoff Appearances' },
        { key: 'mostPlayoffWins',          label: 'Most Playoff Wins' },
        { key: 'totalPlayoffPoints',       label: 'Total Playoff Points For' },
        { key: 'mostPlayoffPointsAgainst', label: 'Most Playoff Points Against' },
        { key: 'mostChampionships',        label: 'Most Championships' },
        { key: 'most2ndPlaceFinishes',     label: 'Most 2nd Place Finishes' },
        { key: 'most3rdPlaceFinishes',     label: 'Most 3rd Place Finishes' },
    ];

    const KEY_MAP = {
        'totalPlayoffPoints': 'mostPlayoffPointsFor',
        'most2ndPlaceFinishes': 'mostSecondPlaceFinishes',
        'most3rdPlaceFinishes': 'mostThirdPlaceFinishes',
    };

    const rankBadgeClass = (idx) => {
        if (idx === 0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        if (idx === 1) return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
        if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
        return 'bg-white/5 text-gray-500 border-white/10';
    };

    const isEmpty = Object.keys(aggregatedPlayoffRecords).length === 0
        || recordsToDisplay.every(r => aggregatedPlayoffRecords[r.key]?.entries.length === 0);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-1">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 3l14 9-14 9V3z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All-Time Playoff Records</span>
            </div>

            {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-4xl mb-3">🏆</div>
                    <p className="text-sm text-gray-500">No playoff data available to display.</p>
                </div>
            ) : (
                <>
                    {/* ── Mobile: stacked cards ── */}
                    <div className="sm:hidden space-y-1.5 pt-2">
                        {recordsToDisplay.map((recordDef) => {
                            const recordData = aggregatedPlayoffRecords[recordDef.key];
                            const isExpanded = !!expandedSections[recordDef.key];
                            const dataKey = KEY_MAP[recordDef.key] || recordDef.key;
                            const hasTop5 = allPlayoffData[dataKey]?.some(d => d.value > 0);

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
                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-gray-300 leading-tight">{recordDef.label}</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                {recordData.entries.map(e => e.team).join(', ')}
                                                {recordData.entries.length > 1 && (
                                                    <span className="text-gray-600"> (tied)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 px-2.5 py-1 bg-red-500/15 border border-red-500/25 rounded-lg">
                                            <span className="text-xs font-bold text-red-300 tabular-nums whitespace-nowrap">
                                                {formatDisplayValue(recordData.value, recordDef.key)}
                                            </span>
                                        </div>
                                        {hasTop5 && (
                                            <button
                                                onClick={() => toggleSection(recordDef.key)}
                                                className="flex-shrink-0 p-1 rounded-md text-gray-600 hover:text-gray-300 transition-colors"
                                                aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5`}
                                            >
                                                <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {isExpanded && hasTop5 && (
                                        <div className="border-t border-white/8 px-3 py-3 bg-black/20 space-y-1.5">
                                            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5</div>
                                            {allPlayoffData[dataKey]
                                                .filter(d => d.value > 0)
                                                .sort((a, b) => b.value - a.value)
                                                .slice(0, 5)
                                                .map((item, idx) => (
                                                    <div key={`${recordDef.key}-m5-${idx}`} className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-xs text-gray-300 truncate">{item.team}</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-400 tabular-nums flex-shrink-0">
                                                            {formatDisplayValue(item.value, recordDef.key)}
                                                        </span>
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
                                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[36%]">Record</th>
                                    <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[18%]">Value</th>
                                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[46%]">Holder(s)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {recordsToDisplay.map((recordDef, ri) => {
                                    const recordData = aggregatedPlayoffRecords[recordDef.key];
                                    const isExpanded = !!expandedSections[recordDef.key];
                                    const dataKey = KEY_MAP[recordDef.key] || recordDef.key;
                                    const hasTop5 = allPlayoffData[dataKey]?.some(d => d.value > 0);

                                    if (!recordData || recordData.entries.length === 0) {
                                        return (
                                            <tr key={recordDef.key} className={ri % 2 === 0 ? '' : 'bg-white/[0.015]'}>
                                                <td className="py-2.5 px-3 font-semibold text-gray-500">{recordDef.label}</td>
                                                <td colSpan={2} className="py-2.5 px-3 text-center text-gray-600 text-[10px] italic">No data available</td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={recordDef.key}>
                                            <tr className={`hover:bg-white/[0.025] transition-colors ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>

                                                {/* Record label */}
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-200">{recordDef.label}</span>
                                                        {hasTop5 && (
                                                            <button
                                                                onClick={() => toggleSection(recordDef.key)}
                                                                className="text-gray-600 hover:text-red-400 transition-colors"
                                                                aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5`}
                                                            >
                                                                <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Value */}
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 font-bold text-red-300 tabular-nums">
                                                        {formatDisplayValue(recordData.value, recordDef.key)}
                                                    </span>
                                                </td>

                                                {/* Holder chips */}
                                                <td className="py-2.5 px-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {recordData.entries.map((entry, i) => (
                                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/8 border border-white/10 text-gray-200 text-xs font-medium">
                                                                {entry.team}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Top-5 expansion */}
                                            {isExpanded && hasTop5 && (
                                                <tr className="bg-black/20 border-b border-white/8">
                                                    <td colSpan={3} className="px-4 py-3">
                                                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5 Rankings</div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                            {allPlayoffData[dataKey]
                                                                .filter(d => d.value > 0)
                                                                .sort((a, b) => b.value - a.value)
                                                                .slice(0, 5)
                                                                .map((d, idx) => (
                                                                    <div key={`${recordDef.key}-dt5-${d.team}-${idx}`}
                                                                        className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2">
                                                                        <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                                                                            {idx + 1}
                                                                        </span>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="text-xs font-medium text-gray-200 truncate">{d.team}</div>
                                                                            <div className="text-[10px] text-gray-500 tabular-nums">
                                                                                {formatDisplayValue(d.value, recordDef.key)}
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
                </>
            )}
        </div>
    );
};

export default PlayoffRecords;