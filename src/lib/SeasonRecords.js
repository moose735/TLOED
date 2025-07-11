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
        let currentHighestDPRSeason = { value: -Infinity, entries: [], key: 'adjustedDPR' };
        let currentLowestDPRSeason = { value: Infinity, entries: [], key: 'adjustedDPR' };
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
        let currentHighestLuckRatingSeason = { value: -Infinity, entries: [], key: 'luckRating' };
        let currentLowestLuckRatingSeason = { value: Infinity, entries: [], key: 'luckRating' };


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

        // Iterate through each season and each team's processed stats
        Object.keys(processedSeasonalRecords).forEach(year => {
            const teamsInSeasonObject = processedSeasonalRecords[year];

            if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') {
                console.warn(`SeasonRecords: Skipping invalid processedSeasonalRecords[${year}] entry.`);
                return;
            }

            const teamsInSeason = Object.values(teamsInSeasonObject);

            teamsInSeason.forEach(teamStats => {
                // Ensure teamStats is a valid object and has basic identifiers
                if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) { // Ensure ownerId is present
                    console.warn(`SeasonRecords: Skipping invalid or incomplete teamStats for year ${year}. TeamStats:`, teamStats);
                    return;
                }

                // FIXED: Skip teams/seasons with 0 total games to avoid 0.000 DPR for future seasons
                if (teamStats.totalGames === 0) {
                    return;
                }

                // FIXED: Call getTeamName with ownerId and year for seasonal context
                let resolvedTeamName = getTeamName(teamStats.ownerId, year);
                // The getTeamName function in context is now robust, so this local fallback is less necessary
                // but keeping it for extreme edge cases where getTeamName might still return generic.
                if (resolvedTeamName.startsWith('Unknown Team (ID:')) {
                    resolvedTeamName = teamStats.teamName || 'Unknown Team';
                }

                const teamInfo = {
                    teamName: resolvedTeamName,
                    year: year,
                    rosterId: teamStats.rosterId,
                    ownerId: teamStats.ownerId,
                };

                // Update highlights based on seasonal team stats
                if (typeof teamStats.adjustedDPR === 'number') {
                    updateRecord(currentHighestDPRSeason, teamStats.adjustedDPR, { ...teamInfo, value: teamStats.adjustedDPR });
                    // Only update lowest DPR if it's not 0, to avoid future/empty season issues
                    if (teamStats.adjustedDPR > 0) {
                        updateRecord(currentLowestDPRSeason, teamStats.adjustedDPR, { ...teamInfo, value: teamStats.adjustedDPR }, true);
                    }
                }
                if (teamStats.totalGames > 0) {
                    if (typeof teamStats.wins === 'number') updateRecord(currentMostWinsSeason, teamStats.wins, { ...teamInfo, value: teamStats.wins });
                    if (typeof teamStats.losses === 'number') updateRecord(currentMostLossesSeason, teamStats.losses, { ...teamInfo, value: teamStats.losses });
                    if (typeof teamStats.winPercentage === 'number') updateRecord(currentBestWinPctSeason, teamStats.winPercentage, { ...teamInfo, value: teamStats.winPercentage });
                    if (typeof teamStats.allPlayWinPercentage === 'number') updateRecord(currentBestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...teamInfo, value: teamStats.allPlayWinPercentage });
                    if (typeof teamStats.topScoreWeeksCount === 'number') updateRecord(currentMostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...teamInfo, value: teamStats.topScoreWeeksCount });
                    if (typeof teamStats.weeklyTop2ScoresCount === 'number') updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...teamInfo, value: teamStats.weeklyTop2ScoresCount });
                    if (typeof teamStats.blowoutWins === 'number') updateRecord(currentMostBlowoutWinsSeason, teamStats.blowoutWins, { ...teamInfo, value: teamStats.blowoutWins });
                    if (typeof teamStats.blowoutLosses === 'number') updateRecord(currentMostBlowoutLossesSeason, teamStats.blowoutLosses, { ...teamInfo, value: teamStats.blowoutLosses });
                    if (typeof teamStats.slimWins === 'number') updateRecord(currentMostSlimWinsSeason, teamStats.slimWins, { ...teamInfo, value: teamStats.slimWins });
                    if (typeof teamStats.slimLosses === 'number') updateRecord(currentMostSlimLossesSeason, teamStats.slimLosses, { ...teamInfo, value: teamStats.slimLosses });
                    if (typeof teamStats.pointsFor === 'number') {
                        updateRecord(currentMostPointsSeason, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor });
                        updateRecord(currentFewestPointsSeason, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor }, true);
                    }
                    if (typeof teamStats.luckRating === 'number') {
                        updateRecord(currentHighestLuckRatingSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating });
                        updateRecord(currentLowestLuckRatingSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating }, true);
                    }
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

        sortRecordEntries(currentHighestDPRSeason);
        sortRecordEntries(currentLowestDPRSeason);
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
        sortRecordEntries(currentHighestLuckRatingSeason);
        sortRecordEntries(currentLowestLuckRatingSeason);


        setSeasonalHighlights({
            highestDPRSeason: currentHighestDPRSeason,
            lowestDPRSeason: currentLowestDPRSeason,
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
            highestLuckRatingSeason: currentHighestLuckRatingSeason,
            lowestLuckRatingSeason: currentLowestLuckRatingSeason,
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

    // Helper to render a single highlight record entry
    const renderHighlightRecordEntry = (record) => {
        // FIXED: Added a robust check for 'record' and its 'entries' property
        if (!record || !Array.isArray(record.entries) || record.entries.length === 0 ||
            (typeof record.value === 'number' && (record.value === -Infinity || record.value === Infinity))) {
            return (
                <>
                    <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                        {record?.key?.replace(/([A-Z])/g, ' $1').trim() || 'N/A'}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-500">N/A</td>
                    <td className="py-2 px-4 text-right text-gray-500"></td>
                </>
            );
        }

        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        let displayValue;
        if (config.type === 'percentage') {
            displayValue = formatNumber(record.value, config.decimals, 'decimal') + '%';
        } else {
            displayValue = formatNumber(record.value, config.decimals, config.type);
        }

        const allTiedTeamsDisplay = record.entries.map((entry, index) => {
            if (!entry || !entry.ownerId) { // Ensure entry and ownerId are present
                console.warn(`SeasonRecords: Skipping invalid entry in record.entries for key '${record.key}'. Index: ${index}`, entry);
                return null;
            }
            // FIXED: Always use ownerId and specific year for seasonal records
            const teamDisplayName = getTeamName(entry.ownerId, entry.year);

            return (
                <div
                    key={`${record.key}-${entry.ownerId}-${entry.year}-${index}`} // Use ownerId for key
                    className="leading-tight"
                >
                    {teamDisplayName}{entry.year ? ` (${entry.year})` : ''}
                </div>
            );
        }).filter(Boolean); // Filter out any nulls from invalid entries

        return (
            <>
                <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                    {record.key.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-lg">{displayValue}</td>
                <td className="py-2 px-4 text-right text-gray-700">
                    {allTiedTeamsDisplay}
                </td>
            </>
        );
    };

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS HIGHLIGHTS</h3>
            <p className="text-sm text-gray-600 mb-6">Highlight records achieved in a single season.</p>

            <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-3">Single Season Best/Worst</h4>
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
                    <tbody>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.highestDPRSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.lowestDPRSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.mostWinsSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.mostLossesSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.bestWinPctSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.bestAllPlayWinPctSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.mostWeeklyHighScoresSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.mostWeeklyTop2ScoresSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.mostBlowoutWinsSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.mostBlowoutLossesSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.mostSlimWinsSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.mostSlimLossesSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.mostPointsSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.fewestPointsSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                            {renderHighlightRecordEntry(seasonalHighlights.highestLuckRatingSeason)}
                        </tr>
                        <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                            {renderHighlightRecordEntry(seasonalHighlights.lowestLuckRatingSeason)}
                        </tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default SeasonRecords;
