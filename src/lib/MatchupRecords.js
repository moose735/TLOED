// src/lib/MatchupRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook

const MatchupRecords = () => {
    const { historicalData, getTeamName, loading, error } = useSleeperData();
    const [aggregatedMatchupRecords, setAggregatedMatchupRecords] = useState({});

    // Helper to update a record (max/min)
    function updateRecord(recordObj, newValue, entryDetails, isMin = false) {
        // Only update if the new value is a valid number
        if (typeof newValue !== 'number' || isNaN(newValue)) {
            return;
        }

        if (isMin) {
            if (newValue < recordObj.value) {
                recordObj.value = newValue;
                recordObj.entries = [entryDetails];
            } else if (newValue === recordObj.value) {
                // Prevent duplicate entries for ties if they are identical
                const isDuplicate = recordObj.entries.some(existingEntry =>
                    existingEntry.year === entryDetails.year &&
                    existingEntry.week === entryDetails.week &&
                    existingEntry.team1RosterId === entryDetails.team1RosterId &&
                    existingEntry.team2RosterId === entryDetails.team2RosterId
                );
                if (!isDuplicate) {
                    recordObj.entries.push(entryDetails);
                }
            }
        } else {
            if (newValue > recordObj.value) {
                recordObj.value = newValue;
                recordObj.entries = [entryDetails];
            } else if (newValue === recordObj.value) {
                // Prevent duplicate entries for ties if they are identical
                const isDuplicate = recordObj.entries.some(existingEntry =>
                    existingEntry.year === entryDetails.year &&
                    existingEntry.week === entryDetails.week &&
                    existingEntry.team1RosterId === entryDetails.team1RosterId &&
                    existingEntry.team2RosterId === entryDetails.team2RosterId
                );
                if (!isDuplicate) {
                    recordObj.entries.push(entryDetails);
                }
            }
        }
    }
 
    useEffect(() => {
        // Handle loading, error, or missing historical data
        if (loading || error || !historicalData || !historicalData.matchupsBySeason) {
            setAggregatedMatchupRecords({});
            return;
        }

        // Get the current year to exclude ongoing season data from certain records
        const currentYear = new Date().getFullYear().toString();

        // Flatten historical matchups from the nested structure (year -> flat_array_of_matchup_objects)
        const allHistoricalMatchupsFlat = [];
        for (const year in historicalData.matchupsBySeason) {
            // Only include full, completed seasons for the fewests/lowests records
            const isHistoricalYear = year !== currentYear;
            const yearMatchupsArray = historicalData.matchupsBySeason[year];
            if (Array.isArray(yearMatchupsArray)) {
                allHistoricalMatchupsFlat.push(...yearMatchupsArray);
            }
        }

        if (allHistoricalMatchupsFlat.length === 0) {
            setAggregatedMatchupRecords({});
            return;
        }

        // Initialize aggregated records with values for finding min/max
        const newAggregatedRecords = {
            mostPointsScored: { value: -Infinity, entries: [] },
            fewestPointsScored: { value: Infinity, entries: [] },
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
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
                skipReason.push(`Invalid data point (year: ${year}, week: ${week}, scores: ${team1Score}, ${team2Score})`);
            }
            if (skipReason.length > 0) {
                console.warn('MatchupRecords: Skipping matchup due to:', skipReason.join('; '), '. Match:', match);
                return;
            }

            const combinedScore = team1Score + team2Score;
            const scoreDifference = Math.abs(team1Score - team2Score);
            const isTie = team1Score === team2Score;

            let winnerName = '';
            let loserName = '';
            if (!isTie) {
                winnerName = team1Score > team2Score ? team1Name : team2Name;
                loserName = team1Score > team2Score ? team2Name : team1Name;
            }

            const baseEntryDetails = {
                matchup: `${team1Name} vs ${team2Name}`,
                year,
                week,
                team1: team1Name,
                team2: team2Name,
                team1Score,
                team2Score,
                team1RosterId,
                team2RosterId,
            };

            // --- Update Records ---

            // Most Points Scored by a team
            updateRecord(newAggregatedRecords.mostPointsScored, team1Score, { ...baseEntryDetails, team: team1Name, score: team1Score });
            updateRecord(newAggregatedRecords.mostPointsScored, team2Score, { ...baseEntryDetails, team: team2Name, score: team2Score });

            // Fewest Points Scored by a team - ONLY FOR SCORES > 0
            if (team1Score > 0) {
                updateRecord(newAggregatedRecords.fewestPointsScored, team1Score, { ...baseEntryDetails, team: team1Name, score: team1Score }, true);
            }
            if (team2Score > 0) {
                updateRecord(newAggregatedRecords.fewestPointsScored, team2Score, { ...baseEntryDetails, team: team2Name, score: team2Score }, true);
            }

            // Highest Combined Score
            updateRecord(newAggregatedRecords.highestCombinedScore, combinedScore, { ...baseEntryDetails, combinedScore: combinedScore });

            // Lowest Combined Score - ONLY IF BOTH SCORES > 0
            if (combinedScore > 0 && team1Score > 0 && team2Score > 0) {
                updateRecord(newAggregatedRecords.lowestCombinedScore, combinedScore, { ...baseEntryDetails, combinedScore: combinedScore }, true);
            }

            // Biggest Blowout (largest absolute score difference in a non-tied game)
            if (!isTie) {
                updateRecord(newAggregatedRecords.biggestBlowout, scoreDifference, { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName });
            }

            // Slimmest Win (smallest positive score difference)
            if (!isTie && scoreDifference > 0) {
                updateRecord(newAggregatedRecords.slimmestWin, scoreDifference, { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName }, true);
            }
        });

        // Clean up: filter out initial -Infinity/Infinity values
        Object.keys(newAggregatedRecords).forEach(key => {
            const record = newAggregatedRecords[key];
            if (record.value === -Infinity || record.value === Infinity) {
                record.value = 0;
                record.entries = [];
            }
            // Sort entries for consistency
            record.entries.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                if (a.week !== b.week) return a.week - b.week;
                if (a.team && b.team && (key === 'mostPointsScored' || key === 'fewestPointsScored')) {
                    return a.team.localeCompare(b.team);
                }
                if (a.team1 && b.team1 && (key === 'highestCombinedScore' || key === 'lowestCombinedScore')) {
                    return a.team1.localeCompare(b.team1);
                }
                if (a.winner && b.winner && (key === 'biggestBlowout' || key === 'slimmestWin')) {
                    return a.winner.localeCompare(b.winner);
                }
                return 0;
            });
        });

        setAggregatedMatchupRecords(newAggregatedRecords);

    }, [historicalData, getTeamName, loading, error]);

    // Helper to format values for display
    const formatDisplayValue = (value, recordKey) => {
        // All these keys will have 2 decimal places and commas
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Define the order and labels for the records to display
    const recordsToDisplay = [
        { key: 'mostPointsScored', label: 'Most Points Scored by a Team' },
        { key: 'fewestPointsScored', label: 'Fewest Points Scored by a Team' },
        { key: 'highestCombinedScore', label: 'Highest Combined Score' },
        { key: 'lowestCombinedScore', label: 'Lowest Combined Score' },
        { key: 'biggestBlowout', label: 'Biggest Blowout' },
        { key: 'slimmestWin', label: 'Slimmest Win' },
    ];

    if (loading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading matchup records...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading matchup data: {error.message}</div>;
    }

    if (Object.keys(aggregatedMatchupRecords).length === 0 || recordsToDisplay.every(r => aggregatedMatchupRecords[r.key]?.entries.length === 0)) {
        return <p className="text-center text-gray-600">No matchup data available to display records.</p>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        ⚔️
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Game Record Holders</h3>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Outstanding single-game performances across all seasons • Minimum scores required for some records
                        </p>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🏆</span> Record Type
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📊</span> Value
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">⚔️</span> Game Details
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📅</span> Season
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📍</span> Week
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                                const recordData = aggregatedMatchupRecords[recordDef.key];
                                if (!recordData || recordData.entries.length === 0) {
                                    return (
                                        <tr key={recordDef.key} className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-300 rounded-lg flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                                                        {recordGroupIndex + 1}
                                                    </div>
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{recordDef.label}</span>
                                                </div>
                                            </td>
                                            <td colSpan="4" className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <span className="text-gray-500 text-xs sm:text-sm italic">No data available</span>
                                            </td>
                                        </tr>
                                    );
                                }

                                return recordData.entries.map((entry, index) => {
                                    let matchupDisplay;
                                    const team1ScoreFormatted = entry.team1Score.toFixed(2);
                                    const team2ScoreFormatted = entry.team2Score.toFixed(2);
                                    const winnerScore = (entry.winner === entry.team1 ? entry.team1Score : entry.team2Score).toFixed(2);
                                    const loserScore = (entry.loser === entry.team1 ? entry.team1Score : entry.team2Score).toFixed(2);

                                    if (recordDef.key === 'mostPointsScored' || recordDef.key === 'fewestPointsScored') {
                                        const recordHolder = entry.team;
                                        const recordScore = entry.score.toFixed(2);
                                        const opponent = recordHolder === entry.team1 ? entry.team2 : entry.team1;
                                        const opponentScore = (recordHolder === entry.team1 ? entry.team2Score : entry.team1Score).toFixed(2);

                                        matchupDisplay = (
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-900">{recordHolder}</span>
                                                        <span className="font-bold text-blue-600">{recordScore}</span>
                                                    </div>
                                                    <span className="text-gray-500 font-medium">vs</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-700">{opponent}</span>
                                                        <span className="text-gray-600">{opponentScore}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else if (recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin') {
                                        matchupDisplay = (
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-900">{entry.winner}</span>
                                                        <span className="font-bold text-green-600">{winnerScore}</span>
                                                    </div>
                                                    <span className="text-gray-500 font-medium">vs</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-700">{entry.loser}</span>
                                                        <span className="text-red-600">{loserScore}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        matchupDisplay = (
                                            <div className="flex flex-col space-y-2">
                                                <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 border border-gray-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-900">{entry.team1}</span>
                                                        <span className="font-bold text-blue-600">{team1ScoreFormatted}</span>
                                                    </div>
                                                    <span className="text-gray-500 font-medium">vs</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-900">{entry.team2}</span>
                                                        <span className="font-bold text-blue-600">{team2ScoreFormatted}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <tr
                                            key={`${recordDef.key}-${entry.team1}-${entry.team2}-${entry.year}-${entry.week}-${index}`}
                                            className={`
                                                transition-all duration-200 hover:bg-blue-50 hover:shadow-sm
                                                ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}
                                                ${index === recordData.entries.length - 1 ? 'border-b-2 border-gray-200' : ''}
                                            `}
                                        >
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                {index === 0 ? (
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                                            {recordDef.label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="ml-2 sm:ml-4">
                                                        <span className="text-gray-400 text-xs sm:text-sm">• Tied Record</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                {index === 0 ? (
                                                    <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-orange-100 to-red-100 border border-orange-200">
                                                        <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                            {formatDisplayValue(recordData.value, recordDef.key)}
                                                        </span>
                                                    </div>
                                                ) : ''}
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="text-xs sm:text-sm">
                                                    {matchupDisplay}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                                                    {entry.year}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium">
                                                    Week {entry.week}
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
};

export default MatchupRecords;