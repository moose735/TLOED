// src/lib/LeagueHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // For career DPR
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook
import { calculatePlayoffFinishes } from '../utils/playoffRankings'; // Import the playoff calculation function

// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return (s[v - 20] || s[v] || s[0]);
};

// Helper to get the descriptive name of a final seeding game (e.g., "Championship Game")
// This function might become less relevant if we rely purely on bracket data for awards
const getFinalSeedingGamePurpose = (value) => {
    if (value === 1) return 'Championship Game';
    if (value === 3) return '3rd Place Game';
    if (value === 5) return '5th Place Game';
    if (value === 7) return '7th Place Game';
    if (value === 9) return '9th Place Game';
    if (value === 11) return '11th Place Game';
    if (typeof value === 'number' && value > 0 && value % 2 !== 0) {
        return `${value}${getOrdinalSuffix(value)} Place Game`;
    }
    return 'Final Seeding Game';
};

const LeagueHistory = () => {
    // Consume data from SleeperDataContext
    const {
        loading: contextLoading,
        error: contextError,
        historicalData, // Contains matchupsBySeason, winnersBracketBySeason, losersBracketBySeason, rostersBySeason, leaguesMetadataBySeason, usersBySeason
        allDraftHistory, // Added allDraftHistory from context
        nflState, // NEW: Import nflState from context
        getTeamName: getDisplayTeamNameFromContext // Renamed to avoid conflict with prop name
    } = useSleeperData();

    const [allTimeStandings, setAllTimeStandings] = useState([]);
    const [seasonalDPRChartData, setSeasonalDPRChartData] = useState([]);
    const [uniqueTeamsForChart, setUniqueTeamsForChart] = useState([]);
    const [seasonAwardsSummary, setSeasonAwardsSummary] = useState({});
    const [sortedYearsForAwards, setSortedYearsForAwards] = useState([]);

    // A color palette for the teams in the chart
    const teamColors = [
        '#8884d8', '#82ca9d', '#ffc658', '#f5222d', '#fa8c16', '#a0d911', '#52c41a', '#1890ff',
        '#2f54eb', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#eb2f96', '#fadb14', '#52c41a'
    ];

    useEffect(() => {
        if (contextLoading || contextError || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            setAllTimeStandings([]);
            setSeasonalDPRChartData([]);
            setUniqueTeamsForChart([]);
            setSeasonAwardsSummary({});
            setSortedYearsForAwards([]);
            return;
        }

        // Ensure getDisplayTeamNameFromContext is a function
        if (typeof getDisplayTeamNameFromContext !== 'function') {
            console.error("LeagueHistory: getDisplayTeamNameFromContext is not a function. Cannot process data.");
            setAllTimeStandings([]);
            setSeasonalDPRChartData([]);
            setUniqueTeamsForChart([]);
            setSeasonAwardsSummary({});
            setSortedYearsForAwards([]);
            return;
        }

        // Use calculateAllLeagueMetrics directly with historicalData
        // NEW: Pass nflState to calculateAllLeagueMetrics
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getDisplayTeamNameFromContext, nflState);

        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);

        // Initialize teamOverallStats using careerDPRData
        const teamOverallStats = {};
        calculatedCareerDPRs.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            const teamName = getDisplayTeamNameFromContext(ownerId, null); // Get current team name for overall stats

            if (!teamName || teamName.startsWith('Unknown Team (ID:')) {
                console.warn(`LeagueHistory: Skipping career stats for ownerId ${ownerId} due to unresolved team name.`);
                return;
            }

            teamOverallStats[teamName] = {
                totalWins: careerStats.wins,
                totalLosses: careerStats.losses,
                totalTies: careerStats.ties,
                totalPointsFor: careerStats.pointsFor,
                totalGames: careerStats.totalGames,
                careerDPR: careerStats.dpr,
                seasonsPlayed: new Set(),
                // FIX: Populate awards directly from careerStats
                awards: {
                    championships: careerStats.championships || 0,
                    runnerUps: careerStats.runnerUps || 0,
                    thirdPlace: careerStats.thirdPlaces || 0,
                    firstPoints: careerStats.pointsChampionships || 0,
                    secondPoints: careerStats.pointsRunnerUps || 0,
                    thirdPoints: careerStats.thirdPlacePoints || 0
                },
                ownerId: ownerId // Keep ownerId for awards lookup
            };
        });

        // Populate seasonsPlayed for each team from historicalData.rostersBySeason
        Object.keys(historicalData.rostersBySeason).forEach(year => {
            const rostersForYear = historicalData.rostersBySeason[year];
            if (rostersForYear) {
                rostersForYear.forEach(roster => {
                    const ownerId = roster.owner_id;
                    const teamName = getDisplayTeamNameFromContext(ownerId, null); // Get current team name
                    if (teamOverallStats[teamName]) {
                        teamOverallStats[teamName].seasonsPlayed.add(parseInt(year));
                    }
                });
            }
        });

        const newSeasonAwardsSummary = {};

        // Iterate through seasonalMetrics directly to populate seasonAwardsSummary
        allYears.forEach(year => { // Iterate through all years to ensure all are considered for awards
            const seasonalStatsForYear = seasonalMetrics[year];
            const winnersBracketForYear = historicalData.winnersBracketBySeason[year] || [];
            const losersBracketForYear = historicalData.losersBracketBySeason?.[year] || [];
            const rostersForYear = historicalData.rostersBySeason[year] || [];
            const rosterIdToOwnerIdMap = new Map(rostersForYear.map(r => [String(r.roster_id), String(r.owner_id)]));

            // Initialize awards for the current year
            newSeasonAwardsSummary[year] = {
                champion: 'N/A',
                secondPlace: 'N/A',
                thirdPlace: 'N/A',
                pointsChamp: 'N/A',
                pointsSecond: 'N/A',
                pointsThird: 'N/A',
            };

            // Check if the season is considered completed for playoff awards based on calculations.js logic
            // This relies on the `isChampion`, `isRunnerUp`, `isThirdPlace` flags being correctly set in `seasonalMetrics`
            // by `calculateAllLeagueMetrics` which now uses `nflState`.
            let hasPlayoffAwardsForThisYear = false;
            if (seasonalStatsForYear) {
                Object.values(seasonalStatsForYear).forEach(teamSeasonalData => {
                    if (teamSeasonalData.isChampion) {
                        newSeasonAwardsSummary[year].champion = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                        hasPlayoffAwardsForThisYear = true;
                    }
                    if (teamSeasonalData.isRunnerUp) {
                        newSeasonAwardsSummary[year].secondPlace = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                        hasPlayoffAwardsForThisYear = true;
                    }
                    if (teamSeasonalData.isThirdPlace) {
                        newSeasonAwardsSummary[year].thirdPlace = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                        hasPlayoffAwardsForThisYear = true;
                    }
                });
            }


            // Points Leaders for the year (always calculate if seasonalMetrics exist, regardless of playoff completion)
            if (seasonalStatsForYear) {
                const teamsInSeason = Object.values(seasonalStatsForYear);
                const yearPointsData = teamsInSeason.map(teamStats => ({
                    ownerId: teamStats.ownerId,
                    points: teamStats.pointsFor,
                    isPointsChampion: teamStats.isPointsChampion, // Use flags from seasonalMetrics
                    isPointsRunnerUp: teamStats.isPointsRunnerUp,
                    isThirdPlacePoints: teamStats.isThirdPlacePoints,
                }));

                // Populate points awards based on the flags already set in seasonalMetrics
                yearPointsData.forEach(teamPointsData => {
                    if (teamPointsData.isPointsChampion) {
                        newSeasonAwardsSummary[year].pointsChamp = getDisplayTeamNameFromContext(teamPointsData.ownerId, year);
                    }
                    if (teamPointsData.isPointsRunnerUp) {
                        newSeasonAwardsSummary[year].pointsSecond = getDisplayTeamNameFromContext(teamPointsData.ownerId, year);
                    }
                    if (teamPointsData.isThirdPlacePoints) {
                        newSeasonAwardsSummary[year].pointsThird = getDisplayTeamNameFromContext(teamPointsData.ownerId, year);
                    }
                });
            } else {
                console.warn(`LeagueHistory: No seasonal metrics found for year ${year}. Cannot determine points awards.`);
            }

            // If a year has no awards at all (N/A for everything), remove it from the summary
            const currentYearSummary = newSeasonAwardsSummary[year];
            const hasAnyAward =
                currentYearSummary.champion !== 'N/A' ||
                currentYearSummary.secondPlace !== 'N/A' ||
                currentYearSummary.thirdPlace !== 'N/A' ||
                currentYearSummary.pointsChamp !== 'N/A' ||
                currentYearSummary.pointsSecond !== 'N/A' ||
                currentYearSummary.pointsThird !== 'N/A';

            if (!hasAnyAward) {
                delete newSeasonAwardsSummary[year];
            }
        });
        console.log("LeagueHistory: newSeasonAwardsSummary after processing:", newSeasonAwardsSummary);


        // Final compilation for All-Time Standings display (SORTED BY WIN PERCENTAGE)
        const compiledStandings = Object.keys(teamOverallStats).map(teamName => {
            const stats = teamOverallStats[teamName];
            if (stats.seasonsPlayed.size === 0) return null;

            const totalGames = stats.totalWins + stats.totalLosses + stats.totalTies;
            const winPercentage = totalGames > 0 ? ((stats.totalWins + (0.5 * stats.totalTies)) / totalGames) : 0;

            const sortedYearsArrayForDisplay = Array.from(stats.seasonsPlayed).sort((a, b) => a - b);
            const minYear = sortedYearsArrayForDisplay.length > 0 ? sortedYearsArrayForDisplay[0] : '';
            const maxYear = sortedYearsArrayForDisplay.length > 0 ? sortedYearsArrayForDisplay[sortedYearsArrayForDisplay.length - 1] : '';
            const seasonsCount = stats.seasonsPlayed.size;

            let seasonsDisplay = (
                <>
                    {seasonsCount > 0 ? (
                        minYear === maxYear ? (
                            <>{minYear} <span className="text-xs text-gray-500">({seasonsCount})</span></>
                        ) : (
                            <>{minYear}-{maxYear} <span className="text-xs text-gray-500">({seasonsCount})</span></>
                        )
                    ) : ''}
                </>
            );

            // Populate career awards from calculatedCareerDPRs
            const careerStatsForTeam = calculatedCareerDPRs.find(cs => cs.ownerId === stats.ownerId);
            const awardsToDisplay = careerStatsForTeam ? {
                championships: careerStatsForTeam.championships || 0,
                runnerUps: careerStatsForTeam.runnerUps || 0,
                thirdPlace: careerStatsForTeam.thirdPlaces || 0,
                firstPoints: careerStatsForTeam.pointsChampionships || 0,
                secondPoints: careerStatsForTeam.pointsRunnerUps || 0,
                thirdPoints: careerStatsForTeam.thirdPlacePoints || 0,
            } : { championships: 0, runnerUps: 0, thirdPlace: 0, firstPoints: 0, secondPoints: 0, thirdPoints: 0 };


            return {
                team: teamName,
                seasons: seasonsDisplay,
                totalDPR: stats.careerDPR,
                record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`,
                totalWins: stats.totalWins,
                winPercentage: winPercentage,
                awards: awardsToDisplay, // Add awards to all-time standings
            };
        }).filter(Boolean).sort((a, b) => b.winPercentage - a.winPercentage);

        setAllTimeStandings(compiledStandings);

        // Prepare data for the total DPR progression line graph
        const chartData = [];
        const allYearsForChart = Object.keys(historicalData.matchupsBySeason).map(Number).filter(y => !isNaN(y)).sort((a, b) => a - b);

        // Get unique owner IDs from calculatedCareerDPRs to represent unique teams for the chart
        const uniqueOwnerIdsForChart = Array.from(new Set(calculatedCareerDPRs.map(dpr => dpr.ownerId)));
        // Map these ownerIds to their current team names for chart legend and data keys
        const uniqueTeamsForChartDisplayNames = uniqueOwnerIdsForChart.map(ownerId => getDisplayTeamNameFromContext(ownerId, null)).sort();

        setUniqueTeamsForChart(uniqueTeamsForChartDisplayNames);

        const cumulativeTeamDPRs = {}; // Stores DPR by ownerId

        allYearsForChart.forEach(currentYear => {
            // Recalculate metrics up to the current year
            const tempHistoricalDataForYear = {
                matchupsBySeason: {},
                rostersBySeason: {},
                leaguesMetadataBySeason: {},
                winnersBracketBySeason: {},
                losersBracketBySeason: {},
                usersBySeason: {}
            };

            // Populate tempHistoricalDataForYear with data up to currentYear
            Object.keys(historicalData.matchupsBySeason).forEach(yearKey => {
                const yearNum = parseInt(yearKey);
                if (yearNum <= currentYear) {
                    tempHistoricalDataForYear.matchupsBySeason[yearKey] = historicalData.matchupsBySeason[yearKey];
                    tempHistoricalDataForYear.rostersBySeason[yearKey] = historicalData.rostersBySeason[yearKey];
                    tempHistoricalDataForYear.leaguesMetadataBySeason[yearKey] = historicalData.leaguesMetadataBySeason[yearKey];
                    tempHistoricalDataForYear.winnersBracketBySeason[yearKey] = historicalData.winnersBracketBySeason[yearKey];
                    tempHistoricalDataForYear.losersBracketBySeason[yearKey] = historicalData.losersBracketBySeason[yearKey];
                    tempHistoricalDataForYear.usersBySeason[yearKey] = historicalData.usersBySeason[yearKey];
                }
            });

            // NEW: Pass nflState to the nested calculateAllLeagueMetrics call for chart data
            const { careerDPRData: cumulativeCareerDPRDataForYear } = calculateAllLeagueMetrics(tempHistoricalDataForYear, allDraftHistory, getDisplayTeamNameFromContext, nflState);

            uniqueOwnerIdsForChart.forEach(ownerId => {
                const teamDPR = cumulativeCareerDPRDataForYear.find(dpr => dpr.ownerId === ownerId)?.dpr;
                if (teamDPR !== undefined) {
                    cumulativeTeamDPRs[ownerId] = teamDPR;
                } else {
                    // If a team didn't exist in this year's data, carry over its last known DPR or default to 0
                    cumulativeTeamDPRs[ownerId] = cumulativeTeamDPRs[ownerId] || 0;
                }
            });

            const yearDataPoint = { year: currentYear };
            const teamsWithDPRForRanking = uniqueOwnerIdsForChart.map(ownerId => ({
                ownerId: ownerId,
                dpr: cumulativeTeamDPRs[ownerId] || 0
            }));

            teamsWithDPRForRanking.sort((a, b) => b.dpr - a.dpr);

            let currentRank = 1;
            for (let i = 0; i < teamsWithDPRForRanking.length; i++) {
                if (i > 0 && teamsWithDPRForRanking[i].dpr < teamsWithDPRForRanking[i - 1].dpr) {
                    currentRank = i + 1;
                }
                const teamDisplayName = getDisplayTeamNameFromContext(teamsWithDPRForRanking[i].ownerId, null); // Get current name for chart key
                yearDataPoint[teamDisplayName] = currentRank;
                yearDataPoint[`${teamDisplayName}_DPR`] = teamsWithDPRForRanking[i].dpr;
            }

            chartData.push(yearDataPoint);
        });
        setSeasonalDPRChartData(chartData);

        // Set the season awards summary and sorted years
        setSeasonAwardsSummary(newSeasonAwardsSummary);
        setSortedYearsForAwards(Object.keys(newSeasonAwardsSummary).map(Number).sort((a, b) => b - a)); // Sort descending
    }, [historicalData, allDraftHistory, nflState, getDisplayTeamNameFromContext, contextLoading, contextError]); // Dependencies updated with nflState


    // Formatters
    const formatPercentage = (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
            // Format as decimal with 3 places, then remove leading '0.' if present
            let formatted = value.toFixed(3);
            if (formatted.startsWith('0.')) {
                formatted = formatted.substring(1); // Remove the '0'
            } else if (formatted.startsWith('-0.')) {
                formatted = `-${formatted.substring(2)}`; // Remove '-0'
            }
            return `${formatted}%`;
        }
        return '.000%';
    };

    const formatDPR = (dprValue) => {
        if (typeof dprValue === 'number' && !isNaN(dprValue)) {
            return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
        return 'N/A';
    };

    // Custom Tooltip component for Recharts
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            // Sort the payload by rank (value) in ascending order (lower rank is better)
            const sortedPayload = [...payload].sort((a, b) => a.value - b.value);

            return (
                <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
                    <p className="font-bold text-gray-800 mb-1">{`Year: ${label}`}</p>
                    {sortedPayload.map((entry, index) => {
                        const teamDPR = entry.payload[`${entry.dataKey}_DPR`]; // Access the stored DPR value
                        return (
                            <p key={`item-${index}`} style={{ color: entry.color }}>
                                {/* Display team name and their DPR value */}
                                {`${entry.name}: ${formatDPR(teamDPR)} DPR`}
                            </p>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    // Generate ticks for Y-axis (ranks from 1 to uniqueTeamsForChart.length)
    const yAxisTicks = Array.from({length: uniqueTeamsForChart.length}, (_, i) => i + 1);


    return (
        <div className="w-full max-w-full mt-8 mx-auto">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">League History & Awards</h2>

            {contextLoading ? (
                <p className="text-center text-gray-600">Loading league history data...</p>
            ) : contextError ? (
                <p className="text-center text-red-500 font-semibold">{contextError.message || String(contextError)}</p>
            ) : allTimeStandings.length === 0 ? (
                <p className="text-center text-gray-600">No historical matchup data found to display league history. Please check your Sleeper API configuration.</p>
            ) : (
                <>
                    {/* All-Time League Standings */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">All-Time Standings & Awards (Sorted by Win %)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Rank</th>
                                        <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Team</th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Seasons</th>
                                        {/* NEW: Added Total DPR header */}
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Career DPR</th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Record</th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Win %</th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Awards</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allTimeStandings.map((team, index) => {
                                        console.log(`LeagueHistory: Rendering All-Time Standings for team ${team.team}. Awards:`, team.awards); // ADDED LOG
                                        return (
                                            <tr key={team.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center font-semibold whitespace-nowrap">{index + 1}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 font-semibold whitespace-nowrap">{team.team}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{team.seasons}</td>
                                                {/* NEW: Added Total DPR data cell */}
                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(team.totalDPR)}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{team.record}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{formatPercentage(team.winPercentage)}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                                    <div className="flex justify-center items-center gap-2 whitespace-nowrap">
                                                        {team.awards.championships > 0 && (
                                                            <span title="Sween Bowl Championship" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-yellow-500 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.championships}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.runnerUps > 0 && (
                                                            <span title="Sween Bowl Runner-Up" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-gray-400 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.runnerUps}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.thirdPlace > 0 && (
                                                            <span title="3rd Place Finish" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-amber-800 text-lg"></i> {/* Using amber-800 for bronze-like color */}
                                                                <span className="text-xs font-medium">{team.awards.thirdPlace}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.firstPoints > 0 && (
                                                            <span title="1st Place - Points" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-yellow-500 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.firstPoints}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.secondPoints > 0 && (
                                                            <span title="2nd Place - Points" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-gray-400 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.secondPoints}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.thirdPoints > 0 && (
                                                            <span title="3rd Place - Points" className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-amber-800 text-lg"></i> {/* Using amber-800 for bronze-like color */}
                                                                <span className="text-xs font-medium">{team.awards.thirdPoints}x</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Season-by-Season Champions & Awards */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season-by-Season Champions & Awards</h3>
                        {Object.keys(seasonAwardsSummary).length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <thead className="bg-blue-50">
                                        <tr>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">Year</th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-trophy text-yellow-500 mr-1"></i> Champion
                                            </th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-trophy text-gray-400 mr-1"></i> 2nd Place
                                            </th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-trophy text-amber-800 mr-1"></i> 3rd Place
                                            </th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-medal text-yellow-500 mr-1"></i> Points Champ
                                            </th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-medal text-gray-400 mr-1"></i> Points 2nd
                                            </th>
                                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                                                <i className="fas fa-medal text-amber-800 mr-1"></i> Points 3rd
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedYearsForAwards.map((year, index) => {
                                            const awards = seasonAwardsSummary[year];
                                            return (
                                                <tr key={year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold text-center whitespace-nowrap">{year}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.champion}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.secondPlace}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.thirdPlace}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsChamp}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsSecond}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsThird}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-gray-600">No season-by-season award data available.</p>
                        )}
                    </section>

                    {/* Total DPR Progression Line Graph */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Total DPR Progression Over Seasons</h3>
                        {seasonalDPRChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" aspect={1.5}> {/* Changed aspect ratio */}
                                <LineChart
                                    data={seasonalDPRChartData}
                                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" label={{ value: "Season", position: "insideBottom", offset: 0 }} />
                                    <YAxis
                                        label={{ value: "Rank", angle: -90, position: "insideLeft", offset: 0 }}
                                        domain={[1, uniqueTeamsForChart.length]}
                                        reversed={true}
                                        tickFormatter={value => value}
                                        ticks={yAxisTicks}
                                        tickCount={uniqueTeamsForChart.length} // Ensure all ticks are attempted to be shown
                                        interval={0} // Prevents skipping ticks
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    {uniqueTeamsForChart.map((team, index) => (
                                        <Line
                                            key={team}
                                            type="monotone"
                                            dataKey={team}
                                            stroke={teamColors[index % teamColors.length]}
                                            activeDot={{ r: 8 }}
                                            dot={{ r: 4 }}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-600">No total DPR progression data available for charting.</p>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default LeagueHistory;
