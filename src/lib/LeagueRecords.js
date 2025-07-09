// src/lib/LeagueRecords.js
import React, { useState, useEffect, useCallback } from 'react';
import { formatNumber } from '../utils/formatUtils'; // Assuming you have this utility

// (Keep the formatNumber function in src/utils/formatUtils.js as per our last discussion)

/**
 * Calculates and displays all-time league records based on historical data.
 * @param {Object} props - The component props.
 * @param {Object} props.historicalData - The full historical data object from SleeperDataContext.
 * @param {Function} props.getTeamName - A function to get the team's display name.
 * @param {Function} props.calculateAllLeagueMetrics - The function to calculate all league metrics.
 */
const LeagueRecords = ({ historicalData, getTeamName, calculateAllLeagueMetrics }) => {
    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [expandedRecords, setExpandedRecords] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Configuration for number formatting per stat
    const formatConfig = {
        highestDPR: { decimals: 2, type: 'decimal' },
        lowestDPR: { decimals: 2, type: 'decimal' },
        mostWins: { decimals: 0, type: 'count' },
        mostLosses: { decimals: 0, type: 'count' },
        bestWinPct: { decimals: 3, type: 'percentage' }, // Use 3 for clearer percentage
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


    const toggleExpand = useCallback((recordKey) => {
        setExpandedRecords(prev => ({
            ...prev,
            [recordKey]: !prev[recordKey]
        }));
    }, []);

    useEffect(() => {
        console.log("LeagueRecords: useEffect triggered for calculation.");
        setIsLoading(true);

        if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            console.log("LeagueRecords: No historicalData or matchups. Setting records to empty and isLoading false.");
            setAllTimeRecords({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, getTeamName);
            console.log("LeagueRecords: Raw seasonalMetrics from calculations.js:", seasonalMetrics);
            console.log("LeagueRecords: Raw careerDPRData from calculations.js (enhanced):", calculatedCareerDPRs);

            // --- Calculate All-Time Records ---
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
            let mostWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostWeeklyTop2Scores' }; // New metric

            // Temporary storage for calculating blowout/slim wins/losses across all time
            const allTimeBlowoutWins = {}; // { ownerId: count }
            const allTimeBlowoutLosses = {};
            const allTimeSlimWins = {};
            const allTimeSlimLosses = {};
            const allTimeWeeklyTop2Scores = {}; // { ownerId: count }

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
                    // Check for existing team info to avoid duplicates in ties, though usually handled by map
                    if (!currentRecord.teams.some(t => t.name === teamInfo.name && t.year === teamInfo.year)) {
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
                    if (!currentRecord.teams.some(t => t.name === teamInfo.name && t.year === teamInfo.year)) {
                        currentRecord.teams.push(teamInfo);
                    }
                }
            };

            // --- Aggregate Seasonal Metrics for All-Time Records ---
            Object.keys(seasonalMetrics).forEach(year => {
                const yearMetrics = seasonalMetrics[year];
                Object.keys(yearMetrics).forEach(rosterId => {
                    const teamStats = yearMetrics[rosterId];
                    const ownerId = teamStats.ownerId; // Ensure ownerId is available

                    // Initialize per-owner aggregate stats if not present
                    if (!allTimeBlowoutWins[ownerId]) {
                        allTimeBlowoutWins[ownerId] = 0;
                        allTimeBlowoutLosses[ownerId] = 0;
                        allTimeSlimWins[ownerId] = 0;
                        allTimeSlimLosses[ownerId] = 0;
                        allTimeWeeklyTop2Scores[ownerId] = 0;
                    }

                    // For Blowout/Slim Wins/Losses, we need to re-process matchups per week
                    const weeklyMatchupsForYear = historicalData.matchupsBySeason?.[year];
                    const leagueMetadataForYear = historicalData.leaguesMetadataBySeason?.[year];
                    const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;

                    Object.keys(weeklyMatchupsForYear || {}).forEach(weekStr => {
                        const week = parseInt(weekStr);
                        // Only regular season weeks
                        if (isNaN(week) || (leagueMetadataForYear?.settings?.playoff_start_week && week >= playoffStartWeek)) return;

                        const matchupsInWeek = weeklyMatchupsForYear[weekStr];
                        if (!matchupsInWeek || matchupsInWeek.length === 0) return;

                        let currentTeamScore = null;
                        let opponentScore = null;
                        for (const matchup of matchupsInWeek) {
                            if (String(matchup.roster_id) === String(rosterId)) {
                                // This is for new Sleeper API v2 structure, if matchup.roster_id has score
                                // Assuming matchup has team1_roster_id, team1_score, team2_roster_id, team2_score
                                currentTeamScore = matchup.points; // Assuming points is the score for roster_id
                                const opponentMatchup = matchupsInWeek.find(m => m.matchup_id === matchup.matchup_id && m.roster_id !== rosterId);
                                if (opponentMatchup) opponentScore = opponentMatchup.points;
                                break;
                            } else if (matchup.team1_roster_id && String(matchup.team1_roster_id) === String(rosterId)) {
                                currentTeamScore = matchup.team1_points;
                                opponentScore = matchup.team2_points;
                                break;
                            } else if (matchup.team2_roster_id && String(matchup.team2_roster_id) === String(rosterId)) {
                                currentTeamScore = matchup.team2_points;
                                opponentScore = matchup.team1_points;
                                break;
                            }
                        }


                        if (currentTeamScore !== null && opponentScore !== null && typeof currentTeamScore === 'number' && typeof opponentScore === 'number') {
                            const scoreDifference = currentTeamScore - opponentScore;

                            if (scoreDifference >= 30) {
                                allTimeBlowoutWins[ownerId]++;
                            } else if (scoreDifference <= -30) {
                                allTimeBlowoutLosses[ownerId]++;
                            } else if (scoreDifference > 0 && scoreDifference <= 5) {
                                allTimeSlimWins[ownerId]++;
                            } else if (scoreDifference < 0 && scoreDifference >= -5) {
                                allTimeSlimLosses[ownerId]++;
                            }

                            // Calculate Most Weekly Top 2 Scores
                            const allScoresInCurrentWeek = [];
                            // Collect all scores in the week for *all* teams (not just the current matchup)
                            // This depends on whether matchupsInWeek contains ALL roster_id scores for that week
                            // or just the pair. Assuming it's the pairs, we need to iterate all matchups for the week.
                            matchupsInWeek.forEach(matchup => {
                                // Adjust based on your actual matchup structure (v1 vs v2 sleeper)
                                if (matchup.roster_id && typeof matchup.points === 'number' && !isNaN(matchup.points)) {
                                    allScoresInCurrentWeek.push({ roster_id: matchup.roster_id, score: matchup.points });
                                } else if (matchup.team1_roster_id && typeof matchup.team1_points === 'number' && !isNaN(matchup.team1_points)) {
                                    allScoresInCurrentWeek.push({ roster_id: matchup.team1_roster_id, score: matchup.team1_points });
                                }
                                if (matchup.team2_roster_id && typeof matchup.team2_points === 'number' && !isNaN(matchup.team2_points)) {
                                    allScoresInCurrentWeek.push({ roster_id: matchup.team2_roster_id, score: matchup.team2_points });
                                }
                            });

                            // Filter out duplicate roster_id entries if matchupsInWeek contains both sides of a match
                            const uniqueScores = {};
                            allScoresInCurrentWeek.forEach(item => {
                                if (!uniqueScores[item.roster_id] || uniqueScores[item.roster_id].score < item.score) {
                                    uniqueScores[item.roster_id] = item;
                                }
                            });
                            const finalScoresForWeek = Object.values(uniqueScores);


                            if (finalScoresForWeek.length > 0) {
                                // Sort scores descending to find top 2
                                finalScoresForWeek.sort((a, b) => b.score - a.score);
                                const top2ScoresValues = [finalScoresForWeek[0]?.score, finalScoresForWeek[1]?.score].filter(s => typeof s === 'number');

                                // Check if current team's score is in the top 2
                                if (top2ScoresValues.includes(currentTeamScore)) {
                                    allTimeWeeklyTop2Scores[ownerId]++;
                                }
                            }
                        }
                    });
                });
            });


            // --- Process Career DPR Data for All-Time Records ---
            calculatedCareerDPRs.forEach(careerStats => {
                const teamName = careerStats.teamName;
                const ownerId = careerStats.ownerId; // Make sure ownerId is available in careerDPRData

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
                }

                // Aggregate winning/losing seasons
                let winningSeasonsCount = 0;
                let losingSeasonsCount = 0;

                Object.keys(seasonalMetrics).forEach(year => {
                    const teamsInSeason = Object.values(seasonalMetrics[year]);
                    const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                    if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
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

            // --- Process All-Play Win Percentage from Seasonal Metrics ---
            Object.keys(seasonalMetrics).forEach(year => {
                Object.values(seasonalMetrics[year]).forEach(teamStats => {
                    if (teamStats.allPlayWinPercentage > 0) {
                        updateRecord(bestAllPlayWinPct, teamStats.allPlayWinPercentage, {
                            name: teamStats.teamName,
                            value: teamStats.allPlayWinPercentage,
                            year: year,
                            rosterId: teamStats.rosterId, // Add rosterId for getTeamName in render
                            ownerId: teamStats.ownerId // Add ownerId
                        });
                    }
                });
            });

            // --- Update records from the collected all-time counts ---
            Object.keys(allTimeBlowoutWins).forEach(ownerId => {
                const count = allTimeBlowoutWins[ownerId];
                const teamName = getTeamName(ownerId, null); // Get career team name
                updateRecord(mostBlowoutWins, count, { name: teamName, value: count, ownerId: ownerId });
            });
            Object.keys(allTimeBlowoutLosses).forEach(ownerId => {
                const count = allTimeBlowoutLosses[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostBlowoutLosses, count, { name: teamName, value: count, ownerId: ownerId });
            });
            Object.keys(allTimeSlimWins).forEach(ownerId => {
                const count = allTimeSlimWins[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostSlimWins, count, { name: teamName, value: count, ownerId: ownerId });
            });
            Object.keys(allTimeSlimLosses).forEach(ownerId => {
                const count = allTimeSlimLosses[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostSlimLosses, count, { name: teamName, value: count, ownerId: ownerId });
            });
            Object.keys(allTimeWeeklyTop2Scores).forEach(ownerId => {
                const count = allTimeWeeklyTop2Scores[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostWeeklyTop2Scores, count, { name: teamName, value: count, ownerId: ownerId });
            });

            // Most Weekly High Scores (already calculated in careerDPRData and included `topScoreWeeksCount`)
            calculatedCareerDPRs.forEach(careerStats => {
                if (careerStats.topScoreWeeksCount > 0) {
                    updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: careerStats.teamName, value: careerStats.topScoreWeeksCount, ownerId: careerStats.ownerId });
                }
            });


            setAllTimeRecords({
                highestDPR,
                lowestDPR,
                mostWins,
                // ... (ensure all `key` properties are set in initial record objects above)
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
    }, [historicalData, getTeamName, calculateAllLeagueMetrics]);

    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    // Helper to render a record entry
    const renderRecordEntry = (record) => {
        // Find the specific formatting configuration for this record type
        const config = formatConfig[record.key] || { decimals: 2, type: 'default' };

        if (!record || record.value === -Infinity || record.value === Infinity || record.teams.length === 0) {
            return (
                <>
                    <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                        {record.key.replace(/([A-Z])/g, ' $1').trim()}
                    </td>
                    <td className="py-2 px-4 text-center text-gray-500">N/A</td>
                    <td className="py-2 px-4 text-right text-gray-500"></td> {/* Empty for team name */}
                </>
            );
        }

        const primaryTeam = record.teams[0];

        // Format the display value based on config
        let displayValue;
        if (config.type === 'percentage') {
            displayValue = formatNumber(primaryTeam.value * 100, config.decimals) + '%';
        } else {
            displayValue = formatNumber(primaryTeam.value, config.decimals);
        }

        // --- Handle "Unknown Team" ---
        // Prioritize ownerId for career stats, rosterId for seasonal if ownerId is not available
        let teamDisplayName = primaryTeam.name;
        if (teamDisplayName.startsWith('Unknown Team (ID:')) {
             if (primaryTeam.ownerId) {
                teamDisplayName = getTeamName(primaryTeam.ownerId, null); // Try to get owner's career name
            } else if (primaryTeam.rosterId && primaryTeam.year) {
                teamDisplayName = getTeamName(primaryTeam.rosterId, primaryTeam.year); // Try seasonal roster name
            }
        }
        // If it's still 'Unknown Team', replace with a more generic placeholder or leave as is if IDs are preferred
        if (teamDisplayName.startsWith('Unknown Team (ID:')) {
             teamDisplayName = "Unknown Team"; // More user-friendly fallback
        }


        return (
            <>
                <td className="py-2 px-4 text-left font-medium text-gray-700 capitalize">
                    {record.key.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-lg">{displayValue}</td>
                <td className="py-2 px-4 text-right text-gray-700">
                    {teamDisplayName} {primaryTeam.year ? `(${primaryTeam.year})` : ''}
                    {record.teams.length > 1 && (
                        <button
                            onClick={() => toggleExpand(record.key)}
                            className="text-blue-500 hover:text-blue-700 text-sm ml-2"
                        >
                            {expandedRecords[record.key] ? 'Show Less' : `+${record.teams.length - 1} more`}
                        </button>
                    )}
                    {expandedRecords[record.key] && record.teams.length > 1 && (
                        <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
                            {record.teams.slice(1).map((team, index) => {
                                // Apply formatting to tied teams as well
                                let tiedDisplayValue;
                                if (config.type === 'percentage') {
                                    tiedDisplayValue = formatNumber(team.value * 100, config.decimals) + '%';
                                } else {
                                    tiedDisplayValue = formatNumber(team.value, config.decimals);
                                }

                                // Handle "Unknown Team" for tied teams
                                let tiedTeamDisplayName = team.name;
                                if (tiedTeamDisplayName.startsWith('Unknown Team (ID:')) {
                                     if (team.ownerId) {
                                        tiedTeamDisplayName = getTeamName(team.ownerId, null);
                                    } else if (team.rosterId && team.year) {
                                        tiedTeamDisplayName = getTeamName(team.rosterId, team.year);
                                    }
                                }
                                if (tiedTeamDisplayName.startsWith('Unknown Team (ID:')) {
                                     tiedTeamDisplayName = "Unknown Team";
                                }


                                return (
                                    <li key={index}>
                                        {tiedDisplayValue} - {tiedTeamDisplayName} {team.year ? `(${team.year})` : ''}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </td>
            </>
        );
    };


    return (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">All-Time League Records</h2>

            <div className="overflow-x-auto"> {/* Added for horizontal scrolling on small screens */}
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
