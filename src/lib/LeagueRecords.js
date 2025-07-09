// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatUtils';
// import { calculateAllLeagueMetrics } from '../utils/calculations'; // <--- REMOVE THIS IMPORT if it exists

/**
 * Calculates and displays all-time league records based on historical data.
 * This component now expects historicalData.careerDPRData to be pre-calculated.
 * @param {Object} props - The component props.
 * @param {Object} props.historicalData - The full historical data object from SleeperDataContext,
 * which *must* include `careerDPRData` from
 * calculateAllLeagueMetrics.
 * @param {Function} props.getTeamName - A function to get the team's display name.
 */
const LeagueRecords = ({ historicalData, getTeamName }) => { // <--- REMOVE calculateAllLeagueMetrics from here if it was a prop
    const [leagueRecords, setLeagueRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Configuration for number formatting per stat
    const formatConfig = {
        highestCareerPointsFor: { decimals: 2, type: 'points' },
        lowestCareerPointsFor: { decimals: 2, type: 'points' },
        highestCareerAverageScore: { decimals: 2, type: 'points' },
        lowestCareerAverageScore: { decimals: 2, type: 'points' },
        bestCareerWinPct: { decimals: 3, type: 'percentage' },
        worstCareerWinPct: { decimals: 3, type: 'percentage' },
        mostCareerWins: { decimals: 0, type: 'count' },
        fewestCareerWins: { decimals: 0, type: 'count' },
        mostCareerLosses: { decimals: 0, type: 'count' },
        fewestCareerLosses: { decimals: 0, type: 'count' },
        mostCareerBlowoutWins: { decimals: 0, type: 'count' },
        mostCareerBlowoutLosses: { decimals: 0, type: 'count' },
        mostCareerSlimWins: { decimals: 0, type: 'count' },
        mostCareerSlimLosses: { decimals: 0, type: 'count' },
        highestCareerDPR: { decimals: 3, type: 'decimal' },
        lowestCareerDPR: { decimals: 3, type: 'decimal' },
        mostCareerWeeklyHighScores: { decimals: 0, type: 'count' },
        highestSeasonalAvgPoints: { decimals: 2, type: 'points' },
        lowestSeasonalAvgPoints: { decimals: 2, type: 'points' },
        mostCareerWeeklyTop2Scores: { decimals: 0, type: 'count' },
        bestCareerAllPlayWinPct: { decimals: 3, type: 'percentage' },
        worstCareerAllPlayWinPct: { decimals: 3, type: 'percentage' },
        luckiestCareer: { decimals: 2, type: 'decimal' },
        unluckiestCareer: { decimals: 2, type: 'decimal' },
    };

    useEffect(() => {
        console.log("LeagueRecords: useEffect triggered for calculation.");
        setIsLoading(true);

        // Access careerDPRData directly from historicalData
        const careerDPRData = historicalData?.careerDPRData;

        if (!careerDPRData || careerDPRData.length === 0) {
            console.log("LeagueRecords: No careerDPRData found. Setting records to empty and isLoading false.");
            setLeagueRecords({});
            setIsLoading(false);
            return;
        }

        try {
            // Initialize records (similar to SeasonRecords, but for career)
            let highestCareerPointsFor = { value: -Infinity, teams: [], key: 'highestCareerPointsFor' };
            let lowestCareerPointsFor = { value: Infinity, teams: [], key: 'lowestCareerPointsFor' };
            let highestCareerAverageScore = { value: -Infinity, teams: [], key: 'highestCareerAverageScore' };
            let lowestCareerAverageScore = { value: Infinity, teams: [], key: 'lowestCareerAverageScore' };
            let bestCareerWinPct = { value: -Infinity, teams: [], key: 'bestCareerWinPct' };
            let worstCareerWinPct = { value: Infinity, teams: [], key: 'worstCareerWinPct' };
            let mostCareerWins = { value: -Infinity, teams: [], key: 'mostCareerWins' };
            let fewestCareerWins = { value: Infinity, teams: [], key: 'fewestCareerWins' };
            let mostCareerLosses = { value: -Infinity, teams: [], key: 'mostCareerLosses' };
            let fewestCareerLosses = { value: Infinity, teams: [], key: 'fewestCareerLosses' };
            let mostCareerBlowoutWins = { value: -Infinity, teams: [], key: 'mostCareerBlowoutWins' };
            let mostCareerBlowoutLosses = { value: -Infinity, teams: [], key: 'mostCareerBlowoutLosses' };
            let mostCareerSlimWins = { value: -Infinity, teams: [], key: 'mostCareerSlimWins' };
            let mostCareerSlimLosses = { value: -Infinity, teams: [], key: 'mostCareerSlimLosses' };
            let highestCareerDPR = { value: -Infinity, teams: [], key: 'highestCareerDPR' };
            let lowestCareerDPR = { value: Infinity, teams: [], key: 'lowestCareerDPR' };
            let mostCareerWeeklyHighScores = { value: -Infinity, teams: [], key: 'mostCareerWeeklyHighScores' };
            let highestSeasonalAvgPoints = { value: -Infinity, teams: [], key: 'highestSeasonalAvgPoints' };
            let lowestSeasonalAvgPoints = { value: Infinity, teams: [], key: 'lowestSeasonalAvgPoints' };
            let mostCareerWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostCareerWeeklyTop2Scores' };
            let bestCareerAllPlayWinPct = { value: -Infinity, teams: [], key: 'bestCareerAllPlayWinPct' };
            let worstCareerAllPlayWinPct = { value: Infinity, teams: [], key: 'worstCareerAllPlayWinPct' };
            let luckiestCareer = { value: -Infinity, teams: [], key: 'luckiestCareer' };
            let unluckiestCareer = { value: Infinity, teams: [], key: 'unluckiestCareer' };


            // Helper to update records (handles ties) - adapted for ownerId only
            const updateRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== -Infinity) {
                    // Check if team already exists to prevent duplicates for ties
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== Infinity) {
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            careerDPRData.forEach(teamCareerStats => {
                // Ensure team has played games to be considered for records
                if (teamCareerStats.totalGames === 0 && teamCareerStats.pointsFor === 0) {
                    return; // Skip teams with no career activity
                }

                const teamInfo = {
                    name: getTeamName(teamCareerStats.ownerId, null), // Pass null for year to indicate career name
                    ownerId: teamCareerStats.ownerId,
                    value: null // Value will be set by updateRecord/updateLowestRecord
                };

                // Points For
                updateRecord(highestCareerPointsFor, teamCareerStats.pointsFor, { ...teamInfo, value: teamCareerStats.pointsFor });
                updateLowestRecord(lowestCareerPointsFor, teamCareerStats.pointsFor, { ...teamInfo, value: teamCareerStats.pointsFor });

                // Average Score
                updateRecord(highestCareerAverageScore, teamCareerStats.averageScore, { ...teamInfo, value: teamCareerStats.averageScore });
                updateLowestRecord(lowestCareerAverageScore, teamCareerStats.averageScore, { ...teamInfo, value: teamCareerStats.averageScore });

                // Win Percentage
                updateRecord(bestCareerWinPct, teamCareerStats.winPercentage, { ...teamInfo, value: teamCareerStats.winPercentage });
                updateLowestRecord(worstCareerWinPct, teamCareerStats.winPercentage, { ...teamInfo, value: teamCareerStats.winPercentage });

                // Wins (most & fewest)
                updateRecord(mostCareerWins, teamCareerStats.wins, { ...teamInfo, value: teamCareerStats.wins });
                updateLowestRecord(fewestCareerWins, teamCareerStats.wins, { ...teamInfo, value: teamCareerStats.wins });

                // Losses (most & fewest)
                updateRecord(mostCareerLosses, teamCareerStats.losses, { ...teamInfo, value: teamCareerStats.losses });
                updateLowestRecord(fewestCareerLosses, teamCareerStats.losses, { ...teamInfo, value: teamCareerStats.losses });

                // Blowout Wins/Losses
                updateRecord(mostCareerBlowoutWins, teamCareerStats.blowoutWins, { ...teamInfo, value: teamCareerStats.blowoutWins });
                updateRecord(mostCareerBlowoutLosses, teamCareerStats.blowoutLosses, { ...teamInfo, value: teamCareerStats.blowoutLosses });

                // Slim Wins/Losses
                updateRecord(mostCareerSlimWins, teamCareerStats.slimWins, { ...teamInfo, value: teamCareerStats.slimWins });
                updateRecord(mostCareerSlimLosses, teamCareerStats.slimLosses, { ...teamInfo, value: teamCareerStats.slimLosses });

                // DPR
                if (teamCareerStats.dpr !== 0) { // dpr is already adjusted and can be 0. We want to skip only true zero/invalid cases.
                    updateRecord(highestCareerDPR, teamCareerStats.dpr, { ...teamInfo, value: teamCareerStats.dpr });
                    updateLowestRecord(lowestCareerDPR, teamCareerStats.dpr, { ...teamInfo, value: teamCareerStats.dpr });
                }

                // Weekly High Scores / Top 2 Scores
                updateRecord(mostCareerWeeklyHighScores, teamCareerStats.topScoreWeeksCount, { ...teamInfo, value: teamCareerStats.topScoreWeeksCount });
                updateRecord(mostCareerWeeklyTop2Scores, teamCareerStats.weeklyTop2ScoresCount, { ...teamInfo, value: teamCareerStats.weeklyTop2ScoresCount });


                // Highest/Lowest Seasonal Average Points (from career stats)
                if (teamCareerStats.highestSeasonalPointsAvg !== 0) { // 0 is default if no seasons played
                    updateRecord(highestSeasonalAvgPoints, teamCareerStats.highestSeasonalPointsAvg, { ...teamInfo, value: teamCareerStats.highestSeasonalPointsAvg });
                }
                 if (teamCareerStats.lowestSeasonalPointsAvg !== 0) { // 0 is default if no seasons played, but infinity might also be set.
                    updateLowestRecord(lowestSeasonalAvgPoints, teamCareerStats.lowestSeasonalPointsAvg, { ...teamInfo, value: teamCareerStats.lowestSeasonalPointsAvg });
                }

                // All-Play Win Percentage
                if (!isNaN(teamCareerStats.allPlayWinPercentage)) {
                    updateRecord(bestCareerAllPlayWinPct, teamCareerStats.allPlayWinPercentage, { ...teamInfo, value: teamCareerStats.allPlayWinPercentage });
                    updateLowestRecord(worstCareerAllPlayWinPct, teamCareerStats.allPlayWinPercentage, { ...teamInfo, value: teamCareerStats.allPlayWinPercentage });
                }

                // Luck Rating (positive is lucky, negative is unlucky)
                if (!isNaN(teamCareerStats.totalLuckRating)) {
                    updateRecord(luckiestCareer, teamCareerStats.totalLuckRating, { ...teamInfo, value: teamCareerStats.totalLuckRating });
                    updateLowestRecord(unluckiestCareer, teamCareerStats.totalLuckRating, { ...teamInfo, value: teamCareerStats.totalLuckRating });
                }
            });

            setLeagueRecords({
                highestCareerPointsFor,
                lowestCareerPointsFor,
                highestCareerAverageScore,
                lowestCareerAverageScore,
                bestCareerWinPct,
                worstCareerWinPct,
                mostCareerWins,
                fewestCareerWins,
                mostCareerLosses,
                fewestCareerLosses,
                mostCareerBlowoutWins,
                mostCareerBlowoutLosses,
                mostCareerSlimWins,
                mostCareerSlimLosses,
                highestCareerDPR,
                lowestCareerDPR,
                mostCareerWeeklyHighScores,
                highestSeasonalAvgPoints,
                lowestSeasonalAvgPoints,
                mostCareerWeeklyTop2Scores,
                bestCareerAllPlayWinPct,
                worstCareerAllPlayWinPct,
                luckiestCareer,
                unluckiestCareer,
            });

        } catch (error) {
            console.error("Error calculating league records:", error);
            setLeagueRecords({}); // Reset on error
        } finally {
            setIsLoading(false);
        }
    }, [historicalData, getTeamName]); // Dependency array: Recalculate if historicalData or getTeamName changes

    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(leagueRecords).length === 0 || leagueRecords.highestCareerPointsFor?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    // Helper to render a record entry
    const renderRecordEntry = (record) => {
        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        // Handle cases where no valid record was found (e.g., -Infinity, Infinity, or empty teams array)
        const isInvalidOrNoData =
            !record ||
            (record.value === -Infinity && !(
                record.key === 'lowestCareerPointsFor' ||
                record.key === 'lowestCareerAverageScore' ||
                record.key === 'lowestCareerDPR' ||
                record.key === 'worstCareerWinPct' ||
                record.key === 'fewestCareerWins' ||
                record.key === 'fewestCareerLosses' ||
                record.key === 'worstCareerAllPlayWinPct' ||
                record.key === 'unluckiestCareer' ||
                record.key === 'lowestSeasonalAvgPoints'
            )) ||
            (record.value === Infinity && (
                record.key === 'lowestCareerPointsFor' ||
                record.key === 'lowestCareerAverageScore' ||
                record.key === 'lowestCareerDPR' ||
                record.key === 'worstCareerWinPct' ||
                record.key === 'fewestCareerWins' ||
                record.key === 'fewestCareerLosses' ||
                record.key === 'worstCareerAllPlayWinPct' ||
                record.key === 'unluckiestCareer' ||
                record.key === 'lowestSeasonalAvgPoints'
            )) ||
            record.teams.length === 0;

        if (isInvalidOrNoData) {
            return (
                <>
                    <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                        {record.key.replace(/([A-Z])/g, ' $1').replace(/Career/g, 'All-Time').replace(/Seasonal/g, 'Season').trim()}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-500">N/A</td>
                    <td className="py-2 px-4 text-right text-gray-500"></td>
                </>
            );
        }

        let displayValue;
        if (config.type === 'percentage') {
            displayValue = formatNumber(record.teams[0].value, config.decimals, 'decimal') + '%';
        } else {
            displayValue = formatNumber(record.teams[0].value, config.decimals, config.type);
        }

        const allTiedTeamsDisplay = record.teams.map((team, index) => {
            let currentTeamDisplayName = team.name;
            if (currentTeamDisplayName.startsWith('Unknown Team (ID:')) {
                // Try to get the name via ownerId if it's available
                if (team.ownerId) {
                    currentTeamDisplayName = getTeamName(team.ownerId, null); // Pass null for career name
                }
            }
             if (currentTeamDisplayName.startsWith('Unknown Team (ID:')) {
                currentTeamDisplayName = "Unknown Team"; // Final fallback
            }

            return (
                <div
                    key={`${record.key}-${team.ownerId || 'unknown'}-${index}`}
                    className="leading-tight"
                >
                    {currentTeamDisplayName}
                </div>
            );
        });

        return (
            <>
                <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                    {record.key.replace(/([A-Z])/g, ' $1').replace(/Career/g, 'All-Time').replace(/Seasonal/g, 'Season').trim()}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-lg">{displayValue}</td>
                <td className="py-2 px-4 text-right text-gray-700">
                    {allTiedTeamsDisplay}
                </td>
            </>
        );
    };

    return (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">All-Time League Records</h2>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Stat
                            </th>
                            <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Value
                            </th>
                            <th scope="col" className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Team
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(leagueRecords).map(([key, record]) => (
                            <tr key={key}>
                                {renderRecordEntry({ ...record, key: key })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeagueRecords;
