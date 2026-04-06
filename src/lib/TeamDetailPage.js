import TeamDraftStats from '../components/TeamDraftStats';
// src/lib/TeamDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import logger from '../utils/logger';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateTeamFinancialTotalsByOwnerId, calculateTeamTransactionCountsByOwnerId, formatCurrency } from '../utils/financialCalculations';
import { formatScore } from '../utils/formatUtils';
import { useSleeperData } from '../contexts/SleeperDataContext';

import {
    ResponsiveContainer, ComposedChart, Bar, Line,
    XAxis, YAxis, Tooltip, Legend, CartesianGrid, Label
} from 'recharts';
import OverallDraftPositionChart from '../components/OverallDraftPositionChart';

// ── Helpers (untouched) ───────────────────────────────────────────────────────

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
            return (tieCount > 1 && value > 0) ? `T-${rank}${getOrdinalSuffix(rank)}` : `${rank}${getOrdinalSuffix(rank)}`;
        }
        rank += numericValues.filter(v => v === currentUniqueValue).length;
    }
    return 'N/A';
};

const formatPercentage = (value) =>
    typeof value === 'number' ? `${(value).toFixed(3).substring(1)}%` : 'N/A';
const formatLuckRating = (value) =>
    typeof value === 'number' ? formatScore(value, 3) : 'N/A';
const formatDPR = (value) =>
    typeof value === 'number' && !isNaN(value) ? formatScore(Number(value), 3) : 'N/A';

// ── Shared style tokens ───────────────────────────────────────────────────────
const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";
const th = "py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";
const thCenter = "py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";
const darkGrid = { stroke: 'rgba(255,255,255,0.05)' };
const darkTick = { fill: '#6b7280', fontSize: 10 };

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, rank }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center text-center min-w-[90px]">
        {rank && rank !== 'N/A' && (
            <p className="text-xl font-bold text-blue-400 leading-tight">{rank}</p>
        )}
        <p className="text-[10px] font-medium text-gray-500 mt-0.5 leading-tight">
            {title}
        </p>
        <p className="text-xs font-semibold text-gray-300 mt-0.5">{value}</p>
    </div>
);

// ── Award badge ───────────────────────────────────────────────────────────────
const AwardBadge = ({ icon, color, count, title: tip }) => (
    <span title={tip} className="flex items-center gap-1 whitespace-nowrap">
        <i className={`${icon} ${color} text-lg`}></i>
        <span className="text-xs font-semibold text-gray-400">{count}x</span>
    </span>
);

