import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { fetchNFLPlayers, fetchNFLState, fetchRostersWithDetails, TEAM_NAME_TO_SLEEPER_ID_MAP, RETIRED_MANAGERS } from '../utils/sleeperApi';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * Utility function to calculate Power Rankings.
 * This function is kept outside the component to avoid re-creation on every render.
 *
 * Power Ranking Calculation Logic:
 * 1. Win/Loss Record (weighted): Standard win/loss.
 * 2. Points For (weighted): Total points scored.
 * 3. Head-to-Head Dominance (weighted): Record against other teams.
 * 4. Roster Strength (weighted - mock for now): Placeholder for future actual roster strength.
 *
 * @param {Object} historicalMatchups Object keyed by season, then by week, containing matchup data.
 * @param {string} currentSeason The current season being displayed/analyzed.
 * @param {Object} allLeagueRosters Map of leagueId to array of roster objects (from fetchRostersWithDetails).
 * @returns {Array<Object>} Sorted array of power ranking objects.
 */
const calculatePowerRankings = (historicalMatchups, currentSeason, allLeagueRosters) => {
    if (!historicalMatchups || Object.keys(historicalMatchups).length === 0 || !currentSeason || !allLeagueRosters || !allLeagueRosters[currentSeason]) {
        console.warn("Insufficient data for Power Ranking calculation.");
        return [];
    }

    const seasonMatchups = historicalMatchups[currentSeason];
    const rosters = allLeagueRosters[currentSeason]; // Get rosters for the current season

    if (!seasonMatchups || Object.keys(seasonMatchups).length === 0 || !rosters || rosters.length === 0) {
        console.warn(`No matchup or roster data found for season ${currentSeason} for power ranking calculation.`);
        return [];
    }

    const teamStats = new Map(); // Map to store stats: teamName -> { wins, losses, pointsFor, totalGames, headToHeadRecord }

    // Initialize team stats from rosters
    rosters.forEach(roster => {
        // Ensure that only active managers (not retired) are included in current season power rankings
        const teamNameFromRoster = roster.ownerTeamName;
        // Check if this teamName is in the TEAM_NAME_TO_SLEEPER_ID_MAP and not in RETIRED_MANAGERS
        const internalTeamName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(key => TEAM_NAME_TO_SLEEPER_ID_MAP[key] === roster.owner_id);

        if (internalTeamName && !RETIRED_MANAGERS.has(internalTeamName)) {
             teamStats.set(roster.roster_id, {
                teamName: teamNameFromRoster,
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                totalGames: 0,
                headToHeadRecord: new Map(), // Map: opponentRosterId -> { wins, losses }
                rosterId: roster.roster_id // Store roster_id for easier lookup
            });
        } else {
            console.log(`Excluding retired or unmapped team from Power Rankings: ${roster.ownerTeamName} (Roster ID: ${roster.roster_id})`);
        }
    });


    Object.values(seasonMatchups).forEach(weekMatchups => { // Iterate through each week's matchups
        weekMatchups.forEach(match => {
            const team1RosterId = match.roster_id;
            const team1Points = match.points;

            // Find the opponent in the same matchup_id
            const opponent = weekMatchups.find(
                (m) => m.matchup_id === match.matchup_id && m.roster_id !== team1RosterId
            );

            if (opponent) {
                const team2RosterId = opponent.roster_id;
                const team2Points = opponent.points;

                const team1Stat = teamStats.get(team1RosterId);
                const team2Stat = teamStats.get(team2RosterId);

                if (team1Stat && team2Stat) { // Only process if both teams are in our active list
                    team1Stat.totalGames++;
                    team1Stat.pointsFor += team1Points;
                    team1Stat.pointsAgainst += team2Points;

                    team2Stat.totalGames++;
                    team2Stat.pointsFor += team2Points;
                    team2Stat.pointsAgainst += team1Points;

                    // Update win/loss
                    if (team1Points > team2Points) {
                        team1Stat.wins++;
                        team2Stat.losses++;
                    } else if (team2Points > team1Points) {
                        team2Stat.wins++;
                        team1Stat.losses++;
                    }
                    // Ties are implicitly handled if no win/loss update occurs

                    // Update head-to-head record
                    if (!team1Stat.headToHeadRecord.has(team2RosterId)) {
                        team1Stat.headToHeadRecord.set(team2RosterId, { wins: 0, losses: 0 });
                    }
                    if (!team2Stat.headToHeadRecord.has(team1RosterId)) {
                        team2Stat.headToHeadRecord.set(team1RosterId, { wins: 0, losses: 0 });
                    }

                    const h2h1 = team1Stat.headToHeadRecord.get(team2RosterId);
                    const h2h2 = team2Stat.headToHeadRecord.get(team1RosterId);

                    if (team1Points > team2Points) {
                        h2h1.wins++;
                        h2h2.losses++;
                    } else if (team2Points > team1Points) {
                        h2h2.wins++;
                        h2h1.losses++;
                    }
                }
            }
        });
    });

    const powerRankings = Array.from(teamStats.values()).map(stats => {
        const winLossScore = (stats.wins / Math.max(1, stats.totalGames)) * 0.4; // 40% weight
        const pointsForScore = (stats.pointsFor / Math.max(1, stats.totalGames)) * 0.3; // 30% weight (average points per game)
        // Simple mock for roster strength, can be replaced with actual logic
        const rosterStrengthScore = Math.random() * 0.3; // 30% weight, random for now

        // Total power score
        const totalScore = (winLossScore * 100) + (pointsForScore * 10) + (rosterStrengthScore * 10); // Adjust multipliers for scale

        return {
            teamName: stats.teamName,
            wins: stats.wins,
            losses: stats.losses,
            pointsFor: stats.pointsFor,
            totalScore: parseFloat(totalScore.toFixed(2)),
        };
    });

    // Sort by totalScore in descending order
    return powerRankings.sort((a, b) => b.totalScore - a.totalScore);
};


