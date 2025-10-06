// src/utils/transactionIntegration.js
import { fetchTransactionsForWeek } from './sleeperApi';
import logger from './logger';

/**
 * Analyzes Sleeper transactions and creates transaction count records for each team
 * @param {Array} transactions - Raw Sleeper transaction data
 * @param {Object} rostersData - Roster data to map roster IDs to owners
 * @returns {Object} Transaction counts by team and type
 */
export const analyzeTransactionCounts = (transactions, rostersData) => {
    if (!transactions || !Array.isArray(transactions) || !rostersData) {
        logger.warn('Invalid transaction data provided to analyzeTransactionCounts');
        return { byTeam: {}, byWeek: {}, summary: {} };
    }

    const byTeam = {}; // { ownerId: { trades: 0, waivers: 0, freeAgents: 0, byWeek: {} } }
    const byWeek = {}; // { week: { trades: [], waivers: [], freeAgents: [] } }
    const processedTransactions = new Set(); // Prevent duplicates

    transactions.forEach(transaction => {
        const transactionId = transaction.transaction_id;
        
        // Skip if already processed
        if (processedTransactions.has(transactionId)) {
            return;
        }
        processedTransactions.add(transactionId);

        const week = transaction.leg || 1;
        const date = new Date(transaction.created).toISOString().split('T')[0];

        // Initialize week tracking
        if (!byWeek[week]) {
            byWeek[week] = { trades: [], waivers: [], freeAgents: [] };
        }

        if (transaction.type === 'trade') {
            // Count trades for each team involved
            if (transaction.roster_ids && Array.isArray(transaction.roster_ids)) {
                const involvedTeams = transaction.roster_ids.map(rosterId => {
                    const roster = rostersData.find(r => r.roster_id === rosterId);
                    return roster ? roster.owner_id : null;
                }).filter(Boolean);

                involvedTeams.forEach(ownerId => {
                    // Initialize team tracking
                    if (!byTeam[ownerId]) {
                        byTeam[ownerId] = { trades: 0, waivers: 0, freeAgents: 0, byWeek: {} };
                    }
                    if (!byTeam[ownerId].byWeek[week]) {
                        byTeam[ownerId].byWeek[week] = { trades: 0, waivers: 0, freeAgents: 0 };
                    }

                    // Increment counters
                    byTeam[ownerId].trades += 1;
                    byTeam[ownerId].byWeek[week].trades += 1;
                });

                // Track trade for the week
                byWeek[week].trades.push({
                    transactionId,
                    teams: involvedTeams,
                    date,
                    playersTraded: {
                        adds: transaction.adds ? Object.keys(transaction.adds).length : 0,
                        drops: transaction.drops ? Object.keys(transaction.drops).length : 0
                    }
                });
            }
        } else if (transaction.type === 'waiver' || transaction.type === 'free_agent') {
            // Count waivers/FA pickups for the team making the move
            if (transaction.roster_ids && Array.isArray(transaction.roster_ids) && transaction.roster_ids.length > 0) {
                const rosterId = transaction.roster_ids[0];
                const roster = rostersData.find(r => r.roster_id === rosterId);
                
                if (roster && roster.owner_id) {
                    const ownerId = roster.owner_id;
                    const pickupCount = transaction.adds ? Object.keys(transaction.adds).length : 0;
                    
                    if (pickupCount > 0) {
                        // Initialize team tracking
                        if (!byTeam[ownerId]) {
                            byTeam[ownerId] = { trades: 0, waivers: 0, freeAgents: 0, byWeek: {} };
                        }
                        if (!byTeam[ownerId].byWeek[week]) {
                            byTeam[ownerId].byWeek[week] = { trades: 0, waivers: 0, freeAgents: 0 };
                        }

                        // Increment counters based on transaction type
                        if (transaction.type === 'waiver') {
                            byTeam[ownerId].waivers += pickupCount;
                            byTeam[ownerId].byWeek[week].waivers += pickupCount;
                            byWeek[week].waivers.push({
                                transactionId,
                                team: ownerId,
                                date,
                                pickupCount,
                                players: transaction.adds ? Object.keys(transaction.adds) : []
                            });
                        } else {
                            byTeam[ownerId].freeAgents += pickupCount;
                            byTeam[ownerId].byWeek[week].freeAgents += pickupCount;
                            byWeek[week].freeAgents.push({
                                transactionId,
                                team: ownerId,
                                date,
                                pickupCount,
                                players: transaction.adds ? Object.keys(transaction.adds) : []
                            });
                        }
                    }
                }
            }
        }
    });

    // Create summary statistics
    const summary = {
        totalTrades: Object.values(byTeam).reduce((sum, team) => sum + team.trades, 0),
        totalWaivers: Object.values(byTeam).reduce((sum, team) => sum + team.waivers, 0),
        totalFreeAgents: Object.values(byTeam).reduce((sum, team) => sum + team.freeAgents, 0),
        totalTransactions: 0
    };
    summary.totalTransactions = summary.totalTrades + summary.totalWaivers + summary.totalFreeAgents;

    return { byTeam, byWeek, summary };
};