// ── Main component ────────────────────────────────────────────────────────────
const TeamDetailPage = ({ teamName }) => {
    const {
        loading: contextLoading,
        error: contextError,
        historicalData,
        allDraftHistory,
        nflState,
        getTeamName: getTeamNameFromContext,
        usersData
    } = useSleeperData();

    const [teamOverallStats, setTeamOverallStats] = useState(null);
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [selectedStartSeason, setSelectedStartSeason] = useState('');
    const [selectedEndSeason, setSelectedEndSeason] = useState('');
    const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
    const [lastFiveGames, setLastFiveGames] = useState([]);
    const [recordInvolvements, setRecordInvolvements] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [teamCareerRecords, setTeamCareerRecords] = useState({ career: [], playoff: [], streak: [], season: [] });
    const [activeTab, setActiveTab] = useState('game');
    const [financialDataByYear, setFinancialDataByYear] = useState({});
    const [loadingFinancial, setLoadingFinancial] = useState(true);

    // ── All logic (completely untouched) ─────────────────────────────────────
    const aggregateTeamCareerRecords = async (teamName, ownerId) => {
        const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameFromContext, nflState);
        const leagueRecords = [];
        if (careerDPRData && Array.isArray(careerDPRData)) {
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
                { key: 'pointsFor', label: 'Most Total Points', isMax: true, format: v => formatScore(v, 2) },
                { key: 'pointsAgainst', label: 'Most Points Against', isMax: true, format: v => formatScore(v, 2) },
                { key: 'totalLuckRating', label: 'Best Luck', isMax: true, format: v => formatScore(v, 3) },
            ];
            metrics.forEach(metric => {
                let bestValue = metric.isMax ? -Infinity : Infinity;
                let holders = [];
                careerDPRData.forEach(team => {
                    const value = team[metric.key];
                    if (typeof value !== 'number' || isNaN(value)) return;
                    if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) { bestValue = value; holders = [team.ownerId]; }
                    else if (value === bestValue) holders.push(team.ownerId);
                });
                if (holders.includes(ownerId)) {
                    const teamCareer = careerDPRData.find(t => t.ownerId === ownerId);
                    let value = teamCareer[metric.key];
                    if (metric.format) value = metric.format(value);
                    leagueRecords.push({ label: metric.label, value, details: '', year: '' });
                }
            });
        }
        const playoffStatsByOwner = {};
        Object.keys(historicalData.winnersBracketBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const matches = historicalData.winnersBracketBySeason[yearStr];
            matches.forEach(match => {
                const team1Id = String(match.team1_roster_id);
                const team2Id = String(match.team2_roster_id);
                const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1Id)?.owner_id;
                const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2Id)?.owner_id;
                [team1OwnerId, team2OwnerId].forEach(oid => { if (!oid) return; if (!playoffStatsByOwner[oid]) playoffStatsByOwner[oid] = { appearances: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, championships: 0, runnerUps: 0, thirdPlaces: 0 }; });
                if (team1OwnerId) playoffStatsByOwner[team1OwnerId].appearances++;
                if (team2OwnerId) playoffStatsByOwner[team2OwnerId].appearances++;
                const team1Score = Number(match.team1_score);
                const team2Score = Number(match.team2_score);
                if (!isNaN(team1Score) && !isNaN(team2Score)) {
                    if (team1Score > team2Score) { playoffStatsByOwner[team1OwnerId].wins++; playoffStatsByOwner[team2OwnerId].losses++; }
                    else if (team2Score > team1Score) { playoffStatsByOwner[team2OwnerId].wins++; playoffStatsByOwner[team1OwnerId].losses++; }
                    else if (team1Score === team2Score && team1Score > 0) { playoffStatsByOwner[team1OwnerId].ties++; playoffStatsByOwner[team2OwnerId].ties++; }
                    playoffStatsByOwner[team1OwnerId].pointsFor += team1Score; playoffStatsByOwner[team1OwnerId].pointsAgainst += team2Score;
                    playoffStatsByOwner[team2OwnerId].pointsFor += team2Score; playoffStatsByOwner[team2OwnerId].pointsAgainst += team1Score;
                }
                if (match.p === 1 && match.w) { if (match.w === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].championships++; if (match.w === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].championships++; }
                if (match.p === 1 && match.l) { if (match.l === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].runnerUps++; if (match.l === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].runnerUps++; }
                if (match.p === 3 && match.w) { if (match.w === 1 && team1OwnerId) playoffStatsByOwner[team1OwnerId].thirdPlaces++; if (match.w === 2 && team2OwnerId) playoffStatsByOwner[team2OwnerId].thirdPlaces++; }
            });
        });
        const playoffMetrics = [
            { key: 'appearances', label: 'Playoff Appearances', isMax: true },
            { key: 'wins', label: 'Playoff Wins', isMax: true },
            { key: 'losses', label: 'Playoff Losses', isMax: true },
            { key: 'pointsFor', label: 'Playoff Points For', isMax: true, format: v => formatScore(v, 2) },
            { key: 'pointsAgainst', label: 'Playoff Points Against', isMax: true, format: v => formatScore(v, 2) },
            { key: 'championships', label: 'Championships', isMax: true },
            { key: 'runnerUps', label: 'Runner-Ups', isMax: true },
            { key: 'thirdPlaces', label: 'Third Places', isMax: true },
        ];
        const playoffRecords = [];
        playoffMetrics.forEach(metric => {
            let bestValue = metric.isMax ? -Infinity : Infinity; let holders = [];
            Object.entries(playoffStatsByOwner).forEach(([oid, stats]) => { const value = stats[metric.key]; if (typeof value !== 'number' || isNaN(value)) return; if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) { bestValue = value; holders = [oid]; } else if (value === bestValue) holders.push(oid); });
            if (holders.includes(String(ownerId))) {
                let value = playoffStatsByOwner[ownerId][metric.key];
                if (metric.format) value = metric.format(value);
                if ((metric.key === 'pointsFor' || metric.key === 'pointsAgainst') && Number(value) === 0) return;
                if (metric.key === 'appearances') { const playoffSeasons = Object.keys(historicalData.winnersBracketBySeason || {}).length; value = Math.min(Number(value), playoffSeasons); }
                playoffRecords.push({ label: metric.label, value });
            }
        });
        const streaksByOwner = {};
        Object.keys(historicalData.matchupsBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonMatchups = historicalData.matchupsBySeason[yearStr];
            Object.values(historicalData.rostersBySeason?.[year] || {}).forEach(r => {
                const oid = r.owner_id; if (!oid) return;
                if (!streaksByOwner[oid]) streaksByOwner[oid] = { win: 0, loss: 0 };
                let currentWin = 0, currentLoss = 0;
                let games = seasonMatchups.filter(m => String(m.team1_roster_id) === String(r.roster_id) || String(m.team2_roster_id) === String(r.roster_id));
                games = games.sort((a, b) => parseInt(a.week) - parseInt(b.week));
                games.forEach(m => {
                    const isTeam1 = String(m.team1_roster_id) === String(r.roster_id);
                    const myScore = isTeam1 ? Number(m.team1_score) : Number(m.team2_score);
                    const oppScore = isTeam1 ? Number(m.team2_score) : Number(m.team1_score);
                    if (isNaN(myScore) || isNaN(oppScore)) return;
                    if (myScore > oppScore) { currentWin++; if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss; currentLoss = 0; }
                    else if (myScore < oppScore) { currentLoss++; if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin; currentWin = 0; }
                    else { if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin; if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss; currentWin = 0; currentLoss = 0; }
                });
                if (currentWin > streaksByOwner[oid].win) streaksByOwner[oid].win = currentWin;
                if (currentLoss > streaksByOwner[oid].loss) streaksByOwner[oid].loss = currentLoss;
            });
        });
        let maxWin = -Infinity, maxLoss = -Infinity, winHolders = [], lossHolders = [];
        Object.entries(streaksByOwner).forEach(([oid, s]) => { if (s.win > maxWin) { maxWin = s.win; winHolders = [oid]; } else if (s.win === maxWin) winHolders.push(oid); if (s.loss > maxLoss) { maxLoss = s.loss; lossHolders = [oid]; } else if (s.loss === maxLoss) lossHolders.push(oid); });
        const streakRecords = [];
        if (winHolders.includes(String(ownerId))) streakRecords.push({ label: 'Longest Win Streak', value: maxWin, details: '', year: '' });
        if (lossHolders.includes(String(ownerId))) streakRecords.push({ label: 'Longest Losing Streak', value: maxLoss, details: '', year: '' });
        const seasonRecords = [];
        const seasonMetrics = [
            { key: 'wins', label: 'Most Wins in a Season', isMax: true },
            { key: 'losses', label: 'Most Losses in a Season', isMax: true },
            { key: 'winPercentage', label: 'Best Win % in a Season', isMax: true, format: v => (v * 100).toFixed(3) + '%' },
            { key: 'pointsFor', label: 'Most Points For in a Season', isMax: true, format: v => formatScore(v, 2) },
            { key: 'luckRating', label: 'Best Luck Rating in a Season', isMax: true, format: v => formatScore(v, 3) },
            { key: 'adjustedDPR', label: 'Highest DPR in a Season', isMax: true, format: v => formatScore(v, 3) },
        ];
        seasonMetrics.forEach(metric => {
            let bestValue = metric.isMax ? -Infinity : Infinity; let holders = [];
            Object.keys(seasonalMetrics).forEach(yearStr => { const year = parseInt(yearStr); const teams = Object.values(seasonalMetrics[year]); teams.forEach(team => { const value = team[metric.key]; if (typeof value !== 'number' || isNaN(value)) return; if ((metric.isMax && value > bestValue) || (!metric.isMax && value < bestValue)) { bestValue = value; holders = [{ ownerId: team.ownerId, year }]; } else if (value === bestValue) holders.push({ ownerId: team.ownerId, year }); }); });
            holders.forEach(h => {
                if (h.ownerId === ownerId) {
                    let value = null;
                    Object.keys(seasonalMetrics).forEach(yearStr => { const year = parseInt(yearStr); if (year !== h.year) return; const team = Object.values(seasonalMetrics[year]).find(t => t.ownerId === ownerId); if (team) value = team[metric.key]; });
                    if (metric.format) value = metric.format(value);
                    seasonRecords.push({ label: metric.label, value, year: h.year, details: '' });
                }
            });
        });
        return { career: leagueRecords, playoff: playoffRecords, streak: streakRecords, season: seasonRecords };
    };

    const [sortBy, setSortBy] = useState('year');
    const [sortOrder, setSortOrder] = useState('desc');

    const resolveTeamName = (year, rosterId, ownerId) => {
        try {
            if (ownerId) { const name = getTeamNameFromContext(ownerId, year); if (name && !String(name).startsWith('Unknown Team')) return name; }
            const rosterList = historicalData?.rostersBySeason?.[year];
            const rosterObj = Array.isArray(rosterList) ? rosterList.find(r => String(r?.roster_id) === String(rosterId)) : null;
            const meta = rosterObj?.metadata || {};
            const fallbackName = meta.team_name || meta.nickname || rosterObj?.display_name || null;
            if (fallbackName) return fallbackName;
            return `Roster ${rosterId ?? '?'}`;
        } catch (e) { return `Roster ${rosterId ?? '?'}`; }
    };

    const isInvalidRosterId = (rid) => rid === null || rid === undefined || String(rid) === 'null' || String(rid) === 'undefined';

    useEffect(() => {
        const currentTeamName = String(teamName || '');
        if (contextLoading || contextError || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) { setLoadingStats(false); return; }
        if (typeof getTeamNameFromContext !== 'function') { logger.error("TeamDetailPage: getTeamNameFromContext is not a function."); setLoadingStats(false); return; }
        setLoadingStats(true);
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameFromContext, nflState);
        let currentTeamOwnerId = null;
        const teamCareerStats = calculatedCareerDPRs.find(dpr => getTeamNameFromContext(dpr.ownerId, null) === currentTeamName);
        if (teamCareerStats) currentTeamOwnerId = teamCareerStats.ownerId;
        if (!currentTeamOwnerId) { logger.warn(`TeamDetailPage: Could not find ownerId for teamName: ${currentTeamName}.`); setLoadingStats(false); setTeamOverallStats(null); setTeamSeasonHistory([]); return; }
        const overallStats = { totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGamesPlayed: 0, overallTopScoreWeeksCount: 0, playoffAppearancesCount: 0, avgDPR: 0, totalChampionships: 0, totalRunnerUps: 0, totalThirdPlaces: 0, totalPointsChampionships: 0, totalPointsRunnerUps: 0, totalThirdPlacePoints: 0, winRank: 'N/A', winPercentageRank: 'N/A', pointsForRank: 'N/A', topScoreWeeksRank: 'N/A', playoffRank: 'N/A', championshipRank: 'N/A', luckRank: 'N/A', ownerId: currentTeamOwnerId };
        const compiledSeasonHistory = [];
        const allTeamsAggregatedStats = {};
        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);
        const latestSeason = allYears.length > 0 ? Math.max(...allYears) : null;
        let isLatestSeasonPlayoffsComplete = false;
        if (latestSeason && historicalData.winnersBracketBySeason[latestSeason]) {
            const winnersBracketForLatestSeason = historicalData.winnersBracketBySeason[latestSeason];
            const championshipMatch = winnersBracketForLatestSeason.find(match => match.p === 1);
            if (championshipMatch && championshipMatch.w && championshipMatch.l) isLatestSeasonPlayoffsComplete = true;
        }
        logger.debug(`TeamDetailPage: Latest season is ${latestSeason}. Playoff completion status: ${isLatestSeasonPlayoffsComplete ? 'COMPLETE' : 'IN PROGRESS/INCOMPLETE'}`);
        Object.keys(seasonalMetrics).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonalStatsForYear = seasonalMetrics[year];
            if (seasonalStatsForYear) {
                Object.values(seasonalStatsForYear).forEach(teamSeasonalData => {
                    const ownerId = teamSeasonalData.ownerId;
                    const teamDisplayName = getTeamNameFromContext(ownerId, null);
                    if (!teamDisplayName || teamDisplayName.startsWith('Unknown Team (ID:')) return;
                    if (!allTeamsAggregatedStats[teamDisplayName]) allTeamsAggregatedStats[teamDisplayName] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGamesPlayed: 0, championships: 0, runnerUps: 0, thirdPlaces: 0, firstPoints: 0, secondPoints: 0, thirdPoints: 0, topScoreWeeksCount: 0, playoffAppearancesCount: 0, totalLuckRating: 0, ownerId };
                    const stats = allTeamsAggregatedStats[teamDisplayName];
                    stats.wins += teamSeasonalData.wins; stats.losses += teamSeasonalData.losses; stats.ties += teamSeasonalData.ties; stats.pointsFor += teamSeasonalData.pointsFor; stats.totalGamesPlayed += teamSeasonalData.totalGames;
                    const shouldCountForOverallStats = (year < latestSeason) || (year === latestSeason && isLatestSeasonPlayoffsComplete);
                    if (shouldCountForOverallStats) {
                        stats.topScoreWeeksCount += (teamSeasonalData.topScoreWeeksCount || 0);
                        stats.totalLuckRating += (teamSeasonalData.luckRating || 0);
                        if (typeof teamSeasonalData.rank === 'number' && teamSeasonalData.rank <= 6) stats.playoffAppearancesCount++;
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
        const currentTeamAggregatedStats = allTeamsAggregatedStats[currentTeamName];
        if (currentTeamAggregatedStats) {
            Object.assign(overallStats, { totalWins: currentTeamAggregatedStats.wins, totalLosses: currentTeamAggregatedStats.losses, totalTies: currentTeamAggregatedStats.ties, totalPointsFor: currentTeamAggregatedStats.pointsFor, totalGamesPlayed: currentTeamAggregatedStats.totalGamesPlayed, overallTopScoreWeeksCount: currentTeamAggregatedStats.topScoreWeeksCount, playoffAppearancesCount: currentTeamAggregatedStats.playoffAppearancesCount, avgDPR: teamCareerStats && typeof teamCareerStats.dpr === 'number' ? teamCareerStats.dpr : null, totalChampionships: currentTeamAggregatedStats.championships, totalRunnerUps: currentTeamAggregatedStats.runnerUps, totalThirdPlaces: currentTeamAggregatedStats.thirdPlaces, totalPointsChampionships: currentTeamAggregatedStats.firstPoints, totalPointsRunnerUps: currentTeamAggregatedStats.secondPoints, totalThirdPlacePoints: currentTeamAggregatedStats.thirdPoints, luckRating: currentTeamAggregatedStats.totalLuckRating });
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
            overallStats.luckRank = calculateRank(overallStats.luckRating, allLuckRatings, false);
        } else { setLoadingStats(false); setTeamOverallStats(null); setTeamSeasonHistory([]); return; }
        allYears.forEach(year => {
            const seasonalStatsForYear = seasonalMetrics[year];
            if (seasonalStatsForYear) {
                const teamSeasonalData = Object.values(seasonalStatsForYear).find(s => s.ownerId === currentTeamOwnerId);
                if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
                    const displayTeamNameForSeason = getTeamNameFromContext(currentTeamOwnerId, year);
                    compiledSeasonHistory.push({ year, team: displayTeamNameForSeason, wins: teamSeasonalData.wins, losses: teamSeasonalData.losses, ties: teamSeasonalData.ties, pointsFor: teamSeasonalData.pointsFor, pointsAgainst: teamSeasonalData.pointsAgainst, luckRating: teamSeasonalData.luckRating, adjustedDPR: typeof teamSeasonalData.adjustedDPR === 'number' ? teamSeasonalData.adjustedDPR : null, allPlayWinPercentage: teamSeasonalData.allPlayWinPercentage, winPercentage: teamSeasonalData.winPercentage, finish: (year === latestSeason && !isLatestSeasonPlayoffsComplete) ? 'N/A' : (teamSeasonalData.rank ? `${teamSeasonalData.rank}${getOrdinalSuffix(teamSeasonalData.rank)}` : 'N/A'), pointsFinish: (year === latestSeason && !isLatestSeasonPlayoffsComplete) ? 'N/A' : (teamSeasonalData.pointsRank ? `${teamSeasonalData.pointsRank}${getOrdinalSuffix(teamSeasonalData.pointsRank)}` : 'N/A') });
                }
            }
        });
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
                const team1Id = String(m.team1_roster_id); const team2Id = String(m.team2_roster_id);
                if (isInvalidRosterId(team1Id) || isInvalidRosterId(team2Id)) return;
                if (team1Id !== rosterId && team2Id !== rosterId) return;
                const week = parseInt(m.week); const team1Score = Number(m.team1_score); const team2Score = Number(m.team2_score);
                if (isNaN(team1Score) || isNaN(team2Score)) return;
                if (team1Score === 0 && team2Score === 0) return;
                if (currentSeason && currentWeek && (year > currentSeason || (year === currentSeason && week >= currentWeek))) return;
                const isTeam1 = team1Id === rosterId;
                const myScore = isTeam1 ? team1Score : team2Score; const oppScore = isTeam1 ? team2Score : team1Score;
                const oppRosterId = isTeam1 ? team2Id : team1Id;
                if (isInvalidRosterId(oppRosterId)) return;
                const oppOwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === String(oppRosterId))?.owner_id;
                const opponentName = resolveTeamName(year, oppRosterId, oppOwnerId);
                const result = myScore === oppScore ? 'T' : (myScore > oppScore ? 'W' : 'L');
                const margin = Math.abs(myScore - oppScore);
                games.push({ year, week, opponent: opponentName, myScore, oppScore, result, margin });
            });
        });
        games.sort((a, b) => (b.year - a.year) || (b.week - a.week));
        setLastFiveGames(games.slice(0, 5));
        const tempRecords = { mostPointsScored: [], mostPointsInLoss: [], fewestPointsScored: [], fewestPointsInWin: [], highestCombinedScore: [], lowestCombinedScore: [], biggestBlowout: [], slimmestWin: [] };
        const seasonMaxPlayedWeek = {};
        Object.keys(historicalData.matchupsBySeason || {}).forEach(yearKey => { const matchups = historicalData.matchupsBySeason[yearKey] || []; const playedWeeks = matchups.filter(mm => (Number(mm.team1_score) > 0 || Number(mm.team2_score) > 0)).map(mm => parseInt(mm.week)).filter(w => !isNaN(w)); seasonMaxPlayedWeek[parseInt(yearKey)] = playedWeeks.length > 0 ? Math.max(...playedWeeks) : 0; });
        const _currentSeason = parseInt(nflState?.season) || null; const _currentWeek = parseInt(nflState?.week) || null;
        if (_currentSeason && _currentWeek) { const clamped = Math.max(0, (_currentWeek - 1)); seasonMaxPlayedWeek[_currentSeason] = Math.min(seasonMaxPlayedWeek[_currentSeason] || 0, clamped); }
        Object.keys(historicalData.matchupsBySeason || {}).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonMatchups = historicalData.matchupsBySeason[yearStr];
            seasonMatchups.forEach(m => {
                const week = parseInt(m.week); const team1RosterId = String(m.team1_roster_id); const team2RosterId = String(m.team2_roster_id);
                if (isInvalidRosterId(team1RosterId) || isInvalidRosterId(team2RosterId)) return;
                const team1Score = Number(m.team1_score); const team2Score = Number(m.team2_score);
                if ([team1Score, team2Score, week, year].some(v => typeof v !== 'number' || isNaN(v))) return;
                if (team1Score === 0 && team2Score === 0) return;
                const maxPlayedWeek = seasonMaxPlayedWeek[year] || 0;
                if (week > maxPlayedWeek) return;
                const team1OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
                const team2OwnerId = historicalData.rostersBySeason?.[year]?.find(r => String(r.roster_id) === team2RosterId)?.owner_id;
                const team1Name = resolveTeamName(year, team1RosterId, team1OwnerId); const team2Name = resolveTeamName(year, team2RosterId, team2OwnerId);
                const combined = team1Score + team2Score; const isTie = team1Score === team2Score && team1Score > 0;
                const winner = isTie ? null : (team1Score > team2Score ? team1Name : team2Name);
                const loser = isTie ? null : (team1Score > team2Score ? team2Name : team1Name);
                const margin = Math.abs(team1Score - team2Score);
                tempRecords.mostPointsScored.push({ year, week, team: team1Name, score: team1Score, opponent: team2Name, ownerId: team1OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                tempRecords.mostPointsScored.push({ year, week, team: team2Name, score: team2Score, opponent: team1Name, ownerId: team2OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                if (team1Score > 0) tempRecords.fewestPointsScored.push({ year, week, team: team1Name, score: team1Score, opponent: team2Name, ownerId: team1OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                if (team2Score > 0) tempRecords.fewestPointsScored.push({ year, week, team: team2Name, score: team2Score, opponent: team1Name, ownerId: team2OwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                if (!isTie) {
                    const losingTeam = team1Score < team2Score ? team1Name : team2Name; const losingScore = Math.min(team1Score, team2Score); const losingOwnerId = team1Score < team2Score ? team1OwnerId : team2OwnerId; const winningTeam = team1Score > team2Score ? team1Name : team2Name;
                    tempRecords.mostPointsInLoss.push({ year, week, team: losingTeam, score: losingScore, opponent: winningTeam, ownerId: losingOwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                    const winningScore = Math.max(team1Score, team2Score); const winningOwnerId = team1Score > team2Score ? team1OwnerId : team2OwnerId; const losingOppTeam = team1Score < team2Score ? team1Name : team2Name;
                    tempRecords.fewestPointsInWin.push({ year, week, team: winningTeam, score: winningScore, opponent: losingOppTeam, ownerId: winningOwnerId, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                    tempRecords.biggestBlowout.push({ year, week, winner, loser, value: margin, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                    if (margin > 0) tempRecords.slimmestWin.push({ year, week, winner, loser, value: margin, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1: team1Name, team2: team2Name, team1Score, team2Score });
                }
                if (combined > 0 && team1Score > 0 && team2Score > 0) tempRecords.lowestCombinedScore.push({ year, week, team1: team1Name, team2: team2Name, value: combined, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1Score, team2Score });
                if (team1Score > 0 || team2Score > 0) tempRecords.highestCombinedScore.push({ year, week, team1: team1Name, team2: team2Name, value: combined, owner1Id: team1OwnerId, owner2Id: team2OwnerId, team1Score, team2Score });
            });
        });
        const recordLabels = { mostPointsScored: 'Most Points Scored by a Team', mostPointsInLoss: 'Most Points Scored in a Loss', fewestPointsScored: 'Fewest Points Scored by a Team', fewestPointsInWin: 'Fewest Points Scored in a Win', highestCombinedScore: 'Highest Combined Score', lowestCombinedScore: 'Lowest Combined Score', biggestBlowout: 'Biggest Blowout', slimmestWin: 'Slimmest Win' };
        const involvement = [];
        Object.keys(tempRecords).forEach(key => {
            const isMin = ['fewestPointsScored', 'fewestPointsInWin', 'lowestCombinedScore', 'slimmestWin'].includes(key);
            const list = tempRecords[key];
            if (!Array.isArray(list) || list.length === 0) return;
            const sortFn = (a, b) => isMin ? a.value - b.value : b.value - a.value;
            const top5 = list.map(item => ({ ...item, value: typeof item.value === 'number' ? item.value : (typeof item.score === 'number' ? item.score : Number.NEGATIVE_INFINITY) })).filter(item => typeof item.value === 'number' && !isNaN(item.value)).sort(sortFn).slice(0, 5);
            top5.forEach((item, idx) => {
                const isRecordHolder = item.ownerId && String(item.ownerId) === String(currentTeamOwnerId);
                const isTeam1 = item.owner1Id && String(item.owner1Id) === String(currentTeamOwnerId);
                const isTeam2 = item.owner2Id && String(item.owner2Id) === String(currentTeamOwnerId);
                const involved = isRecordHolder || isTeam1 || isTeam2;
                if (involved) {
                    const role = isRecordHolder ? 'Record Holder' : (isTeam1 || isTeam2 ? 'Opponent' : '');
                    const teamsText = item.team ? `${item.team} vs ${item.opponent}` : `${item.team1} vs ${item.team2}`;
                    let resolvedRecordOwnerId = item.ownerId || null;
                    if (!resolvedRecordOwnerId && item.winner) { if (item.winner === item.team1 && item.owner1Id) resolvedRecordOwnerId = item.owner1Id; else if (item.winner === item.team2 && item.owner2Id) resolvedRecordOwnerId = item.owner2Id; }
                    involvement.push({ recordKey: key, label: recordLabels[key], rank: idx + 1, value: item.value, year: item.year, week: item.week, teamsText, role, teamA: item.team || item.team1 || '', teamB: item.opponent || item.team2 || '', recordOwnerId: resolvedRecordOwnerId, owner1Id: item.owner1Id || null, owner2Id: item.owner2Id || null });
                }
            });
        });
        setTeamOverallStats(overallStats);
        setTeamSeasonHistory(compiledSeasonHistory);
        setRecordInvolvements(involvement);
        const seasons = compiledSeasonHistory.map(s => s.year).sort();
        setAvailableSeasons(seasons);
        if (!selectedStartSeason && seasons.length > 0) setSelectedStartSeason(seasons[0]);
        if (!selectedEndSeason && seasons.length > 0) setSelectedEndSeason(seasons[seasons.length - 1]);
        aggregateTeamCareerRecords(currentTeamName, currentTeamOwnerId).then(setTeamCareerRecords);
        setLoadingStats(false);
        logger.debug(`TeamDetailPage: Final teamOverallStats for ${currentTeamName}:`, overallStats);
    }, [teamName, historicalData, allDraftHistory, nflState, getTeamNameFromContext, contextLoading, contextError]);

    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!historicalData || !historicalData.matchupsBySeason) { logger.debug('No historical data available for financial fetch'); setLoadingFinancial(false); return; }
            logger.debug('Starting financial data fetch...');
            setLoadingFinancial(true);
            try {
                const allYears = Object.keys(historicalData.matchupsBySeason).map(String);
                logger.debug('Available years for financial data:', allYears);
                if (allYears.length === 0) { logger.debug('No years found in historical data'); setFinancialDataByYear({}); setLoadingFinancial(false); return; }
                logger.debug('Fetching financial data for years:', allYears);
                const financialData = await fetchFinancialDataForYears(allYears);
                logger.debug('Received financial data:', financialData);
                setFinancialDataByYear(financialData);
            } catch (error) { logger.error('Error fetching financial data:', error); setFinancialDataByYear({}); }
            finally { setLoadingFinancial(false); }
        };
        fetchFinancialData();
    }, [historicalData]);

    const getTeamFinancialDataForYear = (year, ownerId) => {
        if (!financialDataByYear[year] || !financialDataByYear[year].transactions || !ownerId) return { totalFees: 0, totalPayouts: 0, netTotal: 0, transactionCount: 0 };
        return calculateTeamFinancialTotalsByOwnerId(financialDataByYear[year].transactions, ownerId);
    };

    const getTeamTransactionCountsForYear = (year, ownerId) => {
        if (!financialDataByYear[year] || !financialDataByYear[year].transactions || !ownerId) return { tradeFees: 0, waiverFees: 0, totalTransactions: 0 };
        return calculateTeamTransactionCountsByOwnerId(financialDataByYear[year].transactions, ownerId);
    };

    const sortedSeasonHistory = useMemo(() => {
        const sortable = [...teamSeasonHistory];
        const parseRank = (r) => r === 'N/A' ? Infinity : parseInt(r.replace(/^T-/, '').match(/\d+/)?.[0] || '0');
        return sortable.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'record') { valA = (a.wins + 0.5 * a.ties) / (a.wins + a.losses + a.ties); valB = (b.wins + 0.5 * b.ties) / (b.wins + b.losses + b.ties); }
            else if (sortBy === 'finish' || sortBy === 'pointsFinish') { valA = parseRank(a[sortBy]); valB = parseRank(b[sortBy]); }
            else if (sortBy === 'tradeCount') { const cA = getTeamTransactionCountsForYear(a.year.toString(), teamOverallStats?.ownerId); const cB = getTeamTransactionCountsForYear(b.year.toString(), teamOverallStats?.ownerId); valA = cA.tradeFees; valB = cB.tradeFees; }
            else if (sortBy === 'waiverCount') { const cA = getTeamTransactionCountsForYear(a.year.toString(), teamOverallStats?.ownerId); const cB = getTeamTransactionCountsForYear(b.year.toString(), teamOverallStats?.ownerId); valA = cA.waiverFees; valB = cB.waiverFees; }
            else if (sortBy === 'netFinancial') { const fA = getTeamFinancialDataForYear(a.year.toString(), teamOverallStats?.ownerId); const fB = getTeamFinancialDataForYear(b.year.toString(), teamOverallStats?.ownerId); valA = fA.netTotal; valB = fB.netTotal; }
            else { valA = a[sortBy]; valB = b[sortBy]; }
            return (valA < valB ? -1 : valA > valB ? 1 : 0) * (sortOrder === 'asc' ? 1 : -1);
        });
    }, [teamSeasonHistory, sortBy, sortOrder, financialDataByYear, teamOverallStats?.ownerId]);

    const handleSort = (column) => { if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(column); setSortOrder('asc'); } };

    const getFilteredSeasonHistory = () => {
        if (!selectedStartSeason || !selectedEndSeason || !teamSeasonHistory.length) return teamSeasonHistory;
        const startYear = parseInt(selectedStartSeason), endYear = parseInt(selectedEndSeason);
        return teamSeasonHistory.filter(season => { const year = parseInt(season.year); return year >= startYear && year <= endYear; });
    };

    const getXAxisInterval = (dataLength) => {
        if (dataLength <= 5) return 0;
        if (dataLength <= 10) return 1;
        if (dataLength <= 15) return 2;
        return Math.floor(dataLength / 8);
    };

    // ── Loading / error ───────────────────────────────────────────────────────
    if (loadingStats) {
        return (
            <div className="w-full py-12 text-center text-gray-500 text-sm animate-pulse">
                Loading {teamName}'s historical data…
            </div>
        );
    }

    if (!teamOverallStats) {
        return (
            <div className="w-full py-12 text-center text-red-400 text-sm">
                No data found for {teamName}.
            </div>
        );
    }

    // ── Sort indicator ────────────────────────────────────────────────────────
    const SortIcon = ({ col }) => sortBy === col ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full space-y-5 mt-2">

            {/* ── Team Header ── */}
            <div className={`${card} p-5 text-center`}>
                <h2 className="text-2xl font-bold text-white tracking-tight">{teamName}</h2>
                <p className="text-sm text-gray-500 mt-1">
                    {teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies} · Career DPR: <span className="text-blue-400 font-semibold">{formatDPR(teamOverallStats.avgDPR)}</span>
                </p>
                {/* Awards row */}
                <div className="flex flex-wrap justify-center items-center gap-3 mt-3">
                    {teamOverallStats.totalChampionships > 0 && <AwardBadge icon="fas fa-trophy" color="text-yellow-400" count={teamOverallStats.totalChampionships} title={`Champion (${teamOverallStats.totalChampionships}x)`} />}
                    {teamOverallStats.totalRunnerUps > 0 && <AwardBadge icon="fas fa-trophy" color="text-gray-400" count={teamOverallStats.totalRunnerUps} title={`Runner-Up (${teamOverallStats.totalRunnerUps}x)`} />}
                    {teamOverallStats.totalThirdPlaces > 0 && <AwardBadge icon="fas fa-trophy" color="text-amber-700" count={teamOverallStats.totalThirdPlaces} title={`3rd Place (${teamOverallStats.totalThirdPlaces}x)`} />}
                    {teamOverallStats.totalPointsChampionships > 0 && <AwardBadge icon="fas fa-medal" color="text-yellow-400" count={teamOverallStats.totalPointsChampionships} title={`Points Champ (${teamOverallStats.totalPointsChampionships}x)`} />}
                    {teamOverallStats.totalPointsRunnerUps > 0 && <AwardBadge icon="fas fa-medal" color="text-gray-400" count={teamOverallStats.totalPointsRunnerUps} title={`Points 2nd (${teamOverallStats.totalPointsRunnerUps}x)`} />}
                    {teamOverallStats.totalThirdPlacePoints > 0 && <AwardBadge icon="fas fa-medal" color="text-amber-700" count={teamOverallStats.totalThirdPlacePoints} title={`Points 3rd (${teamOverallStats.totalThirdPlacePoints}x)`} />}
                </div>
            </div>

            {/* ── League Ranks ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">League Ranks</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <StatCard title="Total Wins" value={teamOverallStats.totalWins} rank={teamOverallStats.winRank} />
                    <StatCard title="Win %" value={formatPercentage((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed)} rank={teamOverallStats.winPercentageRank} />
                    <StatCard title="Total Points" value={formatScore(teamOverallStats.totalPointsFor)} rank={teamOverallStats.pointsForRank} />
                    <StatCard title="Weekly Top Scores" value={teamOverallStats.overallTopScoreWeeksCount !== undefined ? `${teamOverallStats.overallTopScoreWeeksCount}` : 'N/A'} rank={teamOverallStats.topScoreWeeksRank} />
                    <StatCard title="Playoff Apps" value={teamOverallStats.playoffAppearancesCount} rank={teamOverallStats.playoffRank} />
                    <StatCard title="Championships" value={teamOverallStats.totalChampionships} rank={teamOverallStats.championshipRank} />
                </div>
            </div>

            {/* ── Season History Table ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Season History</span>
                </div>
                {teamSeasonHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {[
                                        ['year','Year'], ['record','Record'], ['pointsFor','Pts For'],
                                        ['pointsAgainst','Pts Against'], ['luckRating','Luck'],
                                        ['finish','Finish'], ['pointsFinish','Pts Finish'],
                                        ['adjustedDPR','DPR'], ['allPlayWinPercentage','All-Play W%'],
                                        ['tradeCount','Trades'], ['waiverCount','Waivers'], ['netFinancial','Net $'],
                                    ].map(([col, label]) => (
                                        <th key={col} className="py-2.5 px-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors whitespace-nowrap" onClick={() => handleSort(col)}>
                                            {label}<SortIcon col={col} />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sortedSeasonHistory.map((season, index) => {
                                    const financialData = getTeamFinancialDataForYear(season.year.toString(), teamOverallStats?.ownerId);
                                    const transactionCounts = getTeamTransactionCountsForYear(season.year.toString(), teamOverallStats?.ownerId);
                                    return (
                                        <tr key={season.year} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2 px-2 text-center text-gray-300 tabular-nums font-medium">{season.year}</td>
                                            <td className="py-2 px-2 text-center text-gray-300 tabular-nums">{season.ties > 0 ? `${season.wins}-${season.losses}-${season.ties}` : `${season.wins}-${season.losses}`}</td>
                                            <td className="py-2 px-2 text-center text-emerald-400 tabular-nums">{formatScore(season.pointsFor)}</td>
                                            <td className="py-2 px-2 text-center text-red-400 tabular-nums">{formatScore(season.pointsAgainst)}</td>
                                            <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{formatLuckRating(season.luckRating)}</td>
                                            <td className="py-2 px-2 text-center text-gray-300">{season.finish}</td>
                                            <td className="py-2 px-2 text-center text-gray-300">{season.pointsFinish}</td>
                                            <td className="py-2 px-2 text-center text-blue-400 tabular-nums">{formatDPR(season.adjustedDPR)}</td>
                                            <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{formatPercentage(season.allPlayWinPercentage)}</td>
                                            <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{loadingFinancial ? '…' : transactionCounts.tradeFees}</td>
                                            <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{loadingFinancial ? '…' : transactionCounts.waiverFees}</td>
                                            <td className={`py-2 px-2 text-center font-semibold tabular-nums ${loadingFinancial ? 'text-gray-600' : financialData.netTotal > 0 ? 'text-emerald-400' : financialData.netTotal < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                {loadingFinancial ? '…' : formatCurrency(financialData.netTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm p-4">No season-by-season data available for {teamName}.</p>
                )}
            </div>

            {/* ── Previous 5 Games ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Previous 5 Games</span>
                </div>
                {lastFiveGames.length > 0 ? (
                    <>
                        {/* Mobile */}
                        <div className="sm:hidden divide-y divide-white/5">
                            {lastFiveGames.map((g, idx) => (
                                <div key={`${g.year}-${g.week}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] text-gray-600">{g.year} · W{g.week}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.result === 'W' ? 'bg-emerald-900/40 text-emerald-400' : g.result === 'L' ? 'bg-red-900/40 text-red-400' : 'bg-white/5 text-gray-400'}`}>{g.result}</span>
                                        </div>
                                        <div className="text-sm font-medium text-gray-200 truncate">{g.opponent}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-semibold text-gray-200 tabular-nums">{formatScore(g.myScore)} <span className="text-gray-600 text-xs">vs</span> {formatScore(g.oppScore)}</div>
                                        <div className="text-[10px] text-gray-600">margin: {formatScore(g.margin)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className={thCenter}>Season</th>
                                        <th className={th}>Opponent</th>
                                        <th className={thCenter}>Result</th>
                                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10">Team</th>
                                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10">Opponent</th>
                                        <th className={thCenter}>Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {lastFiveGames.map((g, idx) => (
                                        <tr key={`${g.year}-${g.week}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums text-xs">{g.year} · W{g.week}</td>
                                            <td className="py-2.5 px-3 text-gray-200 text-sm">{g.opponent}</td>
                                            <td className={`py-2.5 px-3 text-center text-sm font-bold ${g.result === 'W' ? 'text-emerald-400' : g.result === 'L' ? 'text-red-400' : 'text-gray-500'}`}>{g.result}</td>
                                            <td className="py-2.5 px-3 text-right text-gray-200 tabular-nums text-sm">{formatScore(g.myScore)}</td>
                                            <td className="py-2.5 px-3 text-right text-gray-400 tabular-nums text-sm">{formatScore(g.oppScore)}</td>
                                            <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums text-sm">{formatScore(g.margin)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 text-sm p-4">No recent games available.</p>
                )}
            </div>

            {/* ── Chart Controls ── */}
            {teamSeasonHistory.length > 5 && (
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Chart Display Options</span>
                    </div>
                    <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400">Show seasons:</span>
                            <select value={selectedStartSeason} onChange={e => setSelectedStartSeason(e.target.value)} className="px-2 py-1 bg-gray-700 border border-white/10 rounded-lg text-xs text-gray-200 focus:ring-1 focus:ring-blue-500">
                                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="text-gray-600 text-xs">to</span>
                            <select value={selectedEndSeason} onChange={e => setSelectedEndSeason(e.target.value)} className="px-2 py-1 bg-gray-700 border border-white/10 rounded-lg text-xs text-gray-200 focus:ring-1 focus:ring-blue-500">
                                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { if (availableSeasons.length > 0) { const r = availableSeasons.slice(-5); setSelectedStartSeason(r[0]); setSelectedEndSeason(r[r.length - 1]); } }} className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs hover:bg-blue-500/30 transition-colors">Last 5</button>
                            <button onClick={() => { if (availableSeasons.length > 0) { setSelectedStartSeason(availableSeasons[0]); setSelectedEndSeason(availableSeasons[availableSeasons.length - 1]); } }} className="px-3 py-1.5 bg-white/8 text-gray-300 border border-white/10 rounded-lg text-xs hover:bg-white/12 transition-colors">All</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DPR & Finish Chart ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">DPR &amp; Finish by Season</span>
                </div>
                <div className="p-4">
                    {teamSeasonHistory.length > 0 ? (() => {
                        const filteredHistory = getFilteredSeasonHistory();
                        const dprVals = filteredHistory.map(s => typeof s.adjustedDPR === 'number' ? Number(s.adjustedDPR) : null).filter(v => typeof v === 'number' && !isNaN(v));
                        let minDPR = Math.min(...dprVals), maxDPR = Math.max(...dprVals);
                        if (!isFinite(minDPR) || !isFinite(maxDPR)) { minDPR = 0.6; maxDPR = 1.3; }
                        else { const pad = Math.max(0.03, (maxDPR - minDPR) * 0.12); minDPR = Math.max(0.5, Math.floor((minDPR - pad) * 1000) / 1000); maxDPR = Math.min(1.5, Math.ceil((maxDPR + pad) * 1000) / 1000); }
                        const finishTicksMobile = [1, 6, 12], finishTicksDesktop = [1,2,3,4,5,6,7,8,9,10,11,12];
                        const chartData = filteredHistory.map(s => ({ season: s.year, dpr: typeof s.adjustedDPR === 'number' ? Number(s.adjustedDPR) : null, finish: typeof s.finish === 'string' && s.finish !== 'N/A' ? parseInt(s.finish.replace(/^T-/, '').match(/\d+/)?.[0] || '0') : null }));
                        const tooltipStyle = { backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 11 };
                        const tooltipFormatter = (value, name) => { if (name === 'dpr' && typeof value === 'number') return [Number(value).toFixed(3), 'DPR']; if (name === 'finish' && typeof value === 'number') return [Math.round(value), 'Finish']; return [value, name]; };
                        return (
                            <>
                                {/* Mobile */}
                                <div className="sm:hidden" style={{ height: 280 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 5, bottom: 25 }}>
                                            <CartesianGrid {...darkGrid} vertical={false} />
                                            <XAxis dataKey="season" tick={darkTick} interval={getXAxisInterval(filteredHistory.length)} angle={-45} textAnchor="end" height={40} />
                                            <YAxis yAxisId="left" orientation="left" domain={[minDPR, maxDPR]} tickCount={6} tick={darkTick} width={44} allowDecimals allowDataOverflow><Label value="DPR" angle={-90} position="left" dx={-8} style={{ textAnchor: 'middle', fontSize: 9, fill: '#6b7280' }} /></YAxis>
                                            <YAxis yAxisId="right" orientation="right" domain={[1, 12]} reversed tick={darkTick} width={25} allowDecimals={false} allowDataOverflow ticks={finishTicksMobile} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
                                            <Legend verticalAlign="top" height={20} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                                            <Bar yAxisId="left" dataKey="dpr" name="DPR" fill="#3b82f6" barSize={12} radius={[3,3,0,0]} />
                                            <Line yAxisId="right" type="monotone" dataKey="finish" name="Finish" stroke="#f59e42" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Desktop */}
                                <div className="hidden sm:block" style={{ height: 340 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                            <CartesianGrid {...darkGrid} vertical={false} />
                                            <XAxis dataKey="season" tick={darkTick} padding={{ left: 8, right: 8 }}><Label value="Season" offset={-6} position="insideBottom" style={{ fontSize: 11, fill: '#6b7280' }} /></XAxis>
                                            <YAxis yAxisId="left" orientation="left" domain={[minDPR, maxDPR]} tickCount={8} tick={darkTick} width={48} allowDecimals allowDataOverflow><Label value="DPR" angle={-90} position="left" dx={-10} style={{ textAnchor: 'middle', fontSize: 11, fill: '#6b7280' }} /></YAxis>
                                            <YAxis yAxisId="right" orientation="right" domain={[1, 12]} reversed tick={darkTick} width={32} allowDecimals={false} allowDataOverflow ticks={finishTicksDesktop} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
                                            <Legend verticalAlign="top" height={28} iconSize={14} wrapperStyle={{ fontSize: 12 }} />
                                            <Bar yAxisId="left" dataKey="dpr" name="DPR" fill="#3b82f6" barSize={18} radius={[5,5,0,0]} />
                                            <Line yAxisId="right" type="monotone" dataKey="finish" name="Finish" stroke="#f59e42" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        );
                    })() : <p className="text-gray-500 text-sm">No season-by-season data available.</p>}
                </div>
            </div>

            {/* ── Game Records ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Game Records</span>
                </div>
                {recordInvolvements.length > 0 ? (
                    <>
                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-white/5">
                            {recordInvolvements.sort((a, b) => a.label.localeCompare(b.label) || a.rank - b.rank).map((r, idx) => {
                                const ownerAId = r.owner1Id || null, ownerBId = r.owner2Id || null;
                                const recordOwnerId = r.recordOwnerId || null;
                                const ownerAMatches = recordOwnerId && ownerAId && recordOwnerId === ownerAId;
                                const ownerBMatches = recordOwnerId && ownerBId && recordOwnerId === ownerBId;
                                const teamAName = typeof r.teamA === 'string' ? r.teamA : (r.teamA?.displayName || r.teamA?.name || '');
                                const teamBName = typeof r.teamB === 'string' ? r.teamB : (r.teamB?.displayName || r.teamB?.name || '');
                                return (
                                    <div key={`${r.recordKey}-${r.year}-${r.week}-${idx}`} className="px-4 py-3 flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-gray-200 leading-tight">{r.label}</div>
                                            <div className="text-[10px] text-gray-600 mt-0.5">{r.role}</div>
                                            <div className="mt-1.5 text-xs">
                                                <div className={`truncate ${ownerAMatches ? 'text-white font-semibold' : 'text-gray-400'}`}>{teamAName || r.teamsText}</div>
                                                <div className={`truncate ${ownerBMatches ? 'text-white font-semibold' : 'text-gray-500'}`}>{teamBName}</div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                                            <span className="text-[10px] font-bold text-blue-400 bg-blue-900/30 border border-blue-500/25 px-1.5 py-0.5 rounded">#{r.rank}</span>
                                            <div className="text-base font-bold text-white tabular-nums">{formatScore(r.value)}</div>
                                            <div className="text-[10px] text-gray-600">{r.year} · W{r.week}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className={thCenter}>Role</th>
                                        <th className={th}>Record</th>
                                        <th className={thCenter}>Rank</th>
                                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10">Value</th>
                                        <th className={th}>Game</th>
                                        <th className={thCenter}>Season</th>
                                        <th className={thCenter}>Week</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recordInvolvements.sort((a, b) => a.label.localeCompare(b.label) || a.rank - b.rank).map((r, idx) => (
                                        <tr key={`${r.recordKey}-${r.year}-${r.week}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 px-3 text-center text-xs text-gray-400">{r.role}</td>
                                            <td className="py-2.5 px-3 text-xs text-gray-200">{r.label}</td>
                                            <td className="py-2.5 px-3 text-center text-xs text-blue-400 font-semibold">#{r.rank}</td>
                                            <td className="py-2.5 px-3 text-right text-xs text-white font-semibold tabular-nums">{formatScore(r.value)}</td>
                                            <td className="py-2.5 px-3 text-xs text-gray-400">{r.teamsText}</td>
                                            <td className="py-2.5 px-3 text-center text-xs text-gray-500 tabular-nums">{r.year}</td>
                                            <td className="py-2.5 px-3 text-center text-xs text-gray-500 tabular-nums">{r.week}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 text-sm p-4">No record book involvements found for this team.</p>
                )}
            </div>

            {/* ── Draft Stats ── */}
            <div className={card}>
                <div className={cardHeader}>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Draft Habits</span>
                </div>
                <div className="p-4">
                    <TeamDraftStats ownerId={teamOverallStats.ownerId} allDraftHistory={allDraftHistory} totalRounds={12} totalTeams={12} />
                </div>
            </div>

        </div>
    );
};

export default TeamDetailPage;