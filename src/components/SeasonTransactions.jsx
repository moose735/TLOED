// src/components/SeasonTransactions.jsx
import React, { useState, useEffect } from 'react';
import { getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';

const SeasonTransactions = ({ season, leagueId, transactionsByWeek, nflPlayers, users, rosters, getDisplayTeamName }) => {
  const [selectedWeek, setSelectedWeek] = useState('');

  // Memoized helper to get user display name from owner_id
  const getUserDisplayName = (userId) => {
    const user = users[userId];
    return user ? getDisplayTeamName(user.teamName || user.displayName) : 'Unknown User';
  };

  // Helper to get player name from player_id using NFL players data
  const getPlayerName = (playerId) => {
    const player = nflPlayers[playerId];
    return player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : `Unknown Player (${playerId})`;
  };

  // Helper to get team name from roster_id
  const getTeamNameByRosterId = (rosterId) => {
    const roster = rosters.find(r => r.roster_id === rosterId);
    return roster ? getDisplayTeamName(roster.ownerTeamName) : 'Unknown Team';
  };


  useEffect(() => {
    if (transactionsByWeek && Object.keys(transactionsByWeek).length > 0) {
      // Set initial selected week to the latest week available
      const latestWeek = Math.max(...Object.keys(transactionsByWeek).map(Number));
      setSelectedWeek(String(latestWeek));
    } else {
      setSelectedWeek('');
    }
  }, [season, transactionsByWeek]);

  if (!season || !leagueId || !transactionsByWeek || Object.keys(transactionsByWeek).length === 0) {
    return (
      <div className="text-center p-4 text-gray-600">
        No transaction data available for {season}.
      </div>
    );
  }

  const availableWeeks = Object.keys(transactionsByWeek).sort((a, b) => Number(a) - Number(b));
  const currentWeekTransactions = selectedWeek ? transactionsByWeek[selectedWeek] || [] : [];

  return (
    <div className="p-4">
      <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
        {season} Season Transactions
      </h3>

      <div className="mb-6 flex flex-col md:flex-row items-center justify-start space-y-4 md:space-y-0 md:space-x-4">
        <label htmlFor="transaction-week-select" className="font-semibold text-gray-700">Select Week:</label>
        <select
          id="transaction-week-select"
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          {availableWeeks.length === 0 && <option value="">No Weeks Available</option>}
          {availableWeeks.map(week => (
            <option key={week} value={week}>
              Week {week}
            </option>
          ))}
        </select>
      </div>

      {selectedWeek && currentWeekTransactions.length > 0 ? (
        <div className="space-y-6">
          {currentWeekTransactions.map((transaction) => (
            <div key={transaction.transaction_id} className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
              <p className="text-lg font-bold text-gray-800 mb-2 capitalize">
                {transaction.type.replace('_', ' ')}
                <span className="text-gray-500 ml-2 text-sm font-normal">
                  ({new Date(transaction.created).toLocaleString()})
                </span>
              </p>

              {/* Adds Section */}
              {transaction.adds && Object.keys(transaction.adds).length > 0 && (
                <div className="mb-2">
                  <p className="font-semibold text-green-700 text-sm flex items-center">
                    <span className="mr-1">&#x2714;</span> Added:
                  </p>
                  <ul className="list-disc list-inside ml-4 text-gray-700 text-sm">
                    {Object.entries(transaction.adds).map(([playerId, rosterId]) => (
                      <li key={playerId} className="flex items-center">
                        <img
                          src={getSleeperPlayerHeadshotUrl(playerId)}
                          alt={getPlayerName(playerId)}
                          className="w-6 h-6 rounded-full mr-2"
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=No+Headshot'; }}
                        />
                        {getPlayerName(playerId)} to {getTeamNameByRosterId(rosterId)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Drops Section */}
              {transaction.drops && Object.keys(transaction.drops).length > 0 && (
                <div className="mb-2">
                  <p className="font-semibold text-red-700 text-sm flex items-center">
                    <span className="mr-1">&#x2716;</span> Dropped:
                  </p>
                  <ul className="list-disc list-inside ml-4 text-gray-700 text-sm">
                    {Object.entries(transaction.drops).map(([playerId, rosterId]) => (
                      <li key={playerId} className="flex items-center">
                        <img
                          src={getSleeperPlayerHeadshotUrl(playerId)}
                          alt={getPlayerName(playerId)}
                          className="w-6 h-6 rounded-full mr-2"
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/50x50/cccccc/000000?text=No+Headshot'; }}
                        />
                        {getPlayerName(playerId)} from {getTeamNameByRosterId(rosterId)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Trade Specifics */}
              {transaction.type === 'trade' && (
                <div className="mt-2">
                  {transaction.roster_ids && transaction.roster_ids.length > 0 && (
                    <p className="text-sm text-gray-800">
                      <strong>Involved Teams:</strong> {transaction.roster_ids.map(id => getTeamNameByRosterId(id)).join(', ')}
                    </p>
                  )}
                  {transaction.draft_picks && transaction.draft_picks.length > 0 && (
                    <div className="mt-1">
                      <p className="text-sm text-gray-800 font-semibold">Draft Picks Involved:</p>
                      <ul className="list-disc list-inside ml-4 text-gray-700 text-sm">
                        {transaction.draft_picks.map((pick, idx) => (
                          <li key={idx}>
                            {pick.season} Round {pick.round}: From {getTeamNameByRosterId(pick.roster_id)} to {getTeamNameByRosterId(pick.owner_id)}
                            {pick.previous_owner_id !== pick.roster_id && ` (Traded from ${getTeamNameByRosterId(pick.previous_owner_id)})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {transaction.waiver_budget && transaction.waiver_budget.length > 0 && (
                    <div className="mt-1">
                      <p className="text-sm text-gray-800 font-semibold">FAAB Involved:</p>
                      <ul className="list-disc list-inside ml-4 text-gray-700 text-sm">
                        {transaction.waiver_budget.map((budget, idx) => (
                          <li key={idx}>
                            {getTeamNameByRosterId(budget.sender)} sent ${budget.amount} FAAB to {getTeamNameByRosterId(budget.receiver)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center p-4 text-gray-500">
          No transactions found for Week {selectedWeek} in {season}.
        </p>
      )}
    </div>
  );
};

export default SeasonTransactions;
