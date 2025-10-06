import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { fetchFinancialDataForYears } from '../services/financialService';
import { calculateCareerTransactionCountsByOwnerId } from '../utils/financialCalculations';
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
            if (rosterMap) {
                teamInfo.ownerId = rosterMap.owner_id;
            }
        }

        if (newValue > currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== -Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                currentRecord.teams.push(teamInfo);
            }
        }
    };

    const updateLowestRecord = (currentRecord, newValue, teamInfo) => {
        if (!teamInfo.ownerId && teamInfo.rosterId && historicalData.rostersBySeason) {
            const rosterMap = Object.values(historicalData.rostersBySeason).flat().find(r => r.roster_id === teamInfo.rosterId);
            if (rosterMap) {
                teamInfo.ownerId = rosterMap.owner_id;
            }
        }

        if (newValue < currentRecord.value) {
            currentRecord.value = newValue;
            currentRecord.teams = [teamInfo];
        } else if (newValue === currentRecord.value && newValue !== Infinity) {
            if (!currentRecord.teams.some(t => t.ownerId === teamInfo.ownerId && t.year === teamInfo.year)) {
                currentRecord.teams.push(teamInfo);
            }
        }
    };

    // Calculate historical record progression
    const calculateRecordHistory = (seasonalMetrics) => {
        // Return a minimal history shape keyed by metric so other code can safely read values.
        const history = {};

        if (!seasonalMetrics || Object.keys(seasonalMetrics).length === 0) {
            return history;
        }

        try {
            const metricKeys = [
                'highestDPR','lowestDPR','bestLuck','worstLuck','mostWins','mostLosses',
                'bestWinPct','bestAllPlayWinPct','mostWeeklyHighScores','mostWeeklyTop2Scores',
                'mostWinningSeasons','mostLosingSeasons','mostBlowoutWins','mostBlowoutLosses',
                'mostSlimWins','mostSlimLosses','mostTotalPoints','mostPointsAgainst',
                'mostTrades','mostWaivers','mostPointsChampionships','mostRegularSeasonTitles'
            ];

            metricKeys.forEach(key => {
                history[key] = {
                    currentValue: null,
                    currentHolders: [],
                    allTimeHolders: [],
                    recordHistory: []
                };
            });
        } catch (err) {
            logger.warn('Failed to build minimal record history:', err);
        }

        return history;
    };

    // Calculate top-5 rankings helper
    const calculateTopFiveRankings = (careerDPRData) => {
        const rankings = {};

        // Helper function to get top 5 for a metric
        const getTop5 = (metric, isHigherBetter = true) => {
            return careerDPRData
                .map(team => ({
                    name: team.teamName,
                    ownerId: team.ownerId,
                    value: team[metric]
                }))
                .filter(team => team.value !== undefined && team.value !== null)
                .sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value)
                .slice(0, 5);
        };

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

        // Luck-based rankings using totalLuckRating
        rankings.bestLuck = careerDPRData
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.totalLuckRating }))
            .filter(team => typeof team.value === 'number' && !isNaN(team.value))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        rankings.worstLuck = careerDPRData
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.totalLuckRating }))
            .filter(team => typeof team.value === 'number' && !isNaN(team.value))
            .sort((a, b) => a.value - b.value)
            .slice(0, 5);

        // Calculate winning/losing seasons separately
        const seasonalData = careerDPRData.map(team => {
            let winningSeasonsCount = 0;
            let losingSeasonsCount = 0;
            
            // This would need access to seasonalMetrics, so we'll calculate it differently
            return {
                name: team.teamName,
                ownerId: team.ownerId,
                winningSeasons: winningSeasonsCount,
                losingSeasons: losingSeasonsCount
            };
        });

        return rankings;
    };

    const toggleSection = (recordKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [recordKey]: !prev[recordKey]
        }));
    };

    // Function to handle all calculations that require both league and financial data
    const doAllCalculations = (calculatedCareerDPRs, seasonalMetrics, financialData) => {
        // Calculate top 5 rankings
        const rankings = calculateTopFiveRankings(calculatedCareerDPRs);
        
        // Calculate winning/losing seasons and transaction counts for rankings
        calculatedCareerDPRs.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            let winningSeasonsCount = 0;
            let losingSeasonsCount = 0;

            Object.keys(seasonalMetrics).forEach(year => {
                const teamsInSeason = Object.values(seasonalMetrics[year]);
                const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                    if (currentOwnerTeamInSeason.winPercentage > 0.5) {
                        winningSeasonsCount++;
                    } else if (currentOwnerTeamInSeason.winPercentage < 0.5) {
                        losingSeasonsCount++;
                    }
                }
            });
            
            careerStats.winningSeasonsCount = winningSeasonsCount;
            careerStats.losingSeasonsCount = losingSeasonsCount;
            
            // Add transaction counts using the passed financial data
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

        // Update rankings with winning/losing seasons and transaction counts
        rankings.mostWinningSeasons = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.winningSeasonsCount }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        
        rankings.mostLosingSeasons = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.losingSeasonsCount }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Add transaction count rankings
        rankings.mostTrades = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.careerTradeFees }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
            
        rankings.mostWaivers = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.careerWaiverFees }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Add points share rankings
        rankings.highestPointsShare = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.pointsShare }))
            .filter(team => typeof team.value === 'number' && team.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
            
        rankings.lowestPointsShare = calculatedCareerDPRs
            .map(team => ({ name: team.teamName, ownerId: team.ownerId, value: team.pointsShare }))
            .filter(team => typeof team.value === 'number' && team.value > 0)
            .sort((a, b) => a.value - b.value)
            .slice(0, 5);

        setTopFiveRankings(rankings);
        
        // Calculate all-time records
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
                updateRecord(highestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
                updateLowestRecord(lowestDPR, careerStats.dpr, { name: teamName, value: careerStats.dpr, ownerId: ownerId });
            }

            // Update luck records (can be zero; include valid numbers only)
            if (typeof careerStats.totalLuckRating === 'number' && !isNaN(careerStats.totalLuckRating)) {
                updateRecord(bestLuck, careerStats.totalLuckRating, { name: teamName, value: careerStats.totalLuckRating, ownerId: ownerId });
                updateLowestRecord(worstLuck, careerStats.totalLuckRating, { name: teamName, value: careerStats.totalLuckRating, ownerId: ownerId });
            }

            // Update points share records
            if (typeof careerStats.pointsShare === 'number' && careerStats.pointsShare > 0) {
                updateRecord(highestPointsShare, careerStats.pointsShare, { name: teamName, value: careerStats.pointsShare, ownerId: ownerId });
                updateLowestRecord(lowestPointsShare, careerStats.pointsShare, { name: teamName, value: careerStats.pointsShare, ownerId: ownerId });
            }

            if (careerStats.totalGames > 0) {
                updateRecord(mostWins, careerStats.wins, { name: teamName, value: careerStats.wins, ownerId: ownerId });
                updateRecord(mostLosses, careerStats.losses, { name: teamName, value: careerStats.losses, ownerId: ownerId });
                updateRecord(bestWinPct, careerStats.winPercentage, { name: teamName, value: careerStats.winPercentage, ownerId: ownerId });
                updateRecord(mostTotalPoints, careerStats.pointsFor, { name: teamName, value: careerStats.pointsFor, ownerId: ownerId });
                updateRecord(mostPointsAgainst, careerStats.pointsAgainst, { name: teamName, value: careerStats.pointsAgainst, ownerId: ownerId });
                updateRecord(mostBlowoutWins, careerStats.blowoutWins, { name: teamName, value: careerStats.blowoutWins, ownerId: ownerId });
                updateRecord(mostBlowoutLosses, careerStats.blowoutLosses, { name: teamName, value: careerStats.blowoutLosses, ownerId: ownerId });
                updateRecord(mostSlimWins, careerStats.slimWins, { name: teamName, value: careerStats.slimWins, ownerId: ownerId });
                updateRecord(mostSlimLosses, careerStats.slimLosses, { name: teamName, value: careerStats.slimLosses, ownerId: ownerId });
                updateRecord(mostWeeklyTop2Scores, careerStats.weeklyTop2ScoresCount, { name: teamName, value: careerStats.weeklyTop2ScoresCount, ownerId: ownerId });
                updateRecord(mostWeeklyHighScores, careerStats.topScoreWeeksCount, { name: teamName, value: careerStats.topScoreWeeksCount, ownerId: ownerId });
                updateRecord(bestAllPlayWinPct, careerStats.allPlayWinPercentage, { name: teamName, value: careerStats.allPlayWinPercentage, ownerId: ownerId });
            }

            // Calculate transaction counts
            updateRecord(mostTrades, careerStats.careerTradeFees, { name: teamName, value: careerStats.careerTradeFees, ownerId: ownerId });
            updateRecord(mostWaivers, careerStats.careerWaiverFees, { name: teamName, value: careerStats.careerWaiverFees, ownerId: ownerId });
            
            // Calculate points share records
            if (careerStats.highestPointsShare !== undefined && careerStats.highestPointsShare > 0) {
                updateRecord(highestPointsShare, careerStats.highestPointsShare, { name: teamName, value: careerStats.highestPointsShare, ownerId: ownerId });
            }
            if (careerStats.lowestPointsShare !== undefined && careerStats.lowestPointsShare < 100) {
                updateLowestRecord(lowestPointsShare, careerStats.lowestPointsShare, { name: teamName, value: careerStats.lowestPointsShare, ownerId: ownerId });
            }
            
            // Calculate championship records
            updateRecord(mostPointsChampionships, careerStats.mostPointsTitles || 0, { name: teamName, value: careerStats.mostPointsTitles || 0, ownerId: ownerId });
            updateRecord(mostRegularSeasonTitles, careerStats.regularSeasonTitles || 0, { name: teamName, value: careerStats.regularSeasonTitles || 0, ownerId: ownerId });
            
            let winningSeasonsCount = 0;
            let losingSeasonsCount = 0;

            Object.keys(seasonalMetrics).forEach(year => {
                const teamsInSeason = Object.values(seasonalMetrics[year]);
                const currentOwnerTeamInSeason = teamsInSeason.find(t => t.ownerId === ownerId);
                if (currentOwnerTeamInSeason && currentOwnerTeamInSeason.totalGames > 0) {
                    if (currentOwnerTeamInSeason.winPercentage > 0.5) {
                        winningSeasonsCount++;
                    } else if (currentOwnerTeamInSeason.winPercentage < 0.5) {
                        losingSeasonsCount++;
                    }
                }
            });
            updateRecord(mostWinningSeasons, winningSeasonsCount, { name: teamName, value: winningSeasonsCount, ownerId: ownerId });
            updateRecord(mostLosingSeasons, losingSeasonsCount, { name: teamName, value: losingSeasonsCount, ownerId: ownerId });
        });

        setAllTimeRecords({
            highestDPR,
            lowestDPR,
            bestLuck,
            worstLuck,
            mostWins,
            mostLosses,
            bestWinPct,
            bestAllPlayWinPct,
            mostWeeklyHighScores,
            mostWeeklyTop2Scores,
            mostWinningSeasons,
            mostLosingSeasons,
            mostBlowoutWins,
            mostBlowoutLosses,
            mostSlimWins,
            mostSlimLosses,
            mostTotalPoints,
            mostPointsAgainst,
            mostTrades,
            mostWaivers,
            highestPointsShare,
            lowestPointsShare,
            mostPointsChampionships,
            mostRegularSeasonTitles,
        });
    };

    useEffect(() => {
        setIsLoading(true);

        if (loading || error || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0 || !nflState) {
            setAllTimeRecords({});
            setRecordHistory({});
            setIsLoading(false);
            return;
        }

        try {
            const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
            
            // Calculate historical progression (doesn't need financial data)
            const history = calculateRecordHistory(seasonalMetrics);
            setRecordHistory(history);
            
            // Load financial data for transaction counts, then do all other calculations
            setLoadingFinancial(true);
            const allYears = Object.keys(historicalData.matchupsBySeason || {});
            
            const finishCalculations = (financialData = {}) => {
                logger.debug("League Records: Processing with financial data for", Object.keys(financialData).length, "years");
                setFinancialDataByYear(financialData);
                setLoadingFinancial(false);
                
                // Now do all calculations that need both league and financial data
                doAllCalculations(calculatedCareerDPRs, seasonalMetrics, financialData);
                setIsLoading(false);
            };
            
            if (allYears.length > 0) {
                fetchFinancialDataForYears(allYears)
                    .then(finishCalculations)
                    .catch(financialError => {
                        logger.warn("Could not load financial data for transaction counts:", financialError);
                        finishCalculations({});
                    });
            } else {
                finishCalculations({});
            }

        } catch (error) {
            logger.error("Error calculating league records:", error);
            setAllTimeRecords({});
            setRecordHistory({});
            setIsLoading(false);
        }
    }, [historicalData, allDraftHistory, getTeamName, loading, error, nflState]);

    if (isLoading) {
        return <div className="text-center py-8">Loading all-time league records...</div>;
    }

    if (Object.keys(allTimeRecords).length === 0 || allTimeRecords.highestDPR?.value === -Infinity) {
        return <div className="text-center py-8">No historical data available to calculate all-time records.</div>;
    }

    const getDisplayTeamName = (team) => {
        if (team.ownerId) {
            return getTeamName(team.ownerId, null);
        } else if (team.rosterId && team.year) {
            const rosterForYear = historicalData.rostersBySeason?.[team.year]?.find(r => String(r.roster_id) === String(team.rosterId));
            if (rosterForYear?.owner_id) {
                return getTeamName(rosterForYear.owner_id, null);
            }
        }
        return "Unknown Team";
    };

    // Helper to format a record value for display (re-usable in mobile cards)
    const formatRecordValueForDisplay = (key, record) => {
        const config = formatConfig[key] || { decimals: 2, type: 'default' };
        if (config.type === 'percentage') {
            return (record.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%';
        }
        return record.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        🌍
                    </div>
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">All-Time League Records</h3>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Career-spanning achievements and historical league data.
                        </p>
                    </div>
                </div>
            </div>

            {/* Mobile: compact card list (mobile-only) */}
            <div className="sm:hidden space-y-3 mb-4">
                {Object.entries(allTimeRecords).map(([key, record]) => {
                    const label = key.replace(/([A-Z])/g, ' $1').trim();
                    const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

                    const topFiveData = topFiveRankings[key] || [];
                    const isExpanded = !!expandedSections[key];

                    if (!record || record.value === -Infinity || record.value === Infinity || !record.teams || record.teams.length === 0) {
                        return (
                            <div key={key} className="bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">{displayLabel}</div>
                                        <div className="text-xs text-gray-500 mt-1">No data available</div>
                                    </div>
                                    {topFiveData.length > 0 && (
                                        <button
                                            onClick={() => toggleSection(key)}
                                            aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${displayLabel}`}
                                            className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
                                        >
                                            <svg className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {isExpanded && topFiveData.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {topFiveData.map((team, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-md p-2 border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{idx + 1}</div>
                                                    <div className="text-sm font-medium text-gray-900">{team.name}</div>
                                                </div>
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {formatRecordValueForDisplay(key, { value: team.value })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const displayValue = formatRecordValueForDisplay(key, record);

                    return (
                        <div key={key} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="text-sm font-semibold text-gray-900">{displayLabel}</div>
                                    {record.teams.length > 0 && (
                                        <div className="text-xs text-gray-600 mt-1">
                                            {record.teams.map((team, idx) => (
                                                <div key={idx} className={idx > 0 ? "mt-1" : ""}>
                                                    <span className="font-medium">{getDisplayTeamName(team)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-green-100 to-teal-100 border border-green-200">
                                        <span className="font-bold text-gray-900 text-sm">{displayValue}</span>
                                    </div>

                                    {topFiveData.length > 0 && (
                                        <button
                                            onClick={() => toggleSection(key)}
                                            aria-label={`${isExpanded ? 'Hide' : 'Show'} top 5 for ${displayLabel}`}
                                            className="p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
                                        >
                                            <svg className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {isExpanded && topFiveData.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {topFiveData.map((team, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-md p-2 border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{idx + 1}</div>
                                                <div className="text-sm font-medium text-gray-900">{team.name}</div>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900">
                                                {formatRecordValueForDisplay(key, { value: team.value })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Records Display */}
            {/* Desktop/table view: hidden on small screens to avoid duplication with mobile cards */}
            <div className="hidden sm:block bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
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
                                <th className="py-3 px-3 sm:py-4 sm:px-6 text-left text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <span className="hidden sm:inline">👑</span> Holder(s)
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {Object.entries(allTimeRecords).map(([key, record], recordGroupIndex) => {
                                const config = formatConfig[record.key] || { decimals: 2, type: 'default' };
                                const getLabel = () => {
                                    let label = record.key.replace(/([A-Z])/g, ' $1').trim();
                                    return label.charAt(0).toUpperCase() + label.slice(1);
                                };

                                if (!record || record.value === -Infinity || record.value === Infinity || !record.teams || record.teams.length === 0) {
                                    return (
                                        <tr key={key} className={`transition-all duration-200 hover:bg-blue-50 ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{getLabel()}</span>
                                                </div>
                                            </td>
                                            <td colSpan="2" className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <span className="text-gray-500 text-xs sm:text-sm italic">No data available</span>
                                            </td>
                                        </tr>
                                    );
                                }

                                const topFiveData = topFiveRankings[record.key] || [];
                                const isExpanded = expandedSections[record.key];

                                return (
                                    <React.Fragment key={key}>
                                        <tr className={`transition-all duration-200 hover:bg-blue-50 hover:shadow-sm ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">{getLabel()}</span>
                                                    {topFiveData.length > 0 && (
                                                        <button
                                                            onClick={() => toggleSection(record.key)}
                                                            className="text-blue-600 hover:text-blue-800 transition-colors"
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
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                                                <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-gradient-to-r from-green-100 to-teal-100 border border-green-200">
                                                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                        {config.type === 'percentage'
                                                            ? (record.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%'
                                                            : record.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 sm:py-4 sm:px-6">
                                                <div className="flex flex-col space-y-1 sm:space-y-2">
                                                    {record.teams.map((team, index) => (
                                                        <div key={index} className="flex items-center gap-2 sm:gap-3 bg-gray-100 rounded-lg p-1.5 sm:p-2 border border-gray-200">
                                                            <span className="font-medium text-gray-800 text-xs sm:text-sm truncate">{getDisplayTeamName(team)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && topFiveData.length > 0 && (
                                            <tr className="bg-blue-50/50">
                                                <td colSpan="3" className="py-3 px-3 sm:py-4 sm:px-6">
                                                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                                                        <h4 className="font-semibold text-gray-800 text-xs sm:text-sm mb-3">Top 5 Rankings</h4>
                                                        <div className="space-y-2">
                                                            {topFiveData.map((team, index) => (
                                                                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                                            {index + 1}
                                                                        </span>
                                                                        <span className="font-medium text-gray-800 text-xs sm:text-sm">{team.name}</span>
                                                                    </div>
                                                                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                                                        {config.type === 'percentage'
                                                                            ? (team.value * 100).toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }) + '%'
                                                                            : team.value.toLocaleString('en-US', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}
                                                                    </span>
                                                                </div>
                                                            ))}
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
};

export default LeagueRecords;