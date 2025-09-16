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

const LeagueHistory = ({ onTeamNameClick }) => {
    // Consume data from SleeperDataContext
    const {
        loading: contextLoading,
        error: contextError,
        historicalData, // Contains matchupsBySeason, winnersBracketBySeason, losersBracketBySeason, rostersBySeason, leaguesMetadataBySeason, usersBySeason
        allDraftHistory, // Added allDraftHistory from context
        nflState, // NEW: Import nflState from context
        getTeamName: getDisplayTeamNameFromContext, // Renamed to avoid conflict with prop name
        getTeamDetails
    } = useSleeperData();

    const [allTimeStandings, setAllTimeStandings] = useState([]);
    const [sortBy, setSortBy] = useState('winPercentage');
    const [sortOrder, setSortOrder] = useState('desc');
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

        console.log("LeagueHistory: calculatedCareerDPRs after initial calculation:", calculatedCareerDPRs); // NEW LOG

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
        console.log("LeagueHistory: teamOverallStats after population:", teamOverallStats); // NEW LOG


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

            // Populate career awards from calculatedCareerDPRs, and collect years for each award
            const careerStatsForTeam = calculatedCareerDPRs.find(cs => cs.ownerId === stats.ownerId);
            // Helper to collect years for each award type
            const getAwardYears = (flag) => {
                const years = [];
                Object.entries(seasonalMetrics).forEach(([year, teams]) => {
                    const found = Object.values(teams).find(t => t.ownerId === stats.ownerId && t[flag]);
                    if (found) years.push(year);
                });
                return years;
            };
            const awardsToDisplay = careerStatsForTeam ? {
                championships: careerStatsForTeam.championships || 0,
                championshipsYears: getAwardYears('isChampion'),
                runnerUps: careerStatsForTeam.runnerUps || 0,
                runnerUpsYears: getAwardYears('isRunnerUp'),
                thirdPlace: careerStatsForTeam.thirdPlaces || 0,
                thirdPlaceYears: getAwardYears('isThirdPlace'),
                firstPoints: careerStatsForTeam.pointsChampionships || 0,
                firstPointsYears: getAwardYears('isPointsChampion'),
                secondPoints: careerStatsForTeam.pointsRunnerUps || 0,
                secondPointsYears: getAwardYears('isPointsRunnerUp'),
                thirdPoints: careerStatsForTeam.thirdPlacePoints || 0,
                thirdPointsYears: getAwardYears('isThirdPlacePoints'),
            } : { championships: 0, championshipsYears: [], runnerUps: 0, runnerUpsYears: [], thirdPlace: 0, thirdPlaceYears: [], firstPoints: 0, firstPointsYears: [], secondPoints: 0, secondPointsYears: [], thirdPoints: 0, thirdPointsYears: [] };

            return {
                team: teamName,
                seasons: seasonsDisplay,
                totalDPR: stats.careerDPR,
                record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`,
                totalWins: stats.totalWins,
                winPercentage: winPercentage,
                awards: awardsToDisplay, // Add awards to all-time standings
                ownerId: stats.ownerId // Ensure ownerId is passed here for logging
            };
        }).filter(Boolean).sort((a, b) => b.winPercentage - a.winPercentage);

    setAllTimeStandings(compiledStandings);

        // Prepare data for the total DPR progression line graph (now as rankings 1-12)
        const chartData = [];
        const allYearsForChart = Object.keys(historicalData.matchupsBySeason).map(Number).filter(y => !isNaN(y)).sort((a, b) => a - b);

        // Get unique owner IDs from calculatedCareerDPRs to represent unique teams for the chart
        const uniqueOwnerIdsForChart = Array.from(new Set(calculatedCareerDPRs.map(dpr => dpr.ownerId)));
        // Map these ownerIds to their current team names for chart legend and data keys
        const uniqueTeamsForChartDisplayNames = uniqueOwnerIdsForChart.map(ownerId => getDisplayTeamNameFromContext(ownerId, null)).sort();

        setUniqueTeamsForChart(uniqueTeamsForChartDisplayNames);

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

            // Calculate DPRs for all teams for this year
            const { careerDPRData: cumulativeCareerDPRDataForYear } = calculateAllLeagueMetrics(tempHistoricalDataForYear, allDraftHistory, getDisplayTeamNameFromContext, nflState);

            // Build a list of {ownerId, dpr, teamName} for this year
            const dprList = uniqueOwnerIdsForChart.map(ownerId => {
                const dpr = cumulativeCareerDPRDataForYear.find(dpr => dpr.ownerId === ownerId)?.dpr;
                return {
                    ownerId,
                    dpr: dpr !== undefined ? dpr : -9999, // Use a very low value for missing teams
                    teamName: getDisplayTeamNameFromContext(ownerId, null)
                };
            });

            // Sort by DPR descending, assign rank (1 = best DPR)
            dprList.sort((a, b) => b.dpr - a.dpr);
            dprList.forEach((item, idx) => {
                item.rank = idx + 1;
            });

            // Build chart data point: { year, [teamName]: rank, ... }
            const yearDataPoint = { year: currentYear };
            dprList.forEach(item => {
                yearDataPoint[item.teamName] = item.rank;
            });
            chartData.push(yearDataPoint);
        });
        setSeasonalDPRChartData(chartData);

        // Set the season awards summary and sorted years
        setSeasonAwardsSummary(newSeasonAwardsSummary);
        setSortedYearsForAwards(Object.keys(newSeasonAwardsSummary).map(Number).sort((a, b) => b - a)); // Sort descending
    }, [historicalData, allDraftHistory, nflState, getDisplayTeamNameFromContext, contextLoading, contextError]); // Dependencies updated with nflState


    // Formatter
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

    // Custom Tooltip component for Recharts (show rank and actual DPR, sorted by rank ascending)
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            // Ensure year is a number for comparison
            const year = typeof label === 'string' ? parseInt(label) : label;
            // Find the chart data point for this year
            const yearData = seasonalDPRChartData.find(d => parseInt(d.year) === year);
            // Build a list of {team, rank, color, dataKey, ownerId}
            // To get ownerId, reconstruct dprList for this year
            let dprList = [];
            if (historicalData && allDraftHistory && getDisplayTeamNameFromContext && nflState && uniqueTeamsForChart) {
                const uniqueOwnerIdsForChart = Array.from(new Set(Object.keys(historicalData.rostersBySeason).flatMap(y => (historicalData.rostersBySeason[y] || []).map(r => r.owner_id))));
                const tempHistoricalDataForYear = {
                    matchupsBySeason: {},
                    rostersBySeason: {},
                    leaguesMetadataBySeason: {},
                    winnersBracketBySeason: {},
                    losersBracketBySeason: {},
                    usersBySeason: {}
                };
                Object.keys(historicalData.matchupsBySeason).forEach(yearKey => {
                    const yearNum = parseInt(yearKey);
                    if (yearNum <= year) {
                        tempHistoricalDataForYear.matchupsBySeason[yearKey] = historicalData.matchupsBySeason[yearKey];
                        tempHistoricalDataForYear.rostersBySeason[yearKey] = historicalData.rostersBySeason[yearKey];
                        tempHistoricalDataForYear.leaguesMetadataBySeason[yearKey] = historicalData.leaguesMetadataBySeason[yearKey];
                        tempHistoricalDataForYear.winnersBracketBySeason[yearKey] = historicalData.winnersBracketBySeason[yearKey];
                        tempHistoricalDataForYear.losersBracketBySeason[yearKey] = historicalData.losersBracketBySeason[yearKey];
                        tempHistoricalDataForYear.usersBySeason[yearKey] = historicalData.usersBySeason[yearKey];
                    }
                });
                const { careerDPRData: cumulativeCareerDPRDataForYear } = calculateAllLeagueMetrics(tempHistoricalDataForYear, allDraftHistory, getDisplayTeamNameFromContext, nflState);
                dprList = uniqueOwnerIdsForChart.map(ownerId => {
                    const dprObj = cumulativeCareerDPRDataForYear.find(dpr => dpr.ownerId === ownerId);
                    return {
                        ownerId,
                        dpr: dprObj ? dprObj.dpr : undefined,
                        teamName: getDisplayTeamNameFromContext(ownerId, null)
                    };
                });
            }
            // Build a map from ownerId to DPR
            const dprMapByOwnerId = {};
            dprList.forEach(item => {
                dprMapByOwnerId[item.ownerId] = item.dpr;
            });
            // Map payload to ownerId by matching team name to dprList
            const teamRanks = payload.map((entry) => {
                // Try to find ownerId by matching team name in dprList
                let ownerId = undefined;
                if (dprList && dprList.length > 0) {
                    const found = dprList.find(item => item.teamName === entry.name);
                    if (found) ownerId = found.ownerId;
                }
                return {
                    team: entry.name,
                    rank: yearData ? yearData[entry.name] : undefined,
                    color: entry.color,
                    ownerId
                };
            });
            // Sort by rank ascending (1 = best)
            teamRanks.sort((a, b) => a.rank - b.rank);

            return (
                <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
                    <p className="font-bold text-gray-800 mb-1">{`Year: ${label}`}</p>
                    {teamRanks.map((entry, index) => (
                        <p key={`item-${index}`} style={{ color: entry.color }}>
                            {entry.team}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Generate ticks and domain for Y-axis based on rankings (1 = best, 12 = worst)
    const numTeams = uniqueTeamsForChart.length;
    const yAxisTicks = [];
    for (let t = 1; t <= numTeams; t++) {
        yAxisTicks.push(t);
    }


    // Sorting logic for all-time standings
    const getSortedStandings = () => {
        const sorted = [...allTimeStandings];
        sorted.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            // For team name, sort alphabetically
            if (sortBy === 'team') {
                aVal = aVal?.toLowerCase() || '';
                bVal = bVal?.toLowerCase() || '';
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            }
            // For seasons, sort by number of seasons played
            if (sortBy === 'seasons') {
                const aCount = a.seasons?.props?.children?.[1]?.props?.children || 0;
                const bCount = b.seasons?.props?.children?.[1]?.props?.children || 0;
                return sortOrder === 'asc' ? aCount - bCount : bCount - aCount;
            }
            // For awards, sort by championships, then runnerUps, then thirdPlace
            if (sortBy === 'awards') {
                const aAwards = a.awards || {};
                const bAwards = b.awards || {};
                if (aAwards.championships !== bAwards.championships) return sortOrder === 'asc' ? aAwards.championships - bAwards.championships : bAwards.championships - aAwards.championships;
                if (aAwards.runnerUps !== bAwards.runnerUps) return sortOrder === 'asc' ? aAwards.runnerUps - bAwards.runnerUps : bAwards.runnerUps - aAwards.runnerUps;
                if (aAwards.thirdPlace !== bAwards.thirdPlace) return sortOrder === 'asc' ? aAwards.thirdPlace - bAwards.thirdPlace : bAwards.thirdPlace - aAwards.thirdPlace;
                return 0;
            }
            // For numbers, sort numerically
            aVal = typeof aVal === 'string' ? parseFloat(aVal) : aVal;
            bVal = typeof bVal === 'string' ? parseFloat(bVal) : bVal;
            if (isNaN(aVal)) aVal = 0;
            if (isNaN(bVal)) bVal = 0;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return sorted;
    };

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

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
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('rank')}>
                                            Rank {sortBy === 'rank' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('team')}>
                                            Team {sortBy === 'team' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('seasons')}>
                                            Seasons {sortBy === 'seasons' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('totalDPR')}>
                                            Career DPR {sortBy === 'totalDPR' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('record')}>
                                            Record {sortBy === 'record' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('winPercentage')}>
                                            Win % {sortBy === 'winPercentage' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                        <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap cursor-pointer" onClick={() => handleSort('awards')}>
                                            Awards {sortBy === 'awards' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedStandings().map((team, index) => {
                                        // Get team details (name, avatar) using ownerId
                                        const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, null) : { name: team.team, avatar: undefined };
                                        return (
                                            <tr key={team.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center font-semibold whitespace-nowrap">{index + 1}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 font-semibold whitespace-nowrap flex items-center gap-2">
                                                    {teamDetails.avatar && (
                                                        <img
                                                            src={teamDetails.avatar}
                                                            alt={teamDetails.name + ' logo'}
                                                            className="w-8 h-8 rounded-full border border-gray-300 mr-2 bg-white object-cover"
                                                            onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }}
                                                        />
                                                    )}
                                                    {onTeamNameClick ? (
                                                        <button
                                                            onClick={() => onTeamNameClick(team.team)}
                                                            className="text-gray-800 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 text-left"
                                                        >
                                                            {team.team}
                                                        </button>
                                                    ) : (
                                                        team.team
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{team.seasons}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(team.totalDPR)}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{team.record}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{formatPercentage(team.winPercentage)}</td>
                                                <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                                    <div className="flex justify-center items-center gap-2 whitespace-nowrap">
                                                        {team.awards.championships > 0 && (
                                                            <span title={`Sween Bowl Championship${team.awards.championshipsYears.length > 0 ? ' (' + team.awards.championshipsYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-yellow-500 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.championships}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.runnerUps > 0 && (
                                                            <span title={`Sween Bowl Runner-Up${team.awards.runnerUpsYears.length > 0 ? ' (' + team.awards.runnerUpsYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-gray-400 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.runnerUps}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.thirdPlace > 0 && (
                                                            <span title={`3rd Place Finish${team.awards.thirdPlaceYears.length > 0 ? ' (' + team.awards.thirdPlaceYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-trophy text-amber-800 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.thirdPlace}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.firstPoints > 0 && (
                                                            <span title={`1st Place - Points${team.awards.firstPointsYears.length > 0 ? ' (' + team.awards.firstPointsYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-yellow-500 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.firstPoints}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.secondPoints > 0 && (
                                                            <span title={`2nd Place - Points${team.awards.secondPointsYears.length > 0 ? ' (' + team.awards.secondPointsYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-gray-400 text-lg"></i>
                                                                <span className="text-xs font-medium">{team.awards.secondPoints}x</span>
                                                            </span>
                                                        )}
                                                        {team.awards.thirdPoints > 0 && (
                                                            <span title={`3rd Place - Points${team.awards.thirdPointsYears.length > 0 ? ' (' + team.awards.thirdPointsYears.join(', ') + ')' : ''}`} className="flex items-center space-x-1 whitespace-nowrap">
                                                                <i className="fas fa-medal text-amber-800 text-lg"></i>
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
                                            console.log(`LeagueHistory: Season Awards - Year: ${year}, Champion: ${awards.champion}, PointsChamp: ${awards.pointsChamp}`); // NEW LOG
                                            return (
                                                <tr key={year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold text-center whitespace-nowrap">{year}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.champion}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.secondPlace}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.thirdPlace}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsChamp}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsSecond}</td>
                                                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsThird}</td>
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
                                        label={{ value: "Rank (1 = Best)", angle: -90, position: "insideLeft", offset: 0 }}
                                        domain={[1, numTeams]}
                                        tickFormatter={value => `#${value}`}
                                        ticks={yAxisTicks}
                                        reversed={true}
                                        allowDataOverflow={true}
                                        padding={{ top: 10, bottom: 10 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    {uniqueTeamsForChart.map((team, index) => (
                                        <Line
                                            key={team}
                                            type="monotone"
                                            dataKey={team} // Now directly uses the team name which holds the DPR value
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
