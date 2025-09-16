// src/lib/TeamDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateTeamFinancialTotalsByOwnerId, calculateTeamTransactionCountsByOwnerId, formatCurrency } from '../utils/financialCalculations';
// We'll inline the record tables for tabs instead of importing the full components
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
    Label
} from 'recharts';

const getOrdinalSuffix = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return (s[v - 20] || s[v] || s[0]);
};

const calculateRank = (value, allValues, isHigherBetter = true) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return 'N/A';
    const numericValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));
    if (numericValues.length === 0) return 'N/A';
    const uniqueSortedValues = [...new Set(numericValues)].sort((a, b) => isHigherBetter ? b - a : a - b);
    let rank = 1;
    for (let i = 0; i < uniqueSortedValues.length; i++) {
        const currentUniqueValue = uniqueSortedValues[i];
        if (currentUniqueValue === value) {
            const tieCount = numericValues.filter(v => v === value).length;
            // Only show T- prefix if there are multiple teams with the same value and value > 0
            return (tieCount > 1 && value > 0) ? `T-${rank}${getOrdinalSuffix(rank)}` : `${rank}${getOrdinalSuffix(rank)}`;
        }
        rank += numericValues.filter(v => v === currentUniqueValue).length;
    }
    return 'N/A';
};

const formatScore = (score) =>
    typeof score === 'number' ? score.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
const formatPercentage = (value) =>
    typeof value === 'number' ? `${(value).toFixed(3).substring(1)}%` : 'N/A';
const formatLuckRating = (value) =>
    typeof value === 'number' ? value.toFixed(3) : 'N/A';
const formatDPR = (value) =>
    typeof value === 'number' && !isNaN(value)
        ? value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : 'N/A';

