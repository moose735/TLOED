// src/lib/LeagueHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { fetchTransactionsForWeek } from '../utils/sleeperApi';

import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateAllTeamFinancialTotals, calculateTeamFinancialTotalsByOwnerId, formatCurrency } from '../utils/financialCalculations';
import { calculatePlayoffFinishes } from '../utils/playoffRankings';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Cell, Area, AreaChart } from 'recharts';

// ── Helpers (untouched) ───────────────────────────────────────────────────────

const getOrdinalSuffix = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return (s[v - 20] || s[v] || s[0]);
};

const getFinalSeedingGamePurpose = (value) => {
    if (value === 1) return 'Championship Game';
    if (value === 3) return '3rd Place Game';
    if (value === 5) return '5th Place Game';
    if (value === 7) return '7th Place Game';
    if (value === 9) return '9th Place Game';
    if (value === 11) return '11th Place Game';
    if (typeof value === 'number' && value > 0 && value % 2 !== 0) return `${value}${getOrdinalSuffix(value)} Place Game`;
    return 'Final Seeding Game';
};

// ── Shared style tokens ───────────────────────────────────────────────────────
const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardPad = "p-4 sm:p-5";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";
const sectionTitle = "text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 pb-2 border-b border-white/10";
const th = "py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider";
const thCenter = "py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider";

// ── Award icon helper ─────────────────────────────────────────────────────────
const AwardBadge = ({ icon, color, count, years, title }) => (
    <span title={title} className="flex items-center gap-1 whitespace-nowrap">
        <i className={`${icon} ${color}`}></i>
        <span className="text-[10px] font-semibold text-gray-400">{count}x</span>
    </span>
);

