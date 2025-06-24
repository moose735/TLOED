// PowerRankings.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics, calculateRawDPR } from '../utils/calculations'; // Ensure these are correctly imported
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatDPR = (dpr) => {
    if (typeof dpr !== 'number' || isNaN(dpr)) return 'N/A';
    return dpr.toFixed(3);
};

const renderRecordNoTies = (wins, losses) => {
    return `${wins || 0}-${losses || 0}`;
};

const formatPoints = (points) => {
    if (typeof points !== 'number' || isNaN(points)) return 'N/A';
    return points.toFixed(2);
};

const formatLuckRating = (luck) => {
    if (typeof luck !== 'number' || isNaN(luck)) return 'N/A';
    return luck.toFixed(3);
};

const CHART_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
    '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

const CustomDPRRankTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Change this line to sort in ascending order of rank (entry.value)
        const sortedPayload = [...payload].sort((a, b) => a.value - b.value); // Flipped sorting order
        return (
            <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
                <p className="font-bold text-gray-800 mb-2">Week: {label}</p>
                {sortedPayload.map((entry, index) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {entry.name}: Rank {entry.value} ({entry.payload.dprValues[entry.name].toFixed(3)} DPR)
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
    const [powerRankings, setPowerRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [weeklyChartData, setWeeklyChartData] = useState([]);
    const [chartTeams, setChartTeams] = useState([]);
    const [maxTeamsInChart, setMaxTeamsInChart] = useState(1);
    const [currentWeek, setCurrentWeek] = useState(0); // New state for current week

    useEffect(() => {
        if (!historicalMatchups || historicalMatchups.length === 0) {
            setPowerRankings([]);
            setWeeklyChartData([]);
            setChartTeams([]);
            setLoading(false);
            setError("No historical matchup data available to calculate power rankings or chart data.");
            setCurrentWeek(0); // Reset current week
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const allYears = historicalMatchups
                .map(match => parseInt(match.year))
                .filter(year => !isNaN(year));
            const newestYear = allYears.length > 0 ? Math.max(...allYears) : null;

            if (!newestYear) {
                setError("No valid years found in historical data to determine the season for power rankings.");
                setLoading(false);
                setCurrentWeek(0); // Reset current week
                return;
            }

            const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
            const uniqueTeamsInNewestYear = Array.from(new Set(
                newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)])
            )).filter(teamName => teamName && teamName.trim() !== '');

            const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);
            setCurrentWeek(maxWeek); // Set the current week here

            const weeklyDPRsChartData = [];
            const weeklyCumulativeSeasonalMetrics = {}; // Store full seasonalMetrics per week

            for (let week = 1; week <= maxWeek; week++) {
                const matchupsUpToCurrentWeek = newestYearMatchups.filter(match => parseInt(match.week) <= week);
                
                // Recalculate seasonal metrics for the league up to this week
                const { seasonalMetrics: currentWeekSeasonalMetrics } = calculateAllLeagueMetrics(matchupsUpToCurrentWeek, getDisplayTeamName);
                
                // Store these complete weekly metrics for later access (e.g., for table data or debugging)
                weeklyCumulativeSeasonalMetrics[week] = currentWeekSeasonalMetrics[newestYear] || {};

                const weeklyEntry = { week: week, dprValues: {} };
                const teamsDPRsForThisWeek = [];

                // Extract and rank DPRs for teams based on currentWeekSeasonalMetrics
                uniqueTeamsInNewestYear.forEach(teamName => {
                    const teamData = currentWeekSeasonalMetrics[newestYear] ? currentWeekSeasonalMetrics[newestYear][teamName] : null;
                    if (teamData && teamData.adjustedDPR !== undefined && !isNaN(teamData.adjustedDPR)) {
                        teamsDPRsForThisWeek.push({ team: teamName, dpr: teamData.adjustedDPR });
                    } else {
                        teamsDPRsForThisWeek.push({ team: teamName, dpr: 0 }); // Team might not have played yet or has no stats
                    }
                });

                // Sort and assign ranks based on DPR for the current week's cumulative data
                const rankedTeamsForWeek = teamsDPRsForThisWeek.sort((a, b) => b.dpr - a.dpr);

                rankedTeamsForWeek.forEach((rankedTeam, index) => {
                    if (rankedTeam.dpr > 0 || (weeklyCumulativeSeasonalMetrics[week][rankedTeam.team] && weeklyCumulativeSeasonalMetrics[week][rankedTeam.team].gamesPlayed > 0)) {
                            weeklyEntry[rankedTeam.team] = index + 1; // This is the RANK
                    } else {
                            weeklyEntry[rankedTeam.team] = undefined; // No rank if no games played/DPR is 0
                    }
                    weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr; // Actual DPR value for tooltip
                });
                
                weeklyDPRsChartData.push(weeklyEntry);
            }

            setWeeklyChartData(weeklyDPRsChartData);
            
            const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
                weeklyDPRsChartData.some(weekData => weekData[team] !== undefined)
            );
            setChartTeams(activeChartTeams);
            setMaxTeamsInChart(uniqueTeamsInNewestYear.length > 0 ? uniqueTeamsInNewestYear.length : 1);


            // --- Prepare data for the Power Rankings Table (including Rank and Movement) ---
            const finalPowerRankingsForTable = uniqueTeamsInNewestYear
                .map(teamName => {
                    // Use the overall season metrics for the table's main stats
                    const fullSeasonMetrics = weeklyCumulativeSeasonalMetrics[maxWeek] ? weeklyCumulativeSeasonalMetrics[maxWeek][teamName] : {};

                    // Get the rank for the current (latest) week from weeklyDPRsChartData
                    const currentRankInChart = weeklyDPRsChartData.length > 0
                        ? (weeklyDPRsChartData[weeklyDPRsChartData.length - 1][teamName] || 0)
                        : 0;

                    let previousRankInChart = 0;
                    if (weeklyDPRsChartData.length > 1) {
                        // Iterate backward from the second-to-last week's *index* in weeklyDPRsChartData
                        for (let i = weeklyDPRsChartData.length - 2; i >= 0; i--) {
                            // Check if the rank for the team exists and is a valid rank (not 0 or undefined/null)
                            if (weeklyDPRsChartData[i][teamName] !== undefined && weeklyDPRsChartData[i][teamName] !== null && weeklyDPRsChartData[i][teamName] !== 0) {
                                previousRankInChart = weeklyDPRsChartData[i][teamName];
                                break; // Found the last valid rank before the current week
                            }
                        }
                    }

                    let movement = 0;
                    if (currentRankInChart !== 0 && previousRankInChart !== 0) {
                        // Movement is previous rank minus current rank (e.g., if previous was 5, current is 3, movement is +2)
                        movement = previousRankInChart - currentRankInChart;
                    }   
                    // If currentRank is 0, it means the team has no data for the latest week, so no movement.
                    // If previousRank is 0 and currentRank is not 0, it's considered a "new" entry for comparison,
                    // so we keep movement as 0 (or could add a "NEW" indicator if desired in the UI).

                    return {
                        team: teamName,
                        rank: currentRankInChart, // This is the current rank from the chart data
                        movement: movement,
                        dpr: fullSeasonMetrics.adjustedDPR || 0, // Overall season DPR for the table
                        wins: fullSeasonMetrics.wins || 0,
                        losses: fullSeasonMetrics.losses || 0,
                        ties: fullSeasonMetrics.ties || 0,
                        pointsFor: fullSeasonMetrics.pointsFor || 0,
                        pointsAgainst: fullSeasonMetrics.pointsAgainst || 0,
                        luckRating: fullSeasonMetrics.luckRating || 0,
                        year: newestYear,
                    };
                })
                // Filter out teams that have no rank in the current week (rank === 0 or undefined)
                .filter(team => team.rank !== 0 && team.rank !== undefined)
                .sort((a, b) => a.rank - b.rank); // Sort by the 'rank' derived from the chart data

            setPowerRankings(finalPowerRankingsForTable);
            setLoading(false);

        } catch (err) {
            console.error("Error calculating power rankings or chart data:", err);
            setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate.`);
            setLoading(false);
        }
    }, [historicalMatchups, getDisplayTeamName]);

    const renderMovement = (movement) => {
        if (movement === 0) {
            return <span className="text-gray-500">—</span>;
        } else if (movement > 0) {
            return (
                <span className="text-green-600 flex items-center justify-start">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                    {movement}
                </span>
            );
        } else { // movement < 0
            return (
                <span className="text-red-600 flex items-center justify-start">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                    {Math.abs(movement)}
                </span>
            );
        }
    };

    return (
        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">
                {powerRankings.length > 0
                    ? `Power Rankings (DPR) - ${powerRankings[0].year} Season (Week ${currentWeek})`
                    : 'Current Power Rankings'}
            </h2>
            {loading ? (
                <p className="text-center text-gray-600">Calculating power rankings...</p>
            ) : error ? (
                <p className="text-center text-red-500 font-semibold">{error}</p>
            ) : powerRankings.length > 0 ? (
                <>
                    <div className="overflow-x-auto mb-8">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                            <thead className="bg-blue-100">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Movement</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L)</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {powerRankings.map((row, rowIndex) => (
                                    <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderMovement(row.movement)}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.team}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatDPR(row.dpr)}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderRecordNoTies(row.wins, row.losses)}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsFor)}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsAgainst)}</td>
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatLuckRating(row.luckRating)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {weeklyChartData.length > 0 && (
                        <section className="mt-8">
                            <h3 className="text-xl font-bold text-blue-700 mb-4 text-center">
                                DPR Rank by Week - {powerRankings[0].year} Season
                            </h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart
                                    data={weeklyChartData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: 0 }} />
                                    <YAxis
                                        label={{ value: "Rank", angle: -90, position: "insideLeft" }}
                                        domain={[1, maxTeamsInChart]}
                                        ticks={Array.from({ length: maxTeamsInChart }, (_, i) => i + 1)}
                                        allowDecimals={false}
                                        reversed={true}
                                        interval={0}
                                    />
                                    <Tooltip content={<CustomDPRRankTooltip />} />
                                    <Legend />
                                    {chartTeams.map((team, index) => (
                                        <Line
                                            key={team}
                                            type="monotone"
                                            dataKey={team}
                                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                            activeDot={{ r: 8 }}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                            <p className="mt-4 text-sm text-gray-500 text-center">
                                This graph shows each team's rank based on their Dominance Power Ranking (DPR), calculated cumulatively based on all games played up to each specific week of the newest season. Rank 1 indicates the highest DPR.
                            </p>
                        </section>
                    )}
                </>
            ) : (
                <p className="text-center text-gray-600">No power rankings data found for the current season.</p>
            )}
            <p className="mt-4 text-sm text-gray-500 text-center">
                Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available.
            </p>
        </div>
    );
};

export default PowerRankings;
