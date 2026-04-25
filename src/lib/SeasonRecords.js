// src/lib/SeasonRecords.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { formatNumber } from '../utils/formatUtils';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateTeamTransactionCountsByOwnerId } from '../utils/financialCalculations';

const SeasonRecords = () => {
    const { processedSeasonalRecords, getTeamName, loading, error } = useSleeperData();

    const [seasonalHighlights, setSeasonalHighlights] = useState(() => ({
        mostWinsSeason: { value: -Infinity, entries: [], key: 'wins' },
        mostLossesSeason: { value: -Infinity, entries: [], key: 'losses' },
        bestWinPctSeason: { value: -Infinity, entries: [], key: 'winPercentage' },
        bestAllPlayWinPctSeason: { value: -Infinity, entries: [], key: 'allPlayWinPercentage' },
        mostWeeklyHighScoresSeason: { value: -Infinity, entries: [], key: 'topScoreWeeksCount' },
        mostWeeklyTop2ScoresSeason: { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' },
        mostBlowoutWinsSeason: { value: -Infinity, entries: [], key: 'blowoutWins' },
        mostBlowoutLossesSeason: { value: -Infinity, entries: [], key: 'blowoutLosses' },
        mostSlimWinsSeason: { value: -Infinity, entries: [], key: 'slimWins' },
        mostSlimLossesSeason: { value: -Infinity, entries: [], key: 'slimLosses' },
        mostPointsSeason: { value: -Infinity, entries: [], key: 'mostPointsFor' },
        fewestPointsSeason: { value: Infinity, entries: [], key: 'fewestPointsFor' },
        bestLuckRatingSeason: { value: -Infinity, entries: [], key: 'bestLuckRating' },
        worstLuckRatingSeason: { value: Infinity, entries: [], key: 'worstLuckRating' },
        highestDPRSeason: { value: -Infinity, entries: [], key: 'highestDPR' },
        lowestDPRSeason: { value: Infinity, entries: [], key: 'lowestDPR' },
        mostTradesSeason: { value: -Infinity, entries: [], key: 'tradeCount' },
        mostWaiversSeason: { value: -Infinity, entries: [], key: 'waiverCount' },
        highestPointsShareSeason: { value: -Infinity, entries: [], key: 'seasonalHighestPointsShare' },
        lowestPointsShareSeason: { value: Infinity, entries: [], key: 'seasonalLowestPointsShare' },
    }));

    const [expandedSections, setExpandedSections] = useState({});
    const [allSeasonData, setAllSeasonData] = useState({});
    const [financialDataByYear, setFinancialDataByYear] = useState({});
    const [loadingFinancial, setLoadingFinancial] = useState(false);

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const formatConfig = {
        adjustedDPR: { decimals: 3, type: 'decimal' },
        wins: { decimals: 0, type: 'count' },
        losses: { decimals: 0, type: 'count' },
        ties: { decimals: 0, type: 'count' },
        pointsFor: { decimals: 2, type: 'points' },
        pointsAgainst: { decimals: 2, type: 'points' },
        averageScore: { decimals: 2, type: 'points' },
        winPercentage: { decimals: 3, type: 'percentage' },
        allPlayWinPercentage: { decimals: 3, type: 'percentage' },
        topScoreWeeksCount: { decimals: 0, type: 'count' },
        blowoutWins: { decimals: 0, type: 'count' },
        blowoutLosses: { decimals: 0, type: 'count' },
        slimWins: { decimals: 0, type: 'count' },
        slimLosses: { decimals: 0, type: 'count' },
        weeklyTop2ScoresCount: { decimals: 0, type: 'count' },
        luckRating: { decimals: 2, type: 'decimal' },
        tradeCount: { decimals: 0, type: 'count' },
        waiverCount: { decimals: 0, type: 'count' },
        seasonalHighestPointsShare: { decimals: 2, type: 'percentage' },
        seasonalLowestPointsShare: { decimals: 2, type: 'percentage' },
    };

    const getRecordLabel = (recordKey, recordInstance) => {
        if (recordKey === 'bestLuckRating' || recordKey === 'worstLuckRating')
            return recordInstance.value > 0 ? 'Best Luck Rating' : 'Worst Luck Rating';
        if (recordKey === 'mostPointsFor') return 'Most Points For';
        if (recordKey === 'fewestPointsFor') return 'Least Points For';
        if (recordKey === 'highestDPR') return 'Highest Season DPR';
        if (recordKey === 'lowestDPR') return 'Lowest Season DPR';
        if (recordKey === 'tradeCount') return 'Most Trades in a Season';
        if (recordKey === 'waiverCount') return 'Most FA/Waivers in a Season';
        if (recordKey === 'seasonalHighestPointsShare') return 'Highest Points Share';
        if (recordKey === 'seasonalLowestPointsShare') return 'Lowest Points Share';
        const cleanedKey = recordKey.replace(/Season$/, '').replace(/([A-Z])/g, ' $1').trim();
        return cleanedKey.charAt(0).toUpperCase() + cleanedKey.slice(1);
    };

    // ── All logic untouched ───────────────────────────────────────────────────
    useEffect(() => {
        if (loading || error || !processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
            setSeasonalHighlights({
                highestDPRSeason: { value: -Infinity, entries: [], key: 'highestDPR' },
                lowestDPRSeason: { value: Infinity, entries: [], key: 'lowestDPR' },
                mostWinsSeason: { value: -Infinity, entries: [], key: 'wins' },
                mostLossesSeason: { value: -Infinity, entries: [], key: 'losses' },
                bestWinPctSeason: { value: -Infinity, entries: [], key: 'winPercentage' },
                bestAllPlayWinPctSeason: { value: -Infinity, entries: [], key: 'allPlayWinPercentage' },
                mostWeeklyHighScoresSeason: { value: -Infinity, entries: [], key: 'topScoreWeeksCount' },
                mostWeeklyTop2ScoresSeason: { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' },
                mostBlowoutWinsSeason: { value: -Infinity, entries: [], key: 'blowoutWins' },
                mostBlowoutLossesSeason: { value: -Infinity, entries: [], key: 'blowoutLosses' },
                mostSlimWinsSeason: { value: -Infinity, entries: [], key: 'slimWins' },
                mostSlimLossesSeason: { value: -Infinity, entries: [], key: 'slimLosses' },
                mostPointsSeason: { value: -Infinity, entries: [], key: 'mostPointsFor' },
                fewestPointsSeason: { value: Infinity, entries: [], key: 'fewestPointsFor' },
                bestLuckRatingSeason: { value: -Infinity, entries: [], key: 'bestLuckRating' },
                worstLuckRatingSeason: { value: Infinity, entries: [], key: 'worstLuckRating' },
                mostTradesSeason: { value: -Infinity, entries: [], key: 'tradeCount' },
                mostWaiversSeason: { value: -Infinity, entries: [], key: 'waiverCount' },
                highestPointsShareSeason: { value: -Infinity, entries: [], key: 'seasonalHighestPointsShare' },
                lowestPointsShareSeason: { value: Infinity, entries: [], key: 'seasonalLowestPointsShare' },
            });
            setAllSeasonData({});
            return;
        }

        const tempAllSeasonData = {
            mostWinsSeason: [], mostLossesSeason: [], bestWinPctSeason: [], bestAllPlayWinPctSeason: [],
            mostWeeklyHighScoresSeason: [], mostWeeklyTop2ScoresSeason: [], mostBlowoutWinsSeason: [],
            mostBlowoutLossesSeason: [], mostSlimWinsSeason: [], mostSlimLossesSeason: [],
            mostPointsSeason: [], fewestPointsSeason: [], bestLuckRatingSeason: [], worstLuckRatingSeason: [],
            highestDPRSeason: [], lowestDPRSeason: [], mostTradesSeason: [], mostWaiversSeason: [],
            highestPointsShareSeason: [], lowestPointsShareSeason: []
        };

        const addToAllSeasonData = (recordKey, value, teamInfo) => {
            if (typeof value === 'number' && !isNaN(value) && tempAllSeasonData[recordKey])
                tempAllSeasonData[recordKey].push({ ...teamInfo, value });
        };

        const historicalRecords = processedSeasonalRecords;

        let currentHighestDPRSeason = { value: -Infinity, entries: [], key: 'highestDPR' };
        let currentLowestDPRSeason = { value: Infinity, entries: [], key: 'lowestDPR' };
        let currentMostWinsSeason = { value: -Infinity, entries: [], key: 'wins' };
        let currentMostLossesSeason = { value: -Infinity, entries: [], key: 'losses' };
        let currentBestWinPctSeason = { value: -Infinity, entries: [], key: 'winPercentage' };
        let currentBestAllPlayWinPctSeason = { value: -Infinity, entries: [], key: 'allPlayWinPercentage' };
        let currentMostWeeklyHighScoresSeason = { value: -Infinity, entries: [], key: 'topScoreWeeksCount' };
        let currentMostWeeklyTop2ScoresSeason = { value: -Infinity, entries: [], key: 'weeklyTop2ScoresCount' };
        let currentMostBlowoutWinsSeason = { value: -Infinity, entries: [], key: 'blowoutWins' };
        let currentMostBlowoutLossesSeason = { value: -Infinity, entries: [], key: 'blowoutLosses' };
        let currentMostSlimWinsSeason = { value: -Infinity, entries: [], key: 'slimWins' };
        let currentMostSlimLossesSeason = { value: Infinity, entries: [], key: 'slimLosses' };
        let currentMostPointsSeason = { value: -Infinity, entries: [], key: 'mostPointsFor' };
        let currentFewestPointsSeason = { value: Infinity, entries: [], key: 'fewestPointsFor' };
        let currentBestLuckRatingSeason = { value: -Infinity, entries: [], key: 'bestLuckRating' };
        let currentWorstLuckRatingSeason = { value: Infinity, entries: [], key: 'worstLuckRating' };
        let currentMostTradesSeason = { value: -Infinity, entries: [], key: 'tradeCount' };
        let currentMostWaiversSeason = { value: -Infinity, entries: [], key: 'waiverCount' };
        let currentHighestPointsShareSeason = { value: -Infinity, entries: [], key: 'seasonalHighestPointsShare' };
        let currentLowestPointsShareSeason = { value: Infinity, entries: [], key: 'seasonalLowestPointsShare' };

        const updateRecord = (currentRecord, newValue, teamInfo, isMin = false) => {
            if (typeof newValue !== 'number' || isNaN(newValue)) return;
            if (isMin) {
                if (newValue < currentRecord.value) { currentRecord.value = newValue; currentRecord.entries = [teamInfo]; }
                else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year))
                        currentRecord.entries.push(teamInfo);
                }
            } else {
                if (newValue > currentRecord.value) { currentRecord.value = newValue; currentRecord.entries = [teamInfo]; }
                else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year))
                        currentRecord.entries.push(teamInfo);
                }
            }
        };

        setLoadingFinancial(true);
        const allYears = Object.keys(historicalRecords);

        const finishCalculationsWithFinancialData = (financialData = {}) => {
            logger.debug("Season Records: Processing with financial data for", Object.keys(financialData).length, "years");
            setFinancialDataByYear(financialData);
            setLoadingFinancial(false);

            Object.keys(historicalRecords).forEach(year => {
                const teamsInSeasonObject = historicalRecords[year];
                if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') return;
                const teamsInSeason = Object.values(teamsInSeasonObject);

                teamsInSeason.forEach(teamStats => {
                    if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) return;
                    if (teamStats.totalGames === 0) return;

                    const baseEntry = {
                        teamName: getTeamName(teamStats.ownerId, year),
                        year, ownerId: teamStats.ownerId, rosterId: teamStats.rosterId,
                    };

                    if (financialData[year] && financialData[year].transactions) {
                        const transactionCounts = calculateTeamTransactionCountsByOwnerId(financialData[year].transactions, teamStats.ownerId);
                        const tradeCount = transactionCounts.tradeFees;
                        const waiverCount = transactionCounts.waiverFees;
                        if (typeof tradeCount === 'number' && tradeCount >= 0) {
                            updateRecord(currentMostTradesSeason, tradeCount, { ...baseEntry, value: tradeCount });
                            addToAllSeasonData('mostTradesSeason', tradeCount, { ...baseEntry, value: tradeCount });
                        }
                        if (typeof waiverCount === 'number' && waiverCount >= 0) {
                            updateRecord(currentMostWaiversSeason, waiverCount, { ...baseEntry, value: waiverCount });
                            addToAllSeasonData('mostWaiversSeason', waiverCount, { ...baseEntry, value: waiverCount });
                        }
                    }
                    if (typeof teamStats.wins === 'number') { updateRecord(currentMostWinsSeason, teamStats.wins, { ...baseEntry, value: teamStats.wins }); addToAllSeasonData('mostWinsSeason', teamStats.wins, { ...baseEntry, value: teamStats.wins }); }
                    if (typeof teamStats.losses === 'number') { updateRecord(currentMostLossesSeason, teamStats.losses, { ...baseEntry, value: teamStats.losses }); addToAllSeasonData('mostLossesSeason', teamStats.losses, { ...baseEntry, value: teamStats.losses }); }
                    if (typeof teamStats.winPercentage === 'number') { updateRecord(currentBestWinPctSeason, teamStats.winPercentage, { ...baseEntry, value: teamStats.winPercentage }); addToAllSeasonData('bestWinPctSeason', teamStats.winPercentage, { ...baseEntry, value: teamStats.winPercentage }); }
                    if (typeof teamStats.allPlayWinPercentage === 'number') { updateRecord(currentBestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...baseEntry, value: teamStats.allPlayWinPercentage }); addToAllSeasonData('bestAllPlayWinPctSeason', teamStats.allPlayWinPercentage, { ...baseEntry, value: teamStats.allPlayWinPercentage }); }
                    if (typeof teamStats.topScoreWeeksCount === 'number') { updateRecord(currentMostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...baseEntry, value: teamStats.topScoreWeeksCount }); addToAllSeasonData('mostWeeklyHighScoresSeason', teamStats.topScoreWeeksCount, { ...baseEntry, value: teamStats.topScoreWeeksCount }); }
                    if (typeof teamStats.weeklyTop2ScoresCount === 'number') { updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...baseEntry, value: teamStats.weeklyTop2ScoresCount }); addToAllSeasonData('mostWeeklyTop2ScoresSeason', teamStats.weeklyTop2ScoresCount, { ...baseEntry, value: teamStats.weeklyTop2ScoresCount }); }
                    if (typeof teamStats.blowoutWins === 'number') { updateRecord(currentMostBlowoutWinsSeason, teamStats.blowoutWins, { ...baseEntry, value: teamStats.blowoutWins }); addToAllSeasonData('mostBlowoutWinsSeason', teamStats.blowoutWins, { ...baseEntry, value: teamStats.blowoutWins }); }
                    if (typeof teamStats.blowoutLosses === 'number') { updateRecord(currentMostBlowoutLossesSeason, teamStats.blowoutLosses, { ...baseEntry, value: teamStats.blowoutLosses }); addToAllSeasonData('mostBlowoutLossesSeason', teamStats.blowoutLosses, { ...baseEntry, value: teamStats.blowoutLosses }); }
                    if (typeof teamStats.slimWins === 'number') { updateRecord(currentMostSlimWinsSeason, teamStats.slimWins, { ...baseEntry, value: teamStats.slimWins }); addToAllSeasonData('mostSlimWinsSeason', teamStats.slimWins, { ...baseEntry, value: teamStats.slimWins }); }
                    if (typeof teamStats.slimLosses === 'number') { updateRecord(currentMostSlimLossesSeason, teamStats.slimLosses, { ...baseEntry, value: teamStats.slimLosses }); addToAllSeasonData('mostSlimLossesSeason', teamStats.slimLosses, { ...baseEntry, value: teamStats.slimLosses }); }
                    if (typeof teamStats.pointsFor === 'number') {
                        updateRecord(currentMostPointsSeason, teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor });
                        updateRecord(currentFewestPointsSeason, teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor }, true);
                        addToAllSeasonData('mostPointsSeason', teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor });
                        addToAllSeasonData('fewestPointsSeason', teamStats.pointsFor, { ...baseEntry, value: teamStats.pointsFor });
                    }
                    if (typeof teamStats.luckRating === 'number' && !isNaN(teamStats.luckRating)) {
                        updateRecord(currentBestLuckRatingSeason, teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating });
                        updateRecord(currentWorstLuckRatingSeason, teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating }, true);
                        addToAllSeasonData('bestLuckRatingSeason', teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating });
                        addToAllSeasonData('worstLuckRatingSeason', teamStats.luckRating, { ...baseEntry, value: teamStats.luckRating });
                    }
                    if (typeof teamStats.adjustedDPR === 'number' && !isNaN(teamStats.adjustedDPR)) {
                        updateRecord(currentHighestDPRSeason, teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR });
                        updateRecord(currentLowestDPRSeason, teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR }, true);
                        addToAllSeasonData('highestDPRSeason', teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR });
                        addToAllSeasonData('lowestDPRSeason', teamStats.adjustedDPR, { ...baseEntry, value: teamStats.adjustedDPR });
                    }
                    if (typeof teamStats.seasonalPointsShare === 'number' && !isNaN(teamStats.seasonalPointsShare)) {
                        addToAllSeasonData('highestPointsShareSeason', teamStats.seasonalPointsShare, { ...baseEntry, value: teamStats.seasonalPointsShare });
                        addToAllSeasonData('lowestPointsShareSeason', teamStats.seasonalPointsShare, { ...baseEntry, value: teamStats.seasonalPointsShare });
                    }
                    if (typeof teamStats.seasonalHighestPointsShare === 'number' && !isNaN(teamStats.seasonalHighestPointsShare))
                        updateRecord(currentHighestPointsShareSeason, teamStats.seasonalHighestPointsShare, { ...baseEntry, value: teamStats.seasonalHighestPointsShare });
                    if (typeof teamStats.seasonalLowestPointsShare === 'number' && !isNaN(teamStats.seasonalLowestPointsShare))
                        updateRecord(currentLowestPointsShareSeason, teamStats.seasonalLowestPointsShare, { ...baseEntry, value: teamStats.seasonalLowestPointsShare }, true);
                });
            });

            [currentMostWinsSeason, currentMostLossesSeason, currentBestWinPctSeason, currentBestAllPlayWinPctSeason,
             currentMostWeeklyHighScoresSeason, currentMostWeeklyTop2ScoresSeason, currentMostBlowoutWinsSeason,
             currentMostBlowoutLossesSeason, currentMostSlimWinsSeason, currentMostSlimLossesSeason,
             currentMostPointsSeason, currentFewestPointsSeason, currentBestLuckRatingSeason, currentWorstLuckRatingSeason,
             currentHighestDPRSeason, currentLowestDPRSeason, currentMostTradesSeason, currentMostWaiversSeason,
             currentHighestPointsShareSeason, currentLowestPointsShareSeason].forEach(record => {
                if (record && record.entries.length > 1) {
                    record.entries.sort((a, b) => {
                        if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
                        return (a.teamName || '').localeCompare(b.teamName || '');
                    });
                }
            });

            setSeasonalHighlights({
                mostWinsSeason: currentMostWinsSeason, mostLossesSeason: currentMostLossesSeason,
                bestWinPctSeason: currentBestWinPctSeason, bestAllPlayWinPctSeason: currentBestAllPlayWinPctSeason,
                mostWeeklyHighScoresSeason: currentMostWeeklyHighScoresSeason, mostWeeklyTop2ScoresSeason: currentMostWeeklyTop2ScoresSeason,
                mostBlowoutWinsSeason: currentMostBlowoutWinsSeason, mostBlowoutLossesSeason: currentMostBlowoutLossesSeason,
                mostSlimWinsSeason: currentMostSlimWinsSeason, mostSlimLossesSeason: currentMostSlimLossesSeason,
                mostPointsSeason: currentMostPointsSeason, fewestPointsSeason: currentFewestPointsSeason,
                bestLuckRatingSeason: currentBestLuckRatingSeason, worstLuckRatingSeason: currentWorstLuckRatingSeason,
                highestDPRSeason: currentHighestDPRSeason, lowestDPRSeason: currentLowestDPRSeason,
                mostTradesSeason: currentMostTradesSeason, mostWaiversSeason: currentMostWaiversSeason,
                highestPointsShareSeason: currentHighestPointsShareSeason, lowestPointsShareSeason: currentLowestPointsShareSeason,
            });

            logger.debug("Season Records - Final transaction counts:");
            logger.debug("Most Trades Season:", currentMostTradesSeason);
            logger.debug("Most Waivers Season:", currentMostWaiversSeason);

            setAllSeasonData(tempAllSeasonData);
        };

        if (allYears.length > 0) {
            fetchFinancialDataForYears(allYears)
                .then(finishCalculationsWithFinancialData)
                .catch(financialError => {
                    logger.warn("Could not load financial data for Season Records transaction counts:", financialError);
                    finishCalculationsWithFinancialData({});
                });
        } else {
            finishCalculationsWithFinancialData({});
        }
    }, [processedSeasonalRecords, getTeamName, loading, error]);

    // ── Loading / error ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading seasonal records…</p>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400">Error loading seasonal data: {error.message}</p>
            </div>
        );
    }
    if (!processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-sm text-gray-500">No seasonal data available to display.</p>
            </div>
        );
    }

    const highlightRecords = [
        seasonalHighlights.mostWinsSeason, seasonalHighlights.mostLossesSeason,
        seasonalHighlights.bestWinPctSeason, seasonalHighlights.bestAllPlayWinPctSeason,
        seasonalHighlights.mostWeeklyHighScoresSeason, seasonalHighlights.mostWeeklyTop2ScoresSeason,
        seasonalHighlights.mostBlowoutWinsSeason, seasonalHighlights.mostBlowoutLossesSeason,
        seasonalHighlights.mostSlimWinsSeason, seasonalHighlights.mostSlimLossesSeason,
        seasonalHighlights.mostPointsSeason, seasonalHighlights.fewestPointsSeason,
        seasonalHighlights.bestLuckRatingSeason, seasonalHighlights.worstLuckRatingSeason,
        seasonalHighlights.highestDPRSeason, seasonalHighlights.lowestDPRSeason,
        seasonalHighlights.mostTradesSeason, seasonalHighlights.mostWaiversSeason,
        seasonalHighlights.highestPointsShareSeason, seasonalHighlights.lowestPointsShareSeason,
    ].filter(r => r && r.value !== -Infinity && r.value !== Infinity && r.entries?.length > 0);

    // ── Shared value formatter ────────────────────────────────────────────────
    const fmtValue = (recordKey, value) => {
        if (typeof value !== 'number') return '—';
        if (['wins','losses','topScoreWeeksCount','weeklyTop2ScoresCount','blowoutWins','blowoutLosses','slimWins','slimLosses','tradeCount','waiverCount'].includes(recordKey))
            return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (['bestLuckRating','worstLuckRating','highestDPR','lowestDPR'].includes(recordKey))
            return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        if (recordKey === 'mostPointsFor' || recordKey === 'fewestPointsFor')
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (['winPercentage','allPlayWinPercentage','seasonalHighestPointsShare','seasonalLowestPointsShare'].includes(recordKey))
            return (value * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const KEY_MAP = {
        'wins': 'mostWinsSeason', 'losses': 'mostLossesSeason',
        'winPercentage': 'bestWinPctSeason', 'allPlayWinPercentage': 'bestAllPlayWinPctSeason',
        'topScoreWeeksCount': 'mostWeeklyHighScoresSeason', 'weeklyTop2ScoresCount': 'mostWeeklyTop2ScoresSeason',
        'blowoutWins': 'mostBlowoutWinsSeason', 'blowoutLosses': 'mostBlowoutLossesSeason',
        'slimWins': 'mostSlimWinsSeason', 'slimLosses': 'mostSlimLossesSeason',
        'mostPointsFor': 'mostPointsSeason', 'fewestPointsFor': 'fewestPointsSeason',
        'bestLuckRating': 'bestLuckRatingSeason', 'worstLuckRating': 'worstLuckRatingSeason',
        'highestDPR': 'highestDPRSeason', 'lowestDPR': 'lowestDPRSeason',
        'tradeCount': 'mostTradesSeason', 'waiverCount': 'mostWaiversSeason',
        'seasonalHighestPointsShare': 'highestPointsShareSeason', 'seasonalLowestPointsShare': 'lowestPointsShareSeason',
    };
    const MIN_RECORDS = new Set(['fewestPointsSeason','worstLuckRatingSeason','lowestDPRSeason','lowestPointsShareSeason']);

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

    const Top5Panel = ({ record }) => {
        const dataKey = KEY_MAP[record.key];
        if (!dataKey || !allSeasonData[dataKey]?.length) return null;
        const isMin = MIN_RECORDS.has(dataKey);
        const top5 = [...allSeasonData[dataKey]]
            .sort((a, b) => isMin ? a.value - b.value : b.value - a.value)
            .slice(0, 5);
        return (
            <div className="border-t border-white/8 px-3 py-3 bg-black/20 space-y-1.5">
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Top 5</div>
                {top5.map((sd, idx) => {
                    const rank = calculateRank(top5, idx);
                    return (
                    <div key={`${record.key}-t5-${sd.ownerId}-${sd.year}-${idx}`} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(rank - 1)}`}>
                                {rank}
                            </span>
                            <div className="min-w-0">
                                <span className="text-xs text-gray-300 truncate block">{sd.teamName || getTeamName(sd.ownerId, sd.year)}</span>
                                <span className="text-[10px] text-gray-600">{sd.year}</span>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-400 tabular-nums flex-shrink-0">
                            {fmtValue(record.key, sd.value)}
                        </span>
                    </div>
                    );
                })}
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-1">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Single-Season Records</span>
            </div>

            {/* ── Mobile: stacked cards ── */}
            <div className="sm:hidden space-y-1.5 pt-2">
                {highlightRecords.map((record) => {
                    const primary = record.entries[0];
                    const label = getRecordLabel(record.key, record);
                    const isExpanded = !!expandedSections[record.key];
                    const dataKey = KEY_MAP[record.key];
                    const hasTop5 = dataKey && allSeasonData[dataKey]?.length > 0;

                    return (
                        <div key={record.key} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-300 leading-tight">{label}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5 space-y-1">
                                        {record.entries.map((entry) => {
                                            const teamName = entry.teamName || getTeamName(entry.ownerId, entry.year);
                                            return (
                                                <div key={`${entry.ownerId}-${entry.year}`}>
                                                    <span className="font-medium">{teamName}</span>
                                                    {entry.year && <span className="text-gray-600"> · {entry.year}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex-shrink-0 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-lg">
                                    <span className="text-xs font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                                        {fmtValue(record.key, primary.value)}
                                    </span>
                                </div>
                                {hasTop5 && (
                                    <button
                                        onClick={() => toggleSection(record.key)}
                                        className="flex-shrink-0 p-1 rounded-md text-gray-600 hover:text-gray-300 transition-colors"
                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${label}`}
                                    >
                                        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {isExpanded && <Top5Panel record={record} />}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden sm:block pt-2">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[34%]">Record</th>
                            <th className="py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[18%]">Value</th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[48%]">Team · Season</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {highlightRecords.map((record, ri) => {
                            const isExpanded = !!expandedSections[record.key];
                            const label = getRecordLabel(record.key, record);
                            const dataKey = KEY_MAP[record.key];
                            const hasTop5 = dataKey && allSeasonData[dataKey]?.length > 0;

                            return (
                                <React.Fragment key={record.key}>
                                    {(() => {
                                        const primary = record.entries[0];
                                        return (
                                            <tr className={`hover:bg-white/[0.025] transition-colors`}>
                                                {/* Record name */}
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-gray-200">{label}</span>
                                                        {hasTop5 && (
                                                            <button
                                                                onClick={() => toggleSection(record.key)}
                                                                className="text-gray-600 hover:text-emerald-400 transition-colors"
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
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 font-bold text-emerald-300 tabular-nums">
                                                        {fmtValue(record.key, primary.value)}
                                                    </span>
                                                </td>

                                                {/* Team + season - ALL tied teams */}
                                                <td className="py-2.5 px-3">
                                                    <div className="space-y-1.5">
                                                        {record.entries.map((entry) => {
                                                            const teamName = entry.teamName || getTeamName(entry.ownerId, entry.year);
                                                            return (
                                                                <div key={`${entry.ownerId}-${entry.year}`} className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/8 border border-white/10 text-gray-200 text-xs font-medium">
                                                                        {teamName}
                                                                    </span>
                                                                    {entry.year && (
                                                                        <span className="text-[10px] text-gray-600 tabular-nums">{entry.year}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })()}

                                    {/* Top-5 expansion */}
                                    {isExpanded && hasTop5 && (() => {
                                        const isMin = MIN_RECORDS.has(dataKey);
                                        const top5 = [...allSeasonData[dataKey]]
                                            .sort((a, b) => isMin ? a.value - b.value : b.value - a.value)
                                            .slice(0, 5);
                                        return (
                                            <tr className="bg-black/20 border-b border-white/8">
                                                <td colSpan={3} className="px-4 py-3">
                                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                        {top5.map((sd, idx) => {
                                                            const rank = calculateRank(top5, idx);
                                                            return (
                                                            <div key={`${record.key}-dt5-${sd.ownerId}-${sd.year}-${idx}`}
                                                                className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2">
                                                                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(rank - 1)}`}>
                                                                    {rank}
                                                                </span>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-medium text-gray-200 truncate">{sd.teamName || getTeamName(sd.ownerId, sd.year)}</div>
                                                                    <div className="text-[10px] text-gray-500 tabular-nums">
                                                                        {fmtValue(record.key, sd.value)} · {sd.year}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })()}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SeasonRecords;