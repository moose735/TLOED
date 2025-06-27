import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Reverted to recharts
import { CURRENT_LEAGUE_ID, fetchUsersData, getSleeperAvatarUrl, TEAM_NAME_TO_SLEEPER_ID_MAP, RETIRED_MANAGERS } from '../utils/sleeperApi'; // Import Sleeper API functions and maps


// Re-implemented calculateAllLeagueMetrics here, as original file was not provided
const calculateAllLeagueMetrics = (matchups, getDisplayTeamName) => {
    const seasonalMetrics = {};
    const teamWeeklyPoints = {}; // { year: { teamName: { week: points } } }

    matchups.forEach(match => {
        const year = match.year;
        const week = parseInt(match.week);
        const team1Name = getDisplayTeamName(match.team1); // Assuming team1/team2 are already display names or can be mapped
        const team2Name = getDisplayTeamName(match.team2);

        if (!seasonalMetrics[year]) {
            seasonalMetrics[year] = {};
            teamWeeklyPoints[year] = {};
        }
        if (!seasonalMetrics[year][team1Name]) {
            seasonalMetrics[year][team1Name] = {
                wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
                expectedWins: 0, luckRating: 0, adjustedDPR: 0, gamesPlayed: 0
            };
            teamWeeklyPoints[year][team1Name] = {};
        }
        if (!seasonalMetrics[year][team2Name]) {
            seasonalMetrics[year][team2Name] = {
                wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
                expectedWins: 0, luckRating: 0, adjustedDPR: 0, gamesPlayed: 0
            };
            teamWeeklyPoints[year][team2Name] = {};
        }

        const team1Points = match.team1_points || 0;
        const team2Points = match.team2_points || 0;

        // Update total points and games played
        seasonalMetrics[year][team1Name].pointsFor += team1Points;
        seasonalMetrics[year][team1Name].pointsAgainst += team2Points;
        seasonalMetrics[year][team1Name].gamesPlayed++;

        seasonalMetrics[year][team2Name].pointsFor += team2Points;
        seasonalMetrics[year][team2Name].pointsAgainst += team1Points;
        seasonalMetrics[year][team2Name].gamesPlayed++;

        // Update win/loss/tie
        if (team1Points > team2Points) {
            seasonalMetrics[year][team1Name].wins++;
            seasonalMetrics[year][team2Name].losses++;
        } else if (team2Points > team1Points) {
            seasonalMetrics[year][team2Name].wins++;
            seasonalMetrics[year][team1Name].losses++;
        } else {
            seasonalMetrics[year][team1Name].ties++;
            seasonalMetrics[year][team2Name].ties++;
        }

        // Store weekly points for luck calculation
        teamWeeklyPoints[year][team1Name][week] = team1Points;
        teamWeeklyPoints[year][team2Name][week] = team2Points;
    });

    // Calculate luck rating and DPR (simplified)
    for (const year in seasonalMetrics) {
        const teamsInYear = Object.keys(seasonalMetrics[year]);
        const weeklyScores = {}; // { week: [all_scores_in_week] }

        // Populate weeklyScores for luck rating calculation
        teamsInYear.forEach(teamName => {
            for (const week in teamWeeklyPoints[year][teamName]) {
                if (!weeklyScores[week]) {
                    weeklyScores[week] = [];
                }
                weeklyScores[week].push({ team: teamName, points: teamWeeklyPoints[year][teamName][week] });
            }
        });

        // Calculate expected wins and luck rating
        teamsInYear.forEach(teamName => {
            let totalExpectedWins = 0;
            for (const week in teamWeeklyPoints[year][teamName]) {
                const teamScore = teamWeeklyPoints[year][teamName][week];
                const otherScoresInWeek = weeklyScores[week].filter(s => s.team !== teamName);
                if (otherScoresInWeek.length > 0) {
                    const winsAgainstOthers = otherScoresInWeek.filter(s => teamScore > s.points).length;
                    const tiesAgainstOthers = otherScoresInWeek.filter(s => teamScore === s.points).length;
                    totalExpectedWins += (winsAgainstOthers + 0.5 * tiesAgainstOthers) / otherScoresInWeek.length;
                }
            }
            seasonalMetrics[year][teamName].expectedWins = totalExpectedWins;
            seasonalMetrics[year][teamName].luckRating = (seasonalMetrics[year][teamName].wins + (seasonalMetrics[year][teamName].ties * 0.5)) - totalExpectedWins;

            // Calculate adjusted DPR (a simple score based on points and record)
            const gamesPlayed = seasonalMetrics[year][teamName].gamesPlayed;
            if (gamesPlayed > 0) {
                const winRate = (seasonalMetrics[year][teamName].wins + (seasonalMetrics[year][teamName].ties * 0.5)) / gamesPlayed;
                const avgPointsFor = seasonalMetrics[year][teamName].pointsFor / gamesPlayed;
                const avgPointsAgainst = seasonalMetrics[year][teamName].pointsAgainst / gamesPlayed;

                // Simple DPR: Can be refined. Higher is better.
                seasonalMetrics[year][teamName].adjustedDPR = (avgPointsFor * 0.6) + (winRate * 50) - (avgPointsAgainst * 0.1);
            } else {
                seasonalMetrics[year][teamName].adjustedDPR = 0;
            }
        });
    }

    return { seasonalMetrics };
};

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

    useEffect(() => {
        const loadPowerRankingsAndSleeperData = async () => {
            // Check if historicalMatchups object is empty or undefined
            if (!historicalMatchups || Object.keys(historicalMatchups).length === 0) {
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
                // Fetch Sleeper user data for current league
                const users = await fetchUsersData(CURRENT_LEAGUE_ID);
                const usersMap = {};
                users.forEach(user => {
                    usersMap[user.userId] = user;
                });
                setSleeperUsersMap(usersMap);

                // Get the newest year from the historicalMatchups object keys
                const allYears = Object.keys(historicalMatchups).map(Number).filter(year => !isNaN(year));
                const newestYear = allYears.length > 0 ? Math.max(...allYears).toString() : null;

                if (!newestYear || !historicalMatchups[newestYear]) {
                    setError("No valid years or matchup data found for the newest season to determine power rankings.");
                    setLoading(false);
                    setCurrentWeek(0);
                    return;
                }

                // Flatten the matchups for the newest year into a single array
                const newestYearMatchupsFlat = Object.values(historicalMatchups[newestYear]).flat();

                const uniqueTeamsInNewestYear = Array.from(new Set(
                    newestYearMatchupsFlat.flatMap(match => [
                        getDisplayTeamName(match.team1_roster_id), // Use getDisplayTeamName on roster_id for resolution
                        getDisplayTeamName(match.team2_roster_id)
                    ])
                )).filter(teamName => teamName && teamName.trim() !== ''); // Filter out empty or invalid team names

                // Filter out retired managers if RETIRED_MANAGERS set is available
                const activeTeamsInNewestYear = uniqueTeamsInNewestYear.filter(teamName => {
                    // Try to get the Sleeper ID for the teamName
                    const sleeperId = TEAM_NAME_TO_SLEEPER_ID_MAP[teamName];
                    if (sleeperId) {
                        return !RETIRED_MANAGERS.has(teamName) && !RETIRED_MANAGERS.has(sleeperId);
                    }
                    // If not found in map, assume it's active unless explicitly in RETIRED_MANAGERS by display name
                    return !RETIRED_MANAGERS.has(teamName);
                });


                const maxWeek = newestYearMatchupsFlat.reduce((max, match) => Math.max(max, parseInt(match.week || 0)), 0);
                setCurrentWeek(maxWeek);

                const weeklyDPRsChartData = [];
                const weeklyCumulativeSeasonalMetrics = {};

                for (let week = 1; week <= maxWeek; week++) {
                    const matchupsUpToCurrentWeek = newestYearMatchupsFlat.filter(match => parseInt(match.week || 0) <= week);

                    // Map roster_ids to team names for calculateAllLeagueMetrics
                    const mappedMatchups = matchupsUpToCurrentWeek.map(match => ({
                        ...match,
                        team1: getDisplayTeamName(match.team1_roster_id),
                        team2: getDisplayTeamName(match.team2_roster_id)
                    }));

                    const { seasonalMetrics: currentWeekSeasonalMetrics } = calculateAllLeagueMetrics(mappedMatchups, getDisplayTeamName);

                    weeklyCumulativeSeasonalMetrics[week] = currentWeekSeasonalMetrics[newestYear] || {};

                    const weeklyEntry = { week: week, dprValues: {} };
                    const teamsDPRsForThisWeek = [];

                    activeTeamsInNewestYear.forEach(teamName => {
                        const teamData = currentWeekSeasonalMetrics[newestYear] ? currentWeekSeasonalMetrics[newestYear][teamName] : null;
                        if (teamData && teamData.adjustedDPR !== undefined && !isNaN(teamData.adjustedDPR)) {
                            teamsDPRsForThisWeek.push({ team: teamName, dpr: teamData.adjustedDPR });
                        } else {
                            teamsDPRsForThisWeek.push({ team: teamName, dpr: 0 });
                        }
                    });

                    // Sort by DPR to get ranks, higher DPR means lower rank number (1st, 2nd, etc.)
                    const rankedTeamsForWeek = teamsDPRsForThisWeek.sort((a, b) => b.dpr - a.dpr);

                    rankedTeamsForWeek.forEach((rankedTeam, index) => {
                        // Only show rank if team has played games (DPR > 0 or gamesPlayed > 0)
                        if (rankedTeam.dpr > 0 || (weeklyCumulativeSeasonalMetrics[week][rankedTeam.team] && weeklyCumulativeSeasonalMetrics[week][rankedTeam.team].gamesPlayed > 0)) {
                            weeklyEntry[rankedTeam.team] = index + 1; // Rank is 1-based
                        } else {
                            weeklyEntry[rankedTeam.team] = undefined; // No rank if no games played/DPR is 0
                        }
                        weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr;
                    });
                    weeklyDPRsChartData.push(weeklyEntry);
                }

                setWeeklyChartData(weeklyDPRsChartData);

                const activeChartTeams = activeTeamsInNewestYear.filter(team =>
                    weeklyDPRsChartData.some(weekData => weekData[team] !== undefined)
                );
                setChartTeams(activeChartTeams);
                setMaxTeamsInChart(activeTeamsInNewestYear.length > 0 ? activeTeamsInNewestYear.length : 1);


                const finalPowerRankingsForTable = activeTeamsInNewestYear
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
                            team: teamName,
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
                    .sort((a, b) => a.rank - b.rank); // Sort by rank

                setPowerRankings(finalPowerRankingsForTable);
                setLoading(false);

            } catch (err) {
                console.error("Error calculating power rankings or chart data:", err);
                setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate.`);
                setLoading(false);
            }
        };

        loadPowerRankingsAndSleeperData();
    }, [historicalMatchups, getDisplayTeamName]); // Rerun effect when historicalMatchups or getDisplayTeamName changes

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
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Change</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L)</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {powerRankings.map((row, rowIndex) => {
                                    // Use getDisplayTeamName to resolve the internal team name to the display name
                                    const displayTeamName = getDisplayTeamName(row.team);
                                    // Find the original internal team name (e.g., 'Ainsworth') from the display name
                                    // to use with TEAM_NAME_TO_SLEEPER_ID_MAP
                                    const internalTeamNameKey = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(key => 
                                        getDisplayTeamName(key) === displayTeamName
                                    );
                                    const sleeperUserId = internalTeamNameKey ? TEAM_NAME_TO_SLEEPER_ID_MAP[internalTeamNameKey] : null;
                                    const sleeperTeamData = sleeperUserId ? sleeperUsersMap[sleeperUserId] : null;
                                    const avatarUrl = sleeperTeamData ? sleeperTeamData.avatar : getSleeperAvatarUrl('');

                                    return (
                                        <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200 text-center">{renderMovement(row.movement)}</td>
                                            <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                                <div className="flex items-center space-x-2">
                                                    <img src={avatarUrl} alt={`${displayTeamName}'s avatar`} className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/cccccc/000000?text=NA"; }}/>
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
