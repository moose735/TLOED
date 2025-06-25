// PowerRankings.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CURRENT_LEAGUE_ID, fetchUsersData, getSleeperAvatarUrl } from '../utils/sleeperApi'; // Import Sleeper API functions

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
        const sortedPayload = [...payload].sort((a, b) => a.value - b.value);
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
    const [currentWeek, setCurrentWeek] = useState(0);
    const [sleeperUsersMap, setSleeperUsersMap] = useState({}); // Stores Sleeper user data by userId

    // This map links your historical team names (e.g., "Irwin") to Sleeper User IDs.
    // YOU WILL NEED TO EXPAND THIS MAP FOR ALL YOUR TEAMS.
    const teamNameToSleeperIdMap = {
      'Irwin': '467074573125283840', // Example: 'Historical Name' -> 'Sleeper User ID'
      // Add other team mappings here: 'Another Team Name': 'another_sleeper_user_id',
    };

    useEffect(() => {
        const loadPowerRankingsAndSleeperData = async () => {
            if (!historicalMatchups || historicalMatchups.length === 0) {
                setPowerRankings([]);
                setWeeklyChartData([]);
                setChartTeams([]);
                setLoading(false);
                setError("No historical matchup data available to calculate power rankings or chart data.");
                setCurrentWeek(0);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch Sleeper user data
                const users = await fetchUsersData(CURRENT_LEAGUE_ID);
                const usersMap = {};
                users.forEach(user => {
                    usersMap[user.userId] = user;
                });
                setSleeperUsersMap(usersMap);

                const allYears = historicalMatchups
                    .map(match => parseInt(match.year))
                    .filter(year => !isNaN(year));
                const newestYear = allYears.length > 0 ? Math.max(...allYears) : null;

                if (!newestYear) {
                    setError("No valid years found in historical data to determine the season for power rankings.");
                    setLoading(false);
                    setCurrentWeek(0);
                    return;
                }

                const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
                const uniqueTeamsInNewestYear = Array.from(new Set(
                    newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)])
                )).filter(teamName => teamName && teamName.trim() !== '');

                const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);
                setCurrentWeek(maxWeek);

                const weeklyDPRsChartData = [];
                const weeklyCumulativeSeasonalMetrics = {};

                for (let week = 1; week <= maxWeek; week++) {
                    const matchupsUpToCurrentWeek = newestYearMatchups.filter(match => parseInt(match.week) <= week);

                    const { seasonalMetrics: currentWeekSeasonalMetrics } = calculateAllLeagueMetrics(matchupsUpToCurrentWeek, getDisplayTeamName);

                    weeklyCumulativeSeasonalMetrics[week] = currentWeekSeasonalMetrics[newestYear] || {};

                    const weeklyEntry = { week: week, dprValues: {} };
                    const teamsDPRsForThisWeek = [];

                    uniqueTeamsInNewestYear.forEach(teamName => {
                        const teamData = currentWeekSeasonalMetrics[newestYear] ? currentWeekSeasonalMetrics[newestYear][teamName] : null;
                        if (teamData && teamData.adjustedDPR !== undefined && !isNaN(teamData.adjustedDPR)) {
                            teamsDPRsForThisWeek.push({ team: teamName, dpr: teamData.adjustedDPR });
                        } else {
                            teamsDPRsForThisWeek.push({ team: teamName, dpr: 0 });
                        }
                    });

                    const rankedTeamsForWeek = teamsDPRsForThisWeek.sort((a, b) => b.dpr - a.dpr);

                    rankedTeamsForWeek.forEach((rankedTeam, index) => {
                        if (rankedTeam.dpr > 0 || (weeklyCumulativeSeasonalMetrics[week][rankedTeam.team] && weeklyCumulativeSeasonalMetrics[week][rankedTeam.team].gamesPlayed > 0)) {
                            weeklyEntry[rankedTeam.team] = index + 1;
                        } else {
                            weeklyEntry[rankedTeam.team] = undefined;
                        }
                        weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr;
                    });

                    weeklyDPRsChartData.push(weeklyEntry);
                }

                setWeeklyChartData(weeklyDPRsChartData);

                const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
                    weeklyDPRsChartData.some(weekData => weekData[team] !== undefined)
                );
                setChartTeams(activeChartTeams);
                setMaxTeamsInChart(uniqueTeamsInNewestYear.length > 0 ? uniqueTeamsInNewestYear.length : 1);


                const finalPowerRankingsForTable = uniqueTeamsInNewestYear
                    .map(teamName => {
                        const fullSeasonMetrics = weeklyCumulativeSeasonalMetrics[maxWeek] ? weeklyCumulativeSeasonalMetrics[maxWeek][teamName] : {};

                        const currentRankInChart = weeklyDPRsChartData.length > 0
                            ? (weeklyDPRsChartData[weeklyDPRsChartData.length - 1][teamName] || 0)
                            : 0;

                        let previousRankInChart = 0;
                        if (weeklyDPRsChartData.length > 1) {
                            for (let i = weeklyDPRsChartData.length - 2; i >= 0; i--) {
                                if (weeklyDPRsChartData[i][teamName] !== undefined && weeklyDPRsChartData[i][teamName] !== null && weeklyDPRsChartData[i][teamName] !== 0) {
                                    previousRankInChart = weeklyDPRsChartData[i][teamName];
                                    break;
                                }
                            }
                        }

                        let movement = 0;
                        if (currentRankInChart !== 0 && previousRankInChart !== 0) {
                            movement = previousRankInChart - currentRankInChart;
                        }

                        return {
                            team: teamName, // This is the historical display name (e.g., "Irwin")
                            rank: currentRankInChart,
                            movement: movement,
                            dpr: fullSeasonMetrics.adjustedDPR || 0,
                            wins: fullSeasonMetrics.wins || 0,
                            losses: fullSeasonMetrics.losses || 0,
                            ties: fullSeasonMetrics.ties || 0,
                            pointsFor: fullSeasonMetrics.pointsFor || 0,
                            pointsAgainst: fullSeasonMetrics.pointsAgainst || 0,
                            luckRating: fullSeasonMetrics.luckRating || 0,
                            year: newestYear,
                        };
                    })
                    .filter(team => team.rank !== 0 && team.rank !== undefined)
                    .sort((a, b) => a.rank - b.rank);

                setPowerRankings(finalPowerRankingsForTable);
                setLoading(false);

            } catch (err) {
                console.error("Error calculating power rankings or chart data:", err);
                setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate.`);
                setLoading(false);
            }
        };

        loadPowerRankingsAndSleeperData();
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
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th> {/* This will now include avatar */}
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L)</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {powerRankings.map((row, rowIndex) => {
                                    const sleeperUserId = teamNameToSleeperIdMap[row.team];
                                    const sleeperTeamData = sleeperUsersMap[sleeperUserId];
                                    // Debugging logs - Check your browser console for these values!
                                    console.log(`Processing team: ${row.team}`);
                                    console.log(`  Mapped Sleeper User ID: ${sleeperUserId}`);
                                    console.log(`  Sleeper Team Data (from map):`, sleeperTeamData);

                                    const displayTeamName = sleeperTeamData ? sleeperTeamData.teamName : row.team;
                                    const avatarUrl = sleeperTeamData ? getSleeperAvatarUrl(sleeperTeamData.avatar) : getSleeperAvatarUrl(''); // Always get a URL, even if a placeholder
                                    console.log(`  Display Team Name: ${displayTeamName}`);
                                    console.log(`  Avatar URL: ${avatarUrl}`);


                                    return (
                                        <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderMovement(row.movement)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                <div className="flex items-center space-x-2">
                                                    {/* The img tag will now always have a src due to getSleeperAvatarUrl's fallback */}
                                                    <img src={avatarUrl} alt={`${displayTeamName}'s avatar`} className="w-8 h-8 rounded-full object-cover" />
                                                    <span>{displayTeamName}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatDPR(row.dpr)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderRecordNoTies(row.wins, row.losses)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsFor)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsAgainst)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatLuckRating(row.luckRating)}</td>
                                        </tr>
                                    );
                                })}
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
