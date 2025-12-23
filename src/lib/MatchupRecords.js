// src/lib/MatchupRecords.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData context hook
import logger from '../utils/logger';

const MatchupRecords = () => {
    const { historicalData, getTeamName, loading, error } = useSleeperData();
    const [aggregatedMatchupRecords, setAggregatedMatchupRecords] = useState({});
    
    // State for collapsible sections
    const [expandedSections, setExpandedSections] = useState({});
    const [allMatchupData, setAllMatchupData] = useState({});

    // Toggle function for expanding/collapsing sections
    const toggleSection = (key) => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

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
            setAllMatchupData({});
            return;
        }

        // Initialize collection for all matchup data
        const tempAllMatchupData = {
            mostPointsScored: [],
            fewestPointsScored: [],
            mostPointsInLoss: [],
            fewestPointsInWin: [],
            highestCombinedScore: [],
            lowestCombinedScore: [],
            biggestBlowout: [],
            slimmestWin: []
        };

        // Helper function to add data to all matchup data collection
        const addToAllMatchupData = (recordKey, value, entryDetails) => {
            if (typeof value === 'number' && !isNaN(value) && tempAllMatchupData[recordKey]) {
                tempAllMatchupData[recordKey].push({
                    ...entryDetails,
                    value: value
                });
            }
        };

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
            if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
                skipReason.push(`Invalid data point (year: ${year}, week: ${week}, scores: ${team1Score}, ${team2Score})`);
            }
            if (skipReason.length > 0) {
                logger.warn('MatchupRecords: Skipping matchup due to:', skipReason.join('; '), '. Match:', match);
                return;
            }

            const combinedScore = team1Score + team2Score;
            const scoreDifference = Math.abs(team1Score - team2Score);
            const isTie = team1Score === team2Score && team1Score > 0;

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
            const team1Details = { ...baseEntryDetails, team: team1Name, score: team1Score };
            const team2Details = { ...baseEntryDetails, team: team2Name, score: team2Score };
            updateRecord(newAggregatedRecords.mostPointsScored, team1Score, team1Details);
            updateRecord(newAggregatedRecords.mostPointsScored, team2Score, team2Details);
            addToAllMatchupData('mostPointsScored', team1Score, team1Details);
            addToAllMatchupData('mostPointsScored', team2Score, team2Details);

            // Fewest Points Scored by a team - ONLY FOR SCORES > 0
            if (team1Score > 0) {
                updateRecord(newAggregatedRecords.fewestPointsScored, team1Score, team1Details, true);
                addToAllMatchupData('fewestPointsScored', team1Score, team1Details);
            }
            if (team2Score > 0) {
                updateRecord(newAggregatedRecords.fewestPointsScored, team2Score, team2Details, true);
                addToAllMatchupData('fewestPointsScored', team2Score, team2Details);
            }

            // Most Points Scored in a Loss (loser's score, maximize)
            if (!isTie) {
                const loserIsTeam1 = team1Score < team2Score;
                const losingTeam = loserIsTeam1 ? team1Name : team2Name;
                const losingScore = loserIsTeam1 ? team1Score : team2Score;
                const winningTeam = loserIsTeam1 ? team2Name : team1Name;
                const winningScore = loserIsTeam1 ? team2Score : team1Score;
                const lossDetails = { ...baseEntryDetails, team: losingTeam, score: losingScore, opponent: winningTeam, opponentScore: winningScore };
                updateRecord(newAggregatedRecords.mostPointsInLoss, losingScore, lossDetails);
                addToAllMatchupData('mostPointsInLoss', losingScore, lossDetails);
            }

            // Fewest Points Scored in a Win (winner's score, minimize)
            if (!isTie) {
                const winnerIsTeam1 = team1Score > team2Score;
                const winningTeam = winnerIsTeam1 ? team1Name : team2Name;
                const winningScore = winnerIsTeam1 ? team1Score : team2Score;
                const losingTeam = winnerIsTeam1 ? team2Name : team1Name;
                const losingScore = winnerIsTeam1 ? team2Score : team1Score;
                if (winningScore > 0) {
                    const winDetails = { ...baseEntryDetails, team: winningTeam, score: winningScore, opponent: losingTeam, opponentScore: losingScore };
                    updateRecord(newAggregatedRecords.fewestPointsInWin, winningScore, winDetails, true);
                    addToAllMatchupData('fewestPointsInWin', winningScore, winDetails);
                }
            }

            // Highest Combined Score
            const combinedDetails = { ...baseEntryDetails, combinedScore: combinedScore };
            updateRecord(newAggregatedRecords.highestCombinedScore, combinedScore, combinedDetails);
            addToAllMatchupData('highestCombinedScore', combinedScore, combinedDetails);

            // Lowest Combined Score - ONLY IF BOTH SCORES > 0
            if (combinedScore > 0 && team1Score > 0 && team2Score > 0) {
                updateRecord(newAggregatedRecords.lowestCombinedScore, combinedScore, combinedDetails, true);
                addToAllMatchupData('lowestCombinedScore', combinedScore, combinedDetails);
            }

            // Biggest Blowout (largest absolute score difference in a non-tied game)
            if (!isTie) {
                const blowoutDetails = { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName };
                updateRecord(newAggregatedRecords.biggestBlowout, scoreDifference, blowoutDetails);
                addToAllMatchupData('biggestBlowout', scoreDifference, blowoutDetails);
            }

            // Slimmest Win (smallest positive score difference)
            if (!isTie && scoreDifference > 0) {
                const slimDetails = { ...baseEntryDetails, margin: scoreDifference, winner: winnerName, loser: loserName };
                updateRecord(newAggregatedRecords.slimmestWin, scoreDifference, slimDetails, true);
                addToAllMatchupData('slimmestWin', scoreDifference, slimDetails);
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
                if (a.team && b.team && (key === 'mostPointsScored' || key === 'fewestPointsScored' || key === 'mostPointsInLoss' || key === 'fewestPointsInWin')) {
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
        setAllMatchupData(tempAllMatchupData);

    }, [historicalData, getTeamName, loading, error]);

    // Helper to format values for display
    const formatDisplayValue = (value, recordKey) => {
        // All these keys will have 2 decimal places and commas
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Define the order and labels for the records to display
    const recordsToDisplay = [
        { key: 'mostPointsScored', label: 'Most Points Scored by a Team' },
        { key: 'mostPointsInLoss', label: 'Most Points Scored in a Loss' },
        { key: 'fewestPointsScored', label: 'Fewest Points Scored by a Team' },
        { key: 'fewestPointsInWin', label: 'Fewest Points Scored in a Win' },
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

                    {/* Records Table (mobile-first) */}

                    {/* Mobile: compact card list */}
                    <div className="space-y-3 sm:hidden">
                        {recordsToDisplay.map((recordDef) => {
                            const recordData = aggregatedMatchupRecords[recordDef.key];
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
                            const tiedHolders = recordData.entries.filter(entry => {
                                // Get the value for this entry based on record type
                                if (recordDef.key === 'mostPointsScored' || recordDef.key === 'fewestPointsScored' || 
                                    recordDef.key === 'mostPointsInLoss' || recordDef.key === 'fewestPointsInWin') {
                                    return entry.score === recordValue;
                                } else if (recordDef.key === 'highestCombinedScore' || recordDef.key === 'lowestCombinedScore') {
                                    return entry.combinedScore === recordValue;
                                } else if (recordDef.key === 'biggestBlowout') {
                                    return entry.margin === recordValue;
                                } else if (recordDef.key === 'slimmestWin') {
                                    return entry.margin === recordValue;
                                }
                                return false;
                            });
                            const primary = tiedHolders[0];

                            return (
                                <div key={recordDef.key} className="bg-white border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="text-sm font-semibold text-gray-900">{recordDef.label}</div>
                                            {tiedHolders.length > 0 && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {tiedHolders.map((holder, idx) => (
                                                        <div key={idx} className={idx > 0 ? "mt-2 pt-2 border-t border-gray-100" : ""}>
                                                            {(() => {
                                                                // Show both teams for matchup records - stack vertically for mobile
                                                                if (recordDef.key === 'highestCombinedScore' || recordDef.key === 'lowestCombinedScore') {
                                                                    return (
                                                                        <div>
                                                                            <div className="font-medium">{holder.team1}</div>
                                                                            <div className="text-gray-500">vs {holder.team2}</div>
                                                                            <div className="text-gray-500 mt-1">{holder.year} W{holder.week}</div>
                                                                        </div>
                                                                    );
                                                                } else if (recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin') {
                                                                    return (
                                                                        <div>
                                                                            <div className="font-medium">{holder.winner}</div>
                                                                            <div className="text-gray-500">def {holder.loser}</div>
                                                                            <div className="text-gray-500 mt-1">{holder.year} W{holder.week}</div>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    // Individual team records
                                                                    return (
                                                                        <div>
                                                                            <div className="font-medium">{holder.team}</div>
                                                                            {holder.opponent && <div className="text-gray-500">vs {holder.opponent}</div>}
                                                                            <div className="text-gray-500 mt-1">{holder.year} W{holder.week}</div>
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {primary && (
                                                <div className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-orange-100 to-red-100 border border-orange-200">
                                                    <span className="font-bold text-gray-900 text-sm">{formatDisplayValue(recordData.value, recordDef.key)}</span>
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
                                    {expandedSections[recordDef.key] && allMatchupData[recordDef.key] && allMatchupData[recordDef.key].length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {(() => {
                                                const sortKey = recordDef.key;
                                                const isMinRecord = ['fewestPointsScored', 'fewestPointsInWin', 'lowestCombinedScore', 'slimmestWin'].includes(sortKey);
                                                return allMatchupData[sortKey]
                                                    .sort((a, b) => isMinRecord ? a.value - b.value : b.value - a.value)
                                                    .slice(0, 5)
                                                    .map((matchupData, index) => (
                                                        <div key={`${sortKey}-mobile-${matchupData.year}-${matchupData.week}-${index}`} className="flex items-start justify-between bg-gray-50 rounded-md p-2 border border-gray-100">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold mt-1">{index + 1}</div>
                                                                <div className="text-sm text-gray-900">
                                                                    {(() => {
                                                                        if (sortKey === 'highestCombinedScore' || sortKey === 'lowestCombinedScore') {
                                                                            return (
                                                                                <div>
                                                                                    <div className="font-medium">{matchupData.team1}</div>
                                                                                    <div className="text-gray-500 text-xs">vs {matchupData.team2}</div>
                                                                                    <div className="text-gray-500 text-xs mt-1">{matchupData.year} W{matchupData.week}</div>
                                                                                </div>
                                                                            );
                                                                        } else if (sortKey === 'biggestBlowout' || sortKey === 'slimmestWin') {
                                                                            return (
                                                                                <div>
                                                                                    <div className="font-medium">{matchupData.winner}</div>
                                                                                    <div className="text-gray-500 text-xs">def {matchupData.loser}</div>
                                                                                    <div className="text-gray-500 text-xs mt-1">{matchupData.year} W{matchupData.week}</div>
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            return (
                                                                                <div>
                                                                                    <div className="font-medium">{matchupData.team}</div>
                                                                                    {matchupData.opponent && <div className="text-gray-500 text-xs">vs {matchupData.opponent}</div>}
                                                                                    <div className="text-gray-500 text-xs mt-1">{matchupData.year} W{matchupData.week}</div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-semibold text-gray-900 flex-shrink-0">{matchupData.value.toFixed(2)}</div>
                                                        </div>
                                                ));
                                            })()}
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
                                        Record Type
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
                                const isExpanded = expandedSections[recordDef.key];
                                
                                if (!recordData || recordData.entries.length === 0) {
                                    return (
                                        <React.Fragment key={recordDef.key}>
                                            <tr className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                                <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">{recordDef.label}</span>
                                                    </div>
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
                                        {recordData.entries.map((entry, index) => {
                                            let matchupDisplay;
                                            const team1ScoreFormatted = entry.team1Score.toFixed(2);
                                            const team2ScoreFormatted = entry.team2Score.toFixed(2);
                                            const winnerScore = (entry.winner === entry.team1 ? entry.team1Score : entry.team2Score).toFixed(2);
                                            const loserScore = (entry.loser === entry.team1 ? entry.team1Score : entry.team2Score).toFixed(2);

                                            if (recordDef.key === 'mostPointsScored' || recordDef.key === 'fewestPointsScored' || recordDef.key === 'mostPointsInLoss' || recordDef.key === 'fewestPointsInWin') {
                                                const recordHolder = entry.team;
                                                const recordScore = entry.score.toFixed(2);
                                                const opponent = recordHolder === entry.team1 ? entry.team2 : entry.team1;
                                                const opponentScore = (recordHolder === entry.team1 ? entry.team2Score : entry.team1Score).toFixed(2);

                                                matchupDisplay = (
                                                    <div className="space-y-2">
                                                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-2 sm:p-3 border border-blue-200">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate text-left">{recordHolder}</span>
                                                                    <span className="font-bold text-blue-600 text-xs sm:text-sm text-right">{recordScore}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-700 text-xs sm:text-sm truncate text-left">{opponent}</span>
                                                                    <span className="text-gray-600 text-xs sm:text-sm text-right">{opponentScore}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } else if (recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin') {
                                                matchupDisplay = (
                                                    <div className="space-y-2">
                                                        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-2 sm:p-3 border border-orange-200">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate text-left">{entry.winner}</span>
                                                                    <span className="font-bold text-green-600 text-xs sm:text-sm text-right">{winnerScore}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-700 text-xs sm:text-sm truncate text-left">{entry.loser}</span>
                                                                    <span className="text-gray-600 text-xs sm:text-sm text-right">{loserScore}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                // Combined score records
                                                matchupDisplay = (
                                                    <div className="space-y-2">
                                                        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-2 sm:p-3 border border-green-200">
                                                            <div className="space-y-1">
                                                                {(() => {
                                                                    const team1Top = entry.team1Score >= entry.team2Score;
                                                                    const topTeam = team1Top ? entry.team1 : entry.team2;
                                                                    const topScore = team1Top ? team1ScoreFormatted : team2ScoreFormatted;
                                                                    const bottomTeam = team1Top ? entry.team2 : entry.team1;
                                                                    const bottomScore = team1Top ? team2ScoreFormatted : team1ScoreFormatted;
                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate text-left">{topTeam}</span>
                                                                                <span className="font-bold text-blue-600 text-xs sm:text-sm text-right">{topScore}</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-gray-700 text-xs sm:text-sm truncate text-left">{bottomTeam}</span>
                                                                                <span className="text-gray-600 text-xs sm:text-sm text-right">{bottomScore}</span>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <tr
                                                    key={`${recordDef.key}-${index}`}
                                                    className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                                                >
                                                    <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                        {index === 0 ? (
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
                                                            recordData.entries.length > 1 ? <div className="text-gray-400 text-xs sm:text-sm">• Tied Record</div> : null
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
                                        })}
                                        
                                        {/* Collapsible Top 5 Section */}
                                        {isExpanded && allMatchupData[recordDef.key] && allMatchupData[recordDef.key].length > 0 && (
                                            <tr className={`${recordGroupIndex % 2 === 0 ? 'bg-gray-50' : 'bg-gray-75'}`}>
                                                <td colSpan="5" className="p-0">
                                                    <div className="px-3 py-4 sm:px-6 sm:py-6">
                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                            Top 5 {recordDef.label}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                const sortKey = recordDef.key;
                                                                const isMinRecord = ['fewestPointsScored', 'fewestPointsInWin', 'lowestCombinedScore', 'slimmestWin'].includes(sortKey);
                                                                
                                                                return allMatchupData[sortKey]
                                                                    .sort((a, b) => isMinRecord ? a.value - b.value : b.value - a.value)
                                                                    .slice(0, 5)
                                                                    .map((matchupData, index) => {
                                                                        let displayText = '';
                                                                        
                                                                        if (sortKey === 'mostPointsScored' || sortKey === 'fewestPointsScored') {
                                                                            // Show just the team name; the points are displayed on the right
                                                                            displayText = `${matchupData.team}`;
                                                                        } else if (sortKey === 'mostPointsInLoss' || sortKey === 'fewestPointsInWin') {
                                                                            // Show team vs opponent for loss/win records
                                                                            displayText = matchupData.opponent ? `${matchupData.team} vs ${matchupData.opponent}` : `${matchupData.team}`;
                                                                        } else if (sortKey === 'biggestBlowout' || sortKey === 'slimmestWin') {
                                                                            displayText = `${matchupData.winner} beat ${matchupData.loser} by ${matchupData.value.toFixed(2)} pts`;
                                                                        } else {
                                                                            displayText = `${matchupData.team1} vs ${matchupData.team2}: ${matchupData.value.toFixed(2)} pts combined`;
                                                                        }
                                                                        
                                                                        return (
                                                                            <div key={`${matchupData.year}-${matchupData.week}-${index}`} 
                                                                                 className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <span className="font-medium text-gray-900 text-sm">{displayText}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <span className="font-bold text-gray-900">{matchupData.value.toFixed(2)}</span>
                                                                                    <div className="text-xs text-gray-500">
                                                                                        {matchupData.year} Week {matchupData.week}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
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
                                            <div className="space-y-2">
                                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-2 sm:p-3 border border-blue-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{recordHolder}</span>
                                                            <span className="font-bold text-blue-600 text-xs sm:text-sm">{recordScore}</span>
                                                        </div>
                                                        <span className="text-gray-500 font-medium text-xs sm:text-sm hidden sm:inline">vs</span>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="text-gray-700 text-xs sm:text-sm truncate">{opponent}</span>
                                                            <span className="text-gray-600 text-xs sm:text-sm">{opponentScore}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else if (recordDef.key === 'biggestBlowout' || recordDef.key === 'slimmestWin') {
                                        matchupDisplay = (
                                            <div className="space-y-2">
                                                <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-2 sm:p-3 border border-orange-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{entry.winner}</span>
                                                            <span className="font-bold text-green-600 text-xs sm:text-sm">{winnerScore}</span>
                                                        </div>
                                                        <span className="text-gray-500 font-medium text-xs sm:text-sm hidden sm:inline">vs</span>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="text-gray-700 text-xs sm:text-sm truncate">{entry.loser}</span>
                                                            <span className="text-red-600 text-xs sm:text-sm">{loserScore}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        matchupDisplay = (
                                            <div className="space-y-2">
                                                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-2 sm:p-3 border border-gray-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{entry.team1}</span>
                                                            <span className="font-bold text-blue-600 text-xs sm:text-sm">{team1ScoreFormatted}</span>
                                                        </div>
                                                        <span className="text-gray-500 font-medium text-xs sm:text-sm hidden sm:inline">vs</span>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{entry.team2}</span>
                                                            <span className="font-bold text-blue-600 text-xs sm:text-sm">{team2ScoreFormatted}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <tr
                                            key={`${recordDef.key}-${entry.team1}-${entry.team2}-${entry.year}-${entry.week}-${index}`}
                                            className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                                        >
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                {index === 0 ? (
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                                            {recordDef.label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    recordData.entries.length > 1 ? <div className="text-gray-400 text-xs sm:text-sm">• Tied Record</div> : null
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
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MatchupRecords;