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
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">MATCHUP RECORD HOLDERS - ( GAME )</h3>
            <p className="text-sm text-gray-600 mb-6">Records based on individual game performances across all seasons. Records for 'Fewest Points' are only counted from games where a score greater than 0 was recorded.</p>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-2/5">Matchup</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/10">Season</th>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/10">Week</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                            const recordData = aggregatedMatchupRecords[recordDef.key];
                            if (!recordData || recordData.entries.length === 0) {
                                return (
                                    <tr key={recordDef.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                                        <td colSpan="4" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
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
                                        <div className="flex items-center justify-center w-full">
                                            <span className="text-left flex-1 pr-1 whitespace-nowrap">
                                                {recordHolder} ({recordScore})
                                            </span>
                                            <span className="px-2 font-semibold text-gray-600">vs</span>
                                            <span className="text-right flex-1 pl-1 whitespace-nowrap">
                                                {opponent} ({opponentScore})
                                            </span>
                                        </div>
                                    );
                                } else if (recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin') {
                                    matchupDisplay = (
                                        <div className="flex items-center justify-center w-full">
                                            <span className="text-left flex-1 pr-1 whitespace-nowrap">
                                                {entry.winner} ({winnerScore})
                                            </span>
                                            <span className="px-2 font-semibold text-gray-600">vs</span>
                                            <span className="text-right flex-1 pl-1 whitespace-nowrap">
                                                {entry.loser} ({loserScore})
                                            </span>
                                        </div>
                                    );
                                } else {
                                    matchupDisplay = (
                                        <div className="flex items-center justify-center w-full">
                                            <span className="text-left flex-1 pr-1 whitespace-nowrap">{entry.team1} ({team1ScoreFormatted})</span>
                                            <span className="px-2 font-semibold text-gray-600">vs</span>
                                            <span className="text-right flex-1 pl-1 whitespace-nowrap">{entry.team2} ({team2ScoreFormatted})</span>
                                        </div>
                                    );
                                }

                                return (
                                    <tr key={`${recordDef.key}-${entry.year}-${entry.week}-${entry.team1RosterId}-${entry.team2RosterId}-${index}`} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                                            {index === 0 ? recordDef.label : ''}
                                        </td>
                                        <td className="py-2 px-3 text-sm text-gray-800">{formatDisplayValue(recordData.value, recordDef.key)}</td>
                                        <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                            {matchupDisplay}
                                        </td>
                                        <td className="py-2 px-3 text-sm text-gray-700">{entry.year}</td>
                                        <td className="py-2 px-3 text-sm text-gray-700">{entry.week}</td>
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MatchupRecords;