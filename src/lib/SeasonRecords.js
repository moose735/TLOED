// src/lib/SeasonRecords.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData to get processed data
import { formatNumber } from '../utils/formatUtils'; // Assuming you have this utility

/**
 * Displays seasonal league records, including per-season standings and overall seasonal highlights.
 */
const SeasonRecords = () => {
    // Consume processedSeasonalRecords and getTeamName from the context
    const { processedSeasonalRecords, getTeamName, getOwnerName, loading, error } = useSleeperData();

    // State to hold the "seasonal highlights" (e.g., highest DPR ever in a single season)
    const [seasonalHighlights, setSeasonalHighlights] = useState({});

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
        weeklyTop2ScoresCount: { decimals: 0, type: 'count' }, // Assuming Top 2 from calculations.js
        luckRating: { decimals: 2, type: 'decimal' },
    };

    useEffect(() => {
        // Log the received processedSeasonalRecords for debugging
        console.log("SeasonRecords useEffect: processedSeasonalRecords:", processedSeasonalRecords);

        if (loading || error || !processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
            setSeasonalHighlights({});
            console.log("SeasonRecords useEffect: Data not ready or empty. Resetting highlights.");
            return;
        }

        // Initialize highlight records with extreme values
        let highestDPRSeason = { value: -Infinity, entries: [], key: 'adjustedDPR' };
        let lowestDPRSeason = { value: Infinity, entries: [], key: 'adjustedDPR' };
        let mostWinsSeason = { value: -Infinity, entries: [], key: 'wins' };
        let mostLossesSeason = { value: -Infinity, entries: [], key: 'losses' };
        let bestWinPctSeason = { value: -Infinity, entries: [], key: 'winPercentage' };
        let bestAllPlayWinPctSeason = { value: -Infinity, entries: [], key: 'allPlayWinPercentage' };
        let mostWeeklyHighScoresSeason = { value: -Infinity, entries: [], key: 'topScoreWeeksCount' };
        let mostWeeklyTop2ScoresSeason = { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' };
        let mostBlowoutWinsSeason = { value: -Infinity, entries: [], key: 'blowoutWins' };
        let mostBlowoutLossesSeason = { value: -Infinity, entries: [], key: 'blowoutLosses' };
        let mostSlimWinsSeason = { value: -Infinity, entries: [], key: 'slimWins' };
        let mostSlimLossesSeason = { value: -Infinity, entries: [], key: 'slimLosses' };
        let mostPointsSeason = { value: -Infinity, entries: [], key: 'pointsFor' };
        let fewestPointsSeason = { value: Infinity, entries: [], key: 'pointsFor' };
        let highestLuckRatingSeason = { value: -Infinity, entries: [], key: 'luckRating' };
        let lowestLuckRatingSeason = { value: Infinity, entries: [], key: 'luckRating' };


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
                    // Check if the exact entry (rosterId + year) already exists to prevent duplicates
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year)) {
                        currentRecord.entries.push(teamInfo);
                    }
                }
            } else { // Max
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.entries = [teamInfo];
                } else if (newValue === currentRecord.value) {
                    // Check if the exact entry (rosterId + year) already exists to prevent duplicates
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

            // Object.values returns an array of the team stat objects for the current year
            const teamsInSeason = Object.values(teamsInSeasonObject);

            teamsInSeason.forEach(teamStats => {
                // Ensure teamStats is a valid object and has basic identifiers
                if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId) {
                    console.warn(`SeasonRecords: Skipping invalid or incomplete teamStats for year ${year}. TeamStats:`, teamStats);
                    return;
                }

                // IMPORTANT FIX: Use teamStats.teamName directly if available
                // This assumes your processedSeasonalRecords already includes 'teamName'
                const teamInfo = {
                    teamName: teamStats.teamName || getTeamName(teamStats.rosterId, year) || 'Unknown Team', // Fallback to getTeamName if teamName is missing
                    year: year,
                    rosterId: teamStats.rosterId,
                    ownerId: teamStats.ownerId, // ownerId is crucial for linking to users
                };

                // Update highlights based on seasonal team stats
                // Add checks for data existence before updating records to prevent NaN issues
                if (typeof teamStats.adjustedDPR === 'number') {
                    updateRecord(highestDPRSeason, teamStats.adjustedDPR, { ...teamInfo, value: teamStats.adjustedDPR });
                    updateRecord(lowestDPRSeason, teamStats.adjustedDPR, { ...teamInfo, value: teamStats.adjustedDPR }, true);
                }
                if (teamStats.totalGames > 0) { // Only consider teams that played games
                    if (typeof teamStats.wins === 'number') updateRecord(mostWinsSeason, teamStats.wins, { ...teamInfo, value: teamStats.wins });
                    if (typeof teamStats.losses === 'number') updateRecord(mostLossesSeason, teamStats.losses, { ...teamInfo, value: teamStats.losses });
                    if (typeof teamStats.winPercentage === 'number') updateRecord(bestWinPctSeason, teamStats.winPercentage, { ...teamInfo, value: teamStats.winPercentage });
                    if (typeof teamStats.allPlayWinPercentage === 'number') updateRecord(bestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...teamInfo, value: teamStats.allPlayWinPercentage });
                    if (typeof teamStats.topScoreWeeksCount === 'number') updateRecord(mostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...teamInfo, value: teamStats.topScoreWeeksCount });
                    if (typeof teamStats.weeklyTop2ScoresCount === 'number') updateRecord(mostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...teamInfo, value: teamStats.weeklyTop2ScoresCount });
                    if (typeof teamStats.blowoutWins === 'number') updateRecord(mostBlowoutWinsSeason, teamStats.blowoutWins, { ...teamInfo, value: teamStats.blowoutWins });
                    if (typeof teamStats.blowoutLosses === 'number') updateRecord(mostBlowoutLossesSeason, teamStats.blowoutLosses, { ...teamInfo, value: teamStats.blowoutLosses });
                    if (typeof teamStats.slimWins === 'number') updateRecord(mostSlimWinsSeason, teamStats.slimWins, { ...teamInfo, value: teamStats.slimWins });
                    if (typeof teamStats.slimLosses === 'number') updateRecord(mostSlimLossesSeason, teamStats.slimLosses, { ...teamInfo, value: teamStats.slimLosses });
                    if (typeof teamStats.pointsFor === 'number') {
                        updateRecord(mostPointsSeason, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor });
                        updateRecord(fewestPointsSeason, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor }, true);
                    }
                    if (typeof teamStats.luckRating === 'number') {
                        updateRecord(highestLuckRatingSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating });
                        updateRecord(lowestLuckRatingSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating }, true);
                    }
                }
            });
        });

        // Sort entries for ties consistently (by year, then team name)
        const sortRecordEntries = (record) => {
            if (record && record.entries.length > 1) {
                record.entries.sort((a, b) => {
                    if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year); // Ensure year is treated as number for sorting
                    return (a.teamName || '').localeCompare(b.teamName || '');
                });
            }
        };

        sortRecordEntries(highestDPRSeason);
        sortRecordEntries(lowestDPRSeason);
        sortRecordEntries(mostWinsSeason);
        sortRecordEntries(mostLossesSeason);
        sortRecordEntries(bestWinPctSeason);
        sortRecordEntries(bestAllPlayWinPctSeason);
        sortRecordEntries(mostWeeklyHighScoresSeason);
        sortRecordEntries(mostWeeklyTop2ScoresSeason);
        sortRecordEntries(mostBlowoutWinsSeason);
        sortRecordEntries(mostBlowoutLossesSeason);
        sortRecordEntries(mostSlimWinsSeason);
        sortRecordEntries(mostSlimLossesSeason);
        sortRecordEntries(mostPointsSeason);
        sortRecordEntries(fewestPointsSeason);
        sortRecordEntries(highestLuckRatingSeason);
        sortRecordEntries(lowestLuckRatingSeason);


        setSeasonalHighlights({
            highestDPRSeason,
            lowestDPRSeason,
            mostWinsSeason,
            mostLossesSeason,
            bestWinPctSeason,
            bestAllPlayWinPctSeason,
            mostWeeklyHighScoresSeason,
            mostWeeklyTop2ScoresSeason,
            mostBlowoutWinsSeason,
            mostBlowoutLossesSeason,
            mostSlimWinsSeason,
            mostSlimLossesSeason,
            mostPointsSeason,
            fewestPointsSeason,
            highestLuckRatingSeason,
            lowestLuckRatingSeason,
        });

    }, [processedSeasonalRecords, getTeamName, getOwnerName, loading, error]);


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
        // FIXED: Check if record is defined BEFORE accessing its properties
        if (!record) {
            console.warn("renderHighlightRecordEntry: 'record' is undefined. Skipping render.");
            return null; // Return null if record is undefined to prevent errors
        }

        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        if (record.entries.length === 0 || (typeof record.value === 'number' && (record.value === -Infinity || record.value === Infinity))) {
            return (
                <>
                    <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                        {record.key.replace(/([A-Z])/g, ' $1').trim()}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-500">N/A</td>
                    <td className="py-2 px-4 text-right text-gray-500"></td>
                </>
            );
        }

        let displayValue;
        if (config.type === 'percentage') {
            displayValue = formatNumber(record.value * 100, config.decimals, 'decimal') + '%';
        } else {
            displayValue = formatNumber(record.value, config.decimals, config.type);
        }

        const allTiedTeamsDisplay = record.entries.map((entry, index) => {
            // Defensive check: if entry is undefined, return null to filter it out later
            if (!entry) {
                console.warn(`SeasonRecords: Skipping undefined entry in record.entries for key '${record.key}'. Index: ${index}`);
                return null; // Return null for undefined entries to prevent errors
            }
            return (
                <div
                    key={`${record.key}-${entry.rosterId || entry.ownerId}-${entry.year}-${index}`}
                    className="leading-tight"
                >
                    {entry.teamName} ({entry.year})
                </div>
            );
        }).filter(Boolean); // Filter out any null entries that were returned for undefined 'entry' objects

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

    // Sort years for display (most recent first)
    const sortedYears = Object.keys(processedSeasonalRecords).sort((a, b) => parseInt(b) - parseInt(a));

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

            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 mt-8">SEASONAL BREAKDOWN</h3>
            <p className="text-sm text-gray-600 mb-6">Detailed records for each season.</p>

            {sortedYears.map(year => {
                // Ensure data for the specific year exists and is an object
                const teamsForThisYear = processedSeasonalRecords[year];
                if (!teamsForThisYear || typeof teamsForThisYear !== 'object' || Object.keys(teamsForThisYear).length === 0) {
                    return (
                        <div key={year} className="mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Season {year}</h4>
                            <p className="text-gray-500">No team data available for this season.</p>
                        </div>
                    );
                }

                return (
                    <div key={year} className="mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Season {year}</h4>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Team
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Record (W-L-T)
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        PF
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        PA
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Rank
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Points Rank
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Adjusted DPR
                                    </th>
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Awards
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {Object.values(teamsForThisYear)
                                    .sort((a, b) => a.rank - b.rank) // Assuming 'rank' is available and correct
                                    .map((teamStats, index) => {
                                        // Ensure teamStats object is valid before rendering
                                        if (!teamStats || typeof teamStats !== 'object') {
                                            console.warn(`SeasonRecords: Invalid teamStats object encountered in rendering for year ${year}. Index: ${index}.`, teamStats);
                                            return null; // Skip rendering this row
                                        }
                                        return (
                                            <tr key={teamStats.rosterId || `no-rosterid-${year}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="py-2 px-4 text-left font-medium text-gray-800">
                                                    {teamStats.teamName || 'Unknown Team'} {/* Use teamStats.teamName directly */}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {`${teamStats.wins || 0}-${teamStats.losses || 0}-${teamStats.ties || 0}`}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {formatNumber(teamStats.pointsFor, 2, 'points')}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {formatNumber(teamStats.pointsAgainst, 2, 'points')}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {teamStats.rank !== undefined ? teamStats.rank : 'N/A'}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {teamStats.pointsRank !== undefined ? teamStats.pointsRank : 'N/A'}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700">
                                                    {formatNumber(teamStats.adjustedDPR, 3, 'decimal')}
                                                </td>
                                                <td className="py-2 px-4 text-center text-gray-700 text-sm">
                                                    {teamStats.isChampion && <div className="font-semibold text-green-700">🏆 Champion</div>}
                                                    {teamStats.isRunnerUp && <div className="font-semibold text-gray-600">🥈 Runner-Up</div>}
                                                    {teamStats.isThirdPlace && <div className="font-semibold text-yellow-700">🥉 3rd Place</div>}
                                                    {teamStats.isPointsChampion && <div className="font-semibold text-blue-700">👑 Points Champ</div>}
                                                    {teamStats.isPointsRunnerUp && <div className="font-semibold text-blue-500">🥈 Points Runner-Up</div>}
                                                    {teamStats.isThirdPlacePoints && <div className="font-semibold text-blue-400">🥉 3rd Place Points</div>}
                                                    {teamStats.isPlayoffTeam && !teamStats.isChampion && !teamStats.isRunnerUp && !teamStats.isThirdPlace && <div className="text-gray-500">Playoff Team</div>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

export default SeasonRecords;