/**
 * Calculates historical power rankings for charting over seasons.
 * This will return an object where keys are seasons, and values are arrays of power rankings for that season.
 *
 * @param {Object} historicalMatchups Object keyed by season, then by week, containing matchup data.
 * @param {Object} allLeagueRosters Map of leagueId to array of roster objects (from fetchRostersWithDetails).
 * @returns {Object} Object keyed by season, containing arrays of power rankings for each season.
 */
const calculateHistoricalPowerRankings = (historicalMatchups, allLeagueRosters) => {
    const historicalRankings = {};
    if (!historicalMatchups || Object.keys(historicalMatchups).length === 0) {
        return historicalRankings;
    }

    const sortedSeasons = Object.keys(historicalMatchups).sort((a, b) => parseInt(a) - parseInt(b));

    sortedSeasons.forEach(season => {
        if (allLeagueRosters[season]) { // Ensure rosters exist for this season
            historicalRankings[season] = calculatePowerRankings(historicalMatchups, season, allLeagueRosters);
        } else {
            console.warn(`Skipping historical power rankings for season ${season}: No roster data available.`);
        }
    });

    return historicalRankings;
};

const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
    const [powerRankings, setPowerRankings] = useState([]);
    const [historicalChartData, setHistoricalChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nflPlayers, setNflPlayers] = useState({});
    const [nflState, setNflState] = useState({});
    const [allLeagueRosters, setAllLeagueRosters] = useState({}); // Store all historical rosters

    // Effect to fetch NFL data and all historical rosters
    useEffect(() => {
        const loadAuxiliaryData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch NFL Players and State
                const [players, state] = await Promise.all([
                    fetchNFLPlayers(),
                    fetchNFLState()
                ]);
                setNflPlayers(players);
                setNflState(state);

                // Fetch all historical rosters for all leagues
                const rostersByLeagueId = {};
                const leagueIdsToFetch = new Set();

                // Collect all unique league IDs present in historicalMatchups
                Object.keys(historicalMatchups).forEach(season => {
                    const seasonMatchups = historicalMatchups[season];
                    // Pick the first week's matchup to get a leagueId (assuming constant leagueId per season)
                    const firstWeek = Object.keys(seasonMatchups)[0];
                    if (firstWeek && seasonMatchups[firstWeek] && seasonMatchups[firstWeek].length > 0) {
                        const leagueId = seasonMatchups[firstWeek][0].league_id;
                        if (leagueId) {
                            leagueIdsToFetch.add(leagueId);
                        }
                    }
                });

                const rosterPromises = Array.from(leagueIdsToFetch).map(id => fetchRostersWithDetails(id));
                const fetchedRosters = await Promise.all(rosterPromises);

                // Map fetched rosters by league ID
                fetchedRosters.forEach(rostersArray => {
                    if (rostersArray.length > 0) {
                        rostersByLeagueId[rostersArray[0].league_id] = rostersArray; // Assuming league_id is consistent within the array
                    }
                });
                setAllLeagueRosters(rostersByLeagueId);

            } catch (err) {
                console.error("Error loading auxiliary data (NFL players/state/rosters):", err);
                setError(`Failed to load auxiliary data: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        loadAuxiliaryData();
    }, [historicalMatchups]); // Rerun if historicalMatchups changes

    // Effect to calculate power rankings and chart data once all necessary data is loaded
    useEffect(() => {
        if (!loading && !error && Object.keys(historicalMatchups).length > 0 && Object.keys(allLeagueRosters).length > 0) {
            try {
                // Determine the most recent season available in historical matchups
                const seasons = Object.keys(historicalMatchups);
                const mostRecentSeason = seasons.length > 0 ? Math.max(...seasons.map(Number)).toString() : null;

                if (mostRecentSeason) {
                    const currentSeasonRankings = calculatePowerRankings(historicalMatchups, mostRecentSeason, allLeagueRosters);
                    setPowerRankings(currentSeasonRankings);
                } else {
                    setPowerRankings([]);
                }

                // Calculate historical rankings for the chart
                const hRankings = calculateHistoricalPowerRankings(historicalMatchups, allLeagueRosters);
                console.log("Calculated Historical Rankings:", hRankings); // Debugging

                // Prepare data for the chart
                const chartLabels = Object.keys(hRankings).sort((a, b) => parseInt(a) - parseInt(b)); // Seasons as labels
                const datasets = {}; // Map: teamName -> array of scores per season

                // Initialize datasets for all teams that appear in any season
                chartLabels.forEach(season => {
                    if (hRankings[season]) {
                        hRankings[season].forEach(ranking => {
                            if (!datasets[ranking.teamName]) {
                                datasets[ranking.teamName] = new Array(chartLabels.length).fill(null); // Fill with null initially
                            }
                        });
                    }
                });

                // Populate datasets with scores
                chartLabels.forEach((season, seasonIndex) => {
                    if (hRankings[season]) {
                        hRankings[season].forEach(ranking => {
                            if (datasets[ranking.teamName]) {
                                datasets[ranking.teamName][seasonIndex] = ranking.totalScore;
                            }
                        });
                    }
                });

                const chartDatasets = Object.keys(datasets).map(teamName => ({
                    label: getDisplayTeamName(teamName),
                    data: datasets[teamName],
                    borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`, // Random color for each team
                    tension: 0.1,
                    fill: false,
                }));

                setHistoricalChartData({
                    labels: chartLabels,
                    datasets: chartDatasets,
                });

            } catch (err) {
                console.error("Error calculating power rankings or chart data:", err);
                setError(`Failed to calculate power rankings: ${err.message}`);
            }
        }
    }, [historicalMatchups, allLeagueRosters, loading, error, getDisplayTeamName]);


    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, // Allows chart to take available height
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        size: 14,
                        family: 'Inter, sans-serif',
                    },
                    color: '#333',
                },
            },
            title: {
                display: true,
                text: 'Historical Power Ranking Trends',
                font: {
                    size: 18,
                    family: 'Inter, sans-serif',
                    weight: 'bold',
                },
                color: '#333',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(2);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Season',
                    font: {
                        size: 16,
                        family: 'Inter, sans-serif',
                    },
                    color: '#555',
                },
                grid: {
                    display: false,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Power Ranking Score',
                    font: {
                        size: 16,
                        family: 'Inter, sans-serif',
                    },
                    color: '#555',
                },
                beginAtZero: false,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
            },
        },
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-blue-600">
                <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-xl font-medium">Loading power rankings and historical data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 p-6 bg-red-50 rounded-lg shadow-md">
                <p className="text-lg font-semibold mb-2">Error Loading Data</p>
                <p className="text-md">{error}</p>
                <p className="text-sm mt-3">Please ensure your Sleeper API calls are configured correctly and you have an active internet connection.</p>
            </div>
        );
    }

    // Determine the most recent season available for display in the table
    const seasons = Object.keys(historicalMatchups);
    const mostRecentSeason = seasons.length > 0 ? Math.max(...seasons.map(Number)).toString() : null;
    const rankingsForDisplay = mostRecentSeason ? powerRankings : [];


    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-xl max-w-full mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Power Rankings</h2>

            {mostRecentSeason && (
                <div className="mb-8">
                    <h3 className="text-2xl font-semibold text-blue-700 mb-4 text-center">Current Season ({mostRecentSeason}) Rankings</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-lg shadow-md overflow-hidden">
                            <thead className="bg-blue-600 text-white">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-semibold">Rank</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold">Team Name</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold">Record (W-L)</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold">Points For</th>
                                    <th className="py-3 px-4 text-left text-sm font-semibold">Power Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {rankingsForDisplay.map((team, index) => (
                                    <tr key={team.teamName} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="py-3 px-4 text-sm text-gray-700">{index + 1}</td>
                                        <td className="py-3 px-4 text-sm text-gray-700 font-medium">{getDisplayTeamName(team.teamName)}</td>
                                        <td className="py-3 px-4 text-sm text-gray-700">{team.wins}-{team.losses}</td>
                                        <td className="py-3 px-4 text-sm text-gray-700">{team.pointsFor.toFixed(2)}</td>
                                        <td className="py-3 px-4 text-sm text-gray-700 font-semibold">{team.totalScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="mt-10">
                <h3 className="text-2xl font-semibold text-blue-700 mb-4 text-center">Historical Power Ranking Trends</h3>
                <div className="relative h-96 w-full">
                    {historicalChartData && historicalChartData.labels.length > 0 && historicalChartData.datasets.length > 0 ? (
                        <Line data={historicalChartData} options={chartOptions} />
                    ) : (
                        <p className="text-center text-gray-600 py-10">No sufficient historical data to display chart.</p>
                    )}
                </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                <p><strong>Note on Power Ranking Calculation:</strong> This is a simplified power ranking system. It currently uses a weighted average of Win/Loss Record (40%), Points For (30%), and a mock Roster Strength (30%). The Roster Strength component is a placeholder and currently uses a random score. For a more robust ranking, you would integrate actual roster data and player valuations.</p>
            </div>
        </div>
    );
};

export default PowerRankings;
