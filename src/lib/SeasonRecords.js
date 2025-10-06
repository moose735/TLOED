// src/lib/SeasonRecords.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { formatNumber } from '../utils/formatUtils';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateTeamTransactionCountsByOwnerId } from '../utils/financialCalculations';

/**
 * Displays seasonal league records, including per-season standings and overall seasonal highlights.
 */
const SeasonRecords = () => {
    const { processedSeasonalRecords, getTeamName, loading, error } = useSleeperData();

    // State to hold the "seasonal highlights"
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

    // State for collapsible sections
    const [expandedSections, setExpandedSections] = useState({});
    const [allSeasonData, setAllSeasonData] = useState({});
    const [financialDataByYear, setFinancialDataByYear] = useState({});
    const [loadingFinancial, setLoadingFinancial] = useState(false);

    // Toggle function for expanding/collapsing sections
    const toggleSection = (key) => {
        setExpandedSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Configuration for number formatting per stat (similar to LeagueRecords)
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

    // Helper function to create a clean label from a record key
    const getRecordLabel = (recordKey, recordInstance) => {
        if (recordKey === 'bestLuckRating' || recordKey === 'worstLuckRating') {
            return recordInstance.value > 0 ? 'Best Luck Rating' : 'Worst Luck Rating';
        }
        if (recordKey === 'mostPointsFor' || recordKey === 'fewestPointsFor') {
            return recordInstance.value > 0 ? 'Most Points For' : 'Fewest Points For';
        }
        if (recordKey === 'highestDPR') {
            return 'Highest Season DPR';
        }
        if (recordKey === 'lowestDPR') {
            return 'Lowest Season DPR';
        }
        if (recordKey === 'tradeCount') {
            return 'Most Trades in a Season';
        }
        if (recordKey === 'waiverCount') {
            return 'Most FA/Waivers in a Season';
        }
        if (recordKey === 'seasonalHighestPointsShare') {
            return 'Highest Points Share';
        }
        if (recordKey === 'seasonalLowestPointsShare') {
            return 'Lowest Points Share';
        }
        const cleanedKey = recordKey
            .replace(/Season$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
        return cleanedKey.charAt(0).toUpperCase() + cleanedKey.slice(1);
    };

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

        // Initialize collection for all season data
        const tempAllSeasonData = {
            mostWinsSeason: [],
            mostLossesSeason: [],
            bestWinPctSeason: [],
            bestAllPlayWinPctSeason: [],
            mostWeeklyHighScoresSeason: [],
            mostWeeklyTop2ScoresSeason: [],
            mostBlowoutWinsSeason: [],
            mostBlowoutLossesSeason: [],
            mostSlimWinsSeason: [],
            mostSlimLossesSeason: [],
            mostPointsSeason: [],
            fewestPointsSeason: [],
            bestLuckRatingSeason: [],
            worstLuckRatingSeason: [],
            highestDPRSeason: [],
            lowestDPRSeason: [],
            mostTradesSeason: [],
            mostWaiversSeason: [],
            highestPointsShareSeason: [],
            lowestPointsShareSeason: []
        };

        // Helper function to add data to all season data collection
        const addToAllSeasonData = (recordKey, value, teamInfo) => {
            if (typeof value === 'number' && !isNaN(value) && tempAllSeasonData[recordKey]) {
                tempAllSeasonData[recordKey].push({
                    ...teamInfo,
                    value: value
                });
            }
        };

        // Get the current year to exclude it from the records
        const currentYear = new Date().getFullYear().toString();
        
        // Include all seasons (including current year for transaction counts)
        const historicalRecords = processedSeasonalRecords;

        // Initialize highlight records with extreme values for this run
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

        // Helper to update records (handles ties)
        const updateRecord = (currentRecord, newValue, teamInfo, isMin = false) => {
            if (typeof newValue !== 'number' || isNaN(newValue)) {
                return;
            }

            if (isMin) {
                if (newValue < currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.entries = [teamInfo];
                } else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year)) {
                        currentRecord.entries.push(teamInfo);
                    }
                }
            } else { // Max
                if (newValue > currentRecord.value) {
                    currentRecord.value = newValue;
                    currentRecord.entries = [teamInfo];
                } else if (newValue === currentRecord.value) {
                    if (!currentRecord.entries.some(e => e.rosterId === teamInfo.rosterId && e.year === teamInfo.year)) {
                        currentRecord.entries.push(teamInfo);
                    }
                }
            }
        };

        // Load financial data for transaction counts, then complete calculations
        setLoadingFinancial(true);
        const allYears = Object.keys(historicalRecords);
        
        const finishCalculationsWithFinancialData = (financialData = {}) => {
            logger.debug("Season Records: Processing with financial data for", Object.keys(financialData).length, "years");
            setFinancialDataByYear(financialData);
            setLoadingFinancial(false);
            
            // Process teams with financial data for transaction counts
            Object.keys(historicalRecords).forEach(year => {
                const teamsInSeasonObject = historicalRecords[year];
                if (!teamsInSeasonObject || typeof teamsInSeasonObject !== 'object') return;
                const teamsInSeason = Object.values(teamsInSeasonObject);
                
                teamsInSeason.forEach(teamStats => {
                    if (!teamStats || typeof teamStats !== 'object' || !teamStats.rosterId || !teamStats.ownerId) return;
                    if (teamStats.totalGames === 0) return;
                    
                    const baseEntry = {
                        teamName: getTeamName(teamStats.ownerId, year),
                        year,
                        ownerId: teamStats.ownerId,
                        rosterId: teamStats.rosterId,
                    };

                    // Calculate transaction counts for this team and year if financial data is available
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

                    // Regular stats (existing logic)
                    if (typeof teamStats.wins === 'number') {
                        updateRecord(currentMostWinsSeason, teamStats.wins, { ...baseEntry, value: teamStats.wins });
                        addToAllSeasonData('mostWinsSeason', teamStats.wins, { ...baseEntry, value: teamStats.wins });
                    }
                    if (typeof teamStats.losses === 'number') {
                        updateRecord(currentMostLossesSeason, teamStats.losses, { ...baseEntry, value: teamStats.losses });
                        addToAllSeasonData('mostLossesSeason', teamStats.losses, { ...baseEntry, value: teamStats.losses });
                    }
                    if (typeof teamStats.winPercentage === 'number') {
                        updateRecord(currentBestWinPctSeason, teamStats.winPercentage, { ...baseEntry, value: teamStats.winPercentage });
                        addToAllSeasonData('bestWinPctSeason', teamStats.winPercentage, { ...baseEntry, value: teamStats.winPercentage });
                    }
                    if (typeof teamStats.allPlayWinPercentage === 'number') {
                        updateRecord(currentBestAllPlayWinPctSeason, teamStats.allPlayWinPercentage, { ...baseEntry, value: teamStats.allPlayWinPercentage });
                        addToAllSeasonData('bestAllPlayWinPctSeason', teamStats.allPlayWinPercentage, { ...baseEntry, value: teamStats.allPlayWinPercentage });
                    }
                    if (typeof teamStats.topScoreWeeksCount === 'number') {
                        updateRecord(currentMostWeeklyHighScoresSeason, teamStats.topScoreWeeksCount, { ...baseEntry, value: teamStats.topScoreWeeksCount });
                        addToAllSeasonData('mostWeeklyHighScoresSeason', teamStats.topScoreWeeksCount, { ...baseEntry, value: teamStats.topScoreWeeksCount });
                    }
                    if (typeof teamStats.weeklyTop2ScoresCount === 'number') {
                        updateRecord(currentMostWeeklyTop2ScoresSeason, teamStats.weeklyTop2ScoresCount, { ...baseEntry, value: teamStats.weeklyTop2ScoresCount });
                        addToAllSeasonData('mostWeeklyTop2ScoresSeason', teamStats.weeklyTop2ScoresCount, { ...baseEntry, value: teamStats.weeklyTop2ScoresCount });
                    }
                    if (typeof teamStats.blowoutWins === 'number') {
                        updateRecord(currentMostBlowoutWinsSeason, teamStats.blowoutWins, { ...baseEntry, value: teamStats.blowoutWins });
                        addToAllSeasonData('mostBlowoutWinsSeason', teamStats.blowoutWins, { ...baseEntry, value: teamStats.blowoutWins });
                    }
                    if (typeof teamStats.blowoutLosses === 'number') {
                        updateRecord(currentMostBlowoutLossesSeason, teamStats.blowoutLosses, { ...baseEntry, value: teamStats.blowoutLosses });
                        addToAllSeasonData('mostBlowoutLossesSeason', teamStats.blowoutLosses, { ...baseEntry, value: teamStats.blowoutLosses });
                    }
                    if (typeof teamStats.slimWins === 'number') {
                        updateRecord(currentMostSlimWinsSeason, teamStats.slimWins, { ...baseEntry, value: teamStats.slimWins });
                        addToAllSeasonData('mostSlimWinsSeason', teamStats.slimWins, { ...baseEntry, value: teamStats.slimWins });
                    }
                    if (typeof teamStats.slimLosses === 'number') {
                        updateRecord(currentMostSlimLossesSeason, teamStats.slimLosses, { ...baseEntry, value: teamStats.slimLosses });
                        addToAllSeasonData('mostSlimLossesSeason', teamStats.slimLosses, { ...baseEntry, value: teamStats.slimLosses });
                    }
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
                    // Add all teams' seasonal points share data for Top 5 rankings
                    if (typeof teamStats.seasonalPointsShare === 'number' && !isNaN(teamStats.seasonalPointsShare)) {
                        addToAllSeasonData('highestPointsShareSeason', teamStats.seasonalPointsShare, { ...baseEntry, value: teamStats.seasonalPointsShare });
                        addToAllSeasonData('lowestPointsShareSeason', teamStats.seasonalPointsShare, { ...baseEntry, value: teamStats.seasonalPointsShare });
                    }
                    
                    // Update records only for teams that achieved season high/low
                    if (typeof teamStats.seasonalHighestPointsShare === 'number' && !isNaN(teamStats.seasonalHighestPointsShare)) {
                        updateRecord(currentHighestPointsShareSeason, teamStats.seasonalHighestPointsShare, { ...baseEntry, value: teamStats.seasonalHighestPointsShare });
                    }
                    if (typeof teamStats.seasonalLowestPointsShare === 'number' && !isNaN(teamStats.seasonalLowestPointsShare)) {
                        updateRecord(currentLowestPointsShareSeason, teamStats.seasonalLowestPointsShare, { ...baseEntry, value: teamStats.seasonalLowestPointsShare }, true);
                    }
                });
            });

            // Sort all record entries
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
                mostWinsSeason: currentMostWinsSeason,
                mostLossesSeason: currentMostLossesSeason,
                bestWinPctSeason: currentBestWinPctSeason,
                bestAllPlayWinPctSeason: currentBestAllPlayWinPctSeason,
                mostWeeklyHighScoresSeason: currentMostWeeklyHighScoresSeason,
                mostWeeklyTop2ScoresSeason: currentMostWeeklyTop2ScoresSeason,
                mostBlowoutWinsSeason: currentMostBlowoutWinsSeason,
                mostBlowoutLossesSeason: currentMostBlowoutLossesSeason,
                mostSlimWinsSeason: currentMostSlimWinsSeason,
                mostSlimLossesSeason: currentMostSlimLossesSeason,
                mostPointsSeason: currentMostPointsSeason,
                fewestPointsSeason: currentFewestPointsSeason,
                bestLuckRatingSeason: currentBestLuckRatingSeason,
                worstLuckRatingSeason: currentWorstLuckRatingSeason,
                highestDPRSeason: currentHighestDPRSeason,
                lowestDPRSeason: currentLowestDPRSeason,
                mostTradesSeason: currentMostTradesSeason,
                mostWaiversSeason: currentMostWaiversSeason,
                highestPointsShareSeason: currentHighestPointsShareSeason,
                lowestPointsShareSeason: currentLowestPointsShareSeason,
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

    if (loading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading seasonal records...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading seasonal data: {error.message}</div>;
    }

    if (!processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0) {
        return <div className="text-center py-8 text-gray-600">No seasonal data available to display.</div>;
    }

    const highlightRecords = [
        seasonalHighlights.mostWinsSeason,
        seasonalHighlights.mostLossesSeason,
        seasonalHighlights.bestWinPctSeason,
        seasonalHighlights.bestAllPlayWinPctSeason,
        seasonalHighlights.mostWeeklyHighScoresSeason,
        seasonalHighlights.mostWeeklyTop2ScoresSeason,
        seasonalHighlights.mostBlowoutWinsSeason,
        seasonalHighlights.mostBlowoutLossesSeason,
        seasonalHighlights.mostSlimWinsSeason,
        seasonalHighlights.mostSlimLossesSeason,
        seasonalHighlights.mostPointsSeason,
        seasonalHighlights.fewestPointsSeason,
        seasonalHighlights.bestLuckRatingSeason,
        seasonalHighlights.worstLuckRatingSeason,
        seasonalHighlights.highestDPRSeason,
        seasonalHighlights.lowestDPRSeason,
        seasonalHighlights.mostTradesSeason,
        seasonalHighlights.mostWaiversSeason,
        seasonalHighlights.highestPointsShareSeason,
        seasonalHighlights.lowestPointsShareSeason,
    ].filter(
        (record) => record && record.value !== -Infinity && record.value !== Infinity && record.entries && record.entries.length > 0
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        📅
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Season Records Highlights</h3>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Outstanding records achieved in a single season • Excludes current {new Date().getFullYear()} season
                        </p>
                    </div>
                </div>
            </div>

            {/* Records Table (mobile-first) */}

            {/* Mobile: compact card list */}
            <div className="space-y-3 sm:hidden">
                {highlightRecords.map((record) => {
                    if (!record || record.entries.length === 0) {
                        return null;
                    }

                    const primary = record.entries[0];
                    const recordLabel = getRecordLabel(record.key, record);
                    const teamDisplayName = primary.teamName || getTeamName(primary.ownerId, primary.year);
                    
                    let valueDisplay = '';
                    if (typeof primary.value === 'number') {
                        if ([
                            'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                            'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses', 'tradeCount', 'waiverCount'
                        ].includes(record.key)) {
                            valueDisplay = Math.round(primary.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                        } else if (['bestLuckRating', 'worstLuckRating', 'highestDPR', 'lowestDPR'].includes(record.key)) {
                            valueDisplay = primary.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                        } else if (record.key === 'mostPointsFor' || record.key === 'fewestPointsFor') {
                            valueDisplay = primary.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage' || record.key === 'seasonalHighestPointsShare' || record.key === 'seasonalLowestPointsShare') {
                            valueDisplay = (primary.value * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                        } else {
                            valueDisplay = primary.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                    }

                    return (
                        <div key={record.key} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="truncate">
                                            <div className="text-sm font-semibold text-gray-900 truncate">{recordLabel}</div>
                                            <div className="text-xs text-gray-600 truncate mt-1">
                                                <span className="font-medium">{teamDisplayName}</span>
                                                {primary.year && (
                                                    <span className="text-gray-500"> — {primary.year}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ml-3 flex items-center gap-3">
                                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-200">
                                                <span className="font-bold text-gray-900 text-sm">{valueDisplay}</span>
                                            </div>

                                            <button
                                                onClick={() => toggleSection(record.key)}
                                                aria-label={`${expandedSections[record.key] ? 'Hide' : 'Show'} top 5 for ${recordLabel}`}
                                                className="p-2 rounded-md hover:bg-gray-100"
                                            >
                                                <svg className={`w-5 h-5 text-gray-600 transition-transform ${expandedSections[record.key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expandable Top5 for mobile */}
                                    {expandedSections[record.key] && (() => {
                                        const keyMapping = {
                                            'wins': 'mostWinsSeason',
                                            'losses': 'mostLossesSeason', 
                                            'winPercentage': 'bestWinPctSeason',
                                            'allPlayWinPercentage': 'bestAllPlayWinPctSeason',
                                            'topScoreWeeksCount': 'mostWeeklyHighScoresSeason',
                                            'weeklyTop2ScoresCount': 'mostWeeklyTop2ScoresSeason',
                                            'blowoutWins': 'mostBlowoutWinsSeason',
                                            'blowoutLosses': 'mostBlowoutLossesSeason',
                                            'slimWins': 'mostSlimWinsSeason',
                                            'slimLosses': 'mostSlimLossesSeason',
                                            'pointsFor': record.value > 0 ? 'mostPointsSeason' : 'fewestPointsSeason',
                                            'luckRating': record.value > 0 ? 'bestLuckRatingSeason' : 'worstLuckRatingSeason',
                                            'highestDPR': 'highestDPRSeason',
                                            'lowestDPR': 'lowestDPRSeason',
                                            'tradeCount': 'mostTradesSeason',
                                            'waiverCount': 'mostWaiversSeason',
                                            'seasonalHighestPointsShare': 'highestPointsShareSeason',
                                            'seasonalLowestPointsShare': 'lowestPointsShareSeason'
                                        };
                                        const dataKey = keyMapping[record.key];
                                        return dataKey && allSeasonData[dataKey] && allSeasonData[dataKey].length > 0;
                                    })() && (
                                        <div className="mt-3 space-y-2">
                                            {(() => {
                                                const keyMapping = {
                                                    'wins': 'mostWinsSeason',
                                                    'losses': 'mostLossesSeason', 
                                                    'winPercentage': 'bestWinPctSeason',
                                                    'allPlayWinPercentage': 'bestAllPlayWinPctSeason',
                                                    'topScoreWeeksCount': 'mostWeeklyHighScoresSeason',
                                                    'weeklyTop2ScoresCount': 'mostWeeklyTop2ScoresSeason',
                                                    'blowoutWins': 'mostBlowoutWinsSeason',
                                                    'blowoutLosses': 'mostBlowoutLossesSeason',
                                                    'slimWins': 'mostSlimWinsSeason',
                                                    'slimLosses': 'mostSlimLossesSeason',
                                                    'pointsFor': record.value > 0 ? 'mostPointsSeason' : 'fewestPointsSeason',
                                                    'luckRating': record.value > 0 ? 'bestLuckRatingSeason' : 'worstLuckRatingSeason',
                                                    'highestDPR': 'highestDPRSeason',
                                                    'lowestDPR': 'lowestDPRSeason',
                                                    'tradeCount': 'mostTradesSeason',
                                                    'waiverCount': 'mostWaiversSeason',
                                                    'seasonalHighestPointsShare': 'highestPointsShareSeason',
                                                    'seasonalLowestPointsShare': 'lowestPointsShareSeason'
                                                };
                                                const dataKey = keyMapping[record.key];
                                                const isMinRecord = ['fewestPointsSeason', 'worstLuckRatingSeason', 'lowestDPRSeason', 'lowestPointsShareSeason'].includes(dataKey);
                                                
                                                return allSeasonData[dataKey]
                                                    .sort((a, b) => isMinRecord ? a.value - b.value : b.value - a.value)
                                                    .slice(0, 5)
                                                    .map((seasonData, idx) => (
                                                        <div key={`${record.key}-mobile-top5-${seasonData.ownerId}-${seasonData.year}-${idx}`} className="flex items-center justify-between bg-gray-50 rounded-md p-2 border border-gray-100">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{idx + 1}</div>
                                                                <div className="flex flex-col">
                                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                                        {seasonData.teamName || getTeamName(seasonData.ownerId, seasonData.year)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {seasonData.year}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-semibold text-gray-900">
                                                                {(() => {
                                                                    if ([
                                                                        'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                                                                        'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses', 'tradeCount', 'waiverCount'
                                                                    ].includes(record.key)) {
                                                                        return Math.round(seasonData.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                                                    } else if (['bestLuckRating', 'worstLuckRating', 'highestDPR', 'lowestDPR'].includes(record.key)) {
                                                                        return seasonData.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                    } else if (record.key === 'mostPointsFor' || record.key === 'fewestPointsFor') {
                                                                        return seasonData.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                                                    } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage' || record.key === 'seasonalHighestPointsShare' || record.key === 'seasonalLowestPointsShare') {
                                                                        return (seasonData.value * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                                                                    } else {
                                                                        return seasonData.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                                                    }
                                                                })()}
                                                            </div>
                                                        </div>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop/table: hidden on small screens */}
            <div className="hidden sm:block bg-gradient-to-r from-gray-50 to-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">🏆</span> Record
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">📊</span> Value
                                    </div>
                                </th>
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-center text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">👑</span> Team (Season)
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {highlightRecords.map((record, recordGroupIndex) => {
                                const isExpanded = expandedSections[record.key];
                                const recordLabel = getRecordLabel(record.key, record);
                                
                                return (
                                    <React.Fragment key={record.key}>
                                        {record.entries.map((entry, entryIndex) => {
                                            const teamDisplayName = entry.teamName || getTeamName(entry.ownerId, entry.year);
                                            let valueDisplay = '';
                                            
                                            // Only display the value for the first entry in a group
                                            if (entryIndex === 0) {
                                                if (typeof entry.value === 'number') {
                                                    if ([
                                                        'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                                                        'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses', 'tradeCount', 'waiverCount'
                                                    ].includes(record.key)) {
                                                        valueDisplay = Math.round(entry.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                                    } else if (['bestLuckRating', 'worstLuckRating', 'highestDPR', 'lowestDPR'].includes(record.key)) {
                                                        valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                                    } else if (record.key === 'mostPointsFor' || record.key === 'fewestPointsFor') {
                                                        valueDisplay = entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                    } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage' || record.key === 'seasonalHighestPointsShare' || record.key === 'seasonalLowestPointsShare') {
                                                        valueDisplay = (entry.value * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                                                    } else {
                                                        valueDisplay = entry.value;
                                                    }
                                                }
                                            }

                                            return (
                                                <tr 
                                                    key={`${record.key}-${teamDisplayName}-${entryIndex}`}
                                                    className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                                                >
                                                    <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                        {entryIndex === 0 ? (
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                                                    {recordLabel}
                                                                </span>
                                                                <button
                                                                    onClick={() => toggleSection(record.key)}
                                                                    className="ml-2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                                                                    aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${recordLabel}`}
                                                                >
                                                                    <svg
                                                                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-400 text-xs sm:text-sm">• Tied Record</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                        {entryIndex === 0 ? (
                                                            <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-green-100 to-blue-100 border border-green-200">
                                                                <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                                    {valueDisplay}
                                                                </span>
                                                            </div>
                                                        ) : ''}
                                                    </td>
                                                    <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-medium text-gray-900 text-xs sm:text-sm">
                                                                {teamDisplayName}
                                                            </span>
                                                            {entry.year && (
                                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                                                                    {entry.year}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* Collapsible Top 5 Section */}
                                        {isExpanded && (() => {
                                            // Map record.key to the correct allSeasonData key
                                            const keyMapping = {
                                                'wins': 'mostWinsSeason',
                                                'losses': 'mostLossesSeason', 
                                                'winPercentage': 'bestWinPctSeason',
                                                'allPlayWinPercentage': 'bestAllPlayWinPctSeason',
                                                'topScoreWeeksCount': 'mostWeeklyHighScoresSeason',
                                                'weeklyTop2ScoresCount': 'mostWeeklyTop2ScoresSeason',
                                                'blowoutWins': 'mostBlowoutWinsSeason',
                                                'blowoutLosses': 'mostBlowoutLossesSeason',
                                                'slimWins': 'mostSlimWinsSeason',
                                                'slimLosses': 'mostSlimLossesSeason',
                                                'pointsFor': record.value > 0 ? 'mostPointsSeason' : 'fewestPointsSeason',
                                                'luckRating': record.value > 0 ? 'bestLuckRatingSeason' : 'worstLuckRatingSeason',
                                                'highestDPR': 'highestDPRSeason',
                                                'lowestDPR': 'lowestDPRSeason',
                                                'tradeCount': 'mostTradesSeason',
                                                'waiverCount': 'mostWaiversSeason',
                                                'seasonalHighestPointsShare': 'highestPointsShareSeason',
                                                'seasonalLowestPointsShare': 'lowestPointsShareSeason'
                                            };
                                            const dataKey = keyMapping[record.key];
                                            return dataKey && allSeasonData[dataKey] && allSeasonData[dataKey].length > 0;
                                        })() && (
                                            <tr className={`${recordGroupIndex % 2 === 0 ? 'bg-gray-50' : 'bg-gray-75'}`}>
                                                <td colSpan="3" className="p-0">
                                                    <div className="px-3 py-4 sm:px-6 sm:py-6">
                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                            Top 5 {recordLabel}
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                // Map record.key to the correct allSeasonData key
                                                                const keyMapping = {
                                                                    'wins': 'mostWinsSeason',
                                                                    'losses': 'mostLossesSeason', 
                                                                    'winPercentage': 'bestWinPctSeason',
                                                                    'allPlayWinPercentage': 'bestAllPlayWinPctSeason',
                                                                    'topScoreWeeksCount': 'mostWeeklyHighScoresSeason',
                                                                    'weeklyTop2ScoresCount': 'mostWeeklyTop2ScoresSeason',
                                                                    'blowoutWins': 'mostBlowoutWinsSeason',
                                                                    'blowoutLosses': 'mostBlowoutLossesSeason',
                                                                    'slimWins': 'mostSlimWinsSeason',
                                                                    'slimLosses': 'mostSlimLossesSeason',
                                                                    'pointsFor': record.value > 0 ? 'mostPointsSeason' : 'fewestPointsSeason',
                                                                    'luckRating': record.value > 0 ? 'bestLuckRatingSeason' : 'worstLuckRatingSeason',
                                                                    'highestDPR': 'highestDPRSeason',
                                                                    'lowestDPR': 'lowestDPRSeason',
                                                                    'tradeCount': 'mostTradesSeason',
                                                                    'waiverCount': 'mostWaiversSeason',
                                                                    'seasonalHighestPointsShare': 'highestPointsShareSeason',
                                                                    'seasonalLowestPointsShare': 'lowestPointsShareSeason'
                                                                };
                                                                const dataKey = keyMapping[record.key];
                                                                const sortKey = record.key;
                                                                const isMinRecord = ['fewestPointsSeason', 'worstLuckRatingSeason', 'lowestDPRSeason', 'lowestPointsShareSeason'].includes(dataKey);
                                                                
                                                                return allSeasonData[dataKey]
                                                                    .sort((a, b) => isMinRecord ? a.value - b.value : b.value - a.value)
                                                                    .slice(0, 5)
                                                                    .map((seasonData, index) => {
                                                                        let displayValue = '';
                                                                        if ([
                                                                            'wins', 'losses', 'topScoreWeeksCount', 'weeklyTop2ScoresCount',
                                                                            'blowoutWins', 'blowoutLosses', 'slimWins', 'slimLosses', 'tradeCount', 'waiverCount'
                                                                        ].includes(record.key)) {
                                                                            displayValue = Math.round(seasonData.value).toLocaleString('en-US', { maximumFractionDigits: 0 });
                                                                        } else if (['bestLuckRating', 'worstLuckRating', 'adjustedDPR'].includes(record.key)) {
                                                                            displayValue = seasonData.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                                                                        } else if (record.key === 'mostPointsFor' || record.key === 'fewestPointsFor') {
                                                                            displayValue = seasonData.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                                        } else if (record.key === 'winPercentage' || record.key === 'allPlayWinPercentage' || record.key === 'seasonalHighestPointsShare' || record.key === 'seasonalLowestPointsShare') {
                                                                            displayValue = (seasonData.value * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                                                                        } else {
                                                                            displayValue = seasonData.value;
                                                                        }
                                                                        
                                                                        return (
                                                                            <div key={`${record.key}-${seasonData.teamName}-${seasonData.value}-${seasonData.year}-${index}`} 
                                                                                 className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <span className="font-medium text-gray-900 text-sm">{seasonData.teamName}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <span className="font-bold text-gray-900">{displayValue}</span>
                                                                                    <div className="text-xs text-gray-500">
                                                                                        {seasonData.year}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                            })()}
                                                        </div>
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
        </div>
    );
}

export default SeasonRecords;