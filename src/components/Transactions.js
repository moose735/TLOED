import React, { useState, useEffect } from 'react';
import { fetchTransactionsForWeek, getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';
import {
  formatDate,
  formatPlayerTransaction,
  getTransactionTypeLabel
} from '../utils/dataUtils';

const Transactions = ({ leagueId, week }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // This useEffect hook runs whenever the leagueId or week changes.
  useEffect(() => {
    // If we don't have a league ID, we can't fetch anything, so we stop.
    if (!leagueId) {
      setError("Please select a league to view transactions.");
      setLoading(false);
      return;
    }

    const fetchAndSetTransactions = async () => {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching transactions for:', { leagueId, week });
      try {
        // We use the fetchTransactions function from our utility file.
        const fetchedTransactions = await fetchTransactionsForWeek(leagueId, week);
        console.log('📦 Fetched transactions:', fetchedTransactions);
        console.log('📊 Trade transactions:', fetchedTransactions?.filter(t => t.type === 'trade'));
        setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
        setError("Failed to load transactions. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndSetTransactions();
  }, [leagueId, week]);

  // Handle different loading and error states for the user.
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-xl text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-xl text-gray-500">No transactions found for this week.</div>
      </div>
    );
  }

  // Debug logging for transactions
  console.log('🎯 Rendering transactions component with:', {
    transactionsCount: transactions.length,
    week,
    leagueId,
    sampleTransaction: transactions[0]
  });

  // The main rendering logic for the transactions list.
  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Transactions (Week {week})</h2>
      <ul className="space-y-4">
        {transactions.map(transaction => (
          <li key={transaction.transaction_id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg">
                {getTransactionTypeLabel(transaction.type)}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(transaction.created)}
              </span>
            </div>
            {/* Display the players added in the transaction */}
            {transaction.adds && (
              <div className="flex items-center space-x-2 my-2">
                <span className="text-green-600 font-medium">Added:</span>
                <div className="flex flex-wrap space-x-2">
                  {Object.keys(transaction.adds).map(playerId => (
                    <div key={playerId} className="flex items-center space-x-1">
                      <img
                        src={getSleeperPlayerHeadshotUrl(playerId)}
                        alt="Player"
                        className="w-8 h-8 rounded-full border-2 border-green-500"
                      />
                      <span>{formatPlayerTransaction(playerId, transaction.adds)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Display the players dropped in the transaction */}
            {transaction.drops && (
              <div className="flex items-center space-x-2 my-2">
                <span className="text-red-600 font-medium">Dropped:</span>
                <div className="flex flex-wrap space-x-2">
                  {Object.keys(transaction.drops).map(playerId => (
                    <div key={playerId} className="flex items-center space-x-1">
                      <img
                        src={getSleeperPlayerHeadshotUrl(playerId)}
                        alt="Player"
                        className="w-8 h-8 rounded-full border-2 border-red-500"
                      />
                      <span>{formatPlayerTransaction(playerId, transaction.drops)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Debug logging for draft picks */}
            {transaction.type === 'trade' && transaction.transaction_id === '1279156171718012928' && console.log('🎯 Nick Chubb Trade Debug:', {
              id: transaction.transaction_id,
              draft_picks: transaction.draft_picks,
              hasDraftPicks: !!(transaction.draft_picks && Array.isArray(transaction.draft_picks) && transaction.draft_picks.length > 0)
            })}
            
            {/* Draft picks involved in trades - check both possible locations */}
            {(() => {
              if (transaction.type !== 'trade') return null;
              
              // Check for draft picks in primary location
              const draftPicks = transaction.draft_picks;
              // Check for draft picks in metadata as fallback
              const metadataPicks = transaction.metadata?.traded_picks;
              
              const picksToShow = (draftPicks && Array.isArray(draftPicks) && draftPicks.length > 0) 
                ? draftPicks 
                : (metadataPicks && Array.isArray(metadataPicks) && metadataPicks.length > 0)
                  ? metadataPicks
                  : null;
              
              if (!picksToShow) return null;
              
              return (
                <div className="flex items-center space-x-2 my-2">
                  <span className="text-blue-600 font-medium">Draft Picks:</span>
                  <div className="flex flex-wrap space-x-2">
                    {picksToShow.map((pick, index) => (
                      <div key={index} className="flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">
                            {pick.season} Round {pick.round}
                          </span>
                          <span className="text-xs text-gray-500">
                            (from Roster {pick.previous_owner_id || pick.owner_id} → Roster {pick.roster_id})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            
            {/* Additional details for trades */}
            {transaction.type === 'trade' && (
              <div className="mt-2 text-gray-700">
                <p>
                  Trade between Roster IDs: {transaction.roster_ids.join(', ')}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Transactions;
