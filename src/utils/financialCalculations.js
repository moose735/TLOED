// src/utils/financialCalculations.js

// Debug flag for financial calculations
const DEBUG_FINANCIAL = false;

/**
 * Get the total value of a transaction, accounting for quantity and team count
 */
export const getTransactionTotal = (transaction) => {
    // If the category is Waiver/FA Fee, multiply amount by the quantity and number of teams.
    if (transaction.category === 'Waiver/FA Fee' && Array.isArray(transaction.team)) {
        return Number(transaction.amount || 0) * Number(transaction.quantity || 1) * transaction.team.length;
    }
    // If the category is Trade Fee, multiply amount by the quantity and number of teams.
    if (transaction.category === 'Trade Fee' && Array.isArray(transaction.team)) {
        return Number(transaction.amount || 0) * Number(transaction.quantity || 1) * transaction.team.length;
    }
    // For all other cases, the total is just the amount.
    return Number(transaction.amount || 0);
};

/**
 * Calculate transaction counts by category for a specific team and year using owner ID
 * @param {Array} transactions - All transactions for the year
 * @param {string} ownerId - The owner's user ID
 * @returns {Object} Transaction counts by category for the team
 */
export const calculateTeamTransactionCountsByOwnerId = (transactions, ownerId) => {
    if (!transactions || !Array.isArray(transactions) || !ownerId) {
        return {
            tradeFees: 0,
            waiverFees: 0,
            totalTransactions: 0
        };
    }

    // Filter transactions for this owner ID
    const teamTransactions = transactions.filter(transaction => {
        if (!transaction.team || !Array.isArray(transaction.team)) {
            return false;
        }
        return transaction.team.includes(ownerId) && transaction.type === 'Fee';
    });

    // Count transactions by category
    // For Trade Fees: multiply by quantity to account for multiple trades in one transaction
    const tradeFees = teamTransactions
        .filter(t => t.category === 'Trade Fee')
        .reduce((sum, t) => sum + Number(t.quantity || 1), 0);
    
    // For Waiver/FA Fees: multiply by quantity to account for multiple pickups in one transaction
    const waiverFees = teamTransactions
        .filter(t => t.category === 'Waiver/FA Fee')
        .reduce((sum, t) => sum + Number(t.quantity || 1), 0);

    return {
        tradeFees,
        waiverFees,
        totalTransactions: tradeFees + waiverFees
    };
};

/**
 * Calculate career transaction counts across all years for a specific owner
 * @param {Object} financialDataByYear - Object with year keys containing transaction arrays
 * @param {string} ownerId - The owner's user ID
 * @returns {Object} Career transaction counts by category
 */
export const calculateCareerTransactionCountsByOwnerId = (financialDataByYear, ownerId) => {
    if (!financialDataByYear || !ownerId) {
        return {
            careerTradeFees: 0,
            careerWaiverFees: 0,
            careerTotalTransactions: 0
        };
    }

    let careerTradeFees = 0;
    let careerWaiverFees = 0;

    // Sum up transactions across all years
    Object.keys(financialDataByYear).forEach(year => {
        if (financialDataByYear[year] && financialDataByYear[year].transactions) {
            const yearCounts = calculateTeamTransactionCountsByOwnerId(
                financialDataByYear[year].transactions,
                ownerId
            );
            careerTradeFees += yearCounts.tradeFees;
            careerWaiverFees += yearCounts.waiverFees;
        }
    });

    return {
        careerTradeFees,
        careerWaiverFees,
        careerTotalTransactions: careerTradeFees + careerWaiverFees
    };
};

/**
 * Calculate financial totals for a specific team and year using owner ID
 * @param {Array} transactions - All transactions for the year
 * @param {string} ownerId - The owner's user ID
 * @returns {Object} Financial summary for the team
 */
