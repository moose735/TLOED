// PowerRankings.js
import React, { useState, useEffect } from 'react';
// Import the utility for calculating league metrics (DPR) and its helper calculateRawDPR
import { calculateAllLeagueMetrics, calculateRawDPR } from '../utils/calculations';
// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to format DPR value (now to three decimal places)
const formatDPR = (dpr) => {
    if (typeof dpr !== 'number' || isNaN(dpr)) return 'N/A';
    return dpr.toFixed(3); // Format to three decimal decimals
};

// Helper function to render record (W-L, without ties)
const renderRecordNoTies = (wins, losses) => {
    return `${wins || 0}-${losses || 0}`;
};

// Helper function to format points
const formatPoints = (points) => {
    if (typeof points !== 'number' || isNaN(points)) return 'N/A';
    return points.toFixed(2); // Format to two decimals
};

// Helper function to format luck rating
const formatLuckRating = (luck) => {
    if (typeof luck !== 'number' || isNaN(luck)) return 'N/A';
    // Luck rating can be positive or negative, display with sign and two decimals
    return luck.toFixed(3);
};

// Color palette for chart lines - a diverse set for multiple teams
const CHART_COLORS = [
    '#8884d8', // Violet
    '#82ca9d', // Green
    '#ffc658', // Yellow
    '#ff7300', // Orange
    '#00c49f', // Teal
    '#ff0000', // Red
    '#0088fe', // Blue
    '#bb3f85', // Pink
    '#7a421a', // Brown
    '#4a4a4a', // Dark Gray
    '#a5d6a7', // Light Green
    '#ef9a9a'  // Light Red
];