/**
 * Fetches all transactions for the current season and returns transaction counts
 * @param {string} leagueId - Current league ID
 * @param {Object} rostersData - Current roster data
 * @param {number} totalWeeks - Total weeks in the season (default 18)
 * @returns {Promise<Object>} Promise resolving to transaction count data
 */
export const generateTransactionCountsFromSleeper = async (leagueId, rostersData, totalWeeks = 18) => {
    if (!leagueId || !rostersData) {
        throw new Error('League ID and roster data are required');
    }

    logger.info('Starting transaction fee analysis for league:', leagueId);
    
    const allTransactions = [];
    const errors = [];

    // Fetch transactions for all weeks
    for (let week = 1; week <= totalWeeks; week++) {
        try {
            logger.info(`Fetching transactions for week ${week}`);
            const weekTransactions = await fetchTransactionsForWeek(leagueId, week);
            
            if (weekTransactions && Array.isArray(weekTransactions)) {
                allTransactions.push(...weekTransactions);
                logger.info(`Found ${weekTransactions.length} transactions for week ${week}`);
            }
        } catch (error) {
            logger.error(`Failed to fetch transactions for week ${week}:`, error);
            errors.push({ week, error: error.message });
        }
    }

    logger.info(`Total transactions fetched: ${allTransactions.length}`);

    // Analyze transactions and generate count data
    const transactionCounts = analyzeTransactionCounts(allTransactions, rostersData);
    
    logger.info(`Analyzed ${allTransactions.length} Sleeper transactions`);
    logger.info(`Found ${transactionCounts.summary.totalTrades} trades, ${transactionCounts.summary.totalWaivers} waivers, ${transactionCounts.summary.totalFreeAgents} FA pickups`);
    
    if (errors.length > 0) {
        logger.warn('Some weeks had errors:', errors);
    }

    return {
        counts: transactionCounts,
        rawTransactions: allTransactions,
        errors: errors,
        summary: {
            totalSleeperTransactions: allTransactions.length,
            totalTrades: transactionCounts.summary.totalTrades,
            totalWaivers: transactionCounts.summary.totalWaivers,
            totalFreeAgents: transactionCounts.summary.totalFreeAgents,
            weeksFetched: totalWeeks,
            weeksWithErrors: errors.length
        }
    };
};

/**
 * Creates a summary of transaction counts by team with team names
 * @param {Object} transactionCounts - Count data from analyzeTransactionCounts
 * @param {Object} usersData - User data for team names
 * @returns {Object} Summary of transaction counts by team
 */
export const createTransactionCountSummary = (transactionCounts, usersData) => {
    const summary = {};
    
    Object.entries(transactionCounts.byTeam).forEach(([ownerId, counts]) => {
        const user = usersData?.find(u => u.user_id === ownerId);
        summary[ownerId] = {
            ownerName: user?.display_name || user?.username || 'Unknown',
            teamName: user?.metadata?.team_name || 'Unknown Team',
            trades: counts.trades,
            waivers: counts.waivers,
            freeAgents: counts.freeAgents,
            totalTransactions: counts.trades + counts.waivers + counts.freeAgents,
            byWeek: counts.byWeek
        };
    });
    
    return summary;
};

/**
 * Creates a weekly breakdown report
 * @param {Object} transactionCounts - Count data from analyzeTransactionCounts
 * @param {Object} usersData - User data for team names
 * @returns {Object} Weekly breakdown of all transactions
 */
export const createWeeklyTransactionReport = (transactionCounts, usersData) => {
    const weeklyReport = {};
    
    Object.entries(transactionCounts.byWeek).forEach(([week, weekData]) => {
        weeklyReport[week] = {
            trades: weekData.trades.map(trade => ({
                ...trade,
                teamNames: trade.teams.map(ownerId => {
                    const user = usersData?.find(u => u.user_id === ownerId);
                    return user?.metadata?.team_name || user?.display_name || 'Unknown Team';
                })
            })),
            waivers: weekData.waivers.map(waiver => ({
                ...waiver,
                teamName: (() => {
                    const user = usersData?.find(u => u.user_id === waiver.team);
                    return user?.metadata?.team_name || user?.display_name || 'Unknown Team';
                })()
            })),
            freeAgents: weekData.freeAgents.map(fa => ({
                ...fa,
                teamName: (() => {
                    const user = usersData?.find(u => u.user_id === fa.team);
                    return user?.metadata?.team_name || user?.display_name || 'Unknown Team';
                })()
            }))
        };
    });
    
    return weeklyReport;
};

export default {
    analyzeTransactionCounts,
    generateTransactionCountsFromSleeper,
    createTransactionCountSummary,
    createWeeklyTransactionReport
};