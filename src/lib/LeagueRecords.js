import React, { useState, useEffect, useCallback } from 'react';
import { formatNumber } from '../utils/formatUtils';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import useSleeperData hook
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import directly

/**
 * Calculates and displays all-time league records based on historical data.
 * @param {Object} props - The component props.
 * @param {Object} props.historicalData - The full historical data object from SleeperDataContext.
 * @param {Function} props.getTeamName - A function to get the team's display name.
 */
// Removed calculateAllLeagueMetrics from props as it's now imported directly
const LeagueRecords = () => {
    // Consume necessary data from context
    const { historicalData, allDraftHistory, getTeamName, loading, error } = useSleeperData();

    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Configuration for number formatting per stat
    const formatConfig = {
        highestDPR: { decimals: 3, type: 'decimal' },
        lowestDPR: { decimals: 3, type: 'decimal' },
        mostWins: { decimals: 0, type: 'count' },
        mostLosses: { decimals: 0, type: 'count' },
        bestWinPct: { decimals: 3, type: 'percentage' },
        bestAllPlayWinPct: { decimals: 3, type: 'percentage' },
        mostWeeklyHighScores: { decimals: 0, type: 'count' },
        mostWeeklyTop2Scores: { decimals: 0, type: 'count' },
        mostWinningSeasons: { decimals: 0, type: 'count' },
        mostLosingSeasons: { decimals: 0, type: 'count' },
        mostBlowoutWins: { decimals: 0, type: 'count' },
        mostBlowoutLosses: { decimals: 0, type: 'count' },
        mostSlimWins: { decimals: 0, type: 'count' },
        mostSlimLosses: { decimals: 0, type: 'count' },
        mostTotalPoints: { decimals: 2, type: 'points' },
        mostPointsAgainst: { decimals: 2, type: 'points' },
    };

    useEffect(() => {
        console.log("LeagueRecords: useEffect triggered for calculation.");
        setIsLoading(true);

        // Check for overall loading state from context
        if (loading) {
            console.log("LeagueRecords: Context is still loading. Waiting for data.");
            return;
        }

        if (error) {
            console.error("LeagueRecords: Error from context:", error);
            setAllTimeRecords({});
            setIsLoading(false);
            return;
        }

        if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            console.log("LeagueRecords: No historicalData or matchups. Setting records to empty and isLoading false.");
            setAllTimeRecords({});
            setIsLoading(false);
            return;
        }

        try {
            // FIXED: Pass all three required arguments to calculateAllLeagueMetrics
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName);
            console.log("LeagueRecords: Raw seasonalMetrics from calculations.js:", seasonalMetrics);
            console.log("LeagueRecords: Raw careerDPRData from calculations.js (enhanced):", calculatedCareerDPRs);

            // --- Initialize All-Time Records with default values ---
            let highestDPR = { value: -Infinity, teams: [], key: 'highestDPR' };
            let lowestDPR = { value: Infinity, teams: [], key: 'lowestDPR' };
            let mostWins = { value: -Infinity, teams: [], key: 'mostWins' };
            let mostLosses = { value: -Infinity, teams: [], key: 'mostLosses' };
            let bestWinPct = { value: -Infinity, teams: [], key: 'bestWinPct' };
            let bestAllPlayWinPct = { value: -Infinity, teams: [], key: 'bestAllPlayWinPct' };
            let mostWeeklyHighScores = { value: -Infinity, teams: [], key: 'mostWeeklyHighScores' };
            let mostWinningSeasons = { value: -Infinity, teams: [], key: 'mostWinningSeasons' };
            let mostLosingSeasons = { value: -Infinity, teams: [], key: 'mostLosingSeasons' };
            let mostBlowoutWins = { value: -Infinity, teams: [], key: 'mostBlowoutWins' };
            let mostBlowoutLosses = { value: -Infinity, teams: [], key: 'mostBlowoutLosses' };
            let mostSlimWins = { value: -Infinity, teams: [], key: 'mostSlimWins' };
            let mostSlimLosses = { value: -Infinity, teams: [], key: 'mostSlimLosses' };
            let mostTotalPoints = { value: -Infinity, teams: [], key: 'mostTotalPoints' };
            let mostPointsAgainst = { value: -Infinity, teams: [], key: 'mostPointsAgainst' };
            let mostWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostWeeklyTop2Scores' };


            // Helper to update records (handles ties)
            const updateRecord = (currentRecord, newValue, teamInfo) => {
                // Ensure teamInfo has ownerId for lookup later
                if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
                    // Try to derive ownerId from rosterId if not directly provided
                    const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
                    if (rosterMap) {
                        teamInfo.ownerId = rosterMap.owner_id;
                    }
                }

                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== -Infinity) {
                    // Check for existing team info to avoid duplicates in ties
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
                // Ensure teamInfo has ownerId for lookup later
                if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
                    const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
                    if (rosterMap) {
                        teamInfo.ownerId = rosterMap.owner_id;
                    }
                }

                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== Infinity) {
                    if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            // --- Process Career DPR Data for All-Time Records ---
            // This is where you should primarily get your career totals
            calculatedCareerDPRs.forEach(careerStats => {
                const teamName = careerStats.teamName;
                const ownerId = careerStats.ownerId;

                if (careerStats.dpr !== 0) { // Exclude teams with 0 games/0 DPR
                    updateRecord(highestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
                    updateLowestRecord(lowestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
                }

                if (careerStats.totalGames > 0) {
                    updateRecord(mostWins, careerStats.wins, { name: teamName, value: careerStats.wins, ownerId: ownerId });
                    updateRecord(mostLosses, careerStats.losses, { name: teamName, value: careerStats.losses, ownerId: ownerId });
                    updateRecord(bestWinPct, careerStats.winPercentage, { name: teamName, value: careerStats.winPercentage, ownerId: ownerId });
                    updateRecord(mostTotalPoints, careerStats.pointsFor, { name: teamName, value: careerStats.pointsFor, ownerId: ownerId });
                    updateRecord(mostPointsAgainst, careerStats.pointsAgainst, { name: teamName, value: careerStats.pointsAgainst, ownerId: ownerId });

                    // Use the already calculated career totals for these stats!
                    updateRecord(mostBlowoutWins, careerStats.blowoutWins, { name: teamName, value: careerStats.blowoutWins, ownerId: ownerId });
                    updateRecord(mostBlowoutLosses, careerStats.blowoutLosses, { name: teamName, value: careerStats.blowoutLosses, ownerId: ownerId });
                    updateRecord(mostSlimWins, careerStats.slimWins, { name: teamName, value: careerStats.slimWins, ownerId: ownerId });
                    updateRecord(mostSlimLosses, careerStats.slimLosses, { name: teamName, value: careerStats.slimLosses, ownerId: ownerId });
                    updateRecord(mostWeeklyTop2Scores, careerStats.weeklyTop2ScoresCount, { name: teamName, value: careerStats.weeklyTop2ScoresCount, ownerId: ownerId });
                    updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: teamName, value: careerStats.topScoreWeeksCount, ownerId: ownerId });

                    // All Play Win Percentage is also a career stat now
                    updateRecord(bestAllPlayWinPct, careerStats.allPlayWinPercentage, { name: teamName, value: careerStats.allPlayWinPercentage, ownerId: ownerId });
                }

                // Aggregate winning/losing seasons (this logic is fine here as it aggregates seasonal data)
                let winningSeasonsCount = 0;
                let losingSeasonsCount = 0;

                Object.keys(seasonalMetrics).forEach(year => {
                    const teamsInSeason = Object.values(seasonalMetrics[year]);
                    const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                    if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                        // Assuming a winning season is > 0.5 win percentage, losing < 0.5. Ties (0.5) are neither.
                        if (currentOwnerTeamInSeason.winPercentage > 0.5) {
                            winningSeasonsCount++;
                        } else if (currentOwnerTeamInSeason.winPercentage < 0.5) {
                            losingSeasonsCount++;
                        }
                    }
                });
                updateRecord(mostWinningSeasons, winningSeasonsCount, { name: teamName, value: winningSeasonsCount, ownerId: ownerId });
                updateRecord(mostLosingSeasons, losingSeasonsCount, { name: teamName, value: losingSeasonsCount, ownerId: ownerId });
            });

            // Set all records
            setAllTimeRecords({
                highestDPR,
                lowestDPR,
                mostWins,
                mostLosses,
                bestWinPct,
                bestAllPlayWinPct,
                mostWeeklyHighScores,
                mostWeeklyTop2Scores,
                mostWinningSeasons,
                mostLosingSeasons,
                mostBlowoutWins,
                mostBlowoutLosses,
                mostSlimWins,
                mostSlimLosses,
                mostTotalPoints,
                mostPointsAgainst,
            });

        } catch (error) {
            console.error("Error calculating league records:", error);
            setAllTimeRecords({}); // Reset on error
        } finally {
            setIsLoading(false);
        }
    }, [historicalData, allDraftHistory, getTeamName, loading, error]); // Add allDraftHistory, loading, error to dependencies


    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    // Helper to render a record entry
    const renderRecordEntry = (record) => {
        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        if (!record || record.value === -Infinity || record.value === Infinity || record.teams.length === 0) {
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

        // Determine the display value based on config type
        let displayValue;
        if (config.type === 'percentage') {
            // Corrected: formatNumber gives "0.XXX", no extra dot needed
            displayValue = formatNumber(record.teams[0].value, config.decimals, 'decimal') + '%';
        } else {
            // Keep existing logic for other types (DPR, points, count)
            displayValue = formatNumber(record.teams[0].value, config.decimals, config.type);
        }

        // Logic for displaying all tied teams vertically
        const allTiedTeamsDisplay = record.teams.map((team, index) => {
            let currentTeamDisplayName = team.name;
            // The getTeamName function in context should handle the ownerId/year lookup
            // We pass the ownerId and year (if available) to get the most accurate name.
            if (team.ownerId) {
                currentTeamDisplayName = getTeamName(team.ownerId, team.year || null);
            } else if (team.rosterId && team.year) {
                // If only rosterId and year are available, try to get ownerId from historicalData
                const rosterForYear = historicalData.rostersBySeason?.[team.year]?.find(r => String(r.roster_id) === String(team.rosterId));
                if (rosterForYear?.owner_id) {
                    currentTeamDisplayName = getTeamName(rosterForYear.owner_id, team.year);
                } else {
                    currentTeamDisplayName = `Unknown Team (Roster: ${team.rosterId})`;
                }
            }

            // Fallback for any remaining "Unknown Team (ID:..." if getTeamName couldn't resolve
            if (currentTeamDisplayName.startsWith('Unknown Team (ID:')) {
                currentTeamDisplayName = "Unknown Team";
            }

            return (
                <div
                    key={`${record.key}-${team.ownerId || team.rosterId || 'unknown'}-${team.year || 'career'}-${index}`}
                    className="leading-tight" // This class helps stack lines closely
                >
                    {currentTeamDisplayName}{team.year ? ` (${team.year})` : ''}
                </div>
            );
        });

        return (
            <>
                <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                    {record.key.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-lg">{displayValue}</td>
                <td className="py-2 px-4 text-right text-gray-700">
                    {/* Render the array of div elements, which will stack vertically */}
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
                        {Object.entries(allTimeRecords).map(([key, record]) => (
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