// Custom Tooltip Component for sorting by DPR
const CustomDPRRankTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Each entry in payload now has a 'dprValue' property for sorting
        const sortedPayload = [...payload].sort((a, b) => b.payload.dprValues[a.name] - b.payload.dprValues[b.name]);

        return (
            <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
                <p className="font-bold text-gray-800 mb-2">Week: {label}</p>
                {sortedPayload.map((entry, index) => (
                    // Display Rank and the actual DPR value for context
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


    useEffect(() => {
        if (!historicalMatchups || historicalMatchups.length === 0) {
            setPowerRankings([]);
            setWeeklyChartData([]);
            setChartTeams([]);
            setLoading(false);
            setError("No historical matchup data available to calculate power rankings or chart data.");
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
                setError("No valid years found in historical data to determine the  season for power rankings.");
                setLoading(false);
                return;
            }

            const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

            if (!seasonalMetrics[newestYear]) {
                setError(`No seasonal data available for the newest year (${newestYear}) to calculate power rankings table.`);
                setLoading(false);
                return;
            }

            const yearData = seasonalMetrics[newestYear]; // This was missing in the previous snippet, crucial for initialCalculatedRankings
            let initialCalculatedRankings = Object.keys(yearData)
                .map(teamName => ({
                    team: teamName,
                    dpr: yearData[teamName].adjustedDPR || 0,
                    wins: yearData[teamName].wins || 0,
                    losses: yearData[teamName].losses || 0,
                    ties: yearData[teamName].ties || 0,
                    pointsFor: yearData[teamName].pointsFor || 0,
                    pointsAgainst: yearData[teamName].pointsAgainst || 0,
                    luckRating: yearData[teamName].luckRating || 0,
                    year: newestYear,
                }));


            // --- Chart Data Preparation (Weekly Cumulative Adjusted DPR and Rank) ---
            const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
            const uniqueTeamsInNewestYear = Array.from(new Set(
                newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)])
            )).filter(teamName => teamName && teamName.trim() !== '');

            const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);

            const weeklyDPRsChartData = [];

            const cumulativeTeamStats = {};
            uniqueTeamsInNewestYear.forEach(team => {
                cumulativeTeamStats[team] = { totalPF: 0, wins: 0, losses: 0, ties: 0, gamesPlayed: 0, scores: [] };
            });

            let cumulativeLeagueScores = [];

            for (let week = 1; week <= maxWeek; week++) {
                const weeklyEntry = { week: week, dprValues: {} };
                const matchesInCurrentWeek = newestYearMatchups.filter(match => parseInt(match.week) === week);

                matchesInCurrentWeek.forEach(match => {
                    const team1 = getDisplayTeamName(match.team1);
                    const team2 = getDisplayTeamName(match.team2);
                    const team1Score = parseFloat(match.team1Score);
                    const team2Score = parseFloat(match.team2Score);

                    if (!isNaN(team1Score) && !isNaN(team2Score)) {
                        const isTie = team1Score === team2Score;
                        const team1Won = team1Score > team2Score;

                        if (cumulativeTeamStats[team1]) {
                            cumulativeTeamStats[team1].totalPF += team1Score;
                            cumulativeTeamStats[team1].gamesPlayed += 1;
                            cumulativeTeamStats[team1].scores.push(team1Score);
                            if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                                if (isTie) cumulativeTeamStats[team1].ties += 1;
                                else if (team1Won) cumulativeTeamStats[team1].wins += 1;
                                else cumulativeTeamStats[team1].losses += 1;
                            }
                        }
                        if (cumulativeTeamStats[team2]) {
                            cumulativeTeamStats[team2].totalPF += team2Score;
                            cumulativeTeamStats[team2].gamesPlayed += 1;
                            cumulativeTeamStats[team2].scores.push(team2Score);
                            if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                                if (isTie) cumulativeTeamStats[team2].ties += 1;
                                else if (!team1Won) cumulativeTeamStats[team2].wins += 1;
                                else cumulativeTeamStats[team2].losses += 1;
                            }
                        }
                        cumulativeLeagueScores.push(team1Score, team2Score);
                    }
                });

                const leagueMaxScore_Cumulative = cumulativeLeagueScores.length > 0 ? Math.max(...cumulativeLeagueScores) : 0;
                const leagueMinScore_Cumulative = cumulativeLeagueScores.length > 0 ? Math.min(...cumulativeLeagueScores) : 0;

                let totalRawDPRForWeek = 0;
                let teamsCountForWeeklyDPR = 0;
                const currentWeekTeamDPRs = [];

                uniqueTeamsInNewestYear.forEach(team => {
                    const teamStats = cumulativeTeamStats[team];
                    if (teamStats && teamStats.gamesPlayed > 0) {
                        const teamWinPercentage = (teamStats.wins + 0.5 * teamStats.ties) / teamStats.gamesPlayed;
                        const rawDPR = calculateRawDPR(
                            teamStats.totalPF,
                            teamWinPercentage,
                            leagueMaxScore_Cumulative,
                            leagueMinScore_Cumulative
                        );
                        if (!isNaN(rawDPR)) {
                            totalRawDPRForWeek += rawDPR;
                            teamsCountForWeeklyDPR++;
                        }
                        currentWeekTeamDPRs.push({ team, dpr: rawDPR });
                    } else {
                        currentWeekTeamDPRs.push({ team, dpr: 0 });
                    }
                });

                const avgRawDPRForWeek = teamsCountForWeeklyDPR > 0 ? totalRawDPRForWeek / teamsCountForWeeklyDPR : 0;

                const rankedTeamsForWeek = currentWeekTeamDPRs
                    .map(teamDPR => {
                        let adjustedDPR = 0;
                        if (avgRawDPRForWeek > 0) {
                            adjustedDPR = teamDPR.dpr / avgRawDPRForWeek;
                        }
                        return { team: teamDPR.team, dpr: adjustedDPR };
                    })
                    .sort((a, b) => b.dpr - a.dpr);

                rankedTeamsForWeek.forEach((rankedTeam, index) => {
                    weeklyEntry[rankedTeam.team] = index + 1;
                    weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr;
                });
                
                weeklyDPRsChartData.push(weeklyEntry);
            }

            // --- DEBUG LOGS START ---
            console.log("--- DEBUG: weeklyDPRsChartData ---");
            console.log(weeklyDPRsChartData);
            console.log("-----------------------------------");
            // --- DEBUG LOGS END ---


            setWeeklyChartData(weeklyDPRsChartData);
            
            const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
                weeklyDPRsChartData.some(weekData => weekData[team] !== 0)
            );
            setChartTeams(activeChartTeams);
            setMaxTeamsInChart(activeChartTeams.length > 0 ? activeChartTeams.length : 1);

            // --- Calculate Movement for the Power Rankings Table ---
                       const currentWeekDataForTable = weeklyDPRsChartData[weeklyDPRsChartData.length - 1];
            const previousWeekDataForTable = weeklyDPRsChartData.length > 1 ? weeklyDPRsChartData[weeklyDPRsChartData.length - 2] : null;

            // --- DEBUG LOGS START ---
            console.log("--- DEBUG: currentWeekDataForTable ---");
            console.log(currentWeekDataForTable);
            console.log("--- DEBUG: previousWeekDataForTable ---");
            console.log(previousWeekDataForTable);
            console.log("--------------------------------------");
            // --- DEBUG LOGS END ---

            const currentRanksMap = {};
            if (currentWeekDataForTable) {
                uniqueTeamsInNewestYear.forEach(team => {
                    // Ensure currentRank defaults to 0 if not found, or is converted to a number
                    currentRanksMap[team] = parseFloat(currentWeekDataForTable[team]) || 0;
                });
            }

            // Re-map initialCalculatedRankings to add current rank and movement
            const finalCalculatedRankings = initialCalculatedRankings
                .map(team => {
                    // Get current rank, defaulting to 0 if not found
                    const currentRank = currentRanksMap[team.team] || 0;
                    let movement = 0; // Default movement to 0

                    // --- DEBUG LOGS START FOR EACH TEAM (for final check) ---
                    console.log(`--- FINAL DEBUG: Team: ${team.team} ---`);
                    console.log(`  Current Rank (from map): ${currentRank}`);
                    // --- DEBUG LOGS END ---

                    if (previousWeekDataForTable) { // Only calculate movement if a previous week exists
                        // Get previous rank, ensuring it's a number, default to 0 if not found or invalid
                        const previousRank = parseFloat(previousWeekDataForTable[team.team]) || 0;

                        // --- DEBUG LOGS START FOR EACH TEAM ---
                        console.log(`  Previous Rank (from map): ${previousRank}`);
                        // --- DEBUG LOGS END ---

                        // Calculate movement only if both ranks are valid numbers (and not zero for initial state)
                        if (currentRank !== 0 && previousRank !== 0) { // Only calculate if both ranks are meaningful
                            movement = previousRank - currentRank;
                        }
                        // If currentRank or previousRank is 0 (meaning no rank, or initial state), movement remains 0
                    }
                    
                    // --- DEBUG LOGS START FOR EACH TEAM ---
                    console.log(`  Calculated Movement: ${movement}`);
                    // --- DEBUG LOGS END ---

                    return { ...team, currentRank: currentRank, movement: movement };
                })
                .sort((a, b) => b.dpr - a.dpr); // Still sort by DPR for the table display

            // Finally, assign the display rank based on the sorted order for the table
            setPowerRankings(finalCalculatedRankings.map((team, index) => ({ rank: index + 1, ...team })));


            setLoading(false);

        } catch (err) {
            console.error("Error calculating power rankings or chart data:", err);
            setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate.`);
            setLoading(false);
        }
    }, [historicalMatchups, getDisplayTeamName]);

    // Helper function to render movement
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
                {powerRankings.length > 0 ? `Power Rankings (DPR) - ${powerRankings[0].year} Season` : 'Current Power Rankings'}
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
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Movement</th> {/* NEW COLUMN HEADER */}
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
                                        <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderMovement(row.movement)}</td> {/* NEW COLUMN CELL */}
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

                    {/* Line Graph for Weekly DPR Rank */}
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
                                        domain={[1, maxTeamsInChart]} // Set domain from 1 (top) to max (bottom)
                                        ticks={Array.from({ length: maxTeamsInChart }, (_, i) => i + 1)} // Show ticks for each rank
                                        allowDecimals={false} // Ranks are integers
                                        reversed={true} // Explicitly reverse the axis to put 1 at top
                                        interval={0} // Force all labels to show
                                    />
                                    <Tooltip content={<CustomDPRRankTooltip />} /> {/* Using custom tooltip */}
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
