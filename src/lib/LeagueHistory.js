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
        historicalData, // Contains matchupsBySeason, winnersBracketBySeason, losersBracketBySeason, rostersBySeason, leaguesMetadataBySeason
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
        if (contextLoading || contextError || !historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
            setAllTimeStandings([]);
            setSeasonalDPRChartData([]);
            setUniqueTeamsForChart([]);
            setSeasonAwardsSummary({});
            setSortedYearsForAwards([]);
            return;
        }

        const allMatchupsFlat = [];
        const completedSeasons = new Set();
        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);

        allYears.forEach(year => {
            const weeklyMatchupsForYear = historicalData.matchupsBySeason[year] || {};
            const leagueMetadataForYear = historicalData.leaguesMetadataBySeason[year];
            const winnersBracketForYear = historicalData.winnersBracketBySeason[year] || [];
            const losersBracketForYear = historicalData.losersBracketBySeason[year] || [];
            const championshipWeek = leagueMetadataForYear?.settings?.championship_week ? parseInt(leagueMetadataForYear.settings.championship_week) : null;

            // Determine if the season is completed by checking if a championship match has a winner
            const championshipMatch = winnersBracketForYear.find(bm => bm.r === winnersBracketForYear.length && bm.w);
            if (championshipMatch) {
                completedSeasons.add(year);
            }

            Object.keys(weeklyMatchupsForYear).forEach(weekStr => {
                const week = parseInt(weekStr);
                weeklyMatchupsForYear[weekStr].forEach(matchup => {
                    const team1Roster = historicalData.rostersBySeason[year]?.find(r => String(r.roster_id) === String(matchup.roster_id));
                    const team2Roster = historicalData.rostersBySeason[year]?.find(r => String(r.roster_id) === String(matchup.matchup_id === matchup.roster_id ? matchup.roster_id : matchup.matchup_id)); // Corrected logic for team2 roster

                    const team1OwnerId = team1Roster?.owner_id;
                    const team2OwnerId = team2Roster?.owner_id;

                    // Ensure both owner IDs are resolved
                    if (!team1OwnerId || !team2OwnerId) {
                        return;
                    }

                    // Determine match type using the playoff flag and bracket IDs
                    let matchType = 'Reg. Season';
                    const currentMatchupId = String(matchup.match_id); // Use match_id for bracket lookup

                    const playoffMatchIds = new Set(winnersBracketForYear.map(m => String(m.match_id)));
                    const consolationMatchIds = new Set(losersBracketForYear.map(m => String(m.match_id)));

                    if (playoffMatchIds.has(currentMatchupId)) {
                        if (championshipWeek && week === championshipWeek) {
                            matchType = 'Championship';
                        } else {
                            matchType = 'Playoffs';
                        }
                    } else if (consolationMatchIds.has(currentMatchupId)) {
                        matchType = 'Consolation';
                    } else if (matchup.playoff) { // Fallback if playoff flag is true but not found in explicit brackets
                        matchType = 'Playoffs (Uncategorized)';
                    }

                    // Add to flat list for overall calculations
                    allMatchupsFlat.push({
                        ...matchup,
                        year: year,
                        week: week,
                        team1: team1OwnerId, // Use owner IDs
                        team2: team2OwnerId,
                        team1_score: parseFloat(matchup.points), // Use 'points' for team1's score
                        team2_score: parseFloat(matchup.opponent_points), // Use 'opponent_points' for team2's score
                        matchType: matchType,
                    });
                });
            });
        });

        // Now use allMatchupsFlat for calculateAllLeagueMetrics
        const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(allMatchupsFlat, getDisplayTeamNameFromContext);

        const teamOverallStats = {};
        const yearlyPointsLeaders = {};
        const newSeasonAwardsSummary = {};

        // First pass: Aggregate basic stats and identify yearly points leaders
        allMatchupsFlat.forEach(match => {
            const team1OwnerId = match.team1;
            const team2OwnerId = match.team2;
            const year = match.year;
            const team1Score = parseFloat(match.team1_score);
            const team2Score = parseFloat(match.team2_score);

            const team1DisplayName = getDisplayTeamNameFromContext(team1OwnerId, year);
            const team2DisplayName = getDisplayTeamNameFromContext(team2OwnerId, year);

            if (!team1DisplayName || team1DisplayName === '' || !team2DisplayName || team2DisplayName === '' || isNaN(year) || isNaN(team1Score) || isNaN(team2Score)) {
                return;
            }

            [team1DisplayName, team2DisplayName].forEach(team => {
                if (!teamOverallStats[team]) {
                    teamOverallStats[team] = {
                        totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGames: 0,
                        seasonsPlayed: new Set(),
                        awards: { championships: 0, runnerUps: 0, thirdPlace: 0, firstPoints: 0, secondPoints: 0, thirdPoints: 0 },
                    };
                }
                teamOverallStats[team].seasonsPlayed.add(year);
            });

            // Aggregate overall wins, losses, ties, and points
            const isTie = team1Score === team2Score;
            const team1Won = team1Score > team2Score;

            if (isTie) {
                teamOverallStats[team1DisplayName].totalTies++;
                teamOverallStats[team2DisplayName].totalTies++;
            } else if (team1Won) {
                teamOverallStats[team1DisplayName].totalWins++;
                teamOverallStats[team2DisplayName].totalLosses++;
            } else { // team2Won
                teamOverallStats[team2DisplayName].totalWins++;
                teamOverallStats[team1DisplayName].totalLosses++;
            }
            teamOverallStats[team1DisplayName].totalGames++;
            teamOverallStats[team2DisplayName].totalGames++;

            teamOverallStats[team1DisplayName].totalPointsFor += team1Score;
            teamOverallStats[team2DisplayName].totalPointsFor += team2Score;
        });

        // Populate yearlyPointsLeaders using seasonalMetrics
        Object.keys(seasonalMetrics).forEach(year => {
            if (!completedSeasons.has(parseInt(year))) {
                return;
            }

            const teamsInSeason = Object.keys(seasonalMetrics[year]);
            const yearPointsData = teamsInSeason.map(team => ({
                team,
                points: seasonalMetrics[year][team].pointsFor
            })).sort((a, b) => b.points - a.points);

            yearlyPointsLeaders[year] = yearPointsData;
        });

        // Process championship and consolation games for overall finish awards (Trophies)
        allYears.forEach(year => {
            if (!completedSeasons.has(year)) {
                return; // Only process completed seasons for awards
            }

            const winnersBracketForYear = historicalData.winnersBracketBySeason[year] || [];
            const losersBracketForYear = historicalData.losersBracketBySeason[year] || [];
            const rostersForYear = historicalData.rostersBySeason[year] || [];

            // Map roster_id to owner_id for playoff rankings
            const rosterIdToOwnerIdMap = new Map(rostersForYear.map(r => [String(r.roster_id), String(r.owner_id)]));

            // Use the playoffRankings logic to determine finishes
            const playoffFinishes = calculatePlayoffFinishes({
                winnersBracket: winnersBracketForYear,
                losersBracket: losersBracketForYear
            }, rosterIdToOwnerIdMap, getDisplayTeamNameFromContext, year); // Pass year to getTeamName

            // Populate newSeasonAwardsSummary based on playoffFinishes
            newSeasonAwardsSummary[year] = {
                champion: 'N/A',
                secondPlace: 'N/A',
                thirdPlace: 'N/A',
                pointsChamp: 'N/A',
                pointsSecond: 'N/A',
                pointsThird: 'N/A',
            };

            playoffFinishes.forEach(finish => {
                const teamDisplayName = getDisplayTeamNameFromContext(finish.owner_id, year);
                if (finish.playoffFinish === '1st Place') {
                    newSeasonAwardsSummary[year].champion = teamDisplayName;
                } else if (finish.playoffFinish === '2nd Place') {
                    newSeasonAwardsSummary[year].secondPlace = teamDisplayName;
                } else if (finish.playoffFinish === '3rd Place') {
                    newSeasonAwardsSummary[year].thirdPlace = teamDisplayName;
                }
            });

            // Assign Points Champions for the year
            const leaders = yearlyPointsLeaders[year];
            if (leaders && leaders.length > 0) {
                newSeasonAwardsSummary[year].pointsChamp = leaders[0].team;
                if (leaders.length > 1 && leaders[1].points < leaders[0].points) {
                    newSeasonAwardsSummary[year].pointsSecond = leaders[1].team;
                }
                if (leaders.length > 2 && leaders[2].points < leaders[1].points && leaders[2].points < leaders[1].points) {
                    newSeasonAwardsSummary[year].pointsThird = leaders[2].team;
                }
            }
        });

        // Final compilation for All-Time Standings display (SORTED BY WIN PERCENTAGE)
        const compiledStandings = Object.keys(teamOverallStats).map(teamName => {
            const stats = teamOverallStats[teamName];
            if (stats.seasonsPlayed.size === 0) return null;

            const careerDPR = careerDPRData.find(dpr => dpr.team === teamName)?.dpr || 0;
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

            return {
                team: teamName,
                seasons: seasonsDisplay,
                totalDPR: careerDPR,
                record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`,
                totalWins: stats.totalWins,
                winPercentage: winPercentage,
                awards: stats.awards,
            };
        }).filter(Boolean).sort((a, b) => b.winPercentage - a.winPercentage);

        setAllTimeStandings(compiledStandings);

        // Prepare data for the total DPR progression line graph
        const chartData = [];
        // Ensure allYears is derived from historicalData.matchupsBySeason keys
        const allYearsForChart = Object.keys(historicalData.matchupsBySeason).map(Number).filter(y => !isNaN(y)).sort((a, b) => a - b);
        const uniqueTeams = Array.from(new Set(
            allMatchupsFlat.flatMap(m => [getDisplayTeamNameFromContext(m.team1, m.year), getDisplayTeamNameFromContext(m.team2, m.year)])
            .filter(name => name !== null && name !== '')
        )).sort();

        setUniqueTeamsForChart(uniqueTeams);

        const cumulativeTeamDPRs = {};

        allYearsForChart.forEach(currentYear => {
            const matchesUpToCurrentYear = allMatchupsFlat.filter(match => parseInt(match.year) <= currentYear);
            const { careerDPRData: cumulativeCareerDPRData } = calculateAllLeagueMetrics(matchesUpToCurrentYear, getDisplayTeamNameFromContext);

            uniqueTeams.forEach(team => {
                const teamDPR = cumulativeCareerDPRData.find(dpr => dpr.team === team)?.dpr;
                if (teamDPR !== undefined) {
                    cumulativeTeamDPRs[team] = teamDPR;
                }
            });

            const yearDataPoint = { year: currentYear };
            const teamsWithDPRForRanking = uniqueTeams.map(team => ({
                team: team,
                dpr: cumulativeTeamDPRs[team] || 0
            }));

            teamsWithDPRForRanking.sort((a, b) => b.dpr - a.dpr);

            let currentRank = 1;
            for (let i = 0; i < teamsWithDPRForRanking.length; i++) {
                if (i > 0 && teamsWithDPRForRanking[i].dpr < teamsWithDPRForRanking[i - 1].dpr) {
                    currentRank = i + 1;
                }
                yearDataPoint[teamsWithDPRForRanking[i].team] = currentRank;
                yearDataPoint[`${teamsWithDPRForRanking[i].team}_DPR`] = teamsWithDPRForRanking[i].dpr;
            }

            chartData.push(yearDataPoint);
        });
        setSeasonalDPRChartData(chartData);

        // Set the season awards summary and sorted years
        setSeasonAwardsSummary(newSeasonAwardsSummary);
        setSortedYearsForAwards(Object.keys(newSeasonAwardsSummary).map(Number).sort((a, b) => b - a)); // Sort descending
    }, [historicalData, getDisplayTeamNameFromContext, contextLoading, contextError]); // Dependencies

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
                                    {allTimeStandings.map((team, index) => (
                                        <tr key={team.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="py-2 px-3 text-sm text-gray-800 text-center font-semibold whitespace-nowrap">{index + 1}</td>
                                            <td className="py-2 px-3 text-sm text-gray-800 font-semibold whitespace-nowrap">{team.team}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{team.seasons}</td>
                                            {/* NEW: Added Total DPR data cell */}
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{formatDPR(team.totalDPR)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{team.record}</td>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* New: Season-by-Season Champions & Awards - MOVED UP */}
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

                    {/* Total DPR Progression Line Graph - MOVED DOWN */}
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
