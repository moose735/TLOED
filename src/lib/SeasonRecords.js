// src/lib/SeasonRecords.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { formatNumber } from '../utils/formatUtils';

/**
 * Displays seasonal league records, including per-season standings and overall seasonal highlights.
 */
const SeasonRecords = () => {
    const { processedSeasonalRecords, getTeamName, loading, error } = useSleeperData();

    // State to hold the "seasonal highlights"
    const [seasonalHighlights, setSeasonalHighlights] = useState(() => ({
        mostWinsSeason: { value: -Infinity, entries: [], key: 'wins' },
        mostLossesSeason: { value: -Infinity, entries: [], key: 'losses' },
        bestWinPctSeason: { value: -Infinity, entries: [], key: 'winPercentage' },
        bestAllPlayWinPctSeason: { value: -Infinity, entries: [], key: 'allPlayWinPercentage' },
        mostWeeklyHighScoresSeason: { value: -Infinity, entries: [], key: 'topScoreWeeksCount' },
        mostWeeklyTop2ScoresSeason: { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' },
        mostBlowoutWinsSeason: { value: -Infinity, entries: [], key: 'blowoutWins' },
        mostBlowoutLossesSeason: { value: -Infinity, entries: [], key: 'blowoutLosses' },
        mostSlimWinsSeason: { value: -Infinity, entries: [], key: 'slimWins' },
        mostSlimLossesSeason: { value: -Infinity, entries: [], key: 'slimLosses' },
        mostPointsSeason: { value: -Infinity, entries: [], key: 'pointsFor' },
        fewestPointsSeason: { value: Infinity, entries: [], key: 'pointsFor' },
        bestLuckRatingSeason: { value: -Infinity, entries: [], key: 'luckRating' },
        worstLuckRatingSeason: { value: Infinity, entries: [], key: 'luckRating' },
        highestDPRSeason: { value: -Infinity, entries: [], key: 'highestDPR' },
        lowestDPRSeason: { value: Infinity, entries: [], key: 'lowestDPR' },
    }));

    // Configuration for number formatting per stat (similar to LeagueRecords)
    const formatConfig = {
        adjustedDPR: { decimals: 3, type: 'decimal' },
        wins: { decimals: 0, type: 'count' },
        losses: { decimals: 0, type: 'count' },
        ties: { decimals: 0, type: 'count' },
        pointsFor: { decimals: 2, type: 'points' },
        pointsAgainst: { decimals: 2, type: 'points' },
        averageScore: { decimals: 2, type: 'points' },
        winPercentage: { decimals: 3, type: 'percentage' },
        allPlayWinPercentage: { decimals: 3, type: 'percentage' },
        topScoreWeeksCount: { decimals: 0, type: 'count' },
        blowoutWins: { decimals: 0, type: 'count' },
        blowoutLosses: { decimals: 0, type: 'count' },
        slimWins: { decimals: 0, type: 'count' },
        slimLosses: { decimals: 0, type: 'count' },
        weeklyTop2ScoresCount: { decimals: 0, type: 'count' },
        luckRating: { decimals: 2, type: 'decimal' },
    };

    // Helper function to create a clean label from a record key
    const getRecordLabel = (recordKey, recordInstance) => {
        if (recordKey === 'luckRating') {
            return recordInstance.value > 0 ? 'Best Luck Rating' : 'Worst Luck Rating';
        }
        if (recordKey === 'pointsFor') {
            return recordInstance.value > 0 ? 'Most Points For' : 'Fewest Points For';
        }
        if (recordKey === 'highestDPR') {
            return 'Highest Season DPR';
        }
        if (recordKey === 'lowestDPR') {
            return 'Lowest Season DPR';
        }
        const cleanedKey = recordKey
            .replace(/Season$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
        return cleanedKey.charAt(0).toUpperCase() + cleanedKey.slice(1);
    };

    useEffect(() => {
        if (loading || error || !processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
            setSeasonalHighlights({
                highestDPRSeason: { value: -Infinity, entries: [], key: 'highestDPR' },
                lowestDPRSeason: { value: Infinity, entries: [], key: 'lowestDPR' },
                mostWinsSeason: { value: -Infinity, entries: [], key: 'wins' },
                mostLossesSeason: { value: -Infinity, entries: [], key: 'losses' },
                bestWinPctSeason: { value: -Infinity, entries: [], key: 'winPercentage' },
                bestAllPlayWinPctSeason: { value: -Infinity, entries: [], key: 'allPlayWinPercentage' },
                mostWeeklyHighScoresSeason: { value: -Infinity, entries: [], key: 'topScoreWeeksCount' },
                mostWeeklyTop2ScoresSeason: { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' },
                mostBlowoutWinsSeason: { value: -Infinity, entries: [], key: 'blowoutWins' },
                mostBlowoutLossesSeason: { value: -Infinity, entries: [], key: 'blowoutLosses' },
                mostSlimWinsSeason: { value: -Infinity, entries: [], key: 'slimWins' },
                mostSlimLossesSeason: { value: -Infinity, entries: [], key: 'slimLosses' },
                mostPointsSeason: { value: -Infinity, entries: [], key: 'pointsFor' },
                fewestPointsSeason: { value: Infinity, entries: [], key: 'pointsFor' },
                highestLuckRatingSeason: { value: -Infinity, entries: [], key: 'luckRating' },
                lowestLuckRatingSeason: { value: Infinity, entries: [], key: 'luckRating' },
            });
            return;
        }

        // Get the current year to exclude it from the records
        const currentYear = new Date().getFullYear().toString();
        
        // Filter out the current season's data
        const historicalRecords = Object.keys(processedSeasonalRecords).reduce((acc, year) => {
            if (year !== currentYear) {
                acc[year] = processedSeasonalRecords[year];
            }
            return acc;
        }, {});

        // Initialize highlight records with extreme values for this run
        let currentHighestDPRSeason = { value: -Infinity, entries: [], key: 'highestDPR' };
        let currentLowestDPRSeason = { value: Infinity, entries: [], key: 'lowestDPR' };
        let currentMostWinsSeason = { value: -Infinity, entries: [], key: 'wins' };
        let currentMostLossesSeason = { value: -Infinity, entries: [], key: 'losses' };
        let currentBestWinPctSeason = { value: -Infinity, entries: [], key: 'winPercentage' };
        let currentBestAllPlayWinPctSeason = { value: -Infinity, entries: [], key: 'allPlayWinPercentage' };
        let currentMostWeeklyHighScoresSeason = { value: -Infinity, entries: [], key: 'topScoreWeeksCount' };
        let currentMostWeeklyTop2ScoresSeason = { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' };
        let currentMostBlowoutWinsSeason = { value: -Infinity, entries: [], key: 'blowoutWins' };
        let currentMostBlowoutLossesSeason = { value: -Infinity, entries: [], key: 'blowoutLosses' };
        let currentMostSlimWinsSeason = { value: -Infinity, entries: [], key: 'slimWins' };
        let currentMostSlimLossesSeason = { value: Infinity, entries: [], key: 'slimLosses' };
        let currentMostPointsSeason = { value: -Infinity, entries: [], key: 'pointsFor' };
        let currentFewestPointsSeason = { value: Infinity, entries: [], key: 'pointsFor' };
        let currentBestLuckRatingSeason = { value: -Infinity, entries: [], key: 'luckRating' };
        let currentWorstLuckRatingSeason = { value: Infinity, entries: [], key: 'luckRating' };

        // Helper to update records (handles ties)
        const updateRecord = (currentRecord, newValue, teamInfo, isMin = false) => {
            if (typeof newValue !== 'number' || isNaN(newValue)) {
                return;
            }

            if (isMin) {
                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.entries = [teamInfo];
                } else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year)) {
                        currentRecord.entries.push(teamInfo);
                    }
                }
            } else { // Max
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.entries = [teamInfo];
                } else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year)) {
                        currentRecord.entries.push(teamInfo);
                    }
                }
            }
        };

        // Iterate over the filtered `historicalRecords`
        Object.keys(historicalRecords).forEach(year => {
            const teamsInSeasonObject = historicalRecords[year];
            if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') return;
            const teamsInSeason = Object.values(teamsInSeasonObject);
            teamsInSeason.forEach(teamStats => {
                if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) return;
                if (teamStats.totalGames === 0) return;
                
                const baseEntry = {
                    teamName: getTeamName(teamStats.ownerId, year),
                    year,
                    ownerId: teamStats.ownerId,
                    rosterId: teamStats.rosterId,
                };

                // Update records using the base entry
                if (typeof teamStats.wins === 'number') updateRecord(currentMostWinsSeason, teamStats.wins, { ...baseEntry, value: teamStats.wins });
                if (typeof teamStats.losses === 'number') updateRecord(currentMostLossesSeason, teamStats.losses, { ...baseEntry, value: teamStats.losses });
                if (typeof teamStats.winPercentage === 'number') updateRecord(currentBestWinPctSeason, teamStats.winPercentage, { ...baseEntry, value: teamStats.winPercentage });
                if (typeof teamStats.allPlayWinPercentage === 'number') updateRecord(currentBestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...baseEntry, value: teamStats.allPlayWinPercentage });
                if (typeof teamStats.topScoreWeeksCount === 'number') updateRecord(currentMostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...baseEntry, value: teamStats.topScoreWeeksCount });
                if (typeof teamStats.weeklyTop2ScoresCount === 'number') updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...baseEntry, value: teamStats.weeklyTop2ScoresCount });
                if (typeof teamStats.blowoutWins === 'number') updateRecord(currentMostBlowoutWinsSeason, teamStats.blowoutWins, { ...baseEntry, value: teamStats.blowoutWins });
                if (typeof teamStats.blowoutLosses === 'number') updateRecord(currentMostBlowoutLossesSeason, teamStats.blowoutLosses, { ...baseEntry, value: teamStats.blowoutLosses });
                if (typeof teamStats.slimWins === 'number') updateRecord(currentMostSlimWinsSeason, teamStats.slimWins, { ...baseEntry, value: teamStats.slimWins });
                if (typeof teamStats.slimLosses === 'number') updateRecord(currentMostSlimLossesSeason, teamStats.slimLosses, { ...baseEntry, value: teamStats.slimLosses });
                if (typeof teamStats.pointsFor === 'number') {
                    updateRecord(currentMostPointsSeason, teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor });
                    updateRecord(currentFewestPointsSeason, teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor }, true);
                }
                if (typeof teamStats.luckRating === 'number' && !isNaN(teamStats.luckRating)) {
                    updateRecord(currentBestLuckRatingSeason, teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating });
                    updateRecord(currentWorstLuckRatingSeason, teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating }, true);
                }
                if (typeof teamStats.adjustedDPR === 'number' && !isNaN(teamStats.adjustedDPR)) {
                    updateRecord(currentHighestDPRSeason, teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR });
                    updateRecord(currentLowestDPRSeason, teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR }, true);
                }
            });
        });

        const sortRecordEntries = (record) => {
            if (record && record.entries.length > 1) {
                record.entries.sort((a, b) => {
                    if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
                    return (a.teamName || '').localeCompare(b.teamName || '');
                });
            }
        };

        sortRecordEntries(currentMostWinsSeason);
        sortRecordEntries(currentMostLossesSeason);
        sortRecordEntries(currentBestWinPctSeason);
        sortRecordEntries(currentBestAllPlayWinPctSeason);
        sortRecordEntries(currentMostWeeklyHighScoresSeason);
        sortRecordEntries(currentMostWeeklyTop2ScoresSeason);
        sortRecordEntries(currentMostBlowoutWinsSeason);
        sortRecordEntries(currentMostBlowoutLossesSeason);
        sortRecordEntries(currentMostSlimWinsSeason);
        sortRecordEntries(currentMostSlimLossesSeason);
        sortRecordEntries(currentMostPointsSeason);
        sortRecordEntries(currentFewestPointsSeason);
        sortRecordEntries(currentBestLuckRatingSeason);
        sortRecordEntries(currentWorstLuckRatingSeason);
        sortRecordEntries(currentHighestDPRSeason);
        sortRecordEntries(currentLowestDPRSeason);

        setSeasonalHighlights({
            mostWinsSeason: currentMostWinsSeason,
            mostLossesSeason: currentMostLossesSeason,
            bestWinPctSeason: currentBestWinPctSeason,
            bestAllPlayWinPctSeason: currentBestAllPlayWinPctSeason,
            mostWeeklyHighScoresSeason: currentMostWeeklyHighScoresSeason,
            mostWeeklyTop2ScoresSeason: currentMostWeeklyTop2ScoresSeason,
            mostBlowoutWinsSeason: currentMostBlowoutWinsSeason,
            mostBlowoutLossesSeason: currentMostBlowoutLossesSeason,
            mostSlimWinsSeason: currentMostSlimWinsSeason,
            mostSlimLossesSeason: currentMostSlimLossesSeason,
            mostPointsSeason: currentMostPointsSeason,
            fewestPointsSeason: currentFewestPointsSeason,
            bestLuckRatingSeason: currentBestLuckRatingSeason,
            worstLuckRatingSeason: currentWorstLuckRatingSeason,
            highestDPRSeason: currentHighestDPRSeason,
            lowestDPRSeason: currentLowestDPRSeason,
        });

    }, [processedSeasonalRecords, getTeamName, loading, error]);

    if (loading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading seasonal records...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading seasonal data: {error.message}</div>;
    }

    if (!processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
        return <div className="text-center py-8 text-gray-600">No seasonal data available to display.</div>;
    }

    const highlightRecords = [
        seasonalHighlights.mostWinsSeason,
        seasonalHighlights.mostLossesSeason,
        seasonalHighlights.bestWinPctSeason,
        seasonalHighlights.bestAllPlayWinPctSeason,
        seasonalHighlights.mostWeeklyHighScoresSeason,
        seasonalHighlights.mostWeeklyTop2ScoresSeason,
        seasonalHighlights.mostBlowoutWinsSeason,
        seasonalHighlights.mostBlowoutLossesSeason,
        seasonalHighlights.mostSlimWinsSeason,
        seasonalHighlights.mostSlimLossesSeason,
        seasonalHighlights.mostPointsSeason,
        seasonalHighlights.fewestPointsSeason,
        seasonalHighlights.bestLuckRatingSeason,
        seasonalHighlights.worstLuckRatingSeason,
        seasonalHighlights.highestDPRSeason,
        seasonalHighlights.lowestDPRSeason,
    ].filter(
        (record) => record && record.value !== -Infinity && record.value !== Infinity && record.entries && record.entries.length > 0
    );

    return (
        <div className="p-8">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                        📅
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-gray-900">Season Records Highlights</h3>
                        <p className="text-gray-600 mt-1">
                            Outstanding records achieved in a single season • Excludes current {new Date().getFullYear()} season
                        </p>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-4 px-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-2">
                                        🏆 Record Achievement
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-center text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-2">
                                        📊 Value
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-center text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-2">
                                        👑 Team (Season)
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {highlightRecords.map((record, recordGroupIndex) => {
                                return record.entries.map((entry, entryIndex) => {
                                    const teamDisplayName = entry.teamName || getTeamName(entry.ownerId, entry.year);
                                    let valueDisplay = '';
                                    
                                    // Only display the value for the first entry in a group
                                    if (entryIndex === 0) {
                                        if (typeof entry.value === 'number') {
                                            if ([
                                                'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                                                'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses'
                                            ].includes(record.key)) {
                                                valueDisplay = Math.round(entry.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                            } else if (['luckRating', 'highestDPR', 'lowestDPR'].includes(record.key)) {
                                                valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                            } else if (record.key === 'pointsFor') {
                                                valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage') {
                                                valueDisplay = (entry.value * 100).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
                                            } else {
                                                valueDisplay = entry.value;
                                            }
                                        }
                                    }
                                    
                                    const label = entryIndex === 0 ? getRecordLabel(record.key, record) : '';

                                    return (
                                        <tr 
                                            key={`${record.key}-${teamDisplayName}-${entryIndex}`}
                                            className={`
                                                transition-all duration-200 hover:bg-blue-50 hover:shadow-sm
                                                ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}
                                                ${entryIndex === record.entries.length - 1 ? 'border-b-2 border-gray-200' : ''}
                                            `}
                                        >
                                            <td className="py-4 px-6">
                                                {entryIndex === 0 ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                                                            {recordGroupIndex + 1}
                                                        </div>
                                                        <span className="font-semibold text-gray-900 text-sm">
                                                            {label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="ml-11">
                                                        <span className="text-gray-400 text-sm">• Tied Record</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {entryIndex === 0 ? (
                                                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-200">
                                                        <span className="font-bold text-gray-900 text-sm">
                                                            {valueDisplay}
                                                        </span>
                                                    </div>
                                                ) : ''}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="font-medium text-gray-900 text-sm">
                                                        {teamDisplayName}
                                                    </span>
                                                    {entry.year && (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                                                            {entry.year}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                });
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default SeasonRecords;