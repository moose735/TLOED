// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { CURRENT_LEAGUE_ID } from '../config'; // Only CURRENT_LEAGUE_ID comes from config
import { // All these functions come from sleeperApi
  fetchLeagueDetails,
  fetchUsersData,
  fetchRostersWithDetails,
  fetchNFLPlayers,
  fetchTransactionsForWeek,
  fetchLeagueDrafts,
  getSleeperPlayerHeadshotUrl,
} from '../utils/sleeperApi';

const Dashboard = ({ getDisplayTeamName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [users, setUsers] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [nflPlayers, setNflPlayers] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [draftStartTime, setDraftStartTime] = useState(null); // NEW: State for draft start timestamp
  const [timeRemaining, setTimeRemaining] = useState(null); // NEW: State for countdown display

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch League Details
        const leagueDetails = await fetchLeagueDetails(CURRENT_LEAGUE_ID);
        if (!leagueDetails) {
          throw new Error('Failed to fetch league details.');
        }
        setLeagueInfo(leagueDetails);

        const currentWeek = leagueDetails.settings?.week;
        const season = leagueDetails.season;

        // 2. Fetch Users, Rosters, NFL Players, and League Drafts concurrently
        const [fetchedUsers, fetchedRosters, fetchedNflPlayers, fetchedLeagueDrafts, fetchedTransactions] = await Promise.all([
          fetchUsersData(CURRENT_LEAGUE_ID),
          fetchRostersWithDetails(CURRENT_LEAGUE_ID), // This already includes owner details
          fetchNFLPlayers(),
          fetchLeagueDrafts(CURRENT_LEAGUE_ID), // Fetch drafts for the current league
          currentWeek ? fetchTransactionsForWeek(CURRENT_LEAGUE_ID, currentWeek) : Promise.resolve([]),
        ]);

        setUsers(fetchedUsers);
        setRosters(fetchedRosters);
        setNflPlayers(fetchedNflPlayers);
        setTransactions(fetchedTransactions);

        // NEW: Check for pre-draft status and set draft start time
        if (fetchedLeagueDrafts && fetchedLeagueDrafts.length > 0) {
          // Find the main regular season draft (assuming the first one or most recent for the season)
          const currentSeasonDraft = fetchedLeagueDrafts.find(d => d.season === season && d.season_type === 'regular');

          if (currentSeasonDraft && currentSeasonDraft.status === 'pre_draft' && currentSeasonDraft.start_time) {
            setDraftStartTime(currentSeasonDraft.start_time);
          } else {
            setDraftStartTime(null); // Clear if not pre-draft or no start time
          }
        }

      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []); // Empty dependency array means this effect runs once on mount

  // NEW: Effect for countdown timer
  useEffect(() => {
    let timerInterval;

    if (draftStartTime) {
      const calculateTimeRemaining = () => {
        const now = new Date().getTime();
        const distance = draftStartTime - now;

        if (distance < 0) {
          clearInterval(timerInterval);
          setTimeRemaining('Draft has started!');
          // Optionally, refetch league details to get updated status or hide countdown
          // For now, just display the message.
        } else {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);

          setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      };

      // Call immediately to set initial state
      calculateTimeRemaining();

      // Update every second
      timerInterval = setInterval(calculateTimeRemaining, 1000);
    } else {
      setTimeRemaining(null); // Clear countdown if no draft start time
    }

    // Cleanup function: clear the interval when the component unmounts or draftStartTime changes
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [draftStartTime]); // Re-run this effect if draftStartTime changes

  // Helper to get user display name from owner_id
  const getUserDisplayName = (userId) => {
    const user = users.find(u => u.userId === userId);
    return user ? getDisplayTeamName(user.teamName || user.displayName) : 'Unknown User';
  };

  // Helper to get player name from player_id using NFL players data
  const getPlayerName = (playerId) => {
    const player = nflPlayers[playerId];
    return player ? `${player.first_name} ${player.last_name}` : `Unknown Player (${playerId})`;
  };

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
        <p>Error loading dashboard: {error}</p>
        <p>Please ensure your Sleeper API calls are correctly configured and you have an active internet connection.</p>
      </div>
    );
  }

  // Sort rosters by fpts_against (lowest is best) for standings display
  // Then by fpts (highest is best) for tie-breaking
  const sortedRosters = [...rosters].sort((a, b) => {
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
        {leagueInfo?.name || 'Fantasy League'} Dashboard ({leagueInfo?.season || 'Current'} Season)
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
      {!draftStartTime && leagueInfo?.settings?.week && (
        <p className="text-xl text-gray-700 text-center mb-8">
          Current Week: <span className="font-semibold">{leagueInfo.settings.week}</span>
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
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{getDisplayTeamName(roster.ownerTeamName)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                    {roster.settings?.wins || 0}-{roster.settings?.losses || 0}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                    {roster.settings?.fpts}.{roster.settings?.fpts_decimal || '00'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-3 py-4 text-center text-sm text-gray-500">No roster data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Transactions Section */}
        <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
          <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Recent Transactions ({leagueInfo?.settings?.week ? `Week ${leagueInfo.settings.week}` : 'N/A'})</h3>
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
                                {getPlayerName(playerId)} ({getUserDisplayName(users.find(u => u.roster_id === rosterId)?.userId)})
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
                                {getPlayerName(playerId)} ({getUserDisplayName(users.find(u => u.roster_id === rosterId)?.userId)})
                            </div>
                        ))}
                    </div>
                  )}
                  {/* Display Trades (simplified) */}
                  {transaction.type === 'trade' && transaction.roster_ids && (
                    <p className="text-sm text-gray-800 mt-2">
                      Involved: {transaction.roster_ids.map(rosterId => getUserDisplayName(rosters.find(r => r.roster_id === rosterId)?.owner_id)).join(' and ')}
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
                {leagueInfo?.status === 'pre_draft'
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