export const calculateTeamFinancialTotalsByOwnerId = (transactions, ownerId) => {
    if (!transactions || !Array.isArray(transactions) || !ownerId) {
        return {
            totalFees: 0,
            totalPayouts: 0,
            netTotal: 0,
            transactionCount: 0
        };
    }

    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation: Looking for owner ID "${ownerId}"`);
    }

    // Filter transactions for this owner ID
    // The transaction.team field is an array of user IDs
    const teamTransactions = transactions.filter(transaction => {
        if (!transaction.team || !Array.isArray(transaction.team)) {
            return false;
        }
        
        // Check if this owner's user ID is in the transaction team array
        return transaction.team.includes(ownerId);
    });

    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation: Found ${teamTransactions.length} transactions for owner "${ownerId}"`);
        if (teamTransactions.length > 0) {
            console.log('Sample transaction for this owner:', teamTransactions[0]);
        }
    }

    // Calculate totals using getTransactionTotal and divide by team count for each transaction
    const totalFees = teamTransactions
        .filter(t => t.type === 'Fee')
        .reduce((sum, t) => {
            const teamCount = Array.isArray(t.team) ? t.team.length : 1;
            return sum + (getTransactionTotal(t) / teamCount);
        }, 0);

    const totalPayouts = teamTransactions
        .filter(t => t.type === 'Payout')
        .reduce((sum, t) => {
            const teamCount = Array.isArray(t.team) ? t.team.length : 1;
            return sum + (Number(t.amount || 0) / teamCount);
        }, 0);

    const netTotal = totalPayouts - totalFees; // Positive means team received more than they paid

    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation results for owner "${ownerId}": Fees: $${totalFees}, Payouts: $${totalPayouts}, Net: $${netTotal}`);
    }

    return {
        totalFees,
        totalPayouts,
        netTotal,
        transactionCount: teamTransactions.length
    };
};

/**
 * Calculate financial totals for a specific team and year
 * @param {Array} transactions - All transactions for the year
 * @param {string} teamDisplayName - The team's display name
 * @param {Array} usersData - User data to map team names to user IDs
 * @returns {Object} Financial summary for the team
 */
export const calculateTeamFinancialTotals = (transactions, teamDisplayName, usersData) => {
    if (!transactions || !Array.isArray(transactions) || !teamDisplayName || !usersData) {
        return {
            totalFees: 0,
            totalPayouts: 0,
            netTotal: 0,
            transactionCount: 0
        };
    }

    // Find the user ID for this team's display name
    // The usersData contains user objects with user_id, display_name, username, etc.
    const teamUser = usersData.find(user => {
        const userDisplayName = user.display_name || user.username || user.user_id;
        return userDisplayName === teamDisplayName;
    });
    
    if (!teamUser) {
        if (DEBUG_FINANCIAL) {
            console.log(`Financial calculation: Could not find user for team "${teamDisplayName}"`);
            console.log('Available users:', usersData.map(u => ({ 
                id: u.user_id, 
                display: u.display_name, 
                username: u.username 
            })));
            console.log('Searching for exact match with:', teamDisplayName);
            console.log('Available display names:', usersData.map(u => u.display_name || u.username || u.user_id));
        }
        return {
            totalFees: 0,
            totalPayouts: 0,
            netTotal: 0,
            transactionCount: 0
        };
    }

    const teamUserId = teamUser.user_id;
    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation: Found user ID "${teamUserId}" for team "${teamDisplayName}"`);
    }

    // Filter transactions for this team
    // The transaction.team field is an array of user IDs
    const teamTransactions = transactions.filter(transaction => {
        if (!transaction.team || !Array.isArray(transaction.team)) {
            return false;
        }
        
        // Check if this team's user ID is in the transaction team array
        return transaction.team.includes(teamUserId);
    });

    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation: Found ${teamTransactions.length} transactions for team "${teamDisplayName}" (${teamUserId})`);
    }

    // Calculate totals
    // NOTE: Use amount directly (not getTransactionTotal) to match FinancialTracker member calculations
    // The amount field represents each team's individual share, not the total transaction value
    // For Trade Fees: amount is per-team share, team array has multiple members
    // For Waiver/FA Fees: amount is per-team share (already calculated per unit * quantity)
    const totalFees = teamTransactions
        .filter(t => t.type === 'Fee')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalPayouts = teamTransactions
        .filter(t => t.type === 'Payout')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netTotal = totalPayouts - totalFees; // Positive means team received more than they paid

    if (DEBUG_FINANCIAL) {
        console.log(`Financial calculation results for "${teamDisplayName}": Fees: $${totalFees}, Payouts: $${totalPayouts}, Net: $${netTotal}`);
    }

    return {
        totalFees,
        totalPayouts,
        netTotal,
        transactionCount: teamTransactions.length
    };
};

/**
 * Calculate financial totals for all teams across all years
 * @param {Object} allYearData - Object with year keys containing transaction arrays
 * @param {Array} usersData - User data to map team names to user IDs
 * @returns {Object} Financial data organized by team and year
 */
export const calculateAllTeamFinancialTotals = (allYearData, usersData) => {
    if (!allYearData || !usersData) {
        return {};
    }

    const financialByTeamAndYear = {};

    // Get all unique team display names (using the same logic as FinancialTracker)
    const allTeams = usersData.map(user => user.display_name || user.username || user.user_id);

    // Initialize structure
    allTeams.forEach(teamName => {
        financialByTeamAndYear[teamName] = {};
    });

    // Calculate for each year
    Object.keys(allYearData).forEach(year => {
        const yearTransactions = allYearData[year]?.transactions || [];
        
        if (DEBUG_FINANCIAL) {
            console.log(`Calculating financial totals for year ${year}, found ${yearTransactions.length} transactions`);
        }
        
        allTeams.forEach(teamName => {
            financialByTeamAndYear[teamName][year] = calculateTeamFinancialTotals(
                yearTransactions, 
                teamName, 
                usersData
            );
        });
    });

    return financialByTeamAndYear;
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0.00';
    }
    return `$${amount.toFixed(2)}`;
};

/**
 * Get financial summary text for display
 */
export const getFinancialSummaryText = (financialData) => {
    if (!financialData || financialData.transactionCount === 0) {
        return 'No financial activity';
    }

    const { netTotal, totalFees, totalPayouts } = financialData;
    
    if (netTotal > 0) {
        return `+${formatCurrency(netTotal)} (Earned ${formatCurrency(totalPayouts)}, Paid ${formatCurrency(totalFees)})`;
    } else if (netTotal < 0) {
        return `${formatCurrency(netTotal)} (Earned ${formatCurrency(totalPayouts)}, Paid ${formatCurrency(totalFees)})`;
    } else {
        return `${formatCurrency(0)} (Earned ${formatCurrency(totalPayouts)}, Paid ${formatCurrency(totalFees)})`;
    }
};