const TeamDetailPage = ({ teamName }) => { // Removed historicalMatchups and getMappedTeamName from props
    const {
        loading: contextLoading,
        error: contextError,
        historicalData, // Full historical data object from context
        allDraftHistory, // All draft history from context
        nflState, // NEW: Import nflState from context
        getTeamName: getTeamNameFromContext, // Renamed to avoid conflict
        usersData // Import users data for financial calculations
    } = useSleeperData();

    const [teamOverallStats, setTeamOverallStats] = useState(null);
    const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
    const [lastFiveGames, setLastFiveGames] = useState([]);
    const [recordInvolvements, setRecordInvolvements] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [teamCareerRecords, setTeamCareerRecords] = useState({ career: [], playoff: [], streak: [], season: [] });
    const [activeTab, setActiveTab] = useState('game');
    const [financialDataByYear, setFinancialDataByYear] = useState({});
    const [loadingFinancial, setLoadingFinancial] = useState(true);
    // Helper to aggregate all-time, playoff, streak, and season records for this team
    const aggregateTeamCareerRecords = async (teamName, ownerId) => {
        // --- League Records (Career/All-Time) ---
        const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameFromContext, nflState);
        // Find the record holders for each league record
        const leagueRecords = [];
        if (careerDPRData && Array.isArray(careerDPRData)) {
            // For each metric, find the max/min and who holds it
            const metrics = [
                { key: 'dpr', label: 'Highest DPR', isMax: true },
                { key: 'wins', label: 'Total Wins', isMax: true },
                { key: 'losses', label: 'Total Losses', isMax: true },
                { key: 'winPercentage', label: 'Best Win %', isMax: true, format: v => (v * 100).toFixed(3) + '%' },
                { key: 'allPlayWinPercentage', label: 'Best All-Play Win %', isMax: true, format: v => (v * 100).toFixed(3) + '%' },
                { key: 'topScoreWeeksCount', label: 'Most Weekly High Scores', isMax: true },
                { key: 'weeklyTop2ScoresCount', label: 'Most Weekly Top 2 Scores', isMax: true },
                { key: 'blowoutWins', label: 'Most Blowout Wins', isMax: true },
                { key: 'blowoutLosses', label: 'Most Blowout Losses', isMax: true },
                { key: 'slimWins', label: 'Most Slim Wins', isMax: true },
                { key: 'slimLosses', label: 'Most Slim Losses', isMax: true },
                { key: 'pointsFor', label: 'Most Total Points', isMax: true, format: v => v?.toFixed(2) },
                { key: 'pointsAgainst', label: 'Most Points Against', isMax: true, format: v => v?.toFixed(2) },
                { key: 'totalLuckRating', label: 'Best Luck', isMax: true, format: v => v?.toFixed(3) },
            ];
            metrics.forEach(metric => {
                let bestValue = metric.isMax ? -Infinity : Infinity;
                let holders = [];
                careerDPRData.forEach(team => {
                    const value = team[metric.key];
                    if (typeof value !== 'number' || isNaN(value)) return;
                    if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) {
                        bestValue = value;
                        holders = [team.ownerId];
                    } else if (value === bestValue) {
                        holders.push(team.ownerId);
                    }
                });
                if (holders.includes(ownerId)) {
                    const teamCareer = careerDPRData.find(t => t.ownerId === ownerId);
                    let value = teamCareer[metric.key];
                    if (metric.format) value = metric.format(value);
                    leagueRecords.push({ label: metric.label, value, details: '', year: '' });
                }
            });
        }

        // --- Playoff Records ---
        // For playoff records, find the max/min for each stat and only show if this team is a record holder
        const playoffStatsByOwner = {};
        Object.keys(historicalData.winnersBracketBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const matches = historicalData.winnersBracketBySeason[yearStr];
            matches.forEach(match => {
                const team1Id = String(match.team1_roster_id);
                const team2Id = String(match.team2_roster_id);
                const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1Id)?.owner_id;
                const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2Id)?.owner_id;
                [team1OwnerId, team2OwnerId].forEach(oid => {
                    if (!oid) return;
                    if (!playoffStatsByOwner[oid]) playoffStatsByOwner[oid] = { appearances: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, championships: 0, runnerUps: 0, thirdPlaces: 0 };
                });
                if (team1OwnerId) playoffStatsByOwner[team1OwnerId].appearances++;
                if (team2OwnerId) playoffStatsByOwner[team2OwnerId].appearances++;
                // For win/loss/tie/points
                const team1Score = Number(match.team1_score);
                const team2Score = Number(match.team2_score);
                if (!isNaN(team1Score) && !isNaN(team2Score)) {
                    if (team1Score > team2Score) { playoffStatsByOwner[team1OwnerId].wins++; playoffStatsByOwner[team2OwnerId].losses++; }
                    else if (team2Score > team1Score) { playoffStatsByOwner[team2OwnerId].wins++; playoffStatsByOwner[team1OwnerId].losses++; }
                    else if (team1Score === team2Score && team1Score > 0) { playoffStatsByOwner[team1OwnerId].ties++; playoffStatsByOwner[team2OwnerId].ties++; }
                    playoffStatsByOwner[team1OwnerId].pointsFor += team1Score;
                    playoffStatsByOwner[team1OwnerId].pointsAgainst += team2Score;
                    playoffStatsByOwner[team2OwnerId].pointsFor += team2Score;
                    playoffStatsByOwner[team2OwnerId].pointsAgainst += team1Score;
                }
                // Championships, runner-ups, third places
                if (match.p === 1 && match.w) {
                    if (match.w === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].championships++;
                    if (match.w === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].championships++;
                }
                if (match.p === 1 && match.l) {
                    if (match.l === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].runnerUps++;
                    if (match.l === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].runnerUps++;
                }
                if (match.p === 3 && match.w) {
                    if (match.w === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].thirdPlaces++;
                    if (match.w === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].thirdPlaces++;
                }
            });
        });
        // For each stat, find the record value and holders
        const playoffMetrics = [
            { key: 'appearances', label: 'Playoff Appearances', isMax: true },
            { key: 'wins', label: 'Playoff Wins', isMax: true },
            { key: 'losses', label: 'Playoff Losses', isMax: true },
            // { key: 'ties', label: 'Playoff Ties', isMax: true }, // Remove ties from display
            { key: 'pointsFor', label: 'Playoff Points For', isMax: true, format: v => v?.toFixed(2) },
            { key: 'pointsAgainst', label: 'Playoff Points Against', isMax: true, format: v => v?.toFixed(2) },
            { key: 'championships', label: 'Championships', isMax: true },
            { key: 'runnerUps', label: 'Runner-Ups', isMax: true },
            { key: 'thirdPlaces', label: 'Third Places', isMax: true },
        ];
        const playoffRecords = [];
        playoffMetrics.forEach(metric => {
            let bestValue = metric.isMax ? -Infinity : Infinity;
            let holders = [];
            Object.entries(playoffStatsByOwner).forEach(([oid, stats]) => {
                const value = stats[metric.key];
                if (typeof value !== 'number' || isNaN(value)) return;
                if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) {
                    bestValue = value;
                    holders = [oid];
                } else if (value === bestValue) {
                    holders.push(oid);
                }
            });
            if (holders.includes(String(ownerId))) {
                let value = playoffStatsByOwner[ownerId][metric.key];
                if (metric.format) value = metric.format(value);
                // Only show if value is not zero (for pointsFor/pointsAgainst), and for appearances, cap at number of playoff seasons
                if ((metric.key === 'pointsFor' || metric.key === 'pointsAgainst') && Number(value) === 0) return;
                if (metric.key === 'appearances') {
                    // Cap appearances at number of playoff seasons
                    const playoffSeasons = Object.keys(historicalData.winnersBracketBySeason || {}).length;
                    value = Math.min(Number(value), playoffSeasons);
                }
                playoffRecords.push({ label: metric.label, value });
            }
        });

        // --- Streak Records ---
        // Find longest win/loss streaks for all teams, only show if this team holds the record
        const streaksByOwner = {};
        Object.keys(historicalData.matchupsBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonMatchups = historicalData.matchupsBySeason[yearStr];
            Object.values(historicalData.rostersBySeason?.[year] || {}).forEach(r => {
                const oid = r.owner_id;
                if (!oid) return;
                if (!streaksByOwner[oid]) streaksByOwner[oid] = { win: 0, loss: 0 };
                let currentWin = 0, currentLoss = 0;
                let games = seasonMatchups.filter(m => String(m.team1_roster_id) === String(r.roster_id) || String(m.team2_roster_id) === String(r.roster_id));
                games = games.sort((a, b) => (parseInt(a.week) - parseInt(b.week)));
                games.forEach(m => {
                    const isTeam1 = String(m.team1_roster_id) === String(r.roster_id);
                    const myScore = isTeam1 ? Number(m.team1_score) : Number(m.team2_score);
                    const oppScore = isTeam1 ? Number(m.team2_score) : Number(m.team1_score);
                    if (isNaN(myScore) || isNaN(oppScore)) return;
                    if (myScore > oppScore) {
                        currentWin++;
                        if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss;
                        currentLoss = 0;
                    } else if (myScore < oppScore) {
                        currentLoss++;
                        if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin;
                        currentWin = 0;
                    } else {
                        if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin;
                        if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss;
                        currentWin = 0; currentLoss = 0;
                    }
                });
                if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin;
                if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss;
            });
        });
        // Find max win/loss streaks and holders
        let maxWin = -Infinity, maxLoss = -Infinity, winHolders = [], lossHolders = [];
        Object.entries(streaksByOwner).forEach(([oid, s]) => {
            if (s.win > maxWin) { maxWin = s.win; winHolders = [oid]; }
            else if (s.win === maxWin) winHolders.push(oid);
            if (s.loss > maxLoss) { maxLoss = s.loss; lossHolders = [oid]; }
            else if (s.loss === maxLoss) lossHolders.push(oid);
        });
        const streakRecords = [];
        if (winHolders.includes(String(ownerId))) streakRecords.push({ label: 'Longest Win Streak', value: maxWin, details: '', year: '' });
        if (lossHolders.includes(String(ownerId))) streakRecords.push({ label: 'Longest Losing Streak', value: maxLoss, details: '', year: '' });

        // --- Season Records ---
        // For each season stat, find the best/worst and only show if this team holds it
        const seasonRecords = [];
        const seasonMetrics = [
            { key: 'wins', label: 'Most Wins in a Season', isMax: true },
            { key: 'losses', label: 'Most Losses in a Season', isMax: true },
            { key: 'winPercentage', label: 'Best Win % in a Season', isMax: true, format: v => (v * 100).toFixed(3) + '%' },
            { key: 'pointsFor', label: 'Most Points For in a Season', isMax: true, format: v => v?.toFixed(2) },
            { key: 'luckRating', label: 'Best Luck Rating in a Season', isMax: true, format: v => v?.toFixed(3) },
            { key: 'adjustedDPR', label: 'Highest DPR in a Season', isMax: true, format: v => v?.toFixed(3) },
        ];
        seasonMetrics.forEach(metric => {
            let bestValue = metric.isMax ? -Infinity : Infinity;
            let holders = [];
            Object.keys(seasonalMetrics).forEach(yearStr => {
                const year = parseInt(yearStr);
                const teams = Object.values(seasonalMetrics[year]);
                teams.forEach(team => {
                    const value = team[metric.key];
                    if (typeof value !== 'number' || isNaN(value)) return;
                    if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) {
                        bestValue = value;
                        holders = [{ ownerId: team.ownerId, year }];
                    } else if (value === bestValue) {
                        holders.push({ ownerId: team.ownerId, year });
                    }
                });
            });
            holders.forEach(h => {
                if (h.ownerId === ownerId) {
                    let value = null;
                    Object.keys(seasonalMetrics).forEach(yearStr => {
                        const year = parseInt(yearStr);
                        if (year !== h.year) return;
                        const team = Object.values(seasonalMetrics[year]).find(t => t.ownerId === ownerId);
                        if (team) value = team[metric.key];
                    });
                    if (metric.format) value = metric.format(value);
                    seasonRecords.push({ label: metric.label, value, year: h.year, details: '' });
                }
            });
        });

        return {
            career: leagueRecords,
            playoff: playoffRecords,
            streak: streakRecords,
            season: seasonRecords
        };
    };
    const [sortBy, setSortBy] = useState('year');
    const [sortOrder, setSortOrder] = useState('desc');

    // Safely resolve a team name using ownerId when available; otherwise fall back to roster metadata or a roster label
    const resolveTeamName = (year, rosterId, ownerId) => {
        try {
            if (ownerId) {
                const name = getTeamNameFromContext(ownerId, year);
                if (name && !String(name).startsWith('Unknown Team')) return name;
            }
            const rosterList = historicalData?.rostersBySeason?.[year];
            const rosterObj = Array.isArray(rosterList)
                ? rosterList.find(r => String(r?.roster_id) === String(rosterId))
                : null;
            const meta = rosterObj?.metadata || {};
            const fallbackName = meta.team_name || meta.nickname || rosterObj?.display_name || null;
            if (fallbackName) return fallbackName;
            return `Roster ${rosterId ?? '?'}`;
        } catch (e) {
            return `Roster ${rosterId ?? '?'}`;
        }
    };

    // Detect invalid roster IDs (byes or missing data)
    const isInvalidRosterId = (rid) => rid === null || rid === undefined || String(rid) === 'null' || String(rid) === 'undefined';

    useEffect(() => {
        // Ensure teamName is always treated as a string for consistency
        const currentTeamName = String(teamName || '');

        if (contextLoading || contextError || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
            setLoadingStats(false);
            return;
        }

        // Ensure getTeamNameFromContext is a function
        if (typeof getTeamNameFromContext !== 'function') {
            console.error("TeamDetailPage: getTeamNameFromContext is not a function. Cannot process data.");
            setLoadingStats(false);
            return;
        }

        setLoadingStats(true);

        // Call calculateAllLeagueMetrics with the full historicalData object and allDraftHistory
        // NEW: Pass nflState to calculateAllLeagueMetrics
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameFromContext, nflState);

        // Find the ownerId for the current teamName
        let currentTeamOwnerId = null;
        // Find the career stats for the current team directly from calculatedCareerDPRs
        const teamCareerStats = calculatedCareerDPRs.find(dpr => getTeamNameFromContext(dpr.ownerId, null) === currentTeamName);
        if (teamCareerStats) {
            currentTeamOwnerId = teamCareerStats.ownerId;
        }

        if (!currentTeamOwnerId) {
            console.warn(`TeamDetailPage: Could not find ownerId for teamName: ${currentTeamName}. Displaying no data.`);
            setLoadingStats(false);
            setTeamOverallStats(null);
            setTeamSeasonHistory([]);
            return;
        }

        const overallStats = {
            totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGamesPlayed: 0,
            overallTopScoreWeeksCount: 0, playoffAppearancesCount: 0,
            avgDPR: 0, // This will now be directly from teamCareerStats.dpr
            totalChampionships: 0, totalRunnerUps: 0, totalThirdPlaces: 0,
            totalPointsChampionships: 0, totalPointsRunnerUps: 0, totalThirdPlacePoints: 0,
            winRank: 'N/A', winPercentageRank: 'N/A', pointsForRank: 'N/A',
            topScoreWeeksRank: 'N/A', playoffRank: 'N/A', championshipRank: 'N/A', luckRank: 'N/A',
            ownerId: currentTeamOwnerId
        };

        const compiledSeasonHistory = [];
        const allTeamsAggregatedStats = {}; // To hold aggregated stats for all teams for ranking purposes

        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);
        const latestSeason = allYears.length > 0 ? Math.max(...allYears) : null;

        // Determine if the latest season's playoffs are complete
        let isLatestSeasonPlayoffsComplete = false;
        if (latestSeason && historicalData.winnersBracketBySeason[latestSeason]) {
            const winnersBracketForLatestSeason = historicalData.winnersBracketBySeason[latestSeason];
            // Find the championship match (p=1)
            const championshipMatch = winnersBracketForLatestSeason.find(match => match.p === 1);
            // If the championship match exists and has both a winner and a loser, playoffs are complete
            if (championshipMatch && championshipMatch.w && championshipMatch.l) {
                isLatestSeasonPlayoffsComplete = true;
            }
        }
        console.log(`TeamDetailPage: Latest season is ${latestSeason}. Playoff completion status: ${isLatestSeasonPlayoffsComplete ? 'COMPLETE' : 'IN PROGRESS/INCOMPLETE'}`);


        // First, aggregate stats for ALL teams from seasonalMetrics for overall ranks
        Object.keys(seasonalMetrics).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonalStatsForYear = seasonalMetrics[year];
            if (seasonalStatsForYear) {
                Object.values(seasonalStatsForYear).forEach(teamSeasonalData => {
                    const ownerId = teamSeasonalData.ownerId;
                    const teamDisplayName = getTeamNameFromContext(ownerId, null);

                    if (!teamDisplayName || teamDisplayName.startsWith('Unknown Team (ID:')) {
                        return;
                    }

                    if (!allTeamsAggregatedStats[teamDisplayName]) {
                        allTeamsAggregatedStats[teamDisplayName] = {
                            wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGamesPlayed: 0,
                            championships: 0, runnerUps: 0, thirdPlaces: 0,
                            firstPoints: 0, secondPoints: 0, thirdPoints: 0,
                            topScoreWeeksCount: 0,
                            playoffAppearancesCount: 0,
                            totalLuckRating: 0,
                            ownerId: ownerId
                        };
                    }

                    const stats = allTeamsAggregatedStats[teamDisplayName];

                    // Always aggregate raw game stats (wins, losses, points, total games)
                    // These are cumulative regardless of season completion
                    stats.wins += teamSeasonalData.wins;
                    stats.losses += teamSeasonalData.losses;
                    stats.ties += teamSeasonalData.ties;
                    stats.pointsFor += teamSeasonalData.pointsFor;
                    stats.totalGamesPlayed += teamSeasonalData.totalGames;

                    // Only count awards and summary stats for completed seasons,
                    // or the latest season IF its playoffs are complete
                    const shouldCountForOverallStats = (year < latestSeason) || (year === latestSeason && isLatestSeasonPlayoffsComplete);

                    if (shouldCountForOverallStats) {
                        stats.topScoreWeeksCount += (teamSeasonalData.topScoreWeeksCount || 0);
                        stats.totalLuckRating += (teamSeasonalData.luckRating || 0); // Aggregate luck rating only for completed seasons

                        // Playoff appearances are now counted only if rank is 1-6 (winners bracket)
                        if (typeof teamSeasonalData.rank === 'number' && teamSeasonalData.rank <= 6) {
                            stats.playoffAppearancesCount++;
                        }
                        if (teamSeasonalData.isChampion) stats.championships++;
                        if (teamSeasonalData.isRunnerUp) stats.runnerUps++;
                        if (teamSeasonalData.isThirdPlace) stats.thirdPlaces++;
                        if (teamSeasonalData.isPointsChampion) stats.firstPoints++;
                        if (teamSeasonalData.isPointsRunnerUp) stats.secondPoints++;
                        if (teamSeasonalData.isThirdPlacePoints) stats.thirdPoints++;
                    }
                });
            }
        });

        // Now, populate overallStats for the specific `teamName`
        const currentTeamAggregatedStats = allTeamsAggregatedStats[currentTeamName];

        if (currentTeamAggregatedStats) {
            Object.assign(overallStats, {
                totalWins: currentTeamAggregatedStats.wins,
                totalLosses: currentTeamAggregatedStats.losses,
                totalTies: currentTeamAggregatedStats.ties,
                totalPointsFor: currentTeamAggregatedStats.pointsFor,
                totalGamesPlayed: currentTeamAggregatedStats.totalGamesPlayed,
                overallTopScoreWeeksCount: currentTeamAggregatedStats.topScoreWeeksCount,
                playoffAppearancesCount: currentTeamAggregatedStats.playoffAppearancesCount,
                // Assign avgDPR directly from the found teamCareerStats
                avgDPR: teamCareerStats && typeof teamCareerStats.dpr === 'number' ? teamCareerStats.dpr : null,
                totalChampionships: currentTeamAggregatedStats.championships,
                totalRunnerUps: currentTeamAggregatedStats.runnerUps,
                totalThirdPlaces: currentTeamAggregatedStats.thirdPlaces,
                totalPointsChampionships: currentTeamAggregatedStats.firstPoints,
                totalPointsRunnerUps: currentTeamAggregatedStats.secondPoints,
                totalThirdPlacePoints: currentTeamAggregatedStats.thirdPoints,
                luckRating: currentTeamAggregatedStats.totalLuckRating, // This is the sum, not average.
            });

            // Calculate ranks based on allTeamsAggregatedStats
            const allWins = Object.values(allTeamsAggregatedStats).map(s => s.wins);
            const allWinPercentages = Object.values(allTeamsAggregatedStats).map(s => (s.wins + (s.ties > 0 ? 0.5 * s.ties : 0)) / s.totalGamesPlayed);
            const allPointsFor = Object.values(allTeamsAggregatedStats).map(s => s.pointsFor);
            const allTopScoreWeeks = Object.values(allTeamsAggregatedStats).map(s => s.topScoreWeeksCount);
            const allPlayoffAppearances = Object.values(allTeamsAggregatedStats).map(s => s.playoffAppearancesCount);
            const allChampionships = Object.values(allTeamsAggregatedStats).map(s => s.championships);
            const allLuckRatings = Object.values(allTeamsAggregatedStats).map(s => s.totalLuckRating);

            overallStats.winRank = calculateRank(overallStats.totalWins, allWins);
            overallStats.winPercentageRank = calculateRank((overallStats.totalWins + (overallStats.totalTies > 0 ? 0.5 * overallStats.totalTies : 0)) / overallStats.totalGamesPlayed, allWinPercentages);
            overallStats.pointsForRank = calculateRank(overallStats.totalPointsFor, allPointsFor);
            overallStats.topScoreWeeksRank = calculateRank(overallStats.overallTopScoreWeeksCount, allTopScoreWeeks);
            overallStats.playoffRank = calculateRank(overallStats.playoffAppearancesCount, allPlayoffAppearances);
            overallStats.championshipRank = calculateRank(overallStats.totalChampionships, allChampionships);
            overallStats.luckRank = calculateRank(overallStats.luckRating, allLuckRatings, false); // Lower luck rating is better

        } else {
            // If the current teamName is not found in aggregated stats, it means no data for it.
            setLoadingStats(false);
            setTeamOverallStats(null);
            setTeamSeasonHistory([]);
            return;
        }


        // Populate compiledSeasonHistory for the specific `teamName`
        allYears.forEach(year => {
            const seasonalStatsForYear = seasonalMetrics[year];
            if (seasonalStatsForYear) {
                const teamSeasonalData = Object.values(seasonalStatsForYear).find(s => s.ownerId === currentTeamOwnerId);

                if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
                    // Ensure team name is resolved for this specific year for display in the table
                    const displayTeamNameForSeason = getTeamNameFromContext(currentTeamOwnerId, year);

                    compiledSeasonHistory.push({
                        year,
                        team: displayTeamNameForSeason,
                        wins: teamSeasonalData.wins,
                        losses: teamSeasonalData.losses,
                        ties: teamSeasonalData.ties,
                        pointsFor: teamSeasonalData.pointsFor,
                        pointsAgainst: teamSeasonalData.pointsAgainst,
                        luckRating: teamSeasonalData.luckRating,
                        adjustedDPR: typeof teamSeasonalData.adjustedDPR === 'number' ? teamSeasonalData.adjustedDPR : null,
                        allPlayWinPercentage: teamSeasonalData.allPlayWinPercentage,
                        winPercentage: teamSeasonalData.winPercentage,
                        // Display N/A for finish and points finish if it's the current/latest season
                        // AND its playoffs are NOT complete.
                        finish: (year === latestSeason && !isLatestSeasonPlayoffsComplete) ? 'N/A' : (teamSeasonalData.rank ? `${teamSeasonalData.rank}${getOrdinalSuffix(teamSeasonalData.rank)}` : 'N/A'),
                        pointsFinish: (year === latestSeason && !isLatestSeasonPlayoffsComplete) ? 'N/A' : (teamSeasonalData.pointsRank ? `${teamSeasonalData.pointsRank}${getOrdinalSuffix(teamSeasonalData.pointsRank)}` : 'N/A')
                    });
                }
            }
        });

        // Build previous 5 completed games across all seasons relative to current NFL state
        const games = [];
        const currentSeason = parseInt(nflState?.season) || null;
        const currentWeek = parseInt(nflState?.week) || null;
        Object.keys(historicalData.matchupsBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonMatchups = historicalData.matchupsBySeason[yearStr];
            const rosterForYear = historicalData.rostersBySeason?.[year]?.find(r => String(r.owner_id) === String(currentTeamOwnerId));
            if (!rosterForYear) return;
            const rosterId = String(rosterForYear.roster_id);
            seasonMatchups.forEach(m => {
                const team1Id = String(m.team1_roster_id);
                const team2Id = String(m.team2_roster_id);
                // Skip byes or malformed matchups with invalid roster ids
                if (isInvalidRosterId(team1Id) || isInvalidRosterId(team2Id)) return;
                if (team1Id !== rosterId && team2Id !== rosterId) return;
                const week = parseInt(m.week);
                const team1Score = Number(m.team1_score);
                const team2Score = Number(m.team2_score);
                // Skip unplayed or invalid games
                if (isNaN(team1Score) || isNaN(team2Score)) return;
                if (team1Score === 0 && team2Score === 0) return;
                // Only include games strictly before the current NFL week if nflState is available
                if (
                    currentSeason && currentWeek && (
                        year > currentSeason || (year === currentSeason && week >= currentWeek)
                    )
                ) {
                    return;
                }
                const isTeam1 = team1Id === rosterId;
                const myScore = isTeam1 ? team1Score : team2Score;
                const oppScore = isTeam1 ? team2Score : team1Score;
                const oppRosterId = isTeam1 ? team2Id : team1Id;
                if (isInvalidRosterId(oppRosterId)) return; // exclude byes
                const oppOwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(oppRosterId))?.owner_id;
                const opponentName = resolveTeamName(year, oppRosterId, oppOwnerId);
                const result = myScore === oppScore ? 'T' : (myScore > oppScore ? 'W' : 'L');
                const margin = Math.abs(myScore - oppScore);
                games.push({ year, week, opponent: opponentName, myScore, oppScore, result, margin });
            });
        });
        games.sort((a, b) => (b.year - a.year) || (b.week - a.week));
        setLastFiveGames(games.slice(0, 5));

        // Compute record involvements (top-5 appearances across record categories)
        const tempRecords = {
            mostPointsScored: [],
            mostPointsInLoss: [],
            fewestPointsScored: [],
            fewestPointsInWin: [],
            highestCombinedScore: [],
            lowestCombinedScore: [],
            biggestBlowout: [],
            slimmestWin: []
        };

        // Build entries across all matchups with owner ids for filtering
    Object.keys(historicalData.matchupsBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonMatchups = historicalData.matchupsBySeason[yearStr];
            seasonMatchups.forEach(m => {
                const week = parseInt(m.week);
        const team1RosterId = String(m.team1_roster_id);
        const team2RosterId = String(m.team2_roster_id);
        // Skip byes or malformed matchups
        if (isInvalidRosterId(team1RosterId) || isInvalidRosterId(team2RosterId)) return;
                const team1Score = Number(m.team1_score);
                const team2Score = Number(m.team2_score);
                if ([team1Score, team2Score, week, year].some(v => typeof v !== 'number' || isNaN(v))) return;
                const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
                const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId)?.owner_id;
                const team1Name = resolveTeamName(year, team1RosterId, team1OwnerId);
                const team2Name = resolveTeamName(year, team2RosterId, team2OwnerId);
                const combined = team1Score + team2Score;
                const isTie = team1Score === team2Score && team1Score > 0;
                const winner = isTie ? null : (team1Score > team2Score ? team1Name : team2Name);
                const loser = isTie ? null : (team1Score > team2Score ? team2Name : team1Name);
                const margin = Math.abs(team1Score - team2Score);

                // team-based
                tempRecords.mostPointsScored.push({ year, week, team: team1Name, score: team1Score, opponent: team2Name, ownerId: team1OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                tempRecords.mostPointsScored.push({ year, week, team: team2Name, score: team2Score, opponent: team1Name, ownerId: team2OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                if (team1Score > 0) tempRecords.fewestPointsScored.push({ year, week, team: team1Name, score: team1Score, opponent: team2Name, ownerId: team1OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                if (team2Score > 0) tempRecords.fewestPointsScored.push({ year, week, team: team2Name, score: team2Score, opponent: team1Name, ownerId: team2OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });

                if (!isTie) {
                    // most in loss
                    const losingTeam = team1Score < team2Score ? team1Name : team2Name;
                    const losingScore = Math.min(team1Score, team2Score);
                    const losingOwnerId = team1Score < team2Score ? team1OwnerId : team2OwnerId;
                    const winningTeam = team1Score > team2Score ? team1Name : team2Name;
                    tempRecords.mostPointsInLoss.push({ year, week, team: losingTeam, score: losingScore, opponent: winningTeam, ownerId: losingOwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });

                    // fewest in win
                    const winningScore = Math.max(team1Score, team2Score);
                    const winningOwnerId = team1Score > team2Score ? team1OwnerId : team2OwnerId;
                    const losingOppTeam = team1Score < team2Score ? team1Name : team2Name;
                    const winnerTeamName = winningTeam;
                    tempRecords.fewestPointsInWin.push({ year, week, team: winnerTeamName, score: winningScore, opponent: losingOppTeam, ownerId: winningOwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });

                    // margins
                    tempRecords.biggestBlowout.push({ year, week, winner, loser, value: margin, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                    if (margin > 0) tempRecords.slimmestWin.push({ year, week, winner, loser, value: margin, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                }

                // combined
                if (combined > 0 && team1Score > 0 && team2Score > 0) {
                    tempRecords.lowestCombinedScore.push({ year, week, team1: team1Name, team2: team2Name, value: combined, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1Score, team2Score });
                }
                // Only include played games for highest combined to avoid 0-0 scheduled entries
                if (team1Score > 0 || team2Score > 0) {
                    tempRecords.highestCombinedScore.push({ year, week, team1: team1Name, team2: team2Name, value: combined, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1Score, team2Score });
                }
            });
        });

        const recordLabels = {
            mostPointsScored: 'Most Points Scored by a Team',
            mostPointsInLoss: 'Most Points Scored in a Loss',
            fewestPointsScored: 'Fewest Points Scored by a Team',
            fewestPointsInWin: 'Fewest Points Scored in a Win',
            highestCombinedScore: 'Highest Combined Score',
            lowestCombinedScore: 'Lowest Combined Score',
            biggestBlowout: 'Biggest Blowout',
            slimmestWin: 'Slimmest Win'
        };

        const involvement = [];
        Object.keys(tempRecords).forEach(key => {
            const isMin = ['fewestPointsScored', 'fewestPointsInWin', 'lowestCombinedScore', 'slimmestWin'].includes(key);
            const list = tempRecords[key];
            if (!Array.isArray(list) || list.length === 0) return;
            const sortFn = (a, b) => isMin ? a.value - b.value : b.value - a.value;
            const top5 = list
                .map(item => ({ ...item, value: typeof item.value === 'number' ? item.value : (typeof item.score === 'number' ? item.score : Number.NEGATIVE_INFINITY) }))
                .filter(item => typeof item.value === 'number' && !isNaN(item.value))
                .sort(sortFn)
                .slice(0, 5);
            top5.forEach((item, idx) => {
                // Determine if current team is the record holder or the opponent
                let role = '';
                // For team-based records (mostPointsScored, mostPointsInLoss, fewestPointsScored, fewestPointsInWin):
                //   item.ownerId is the record holder, item.opponent is the other team
                // For combined/margin records, both teams are involved, but we can try to infer
                const isRecordHolder = item.ownerId && String(item.ownerId) === String(currentTeamOwnerId);
                const isTeam1 = item.owner1Id && String(item.owner1Id) === String(currentTeamOwnerId);
                const isTeam2 = item.owner2Id && String(item.owner2Id) === String(currentTeamOwnerId);
                const involved = isRecordHolder || isTeam1 || isTeam2;
                if (involved) {
                    // Role logic
                    if (isRecordHolder) {
                        role = 'Record Holder';
                    } else if (isTeam1 || isTeam2) {
                        role = 'Opponent';
                    } else {
                        role = '';
                    }
                    const teamsText = item.team
                        ? `${item.team} vs ${item.opponent}`
                        : `${item.team1} vs ${item.team2}`;
                    involvement.push({
                        recordKey: key,
                        label: recordLabels[key],
                        rank: idx + 1,
                        value: item.value,
                        year: item.year,
                        week: item.week,
                        teamsText,
                        role,
                    });
                }
            });
        });

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setRecordInvolvements(involvement);
    // Aggregate all-time, playoff, streak, and season records for this team
    aggregateTeamCareerRecords(currentTeamName, currentTeamOwnerId).then(setTeamCareerRecords);
    setLoadingStats(false);
    console.log(`TeamDetailPage: Final teamOverallStats for ${currentTeamName}:`, overallStats);


    }, [teamName, historicalData, allDraftHistory, nflState, getTeamNameFromContext, contextLoading, contextError]); // Dependencies updated with nflState

    // Fetch financial data for all years
    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!historicalData || !historicalData.matchupsBySeason) {
                console.log('No historical data available for financial fetch');
                setLoadingFinancial(false);
                return;
            }

            console.log('Starting financial data fetch...');
            setLoadingFinancial(true);
            try {
                // Get all available years from historical data
                const allYears = Object.keys(historicalData.matchupsBySeason).map(String);
                console.log('Available years for financial data:', allYears);
                
                if (allYears.length === 0) {
                    console.log('No years found in historical data');
                    setFinancialDataByYear({});
                    setLoadingFinancial(false);
                    return;
                }

                // Fetch financial data for all years
                console.log('Fetching financial data for years:', allYears);
                const financialData = await fetchFinancialDataForYears(allYears);
                console.log('Received financial data:', financialData);
                setFinancialDataByYear(financialData);
            } catch (error) {
                console.error('Error fetching financial data:', error);
                setFinancialDataByYear({});
            } finally {
                setLoadingFinancial(false);
            }
        };

        fetchFinancialData();
    }, [historicalData]);

    // Helper function to get financial data for a team and year using owner ID
    const getTeamFinancialDataForYear = (year, ownerId) => {
        if (!financialDataByYear[year] || !financialDataByYear[year].transactions || !ownerId) {
            return {
                totalFees: 0,
                totalPayouts: 0,
                netTotal: 0,
                transactionCount: 0
            };
        }

        // Calculate financial totals using owner ID directly
        return calculateTeamFinancialTotalsByOwnerId(
            financialDataByYear[year].transactions,
            ownerId
        );
    };

    // Helper function to get transaction counts for a team and year using owner ID
    const getTeamTransactionCountsForYear = (year, ownerId) => {
        if (!financialDataByYear[year] || !financialDataByYear[year].transactions || !ownerId) {
            return {
                tradeFees: 0,
                waiverFees: 0,
                totalTransactions: 0
            };
        }

        // Calculate transaction counts using owner ID directly
        return calculateTeamTransactionCountsByOwnerId(
            financialDataByYear[year].transactions,
            ownerId
        );
    };

    const sortedSeasonHistory = useMemo(() => {
        const sortable = [...teamSeasonHistory];
        const parseRank = (r) => r === 'N/A' ? Infinity : parseInt(r.replace(/^T-/, '').match(/\d+/)?.[0] || '0');
        return sortable.sort((a, b) => {
            let valA, valB;
            
            if (sortBy === 'record') {
                valA = (a.wins + 0.5 * a.ties) / (a.wins + a.losses + a.ties);
                valB = (b.wins + 0.5 * b.ties) / (b.wins + b.losses + b.ties);
            } else if (sortBy === 'finish' || sortBy === 'pointsFinish') {
                valA = parseRank(a[sortBy]);
                valB = parseRank(b[sortBy]);
            } else if (sortBy === 'tradeCount') {
                const countsA = getTeamTransactionCountsForYear(a.year.toString(), teamOverallStats?.ownerId);
                const countsB = getTeamTransactionCountsForYear(b.year.toString(), teamOverallStats?.ownerId);
                valA = countsA.tradeFees;
                valB = countsB.tradeFees;
            } else if (sortBy === 'waiverCount') {
                const countsA = getTeamTransactionCountsForYear(a.year.toString(), teamOverallStats?.ownerId);
                const countsB = getTeamTransactionCountsForYear(b.year.toString(), teamOverallStats?.ownerId);
                valA = countsA.waiverFees;
                valB = countsB.waiverFees;
            } else if (sortBy === 'netFinancial') {
                const financialA = getTeamFinancialDataForYear(a.year.toString(), teamOverallStats?.ownerId);
                const financialB = getTeamFinancialDataForYear(b.year.toString(), teamOverallStats?.ownerId);
                valA = financialA.netTotal;
                valB = financialB.netTotal;
            } else {
                valA = a[sortBy];
                valB = b[sortBy];
            }
            
            return (valA < valB ? -1 : valA > valB ? 1 : 0) * (sortOrder === 'asc' ? 1 : -1);
        });
        }, [teamSeasonHistory, sortBy, sortOrder, financialDataByYear, teamOverallStats?.ownerId]);    const handleSort = (column) => {
        if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortBy(column); setSortOrder('asc'); }
    };

    if (loadingStats) {
        return (
            <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8 text-center text-gray-600">
                Loading {teamName}'s historical data...
            </div>
        );
    }

    if (!teamOverallStats) {
        return (
            <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8 text-center text-red-500">
                No data found for {teamName}.
            </div>
        );
    }

    return (
        <div className="w-full bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-md mt-4 sm:mt-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-700 mb-4 sm:mb-6 text-center border-b pb-2 sm:pb-3">
                {teamName}
                <span className="block text-base sm:text-lg font-medium text-gray-600 mt-1 sm:mt-2">
                    Record: {teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies} | Career DPR: {formatDPR(teamOverallStats.avgDPR)}
                    <div className="flex flex-wrap justify-center items-center gap-2 whitespace-nowrap mt-1">
                        {teamOverallStats.totalChampionships > 0 && (
                            <span title={`Sween Bowl Champion (${teamOverallStats.totalChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-trophy text-yellow-500 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalChampionships}x</span>
                            </span>
                        )}
                        {teamOverallStats.totalRunnerUps > 0 && (
                            <span title={`Sween Bowl Runner-Up (${teamOverallStats.totalRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-trophy text-gray-400 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalRunnerUps}x</span>
                            </span>
                        )}
                        {teamOverallStats.totalThirdPlaces > 0 && (
                            <span title={`3rd Place Finish (${teamOverallStats.totalThirdPlaces}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-trophy text-amber-800 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalThirdPlaces}x</span>
                            </span>
                        )}
                        {teamOverallStats.totalPointsChampionships > 0 && (
                            <span title={`1st Place - Points (${teamOverallStats.totalPointsChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-medal text-yellow-500 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalPointsChampionships}x</span>
                            </span>
                        )}
                        {teamOverallStats.totalPointsRunnerUps > 0 && (
                            <span title={`2nd Place - Points (${teamOverallStats.totalPointsRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-medal text-gray-400 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalPointsRunnerUps}x</span>
                            </span>
                        )}
                        {teamOverallStats.totalThirdPlacePoints > 0 && (
                            <span title={`3rd Place - Points (${teamOverallStats.totalThirdPlacePoints}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                                <i className="fas fa-medal text-amber-800 text-2xl"></i>
                                <span className="text-xs font-medium">{teamOverallStats.totalThirdPlacePoints}x</span>
                            </span>
                        )}
                    </div>
                </span>
            </h2> {/* Corrected closing tag for h2 */}

            {/* Overall Stats */}
            <section className="mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">League Ranks</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <StatCard title="Total Wins" value={teamOverallStats.totalWins} rank={teamOverallStats.winRank} />
                    <StatCard title="Win %" value={formatPercentage((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed)} rank={teamOverallStats.winPercentageRank} />
                    <StatCard title="Total Points" value={formatScore(teamOverallStats.totalPointsFor)} rank={teamOverallStats.pointsForRank} />
                    <StatCard
                        title="Weekly Top Scores"
                        value={
                            teamOverallStats.overallTopScoreWeeksCount !== undefined
                                ? `${teamOverallStats.overallTopScoreWeeksCount}`
                                : 'N/A'
                        }
                        rank={teamOverallStats.topScoreWeeksRank}
                    />
                    <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearancesCount} rank={teamOverallStats.playoffRank} />
                    <StatCard title="Championships" value={teamOverallStats.totalChampionships} rank={teamOverallStats.championshipRank} />
                </div>
            </section>

            {/* Season by Season History Table */}
            <section className="mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Season History</h3>
                {teamSeasonHistory.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs sm:text-sm bg-white">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('year')}>
                                        Year {sortBy === 'year' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('record')}>
                                        Record (W-L-T) {sortBy === 'record' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsFor')}>
                                        Points For {sortBy === 'pointsFor' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-red-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsAgainst')}>
                                        Points Against {sortBy === 'pointsAgainst' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('luckRating')}>
                                        Luck Rating {sortBy === 'luckRating' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-purple-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('finish')}>
                                        Finish {sortBy === 'finish' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsFinish')}>
                                        Points Finish {sortBy === 'pointsFinish' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('adjustedDPR')}>
                                        Adjusted DPR {sortBy === 'adjustedDPR' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('allPlayWinPercentage')}>
                                        All-Play Win % {sortBy === 'allPlayWinPercentage' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-indigo-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('tradeCount')}>
                                        Trades {sortBy === 'tradeCount' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-cyan-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('waiverCount')}>
                                        FA/Waivers {sortBy === 'waiverCount' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="py-2 px-3 text-xs font-semibold text-orange-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('netFinancial')}>
                                        Net Financial {sortBy === 'netFinancial' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSeasonHistory.map((season, index) => {
                                    const financialData = getTeamFinancialDataForYear(season.year.toString(), teamOverallStats?.ownerId);
                                    const transactionCounts = getTeamTransactionCountsForYear(season.year.toString(), teamOverallStats?.ownerId);
                                    return (
                                        <tr key={season.year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="py-2 px-3 text-sm text-gray-800 text-center">{season.year}</td>
                                            <td className="py-2 px-3 text-sm text-gray-800 text-center">{season.ties > 0 ? `${season.wins}-${season.losses}-${season.ties}` : `${season.wins}-${season.losses}`}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsFor)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsAgainst)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatLuckRating(season.luckRating)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.finish}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.pointsFinish}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatDPR(season.adjustedDPR)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatPercentage(season.allPlayWinPercentage)}</td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                                {loadingFinancial ? '...' : transactionCounts.tradeFees}
                                            </td>
                                            <td className="py-2 px-3 text-sm text-gray-700 text-center">
                                                {loadingFinancial ? '...' : transactionCounts.waiverFees}
                                            </td>
                                            <td className={`py-2 px-3 text-sm text-center ${
                                                loadingFinancial ? 'text-gray-400' : 
                                                financialData.netTotal > 0 ? 'text-green-600' : 
                                                financialData.netTotal < 0 ? 'text-red-600' : 
                                                'text-gray-700'
                                            }`}>
                                                {loadingFinancial ? '...' : formatCurrency(financialData.netTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-600">No season-by-season data available for {teamName} for completed seasons.</p>
                )}
            </section>

            {/* Previous 5 Games */}
            <section className="mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Previous 5 Games</h3>
                {lastFiveGames.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs sm:text-sm bg-white">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Season</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-left">Opponent</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Result</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-right">Team</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-right">Opponent</th>
                                    <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lastFiveGames.map((g, idx) => (
                                    <tr key={`${g.year}-${g.week}-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-center">{g.year} • W{g.week}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800">{g.opponent}</td>
                                        <td className={`py-2 px-3 text-sm text-center ${g.result === 'W' ? 'text-green-700' : g.result === 'L' ? 'text-red-700' : 'text-gray-700'}`}>{g.result}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-right">{formatScore(g.myScore)}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-right">{formatScore(g.oppScore)}</td>
                                        <td className="py-2 px-3 text-sm text-gray-800 text-center">{formatScore(g.margin)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-600">No recent games available.</p>
                )}
            </section>

            {/* Combo Graph: DPR (bar), Finish (line) by Season */}
            <section className="mb-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">DPR &amp; Finish by Season</h3>
                {teamSeasonHistory.length > 0 ? (
                    (() => {
                        // Calculate dynamic DPR range
                        const dprVals = teamSeasonHistory
                            .map(s => typeof s.adjustedDPR === 'number' ? Number(s.adjustedDPR) : null)
                            .filter(v => typeof v === 'number' && !isNaN(v));
                        let minDPR = Math.min(...dprVals);
                        let maxDPR = Math.max(...dprVals);
                        if (!isFinite(minDPR) || !isFinite(maxDPR)) {
                            minDPR = 0.6; maxDPR = 1.3;
                        } else {
                            // Add a little padding
                            const pad = Math.max(0.03, (maxDPR - minDPR) * 0.12);
                            minDPR = Math.floor((minDPR - pad) * 1000) / 1000;
                            maxDPR = Math.ceil((maxDPR + pad) * 1000) / 1000;
                            // Clamp to reasonable bounds
                            minDPR = Math.max(0.5, minDPR);
                            maxDPR = Math.min(1.5, maxDPR);
                        }
                        return (
                            <div className="w-full h-[220px] xs:h-[260px] sm:h-[340px] md:h-[400px] px-0 xs:px-1 sm:px-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                        data={teamSeasonHistory.map(s => ({
                                            season: s.year,
                                            dpr: typeof s.adjustedDPR === 'number' ? Number(s.adjustedDPR) : null,
                                            finish: typeof s.finish === 'string' && s.finish !== 'N/A' ? parseInt(s.finish.replace(/^T-/, '').match(/\d+/)?.[0] || '0') : null
                                        }))}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="season" tick={{ fontSize: 10 }} padding={{ left: 8, right: 8 }}>
                                            <Label value="Season" offset={-6} position="insideBottom" style={{ fontSize: 11 }} />
                                        </XAxis>
                                        <YAxis yAxisId="left" orientation="left" domain={[minDPR, maxDPR]} tickCount={8} tick={{ fontSize: 10 }} width={32} allowDecimals={true} allowDataOverflow={true}>
                                            <Label value="DPR" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fontSize: 11 }} />
                                        </YAxis>
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            domain={[1, 12]}
                                            reversed
                                            tick={{ fontSize: 10 }}
                                            width={32}
                                            allowDecimals={false}
                                            allowDataOverflow={true}
                                            ticks={[1,2,3,4,5,6,7,8,9,10,11,12]}
                                        >
                                            <Label value="Finish" angle={90} position="insideRight" style={{ textAnchor: 'middle', fontSize: 11 }} />
                                        </YAxis>
                                        <Tooltip 
                                            wrapperStyle={{ fontSize: 12 }} 
                                            formatter={(value, name, props) => {
                                                if (name === 'dpr' && typeof value === 'number') {
                                                    // Always round to 3 decimals, even if value is e.g. 1 or 0.9
                                                    return [Number(value).toFixed(3), 'DPR'];
                                                }
                                                if (name === 'finish' && typeof value === 'number') {
                                                    return [Math.round(value), 'Finish'];
                                                }
                                                return [value, name];
                                            }} 
                                        />
                                        <Legend verticalAlign="top" height={28} iconSize={14} wrapperStyle={{ fontSize: 12, paddingBottom: 2 }} />
                                        <Bar yAxisId="left" dataKey="dpr" name="DPR" fill="#2563eb" barSize={18} radius={[5, 5, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" dataKey="finish" name="Finish" stroke="#f59e42" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        );
                    })()
                ) : (
                    <p className="text-gray-600">No season-by-season data available for this team.</p>
                )}
            </section>

            {/* Game Records Only */}
            <section>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Game Records</h3>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                    {recordInvolvements.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Role</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-left">Record</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Rank</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-right">Value</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-left">Game</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Season</th>
                                        <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center">Week</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recordInvolvements
                                        .sort((a, b) => a.label.localeCompare(b.label) || a.rank - b.rank)
                                        .map((r, idx) => (
                                            <tr key={`${r.recordKey}-${r.year}-${r.week}-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center">{r.role}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800">{r.label}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center">#{r.rank}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-right">{formatScore(r.value)}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800">{r.teamsText}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center">{r.year}</td>
                                                <td className="py-2 px-3 text-sm text-gray-800 text-center">{r.week}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600 p-4">No record book involvements found for this team.</p>
                    )}
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ title, value, rank }) => (
    <div className="bg-blue-50 p-1.5 sm:p-2 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200 min-w-[90px]">
        {rank && rank !== 'N/A' && <p className="text-lg sm:text-2xl font-bold text-blue-700">{rank}</p>}
        <p className="text-xs sm:text-sm font-semibold text-gray-600">
            {title} (<span className="font-semibold text-gray-600">{value}</span>)
        </p>
    </div>
);

export default TeamDetailPage;
