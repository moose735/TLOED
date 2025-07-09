// src/lib/LeagueRecords.js
import React, { useState, useEffect, useCallback } from 'react';
import { formatNumber } from '../utils/formatUtils'; // Assuming you have this utility

// Placeholder for your actual formatNumber utility
// You might have this in src/utils/formatUtils.js
// export const formatNumber = (num, decimals = 2) => {
//     if (typeof num !== 'number' || isNaN(num)) return 'N/A';
//     return num.toFixed(decimals);
// };

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
            let highestDPR = { value: -Infinity, teams: [] };
            let lowestDPR = { value: Infinity, teams: [] };
            let mostWins = { value: -Infinity, teams: [] };
            let mostLosses = { value: -Infinity, teams: [] };
            let bestWinPct = { value: -Infinity, teams: [] };
            let bestAllPlayWinPct = { value: -Infinity, teams: [] };
            let mostWeeklyHighScores = { value: -Infinity, teams: [] };
            let mostWinningSeasons = { value: -Infinity, teams: [] };
            let mostLosingSeasons = { value: -Infinity, teams: [] };
            let mostBlowoutWins = { value: -Infinity, teams: [] };
            let mostBlowoutLosses = { value: -Infinity, teams: [] };
            let mostSlimWins = { value: -Infinity, teams: [] };
            let mostSlimLosses = { value: -Infinity, teams: [] };
            let mostTotalPoints = { value: -Infinity, teams: [] };
            let mostPointsAgainst = { value: -Infinity, teams: [] };
            let mostWeeklyTop2Scores = { value: -Infinity, teams: [] }; // New metric

            // Temporary storage for calculating blowout/slim wins/losses across all time
            const allTimeBlowoutWins = {}; // { ownerId: count }
            const allTimeBlowoutLosses = {};
            const allTimeSlimWins = {};
            const allTimeSlimLosses = {};
            const allTimeWeeklyTop2Scores = {}; // { ownerId: count }

            // Helper to update records (handles ties)
            const updateRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== -Infinity) { // Exclude initial -Infinity ties
                    currentRecord.teams.push(teamInfo);
                }
            };

            const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.teams = [teamInfo];
                } else if (newValue === currentRecord.value && newValue !== Infinity) { // Exclude initial Infinity ties
                    currentRecord.teams.push(teamInfo);
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
                        if (isNaN(week) || week >= playoffStartWeek) return; // Only regular season weeks

                        const matchupsInWeek = weeklyMatchupsForYear[weekStr];
                        if (!matchupsInWeek || matchupsInWeek.length === 0) return;

                        let currentTeamScore = null;
                        let opponentScore = null;
                        for (const matchup of matchupsInWeek) {
                            if (String(matchup.team1_roster_id) === String(rosterId)) {
                                currentTeamScore = matchup.team1_score;
                                opponentScore = matchup.team2_score;
                                break;
                            } else if (String(matchup.team2_roster_id) === String(rosterId)) {
                                currentTeamScore = matchup.team2_score;
                                opponentScore = matchup.team1_score;
                                break;
                            }
                        }

                        if (currentTeamScore !== null && opponentScore !== null && typeof currentTeamScore === 'number' && typeof opponentScore === 'number') {
                            const scoreDifference = currentTeamScore - opponentScore;

                            // Blowout Wins (e.g., > 30 point difference) - Adjust threshold as needed
                            if (scoreDifference >= 30) {
                                allTimeBlowoutWins[ownerId]++;
                            }
                            // Blowout Losses (e.g., < -30 point difference)
                            else if (scoreDifference <= -30) {
                                allTimeBlowoutLosses[ownerId]++;
                            }
                            // Slim Wins (e.g., 0.1 to 5 point difference)
                            else if (scoreDifference > 0 && scoreDifference <= 5) {
                                allTimeSlimWins[ownerId]++;
                            }
                            // Slim Losses (e.g., -0.1 to -5 point difference)
                            else if (scoreDifference < 0 && scoreDifference >= -5) {
                                allTimeSlimLosses[ownerId]++;
                            }

                            // Calculate Most Weekly Top 2 Scores
                            const allScoresInCurrentWeek = [];
                            matchupsInWeek.forEach(matchup => {
                                if (matchup.team1_roster_id && typeof matchup.team1_score === 'number' && !isNaN(matchup.team1_score)) {
                                    allScoresInCurrentWeek.push({ roster_id: matchup.team1_roster_id, score: matchup.team1_score });
                                }
                                if (matchup.team2_roster_id && typeof matchup.team2_score === 'number' && !isNaN(matchup.team2_score)) {
                                    allScoresInCurrentWeek.push({ roster_id: matchup.team2_roster_id, score: matchup.team2_score });
                                }
                            });

                            if (allScoresInCurrentWeek.length > 0) {
                                // Sort scores descending to find top 2
                                allScoresInCurrentWeek.sort((a, b) => b.score - a.score);
                                const top2Scores = [allScoresInCurrentWeek[0]?.score, allScoresInCurrentWeek[1]?.score].filter(s => typeof s === 'number');

                                // Check if current team's score is in the top 2
                                if (top2Scores.includes(currentTeamScore)) {
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
                    updateRecord(highestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr });
                    updateLowestRecord(lowestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr });
                }

                if (careerStats.totalGames > 0) {
                    updateRecord(mostWins, careerStats.wins, { name: teamName, value: careerStats.wins });
                    updateRecord(mostLosses, careerStats.losses, { name: teamName, value: careerStats.losses });
                    updateRecord(bestWinPct, careerStats.winPercentage, { name: teamName, value: careerStats.winPercentage });
                    updateRecord(mostTotalPoints, careerStats.pointsFor, { name: teamName, value: careerStats.pointsFor });
                    updateRecord(mostPointsAgainst, careerStats.pointsAgainst, { name: teamName, value: careerStats.pointsAgainst });
                }

                // All-Play Win Percentage is tricky for career, as it's not a direct sum.
                // You'd need to re-calculate all-play wins/losses across all seasons for a career.
                // For now, if you want a true career all-play, you'd need to add a careerAllPlayWinPercentage calculation to `calculatedCareerDPRs`
                // or compute it here by iterating over all historical matchups for an owner.
                // For simplicity, let's assume `bestAllPlayWinPct` is derived from `seasonalMetrics` for now.
                // A true career all-play win % would need its own aggregate calculation.

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
                updateRecord(mostWinningSeasons, winningSeasonsCount, { name: teamName, value: winningSeasonsCount });
                updateRecord(mostLosingSeasons, losingSeasonsCount, { name: teamName, value: losingSeasonsCount });
            });

            // --- Process All-Play Win Percentage from Seasonal Metrics (as it's harder to aggregate directly for career) ---
            // This assumes `bestAllPlayWinPct` is for a single best season, or an average of averages.
            // If you need a true "career all-play win %", you'd need to extend `calculateAllLeagueMetrics` to aggregate that.
            Object.keys(seasonalMetrics).forEach(year => {
                Object.values(seasonalMetrics[year]).forEach(teamStats => {
                    if (teamStats.allPlayWinPercentage > 0) { // Only consider teams that played
                        updateRecord(bestAllPlayWinPct, teamStats.allPlayWinPercentage, { name: teamStats.teamName, value: teamStats.allPlayWinPercentage, year: year });
                    }
                });
            });

            // --- Update records from the collected all-time counts ---
            Object.keys(allTimeBlowoutWins).forEach(ownerId => {
                const count = allTimeBlowoutWins[ownerId];
                const teamName = getTeamName(ownerId, null); // Get career team name
                updateRecord(mostBlowoutWins, count, { name: teamName, value: count });
            });
            Object.keys(allTimeBlowoutLosses).forEach(ownerId => {
                const count = allTimeBlowoutLosses[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostBlowoutLosses, count, { name: teamName, value: count });
            });
            Object.keys(allTimeSlimWins).forEach(ownerId => {
                const count = allTimeSlimWins[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostSlimWins, count, { name: teamName, value: count });
            });
            Object.keys(allTimeSlimLosses).forEach(ownerId => {
                const count = allTimeSlimLosses[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostSlimLosses, count, { name: teamName, value: count });
            });
            Object.keys(allTimeWeeklyTop2Scores).forEach(ownerId => {
                const count = allTimeWeeklyTop2Scores[ownerId];
                const teamName = getTeamName(ownerId, null);
                updateRecord(mostWeeklyTop2Scores, count, { name: teamName, value: count });
            });

            // Most Weekly High Scores (already calculated in careerDPRData and included `topScoreWeeksCount`)
            calculatedCareerDPRs.forEach(careerStats => {
                if (careerStats.topScoreWeeksCount > 0) {
                    updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: careerStats.teamName, value: careerStats.topScoreWeeksCount });
                }
            });


            setAllTimeRecords({
                highestDPR,
                lowestDPR,
                mostWins,
                mostLosses,
                bestWinPct,
                bestAllPlayWinPct,
                mostWeeklyHighScores,
                mostWeeklyTop2Scores, // New
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
    }, [historicalData, getTeamName, calculateAllLeagueMetrics]); // Depend on historicalData, getTeamName, and calculateAllLeagueMetrics

    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    // Helper to render a record entry
    const renderRecordEntry = (record) => {
        if (!record || record.value === -Infinity || record.value === Infinity || record.teams.length === 0) {
            return <span className="text-gray-500">N/A</span>;
        }

        const primaryTeam = record.teams[0];
        const displayValue = typeof primaryTeam.value === 'number' ? formatNumber(primaryTeam.value, 2) : 'N/A';

        return (
            <div>
                <div className="flex items-center space-x-2">
                    <span className="font-semibold text-lg">{displayValue}</span>
                    <span className="text-gray-700">{primaryTeam.name} {primaryTeam.year ? `(${primaryTeam.year})` : ''}</span>
                    {record.teams.length > 1 && (
                        <button
                            onClick={() => toggleExpand(record.key)}
                            className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                            {expandedRecords[record.key] ? 'Show Less' : `+${record.teams.length - 1} more`}
                        </button>
                    )}
                </div>
                {expandedRecords[record.key] && record.teams.length > 1 && (
                    <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
                        {record.teams.slice(1).map((team, index) => (
                            <li key={index}>
                                {typeof team.value === 'number' ? formatNumber(team.value, 2) : 'N/A'} - {team.name} {team.year ? `(${team.year})` : ''}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };


    return (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">All-Time League Records</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                {Object.entries(allTimeRecords).map(([key, record]) => (
                    <div key={key} className="flex flex-col">
                        <h3 className="text-lg font-medium text-gray-700 mb-1 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()} {/* Formats camelCase to readable */}
                        </h3>
                        {renderRecordEntry({ ...record, key: key })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeagueRecords;