const LeagueHistory = () => {
    const {
        loading: contextLoading,
        error: contextError,
        historicalData,
        allDraftHistory,
        nflState,
        getTeamName: getDisplayTeamNameFromContext,
        usersData,
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
    const [tradePairCounts, setTradePairCounts] = useState([]);
    const [teamTransactionTotals, setTeamTransactionTotals] = useState([]);
    const [allTimeFinancials, setAllTimeFinancials] = useState([]);
    const [draftPickTrades, setDraftPickTrades] = useState({});
    const [selectedTeamTrades, setSelectedTeamTrades] = useState(null);
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedStartYear, setSelectedStartYear] = useState('');
    const [selectedEndYear, setSelectedEndYear] = useState('');
    const leagueTxCache = React.useRef(new Map());

    const teamColors = [
        '#8884d8', '#82ca9d', '#ffc658', '#f5222d', '#fa8c16', '#a0d911', '#52c41a', '#1890ff',
        '#2f54eb', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#eb2f96', '#fadb14', '#52c41a'
    ];

    // ── Custom chart tooltips ─────────────────────────────────────────────────
    const AverageScoreTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload;
            return (
                <div className="bg-gray-900 border border-white/15 rounded-xl p-3 shadow-2xl text-xs">
                    <p className="font-semibold text-white mb-1.5">Season {label}</p>
                    <p className="text-emerald-400">Highest: {data.highest.toFixed(1)} ({data.highestTeam})</p>
                    <p className="text-blue-400">Average: {data.average.toFixed(1)}</p>
                    <p className="text-red-400">Lowest: {data.lowest.toFixed(1)} ({data.lowestTeam})</p>
                    <p className="text-gray-500">Range: {data.range.toFixed(1)} pts</p>
                </div>
            );
        }
        return null;
    };

    // ── All data logic (completely untouched) ─────────────────────────────────
    useEffect(() => {
        const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getDisplayTeamNameFromContext, nflState);
        logger.debug("LeagueHistory: calculatedCareerDPRs after initial calculation:", calculatedCareerDPRs);
        const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);
        const teamOverallStats = {};
        calculatedCareerDPRs.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            const teamName = getDisplayTeamNameFromContext(ownerId, null);
            if (!teamName || teamName.startsWith('Unknown Team (ID:')) { logger.warn(`LeagueHistory: Skipping career stats for ownerId ${ownerId} due to unresolved team name.`); return; }
            teamOverallStats[teamName] = {
                totalWins: careerStats.wins, totalLosses: careerStats.losses, totalTies: careerStats.ties,
                totalPointsFor: careerStats.pointsFor, totalGames: careerStats.totalGames, careerDPR: careerStats.dpr,
                seasonsPlayed: new Set(),
                awards: { championships: careerStats.championships || 0, runnerUps: careerStats.runnerUps || 0, thirdPlace: careerStats.thirdPlaces || 0, firstPoints: careerStats.pointsChampionships || 0, secondPoints: careerStats.pointsRunnerUps || 0, thirdPoints: careerStats.thirdPlacePoints || 0 },
                ownerId: ownerId
            };
        });
        if (teamTransactionTotals && teamTransactionTotals.length > 0) { try { window.localStorage.setItem('teamTransactionTotals', JSON.stringify(teamTransactionTotals)); } catch (e) {} }
        logger.debug("LeagueHistory: teamOverallStats after population:", teamOverallStats);
        Object.keys(historicalData.rostersBySeason).forEach(year => {
            const rostersForYear = historicalData.rostersBySeason[year];
            if (rostersForYear) { rostersForYear.forEach(roster => { const ownerId = roster.owner_id; const teamName = getDisplayTeamNameFromContext(ownerId, null); if (teamOverallStats[teamName]) teamOverallStats[teamName].seasonsPlayed.add(parseInt(year)); }); }
        });
        const newSeasonAwardsSummary = {};
        allYears.forEach(year => {
            const seasonalStatsForYear = seasonalMetrics[year];
            newSeasonAwardsSummary[year] = { champion: 'N/A', secondPlace: 'N/A', thirdPlace: 'N/A', pointsChamp: 'N/A', pointsSecond: 'N/A', pointsThird: 'N/A' };
            if (seasonalStatsForYear) {
                Object.values(seasonalStatsForYear).forEach(teamSeasonalData => {
                    if (teamSeasonalData.isChampion) newSeasonAwardsSummary[year].champion = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                    if (teamSeasonalData.isRunnerUp) newSeasonAwardsSummary[year].secondPlace = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                    if (teamSeasonalData.isThirdPlace) newSeasonAwardsSummary[year].thirdPlace = getDisplayTeamNameFromContext(teamSeasonalData.ownerId, year);
                });
                const yearPointsData = Object.values(seasonalStatsForYear).map(ts => ({ ownerId: ts.ownerId, points: ts.pointsFor, isPointsChampion: ts.isPointsChampion, isPointsRunnerUp: ts.isPointsRunnerUp, isThirdPlacePoints: ts.isThirdPlacePoints }));
                yearPointsData.forEach(tp => {
                    if (tp.isPointsChampion) newSeasonAwardsSummary[year].pointsChamp = getDisplayTeamNameFromContext(tp.ownerId, year);
                    if (tp.isPointsRunnerUp) newSeasonAwardsSummary[year].pointsSecond = getDisplayTeamNameFromContext(tp.ownerId, year);
                    if (tp.isThirdPlacePoints) newSeasonAwardsSummary[year].pointsThird = getDisplayTeamNameFromContext(tp.ownerId, year);
                });
            } else { logger.warn(`LeagueHistory: No seasonal metrics found for year ${year}.`); }
            const cys = newSeasonAwardsSummary[year];
            if (cys.champion === 'N/A' && cys.secondPlace === 'N/A' && cys.thirdPlace === 'N/A' && cys.pointsChamp === 'N/A' && cys.pointsSecond === 'N/A' && cys.pointsThird === 'N/A') delete newSeasonAwardsSummary[year];
        });
        logger.debug("LeagueHistory: newSeasonAwardsSummary after processing:", newSeasonAwardsSummary);
        const ownerToRosterIds = {};
        const rosterIdToYear = {};
        Object.keys(historicalData.rostersBySeason).forEach(year => {
            (historicalData.rostersBySeason[year] || []).forEach(r => {
                const owner = String(r.owner_id); const rosterId = String(r.roster_id);
                if (!ownerToRosterIds[owner]) ownerToRosterIds[owner] = new Set();
                ownerToRosterIds[owner].add(rosterId); rosterIdToYear[rosterId] = String(year);
            });
        });
        const compiledStandings = Object.keys(teamOverallStats).map(teamName => {
            const stats = teamOverallStats[teamName];
            if (stats.seasonsPlayed.size === 0) return null;
            const totalGames = stats.totalWins + stats.totalLosses + stats.totalTies;
            const winPercentage = totalGames > 0 ? ((stats.totalWins + (0.5 * stats.totalTies)) / totalGames) : 0;
            const sortedYearsArrayForDisplay = Array.from(stats.seasonsPlayed).sort((a, b) => a - b);
            const minYear = sortedYearsArrayForDisplay.length > 0 ? sortedYearsArrayForDisplay[0] : '';
            const maxYear = sortedYearsArrayForDisplay.length > 0 ? sortedYearsArrayForDisplay[sortedYearsArrayForDisplay.length - 1] : '';
            const seasonsCount = stats.seasonsPlayed.size;
            let seasonsDisplay = (<>{seasonsCount > 0 ? (minYear === maxYear ? (<>{minYear} <span className="text-xs text-gray-500">({seasonsCount})</span></>) : (<>{minYear}-{maxYear} <span className="text-xs text-gray-500">({seasonsCount})</span></>)) : ''}</>);
            const careerStatsForTeam = calculatedCareerDPRs.find(cs => cs.ownerId === stats.ownerId);
            const getAwardYears = (flag) => { const years = []; Object.entries(seasonalMetrics).forEach(([year, teams]) => { const found = Object.values(teams).find(t => t.ownerId === stats.ownerId && t[flag]); if (found) years.push(year); }); return years; };
            const awardsToDisplay = careerStatsForTeam ? {
                championships: careerStatsForTeam.championships || 0, championshipsYears: getAwardYears('isChampion'),
                runnerUps: careerStatsForTeam.runnerUps || 0, runnerUpsYears: getAwardYears('isRunnerUp'),
                thirdPlace: careerStatsForTeam.thirdPlaces || 0, thirdPlaceYears: getAwardYears('isThirdPlace'),
                firstPoints: careerStatsForTeam.pointsChampionships || 0, firstPointsYears: getAwardYears('isPointsChampion'),
                secondPoints: careerStatsForTeam.pointsRunnerUps || 0, secondPointsYears: getAwardYears('isPointsRunnerUp'),
                thirdPoints: careerStatsForTeam.thirdPlacePoints || 0, thirdPointsYears: getAwardYears('isThirdPlacePoints'),
            } : { championships: 0, championshipsYears: [], runnerUps: 0, runnerUpsYears: [], thirdPlace: 0, thirdPlaceYears: [], firstPoints: 0, firstPointsYears: [], secondPoints: 0, secondPointsYears: [], thirdPoints: 0, thirdPointsYears: [] };
            return { team: teamName, seasons: seasonsDisplay, totalDPR: stats.careerDPR, record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`, totalWins: stats.totalWins, winPercentage, awards: awardsToDisplay, ownerId: stats.ownerId };
        }).filter(Boolean).sort((a, b) => b.winPercentage - a.winPercentage);
        setAllTimeStandings(compiledStandings);
        const chartData = [];
        const allYearsForChart = Object.keys(historicalData.matchupsBySeason).map(Number).filter(y => !isNaN(y)).sort((a, b) => a - b);
        const uniqueOwnerIdsForChart = Array.from(new Set(calculatedCareerDPRs.map(dpr => dpr.ownerId)));
        const uniqueTeamsForChartDisplayNames = uniqueOwnerIdsForChart.map(ownerId => getDisplayTeamNameFromContext(ownerId, null)).sort();
        setUniqueTeamsForChart(uniqueTeamsForChartDisplayNames);
        allYearsForChart.forEach(currentYear => {
            const tempHistoricalDataForYear = { matchupsBySeason: {}, rostersBySeason: {}, leaguesMetadataBySeason: {}, winnersBracketBySeason: {}, losersBracketBySeason: {}, usersBySeason: {} };
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
            const { careerDPRData: cumulativeCareerDPRDataForYear } = calculateAllLeagueMetrics(tempHistoricalDataForYear, allDraftHistory, getDisplayTeamNameFromContext, nflState);
            const dprList = uniqueOwnerIdsForChart.map(ownerId => { const dpr = cumulativeCareerDPRDataForYear.find(dpr => dpr.ownerId === ownerId)?.dpr; return { ownerId, dpr: dpr !== undefined ? dpr : -9999, teamName: getDisplayTeamNameFromContext(ownerId, null) }; });
            dprList.sort((a, b) => b.dpr - a.dpr);
            dprList.forEach((item, idx) => { item.rank = idx + 1; });
            const yearDataPoint = { year: currentYear };
            dprList.forEach(item => { yearDataPoint[item.teamName] = item.rank; });
            chartData.push(yearDataPoint);
        });
        setSeasonalDPRChartData(chartData);
        const averageScoresData = [];
        logger.debug('LeagueHistory: Starting average score calculation for years:', allYears);
        logger.debug('LeagueHistory: historicalData.matchupsBySeason keys:', Object.keys(historicalData.matchupsBySeason || {}));
        allYears.forEach(year => {
            const matchupsForYear = historicalData.matchupsBySeason[year] || [];
            const rostersForYear = historicalData.rostersBySeason[year] || [];
            logger.debug(`LeagueHistory: Year ${year} - matchups: ${matchupsForYear.length}, rosters: ${rostersForYear.length}`);
            if (matchupsForYear.length === 0 || rostersForYear.length === 0) { logger.debug(`LeagueHistory: Skipping year ${year} - no data`); return; }
            const teamPointsData = {};
            const rosterIdToOwnerMap = {};
            rostersForYear.forEach(roster => { const ownerId = roster.owner_id; const rosterId = roster.roster_id; const teamName = getDisplayTeamNameFromContext(ownerId, year); rosterIdToOwnerMap[rosterId] = ownerId; teamPointsData[rosterId] = { ownerId, teamName, totalPoints: 0, games: 0 }; });
            const matchupsByWeek = {};
            matchupsForYear.forEach(m => { const week = m.week || m.matchup_period || m.matchupWeek || 1; if (!matchupsByWeek[week]) matchupsByWeek[week] = []; matchupsByWeek[week].push(m); });
            const completedWeeks = Object.keys(matchupsByWeek).filter(week => { const weekMatchups = matchupsByWeek[week]; return weekMatchups.every(mu => { const t1s = mu.team1_score || mu.t1_score; const t2s = mu.team2_score || mu.t2_score; return t1s !== null && t2s !== null && t1s !== undefined && t2s !== undefined && t1s > 0 && t2s > 0; }); });
            completedWeeks.forEach(week => { matchupsByWeek[week].forEach((matchup) => { const team1Id = matchup.team1_roster_id || matchup.t1; const team2Id = matchup.team2_roster_id || matchup.t2; const team1Score = matchup.team1_score || matchup.t1_score || 0; const team2Score = matchup.team2_score || matchup.t2_score || 0; if (team1Id && teamPointsData[team1Id]) { teamPointsData[team1Id].totalPoints += team1Score; teamPointsData[team1Id].games += 1; } if (team2Id && teamPointsData[team2Id]) { teamPointsData[team2Id].totalPoints += team2Score; teamPointsData[team2Id].games += 1; } }); });
            const teamSeasonAverages = [];
            const teamAverageScores = {};
            Object.values(teamPointsData).forEach(teamData => { if (teamData.games > 0) { const seasonAvg = teamData.totalPoints / teamData.games; teamSeasonAverages.push(seasonAvg); teamAverageScores[teamData.teamName] = seasonAvg; } });
            logger.debug(`LeagueHistory: Team season averages for year ${year}:`, teamAverageScores);
            if (teamSeasonAverages.length > 0) {
                teamSeasonAverages.sort((a, b) => a - b);
                const highest = Math.max(...teamSeasonAverages); const lowest = Math.min(...teamSeasonAverages);
                const average = teamSeasonAverages.reduce((sum, score) => sum + score, 0) / teamSeasonAverages.length;
                const highestTeam = Object.keys(teamAverageScores).find(team => Math.abs(teamAverageScores[team] - highest) < 0.01) || 'Unknown';
                const lowestTeam = Object.keys(teamAverageScores).find(team => Math.abs(teamAverageScores[team] - lowest) < 0.01) || 'Unknown';
                const yearData = { year, highest: parseFloat(highest.toFixed(1)), lowest: parseFloat(lowest.toFixed(1)), average: parseFloat(average.toFixed(1)), range: parseFloat((highest - lowest).toFixed(1)), highestTeam, lowestTeam };
                logger.debug(`LeagueHistory: Adding team average data for year ${year}:`, yearData);
                averageScoresData.push(yearData);
            } else { logger.debug(`LeagueHistory: No team season averages calculated for year ${year}`); }
        });
        logger.debug('LeagueHistory: averageScoresData calculated:', averageScoresData);
        setAverageScoreChartData(averageScoresData);
        const years = allYears.map(String).sort();
        setAvailableYears(years);
        if (!selectedStartYear && years.length > 0) setSelectedStartYear(years[0]);
        if (!selectedEndYear && years.length > 0) setSelectedEndYear(years[years.length - 1]);
        setSeasonAwardsSummary(newSeasonAwardsSummary);
        setSortedYearsForAwards(Object.keys(newSeasonAwardsSummary).map(Number).sort((a, b) => b - a));
        (async () => {
            try {
                const pairCounts = {};
                const getOwnerIdForRoster = (rosterId, year) => {
                    if (!historicalData || !historicalData.rostersBySeason) return null;
                    const tryYears = [];
                    if (year) tryYears.push(String(year));
                    tryYears.push(...Object.keys(historicalData.rostersBySeason));
                    for (const y of tryYears) { const rostersForYear = historicalData.rostersBySeason[y] || []; const found = rostersForYear.find(r => String(r.roster_id) === String(rosterId)); if (found) return String(found.owner_id); }
                    return null;
                };
                const allYears = Object.keys(historicalData.rostersBySeason || {}).sort();
                let financialTransactions = [];
                if (allYears.length > 0) { try { const financialDataByYear = await fetchFinancialDataForYears(allYears); financialTransactions = Object.values(financialDataByYear).flatMap(y => (y && y.transactions) ? y.transactions : []); } catch (err) { logger.warn('LeagueHistory: could not fetch financial data for all years:', err); financialTransactions = []; } }
                let leagueFetchedTransactions = [];
                try {
                    const seasonsToFetch = Object.keys(historicalData.leaguesMetadataBySeason || {});
                    const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000;
                    for (const season of seasonsToFetch) {
                        const leagueMeta = historicalData.leaguesMetadataBySeason?.[String(season)];
                        const leagueId = leagueMeta?.league_id || leagueMeta?.leagueId || leagueMeta?.id || null;
                        if (!leagueId) continue;
                        const cached = leagueTxCache.current.get(leagueId);
                        if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) { leagueFetchedTransactions.push(...cached.transactions); continue; }
                        const maxWeeks = (String(season) === String(nflState?.season) && nflState?.week) ? Math.max(1, nflState.week) : 18;
                        const weekPromises = [];
                        for (let w = 1; w <= maxWeeks; w++) { weekPromises.push(fetchTransactionsForWeek(leagueId, w).catch(err => { logger.debug(`LeagueHistory: fetchTransactionsForWeek failed for ${leagueId} week ${w}: ${err}`); return []; })); }
                        const results = await Promise.all(weekPromises);
                        const seasonTx = results.flat().map(tx => { if (tx && !tx.season) tx.season = season; return tx; }).filter(Boolean);
                        leagueTxCache.current.set(leagueId, { timestamp: Date.now(), transactions: seasonTx });
                        leagueFetchedTransactions.push(...seasonTx);
                    }
                } catch (err) { logger.warn('LeagueHistory: error fetching league transactions for historical leagues', err); }
                const contextTx = Array.isArray(transactions) ? transactions : [];
                const allTx = [...financialTransactions, ...leagueFetchedTransactions, ...contextTx];
                const filteredTx = allTx;
                try {
                    let totals = [];
                    if (typeof calculateAllTeamFinancialTotals === 'function' && typeof usersData !== 'undefined' && usersData) {
                        try {
                            const financialByTeamAndYear = calculateAllTeamFinancialTotals(financialDataByYear || {}, usersData);
                            if (financialByTeamAndYear && Object.keys(financialByTeamAndYear).length > 0) {
                                totals = Object.keys(financialByTeamAndYear).map(teamName => { const perYear = financialByTeamAndYear[teamName] || {}; const combined = Object.values(perYear).reduce((acc, fy) => ({ totalFees: acc.totalFees + (fy.totalFees || 0), totalPayouts: acc.totalPayouts + (fy.totalPayouts || 0), netTotal: acc.netTotal + (fy.netTotal || 0) }), { totalFees: 0, totalPayouts: 0, netTotal: 0 }); return { teamName, ...combined }; }).sort((a, b) => b.netTotal - a.netTotal);
                            }
                        } catch (e) { logger.debug('LeagueHistory: calculateAllTeamFinancialTotals failed or returned no data', e); }
                    }
                    if ((!totals || totals.length === 0) && filteredTx && filteredTx.length > 0) {
                        const ownerTotals = [];
                        if (usersData && Array.isArray(usersData) && usersData.length > 0) { usersData.forEach(u => { const oid = String(u.user_id || u.userId || u.id || ''); if (!oid) return; try { const fin = calculateTeamFinancialTotalsByOwnerId(filteredTx, oid); const teamName = u.display_name || u.username || oid; ownerTotals.push({ teamName, totalFees: fin.totalFees || 0, totalPayouts: fin.totalPayouts || 0, netTotal: fin.netTotal || 0 }); } catch (e) {} }); }
                        else if (historicalData && historicalData.rostersBySeason) { const ownerIds = []; Object.keys(historicalData.rostersBySeason).forEach(y => { (historicalData.rostersBySeason[y] || []).forEach(r => { if (r && r.owner_id) ownerIds.push(String(r.owner_id)); }); }); const uniqueOwnerIds = Array.from(new Set(ownerIds)); uniqueOwnerIds.forEach(oid => { try { const fin = calculateTeamFinancialTotalsByOwnerId(filteredTx, oid); const teamName = getDisplayTeamNameFromContext(oid, null) || oid; ownerTotals.push({ teamName, totalFees: fin.totalFees || 0, totalPayouts: fin.totalPayouts || 0, netTotal: fin.netTotal || 0 }); } catch (e) {} }); }
                        if (ownerTotals && ownerTotals.length > 0) totals = ownerTotals.sort((a, b) => b.netTotal - a.netTotal);
                    }
                    if (totals && totals.length > 0) { logger.debug('LeagueHistory: computed all-time financial totals count:', totals.length); try { if (typeof window !== 'undefined') window.__allTimeFinancials = totals; } catch(e){} setAllTimeFinancials(totals); }
                    else { logger.debug('LeagueHistory: no all-time financial totals found; usersData length:', usersData ? usersData.length : 'null', 'filteredTx length:', filteredTx ? filteredTx.length : 'null'); try { if (typeof window !== 'undefined') window.__allTimeFinancials = totals || []; } catch(e){} }
                } catch (e) { logger.warn('LeagueHistory: error while computing all-time financial totals', e); }
                const pickupsByOwner = {};
                const tradesByOwner = {};
                filteredTx.forEach(tx => {
                    try {
                        if (!tx) return;
                        const txType = String(tx.type || '').toLowerCase();
                        if (txType === 'waiver' || txType === 'free_agent' || txType === 'add') {
                            const pickupCount = tx.adds ? Object.keys(tx.adds).length : 0;
                            let owner = null;
                            if (tx.roster_ids && Array.isArray(tx.roster_ids) && tx.roster_ids.length > 0) owner = getOwnerIdForRoster(tx.roster_ids[0], tx.season || tx.year || null);
                            if (owner && pickupCount > 0) { pickupsByOwner[owner] = (pickupsByOwner[owner] || 0) + pickupCount; }
                            else if (tx.adds && typeof tx.adds === 'object') { Object.values(tx.adds).forEach(add => { const rid = add?.roster_id || add?.rosterId || null; if (rid) { const inferredOwner = getOwnerIdForRoster(rid, tx.season || tx.year || null); if (inferredOwner) pickupsByOwner[inferredOwner] = (pickupsByOwner[inferredOwner] || 0) + 1; } }); }
                            return;
                        }
                        if (txType !== 'trade') return;
                        if (tx.status && String(tx.status).toLowerCase() === 'failed') return;
                        const rosterIds = Array.isArray(tx.roster_ids) ? tx.roster_ids.map(r => String(r)) : [];
                        if (rosterIds.length === 0) { const inferred = new Set(); if (tx.adds) Object.values(tx.adds).forEach(v => { if (v?.roster_id) inferred.add(String(v.roster_id)); }); if (tx.drops) Object.values(tx.drops).forEach(v => { if (v?.roster_id) inferred.add(String(v.roster_id)); }); if (tx.team && Array.isArray(tx.team)) tx.team.forEach(t => inferred.add(String(t))); rosterIds.push(...Array.from(inferred)); }
                        let txYear = tx.season || tx.year || tx.metadata?.season || null;
                        if (!txYear && tx.created) { try { txYear = new Date(tx.created).getFullYear(); } catch (e) { txYear = null; } }
                        if (!txYear) txYear = allYears.length ? allYears[allYears.length - 1] : null;
                        const ownerIds = rosterIds.map(rid => getOwnerIdForRoster(rid, txYear)).filter(Boolean);
                        const uniqueOwners = Array.from(new Set(ownerIds.map(o => String(o))));
                        if (uniqueOwners.length < 2) return;
                        uniqueOwners.forEach(o => { tradesByOwner[o] = (tradesByOwner[o] || 0) + 1; });
                        for (let i = 0; i < uniqueOwners.length; i++) { for (let j = i + 1; j < uniqueOwners.length; j++) { const a = uniqueOwners[i]; const b = uniqueOwners[j]; const [s, l] = a < b ? [a, b] : [b, a]; const key = `${s}|${l}`; pairCounts[key] = (pairCounts[key] || 0) + 1; } }
                    } catch (e) {}
                });
                const pairsArray = Object.keys(pairCounts).map(k => { const [a, b] = k.split('|'); return { ownerA: a, ownerB: b, teamA: getDisplayTeamNameFromContext(a, null), teamB: getDisplayTeamNameFromContext(b, null), count: pairCounts[k] }; }).sort((x, y) => y.count - x.count);
                const ownerSet = new Set();
                pairsArray.forEach(p => { ownerSet.add(String(p.ownerA)); ownerSet.add(String(p.ownerB)); });
                Object.keys(pickupsByOwner || {}).forEach(o => ownerSet.add(String(o)));
                Object.keys(tradesByOwner || {}).forEach(o => ownerSet.add(String(o)));
                const totalsArray = Array.from(ownerSet).map(ownerId => ({ ownerId, teamName: getDisplayTeamNameFromContext(ownerId, null), pickups: pickupsByOwner[ownerId] || 0, trades: tradesByOwner[ownerId] || 0 })).sort((a, b) => (b.pickups + b.trades) - (a.pickups + a.trades));
                const draftPickTradesData = {};
                let draftPickTradeCount = 0;
                filteredTx.forEach(tx => {
                    try {
                        if (!tx || String(tx.type || '').toLowerCase() !== 'trade') return;
                        const draftPicks = tx.draft_picks || tx.metadata?.traded_picks || [];
                        if (Array.isArray(draftPicks) && draftPicks.length > 0) {
                            draftPickTradeCount++;
                            const txYear = tx.season || tx.year || tx.metadata?.season || (tx.created ? new Date(tx.created).getFullYear() : null) || (allYears.length ? allYears[allYears.length - 1] : null);
                            draftPicks.forEach(pick => {
                                const currentOwner = pick.owner_id || pick.roster_id;
                                const previousOwner = pick.previous_owner_id || pick.original_owner;
                                const season = pick.season || txYear;
                                const round = pick.round;
                                if (currentOwner && previousOwner && String(currentOwner) !== String(previousOwner)) {
                                    const currentOwnerId = getOwnerIdForRoster(currentOwner, season);
                                    const previousOwnerId = getOwnerIdForRoster(previousOwner, season);
                                    if (currentOwnerId && previousOwnerId) {
                                        if (!draftPickTradesData[currentOwnerId]) draftPickTradesData[currentOwnerId] = { given: [], received: [] };
                                        if (!draftPickTradesData[previousOwnerId]) draftPickTradesData[previousOwnerId] = { given: [], received: [] };
                                        draftPickTradesData[currentOwnerId].received.push({ year: season, round, pickNumber: pick.pick || pick.pick_no || `R${round}`, fromTeam: getDisplayTeamNameFromContext(previousOwnerId, null), fromOwnerId: previousOwnerId, player: pick.player_name || 'Draft Pick' });
                                        draftPickTradesData[previousOwnerId].given.push({ year: season, round, pickNumber: pick.pick || pick.pick_no || `R${round}`, toTeam: getDisplayTeamNameFromContext(currentOwnerId, null), toOwnerId: currentOwnerId, player: pick.player_name || 'Draft Pick' });
                                    }
                                }
                            });
                        }
                    } catch (e) {}
                });
                setTradePairCounts(pairsArray);
                setTeamTransactionTotals(totalsArray);
                setDraftPickTrades(draftPickTradesData);
                try { window.localStorage.setItem('teamTransactionTotals', JSON.stringify(totalsArray)); } catch (e) {}
                try { const ev = new CustomEvent('teamTransactionTotalsUpdated', { detail: totalsArray }); window.dispatchEvent(ev); } catch (e) {}
            } catch (e) { setTradePairCounts([]); }
        })();
    }, [historicalData, allDraftHistory, nflState, getDisplayTeamNameFromContext, contextLoading, contextError, transactions]);

    // ── Formatters (untouched) ────────────────────────────────────────────────
    const formatPercentage = (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
            let formatted = value.toFixed(3);
            if (formatted.startsWith('0.')) formatted = formatted.substring(1);
            else if (formatted.startsWith('-0.')) formatted = `-${formatted.substring(2)}`;
            return `${formatted}%`;
        }
        return '.000%';
    };

    const formatDPR = (dprValue) => {
        if (typeof dprValue === 'number' && !isNaN(dprValue)) return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        return 'N/A';
    };

    // ── Custom chart tooltip (untouched logic) ────────────────────────────────
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const year = typeof label === 'string' ? parseInt(label) : label;
            const yearData = seasonalDPRChartData.find(d => parseInt(d.year) === year);
            let dprList = [];
            if (historicalData && allDraftHistory && getDisplayTeamNameFromContext && nflState && uniqueTeamsForChart) {
                const uniqueOwnerIdsForChart = Array.from(new Set(Object.keys(historicalData.rostersBySeason).flatMap(y => (historicalData.rostersBySeason[y] || []).map(r => r.owner_id))));
                const tempHistoricalDataForYear = { matchupsBySeason: {}, rostersBySeason: {}, leaguesMetadataBySeason: {}, winnersBracketBySeason: {}, losersBracketBySeason: {}, usersBySeason: {} };
                Object.keys(historicalData.matchupsBySeason).forEach(yearKey => { const yearNum = parseInt(yearKey); if (yearNum <= year) { tempHistoricalDataForYear.matchupsBySeason[yearKey] = historicalData.matchupsBySeason[yearKey]; tempHistoricalDataForYear.rostersBySeason[yearKey] = historicalData.rostersBySeason[yearKey]; tempHistoricalDataForYear.leaguesMetadataBySeason[yearKey] = historicalData.leaguesMetadataBySeason[yearKey]; tempHistoricalDataForYear.winnersBracketBySeason[yearKey] = historicalData.winnersBracketBySeason[yearKey]; tempHistoricalDataForYear.losersBracketBySeason[yearKey] = historicalData.losersBracketBySeason[yearKey]; tempHistoricalDataForYear.usersBySeason[yearKey] = historicalData.usersBySeason[yearKey]; } });
                const { careerDPRData: cumulativeCareerDPRDataForYear } = calculateAllLeagueMetrics(tempHistoricalDataForYear, allDraftHistory, getDisplayTeamNameFromContext, nflState);
                dprList = uniqueOwnerIdsForChart.map(ownerId => { const dprObj = cumulativeCareerDPRDataForYear.find(dpr => dpr.ownerId === ownerId); return { ownerId, dpr: dprObj ? dprObj.dpr : undefined, teamName: getDisplayTeamNameFromContext(ownerId, null) }; });
            }
            const teamRanks = payload.map((entry) => { let ownerId = undefined; if (dprList && dprList.length > 0) { const found = dprList.find(item => item.teamName === entry.name); if (found) ownerId = found.ownerId; } return { team: entry.name, rank: yearData ? yearData[entry.name] : undefined, color: entry.color, ownerId }; });
            teamRanks.sort((a, b) => a.rank - b.rank);
            return (
                <div className="bg-gray-900 border border-white/15 rounded-xl p-3 shadow-2xl text-xs">
                    <p className="font-semibold text-white mb-1.5">Year: {label}</p>
                    {teamRanks.map((entry, index) => (
                        <p key={`item-${index}`} style={{ color: entry.color }}>{entry.team}</p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const numTeams = uniqueTeamsForChart.length;
    const yAxisTicks = [];
    for (let t = 1; t <= numTeams; t++) yAxisTicks.push(t);

    // ── Sort logic (untouched) ────────────────────────────────────────────────
    const getSortedStandings = () => {
        const sorted = [...allTimeStandings];
        sorted.sort((a, b) => {
            let aVal = a[sortBy], bVal = b[sortBy];
            if (sortBy === 'team') { aVal = aVal?.toLowerCase() || ''; bVal = bVal?.toLowerCase() || ''; if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1; if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1; return 0; }
            if (sortBy === 'seasons') { const aCount = a.seasons?.props?.children?.[1]?.props?.children || 0; const bCount = b.seasons?.props?.children?.[1]?.props?.children || 0; return sortOrder === 'asc' ? aCount - bCount : bCount - aCount; }
            if (sortBy === 'awards') { const aAwards = a.awards || {}; const bAwards = b.awards || {}; if (aAwards.championships !== bAwards.championships) return sortOrder === 'asc' ? aAwards.championships - bAwards.championships : bAwards.championships - aAwards.championships; if (aAwards.runnerUps !== bAwards.runnerUps) return sortOrder === 'asc' ? aAwards.runnerUps - bAwards.runnerUps : bAwards.runnerUps - aAwards.runnerUps; if (aAwards.thirdPlace !== bAwards.thirdPlace) return sortOrder === 'asc' ? aAwards.thirdPlace - bAwards.thirdPlace : bAwards.thirdPlace - aAwards.thirdPlace; return 0; }
            aVal = typeof aVal === 'string' ? parseFloat(aVal) : aVal; bVal = typeof bVal === 'string' ? parseFloat(bVal) : bVal;
            if (isNaN(aVal)) aVal = 0; if (isNaN(bVal)) bVal = 0;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return sorted;
    };

    const handleSort = (column) => { if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(column); setSortOrder('desc'); } };

    const getFilteredChartData = (data) => {
        if (!selectedStartYear || !selectedEndYear || !data.length) return data;
        const startYear = parseInt(selectedStartYear), endYear = parseInt(selectedEndYear);
        return data.filter(item => { const year = parseInt(item.year); return year >= startYear && year <= endYear; });
    };

    const getXAxisInterval = (dataLength) => {
        if (dataLength <= 5) return 0;
        if (dataLength <= 10) return 1;
        if (dataLength <= 15) return 2;
        return Math.floor(dataLength / 8);
    };

    // ── Award icons helper ────────────────────────────────────────────────────
    const renderAwards = (awards) => (
        <div className="flex flex-wrap items-center gap-2">
            {awards.championships > 0 && <AwardBadge icon="fas fa-trophy" color="text-yellow-400" count={awards.championships} title={`Champion (${awards.championshipsYears.join(', ')})`} />}
            {awards.runnerUps > 0 && <AwardBadge icon="fas fa-trophy" color="text-gray-400" count={awards.runnerUps} title={`Runner-Up (${awards.runnerUpsYears.join(', ')})`} />}
            {awards.thirdPlace > 0 && <AwardBadge icon="fas fa-trophy" color="text-amber-700" count={awards.thirdPlace} title={`3rd Place (${awards.thirdPlaceYears.join(', ')})`} />}
            {awards.firstPoints > 0 && <AwardBadge icon="fas fa-medal" color="text-yellow-400" count={awards.firstPoints} title={`Points Champ (${awards.firstPointsYears.join(', ')})`} />}
            {awards.secondPoints > 0 && <AwardBadge icon="fas fa-medal" color="text-gray-400" count={awards.secondPoints} title={`Points 2nd (${awards.secondPointsYears.join(', ')})`} />}
            {awards.thirdPoints > 0 && <AwardBadge icon="fas fa-medal" color="text-amber-700" count={awards.thirdPoints} title={`Points 3rd (${awards.thirdPointsYears.join(', ')})`} />}
        </div>
    );

    // ── Chart axis/grid shared props ──────────────────────────────────────────
    const darkGrid = { stroke: 'rgba(255,255,255,0.05)' };
    const darkTick = { fill: '#6b7280', fontSize: 10 };
    const darkTooltipStyle = { backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 space-y-6">

            {/* Page heading */}
            <div className="text-center pt-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">League History & Awards</h2>
            </div>

            {contextLoading ? (
                <div className="text-center text-gray-500 py-10 animate-pulse">Loading league history data…</div>
            ) : contextError ? (
                <div className="text-center text-red-400 py-10">{contextError.message || String(contextError)}</div>
            ) : allTimeStandings.length === 0 ? (
                <div className="text-center text-gray-500 py-10">No historical matchup data found.</div>
            ) : (
                <>
                    {/* ── All-Time Standings ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">All-Time Standings</span>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-white/5">
                            {getSortedStandings().map((team, idx) => {
                                const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, null) : { name: team.team, avatar: undefined };
                                return (
                                    <div key={team.team} className="px-4 py-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xs font-bold text-gray-600 w-5 flex-shrink-0">{idx + 1}</span>
                                                {teamDetails.avatar && <img src={teamDetails.avatar} alt={team.team} className="w-7 h-7 rounded-full border border-white/20 object-cover flex-shrink-0" onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }} />}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-200 truncate">{team.team}</div>
                                                    <div className="text-[10px] text-gray-600">{team.seasons}</div>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-sm font-bold text-blue-400">{formatDPR(team.totalDPR)}</div>
                                                <div className="text-[10px] text-gray-600">Career DPR</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <div className="bg-white/5 rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-gray-500 mb-0.5">Record</div>
                                                <div className="text-xs font-semibold text-gray-300">{team.record}</div>
                                            </div>
                                            <div className="bg-white/5 rounded-lg px-3 py-2">
                                                <div className="text-[10px] text-gray-500 mb-0.5">Win %</div>
                                                <div className="text-xs font-semibold text-blue-400">{formatPercentage(team.winPercentage)}</div>
                                            </div>
                                        </div>
                                        {renderAwards(team.awards)}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className={th}>#</th>
                                        <th className={th}>Team</th>
                                        <th className={thCenter}>Seasons</th>
                                        <th className={thCenter}>Career DPR</th>
                                        <th className={thCenter}>Record</th>
                                        <th className={thCenter}>Win %</th>
                                        <th className={thCenter}>Awards</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {getSortedStandings().map((team, index) => {
                                        const teamDetails = getTeamDetails ? getTeamDetails(team.ownerId, null) : { name: team.team, avatar: undefined };
                                        return (
                                            <tr key={team.team} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">{index + 1}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2.5">
                                                        {teamDetails.avatar && <img src={teamDetails.avatar} alt={team.team} className="w-7 h-7 rounded-full border border-white/20 object-cover flex-shrink-0" onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }} />}
                                                        <span className="text-sm font-medium text-gray-200 truncate">{team.team}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-xs text-gray-400">{team.seasons}</td>
                                                <td className="py-2.5 px-3 text-center text-sm font-bold text-blue-400 tabular-nums">{formatDPR(team.totalDPR)}</td>
                                                <td className="py-2.5 px-3 text-center text-xs text-gray-300 tabular-nums">{team.record}</td>
                                                <td className="py-2.5 px-3 text-center text-xs font-semibold text-blue-400 tabular-nums">{formatPercentage(team.winPercentage)}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex flex-wrap justify-center gap-2">{renderAwards(team.awards)}</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Trade Partner Matrix ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Trade Partner Matrix (All Time)</span>
                        </div>
                        <div className={cardPad}>
                            {(!tradePairCounts || tradePairCounts.length === 0) && (!allTimeStandings || allTimeStandings.length === 0) ? (
                                <div className="text-sm text-gray-500">No trade data available.</div>
                            ) : (() => {
                                const ownersFromPairs = new Set();
                                tradePairCounts.forEach(p => { ownersFromPairs.add(String(p.ownerA)); ownersFromPairs.add(String(p.ownerB)); });
                                const ownersFromStandings = (allTimeStandings || []).map(t => String(t.ownerId));
                                const combinedOwners = Array.from(new Set([...ownersFromStandings, ...Array.from(ownersFromPairs)])).filter(Boolean);
                                const ownerIdToName = {};
                                combinedOwners.forEach(id => { ownerIdToName[id] = getDisplayTeamNameFromContext(id, null); });
                                const counts = {};
                                combinedOwners.forEach(a => { counts[a] = {}; combinedOwners.forEach(b => { counts[a][b] = 0; }); });
                                tradePairCounts.forEach(p => { const a = String(p.ownerA); const b = String(p.ownerB); if (!counts[a]) counts[a] = {}; if (!counts[b]) counts[b] = {}; counts[a][b] = p.count || 0; counts[b][a] = p.count || 0; });
                                const maxCount = tradePairCounts.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1;
                                const heatColor = (n) => {
                                    if (!n || n === 0) return '';
                                    const ratio = Math.min(1, n / maxCount);
                                    const start = [30, 58, 138]; const end = [59, 130, 246];
                                    const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
                                    const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
                                    const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
                                    return `rgb(${r},${g},${b})`;
                                };
                                return (
                                    <>
                                        <div className="overflow-auto rounded-lg border border-white/10" style={{ maxHeight: 420 }}>
                                            <table className="min-w-full text-xs table-fixed border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="sticky left-0 top-0 z-30 py-2 px-2 border-b border-white/10 border-r border-white/10 whitespace-nowrap text-left"
                                                            style={{ backgroundColor: '#1e293b', minWidth: 56, maxWidth: 160 }}></th>
                                                        {combinedOwners.map(ownerId => (
                                                            <th key={`col-${ownerId}`} className="py-2 px-1 text-center text-[10px] font-medium text-gray-400 border-b border-white/10 sticky top-0"
                                                                style={{ backgroundColor: '#1e293b', minWidth: 68, maxWidth: 120 }}>
                                                                <div className="whitespace-normal break-words" style={{ lineHeight: 1.1 }}>{ownerIdToName[ownerId]}</div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {combinedOwners.map((rowOwner, rowIdx) => (
                                                        <tr key={`row-${rowOwner}`} className="border-b border-white/5">
                                                            <td className="sticky left-0 z-20 py-1.5 px-2 text-[10px] font-medium text-gray-300 text-center border-r border-white/10"
                                                                style={{ backgroundColor: '#1e293b', minWidth: 80, maxWidth: 180, wordBreak: 'break-word' }}>
                                                                {ownerIdToName[rowOwner]}
                                                            </td>
                                                            {combinedOwners.map(colOwner => {
                                                                const val = rowOwner === colOwner ? null : (counts[rowOwner]?.[colOwner] || 0);
                                                                const bg = val ? heatColor(val) : undefined;
                                                                return (
                                                                    <td key={`${rowOwner}-${colOwner}`} className="px-1 py-1.5 text-center border-b border-white/5 align-middle"
                                                                        style={{ background: bg }}>
                                                                        {rowOwner === colOwner
                                                                            ? <span className="text-gray-700">—</span>
                                                                            : <span className="font-semibold text-xs" style={{ color: val ? '#bfdbfe' : '#374151' }}>{val}</span>}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-2">Note: 2021 Yahoo league data not included. Reversed trades included in count.</p>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* ── Waiver/FA & Trade Totals ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Waiver/FA & Trade Totals (All Time)</span>
                        </div>
                        <div className="overflow-x-auto">
                            {(!teamTransactionTotals || teamTransactionTotals.length === 0) ? (
                                <div className="px-4 py-8 text-sm text-gray-500">No transaction summary data available.</div>
                            ) : (
                                <>
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className={th}>Team</th>
                                                <th className={thCenter}>Waiver/FA</th>
                                                <th className={thCenter}>Trades</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {teamTransactionTotals.map(t => (
                                                <tr key={`tx-${t.ownerId}`} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-2.5 px-3 text-sm font-medium text-gray-200">{t.teamName}</td>
                                                    <td className="py-2.5 px-3 text-center text-sm font-semibold text-blue-400 tabular-nums">{t.pickups}</td>
                                                    <td className="py-2.5 px-3 text-center text-sm font-semibold text-blue-400 tabular-nums cursor-pointer hover:text-blue-300 transition-colors"
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTeamTrades({ ownerId: t.ownerId, teamName: t.teamName, draftPicks: draftPickTrades[t.ownerId] || { given: [], received: [] } }); setShowTradeModal(true); }}
                                                        title="Click to view draft pick trade details">
                                                        <span className="flex items-center justify-center gap-1">
                                                            {t.trades}
                                                            <i className="fas fa-info-circle text-xs opacity-50 pointer-events-none"></i>
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="text-[10px] text-gray-600 px-4 py-2 border-t border-white/5">Note: 2021 Yahoo league data not included. Reversed trades included in count.</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── All-Time Net Financials ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">All-Time Net Financials</span>
                        </div>
                        {(!allTimeFinancials || allTimeFinancials.length === 0) ? (
                            <div className="px-4 py-8 text-sm text-gray-500">No financial export data available.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className={th}>Team</th>
                                            <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Net Total</th>
                                            <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payouts</th>
                                            <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Fees</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {allTimeFinancials.map(f => (
                                            <tr key={`fin-${f.teamName}`} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2.5 px-3 text-sm font-medium text-gray-200">{f.teamName}</td>
                                                <td className={`py-2.5 px-3 text-right text-sm font-bold tabular-nums ${f.netTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(f.netTotal)}</td>
                                                <td className="py-2.5 px-3 text-right text-sm text-gray-400 tabular-nums">{formatCurrency(f.totalPayouts)}</td>
                                                <td className="py-2.5 px-3 text-right text-sm text-gray-400 tabular-nums">{formatCurrency(f.totalFees)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Season-by-Season Awards ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Season-by-Season Champions & Awards</span>
                        </div>
                        <div className={cardPad}>
                            {Object.keys(seasonAwardsSummary).length > 0 ? (
                                <>
                                    <div className="space-y-2">
                                        {(showAllSeasons ? sortedYearsForAwards : sortedYearsForAwards.slice(0, 8)).map((year) => {
                                            const awards = seasonAwardsSummary[year];
                                            return (
                                                <div key={`awards-${year}`} className="bg-white/5 border border-white/8 rounded-xl p-3">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-12 flex-shrink-0 text-sm font-bold text-gray-400 mt-0.5">{year}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                                                                {[
                                                                    { icon: 'fas fa-trophy', color: 'text-yellow-400', label: 'Champion', value: awards.champion },
                                                                    { icon: 'fas fa-trophy', color: 'text-gray-400', label: '2nd Place', value: awards.secondPlace },
                                                                    { icon: 'fas fa-trophy', color: 'text-amber-700', label: '3rd Place', value: awards.thirdPlace },
                                                                ].map(({ icon, color, label, value }) => (
                                                                    <div key={label} className="flex items-center gap-2 min-w-0">
                                                                        <i className={`${icon} ${color} text-xs flex-shrink-0`}></i>
                                                                        <div className="min-w-0">
                                                                            <div className="text-[10px] text-gray-600">{label}</div>
                                                                            <div className="text-xs font-medium text-gray-300 truncate" title={value}>{value}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                {[
                                                                    { icon: 'fas fa-medal', color: 'text-yellow-400', label: 'Points Champ', value: awards.pointsChamp },
                                                                    { icon: 'fas fa-medal', color: 'text-gray-400', label: 'Points 2nd', value: awards.pointsSecond },
                                                                    { icon: 'fas fa-medal', color: 'text-amber-700', label: 'Points 3rd', value: awards.pointsThird },
                                                                ].map(({ icon, color, label, value }) => (
                                                                    <div key={label} className="flex items-center gap-2 min-w-0">
                                                                        <i className={`${icon} ${color} text-xs flex-shrink-0`}></i>
                                                                        <div className="min-w-0">
                                                                            <div className="text-[10px] text-gray-600">{label}</div>
                                                                            <div className="text-xs font-medium text-gray-300 truncate" title={value}>{value}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {sortedYearsForAwards.length > 8 && (
                                        <div className="flex justify-center mt-3">
                                            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors" onClick={() => setShowAllSeasons(!showAllSeasons)}>
                                                {showAllSeasons ? 'Show less' : `Show all ${sortedYearsForAwards.length} seasons`}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center text-gray-500 text-sm py-6">No season-by-season award data available.</div>
                            )}
                        </div>
                    </div>

                    {/* ── Chart Controls ── */}
                    {(averageScoreChartData.length > 0 || seasonalDPRChartData.length > 0) && availableYears.length > 5 && (
                        <div className={card}>
                            <div className={cardHeader}>
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                </svg>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Chart Display Options</span>
                            </div>
                            <div className={cardPad}>
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-gray-400 whitespace-nowrap">Show seasons:</span>
                                        <select value={selectedStartYear} onChange={(e) => setSelectedStartYear(e.target.value)}
                                            className="px-2 py-1 bg-gray-700 border border-white/10 rounded-lg text-xs text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                        <span className="text-gray-600 text-xs">to</span>
                                        <select value={selectedEndYear} onChange={(e) => setSelectedEndYear(e.target.value)}
                                            className="px-2 py-1 bg-gray-700 border border-white/10 rounded-lg text-xs text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { if (availableYears.length > 0) { const recent = availableYears.slice(-5); setSelectedStartYear(recent[0]); setSelectedEndYear(recent[recent.length - 1]); } }}
                                            className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs hover:bg-blue-500/30 transition-colors">
                                            Last 5 seasons
                                        </button>
                                        <button onClick={() => { if (availableYears.length > 0) { setSelectedStartYear(availableYears[0]); setSelectedEndYear(availableYears[availableYears.length - 1]); } }}
                                            className="px-3 py-1.5 bg-white/8 text-gray-300 border border-white/10 rounded-lg text-xs hover:bg-white/12 transition-colors">
                                            All seasons
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Average Score Chart ── */}
                    {averageScoreChartData.length > 0 && (
                        <div className={card}>
                            <div className={cardHeader}>
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Average Matchup Score by Season</span>
                            </div>
                            <div className={cardPad}>
                                <p className="text-[10px] text-gray-600 mb-3">Highest and lowest team season averages with overall league average.</p>
                                {/* Mobile */}
                                <div className="sm:hidden" style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={getFilteredChartData(averageScoreChartData)} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
                                            <CartesianGrid {...darkGrid} />
                                            <XAxis dataKey="year" tick={darkTick} interval={getXAxisInterval(getFilteredChartData(averageScoreChartData).length)} angle={-45} textAnchor="end" height={50} />
                                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={darkTick} width={36} />
                                            <Tooltip content={<AverageScoreTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                                            <Line type="monotone" dataKey="highest" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: '#10b981' }} name="Highest Avg" />
                                            <Line type="monotone" dataKey="lowest" stroke="#ef4444" strokeWidth={2} dot={{ r: 2, fill: '#ef4444' }} name="Lowest Avg" />
                                            <Line type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#1e293b' }} activeDot={{ r: 5 }} name="League Avg" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Desktop */}
                                <div className="hidden sm:block">
                                    <ResponsiveContainer width="100%" aspect={2.5}>
                                        <ComposedChart data={getFilteredChartData(averageScoreChartData)} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                            <CartesianGrid {...darkGrid} />
                                            <XAxis dataKey="year" tick={darkTick} label={{ value: 'Season', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 10 }} />
                                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={darkTick} label={{ value: 'Avg Points', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
                                            <Tooltip content={<AverageScoreTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Line type="monotone" dataKey="highest" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="Highest Team Avg" />
                                            <Line type="monotone" dataKey="lowest" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Lowest Team Avg" />
                                            <Line type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#1e293b' }} activeDot={{ r: 6 }} name="League Average" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DPR Progression Chart ── */}
                    {seasonalDPRChartData.length > 0 && (
                        <div className={card}>
                            <div className={cardHeader}>
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4" />
                                </svg>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Total DPR Progression Over Seasons</span>
                            </div>
                            <div className={cardPad}>
                                {/* Mobile */}
                                <div className="sm:hidden" style={{ height: 350 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={getFilteredChartData(seasonalDPRChartData)} margin={{ top: 10, right: 5, left: 5, bottom: 40 }}>
                                            <CartesianGrid {...darkGrid} />
                                            <XAxis dataKey="year" tick={darkTick} interval={getXAxisInterval(getFilteredChartData(seasonalDPRChartData).length)} angle={-45} textAnchor="end" height={50} />
                                            <YAxis domain={[1, numTeams]} tickFormatter={v => `#${v}`} ticks={yAxisTicks} reversed tick={darkTick} width={28} allowDataOverflow padding={{ top: 10, bottom: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={6} layout="horizontal" align="center" verticalAlign="bottom" height={36} />
                                            {uniqueTeamsForChart.map((team, index) => (
                                                <Line key={team} type="monotone" dataKey={team} stroke={teamColors[index % teamColors.length]} activeDot={{ r: 4 }} dot={{ r: 2 }} strokeWidth={2} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Desktop */}
                                <div className="hidden sm:block">
                                    <ResponsiveContainer width="100%" aspect={1.5}>
                                        <LineChart data={getFilteredChartData(seasonalDPRChartData)} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid {...darkGrid} />
                                            <XAxis dataKey="year" tick={darkTick} label={{ value: 'Season', position: 'insideBottom', offset: 0, fill: '#6b7280', fontSize: 10 }} />
                                            <YAxis domain={[1, numTeams]} tickFormatter={v => `#${v}`} ticks={yAxisTicks} reversed tick={darkTick} allowDataOverflow padding={{ top: 10, bottom: 10 }} label={{ value: 'Rank (1 = Best)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            {uniqueTeamsForChart.map((team, index) => (
                                                <Line key={team} type="monotone" dataKey={team} stroke={teamColors[index % teamColors.length]} activeDot={{ r: 6 }} dot={{ r: 3 }} strokeWidth={2} />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Draft Pick Trade Modal ── */}
            {showTradeModal && selectedTeamTrades && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                            <h3 className="text-base font-bold text-white">Draft Pick Trades — {selectedTeamTrades.teamName}</h3>
                            <button onClick={() => setShowTradeModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg font-bold">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="p-5">
                                {(() => {
                                    const givenByRound = {}, receivedByRound = {};
                                    selectedTeamTrades.draftPicks.given.forEach(pick => { const r = pick.round || 'Unknown'; if (!givenByRound[r]) givenByRound[r] = 0; givenByRound[r]++; });
                                    selectedTeamTrades.draftPicks.received.forEach(pick => { const r = pick.round || 'Unknown'; if (!receivedByRound[r]) receivedByRound[r] = 0; receivedByRound[r]++; });
                                    const allRounds = new Set([...Object.keys(givenByRound), ...Object.keys(receivedByRound)]);
                                    const sortedRounds = Array.from(allRounds).sort((a, b) => { if (a === 'Unknown') return 1; if (b === 'Unknown') return -1; return parseInt(a) - parseInt(b); });
                                    return (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Draft Pick Trades by Round</p>
                                            <div className="rounded-xl border border-white/10 overflow-hidden">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-white/10">
                                                            <th className={th}>Round</th>
                                                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-red-400 uppercase tracking-wider">Given Away</th>
                                                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Received</th>
                                                            <th className={thCenter}>Net</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {sortedRounds.map((round) => {
                                                            const given = givenByRound[round] || 0, received = receivedByRound[round] || 0, net = received - given;
                                                            return (
                                                                <tr key={round} className="hover:bg-white/[0.02] transition-colors">
                                                                    <td className="py-2.5 px-3 text-sm font-medium text-gray-300">Round {round}</td>
                                                                    <td className="py-2.5 px-3 text-center text-sm font-semibold text-red-400 tabular-nums">{given > 0 ? given : '—'}</td>
                                                                    <td className="py-2.5 px-3 text-center text-sm font-semibold text-emerald-400 tabular-nums">{received > 0 ? received : '—'}</td>
                                                                    <td className={`py-2.5 px-3 text-center text-sm font-bold tabular-nums ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                                        {net > 0 ? '+' : ''}{net !== 0 ? net : '0'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {sortedRounds.length === 0 && (
                                                            <tr><td colSpan="4" className="py-8 text-center text-gray-500 text-sm italic">No draft pick trades found</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="flex-shrink-0 px-5 py-4 bg-white/5 border-t border-white/10">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-semibold">Overall Summary</p>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-1">Given</div>
                                    <div className="text-2xl font-bold text-red-400">{selectedTeamTrades.draftPicks.given.length}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Received</div>
                                    <div className="text-2xl font-bold text-emerald-400">{selectedTeamTrades.draftPicks.received.length}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Net</div>
                                    <div className={`text-2xl font-bold ${selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length > 0 ? 'text-emerald-400' : selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                        {selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length > 0 ? '+' : ''}{selectedTeamTrades.draftPicks.received.length - selectedTeamTrades.draftPicks.given.length}
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