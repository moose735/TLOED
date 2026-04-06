import React, { useMemo, useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getSleeperPlayerHeadshotUrl, fetchTransactionsForWeek } from '../utils/sleeperApi';
import { fetchFinancialDataForYears } from '../services/financialService';
import logger from '../utils/logger';

// ─── Shared UI primitives (matching SeasonBreakdown dark theme) ──────────────

const SectionHeading = ({ children }) => (
    <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{children}</h3>
);

const TableWrapper = ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-sm bg-white/5">
        {children}
    </div>
);

const Th = ({ children, align = 'left' }) => (
    <th className={`py-2.5 px-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/10 text-${align} bg-white/5 whitespace-nowrap`}>
        {children}
    </th>
);

const Td = ({ children, align = 'left', bold }) => (
    <td className={`py-2.5 px-4 text-sm text-gray-200 text-${align}${bold ? ' font-semibold text-white' : ''}`}>
        {children}
    </td>
);

const StatCard = ({ color, label, value }) => {
    const colorMap = {
        blue:   'bg-blue-500/10 border-blue-400/20 text-blue-300',
        green:  'bg-green-500/10 border-green-400/20 text-green-300',
        purple: 'bg-purple-500/10 border-purple-400/20 text-purple-300',
        orange: 'bg-orange-500/10 border-orange-400/20 text-orange-300',
    };
    return (
        <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
};

// ─── TradeHistory ─────────────────────────────────────────────────────────────

const TradeHistory = () => {
  const { transactions = [], nflPlayers = {}, getTeamName, rostersWithDetails = [], historicalData = {}, nflState = {} } = useSleeperData();
  const [sortBy, setSortBy] = useState('trades');
  const [displayMode, setDisplayMode] = useState('top50');
  const [allTransactions, setAllTransactions] = useState([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const leagueTxCache = React.useRef(new Map());

  useEffect(() => {
    (async () => {
      try {
        if (!historicalData || !historicalData.rostersBySeason) {
          setAllTransactions(transactions);
          return;
        }

        const allYears = Object.keys(historicalData.rostersBySeason || {}).sort();
        if (allYears.length === 0) {
          setAllTransactions(transactions);
          return;
        }

        let financialTransactions = [];
        try {
          const financialDataByYear = await fetchFinancialDataForYears(allYears);
          if (financialDataByYear && Array.isArray(financialDataByYear)) {
            financialTransactions = financialDataByYear;
          }
        } catch (e) {}

        let leagueFetchedTransactions = [];
        try {
          const seasonsToFetch = Object.keys(historicalData.leaguesMetadataBySeason || {});
          const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000;

          for (const season of seasonsToFetch) {
            const leagueMeta = historicalData.leaguesMetadataBySeason?.[String(season)];
            const leagueId = leagueMeta?.league_id || leagueMeta?.leagueId || leagueMeta?.id || null;
            if (!leagueId) continue;

            const cached = leagueTxCache.current.get(leagueId);
            if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) {
              leagueFetchedTransactions.push(...cached.transactions);
              continue;
            }

            const weekPromises = [];
            for (let w = 1; w <= 18; w++) {
              weekPromises.push(
                fetchTransactionsForWeek(leagueId, w).catch(err => {
                  logger.debug(`TradeHistory: fetchTransactionsForWeek failed for ${leagueId} week ${w}: ${err}`);
                  return [];
                })
              );
            }
            const results = await Promise.all(weekPromises);
            const seasonTx = results
              .flat()
              .map(tx => { if (tx && !tx.season) tx.season = season; return tx; })
              .filter(Boolean);
            leagueTxCache.current.set(leagueId, { timestamp: Date.now(), transactions: seasonTx });
            leagueFetchedTransactions.push(...seasonTx);
          }
        } catch (e) {
          logger.warn('TradeHistory: error fetching league transactions', e);
        }

        const contextTx = Array.isArray(transactions) ? transactions : [];
        const allTx = [...financialTransactions, ...leagueFetchedTransactions, ...contextTx];

        const txMap = new Map();
        allTx.forEach(tx => {
          const key = tx.transaction_id || JSON.stringify(tx);
          if (!txMap.has(key)) txMap.set(key, tx);
        });

        setAllTransactions(Array.from(txMap.values()));
      } catch (e) {
        logger.warn('TradeHistory: error in transaction fetching', e);
        setAllTransactions(transactions);
      }
    })();
  }, [historicalData, transactions, nflState]);

  const getOwnerIdForRoster = useMemo(() => {
    return (rosterId, year) => {
      if (!historicalData || !historicalData.rostersBySeason) return null;
      const tryYears = [];
      if (year) tryYears.push(String(year));
      tryYears.push(...Object.keys(historicalData.rostersBySeason));
      for (const y of tryYears) {
        const rostersForYear = historicalData.rostersBySeason[y] || [];
        const found = rostersForYear.find(r => String(r.roster_id) === String(rosterId));
        if (found) return String(found.owner_id);
      }
      return null;
    };
  }, [historicalData]);

  const tradeStats = useMemo(() => {
    const playerTrades = {};
    const trackedTransactions = new Set();

    allTransactions.forEach((tx) => {
      if (tx.type !== 'trade') return;
      const adds = tx.adds || {};
      const drops = tx.drops || {};
      const allPlayersInTrade = new Set([...Object.keys(adds), ...Object.keys(drops)]);

      // For each player in this trade, add the trade record only once
      allPlayersInTrade.forEach((playerId) => {
        const pidStr = String(playerId);
        const txKey = `${tx.transaction_id}-${pidStr}`;
        
        if (trackedTransactions.has(txKey)) return;
        trackedTransactions.add(txKey);

        if (!playerTrades[pidStr]) {
          playerTrades[pidStr] = { playerId, trades: [], totalTrades: 0, playerInfo: nflPlayers[pidStr] || {} };
        }

        const addEntry = adds[pidStr];
        const dropEntry = drops[pidStr];
        const addRosterId = addEntry && typeof addEntry === 'object' ? addEntry.roster_id : addEntry;
        const dropRosterId = dropEntry && typeof dropEntry === 'object' ? dropEntry.roster_id : dropEntry;
        const type = addEntry ? 'received' : 'sent';

        const fromRosterId = dropRosterId || Object.keys(drops)
          .map(id => {
            const data = drops[id];
            return data && typeof data === 'object' ? data.roster_id : data;
          })
          .find(id => id != null && String(id) !== String(addRosterId));

        const toRosterId = addRosterId || Object.keys(adds)
          .map(id => {
            const data = adds[id];
            return data && typeof data === 'object' ? data.roster_id : data;
          })
          .find(id => id != null && String(id) !== String(dropRosterId));

        const fromOwnerId = fromRosterId ? getOwnerIdForRoster(fromRosterId, tx.season) : null;
        const toOwnerId = toRosterId ? getOwnerIdForRoster(toRosterId, tx.season) : null;

        const addsArray = Object.keys(adds)
          .map(id => {
            const data = adds[id];
            const rosterId = data && typeof data === 'object' ? data.roster_id : data;
            return { playerId: id, rosterId, ...nflPlayers[id] };
          })
          .filter(p => p.first_name || p.last_name)
          .filter(p => String(p.playerId) !== pidStr || !dropEntry);

        const dropsArray = Object.keys(drops)
          .map(id => {
            const data = drops[id];
            const rosterId = data && typeof data === 'object' ? data.roster_id : data;
            return { playerId: id, rosterId, ...nflPlayers[id] };
          })
          .filter(p => p.first_name || p.last_name)
          .filter(p => !(String(p.playerId) === pidStr && addEntry));

        playerTrades[pidStr].trades.push({ 
          transactionId: tx.transaction_id, 
          type,
          week: tx.leg, 
          created: tx.created, 
          season: tx.season,
          adds: addsArray,
          drops: dropsArray,
          fromRosterId,
          toRosterId,
          fromTeam: fromOwnerId ? getTeamName(fromOwnerId, tx.season) : null,
          toTeam: toOwnerId ? getTeamName(toOwnerId, tx.season) : null,
          rosterIds: tx.roster_ids || []
        });
        playerTrades[pidStr].totalTrades++;
      });
    });

    let players = Object.values(playerTrades)
      .filter((p) => p.totalTrades > 0)
      .map((p) => {
        const playerInfo = p.playerInfo;
        return {
          ...p,
          name: `${playerInfo.first_name || ''} ${playerInfo.last_name || ''}`.trim(),
          position: playerInfo.position || 'N/A',
          nflTeam: playerInfo.team || 'N/A',
        };
      });

    if (sortBy === 'trades') {
      players.sort((a, b) => b.totalTrades - a.totalTrades);
    } else {
      players.sort((a, b) => a.name.localeCompare(b.name));
    }

    return players;
  }, [allTransactions, nflPlayers, sortBy]);

  const displayedPlayers = displayMode === 'all' ? tradeStats : tradeStats.slice(0, 50);
  const maxTrades = tradeStats.reduce((max, player) => Math.max(max, player.totalTrades || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {/* Page Header */}
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Trade History</h2>
        <p className="text-sm text-gray-400 mt-0.5">Career trade frequency across all seasons</p>
      </div>

      {/* ── Most Traded Players ───────────────────────────────────────── */}
      <div className="space-y-6">

          {/* Sort Controls */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'trades', label: 'Sort by Trades' },
                { key: 'name',   label: 'Sort by Name'   },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    sortBy === opt.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-widest text-gray-400">Show</label>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/10 text-sm text-gray-200 px-3 py-2 outline-none hover:border-white/20"
              >
                <option value="top50">Top 50</option>
                <option value="all">All players</option>
              </select>
            </div>
          </div>

          {tradeStats.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">No trade data available.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {tradeStats.length} players traded · showing {displayMode === 'all' ? 'all' : 'top 50'}
              </p>

              {/* Desktop table */}
              <TableWrapper>
                <table className="hidden md:table min-w-full bg-transparent">
                  <thead>
                    <tr>
                      <Th>#</Th>
                      <Th>Player</Th>
                      <Th>Position</Th>
                      <Th>NFL Team</Th>
                      <Th align="center">Trades</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayedPlayers.map((player, idx) => (
                      <React.Fragment key={player.playerId}>
                        <tr
                          onClick={() => setExpandedPlayerId(expandedPlayerId === player.playerId ? null : player.playerId)}
                          className="hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Td bold>{idx + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-3">
                              <img
                                src={getSleeperPlayerHeadshotUrl(player.playerId)}
                                alt={player.name}
                                className="w-8 h-8 rounded-full object-cover bg-white/10"
                                onError={(e) => { e.target.src = 'https://sleepercdn-prod.s3.amazonaws.com/content/nfl_generic.png'; }}
                              />
                              <span className="font-medium text-white">{player.name}</span>
                            </div>
                          </Td>
                          <Td>{player.position}</Td>
                          <Td>{player.nflTeam}</Td>
                          <Td align="center">
                            <span className="inline-block bg-blue-500/20 text-blue-300 font-bold px-3 py-0.5 rounded-full text-xs border border-blue-400/20">
                              {player.totalTrades}
                            </span>
                          </Td>
                        </tr>
                        {expandedPlayerId === player.playerId && (
                          <tr>
                            <td colSpan="5" className="px-4 py-4 bg-white/[0.02]">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-white text-sm">Trade Details</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {player.trades.map((trade, tradeIdx) => {
                                    return (
                                      <div key={tradeIdx} className="bg-white/5 rounded-lg border border-white/10 p-3 text-sm space-y-2">
                                        <div>
                                          <div className="text-gray-300 text-xs">
                                            Week {trade.week}{trade.season ? ` · Season ${trade.season}` : ''}
                                          </div>
                                          {trade.created && (
                                            <div className="text-gray-500 text-xs mt-0.5">
                                              {new Date(trade.created).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>

                                        {(trade.fromTeam || trade.toTeam) && (
                                          <div className="grid gap-2 sm:grid-cols-2">
                                            {trade.fromTeam && (
                                              <div className="bg-white/[0.05] rounded p-2 text-xs">
                                                <div className="text-gray-400 uppercase tracking-wide">From</div>
                                                <div className="text-gray-200 font-semibold">{trade.fromTeam}</div>
                                              </div>
                                            )}
                                            {trade.toTeam && (
                                              <div className="bg-white/[0.05] rounded p-2 text-xs">
                                                <div className="text-gray-400 uppercase tracking-wide">To</div>
                                                <div className="text-gray-200 font-semibold">{trade.toTeam}</div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {displayedPlayers.map((player, idx) => (
                  <div key={player.playerId} className="space-y-1">
                    <div
                      onClick={() => setExpandedPlayerId(expandedPlayerId === player.playerId ? null : player.playerId)}
                      className="bg-white/10 rounded-xl border border-white/10 p-3.5 flex items-center gap-3 cursor-pointer hover:bg-white/15 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <img
                        src={getSleeperPlayerHeadshotUrl(player.playerId)}
                        alt={player.name}
                        className="w-9 h-9 rounded-full object-cover bg-white/10 flex-shrink-0"
                        onError={(e) => { e.target.src = 'https://sleepercdn-prod.s3.amazonaws.com/content/nfl_generic.png'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{player.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{player.position} · {player.nflTeam}</div>
                      </div>
                      <span className="flex-shrink-0 bg-blue-500/20 text-blue-300 font-bold px-2.5 py-0.5 rounded-full text-xs border border-blue-400/20">
                        {player.totalTrades}
                      </span>
                    </div>
                    {expandedPlayerId === player.playerId && (
                      <div className="bg-white/[0.02] rounded-xl border border-white/10 p-3.5 ml-2">
                        <h4 className="font-semibold text-white text-sm mb-3">Trade Details</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {player.trades.map((trade, tradeIdx) => {
                            return (
                              <div key={tradeIdx} className="bg-white/5 rounded-lg border border-white/10 p-2.5 text-xs space-y-1.5">
                                <div className="text-gray-300 text-xs mt-1">
                                  Week {trade.week}{trade.season ? ` · S${trade.season}` : ''}
                                </div>
                                {trade.created && (
                                  <div className="text-gray-500 text-xs">
                                    {new Date(trade.created).toLocaleDateString()}
                                  </div>
                                )}

                                {(trade.fromTeam || trade.toTeam) && (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {trade.fromTeam && (
                                      <div className="bg-white/[0.05] rounded px-1.5 py-1 text-xs">
                                        <div className="text-gray-400 uppercase tracking-wide">From</div>
                                        <div className="text-gray-200 font-semibold">{trade.fromTeam}</div>
                                      </div>
                                    )}
                                    {trade.toTeam && (
                                      <div className="bg-white/[0.05] rounded px-1.5 py-1 text-xs">
                                        <div className="text-gray-400 uppercase tracking-wide">To</div>
                                        <div className="text-gray-200 font-semibold">{trade.toTeam}</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Stats footer */}
          <div className="pt-6 border-t border-white/10">
            <SectionHeading>Trade Statistics</SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard color="blue"   label="Total Trades"      value={transactions.filter(tx => tx.type === 'trade').length} />
              <StatCard color="green"  label="Players Traded"    value={tradeStats.length} />
              <StatCard color="purple" label="Avg Trades/Player" value={
                tradeStats.length > 0
                  ? (transactions.filter(tx => tx.type === 'trade').length / tradeStats.length).toFixed(1)
                  : 0
              } />
              <StatCard color="orange" label="Most Traded"       value={maxTrades} />
            </div>
          </div>
        </div>
    </div>
  );
};

export default TradeHistory;