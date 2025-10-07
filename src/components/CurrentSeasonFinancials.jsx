// src/components/CurrentSeasonFinancials.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { fetchFinancialDataForYear } from '../services/financialService';
import { calculateTeamFinancialTotalsByOwnerId, getTransactionTotal } from '../utils/financialCalculations';
import { formatScore } from '../utils/formatUtils';
import logger from '../utils/logger';

const CurrentSeasonFinancials = () => {
    const {
        usersData,
        currentSeason,
        getTeamName,
        loading: contextLoading,
        error: contextError
    } = useSleeperData();

    const [financialData, setFinancialData] = useState({ transactions: [] });
    const [loadingFinancial, setLoadingFinancial] = useState(true);
    const [financialError, setFinancialError] = useState(null);

    // Fetch current season financial data
    useEffect(() => {
        const fetchCurrentSeasonFinancials = async () => {
            if (!currentSeason) {
                setLoadingFinancial(false);
                return;
            }

            try {
                setLoadingFinancial(true);
                setFinancialError(null);
                logger.debug(`Fetching financial data for current season: ${currentSeason}`);
                
                const data = await fetchFinancialDataForYear(currentSeason);
                setFinancialData(data || { transactions: [] });
            } catch (error) {
                logger.error('Error fetching current season financial data:', error);
                setFinancialError(error.message);
                setFinancialData({ transactions: [] });
            } finally {
                setLoadingFinancial(false);
            }
        };

        fetchCurrentSeasonFinancials();
    }, [currentSeason]);

    // Calculate financial summaries for each team
    const teamFinancialSummaries = useMemo(() => {
        if (!usersData || !financialData.transactions || financialData.transactions.length === 0) {
            return [];
        }

        return usersData.map(user => {
            const teamName = getTeamName(user.user_id, currentSeason);
            const financialSummary = calculateTeamFinancialTotalsByOwnerId(
                financialData.transactions,
                user.user_id
            );

            // Calculate transaction fees separately (excluding entry fees)
            const transactionFees = financialData.transactions
                .filter(t => 
                    t.type === 'Fee' && 
                    (t.category === 'Trade Fee' || t.category === 'Waiver/FA Fee') &&
                    Array.isArray(t.team) && 
                    t.team.includes(user.user_id)
                )
                .reduce((sum, t) => {
                    const teamCount = t.team.length;
                    // Use getTransactionTotal and divide by team count to match FinancialTracker logic
                    return sum + (getTransactionTotal(t) / teamCount);
                }, 0);

            // Calculate final dues (payouts - transaction fees)
            const finalDues = financialSummary.totalPayouts - transactionFees;

            return {
                userId: user.user_id,
                teamName,
                displayName: user.display_name || user.username || user.user_id,
                transactionFees,
                totalPayouts: financialSummary.totalPayouts,
                finalDues,
                netTotal: financialSummary.netTotal
            };
        }).sort((a, b) => b.finalDues - a.finalDues); // Sort by final dues descending
    }, [usersData, financialData.transactions, currentSeason, getTeamName]);

    // Format currency for display
    const formatCurrency = (amount) => {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return '$0.00';
        }
        return `$${Math.abs(amount).toFixed(2)}`;
    };

    // Get display color based on amount
    const getAmountColor = (amount) => {
        if (amount > 0) return 'text-green-600';
        if (amount < 0) return 'text-red-600';
        return 'text-gray-700';
    };

    if (contextLoading || loadingFinancial) {
        return (
            <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <span className="mobile-text-lg">Current Season Financials</span>
                </h2>
                <div className="text-center py-8 text-blue-600">Loading financial data...</div>
            </div>
        );
    }

    if (contextError || financialError) {
        return (
            <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <span className="mobile-text-lg">Current Season Financials</span>
                </h2>
                <div className="text-center py-8 text-red-600">
                    Error loading financial data: {contextError?.message || financialError}
                </div>
            </div>
        );
    }

    if (!teamFinancialSummaries || teamFinancialSummaries.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <span className="mobile-text-lg">Current Season Financials</span>
                </h2>
                <div className="text-center py-8 text-gray-600">
                    No financial data available for the {currentSeason} season.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="mobile-text-lg">Current Season Financials</span>
            </h2>
            
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
                {teamFinancialSummaries.map((team, index) => (
                    <div key={team.userId} className="bg-white rounded-lg shadow-md mobile-card p-4 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {index + 1}
                                </div>
                                <div className="font-semibold text-gray-800 text-sm">
                                    {team.teamName}
                                </div>
                            </div>
                            <div className={`text-lg font-bold ${getAmountColor(team.finalDues)}`}>
                                {team.finalDues >= 0 ? '+' : '-'}{formatCurrency(team.finalDues)}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-red-50 rounded-lg p-2 text-center">
                                <div className="text-xs text-red-600 font-medium uppercase tracking-wide">Fees</div>
                                <div className="text-red-600 font-semibold">{formatCurrency(team.transactionFees)}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2 text-center">
                                <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Payouts</div>
                                <div className="text-green-600 font-semibold">{formatCurrency(team.totalPayouts)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
                    <thead className="bg-blue-50">
                        <tr>
                            <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-gray-200">
                                Team
                            </th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-gray-200">
                                Transaction Fees
                            </th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-gray-200">
                                Payouts
                            </th>
                            <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wide border-b border-gray-200">
                                Final Dues
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {teamFinancialSummaries.map((team, index) => (
                            <tr key={team.userId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="py-2 px-3 font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">
                                    {team.teamName}
                                </td>
                                <td className="py-2 px-3 text-center text-red-600 font-medium border-b border-gray-100">
                                    {formatCurrency(team.transactionFees)}
                                </td>
                                <td className="py-2 px-3 text-center text-green-600 font-medium border-b border-gray-100">
                                    {formatCurrency(team.totalPayouts)}
                                </td>
                                <td className={`py-2 px-3 text-center font-bold border-b border-gray-100 ${getAmountColor(team.finalDues)}`}>
                                    {team.finalDues >= 0 ? '+' : '-'}{formatCurrency(team.finalDues)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-600 text-center">
                    <span className="font-semibold">Final Dues</span> = Payouts - Transaction Fees (excluding entry fees)
                </div>
            </div>
        </div>
    );
};

export default CurrentSeasonFinancials;