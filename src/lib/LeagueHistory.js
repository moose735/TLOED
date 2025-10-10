// src/lib/LeagueHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // For career DPR
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook
import logger from '../utils/logger';
import { fetchTransactionsForWeek } from '../utils/sleeperApi';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculatePlayoffFinishes } from '../utils/playoffRankings'; // Import the playoff calculation function

// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Cell, Area, AreaChart } from 'recharts';

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
        historicalData,
        allDraftHistory,
        nflState,
        getTeamName: getDisplayTeamNameFromContext,
        getTeamDetails,
        transactions
    } = useSleeperData();

    const [allTimeStandings, setAllTimeStandings] = useState([]);
    const [sortBy, setSortBy] = useState('winPercentage');
    const [sortOrder, setSortOrder] = useState('desc');
    const [seasonalDPRChartData, setSeasonalDPRChartData] = useState([]);
    const [uniqueTeamsForChart, setUniqueTeamsForChart] = useState([]);
    const [seasonAwardsSummary, setSeasonAwardsSummary] = useState({});
    const [sortedYearsForAwards, setSortedYearsForAwards] = useState([]);
    const [showAllSeasons, setShowAllSeasons] = useState(false);
    const [averageScoreChartData, setAverageScoreChartData] = useState([]);
    const [empiricalOpen, setEmpiricalOpen] = useState(false);
    const [tradePairCounts, setTradePairCounts] = useState([]); // [{teamA, teamB, ownerA, ownerB, count}]
    const [teamTransactionTotals, setTeamTransactionTotals] = useState([]); // [{ ownerId, teamName, pickups, trades }]
    const [draftPickTrades, setDraftPickTrades] = useState({}); // { [ownerId]: { given: [], received: [] } }
    const [selectedTeamTrades, setSelectedTeamTrades] = useState(null);
    const [showTradeModal, setShowTradeModal] = useState(false);
    
    // Season range filtering for charts
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedStartYear, setSelectedStartYear] = useState('');
    const [selectedEndYear, setSelectedEndYear] = useState('');
    // Module-level in-memory cache for aggregated league transactions to reduce repeated full-season fetches
    // Structure: { [leagueId]: { timestamp: number, transactions: Array } }
    const leagueTxCache = React.useRef(new Map());

    // A color palette for the teams in the chart
    const teamColors = [
        '#8884d8', '#82ca9d', '#ffc658', '#f5222d', '#fa8c16', '#a0d911', '#52c41a', '#1890ff',
        '#2f54eb', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#eb2f96', '#fadb14', '#52c41a'
    ];

    // Custom tooltip for the average score chart
    const AverageScoreTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                    <p className="font-semibold">{`Season ${label}`}</p>
                    <p className="text-green-600">{`Highest: ${data.highest.toFixed(1)} (${data.highestTeam})`}</p>
                    <p className="text-blue-600">{`Average: ${data.average.toFixed(1)}`}</p>
                    <p className="text-red-600">{`Lowest: ${data.lowest.toFixed(1)} (${data.lowestTeam})`}</p>
                    <p className="text-gray-600">{`Range: ${data.range.toFixed(1)} pts`}</p>
                </div>
            );
        }
        return null;
    };

    useEffect(() => {

        // Use calculateAllLeagueMetrics directly with historicalData
        // NEW: Pass nflState to calculateAllLeagueMetrics
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getDisplayTeamNameFromContext, nflState);

    logger.debug("LeagueHistory: calculatedCareerDPRs after initial calculation:", calculatedCareerDPRs); // NEW LOG

        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);

        // Initialize teamOverallStats using careerDPRData
        const teamOverallStats = {};
        calculatedCareerDPRs.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            const teamName = getDisplayTeamNameFromContext(ownerId, null); // Get current team name for overall stats

            if (!teamName || teamName.startsWith('Unknown Team (ID:')) {
                logger.warn(`LeagueHistory: Skipping career stats for ownerId ${ownerId} due to unresolved team name.`);
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

        // Store teamTransactionTotals in localStorage for LeagueRecords to use
        if (teamTransactionTotals && teamTransactionTotals.length > 0) {
            try {
                window.localStorage.setItem('teamTransactionTotals', JSON.stringify(teamTransactionTotals));
            } catch (e) {
                // ignore
            }
        }
    logger.debug("LeagueHistory: teamOverallStats after population:", teamOverallStats); // NEW LOG


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
                logger.warn(`LeagueHistory: No seasonal metrics found for year ${year}. Cannot determine points awards.`);
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
    logger.debug("LeagueHistory: newSeasonAwardsSummary after processing:", newSeasonAwardsSummary);


        // Build owner -> rosterId map to aggregate persisted coach scores from localStorage
        const ownerToRosterIds = {};
        const rosterIdToYear = {};
        Object.keys(historicalData.rostersBySeason).forEach(year => {
            const rostersForYear = historicalData.rostersBySeason[year] || [];
            rostersForYear.forEach(r => {
                const owner = String(r.owner_id);
                const rosterId = String(r.roster_id);
                if (!ownerToRosterIds[owner]) ownerToRosterIds[owner] = new Set();
                ownerToRosterIds[owner].add(rosterId);
                // remember which year this roster id came from
                rosterIdToYear[rosterId] = String(year);
            });
        });

        const computeCareerCoachForOwner = (ownerId) => {
            try {
                const rosterSet = ownerToRosterIds[String(ownerId)] || new Set();
                let allScores = [];
                rosterSet.forEach(rid => {
                    // Skip rosters from 2021 — no game-by-game logs for that year
                    if (rosterIdToYear[String(rid)] === '2021') return;

                    const raw = localStorage.getItem(`coachScore:${rid}`);
                    if (!raw) return;
                    const arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) return;
                    arr.forEach(entry => {
                        if (typeof entry?.score === 'number') allScores.push(entry.score);
                    });
                });
                if (allScores.length === 0) return null;
                const sum = allScores.reduce((s, v) => s + v, 0);
                return sum / allScores.length;
            } catch (e) {
                return null;
            }
        };

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
                // coachScore removed from league history compilation
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

        // Calculate average matchup scores data for the box plot chart
        const averageScoresData = [];
        logger.debug('LeagueHistory: Starting average score calculation for years:', allYears);
        logger.debug('LeagueHistory: historicalData.matchupsBySeason keys:', Object.keys(historicalData.matchupsBySeason || {}));
        
        allYears.forEach(year => {
            const matchupsForYear = historicalData.matchupsBySeason[year] || [];
            const rostersForYear = historicalData.rostersBySeason[year] || [];
            
            logger.debug(`LeagueHistory: Year ${year} - matchups: ${matchupsForYear.length}, rosters: ${rostersForYear.length}`);
            
            if (matchupsForYear.length === 0 || rostersForYear.length === 0) {
                logger.debug(`LeagueHistory: Skipping year ${year} - no data`);
                return;
            }
            
            // Calculate total points and games for each team, only using fully completed weeks
            const teamPointsData = {};
            // Initialize team data - use roster_id as key since matchups use roster_id
            const rosterIdToOwnerMap = {};
            rostersForYear.forEach(roster => {
                const ownerId = roster.owner_id;
                const rosterId = roster.roster_id;
                const teamName = getDisplayTeamNameFromContext(ownerId, year);
                rosterIdToOwnerMap[rosterId] = ownerId;
                teamPointsData[rosterId] = {
                    ownerId: ownerId,
                    teamName: teamName,
                    totalPoints: 0,
                    games: 0
                };
            });

            // Group matchups by week
            const matchupsByWeek = {};
            matchupsForYear.forEach(m => {
                const week = m.week || m.matchup_period || m.matchupWeek || 1;
                if (!matchupsByWeek[week]) matchupsByWeek[week] = [];
                matchupsByWeek[week].push(m);
            });

            // Find the last fully completed week (all matchups have non-null, non-zero scores for both teams)
            const completedWeeks = Object.keys(matchupsByWeek).filter(week => {
                const weekMatchups = matchupsByWeek[week];
                return weekMatchups.every(mu => {
                    const t1s = mu.team1_score || mu.t1_score;
                    const t2s = mu.team2_score || mu.t2_score;
                    return t1s !== null && t2s !== null && t1s !== undefined && t2s !== undefined && t1s > 0 && t2s > 0;
                });
            });
            // Only include matchups from completed weeks
            completedWeeks.forEach(week => {
                matchupsByWeek[week].forEach((matchup, index) => {
                    const team1Id = matchup.team1_roster_id || matchup.t1;
                    const team2Id = matchup.team2_roster_id || matchup.t2;
                    const team1Score = matchup.team1_score || matchup.t1_score || 0;
                    const team2Score = matchup.team2_score || matchup.t2_score || 0;
                    if (team1Id && teamPointsData[team1Id]) {
                        teamPointsData[team1Id].totalPoints += team1Score;
                        teamPointsData[team1Id].games += 1;
                    }
                    if (team2Id && teamPointsData[team2Id]) {
                        teamPointsData[team2Id].totalPoints += team2Score;
                        teamPointsData[team2Id].games += 1;
                    }
                });
            });
            
            // Calculate each team's season average
            const teamSeasonAverages = [];
            const teamAverageScores = {};
            
            Object.values(teamPointsData).forEach(teamData => {
                if (teamData.games > 0) {
                    const seasonAvg = teamData.totalPoints / teamData.games;
                    teamSeasonAverages.push(seasonAvg);
                    teamAverageScores[teamData.teamName] = seasonAvg;
                }
            });
            
            logger.debug(`LeagueHistory: Team season averages for year ${year}:`, teamAverageScores);
            
            if (teamSeasonAverages.length > 0) {
                // Calculate statistics from team season averages
                teamSeasonAverages.sort((a, b) => a - b);
                const highest = Math.max(...teamSeasonAverages);
                const lowest = Math.min(...teamSeasonAverages);
                const average = teamSeasonAverages.reduce((sum, score) => sum + score, 0) / teamSeasonAverages.length;
                
                // Find team names for highest and lowest season averages
                const highestTeam = Object.keys(teamAverageScores).find(team => Math.abs(teamAverageScores[team] - highest) < 0.01) || 'Unknown';
                const lowestTeam = Object.keys(teamAverageScores).find(team => Math.abs(teamAverageScores[team] - lowest) < 0.01) || 'Unknown';
                
                const yearData = {
                    year: year,
                    highest: parseFloat(highest.toFixed(1)),
                    lowest: parseFloat(lowest.toFixed(1)),
                    average: parseFloat(average.toFixed(1)),
                    range: parseFloat((highest - lowest).toFixed(1)),
                    highestTeam: highestTeam,
                    lowestTeam: lowestTeam
                };
                
                logger.debug(`LeagueHistory: Adding team average data for year ${year}:`, yearData);
                averageScoresData.push(yearData);
            } else {
                logger.debug(`LeagueHistory: No team season averages calculated for year ${year}`);
            }
        });
        
        logger.debug('LeagueHistory: averageScoresData calculated:', averageScoresData);
        setAverageScoreChartData(averageScoresData);

        // Set available years for filtering
        const years = allYears.map(String).sort();
        setAvailableYears(years);
        
        // Initialize year range if not set
        if (!selectedStartYear && years.length > 0) {
            setSelectedStartYear(years[0]);
        }
        if (!selectedEndYear && years.length > 0) {
            setSelectedEndYear(years[years.length - 1]);
        }

        // Set the season awards summary and sorted years
        setSeasonAwardsSummary(newSeasonAwardsSummary);
        setSortedYearsForAwards(Object.keys(newSeasonAwardsSummary).map(Number).sort((a, b) => b - a)); // Sort descending

        // --- Compute pairwise trade counts across all available years (financial records + context.transactions) ---
        (async () => {
            try {
                const pairCounts = {}; // key: smallerOwner|largerOwner -> count

            // Helper: get ownerId for a roster_id in a given year
            const getOwnerIdForRoster = (rosterId, year) => {
                if (!historicalData || !historicalData.rostersBySeason) return null;
                // Prefer exact year lookup, but fall back to scanning all years if not found
                const tryYears = [];
                if (year) tryYears.push(String(year));
                // also try the transaction's rosterId->year map if present
                tryYears.push(...Object.keys(historicalData.rostersBySeason));
                for (const y of tryYears) {
                    const rostersForYear = historicalData.rostersBySeason[y] || [];
                    const found = rostersForYear.find(r => String(r.roster_id) === String(rosterId));
                    if (found) return String(found.owner_id);
                }
                return null;
            };

            // Gather all years present in historicalData.rostersBySeason
            const allYears = Object.keys(historicalData.rostersBySeason || {}).sort();

            // Fetch financial data for all years (if any) and collect transactions
            let financialTransactions = [];
            if (allYears.length > 0) {
                try {
                    const financialDataByYear = await fetchFinancialDataForYears(allYears);
                    financialTransactions = Object.values(financialDataByYear).flatMap(y => (y && y.transactions) ? y.transactions : []);
                } catch (err) {
                    logger.warn('LeagueHistory: could not fetch financial data for all years:', err);
                    financialTransactions = [];
                }
            }

            // Additionally fetch transactions directly from historical league IDs so we include transactions saved by Sleeper per league/season
            let leagueFetchedTransactions = [];
            try {
                // Determine which seasons to fetch leagues for
                const seasonsToFetch = Object.keys(historicalData.leaguesMetadataBySeason || {});
                const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours
                for (const season of seasonsToFetch) {
                    const leagueMeta = historicalData.leaguesMetadataBySeason?.[String(season)];
                    const leagueId = leagueMeta?.league_id || leagueMeta?.leagueId || leagueMeta?.id || null;
                    if (!leagueId) continue;

                    // Check module-level cache first
                    const cached = leagueTxCache.current.get(leagueId);
                    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) {
                        leagueFetchedTransactions.push(...cached.transactions);
                        continue;
                    }

                    // Conservative max weeks to fetch - use nflState.week for current season if available, otherwise 18
                    const maxWeeks = (String(season) === String(nflState?.season) && nflState?.week) ? Math.max(1, nflState.week) : 18;
                    const weekPromises = [];
                    for (let w = 1; w <= maxWeeks; w++) {
                        weekPromises.push(fetchTransactionsForWeek(leagueId, w).catch(err => { logger.debug(`LeagueHistory: fetchTransactionsForWeek failed for ${leagueId} week ${w}: ${err}`); return []; }));
                    }
                    const results = await Promise.all(weekPromises);
                    const seasonTx = results.flat().map(tx => { if (tx && !tx.season) tx.season = season; return tx; }).filter(Boolean);
                    // store in module-level cache
                    leagueTxCache.current.set(leagueId, { timestamp: Date.now(), transactions: seasonTx });
                    leagueFetchedTransactions.push(...seasonTx);
                }
            } catch (err) {
                logger.warn('LeagueHistory: error fetching league transactions for historical leagues', err);
            }

            // Combine financial transactions (all years) with context transactions (likely current-season/week-by-week fetches)
            const contextTx = Array.isArray(transactions) ? transactions : [];
            const allTx = [...financialTransactions, ...leagueFetchedTransactions, ...contextTx];

            // Use all transactions (financial, league-fetched, and context) for all-time aggregation
            const filteredTx = allTx;
            


            // Prepare counters per owner for pickups (adds) and trades participation
            const pickupsByOwner = {}; // ownerId -> count
            const tradesByOwner = {}; // ownerId -> count (number of trade events they participated in)

            filteredTx.forEach(tx => {
                try {
                    if (!tx) return;
                    // Decide by transaction type
                    const txType = String(tx.type || '').toLowerCase();

                    // Count pickups/adds for waiver/free_agent/add type transactions
                    if (txType === 'waiver' || txType === 'free_agent' || txType === 'add') {
                        const pickupCount = tx.adds ? Object.keys(tx.adds).length : 0;
                        let owner = null;
                        // Prefer roster_ids[0] as the acting roster (common Sleeper shape)
                        if (tx.roster_ids && Array.isArray(tx.roster_ids) && tx.roster_ids.length > 0) {
                            owner = getOwnerIdForRoster(tx.roster_ids[0], tx.season || tx.year || null);
                        }

                        if (owner && pickupCount > 0) {
                            pickupsByOwner[owner] = (pickupsByOwner[owner] || 0) + pickupCount;
                        } else if (tx.adds && typeof tx.adds === 'object') {
                            // Fallback: try to infer owner from each add entry having a roster_id field
                            Object.values(tx.adds).forEach(add => {
                                const rid = add?.roster_id || add?.rosterId || null;
                                if (rid) {
                                    const inferredOwner = getOwnerIdForRoster(rid, tx.season || tx.year || null);
                                    if (inferredOwner) pickupsByOwner[inferredOwner] = (pickupsByOwner[inferredOwner] || 0) + 1;
                                }
                            });
                        }

                        // Not a trade — skip trade-specific processing for this tx
                        return;
                    }

                    // Only consider completed trades for trade pair counting
                    if (txType !== 'trade') return;
                    if (tx.status && String(tx.status).toLowerCase() === 'failed') return;

                    // roster_ids is an array of roster ids participating in the trade
                    const rosterIds = Array.isArray(tx.roster_ids) ? tx.roster_ids.map(r => String(r)) : [];
                    // If roster_ids not present, try to infer from adds/drops or metadata
                    if (rosterIds.length === 0) {
                        const inferred = new Set();
                        if (tx.adds) Object.values(tx.adds).forEach(v => { if (v?.roster_id) inferred.add(String(v.roster_id)); });
                        if (tx.drops) Object.values(tx.drops).forEach(v => { if (v?.roster_id) inferred.add(String(v.roster_id)); });
                        // Some financial transactions store roster mappings in metadata or team fields
                        if (tx.team && Array.isArray(tx.team)) tx.team.forEach(t => inferred.add(String(t)));
                        rosterIds.push(...Array.from(inferred));
                    }

                    // Determine year for this transaction: prefer tx.season or tx.year or metadata.season or created timestamp
                    let txYear = tx.season || tx.year || tx.metadata?.season || null;
                    if (!txYear && tx.created) {
                        try { txYear = new Date(tx.created).getFullYear(); } catch (e) { txYear = null; }
                    }
                    // Default to most recent year in historicalData if still missing
                    if (!txYear) txYear = allYears.length ? allYears[allYears.length - 1] : null;

                    // Map roster ids to owner ids for the transaction year
                    const ownerIds = rosterIds.map(rid => getOwnerIdForRoster(rid, txYear)).filter(Boolean);

                    // If we have at least two distinct owners, count each unique unordered pair once
                    const uniqueOwners = Array.from(new Set(ownerIds.map(o => String(o))));
                    if (uniqueOwners.length < 2) return;

                    // Increment trades participation for each owner involved in this trade event
                    uniqueOwners.forEach(o => { tradesByOwner[o] = (tradesByOwner[o] || 0) + 1; });

                    for (let i = 0; i < uniqueOwners.length; i++) {
                        for (let j = i + 1; j < uniqueOwners.length; j++) {
                            const a = uniqueOwners[i];
                            const b = uniqueOwners[j];
                            const [s, l] = a < b ? [a, b] : [b, a];
                            const key = `${s}|${l}`;
                            pairCounts[key] = (pairCounts[key] || 0) + 1;
                        }
                    }
                } catch (e) {
                    // ignore malformed tx
                }
            });

                // Convert to array with team display names
            const pairsArray = Object.keys(pairCounts).map(k => {
                const [a, b] = k.split('|');
                return {
                    ownerA: a,
                    ownerB: b,
                    teamA: getDisplayTeamNameFromContext(a, null),
                    teamB: getDisplayTeamNameFromContext(b, null),
                    count: pairCounts[k]
                };
            }).sort((x, y) => y.count - x.count);

            // Build team transaction totals (pickups and trades) and ensure we include owners with zeroes
            const ownerSet = new Set();
            pairsArray.forEach(p => { ownerSet.add(String(p.ownerA)); ownerSet.add(String(p.ownerB)); });
            Object.keys(pickupsByOwner || {}).forEach(o => ownerSet.add(String(o)));
            Object.keys(tradesByOwner || {}).forEach(o => ownerSet.add(String(o)));

            const totalsArray = Array.from(ownerSet).map(ownerId => ({
                ownerId: ownerId,
                teamName: getDisplayTeamNameFromContext(ownerId, null),
                pickups: pickupsByOwner[ownerId] || 0,
                trades: tradesByOwner[ownerId] || 0
            })).sort((a, b) => (b.pickups + b.trades) - (a.pickups + a.trades));

            // Analyze draft pick trades from transaction history (since draft picks are traded via transactions)
            const draftPickTradesData = {};
            
            // Process transactions to find draft pick trades
            let draftPickTradeCount = 0;
            filteredTx.forEach(tx => {
                try {
                    if (!tx || String(tx.type || '').toLowerCase() !== 'trade') return;
                    
                    // Look for draft picks in the transaction
                    const draftPicks = tx.draft_picks || tx.metadata?.traded_picks || [];
                    
                    if (Array.isArray(draftPicks) && draftPicks.length > 0) {
                        draftPickTradeCount++;
                        const txYear = tx.season || tx.year || tx.metadata?.season || 
                            (tx.created ? new Date(tx.created).getFullYear() : null) || 
                            (allYears.length ? allYears[allYears.length - 1] : null);
                            
                        draftPicks.forEach(pick => {
                            const currentOwner = pick.owner_id || pick.roster_id;
                            const previousOwner = pick.previous_owner_id || pick.original_owner;
                            const season = pick.season || txYear;
                            const round = pick.round;
                            
                            if (currentOwner && previousOwner && String(currentOwner) !== String(previousOwner)) {
                                const currentOwnerId = getOwnerIdForRoster(currentOwner, season);
                                const previousOwnerId = getOwnerIdForRoster(previousOwner, season);
                                
                                if (currentOwnerId && previousOwnerId) {
                                    // Initialize if needed
                                    if (!draftPickTradesData[currentOwnerId]) {
                                        draftPickTradesData[currentOwnerId] = { given: [], received: [] };
                                    }
                                    if (!draftPickTradesData[previousOwnerId]) {
                                        draftPickTradesData[previousOwnerId] = { given: [], received: [] };
                                    }
                                    
                                    // Current owner received this pick
                                    draftPickTradesData[currentOwnerId].received.push({
                                        year: season,
                                        round,
                                        pickNumber: pick.pick || pick.pick_no || `R${round}`,
                                        fromTeam: getDisplayTeamNameFromContext(previousOwnerId, null),
                                        fromOwnerId: previousOwnerId,
                                        player: pick.player_name || 'Draft Pick'
                                    });
                                    
                                    // Previous owner gave away this pick
                                    draftPickTradesData[previousOwnerId].given.push({
                                        year: season,
                                        round,
                                        pickNumber: pick.pick || pick.pick_no || `R${round}`,
                                        toTeam: getDisplayTeamNameFromContext(currentOwnerId, null),
                                        toOwnerId: currentOwnerId,
                                        player: pick.player_name || 'Draft Pick'
                                    });
                                }
                            }
                        });
                    }
                } catch (e) {
                    // ignore malformed transactions
                }
            });


            
            setTradePairCounts(pairsArray);
            setTeamTransactionTotals(totalsArray);
            setDraftPickTrades(draftPickTradesData);
            // Persist and broadcast so other components (eg. LeagueRecords) can consume the computed totals
            try {
                window.localStorage.setItem('teamTransactionTotals', JSON.stringify(totalsArray));
            } catch (e) {
                // ignore storage errors
            }
            try {
                const ev = new CustomEvent('teamTransactionTotalsUpdated', { detail: totalsArray });
                window.dispatchEvent(ev);
            } catch (e) {
                // ignore dispatch errors
            }
            } catch (e) {
                // fail silently
                setTradePairCounts([]);
            }
        })();
    }, [historicalData, allDraftHistory, nflState, getDisplayTeamNameFromContext, contextLoading, contextError, transactions]); // Dependencies updated with nflState, transactions


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

    // Filter chart data based on selected year range
    const getFilteredChartData = (data) => {
        if (!selectedStartYear || !selectedEndYear || !data.length) return data;
        
        const startYear = parseInt(selectedStartYear);
        const endYear = parseInt(selectedEndYear);
        
        return data.filter(item => {
            const year = parseInt(item.year);
            return year >= startYear && year <= endYear;
        });
    };

    // Calculate interval for X-axis labels based on data length
    const getXAxisInterval = (dataLength) => {
        if (dataLength <= 5) return 0; // Show all labels
        if (dataLength <= 10) return 1; // Show every other label
        if (dataLength <= 15) return 2; // Show every 3rd label
        return Math.floor(dataLength / 8); // Show ~8 labels maximum
    };

    return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 md:p-8 font-inter">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">League History & Awards</h2>
            {contextLoading ? (
                <p className="text-center text-gray-600">Loading league history data...</p>
            ) : contextError ? (
                <p className="text-center text-red-500 font-semibold">{contextError.message || String(contextError)}</p>
            ) : allTimeStandings.length === 0 ? (
                <p className="text-center text-gray-600">No historical matchup data found to display league history. Please check your Sleeper API configuration.</p>
            ) : (
                <>
                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3 mb-8">
                        {getSortedStandings().map((team, idx) => {
                            const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, null) : { name: team.team, avatar: undefined };
                            return (
                                <div key={team.team} className="bg-white rounded-lg shadow-md mobile-card p-3 sm:p-4 border-l-4 border-blue-500">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                            {teamDetails.avatar && (
                                                <img
                                                    src={teamDetails.avatar}
                                                    alt={teamDetails.name + ' logo'}
                                                    className="w-8 h-8 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
                                                    onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }}
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-gray-800 text-sm truncate">{team.team}</h3>
                                                <p className="text-xs text-gray-500">Seasons: {team.seasons}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-blue-800">{formatDPR(team.totalDPR)}</div>
                                                <div className="text-xs text-gray-500">Career DPR</div>
                                                {/* Coach (Career) removed from league history mobile view */}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                                        <div className="bg-gray-50 rounded-lg p-2">
                                            <div className="text-xs text-gray-500 mb-1">Record</div>
                                            <div className="font-semibold">{team.record}</div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-2">
                                            <div className="text-xs text-gray-500 mb-1">Win %</div>
                                            <div className="font-semibold text-blue-700">{formatPercentage(team.winPercentage)}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                                        {/* Awards icons */}
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
                                </div>
                            );
                        })}
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg mb-8">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                            <thead className="bg-blue-100 sticky top-0 z-10">
                                <tr>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Seasons</th>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Career DPR</th>
                                    {/* Coach % column removed */}
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record</th>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                                    <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Awards</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getSortedStandings().map((team, index) => {
                                    const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, null) : { name: team.team, avatar: undefined };
                                    return (
                                        <tr key={team.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-blue-700 font-bold border-b border-gray-200">{index + 1}</td>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 font-medium border-b border-gray-200">
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    {teamDetails.avatar && (
                                                        <img
                                                            src={teamDetails.avatar}
                                                            alt={teamDetails.name + ' logo'}
                                                            className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
                                                            onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }}
                                                        />
                                                    )}
                                                    <span className="truncate font-semibold text-xs md:text-sm flex items-center gap-1">
                                                        {team.team}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{team.seasons}</td>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-800">{formatDPR(team.totalDPR)}</td>
                                            {/* Coach % cell removed */}
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{team.record}</td>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-700">{formatPercentage(team.winPercentage)}</td>
                                            <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">
                                                <div className="flex flex-wrap justify-center items-center gap-2 whitespace-nowrap">
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
                    {/* Trade partner grid/matrix (moved below standings) */}
                <div className="bg-white rounded-lg shadow-md p-4 border border-gray-100 mb-6 mt-4">
                    <div className="mb-3">
                        {/* Match Season-by-Season heading style */}
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Trade Partner Matrix (All time)</h3>
                    </div>
                    {(!tradePairCounts || tradePairCounts.length === 0) && (!allTimeStandings || allTimeStandings.length === 0) ? (
                        <div className="text-sm text-gray-500">No trade or team data available.</div>
                    ) : (
                        (() => {
                            // Build owner list (include owners from standings and pairs). Use all-time owner list.
                            const ownersFromPairs = new Set();
                            tradePairCounts.forEach(p => { ownersFromPairs.add(String(p.ownerA)); ownersFromPairs.add(String(p.ownerB)); });
                            const ownersFromStandings = (allTimeStandings || []).map(t => String(t.ownerId));
                            const combinedOwners = Array.from(new Set([...ownersFromStandings, ...Array.from(ownersFromPairs)])).filter(Boolean);

                            // Map ownerId -> display name
                            const ownerIdToName = {};
                            combinedOwners.forEach(id => { ownerIdToName[id] = getDisplayTeamNameFromContext(id, null); });

                            // Build counts map, symmetric
                            const counts = {};
                            combinedOwners.forEach(a => { counts[a] = {}; combinedOwners.forEach(b => { counts[a][b] = 0; }); });
                            tradePairCounts.forEach(p => {
                                const a = String(p.ownerA);
                                const b = String(p.ownerB);
                                if (!counts[a]) counts[a] = {};
                                if (!counts[b]) counts[b] = {};
                                counts[a][b] = p.count || 0;
                                counts[b][a] = p.count || 0;
                            });

                            // Find max count for heat scaling
                            const maxCount = tradePairCounts.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1;

                            const heatColor = (n) => {
                                if (!n || n === 0) return '';
                                const ratio = Math.min(1, n / maxCount);
                                const start = [235, 248, 255];
                                const end = [14, 165, 233];
                                const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
                                const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
                                const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
                                return `rgb(${r}, ${g}, ${b})`;
                            };

                            return (
                                <>
                                <div className="overflow-auto border rounded-md" style={{ maxHeight: '420px' }}>
                                    <table className="min-w-full text-xs table-fixed border-collapse">
                                        <thead>
                                            <tr>
                                                {/* Header placeholder for left sticky column - shrink further for mobile */}
                                                <th className="sticky left-0 top-0 bg-white z-30 border-b border-r px-2 py-2" style={{ minWidth: '56px', maxWidth: '160px' }}></th>
                                                {combinedOwners.map((ownerId) => (
                                                    <th key={`col-${ownerId}`} className="py-1 px-1 text-center text-xs font-medium text-gray-800 border-b border-gray-200 bg-white sticky top-0" style={{ minWidth: '72px', maxWidth: '140px' }}>
                                                        <div className="whitespace-normal break-words text-xs font-medium text-gray-800 text-center" title={ownerIdToName[ownerId]} style={{ lineHeight: '1.05' }}>
                                                            {ownerIdToName[ownerId]}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedOwners.map((rowOwner, rowIdx) => (
                                                <tr key={`row-${rowOwner}`} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                                                    <td className="sticky left-0 bg-white z-20 border-r px-2 py-1 font-medium text-xs text-gray-800 text-center" style={{ minWidth: '80px', maxWidth: '220px' }}>
                                                        <div className="text-xs font-medium whitespace-normal break-words text-center" style={{ lineHeight: '1.05', wordBreak: 'break-word', overflowWrap: 'anywhere' }} title={ownerIdToName[rowOwner]}>
                                                            {ownerIdToName[rowOwner]}
                                                        </div>
                                                    </td>
                                                    {combinedOwners.map((colOwner) => {
                                                        const val = rowOwner === colOwner ? null : (counts[rowOwner] && counts[rowOwner][colOwner] ? counts[rowOwner][colOwner] : 0);
                                                        const bg = val ? heatColor(val) : undefined;
                                                        return (
                                                            <td key={`${rowOwner}-${colOwner}`} className="px-1 py-1 text-center border-b align-middle text-xs" style={{ background: bg }}>
                                                                {rowOwner === colOwner ? (<span className="text-gray-400">—</span>) : (
                                                                    <span className="font-semibold text-xs" style={{ color: val ? '#0b5f92' : '#6b7280' }}>{val}</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Note: 2021 Yahoo league data not included. Vetoed trades included in count.</p>
                                </>
                            );
                        })()
                    )}
                </div>
                {/* Waiver/FA and Trade totals table (moved below trade matrix) */}
                <div className="bg-white rounded-lg shadow-md p-4 border border-gray-100 mb-6 mt-2">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">Waiver/FA & Trade Totals (All time)</h3>
                    {(!teamTransactionTotals || teamTransactionTotals.length === 0) ? (
                        <div className="text-sm text-gray-500">No transaction summary data available.</div>
                    ) : (
                        <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs md:text-sm table-auto border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left px-2 py-2 border-b text-xs md:text-sm">Team</th>
                                        <th className="text-center px-2 py-2 border-b text-xs md:text-sm">Waiver/FA</th>
                                        <th className="text-center px-2 py-2 border-b text-xs md:text-sm">Trades</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamTransactionTotals.map(t => (
                                        <tr key={`tx-${t.ownerId}`} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                                            <td className="px-2 py-2 border-b text-xs md:text-sm font-medium">{t.teamName}</td>
                                            <td className="px-2 py-2 border-b text-center text-xs md:text-sm font-semibold text-blue-700">{t.pickups}</td>
                                            <td 
                                                className="px-2 py-2 border-b text-center text-xs md:text-sm font-semibold text-blue-700 cursor-pointer hover:bg-blue-50 transition-colors"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSelectedTeamTrades({
                                                        ownerId: t.ownerId,
                                                        teamName: t.teamName,
                                                        draftPicks: draftPickTrades[t.ownerId] || { given: [], received: [] }
                                                    });
                                                    setShowTradeModal(true);
                                                }}
                                                title="Click to view draft pick trade details"
                                            >
                                                <span className="flex items-center justify-center gap-1">
                                                    {t.trades}
                                                    <i className="fas fa-info-circle text-xs opacity-60 pointer-events-none"></i>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Note: 2021 Yahoo league data not included. Vetoed trades included in count.</p>
                        </>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Note: 2021 Yahoo league financial exports are not included.</p>
                    {/* ...existing code for season-by-season and chart... */}

                    {/* Season-by-Season Champions & Awards */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season-by-Season Champions & Awards</h3>
                        {Object.keys(seasonAwardsSummary).length > 0 ? (
                            <>
                                {/* Mobile stacked cards */}
                                <div className="sm:hidden space-y-3 mb-4">
                                    {(showAllSeasons ? sortedYearsForAwards : sortedYearsForAwards.slice(0, 8)).map((year) => {
                                        const awards = seasonAwardsSummary[year];
                                        return (
                                            <div key={`mobile-awards-${year}`} className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm font-semibold text-gray-800">{year}</div>
                                                    <div className="text-xs text-gray-500">Awards</div>
                                                </div>
                                                <div className="space-y-2 text-sm text-gray-700">
                                                    {/* Playoff awards row - horizontally scrollable on very small screens */}
                                                    <div className="flex gap-3 overflow-x-auto pb-1">
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-trophy text-yellow-500 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">Champion</div>
                                                                <div className="font-medium truncate" title={awards.champion}>{awards.champion}</div>
                                                            </div>
                                                        </div>
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-trophy text-gray-400 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">2nd Place</div>
                                                                <div className="font-medium truncate" title={awards.secondPlace}>{awards.secondPlace}</div>
                                                            </div>
                                                        </div>
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-trophy text-amber-800 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">3rd Place</div>
                                                                <div className="font-medium truncate" title={awards.thirdPlace}>{awards.thirdPlace}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Points awards row - grouped separately so points champions don't get mixed with playoff champs */}
                                                    <div className="flex gap-3 overflow-x-auto pb-1">
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-medal text-yellow-500 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">Points Champ</div>
                                                                <div className="font-medium truncate" title={awards.pointsChamp}>{awards.pointsChamp}</div>
                                                            </div>
                                                        </div>
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-medal text-gray-400 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">Points 2nd</div>
                                                                <div className="font-medium truncate" title={awards.pointsSecond}>{awards.pointsSecond}</div>
                                                            </div>
                                                        </div>
                                                        <div className="min-w-[140px] flex-shrink-0 flex items-start gap-2">
                                                            <i className="fas fa-medal text-amber-800 mt-1"></i>
                                                            <div className="truncate">
                                                                <div className="text-xs text-gray-500">Points 3rd</div>
                                                                <div className="font-medium truncate" title={awards.pointsThird}>{awards.pointsThird}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sortedYearsForAwards.length > 8 && (
                                        <div className="flex justify-center mt-2">
                                            <button
                                                className="text-blue-600 text-sm font-medium"
                                                onClick={() => setShowAllSeasons(!showAllSeasons)}
                                            >
                                                {showAllSeasons ? 'Show less' : `Show all ${sortedYearsForAwards.length}`}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Desktop: reuse mobile card layout so desktop matches mobile exactly */}
                                <div className="hidden sm:block space-y-3 mb-4">
                                    {(showAllSeasons ? sortedYearsForAwards : sortedYearsForAwards.slice(0, 8)).map((year) => {
                                        const awards = seasonAwardsSummary[year];
                                        return (
                                            <div key={`desktop-awards-${year}`} className="bg-white rounded-lg shadow-sm p-3 border-l-4 border-blue-500">
                                                <div className="flex items-start gap-4">
                                                    {/* Year column */}
                                                    <div className="w-20 flex-shrink-0 text-sm font-semibold text-gray-800 mt-1">{year}</div>

                                                    {/* Awards area: two horizontal rows, aligned columns */}
                                                    <div className="flex-1">
                                                        <div className="grid grid-cols-3 gap-6 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-trophy text-yellow-500 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">Champion</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.champion}>{awards.champion}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-trophy text-gray-400 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">2nd Place</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.secondPlace}>{awards.secondPlace}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-trophy text-amber-800 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">3rd Place</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.thirdPlace}>{awards.thirdPlace}</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-6">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-medal text-yellow-500 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">Points Champ</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.pointsChamp}>{awards.pointsChamp}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-medal text-gray-400 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">Points 2nd</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.pointsSecond}>{awards.pointsSecond}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-medal text-amber-800 text-sm"></i>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-500">Points 3rd</div>
                                                                    <div className="text-sm font-medium truncate" title={awards.pointsThird}>{awards.pointsThird}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sortedYearsForAwards.length > 8 && (
                                        <div className="flex justify-center mt-2">
                                            <button
                                                className="text-blue-600 text-sm font-medium"
                                                onClick={() => setShowAllSeasons(!showAllSeasons)}
                                            >
                                                {showAllSeasons ? 'Show less' : `Show all ${sortedYearsForAwards.length}`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="text-center text-gray-600">No season-by-season award data available.</p>
                        )}
                    </section>

                    

                    {/* Chart Controls */}
                    {(averageScoreChartData.length > 0 || seasonalDPRChartData.length > 0) && availableYears.length > 5 && (
                        <section className="mb-6">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-gray-800 mb-3">Chart Display Options</h4>
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Show seasons:</label>
                                        <div className="flex gap-2 items-center">
                                            <select
                                                value={selectedStartYear}
                                                onChange={(e) => setSelectedStartYear(e.target.value)}
                                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                {availableYears.map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-500">to</span>
                                            <select
                                                value={selectedEndYear}
                                                onChange={(e) => setSelectedEndYear(e.target.value)}
                                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                {availableYears.map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (availableYears.length > 0) {
                                                    const recent = availableYears.slice(-5);
                                                    setSelectedStartYear(recent[0]);
                                                    setSelectedEndYear(recent[recent.length - 1]);
                                                }
                                            }}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                                        >
                                            Last 5 seasons
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (availableYears.length > 0) {
                                                    setSelectedStartYear(availableYears[0]);
                                                    setSelectedEndYear(availableYears[availableYears.length - 1]);
                                                }
                                            }}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                                        >
                                            All seasons
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {availableYears.length > 10 && "Tip: Use season filters for better mobile viewing with many seasons"}
                                </p>
                            </div>
                        </section>
                    )}

                    {/* Average Matchup Score Chart */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Average Matchup Score by Season</h3>
                        <p className="text-sm text-gray-600 mb-4">Team yearly average scores over time. Shows highest and lowest team season averages with overall league average.</p>
                        {averageScoreChartData.length > 0 ? (
                            <div className="w-full">
                                {/* Mobile: Use taller aspect ratio for better readability */}
                                <div className="sm:hidden">
                                    <div className="w-full" style={{ height: '300px', minHeight: '300px' }}>
                                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                            <ComposedChart
                                                data={getFilteredChartData(averageScoreChartData)}
                                                margin={{ top: 20, right: 15, left: 15, bottom: 20 }}
                                            >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis 
                                                dataKey="year" 
                                                tick={{ fontSize: 10 }}
                                                interval={getXAxisInterval(getFilteredChartData(averageScoreChartData).length)}
                                                angle={-45}
                                                textAnchor="end"
                                                height={50}
                                            />
                                            <YAxis
                                                label={{ value: "Avg Points", angle: -90, position: "insideLeft", style: { textAnchor: 'middle', fontSize: '10px' } }}
                                                domain={['dataMin - 5', 'dataMax + 5']}
                                                tick={{ fontSize: 10 }}
                                                width={40}
                                            />
                                            <Tooltip content={<AverageScoreTooltip />} />
                                            <Legend 
                                                wrapperStyle={{ fontSize: '11px' }}
                                                iconSize={8}
                                            />
                                            
                                            <Line
                                                type="monotone"
                                                dataKey="highest"
                                                stroke="#10B981"
                                                strokeWidth={2}
                                                dot={{ r: 2, fill: '#10B981' }}
                                                name="Highest Avg"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="lowest"
                                                stroke="#EF4444"
                                                strokeWidth={2}
                                                dot={{ r: 2, fill: '#EF4444' }}
                                                name="Lowest Avg"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="average"
                                                stroke="#3B82F6"
                                                strokeWidth={3}
                                                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFF' }}
                                                activeDot={{ r: 5, stroke: '#3B82F6', strokeWidth: 2, fill: '#FFF' }}
                                                name="League Avg"
                                            />
                                        </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                
                                {/* Desktop: Use wider aspect ratio */}
                                <div className="hidden sm:block">
                                    <ResponsiveContainer width="100%" aspect={2.5}>
                                        <ComposedChart
                                            data={getFilteredChartData(averageScoreChartData)}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis 
                                                dataKey="year" 
                                                label={{ value: "Season", position: "insideBottom", offset: -5 }}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                                label={{ value: "Avg Points", angle: -90, position: "insideLeft", offset: 0 }}
                                                domain={['dataMin - 5', 'dataMax + 5']}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <Tooltip content={<AverageScoreTooltip />} />
                                            <Legend />
                                            
                                            <Line
                                                type="monotone"
                                                dataKey="highest"
                                                stroke="#10B981"
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: '#10B981' }}
                                                name="Highest Team Avg"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="lowest"
                                                stroke="#EF4444"
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: '#EF4444' }}
                                                name="Lowest Team Avg"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="average"
                                                stroke="#3B82F6"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFF' }}
                                                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2, fill: '#FFF' }}
                                                name="League Average"
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-600">No average score data available for charting.</p>
                        )}
                    </section>

                    {/* Total DPR Progression Line Graph */}
                    <section className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Total DPR Progression Over Seasons</h3>
                        {seasonalDPRChartData.length > 0 ? (
                            <div className="w-full">
                                {/* Mobile: Use fixed height for better readability */}
                                <div className="sm:hidden">
                                    <div className="w-full" style={{ height: '350px', minHeight: '350px' }}>
                                        <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                            <LineChart
                                                data={getFilteredChartData(seasonalDPRChartData)}
                                            margin={{ top: 20, right: 5, left: 5, bottom: 40 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis 
                                                dataKey="year" 
                                                tick={{ fontSize: 10 }}
                                                interval={getXAxisInterval(getFilteredChartData(seasonalDPRChartData).length)}
                                                angle={-45}
                                                textAnchor="end"
                                                height={50}
                                            />
                                            <YAxis
                                                label={{ value: "Rank", angle: -90, position: "insideLeft", style: { textAnchor: 'middle', fontSize: '10px' } }}
                                                domain={[1, numTeams]}
                                                tickFormatter={value => `#${value}`}
                                                ticks={yAxisTicks}
                                                reversed={true}
                                                allowDataOverflow={true}
                                                padding={{ top: 10, bottom: 10 }}
                                                tick={{ fontSize: 10 }}
                                                width={30}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend 
                                                wrapperStyle={{ fontSize: '10px' }}
                                                iconSize={6}
                                                layout="horizontal"
                                                align="center"
                                                verticalAlign="bottom"
                                                height={36}
                                            />
                                            {uniqueTeamsForChart.map((team, index) => (
                                                <Line
                                                    key={team}
                                                    type="monotone"
                                                    dataKey={team}
                                                    stroke={teamColors[index % teamColors.length]}
                                                    activeDot={{ r: 5 }}
                                                    dot={{ r: 2 }}
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                
                                {/* Desktop: Use wider aspect ratio */}
                                <div className="hidden sm:block">
                                    <ResponsiveContainer width="100%" aspect={1.5}>
                                        <LineChart
                                            data={getFilteredChartData(seasonalDPRChartData)}
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
                                                    dataKey={team}
                                                    stroke={teamColors[index % teamColors.length]}
                                                    activeDot={{ r: 8 }}
                                                    dot={{ r: 4 }}
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-600">No total DPR progression data available for charting.</p>
                        )}
                    </section>
                </>
            )}
            
            {/* Draft Pick Trade Details Modal */}
            {showTradeModal && selectedTeamTrades && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-xl font-bold text-gray-800">
                                Draft Pick Trades - {selectedTeamTrades.teamName}
                            </h3>
                            <button
                                onClick={() => setShowTradeModal(false)}
                                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="flex flex-col" style={{ maxHeight: 'calc(90vh - 160px)' }}>
                            {/* Scrollable content area */}
                            <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 240px)' }}>
                                <div className="p-6">
                                    {(() => {
                                        // Group picks by round for summary display
                                        const givenByRound = {};
                                        const receivedByRound = {};
                                        
                                        selectedTeamTrades.draftPicks.given.forEach(pick => {
                                            const round = pick.round || 'Unknown';
                                            if (!givenByRound[round]) givenByRound[round] = 0;
                                            givenByRound[round]++;
                                        });
                                        
                                        selectedTeamTrades.draftPicks.received.forEach(pick => {
                                            const round = pick.round || 'Unknown';
                                            if (!receivedByRound[round]) receivedByRound[round] = 0;
                                            receivedByRound[round]++;
                                        });
                                        
                                        const allRounds = new Set([...Object.keys(givenByRound), ...Object.keys(receivedByRound)]);
                                        const sortedRounds = Array.from(allRounds).sort((a, b) => {
                                            if (a === 'Unknown') return 1;
                                            if (b === 'Unknown') return -1;
                                            return parseInt(a) - parseInt(b);
                                        });
                                        
                                        return (
                                            <div>
                                                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                                                    Draft Pick Trades by Round
                                                </h4>
                                                <div className="border border-gray-200 rounded-lg">
                                                    <table className="min-w-full bg-white rounded-lg">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Round</th>
                                                                <th className="px-4 py-3 text-center text-sm font-medium text-red-600 border-b">Picks Given Away</th>
                                                                <th className="px-4 py-3 text-center text-sm font-medium text-green-600 border-b">Picks Received</th>
                                                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 border-b">Net</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {sortedRounds.map((round, idx) => {
                                                                const given = givenByRound[round] || 0;
                                                                const received = receivedByRound[round] || 0;
                                                                const net = received - given;
                                                                
                                                                return (
                                                                    <tr key={round} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                                        <td className="px-4 py-3 text-sm font-medium text-gray-800 border-b">
                                                                            Round {round}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center text-sm font-semibold text-red-600 border-b">
                                                                            {given > 0 ? given : '-'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center text-sm font-semibold text-green-600 border-b">
                                                                            {received > 0 ? received : '-'}
                                                                        </td>
                                                                        <td className={`px-4 py-3 text-center text-sm font-semibold border-b ${
                                                                            net > 0 ? 'text-green-600' : net < 0 ? 'text-red-600' : 'text-gray-500'
                                                                        }`}>
                                                                            {net > 0 ? '+' : ''}{net !== 0 ? net : '0'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            {sortedRounds.length === 0 && (
                                                                <tr>
                                                                    <td colSpan="4" className="px-4 py-6 text-center text-gray-500 italic">
                                                                        No draft pick trades found for this team
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {/* Add some bottom padding to ensure all content is scrollable */}
                                                <div className="h-4"></div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                            {/* Fixed Summary at bottom */}
                            <div className="flex-shrink-0 px-6 py-4 bg-blue-50 border-t border-blue-200" style={{ minHeight: '120px' }}>
                                <h5 className="font-semibold text-blue-800 mb-2">Overall Summary</h5>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="text-red-600 font-medium text-xs mb-1">Total Given</div>
                                        <div className="text-xl font-bold text-red-600">{selectedTeamTrades.draftPicks.given.length}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-green-600 font-medium text-xs mb-1">Total Received</div>
                                        <div className="text-xl font-bold text-green-600">{selectedTeamTrades.draftPicks.received.length}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-medium text-gray-700 text-xs mb-1">Net Balance</div>
                                        <div className={`text-xl font-bold ${
                                            selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length > 0 
                                                ? 'text-green-600' 
                                                : selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length < 0 
                                                ? 'text-red-600' 
                                                : 'text-gray-600'
                                        }`}>
                                            {selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length > 0 ? '+' : ''}
                                            {selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeagueHistory;
