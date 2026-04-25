import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateCareerTransactionCountsByOwnerId } from '../utils/financialCalculations';
import { useEffect as useEffectHistory, useState as useStateHistory } from 'react';
import LeagueHistory from './LeagueHistory';
import logger from '../utils/logger';

const LeagueRecords = () => {
    const { historicalData, allDraftHistory, getTeamName, getTeamDetails, currentSeason, loading, error, nflState } = useSleeperData();
    const [allTimeRecords, setAllTimeRecords] = useState({});
    const [recordHistory, setRecordHistory] = useState({});
    const [topFiveRankings, setTopFiveRankings] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [financialDataByYear, setFinancialDataByYear] = useState({});
    const [loadingFinancial, setLoadingFinancial] = useState(false);
    const [transactionTotals, setTransactionTotals] = useStateHistory([]);

    useEffectHistory(() => {
        // Try to load from localStorage first (in case event already fired before this component mounted)
        const storedTotals = window.localStorage.getItem('teamTransactionTotals');
        if (storedTotals) {
            try {
                const parsed = JSON.parse(storedTotals);
                logger.debug("LeagueRecords: Loaded transaction totals from localStorage:", parsed.length, "teams");
                setTransactionTotals(parsed);
            } catch (err) {
                logger.warn("LeagueRecords: Failed to parse stored transaction totals:", err);
            }
        }

        // Listen for future updates from LeagueHistory
        const handler = (e) => {
            try {
                if (e && e.detail) {
                    logger.debug("LeagueRecords: Received teamTransactionTotalsUpdated event with", e.detail.length, "teams");
                    setTransactionTotals(e.detail);
                }
            }
            catch (err) {
                logger.error("LeagueRecords: Error handling teamTransactionTotalsUpdated event:", err);
            }
        };
        window.addEventListener('teamTransactionTotalsUpdated', handler);
        return () => window.removeEventListener('teamTransactionTotalsUpdated', handler);
    }, []);

    const [computedCareerDPRs, setComputedCareerDPRs] = useState(null);
    const [computedSeasonalMetrics, setComputedSeasonalMetrics] = useState(null);
    const [computedFinancialData, setComputedFinancialData] = useState({});

    const formatConfig = {
        highestDPR: { decimals: 3, type: 'decimal' },
        lowestDPR: { decimals: 3, type: 'decimal' },
        bestLuck: { decimals: 3, type: 'decimal' },
        worstLuck: { decimals: 3, type: 'decimal' },
        mostWins: { decimals: 0, type: 'count' },
        mostLosses: { decimals: 0, type: 'count' },
        bestWinPct: { decimals: 3, type: 'percentage' },
        bestAllPlayWinPct: { decimals: 3, type: 'percentage' },
        mostWeeklyHighScores: { decimals: 0, type: 'count' },
        mostWeeklyTop2Scores: { decimals: 0, type: 'count' },
        mostWinningSeasons: { decimals: 0, type: 'count' },
        mostLosingSeasons: { decimals: 0, type: 'count' },
        mostBlowoutWins: { decimals: 0, type: 'count' },
        mostBlowoutLosses: { decimals: 0, type: 'count' },
        mostSlimWins: { decimals: 0, type: 'count' },
        mostSlimLosses: { decimals: 0, type: 'count' },
        mostTotalPoints: { decimals: 2, type: 'points' },
        mostPointsAgainst: { decimals: 2, type: 'points' },
        mostTrades: { decimals: 0, type: 'count' },
        mostWaivers: { decimals: 0, type: 'count' },
        highestPointsShare: { decimals: 2, type: 'percentage' },
        lowestPointsShare: { decimals: 2, type: 'percentage' },
        mostPointsChampionships: { decimals: 0, type: 'count' },
        mostRegularSeasonTitles: { decimals: 0, type: 'count' },
    };

    const updateRecord = (currentRecord, newValue, teamInfo) => {
        if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
            const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
            if (rosterMap) teamInfo.ownerId = rosterMap.owner_id;
        }
        if (newValue > currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== -Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year))
                currentRecord.teams.push(teamInfo);
        }
    };

    const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
        if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
            const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
            if (rosterMap) teamInfo.ownerId = rosterMap.owner_id;
        }
        if (newValue < currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year))
                currentRecord.teams.push(teamInfo);
        }
    };

    const calculateRecordHistory = (seasonalMetrics) => {
        const history = {};
        if (!seasonalMetrics || Object.keys(seasonalMetrics).length === 0) return history;
        try {
            const metricKeys = [
                'highestDPR','lowestDPR','bestLuck','worstLuck','mostWins','mostLosses',
                'bestWinPct','bestAllPlayWinPct','mostWeeklyHighScores','mostWeeklyTop2Scores',
                'mostWinningSeasons','mostLosingSeasons','mostBlowoutWins','mostBlowoutLosses',
                'mostSlimWins','mostSlimLosses','mostTotalPoints','mostPointsAgainst',
                'mostTrades','mostWaivers','mostPointsChampionships','mostRegularSeasonTitles'
            ];
            metricKeys.forEach(key => {
                history[key] = { currentValue: null, currentHolders: [], allTimeHolders: [], recordHistory: [] };
            });
        } catch (err) { logger.warn('Failed to build minimal record history:', err); }
        return history;
    };

    const calculateTopFiveRankings = (careerDPRData) => {
        const rankings = {};
        const getTop5 = (metric, isHigherBetter = true) => careerDPRData
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team[metric] }))
            .filter(team => team.value !== undefined && team.value !== null)
            .sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value)
            .slice(0, 5);

        rankings.highestDPR = getTop5('dpr', true);
        rankings.lowestDPR = getTop5('dpr', false);
        rankings.mostWins = getTop5('wins', true);
        rankings.mostLosses = getTop5('losses', true);
        rankings.bestWinPct = getTop5('winPercentage', true);
        rankings.bestAllPlayWinPct = getTop5('allPlayWinPercentage', true);
        rankings.mostWeeklyHighScores = getTop5('topScoreWeeksCount', true);
        rankings.mostWeeklyTop2Scores = getTop5('weeklyTop2ScoresCount', true);
        rankings.mostBlowoutWins = getTop5('blowoutWins', true);
        rankings.mostBlowoutLosses = getTop5('blowoutLosses', true);
        rankings.mostSlimWins = getTop5('slimWins', true);
        rankings.mostSlimLosses = getTop5('slimLosses', true);
        rankings.mostTotalPoints = getTop5('pointsFor', true);
        rankings.mostPointsAgainst = getTop5('pointsAgainst', true);
        rankings.highestPointsShare = getTop5('highestPointsShare', true);
        rankings.lowestPointsShare = getTop5('lowestPointsShare', false);
        rankings.mostPointsChampionships = getTop5('mostPointsTitles', true);
        rankings.mostRegularSeasonTitles = getTop5('regularSeasonTitles', true);
        rankings.bestLuck = careerDPRData
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.totalLuckRating }))
            .filter(team => typeof team.value === 'number' && !isNaN(team.value))
            .sort((a, b) => b.value - a.value).slice(0, 5);
        rankings.worstLuck = careerDPRData
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.totalLuckRating }))
            .filter(team => typeof team.value === 'number' && !isNaN(team.value))
            .sort((a, b) => a.value - b.value).slice(0, 5);
        return rankings;
    };

    const toggleSection = (recordKey) => {
        setExpandedSections(prev => ({ ...prev, [recordKey]: !prev[recordKey] }));
    };

    const doAllCalculations = (calculatedCareerDPRs, seasonalMetrics, financialData) => {
        const rankings = calculateTopFiveRankings(calculatedCareerDPRs);
        calculatedCareerDPRs.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            let winningSeasonsCount = 0, losingSeasonsCount = 0;
            Object.keys(seasonalMetrics).forEach(year => {
                const teamsInSeason = Object.values(seasonalMetrics[year]);
                const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                    if (currentOwnerTeamInSeason.winPercentage > 0.5) winningSeasonsCount++;
                    else if (currentOwnerTeamInSeason.winPercentage < 0.5) losingSeasonsCount++;
                }
            });
            careerStats.winningSeasonsCount = winningSeasonsCount;
            careerStats.losingSeasonsCount = losingSeasonsCount;
            if (Object.keys(financialData).length > 0) {
                const transactionCounts = calculateCareerTransactionCountsByOwnerId(financialData, ownerId);
                careerStats.careerTradeFees = transactionCounts.careerTradeFees;
                careerStats.careerWaiverFees = transactionCounts.careerWaiverFees;
                logger.debug(`Transaction counts for ${careerStats.teamName}:`, transactionCounts);
            } else {
                careerStats.careerTradeFees = 0;
                careerStats.careerWaiverFees = 0;
            }
        });
        rankings.mostWinningSeasons = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.winningSeasonsCount }))
            .sort((a, b) => b.value - a.value).slice(0, 5);
        rankings.mostLosingSeasons = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.losingSeasonsCount }))
            .sort((a, b) => b.value - a.value).slice(0, 5);
        if (transactionTotals && transactionTotals.length > 0) {
            logger.debug("LeagueRecords: Using transactionTotals from LeagueHistory event");
            rankings.mostTrades = [...transactionTotals].map(t => ({ name: t.teamName, ownerId: t.ownerId, value: t.trades })).sort((a, b) => b.value - a.value).slice(0, 5);
            rankings.mostWaivers = [...transactionTotals].map(t => ({ name: t.teamName, ownerId: t.ownerId, value: t.pickups })).sort((a, b) => b.value - a.value).slice(0, 5);
            logger.debug("LeagueRecords: mostTrades top 5:", rankings.mostTrades);
            logger.debug("LeagueRecords: mostWaivers top 5:", rankings.mostWaivers);
        } else {
            logger.warn("LeagueRecords: No transactionTotals available, falling back to financial data (this may be incorrect)");
            rankings.mostTrades = calculatedCareerDPRs.map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.careerTradeFees })).sort((a, b) => b.value - a.value).slice(0, 5);
            rankings.mostWaivers = calculatedCareerDPRs.map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.careerWaiverFees })).sort((a, b) => b.value - a.value).slice(0, 5);
            logger.debug("LeagueRecords: mostTrades (FALLBACK):", rankings.mostTrades);
            logger.debug("LeagueRecords: mostWaivers (FALLBACK):", rankings.mostWaivers);
        }
        rankings.highestPointsShare = calculatedCareerDPRs.map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.pointsShare })).filter(team => typeof team.value === 'number' && team.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
        rankings.lowestPointsShare = calculatedCareerDPRs.map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.pointsShare })).filter(team => typeof team.value === 'number' && team.value > 0).sort((a, b) => a.value - b.value).slice(0, 5);
        setTopFiveRankings(rankings);

        let highestDPR = { value: -Infinity, teams: [], key: 'highestDPR' };
        let lowestDPR = { value: Infinity, teams: [], key: 'lowestDPR' };
        let mostWins = { value: -Infinity, teams: [], key: 'mostWins' };
        let mostLosses = { value: -Infinity, teams: [], key: 'mostLosses' };
        let bestWinPct = { value: -Infinity, teams: [], key: 'bestWinPct' };
        let bestAllPlayWinPct = { value: -Infinity, teams: [], key: 'bestAllPlayWinPct' };
        let mostWeeklyHighScores = { value: -Infinity, teams: [], key: 'mostWeeklyHighScores' };
        let mostWeeklyTop2Scores = { value: -Infinity, teams: [], key: 'mostWeeklyTop2Scores' };
        let mostWinningSeasons = { value: -Infinity, teams: [], key: 'mostWinningSeasons' };
        let mostLosingSeasons = { value: -Infinity, teams: [], key: 'mostLosingSeasons' };
        let mostBlowoutWins = { value: -Infinity, teams: [], key: 'mostBlowoutWins' };
        let mostBlowoutLosses = { value: -Infinity, teams: [], key: 'mostBlowoutLosses' };
        let mostSlimWins = { value: -Infinity, teams: [], key: 'mostSlimWins' };
        let mostSlimLosses = { value: -Infinity, teams: [], key: 'mostSlimLosses' };
        let mostTotalPoints = { value: -Infinity, teams: [], key: 'mostTotalPoints' };
        let mostPointsAgainst = { value: -Infinity, teams: [], key: 'mostPointsAgainst' };
        let bestLuck = { value: -Infinity, teams: [], key: 'bestLuck' };
        let worstLuck = { value: Infinity, teams: [], key: 'worstLuck' };
        let mostTrades = { value: -Infinity, teams: [], key: 'mostTrades' };
        let mostWaivers = { value: -Infinity, teams: [], key: 'mostWaivers' };
        let highestPointsShare = { value: -Infinity, teams: [], key: 'highestPointsShare' };
        let lowestPointsShare = { value: Infinity, teams: [], key: 'lowestPointsShare' };
        let mostPointsChampionships = { value: -Infinity, teams: [], key: 'mostPointsChampionships' };
        let mostRegularSeasonTitles = { value: -Infinity, teams: [], key: 'mostRegularSeasonTitles' };

        calculatedCareerDPRs.forEach(careerStats => {
            const teamName = careerStats.teamName;
            const ownerId = careerStats.ownerId;
            if (careerStats.dpr !== 0) {
                updateRecord(highestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId });
                updateLowestRecord(lowestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId });
            }
            if (typeof careerStats.totalLuckRating === 'number' && !isNaN(careerStats.totalLuckRating)) {
                updateRecord(bestLuck, careerStats.totalLuckRating, { name: teamName, value: careerStats.totalLuckRating, ownerId });
                updateLowestRecord(worstLuck, careerStats.totalLuckRating, { name: teamName, value: careerStats.totalLuckRating, ownerId });
            }
            if (typeof careerStats.pointsShare === 'number' && careerStats.pointsShare > 0) {
                updateRecord(highestPointsShare, careerStats.pointsShare, { name: teamName, value: careerStats.pointsShare, ownerId });
                updateLowestRecord(lowestPointsShare, careerStats.pointsShare, { name: teamName, value: careerStats.pointsShare, ownerId });
            }
            if (careerStats.totalGames > 0) {
                updateRecord(mostWins, careerStats.wins, { name: teamName, value: careerStats.wins, ownerId });
                updateRecord(mostLosses, careerStats.losses, { name: teamName, value: careerStats.losses, ownerId });
                updateRecord(bestWinPct, careerStats.winPercentage, { name: teamName, value: careerStats.winPercentage, ownerId });
                updateRecord(mostTotalPoints, careerStats.pointsFor, { name: teamName, value: careerStats.pointsFor, ownerId });
                updateRecord(mostPointsAgainst, careerStats.pointsAgainst, { name: teamName, value: careerStats.pointsAgainst, ownerId });
                updateRecord(mostBlowoutWins, careerStats.blowoutWins, { name: teamName, value: careerStats.blowoutWins, ownerId });
                updateRecord(mostBlowoutLosses, careerStats.blowoutLosses, { name: teamName, value: careerStats.blowoutLosses, ownerId });
                updateRecord(mostSlimWins, careerStats.slimWins, { name: teamName, value: careerStats.slimWins, ownerId });
                updateRecord(mostSlimLosses, careerStats.slimLosses, { name: teamName, value: careerStats.slimLosses, ownerId });
                updateRecord(mostWeeklyTop2Scores, careerStats.weeklyTop2ScoresCount, { name: teamName, value: careerStats.weeklyTop2ScoresCount, ownerId });
                updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: teamName, value: careerStats.topScoreWeeksCount, ownerId });
                updateRecord(bestAllPlayWinPct, careerStats.allPlayWinPercentage, { name: teamName, value: careerStats.allPlayWinPercentage, ownerId });
            }
            if (careerStats.highestPointsShare !== undefined && careerStats.highestPointsShare > 0)
                updateRecord(highestPointsShare, careerStats.highestPointsShare, { name: teamName, value: careerStats.highestPointsShare, ownerId });
            if (careerStats.lowestPointsShare !== undefined && careerStats.lowestPointsShare < 100)
                updateLowestRecord(lowestPointsShare, careerStats.lowestPointsShare, { name: teamName, value: careerStats.lowestPointsShare, ownerId });
            updateRecord(mostPointsChampionships, careerStats.mostPointsTitles || 0, { name: teamName, value: careerStats.mostPointsTitles || 0, ownerId });
            updateRecord(mostRegularSeasonTitles, careerStats.regularSeasonTitles || 0, { name: teamName, value: careerStats.regularSeasonTitles || 0, ownerId });
            let winningSeasonsCount = 0, losingSeasonsCount = 0;
            Object.keys(seasonalMetrics).forEach(year => {
                const teamsInSeason = Object.values(seasonalMetrics[year]);
                const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                    if (currentOwnerTeamInSeason.winPercentage > 0.5) winningSeasonsCount++;
                    else if (currentOwnerTeamInSeason.winPercentage < 0.5) losingSeasonsCount++;
                }
            });
            updateRecord(mostWinningSeasons, winningSeasonsCount, { name: teamName, value: winningSeasonsCount, ownerId });
            updateRecord(mostLosingSeasons, losingSeasonsCount, { name: teamName, value: losingSeasonsCount, ownerId });
        });

        if (transactionTotals && transactionTotals.length > 0) {
            logger.debug("LeagueRecords (allTimeRecords): Using transactionTotals for trade/waiver records");
            const sortedTrades = [...transactionTotals].sort((a, b) => b.trades - a.trades);
            const sortedWaivers = [...transactionTotals].sort((a, b) => b.pickups - a.pickups);
            mostTrades.value = sortedTrades[0]?.trades || 0;
            mostTrades.teams = sortedTrades.filter(t => t.trades === mostTrades.value).map(t => ({ name: t.teamName, value: t.trades, ownerId: t.ownerId }));
            mostWaivers.value = sortedWaivers[0]?.pickups || 0;
            mostWaivers.teams = sortedWaivers.filter(t => t.pickups === mostWaivers.value).map(t => ({ name: t.teamName, value: t.pickups, ownerId: t.ownerId }));
            logger.debug("LeagueRecords: mostTrades record:", mostTrades);
            logger.debug("LeagueRecords: mostWaivers record:", mostWaivers);
        } else {
            logger.warn("LeagueRecords (allTimeRecords): No transactionTotals, using fallback career data");
            calculatedCareerDPRs.forEach(careerStats => {
                const teamName = careerStats.teamName;
                const ownerId = careerStats.ownerId;
                updateRecord(mostTrades, careerStats.careerTradeFees || 0, { name: teamName, value: careerStats.careerTradeFees || 0, ownerId });
                updateRecord(mostWaivers, careerStats.careerWaiverFees || 0, { name: teamName, value: careerStats.careerWaiverFees || 0, ownerId });
            });
        }

        setAllTimeRecords({ highestDPR, lowestDPR, bestLuck, worstLuck, mostWins, mostLosses, bestWinPct, bestAllPlayWinPct, mostWeeklyHighScores, mostWeeklyTop2Scores, mostWinningSeasons, mostLosingSeasons, mostBlowoutWins, mostBlowoutLosses, mostSlimWins, mostSlimLosses, mostTotalPoints, mostPointsAgainst, mostTrades, mostWaivers, highestPointsShare, lowestPointsShare, mostPointsChampionships, mostRegularSeasonTitles });
    };

    useEffect(() => {
        setIsLoading(true);
        if (loading || error || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0 || !nflState) {
            setAllTimeRecords({}); setRecordHistory({}); setIsLoading(false); return;
        }
        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
            const history = calculateRecordHistory(seasonalMetrics);
            setRecordHistory(history);
            setLoadingFinancial(true);
            const allYears = Object.keys(historicalData.matchupsBySeason || {});
            const finishCalculations = (financialData = {}) => {
                logger.debug("League Records: Processing with financial data for", Object.keys(financialData).length, "years");
                setFinancialDataByYear(financialData);
                setLoadingFinancial(false);
                setComputedCareerDPRs(calculatedCareerDPRs);
                setComputedSeasonalMetrics(seasonalMetrics);
                setComputedFinancialData(financialData);
                doAllCalculations(calculatedCareerDPRs, seasonalMetrics, financialData);
                setIsLoading(false);
            };
            if (allYears.length > 0) {
                fetchFinancialDataForYears(allYears).then(finishCalculations).catch(financialError => { logger.warn("Could not load financial data:", financialError); finishCalculations({}); });
            } else { finishCalculations({}); }
        } catch (error) {
            logger.error("Error calculating league records:", error);
            setAllTimeRecords({}); setRecordHistory({}); setIsLoading(false);
        }
    }, [historicalData, allDraftHistory, getTeamName, loading, error, nflState]);

    useEffect(() => {
        // Expose for debugging
        try {
            window.__leagueRecordsDebug = {
                transactionTotals,
                allTimeRecords,
                topFiveRankings
            };
        } catch (e) {}
    }, [transactionTotals, allTimeRecords, topFiveRankings]);

    useEffect(() => {
        if (computedCareerDPRs && computedSeasonalMetrics) {
            logger.debug("LeagueRecords: Re-running calculations with transactionTotals update:", transactionTotals);
            doAllCalculations(computedCareerDPRs, computedSeasonalMetrics, computedFinancialData || {});
        }
    }, [transactionTotals]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading all-time league records…</p>
                </div>
            </div>
        );
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm text-gray-500">No historical data available to calculate all-time records.</p>
            </div>
        );
    }

    const getDisplayTeamName = (team) => {
        if (team.ownerId) return getTeamName(team.ownerId, null);
        if (team.rosterId && team.year) {
            const rosterForYear = historicalData.rostersBySeason?.[team.year]?.find(r => String(r.roster_id) === String(team.rosterId));
            if (rosterForYear?.owner_id) return getTeamName(rosterForYear.owner_id, null);
        }
        return 'Unknown Team';
    };

    const formatRecordValue = (key, value) => {
        const config = formatConfig[key] || { decimals: 2, type: 'default' };
        if (config.type === 'percentage')
            return (value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%';
        return value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals });
    };

    const humanLabel = (key) => {
        const label = key.replace(/([A-Z])/g, ' $1').trim();
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    // Medal colors for top-5 rank badges
    const rankBadgeClass = (idx) => {
        if (idx === 0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        if (idx === 1) return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
        if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
        return 'bg-white/5 text-gray-500 border-white/10';
    };

    const calculateRank = (items, currentIndex) => {
        if (currentIndex === 0) return 1;
        // Walk backwards to find the first different value
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (items[i].value !== items[currentIndex].value) {
                return i + 2; // i+1 for 1-indexing, +1 for next position
            }
        }
        return 1; // All items up to current have same value
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-1">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All-Time Career Records</span>
            </div>

            {/* ── Mobile: stacked cards ── */}
            <div className="sm:hidden space-y-1.5 pt-2">
                {Object.entries(allTimeRecords).map(([key, record]) => {
                    const label = humanLabel(key);
                    const topFiveData = topFiveRankings[key] || [];
                    const isExpanded = !!expandedSections[key];
                    const hasData = record && record.value !== -Infinity && record.value !== Infinity && record.teams?.length > 0;

                    return (
                        <div key={key} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                {/* Label */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-300 leading-tight">{label}</div>
                                    {hasData && (
                                        <div className="text-[10px] text-gray-500 mt-0.5 space-y-1">
                                            {record.teams.map((t, idx) => (
                                                <div key={idx}>{getDisplayTeamName(t)}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Value badge */}
                                {hasData ? (
                                    <div className="flex-shrink-0 px-2.5 py-1 bg-blue-500/15 border border-blue-500/25 rounded-lg">
                                        <span className="text-xs font-bold text-blue-300 tabular-nums whitespace-nowrap">
                                            {formatRecordValue(key, record.value)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-gray-600 italic flex-shrink-0">No data</span>
                                )}

                                {/* Expand chevron */}
                                {topFiveData.length > 0 && (
                                    <button
                                        onClick={() => toggleSection(key)}
                                        className="flex-shrink-0 p-1 rounded-md text-gray-600 hover:text-gray-300 transition-colors"
                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${label}`}
                                    >
                                        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Top-5 expansion */}
                            {isExpanded && topFiveData.length > 0 && (
                                <div className="border-t border-white/8 px-3 py-2.5 space-y-1.5 bg-black/20">
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5</div>
                                    {topFiveData.map((team, idx) => {
                                        const rank = calculateRank(topFiveData, idx);
                                        return (
                                        <div key={idx} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(rank - 1)}`}>
                                                    {rank}
                                                </span>
                                                <span className="text-xs text-gray-300 truncate">{team.name}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-gray-400 tabular-nums flex-shrink-0">
                                                {formatRecordValue(key, team.value)}
                                            </span>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden sm:block pt-2">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[36%]">Record</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[20%]">Value</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[44%]">Holder(s)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {Object.entries(allTimeRecords).map(([key, record], idx) => {
                            const label = humanLabel(key);
                            const config = formatConfig[key] || { decimals: 2, type: 'default' };
                            const topFiveData = topFiveRankings[key] || [];
                            const isExpanded = !!expandedSections[key];
                            const hasData = record && record.value !== -Infinity && record.value !== Infinity && record.teams?.length > 0;

                            return (
                                <React.Fragment key={key}>
                                    <tr className={`hover:bg-white/[0.025] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                                        {/* Record name + expand toggle */}
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-200">{label}</span>
                                                {topFiveData.length > 0 && (
                                                    <button
                                                        onClick={() => toggleSection(key)}
                                                        className="text-gray-600 hover:text-blue-400 transition-colors"
                                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5`}
                                                    >
                                                        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* Value */}
                                        <td className="py-2.5 px-3 text-center">
                                            {hasData ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 font-bold text-blue-300 tabular-nums">
                                                    {formatRecordValue(key, record.value)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 italic text-[10px]">No data</span>
                                            )}
                                        </td>

                                        {/* Holder(s) */}
                                        <td className="py-2.5 px-3">
                                            {hasData ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {record.teams.map((team, i) => (
                                                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/8 border border-white/10 text-gray-200 text-xs font-medium">
                                                            {getDisplayTeamName(team)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-[10px] italic">—</span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Top-5 expansion row */}
                                    {isExpanded && topFiveData.length > 0 && (
                                        <tr className="bg-black/20 border-b border-white/8">
                                            <td colSpan={3} className="px-4 py-3">
                                                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5 Rankings</div>
                                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                    {topFiveData.map((team, i) => {
                                                        const rank = calculateRank(topFiveData, i);
                                                        return (
                                                        <div key={i} className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2">
                                                            <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(rank - 1)}`}>
                                                                {rank}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-xs font-medium text-gray-200 truncate">{team.name}</div>
                                                                <div className="text-[10px] text-gray-500 tabular-nums">
                                                                    {formatRecordValue(key, team.value)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeagueRecords;