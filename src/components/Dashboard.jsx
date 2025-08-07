// src/components/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { CURRENT_LEAGUE_ID } from '../config'; // Only CURRENT_LEAGUE_ID comes from config
import {
    fetchTransactionsForWeek,
    getSleeperPlayerHeadshotUrl,
} from '../utils/sleeperApi'; // Only fetchTransactionsForWeek is needed here now

// Import the custom hook from your SleeperDataContext
import { useSleeperData } from '../contexts/SleeperDataContext';

const Dashboard = () => {
    // Consume data and functions from SleeperDataContext
    const {
        loading,
        error,
        leagueData, // Renamed from leagueInfo
        usersData,  // Renamed from users
        rostersBySeason, // Renamed from rosters (now contains data for all seasons, but we'll use current season's)
        nflPlayers,
        allDraftHistory, // Renamed from fetchedLeagueDrafts
        getTeamName, // This replaces getDisplayTeamName
    } = useSleeperData();

    // Internal state for transactions and draft countdown
    const [transactions, setTransactions] = useState([]);
    const [draftStartTime, setDraftStartTime] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);

    // Effect to fetch transactions and set draft start time
    useEffect(() => {
        const loadDashboardSpecificData = async () => {
            // Only proceed if core league data is loaded from context
            if (!leagueData || !allDraftHistory || !usersData || !rostersBySeason) {
                // This shouldn't happen if App.js waits for loading, but good for safety
                console.warn("Sleeper context data not fully loaded in Dashboard.");
                return;
            }

            const currentWeek = leagueData.settings?.week;
            const season = leagueData.season;

            // Fetch transactions for the current week
            try {
                const fetchedTransactions = currentWeek
                    ? await fetchTransactionsForWeek(CURRENT_LEAGUE_ID, currentWeek)
                    : [];
                setTransactions(fetchedTransactions);
            } catch (err) {
                console.error('Error fetching transactions:', err);
                // Don't set global error, just log for transactions
            }

            // Check for pre-draft status and set draft start time from allDraftHistory
            if (allDraftHistory && allDraftHistory.length > 0) {
                const currentSeasonDraft = allDraftHistory.find(d => d.season === season && d.status === 'pre_draft' && d.start_time);
                if (currentSeasonDraft) {
                    setDraftStartTime(currentSeasonDraft.start_time);
                } else {
                    setDraftStartTime(null);
                }
            } else {
                setDraftStartTime(null);
            }
        };

        // This effect should re-run if leagueData or allDraftHistory changes (i.e., when context loads)
        loadDashboardSpecificData();
    }, [leagueData, allDraftHistory, usersData, rostersBySeason]); // Dependencies to re-run when context data changes

    // Effect for countdown timer (remains largely the same)
    useEffect(() => {
        let timerInterval;

        if (draftStartTime) {
            const calculateTimeRemaining = () => {
                const now = new Date().getTime();
                const distance = draftStartTime - now;

                if (distance < 0) {
                    clearInterval(timerInterval);
                    setTimeRemaining('Draft has started!');
                } else {
                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
                }
            };

            calculateTimeRemaining();
            timerInterval = setInterval(calculateTimeRemaining, 1000);
        } else {
            setTimeRemaining(null);
        }

        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [draftStartTime]);

    // Helper to get user display name from owner_id using context's getTeamName
    const getUserDisplayName = useCallback((userId) => {
        // getTeamName from context handles mapping user_id to display name
        return getTeamName(userId);
    }, [getTeamName]); // Dependency on getTeamName from context

    // Helper to get player name from player_id using NFL players data from context
    const getPlayerName = useCallback((playerId) => {
        const player = nflPlayers[playerId];
        return player ? `${player.first_name} ${player.last_name}` : `Unknown Player (${playerId})`;
    }, [nflPlayers]); // Dependency on nflPlayers from context

    // Display loading and error states from the SleeperDataContext
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium">Loading dashboard data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 text-lg p-4">
                <p>Error loading dashboard: {error.message || error}</p>
                <p>Please ensure your Sleeper API calls are correctly configured and you have an active internet connection.</p>
            </div>
        );
    }

    // Get rosters for the current season from rostersBySeason (which is an object of season -> [rosters])
    const currentSeasonRosters = leagueData?.season ? rostersBySeason[leagueData.season] : [];

    // Sort rosters by fpts_against (lowest is best) for standings display
    // Then by fpts (highest is best) for tie-breaking
    const sortedRosters = [...(currentSeasonRosters || [])].sort((a, b) => {
        const fptsAgainstA = a.settings?.fpts_against || 0;
        const fptsAgainstB = b.settings?.fpts_against || 0;
        const fptsA = a.settings?.fpts || 0;
        const fptsB = b.settings?.fpts || 0;

        if (fptsAgainstA !== fptsAgainstB) {
            return fptsAgainstA - fptsAgainstB; // Lower fpts_against is better
        }
        return fptsB - fptsA; // Higher fpts is better for tie-break
    });

    return (
        <div className="container mx-auto p-4 md:p-6 bg-white shadow-lg rounded-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                {leagueData?.name || 'Fantasy League'} Dashboard ({leagueData?.season || 'Current'} Season)
            </h2>

            {/* NEW: Conditional Draft Countdown */}
            {draftStartTime && timeRemaining && (
                <div className="text-center bg-blue-100 text-blue-800 p-3 rounded-md mb-8 shadow-sm">
                    <p className="text-xl font-semibold">
                        Draft Countdown: <span className="font-bold">{timeRemaining}</span>
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                        (Draft scheduled for{' '}
                        {new Date(draftStartTime).toLocaleDateString()}{' '}
                        at{' '}
                        {/* Format the time to exclude seconds */}
                        {new Date(draftStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        )
                    </p>
                </div>
            )}

            {/* Existing Current Week display, now conditionally rendered with Draft Countdown */}
            {!draftStartTime && leagueData?.settings?.week && (
                <p className="text-xl text-gray-700 text-center mb-8">
                    Current Week: <span className="font-semibold">{leagueData.settings.week}</span>
                </p>
            )}


            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                {/* Current Standings Section */}
                <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
                    <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Current Standings</h3>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-md">Rank</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W-L</th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-md">FPts</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedRosters.length > 0 ? sortedRosters.map((roster, index) => (
                                <tr key={roster.roster_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                    {/* Use getUserDisplayName (which uses getTeamName from context) */}
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{getUserDisplayName(roster.owner_id)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                                        {roster.settings?.wins || 0}-{roster.settings?.losses || 0}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                                        {roster.settings?.fpts}.{String(roster.settings?.fpts_decimal || '0').padStart(2, '0')}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-3 py-4 text-center text-sm text-gray-500">No roster data available for this season.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Recent Transactions Section */}
                <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
                    <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Recent Transactions ({leagueData?.settings?.week ? `Week ${leagueData.settings.week}` : 'N/A'})</h3>
                    {transactions.length > 0 ? (
                        <ul className="space-y-4">
                            {transactions.slice(0, 5).map((transaction) => ( // Show up to 5 recent transactions
                                <li key={transaction.transaction_id} className="bg-white p-4 rounded-md shadow-sm">
                                    <p className="text-sm font-medium text-gray-900 mb-1">
                                        <span className="capitalize font-bold text-blue-600">{transaction.type.replace('_', ' ')}</span>
                                        <span className="text-gray-500 ml-2 text-xs">
                                            ({new Date(transaction.created).toLocaleString()})
                                        </span>
                                    </p>
                                    {/* Display Adds */}
                                    {transaction.adds && Object.keys(transaction.adds).length > 0 && (
                                        <div className="flex items-center text-sm text-green-700 mt-2">
                                            <span className="mr-2">&#x2714;</span> {/* Checkmark */}
                                            <span className="font-semibold">Added:</span>
                                            {Object.entries(transaction.adds).map(([playerId, rosterId]) => (
                                                <div key={playerId} className="ml-2 flex items-center">
                                                    <img
                                                        src={getSleeperPlayerHeadshotUrl(playerId)}
                                                        alt={getPlayerName(playerId)}
                                                        className="w-6 h-6 rounded-full mr-1"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/cccccc/000000?text=No+Headshot'; }}
                                                    />
                                                    {getPlayerName(playerId)} ({getUserDisplayName(usersData.find(u => u.roster_id === rosterId)?.userId)})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Display Drops */}
                                    {transaction.drops && Object.keys(transaction.drops).length > 0 && (
                                        <div className="flex items-center text-sm text-red-700 mt-2">
                                            <span className="mr-2">&#x2716;</span> {/* X mark */}
                                            <span className="font-semibold">Dropped:</span>
                                            {Object.entries(transaction.drops).map(([playerId, rosterId]) => (
                                                <div key={playerId} className="ml-2 flex items-center">
                                                    <img
                                                        src={getSleeperPlayerHeadshotUrl(playerId)}
                                                        alt={getPlayerName(playerId)}
                                                        className="w-6 h-6 rounded-full mr-1"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/cccccc/000000?text=No+Headshot'; }}
                                                    />
                                                    {getPlayerName(playerId)} ({getUserDisplayName(usersData.find(u => u.roster_id === rosterId)?.userId)})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Display Trades (simplified) */}
                                    {transaction.type === 'trade' && transaction.roster_ids && (
                                        <p className="text-sm text-gray-800 mt-2">
                                            Involved: {transaction.roster_ids.map(rosterId => getUserDisplayName(rostersBySeason[leagueData.season]?.find(r => r.roster_id === rosterId)?.owner_id)).join(' and ')}
                                            {transaction.draft_picks && transaction.draft_picks.length > 0 && (
                                                <span className="ml-2 italic">(Draft picks involved)</span>
                                            )}
                                            {transaction.waiver_budget && transaction.waiver_budget.length > 0 && (
                                                <span className="ml-2 italic">(FAAB involved)</span>
                                            )}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">
                            {leagueData?.status === 'pre_draft'
                                ? 'No transactions available before the draft begins.'
                                : 'No recent transactions for this week.'
                            }
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
