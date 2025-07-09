// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatUtils';

/**
 * Calculates and displays single-season league records based on historical data.
 * @param {Object} props - The component props.
 * @param {Object} props.historicalData - The full historical data object from SleeperDataContext, including seasonalMetrics.
 * @param {Function} props.getTeamName - A function to get the team's display name.
 */
const SeasonRecords = ({ historicalData, getTeamName }) => {
    const [seasonRecords, setSeasonRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Configuration for number formatting per stat (similar to LeagueRecords)
    const formatConfig = {
        highestSingleSeasonPointsFor: { decimals: 2, type: 'points' },
        lowestSingleSeasonPointsFor: { decimals: 2, type: 'points' },
        highestSingleSeasonAverageScore: { decimals: 2, type: 'points' },
        lowestSingleSeasonAverageScore: { decimals: 2, type: 'points' },
        bestSingleSeasonWinPct: { decimals: 3, type: 'percentage' },
        worstSingleSeasonWinPct: { decimals: 3, type: 'percentage' },
        mostSingleSeasonWins: { decimals: 0, type: 'count' },
        fewestSingleSeasonWins: { decimals: 0, type: 'count' }, // For worst record
        mostSingleSeasonLosses: { decimals: 0, type: 'count' },
        fewestSingleSeasonLosses: { decimals: 0, type: 'count' },
        mostSingleSeasonBlowoutWins: { decimals: 0, type: 'count' },
        mostSingleSeasonBlowoutLosses: { decimals: 0, type: 'count' },
        mostSingleSeasonSlimWins: { decimals: 0, type: 'count' },
        mostSingleSeasonSlimLosses: { decimals: 0, type: 'count' },
        highestSingleSeasonDPR: { decimals: 3, type: 'decimal' },
        lowestSingleSeasonDPR: { decimals: 3, type: 'decimal' },
        mostSingleSeasonWeeklyHighScores: { decimals: 0, type: 'count' },
        mostSingleSeasonWeeklyTop2Scores: { decimals: 0, type: 'count' },
        bestSingleSeasonAllPlayWinPct: { decimals: 3, type: 'percentage' },
        worstSingleSeasonAllPlayWinPct: { decimals: 3, type: 'percentage' },
        luckiestSeason: { decimals: 2, type: 'decimal' }, // Luck rating positive means lucky
        unluckiestSeason: { decimals: 2, type: 'decimal' }, // Luck rating negative means unlucky
        highestSingleGameScore: { decimals: 2, type: 'points' },
        lowestSingleGameScore: { decimals: 2, type: 'points' },
    };


    useEffect(() => {
        console.log("SeasonRecords: useEffect triggered for calculation.");
        setIsLoading(true);

        if (!historicalData || !historicalData.seasonalMetrics || Object.keys(historicalData.seasonalMetrics).length === 0) {
            console.log("SeasonRecords: No seasonalMetrics found. Setting records to empty and isLoading false.");
            setSeasonRecords({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics } = historicalData; // Get seasonalMetrics directly

            // --- Initialize Single Season Records with default values ---
            // For highest/most, start with -Infinity. For lowest/fewest, start with Infinity.
            let highestSingleSeasonPointsFor = { value: -Infinity, teams: [], key: 'highestSingleSeasonPointsFor' };
            let lowestSingleSeasonPointsFor = { value: Infinity, teams: [], key: 'lowestSingleSeasonPointsFor' };
            let highestSingleSeasonAverageScore = { value: -Infinity, teams: [], key: 'highestSingleSeasonAverageScore' };
            let lowestSingleSeasonAverageScore = { value: Infinity, teams: [], key: 'lowestSingleSeasonAverageScore' };
            let bestSingleSeasonWinPct = { value: -Infinity, teams: [], key: 'bestSingleSeasonWinPct' };
            let worstSingleSeasonWinPct = { value: Infinity, teams: [], key: 'worstSingleSeasonWinPct' };
            let mostSingleSeasonWins = { value: -Infinity, teams: [], key: 'mostSingleSeasonWins' };
            let fewestSingleSeasonWins = { value: Infinity, teams: [], key: 'fewestSingleSeasonWins' };
            let mostSingleSeasonLosses = { value: -Infinity, teams: [], key: 'mostSingleSeasonLosses' };
            let fewestSingleSeasonLosses = { value: Infinity, teams: [], key: 'fewestSingleSeasonLosses' };
            let mostSingleSeasonBlowoutWins = { value: -Infinity, teams: [], key: 'mostSingleSeasonBlowoutWins' };
            let mostSingleSeasonBlowoutLosses = { value: -Infinity, teams: [], key: 'mostSingleSeasonBlowoutLosses' };
            let mostSingleSeasonSlimWins = { value: -Infinity, teams: [], key: 'mostSingleSeasonSlimWins' };
            let mostSingleSeasonSlimLosses = { value: -Infinity, teams: [], key: 'mostSingleSeasonSlimLosses' };
            let highestSingleSeasonDPR = { value: -Infinity, teams: [], key: 'highestSingleSeasonDPR' };
            let lowestSingleSeasonDPR = { value: Infinity, teams: [], key: 'lowestSingleSeasonDPR' };
            let mostSingleSeasonWeeklyHighScores = { value: -Infinity, teams: [], key: 'mostSingleSeasonWeeklyHighScores' };
            let mostSingleSeasonWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostSingleSeasonWeeklyTop2Scores' };
            let bestSingleSeasonAllPlayWinPct = { value: -Infinity, teams: [], key: 'bestSingleSeasonAllPlayWinPct' };
            let worstSingleSeasonAllPlayWinPct = { value: Infinity, teams: [], key: 'worstSingleSeasonAllPlayWinPct' };
            let luckiestSeason = { value: -Infinity, teams: [], key: 'luckiestSeason' }; // Max positive luck
            let unluckiestSeason = { value: Infinity, teams: [], key: 'unluckiestSeason' }; // Min negative luck
            let highestSingleGameScore = { value: -Infinity, teams: [], key: 'highestSingleGameScore' };
            let lowestSingleGameScore = { value: Infinity, teams: [], key: 'lowestSingleGameScore' };

            // Helper to update records (handles ties)
            const updateRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== -Infinity) {
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== Infinity) {
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            // --- Iterate through each season and then each team's stats for that season ---
            Object.keys(seasonalMetrics).sort().forEach(year => {
                const teamsInSeason = seasonalMetrics[year];
                Object.values(teamsInSeason).forEach(teamStats => {
                    // Ensure the team played games this season to be considered for records
                    if (teamStats.totalGames === 0 && teamStats.pointsFor === 0) {
                        return; // Skip teams with no activity
                    }

                    const teamInfo = {
                        name: getTeamName(teamStats.rosterId, year), // Get team name for the specific year/roster
                        ownerId: teamStats.ownerId,
                        rosterId: teamStats.rosterId,
                        year: year,
                        value: null // Value will be set by updateRecord/updateLowestRecord
                    };

                    // Points For
                    updateRecord(highestSingleSeasonPointsFor, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor });
                    updateLowestRecord(lowestSingleSeasonPointsFor, teamStats.pointsFor, { ...teamInfo, value: teamStats.pointsFor });

                    // Average Score
                    updateRecord(highestSingleSeasonAverageScore, teamStats.averageScore, { ...teamInfo, value: teamStats.averageScore });
                    updateLowestRecord(lowestSingleSeasonAverageScore, teamStats.averageScore, { ...teamInfo, value: teamStats.averageScore });

                    // Win Percentage
                    updateRecord(bestSingleSeasonWinPct, teamStats.winPercentage, { ...teamInfo, value: teamStats.winPercentage });
                    updateLowestRecord(worstSingleSeasonWinPct, teamStats.winPercentage, { ...teamInfo, value: teamStats.winPercentage });

                    // Wins (most & fewest)
                    updateRecord(mostSingleSeasonWins, teamStats.wins, { ...teamInfo, value: teamStats.wins });
                    updateLowestRecord(fewestSingleSeasonWins, teamStats.wins, { ...teamInfo, value: teamStats.wins });

                    // Losses (most & fewest)
                    updateRecord(mostSingleSeasonLosses, teamStats.losses, { ...teamInfo, value: teamStats.losses });
                    updateLowestRecord(fewestSingleSeasonLosses, teamStats.losses, { ...teamInfo, value: teamStats.losses });

                    // Blowout Wins/Losses
                    updateRecord(mostSingleSeasonBlowoutWins, teamStats.blowoutWins, { ...teamInfo, value: teamStats.blowoutWins });
                    updateRecord(mostSingleSeasonBlowoutLosses, teamStats.blowoutLosses, { ...teamInfo, value: teamStats.blowoutLosses });

                    // Slim Wins/Losses
                    updateRecord(mostSingleSeasonSlimWins, teamStats.slimWins, { ...teamInfo, value: teamStats.slimWins });
                    updateRecord(mostSingleSeasonSlimLosses, teamStats.slimLosses, { ...teamInfo, value: teamStats.slimLosses });

                    // DPR
                    if (teamStats.rawDPR !== 0) { // Only consider valid DPRs
                        updateRecord(highestSingleSeasonDPR, teamStats.rawDPR, { ...teamInfo, value: teamStats.rawDPR });
                        updateLowestRecord(lowestSingleSeasonDPR, teamStats.rawDPR, { ...teamInfo, value: teamStats.rawDPR });
                    }

                    // Weekly High Scores / Top 2 Scores
                    updateRecord(mostSingleSeasonWeeklyHighScores, teamStats.topScoreWeeksCount, { ...teamInfo, value: teamStats.topScoreWeeksCount });
                    updateRecord(mostSingleSeasonWeeklyTop2Scores, teamStats.weeklyTop2ScoresCount, { ...teamInfo, value: teamStats.weeklyTop2ScoresCount });

                    // All-Play Win Percentage
                    if (!isNaN(teamStats.allPlayWinPercentage)) {
                        updateRecord(bestSingleSeasonAllPlayWinPct, teamStats.allPlayWinPercentage, { ...teamInfo, value: teamStats.allPlayWinPercentage });
                        updateLowestRecord(worstSingleSeasonAllPlayWinPct, teamStats.allPlayWinPercentage, { ...teamInfo, value: teamStats.allPlayWinPercentage });
                    }

                    // Luck Rating (positive is lucky, negative is unlucky)
                    if (!isNaN(teamStats.luckRating)) {
                        updateRecord(luckiestSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating });
                        updateLowestRecord(unluckiestSeason, teamStats.luckRating, { ...teamInfo, value: teamStats.luckRating });
                    }

                    // Single Game Scores (highest/lowest *across all games in all seasons*)
                    if (teamStats.highScore > highestSingleGameScore.value) {
                        highestSingleGameScore.value = teamStats.highScore;
                        highestSingleGameScore.teams = [{ ...teamInfo, value: teamStats.highScore, year: year }];
                    } else if (teamStats.highScore === highestSingleGameScore.value && teamStats.highScore !== -Infinity) {
                         if (!highestSingleGameScore.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year && t.value === teamStats.highScore)) {
                             highestSingleGameScore.teams.push({ ...teamInfo, value: teamStats.highScore, year: year });
                         }
                    }

                    if (teamStats.lowScore < lowestSingleGameScore.value) {
                        lowestSingleGameScore.value = teamStats.lowScore;
                        lowestSingleGameScore.teams = [{ ...teamInfo, value: teamStats.lowScore, year: year }];
                    } else if (teamStats.lowScore === lowestSingleGameScore.value && teamStats.lowScore !== Infinity) {
                        if (!lowestSingleGameScore.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year && t.value === teamStats.lowScore)) {
                            lowestSingleGameScore.teams.push({ ...teamInfo, value: teamStats.lowScore, year: year });
                        }
                    }

                });
            });

            // Set all records
            setSeasonRecords({
                highestSingleSeasonPointsFor,
                lowestSingleSeasonPointsFor,
                highestSingleSeasonAverageScore,
                lowestSingleSeasonAverageScore,
                bestSingleSeasonWinPct,
                worstSingleSeasonWinPct,
                mostSingleSeasonWins,
                fewestSingleSeasonWins,
                mostSingleSeasonLosses,
                fewestSingleSeasonLosses,
                mostSingleSeasonBlowoutWins,
                mostSingleSeasonBlowoutLosses,
                mostSingleSeasonSlimWins,
                mostSingleSeasonSlimLosses,
                highestSingleSeasonDPR,
                lowestSingleSeasonDPR,
                mostSingleSeasonWeeklyHighScores,
                mostSingleSeasonWeeklyTop2Scores,
                bestSingleSeasonAllPlayWinPct,
                worstSingleSeasonAllPlayWinPct,
                luckiestSeason,
                unluckiestSeason,
                highestSingleGameScore,
                lowestSingleGameScore,
            });

        } catch (error) {
            console.error("Error calculating single-season league records:", error);
            setSeasonRecords({}); // Reset on error
        } finally {
            setIsLoading(false);
        }
    }, [historicalData, getTeamName]);


    if (isLoading) {
        return <div className="text-center py-8">Loading single-season league records...</div>;
    }

    if (Object.keys(seasonRecords).length === 0 || seasonRecords.highestSingleSeasonPointsFor?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate single-season records.</div>;
    }

    // Helper to render a record entry (reused from LeagueRecords, with slight adjustment for year display)
    const renderRecordEntry = (record) => {
        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        if (!record || (record.value === -Infinity && record.key !== 'lowestSingleGameScore' && record.key !== 'lowestSingleSeasonPointsFor' && record.key !== 'lowestSingleSeasonAverageScore' && record.key !== 'lowestSingleSeasonDPR' && record.key !== 'worstSingleSeasonWinPct' && record.key !== 'fewestSingleSeasonWins' && record.key !== 'fewestSingleSeasonLosses' && record.key !== 'worstSingleSeasonAllPlayWinPct' && record.key !== 'unluckiestSeason') ||
            (record.value === Infinity && (record.key === 'lowestSingleGameScore' || record.key === 'lowestSingleSeasonPointsFor' || record.key === 'lowestSingleSeasonAverageScore' || record.key === 'lowestSingleSeasonDPR' || record.key === 'worstSingleSeasonWinPct' || record.key === 'fewestSingleSeasonWins' || record.key === 'fewestSingleSeasonLosses' || record.key === 'worstSingleSeasonAllPlayWinPct' || record.key === 'unluckiestSeason')) ||
            record.teams.length === 0) {
            return (
                <>
                    <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                        {record.key.replace(/([A-Z])/g, ' $1').replace(/Single Season/g, 'Season').replace(/Single Game/g, 'Game').trim()}
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
            // The getTeamName function should correctly handle ownerId/rosterId/year
            if (currentTeamDisplayName.startsWith('Unknown Team (ID:')) {
                if (team.ownerId && team.year) {
                    currentTeamDisplayName = getTeamName(team.ownerId, team.year);
                } else if (team.rosterId && team.year) {
                     currentTeamDisplayName = getTeamName(team.rosterId, team.year);
                }
            }
             if (currentTeamDisplayName.startsWith('Unknown Team (ID:')) {
                currentTeamDisplayName = "Unknown Team"; // Final fallback
            }

            return (
                <div
                    key={`${record.key}-${team.ownerId || team.rosterId || 'unknown'}-${team.year || 'career'}-${index}`}
                    className="leading-tight"
                >
                    {currentTeamDisplayName} ({team.year})
                </div>
            );
        });

        return (
            <>
                <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                    {record.key.replace(/([A-Z])/g, ' $1').replace(/Single Season/g, 'Season').replace(/Single Game/g, 'Game').trim()}
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
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">Single-Season League Records</h2>

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
                                Team (Year)
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(seasonRecords).map(([key, record]) => (
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

export default SeasonRecords;
