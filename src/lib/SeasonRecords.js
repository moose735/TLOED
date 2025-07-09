// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';

// calculateAllLeagueMetrics and getTeamName will be passed as props from RecordBook.js
// This component should NOT import calculateAllLeagueMetrics or rely on internal data structure
// Instead, it receives the already processed seasonalMetrics.

const SeasonRecords = ({ historicalData, getTeamName, calculateAllLeagueMetrics }) => {
    // State to hold the calculated best/worst individual season records
    const [highestDPRSeasonRecord, setHighestDPRSeasonRecord] = useState(null);
    const [lowestDPRSeasonRecord, setLowestDPRSeasonRecord] = useState(null);
    const [mostWinsSeasonRecord, setMostWinsSeasonRecord] = useState(null);
    const [mostLossesSeasonRecord, setMostLossesSeasonRecord] = useState(null);
    const [bestAllPlayWinPctSeasonRecord, setBestAllPlayWinPctSeasonRecord] = useState(null);
    const [mostWeeklyHighScoresSeasonRecord, setMostWeeklyHighScoresSeasonRecord] = useState(null);
    const [mostWeeklyTop2ScoresSeasonRecord, setMostWeeklyTop2ScoresSeasonRecord] = useState(null); // Corrected to Top2
    const [mostBlowoutWinsSeasonRecord, setMostBlowoutWinsSeasonRecord] = useState(null);
    const [mostBlowoutLossesSeasonRecord, setMostBlowoutLossesSeasonRecord] = useState(null);
    const [mostSlimWinsSeasonRecord, setMostSlimWinsSeasonRecord] = useState(null);
    const [mostSlimLossesSeasonRecord, setMostSlimLossesSeasonRecord] = useState(null);
    const [mostPointsSeasonRecord, setMostPointsSeasonRecord] = useState(null);
    const [fewestPointsSeasonRecord, setFewestPointsSeasonRecord] = useState(null);
    const [mostLuckSeasonRecord, setMostLuckSeasonRecord] = useState(null); // Added luck record
    const [leastLuckSeasonRecord, setLeastLuckSeasonRecord] = useState(null); // Added luck record


    useEffect(() => {
        if (!historicalData || Object.keys(historicalData).length === 0 || !getTeamName || !calculateAllLeagueMetrics) {
            // Reset all records if data or functions are missing
            setHighestDPRSeasonRecord(null);
            setLowestDPRSeasonRecord(null);
            setMostWinsSeasonRecord(null);
            setMostLossesSeasonRecord(null);
            setBestAllPlayWinPctSeasonRecord(null);
            setMostWeeklyHighScoresSeasonRecord(null);
            setMostWeeklyTop2ScoresSeasonRecord(null);
            setMostBlowoutWinsSeasonRecord(null);
            setMostBlowoutLossesSeasonRecord(null);
            setMostSlimWinsSeasonRecord(null);
            setMostSlimLossesSeasonRecord(null);
            setMostPointsSeasonRecord(null);
            setFewestPointsSeasonRecord(null);
            setMostLuckSeasonRecord(null);
            setLeastLuckSeasonRecord(null);
            return;
        }

        // Use the centralized calculation logic to get all metrics
        const { seasonalMetrics } = calculateAllLeagueMetrics(historicalData, getTeamName);

        // Initialize objects to hold the best/worst records for each category
        let currentHighestDPRSeason = { value: -Infinity, entries: [] };
        let currentLowestDPRSeason = { value: Infinity, entries: [] };
        let currentMostWinsSeason = { value: 0, entries: [] };
        let currentMostLossesSeason = { value: 0, entries: [] };
        let currentBestAllPlayWinPctSeason = { value: 0, entries: [] };
        let currentMostWeeklyHighScoresSeason = { value: 0, entries: [] };
        let currentMostWeeklyTop2ScoresSeason = { value: 0, entries: [] };
        let currentMostBlowoutWinsSeason = { value: 0, entries: [] };
        let currentMostBlowoutLossesSeason = { value: 0, entries: [] };
        let currentMostSlimWinsSeason = { value: 0, entries: [] };
        let currentMostSlimLossesSeason = { value: 0, entries: [] };
        let currentMostPointsSeason = { value: 0, entries: [] };
        let currentFewestPointsSeason = { value: Infinity, entries: [] };
        let currentMostLuckSeason = { value: -Infinity, entries: [] };
        let currentLeastLuckSeason = { value: Infinity, entries: [] };


        // Helper for finding top/bottom records, now includes a 'valueKey' for flexible access
        const updateRecord = (recordObj, teamStats, valueKey, entryDetails, isMin = false) => {
            const newValue = teamStats[valueKey];

            // Handle cases where value might be N/A or not a number (e.g., if totalGames is 0)
            if (typeof newValue !== 'number' || isNaN(newValue) || (teamStats.totalGames === 0 && !['luckRating'].includes(valueKey))) {
                return; // Skip if value is not a valid number or no games played for most stats
            }

            if (isMin) {
                if (newValue < recordObj.value) {
                    recordObj.value = newValue;
                    recordObj.entries = [{ ...entryDetails, value: newValue }];
                } else if (newValue === recordObj.value) {
                    recordObj.entries.push({ ...entryDetails, value: newValue });
                }
            } else {
                if (newValue > recordObj.value) {
                    recordObj.value = newValue;
                    recordObj.entries = [{ ...entryDetails, value: newValue }];
                } else if (newValue === recordObj.value) {
                    recordObj.entries.push({ ...entryDetails, value: newValue });
                }
            }
        };


        // Iterate through all seasonal metrics to find the best/worst
        Object.keys(seasonalMetrics).forEach(year => {
            Object.values(seasonalMetrics[year]).forEach(teamStats => {
                // Ensure teamStats has enough data (e.g., played at least one game)
                if (teamStats.totalGames > 0) { // Most records require games played
                    const teamName = teamStats.teamName; // Already resolved by calculateAllLeagueMetrics

                    // Individual season record entry details
                    const entryDetails = {
                        team: teamName,
                        year: parseInt(year),
                        ownerId: teamStats.ownerId,
                        rosterId: teamStats.rosterId, // Keep for potential future use or debugging
                    };

                    updateRecord(currentHighestDPRSeason, teamStats, 'adjustedDPR', entryDetails);
                    updateRecord(currentLowestDPRSeason, teamStats, 'adjustedDPR', entryDetails, true);
                    updateRecord(currentMostWinsSeason, teamStats, 'wins', entryDetails);
                    updateRecord(currentMostLossesSeason, teamStats, 'losses', entryDetails);
                    updateRecord(currentBestAllPlayWinPctSeason, teamStats, 'allPlayWinPercentage', entryDetails);
                    updateRecord(currentMostWeeklyHighScoresSeason, teamStats, 'topScoreWeeksCount', entryDetails); // Aligned with 'topScoreWeeksCount'
                    updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats, 'weeklyTop2ScoresCount', entryDetails); // Aligned with 'weeklyTop2ScoresCount'
                    updateRecord(currentMostBlowoutWinsSeason, teamStats, 'blowoutWins', entryDetails);
                    updateRecord(currentMostBlowoutLossesSeason, teamStats, 'blowoutLosses', entryDetails);
                    updateRecord(currentMostSlimWinsSeason, teamStats, 'slimWins', entryDetails);
                    updateRecord(currentMostSlimLossesSeason, teamStats, 'slimLosses', entryDetails);
                    updateRecord(currentMostPointsSeason, teamStats, 'pointsFor', entryDetails);
                    updateRecord(currentFewestPointsSeason, teamStats, 'pointsFor', entryDetails, true);
                    updateRecord(currentMostLuckSeason, teamStats, 'luckRating', entryDetails);
                    updateRecord(currentLeastLuckSeason, teamStats, 'luckRating', entryDetails, true);

                }
            });
        });

        // Final sorting for all-time record entries if there are ties
        const sortRecordEntries = (record) => {
            if (record && record.entries.length > 1) {
                record.entries.sort((a, b) => {
                    // Sort by year, then by team name for consistent display of ties
                    if (a.year !== b.year) return a.year - b.year;
                    return (a.team || '').localeCompare(b.team || '');
                });
            }
        };

        sortRecordEntries(currentHighestDPRSeason);
        sortRecordEntries(currentLowestDPRSeason);
        sortRecordEntries(currentMostWinsSeason);
        sortRecordEntries(currentMostLossesSeason);
        sortRecordEntries(currentBestAllPlayWinPctSeason);
        sortRecordEntries(currentMostWeeklyHighScoresSeason);
        sortRecordEntries(currentMostWeeklyTop2ScoresSeason); // Corrected
        sortRecordEntries(currentMostBlowoutWinsSeason);
        sortRecordEntries(currentMostBlowoutLossesSeason);
        sortRecordEntries(currentMostSlimWinsSeason);
        sortRecordEntries(currentMostSlimLossesSeason);
        sortRecordEntries(currentMostPointsSeason);
        sortRecordEntries(currentFewestPointsSeason);
        sortRecordEntries(currentMostLuckSeason);
        sortRecordEntries(currentLeastLuckSeason);


        // Update state with the found records
        setHighestDPRSeasonRecord(currentHighestDPRSeason);
        setLowestDPRSeasonRecord(currentLowestDPRSeason);
        setMostWinsSeasonRecord(currentMostWinsSeason);
        setMostLossesSeasonRecord(currentMostLossesSeason);
        setBestAllPlayWinPctSeasonRecord(currentBestAllPlayWinPctSeason);
        setMostWeeklyHighScoresSeasonRecord(currentMostWeeklyHighScoresSeason);
        setMostWeeklyTop2ScoresSeasonRecord(currentMostWeeklyTop2ScoresSeason); // Corrected
        setMostBlowoutWinsSeasonRecord(currentMostBlowoutWinsSeason);
        setMostBlowoutLossesSeasonRecord(currentMostBlowoutLossesSeason);
        setMostSlimWinsSeasonRecord(currentMostSlimWinsSeason);
        setMostSlimLossesSeasonRecord(currentMostSlimLossesSeason);
        setMostPointsSeasonRecord(currentMostPointsSeason);
        setFewestPointsSeasonRecord(currentFewestPointsSeason);
        setMostLuckSeasonRecord(currentMostLuckSeason);
        setLeastLuckSeasonRecord(currentLeastLuckSeason);


    }, [historicalData, getTeamName, calculateAllLeagueMetrics]); // Dependencies updated

    // Helper to render record (W-L-T) - not used for seasonal records directly
    // const renderRecord = (record) => {
    //     if (!record) return '0-0-0';
    //     return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
    // };

    const formatDPR = (dprValue) => {
        if (typeof dprValue === 'number' && !isNaN(dprValue)) {
            return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        return 'N/A';
    };

    const formatPercentage = (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
            return `${(value * 100).toFixed(1)}%`;
        }
        return 'N/A';
    };

    const formatPoints = (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return 'N/A';
    };

    const formatLuck = (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
            const sign = value > 0 ? '+' : '';
            return `${sign}${value.toFixed(2)}`;
        }
        return 'N/A';
    };

    const renderSingleRecordEntry = (recordItem, label, formatFn = val => val) => {
        if (!recordItem || recordItem.entries.length === 0 || (typeof recordItem.value === 'number' && (recordItem.value === -Infinity || recordItem.value === Infinity))) {
            return (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                    <td className="py-2 px-3 text-sm font-semibold text-gray-800">{label}</td>
                    <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                </tr>
            );
        }
        return (
            <tr className={`border-b border-gray-100 last:border-b-0`}>
                <td className="py-2 px-3 text-sm font-semibold text-gray-800">{label}</td>
                <td className="py-2 px-3 text-sm text-gray-800">{formatFn(recordItem.value)}</td>
                <td className="py-2 px-3 text-sm text-gray-700">
                    {recordItem.entries.map((entry, idx) => (
                        <div key={idx}>{entry.team} ({entry.year})</div>
                    ))}
                </td>
            </tr>
        );
    };

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS - ( SEASON )</h3>
            <p className="text-sm text-gray-600 mb-6">Team performance records calculated per season.</p>

            {/* All Season Records, including DPR Highlights */}
            {(highestDPRSeasonRecord?.entries.length > 0 || lowestDPRSeasonRecord?.entries.length > 0 ||
                mostWinsSeasonRecord?.entries.length > 0 ||
                mostLossesSeasonRecord?.entries.length > 0 ||
                bestAllPlayWinPctSeasonRecord?.entries.length > 0 ||
                mostWeeklyHighScoresSeasonRecord?.entries.length > 0 ||
                mostWeeklyTop2ScoresSeasonRecord?.entries.length > 0 || // Corrected
                mostBlowoutWinsSeasonRecord?.entries.length > 0 ||
                mostBlowoutLossesSeasonRecord?.entries.length > 0 ||
                mostSlimWinsSeasonRecord?.entries.length > 0 ||
                mostSlimLossesSeasonRecord?.entries.length > 0 ||
                mostPointsSeasonRecord?.entries.length > 0 ||
                fewestPointsSeasonRecord?.entries.length > 0 ||
                mostLuckSeasonRecord?.entries.length > 0 ||
                leastLuckSeasonRecord?.entries.length > 0
                ) ? (
                <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-800 mb-3">Season Records Highlights</h4>
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
                        <tbody>
                            {renderSingleRecordEntry(highestDPRSeasonRecord, 'Highest Adjusted DPR', formatDPR)}
                            {renderSingleRecordEntry(lowestDPRSeasonRecord, 'Lowest Adjusted DPR', formatDPR)}
                            {renderSingleRecordEntry(mostWinsSeasonRecord, 'Most Wins')}
                            {renderSingleRecordEntry(mostLossesSeasonRecord, 'Most Losses')}
                            {renderSingleRecordEntry(bestAllPlayWinPctSeasonRecord, 'Best All-Play Win %', formatPercentage)}
                            {renderSingleRecordEntry(mostWeeklyHighScoresSeasonRecord, 'Most Weekly High Scores')}
                            {renderSingleRecordEntry(mostWeeklyTop2ScoresSeasonRecord, 'Most Weekly Top 2 Scores')} {/* Corrected */}
                            {renderSingleRecordEntry(mostBlowoutWinsSeasonRecord, 'Most Blowout Wins')}
                            {renderSingleRecordEntry(mostBlowoutLossesSeasonRecord, 'Most Blowout Losses')}
                            {renderSingleRecordEntry(mostSlimWinsSeasonRecord, 'Most Slim Wins')}
                            {renderSingleRecordEntry(mostSlimLossesSeasonRecord, 'Most Slim Losses')}
                            {renderSingleRecordEntry(mostPointsSeasonRecord, 'Most Points', formatPoints)}
                            {renderSingleRecordEntry(fewestPointsSeasonRecord, 'Fewest Points', formatPoints)}
                            {renderSingleRecordEntry(mostLuckSeasonRecord, 'Most Luck (Wins - Expected Wins)', formatLuck)}
                            {renderSingleRecordEntry(leastLuckSeasonRecord, 'Least Luck (Wins - Expected Wins)', formatLuck)}
                        </tbody>
                    </table>
                </section>
            ) : (
                <p className="text-center text-gray-600">No season records available to display.</p>
            )}
        </div>
    );
};

export default SeasonRecords;
