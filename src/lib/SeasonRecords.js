// src/lib/SeasonRecords.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData to get processed data
import { formatNumber } from '../utils/formatUtils'; // Assuming you have this utility

/**
 * Displays seasonal league records, including per-season standings and overall seasonal highlights.
 */
const SeasonRecords = () => {
    // Consume processedSeasonalRecords and getTeamName from the context
    const { processedSeasonalRecords, getTeamName, loading, error } = useSleeperData(); // Removed getOwnerName as it's not used

    // State to hold the "seasonal highlights" (e.g., highest DPR ever in a single season)
    // FIXED: Initialize with default empty record structures to prevent 'undefined' errors
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
        // Highest/Lowest Season DPR
        let currentHighestDPRSeason = { value: -Infinity, entries: [], key: 'highestDPR' };
        let currentLowestDPRSeason = { value: Infinity, entries: [], key: 'lowestDPR' };
        // Find highest/lowest DPR by season
        Object.keys(processedSeasonalRecords).forEach(year => {
            const teamsInSeasonObject = processedSeasonalRecords[year];
            if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') return;
            const teamsInSeason = Object.values(teamsInSeasonObject);
            teamsInSeason.forEach(teamStats => {
                if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) return;
                if (teamStats.totalGames === 0) return;
                if (typeof teamStats.adjustedDPR === 'number' && !isNaN(teamStats.adjustedDPR)) {
                    const teamName = getTeamName(teamStats.ownerId, year);
                    const entry = {
                        teamName,
                        year,
                        value: teamStats.adjustedDPR,
                        ownerId: teamStats.ownerId,
                        rosterId: teamStats.rosterId
                    };
                    if (teamStats.adjustedDPR > currentHighestDPRSeason.value) {
                        currentHighestDPRSeason.value = teamStats.adjustedDPR;
                        currentHighestDPRSeason.entries = [entry];
                    } else if (teamStats.adjustedDPR === currentHighestDPRSeason.value) {
                        currentHighestDPRSeason.entries.push(entry);
                    }
                    if (teamStats.adjustedDPR < currentLowestDPRSeason.value) {
                        currentLowestDPRSeason.value = teamStats.adjustedDPR;
                        currentLowestDPRSeason.entries = [entry];
                    } else if (teamStats.adjustedDPR === currentLowestDPRSeason.value) {
                        currentLowestDPRSeason.entries.push(entry);
                    }
                }
            });
        });

    // Configuration for number formatting per stat (similar to LeagueRecords)
    const formatConfig = {
        adjustedDPR: { decimals: 3, type: 'decimal' },
        wins: { decimals: 0, type: 'count' },
        losses: { decimals: 0, type: 'count' },
        ties: { decimals: 0, type: 'count' },
        pointsFor: { decimals: 2, type: 'points' },
        pointsAgainst: { decimals: 2, type: 'points' },
        averageScore: { decimals: 2, type: 'points' },
        winPercentage: { decimals: 3, type: 'percentage' }, // Type 'percentage' for specific formatting
        allPlayWinPercentage: { decimals: 3, type: 'percentage' }, // Type 'percentage' for specific formatting
        topScoreWeeksCount: { decimals: 0, type: 'count' },
        blowoutWins: { decimals: 0, type: 'count' },
        blowoutLosses: { decimals: 0, type: 'count' },
        slimWins: { decimals: 0, type: 'count' },
        slimLosses: { decimals: 0, type: 'count' },
        weeklyTop2ScoresCount: { decimals: 0, type: 'count' }, // Assuming Top 2 from calculations.js
        luckRating: { decimals: 2, type: 'decimal' },
    };

    useEffect(() => {
        if (loading || error || !processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
            // FIXED: Reset to initial state structure, not just empty object
            setSeasonalHighlights({
                highestDPRSeason: { value: -Infinity, entries: [], key: 'adjustedDPR' },
                lowestDPRSeason: { value: Infinity, entries: [], key: 'adjustedDPR' },
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

        // Initialize highlight records with extreme values for this run
        // Remove adjustedDPR from highlights
        let currentMostWinsSeason = { value: -Infinity, entries: [], key: 'wins' };
        let currentMostLossesSeason = { value: -Infinity, entries: [], key: 'losses' };
        let currentBestWinPctSeason = { value: -Infinity, entries: [], key: 'winPercentage' };
        let currentBestAllPlayWinPctSeason = { value: -Infinity, entries: [], key: 'allPlayWinPercentage' };
        let currentMostWeeklyHighScoresSeason = { value: -Infinity, entries: [], key: 'topScoreWeeksCount' };
        let currentMostWeeklyTop2ScoresSeason = { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' };
        let currentMostBlowoutWinsSeason = { value: -Infinity, entries: [], key: 'blowoutWins' };
        let currentMostBlowoutLossesSeason = { value: -Infinity, entries: [], key: 'blowoutLosses' };
        let currentMostSlimWinsSeason = { value: -Infinity, entries: [], key: 'slimWins' };
        let currentMostSlimLossesSeason = { value: -Infinity, entries: [], key: 'slimLosses' };
        let currentMostPointsSeason = { value: -Infinity, entries: [], key: 'pointsFor' };
        let currentFewestPointsSeason = { value: Infinity, entries: [], key: 'pointsFor' };
        let currentBestLuckRatingSeason = { value: -Infinity, entries: [], key: 'luckRating' };
        let currentWorstLuckRatingSeason = { value: Infinity, entries: [], key: 'luckRating' };


        // Helper to update records (handles ties)
        const updateRecord = (currentRecord, newValue, teamInfo, isMin = false) => {
            // Ensure newValue is a number before comparison
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

        // --- Best/Worst Luck Rating by Season (from LuckRatingAnalysis logic) ---
        let bestLuck = { value: -Infinity, entries: [], key: 'luckRating' };
        let worstLuck = { value: Infinity, entries: [], key: 'luckRating' };
        Object.keys(processedSeasonalRecords).forEach(year => {
            const teamsInSeasonObject = processedSeasonalRecords[year];
            if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') return;
            const teamsInSeason = Object.values(teamsInSeasonObject);
            teamsInSeason.forEach(teamStats => {
                if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) return;
                if (teamStats.totalGames === 0) return;
                if (typeof teamStats.luckRating === 'number' && !isNaN(teamStats.luckRating)) {
                    const teamName = getTeamName(teamStats.ownerId, year);
                    const entry = {
                        teamName,
                        year,
                        value: teamStats.luckRating,
                        ownerId: teamStats.ownerId,
                        rosterId: teamStats.rosterId
                    };
                    if (teamStats.luckRating > bestLuck.value) {
                        bestLuck.value = teamStats.luckRating;
                        bestLuck.entries = [entry];
                    } else if (teamStats.luckRating === bestLuck.value) {
                        bestLuck.entries.push(entry);
                    }
                    if (teamStats.luckRating < worstLuck.value) {
                        worstLuck.value = teamStats.luckRating;
                        worstLuck.entries = [entry];
                    } else if (teamStats.luckRating === worstLuck.value) {
                        worstLuck.entries.push(entry);
                    }
                }
                // Always include year in teamInfo for all records
                if (typeof teamStats.wins === 'number') updateRecord(currentMostWinsSeason, teamStats.wins, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.wins, year });
                if (typeof teamStats.losses === 'number') updateRecord(currentMostLossesSeason, teamStats.losses, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.losses, year });
                if (typeof teamStats.winPercentage === 'number') updateRecord(currentBestWinPctSeason, teamStats.winPercentage, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.winPercentage, year });
                if (typeof teamStats.allPlayWinPercentage === 'number') updateRecord(currentBestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.allPlayWinPercentage, year });
                if (typeof teamStats.topScoreWeeksCount === 'number') updateRecord(currentMostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.topScoreWeeksCount, year });
                if (typeof teamStats.weeklyTop2ScoresCount === 'number') updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.weeklyTop2ScoresCount, year });
                if (typeof teamStats.blowoutWins === 'number') updateRecord(currentMostBlowoutWinsSeason, teamStats.blowoutWins, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.blowoutWins, year });
                if (typeof teamStats.blowoutLosses === 'number') updateRecord(currentMostBlowoutLossesSeason, teamStats.blowoutLosses, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.blowoutLosses, year });
                if (typeof teamStats.slimWins === 'number') updateRecord(currentMostSlimWinsSeason, teamStats.slimWins, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.slimWins, year });
                if (typeof teamStats.slimLosses === 'number') updateRecord(currentMostSlimLossesSeason, teamStats.slimLosses, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.slimLosses, year });
                if (typeof teamStats.pointsFor === 'number') {
                    updateRecord(currentMostPointsSeason, teamStats.pointsFor, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.pointsFor, year });
                    updateRecord(currentFewestPointsSeason, teamStats.pointsFor, { ...teamStats, teamName: getTeamName(teamStats.ownerId, year), value: teamStats.pointsFor, year }, true);
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
        // No adjustedDPR or luckRating sort needed


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
            bestLuckRatingSeason: bestLuck,
            worstLuckRatingSeason: worstLuck,
            highestDPRSeason: currentHighestDPRSeason,
            lowestDPRSeason: currentLowestDPRSeason,
        });

    }, [processedSeasonalRecords, getTeamName, loading, error]); // Removed getOwnerName from dependencies as it's not used

    if (loading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading seasonal records...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading seasonal data: {error.message}</div>;
    }

    if (!processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
        return <div className="text-center py-8 text-gray-600">No seasonal data available to display.</div>;
    }


    // Only include highlight records that have at least one valid entry (no N/A rows at all)
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
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS HIGHLIGHTS</h3>
            <p className="text-sm text-gray-600 mb-6">Highlight records achieved in a single season.</p>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/3">Record</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/3">Value</th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/3">Team</th>
                        </tr>
                    </thead>
                    <tbody>
                        {highlightRecords.map((record, recordGroupIndex) => {
                            if (!record || record.value === -Infinity || record.value === Infinity || !record.entries || record.entries.length === 0) {
                                // Capitalize and prefix for empty rows
                                let label = '';
                                if (record.key === 'luckRating') {
                                    label = record === seasonalHighlights.bestLuckRatingSeason ? 'Most Luck Rating' : 'Worst Luck Rating';
                                } else if (record.key === 'pointsFor') {
                                    label = record === seasonalHighlights.mostPointsSeason ? 'Most Points For' : 'Fewest Points For';
                                } else if (record.key.startsWith('most')) {
                                    label = 'Most ' + record.key.replace(/^most/, '').replace(/([A-Z])/g, ' $1').trim();
                                } else if (record.key.startsWith('fewest')) {
                                    label = 'Fewest ' + record.key.replace(/^fewest/, '').replace(/([A-Z])/g, ' $1').trim();
                                } else if (record.key.startsWith('best')) {
                                    label = 'Best ' + record.key.replace(/^best/, '').replace(/([A-Z])/g, ' $1').trim();
                                } else if (record.key.startsWith('worst')) {
                                    label = 'Worst ' + record.key.replace(/^worst/, '').replace(/([A-Z])/g, ' $1').trim();
                                } else {
                                    label = record.key.charAt(0).toUpperCase() + record.key.slice(1).replace(/([A-Z])/g, ' $1');
                                }
                                return (
                                    <tr key={record.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{label}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-center">N/A</td>
                                        <td className="py-2 px-3 text-sm text-gray-700 text-center"></td>
                                    </tr>
                                );
                            }
                            return record.entries.map((entry, entryIndex) => {
                                // Use teamName for display, fallback to getTeamName if missing
                                const teamDisplayName = entry.teamName || getTeamName(entry.ownerId, entry.year);
                                // Format value: no decimals for counts, 3 decimals for luckRating/DPR, 2 for pointsFor
                                let valueDisplay = entry.value;
                                if (typeof entry.value === 'number') {
                                    if ([
                                        'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                                        'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses'
                                    ].includes(record.key)) {
                                        valueDisplay = Math.round(entry.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                    } else if ([
                                        'luckRating', 'highestDPR', 'lowestDPR'
                                    ].includes(record.key)) {
                                        valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                    } else if (record.key === 'pointsFor') {
                                        valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage') {
                                        valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
                                    } else {
                                        valueDisplay = entry.value;
                                    }
                                }
                                // Capitalize and prefix for filled rows
                                let label = '';
                                if (entryIndex === 0) {
                                    if (record.key === 'luckRating') {
                                        label = record === seasonalHighlights.bestLuckRatingSeason ? 'Most Luck Rating' : 'Worst Luck Rating';
                                    } else if (record.key === 'pointsFor') {
                                        label = record === seasonalHighlights.mostPointsSeason ? 'Most Points For' : 'Fewest Points For';
                                    } else if (record.key.startsWith('most')) {
                                        label = 'Most ' + record.key.replace(/^most/, '').replace(/([A-Z])/g, ' $1').trim();
                                    } else if (record.key.startsWith('fewest')) {
                                        label = 'Fewest ' + record.key.replace(/^fewest/, '').replace(/([A-Z])/g, ' $1').trim();
                                    } else if (record.key.startsWith('best')) {
                                        label = 'Best ' + record.key.replace(/^best/, '').replace(/([A-Z])/g, ' $1').trim();
                                    } else if (record.key.startsWith('worst')) {
                                        label = 'Worst ' + record.key.replace(/^worst/, '').replace(/([A-Z])/g, ' $1').trim();
                                    } else {
                                        label = record.key.charAt(0).toUpperCase() + record.key.slice(1).replace(/([A-Z])/g, ' $1');
                                    }
                                    // Capitalize the first letter of the label
                                    if (label.length > 0) {
                                        label = label.charAt(0).toUpperCase() + label.slice(1);
                                    }
                                }
                                // Always show season year for each entry (even for multi-entry records)
                                return (
                                    <tr key={`${record.key}-${teamDisplayName}-${entryIndex}`} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{entryIndex === 0 ? label : ''}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-center">
                                            {entryIndex === 0 ? valueDisplay : ''}
                                        </td>
                                        <td className="py-2 px-3 text-sm text-gray-700 text-center">{teamDisplayName}{entry.year ? ` (${entry.year})` : ''}</td>
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default SeasonRecords;
