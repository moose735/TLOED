// src/components/CurrentSeasonFinancials.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { fetchFinancialDataForYear } from '../services/financialService';
import { calculateTeamFinancialTotalsByOwnerId, getTransactionTotal } from '../utils/financialCalculations';
import { formatScore } from '../utils/formatUtils';
import logger from '../utils/logger';

const DollarIcon = () => (
    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
);

const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";

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

    useEffect(() => {
        const fetchCurrentSeasonFinancials = async () => {
            if (!currentSeason) { setLoadingFinancial(false); return; }
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

    const teamFinancialSummaries = useMemo(() => {
        if (!usersData || !financialData.transactions || financialData.transactions.length === 0) return [];
        return usersData.map(user => {
            const teamName = getTeamName(user.user_id, currentSeason);
            const financialSummary = calculateTeamFinancialTotalsByOwnerId(financialData.transactions, user.user_id);
            const transactionFees = financialData.transactions
                .filter(t =>
                    t.type === 'Fee' &&
                    (t.category === 'Trade Fee' || t.category === 'Waiver/FA Fee') &&
                    Array.isArray(t.team) &&
                    t.team.includes(user.user_id)
                )
                .reduce((sum, t) => sum + (getTransactionTotal(t) / t.team.length), 0);
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
        }).sort((a, b) => b.finalDues - a.finalDues);
    }, [usersData, financialData.transactions, currentSeason, getTeamName]);

    const formatCurrency = (amount) => {
        if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
        return `$${Math.abs(amount).toFixed(2)}`;
    };

    const getDuesColor = (amount) => {
        if (amount > 0) return 'text-emerald-400';
        if (amount < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (contextLoading || loadingFinancial) {
        return (
            <div className={card}>
                <div className={cardHeader}>
                    <DollarIcon />
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Current Season Financials</span>
                </div>
                <div className="text-center py-10 text-sm text-gray-500 animate-pulse">Loading financial data…</div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (contextError || financialError) {
        return (
            <div className={card}>
                <div className={cardHeader}>
                    <DollarIcon />
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Current Season Financials</span>
                </div>
                <div className="text-center py-10 text-sm text-red-400">
                    Error loading financial data: {contextError?.message || financialError}
                </div>
            </div>
        );
    }

    // ── Empty ─────────────────────────────────────────────────────────────────
    if (!teamFinancialSummaries || teamFinancialSummaries.length === 0) {
        return (
            <div className={card}>
                <div className={cardHeader}>
                    <DollarIcon />
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Current Season Financials</span>
                </div>
                <div className="text-center py-10 text-sm text-gray-500">
                    No financial data available for the {currentSeason} season.
                </div>
            </div>
        );
    }

    // ── Main ──────────────────────────────────────────────────────────────────
    return (
        <div className={card}>
            <div className={cardHeader}>
                <DollarIcon />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Current Season Financials</span>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-white/5">
                {teamFinancialSummaries.map((team, index) => (
                    <div key={team.userId} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-gray-600 w-5 text-right flex-shrink-0">
                                {index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-200 truncate">{team.teamName}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-right">
                            <div className="hidden xs:flex flex-col items-end">
                                <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Fees</span>
                                <span className="text-xs text-red-400">{formatCurrency(team.transactionFees)}</span>
                            </div>
                            <div className="hidden xs:flex flex-col items-end">
                                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Payouts</span>
                                <span className="text-xs text-emerald-400">{formatCurrency(team.totalPayouts)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Net</span>
                                <span className={`text-sm font-bold tabular-nums ${getDuesColor(team.finalDues)}`}>
                                    {team.finalDues >= 0 ? '+' : '−'}{formatCurrency(team.finalDues)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                            <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                            <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Transaction Fees</th>
                            <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payouts</th>
                            <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Final Dues</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {teamFinancialSummaries.map((team, index) => (
                            <tr key={team.userId} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-2.5 px-4 text-xs text-gray-600 font-semibold">{index + 1}</td>
                                <td className="py-2.5 px-4 font-medium text-gray-200 whitespace-nowrap">{team.teamName}</td>
                                <td className="py-2.5 px-4 text-center text-red-400 font-medium tabular-nums">{formatCurrency(team.transactionFees)}</td>
                                <td className="py-2.5 px-4 text-center text-emerald-400 font-medium tabular-nums">{formatCurrency(team.totalPayouts)}</td>
                                <td className={`py-2.5 px-4 text-center font-bold tabular-nums ${getDuesColor(team.finalDues)}`}>
                                    {team.finalDues >= 0 ? '+' : '−'}{formatCurrency(team.finalDues)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer note */}
            <div className="px-4 py-2.5 border-t border-white/5">
                <p className="text-[10px] text-gray-600 text-center">
                    <span className="text-gray-500 font-semibold">Final Dues</span> = Payouts − Transaction Fees (excluding entry fees)
                </p>
            </div>
        </div>
    );
};

export default CurrentSeasonFinancials;