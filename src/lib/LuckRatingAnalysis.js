// src/lib/LuckRatingAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

// ── Shared style tokens ───────────────────────────────────────────────────────
const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";
const th = "py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";
const thCenter = "py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";

const LuckRatingAnalysis = () => {
  const {
    loading: contextLoading,
    error: contextError,
    historicalData,
    allDraftHistory,
    getTeamName,
    getTeamDetails,
    nflState
  } = useSleeperData();

  const [careerLuckData, setCareerLuckData] = useState([]);
  const [seasonalLuckData, setSeasonalLuckData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllSeasonal, setShowAllSeasonal] = useState(false);

  // ── All calculation logic (completely untouched) ──────────────────────────
  useEffect(() => {
    if (contextLoading) { setLoading(true); return; }
    if (contextError) { setLoading(false); return; }
    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
      setCareerLuckData([]); setSeasonalLuckData([]); setLoading(false); return;
    }
    if (typeof getTeamName !== 'function') {
      logger.error("LuckRatingAnalysis: getTeamName is not a function from SleeperDataContext.");
      setLoading(false); setCareerLuckData([]); setSeasonalLuckData([]); return;
    }

    setLoading(true);

    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);

    const allSeasonalLuckRatings = [];
    const currentNFLSeason = nflState?.season ? parseInt(nflState.season) : new Date().getFullYear();

    Object.keys(seasonalMetrics).forEach(yearStr => {
      const year = parseInt(yearStr);
      if (year === currentNFLSeason) {
        const allMatchupsForYear = historicalData.matchupsBySeason?.[year] || [];
        const week1Matchups = allMatchupsForYear.filter(m => String(m.week) === '1');
        if (week1Matchups.length === 0) {
          logger.debug(`LuckRatingAnalysis: Skipping year ${year} (current season) as Week 1 data is not available.`);
          return;
        }
      }
      Object.keys(seasonalMetrics[year]).forEach(rosterId => {
        const teamData = seasonalMetrics[year][rosterId];
        if (teamData && typeof teamData.luckRating === 'number' && !isNaN(teamData.luckRating) && typeof teamData.actualWinsRecord === 'number' && !isNaN(teamData.actualWinsRecord) && typeof teamData.seasonalExpectedWinsSum === 'number' && !isNaN(teamData.seasonalExpectedWinsSum)) {
          allSeasonalLuckRatings.push({ year: parseInt(year), team: getTeamName(teamData.ownerId, year), ownerId: teamData.ownerId, luckRating: teamData.luckRating, actualWins: teamData.actualWinsRecord, projectedWins: teamData.seasonalExpectedWinsSum });
        }
      });
    });

    allSeasonalLuckRatings.sort((a, b) => b.luckRating - a.luckRating);
    setSeasonalLuckData(allSeasonalLuckRatings);

    const allCareerLuckRatings = [];
    calculatedCareerDPRs.forEach(careerStats => {
      if (careerStats && typeof careerStats.totalLuckRating === 'number' && !isNaN(careerStats.totalLuckRating) && typeof careerStats.actualCareerWinsRecord === 'number' && !isNaN(careerStats.actualCareerWinsRecord) && typeof careerStats.careerExpectedWinsSum === 'number' && !isNaN(careerStats.careerExpectedWinsSum)) {
        allCareerLuckRatings.push({ team: getTeamName(careerStats.ownerId, null), ownerId: careerStats.ownerId, luckRating: careerStats.totalLuckRating, actualWins: careerStats.actualCareerWinsRecord, projectedWins: careerStats.careerExpectedWinsSum });
      }
    });

    allCareerLuckRatings.sort((a, b) => b.luckRating - a.luckRating);
    setCareerLuckData(allCareerLuckRatings);
    setLoading(false);
  }, [historicalData, allDraftHistory, getTeamName, nflState, contextLoading, contextError]);

  // ── Formatters (untouched) ────────────────────────────────────────────────
  const formatLuckRating = (value) => {
    if (typeof value === 'number' && !isNaN(value)) return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    return 'N/A';
  };

  const displayedSeasonalLuckData = showAllSeasonal ? seasonalLuckData : seasonalLuckData.slice(0, 20);
  const currentNFLSeason = nflState?.season ? parseInt(nflState.season) : new Date().getFullYear();
  const dataCurrentSeason = (() => { try { const yrs = seasonalLuckData.map(r => (r && r.year) ? Number(r.year) : null).filter(Boolean); return yrs.length > 0 ? Math.max(...yrs) : currentNFLSeason; } catch (e) { return currentNFLSeason; } })();

  // ── Luck color helper ─────────────────────────────────────────────────────
  const luckColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-500';

  // ── Avatar helper ─────────────────────────────────────────────────────────
  const Avatar = ({ ownerId, year }) => (
    <img
      src={getTeamDetails ? (getTeamDetails(ownerId, year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
      alt={getTeamName(ownerId, year)}
      className="w-7 h-7 rounded-full border border-white/20 object-cover flex-shrink-0"
      onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6">

      {/* Page header */}
      <div className="text-center pt-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Luck Rating Analysis</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-xl mx-auto">
          How much luckier or unluckier a team was compared to their projected wins if every possible matchup
          were played week-by-week. Positive = luckier, negative = unluckier. Regular season only.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10 animate-pulse text-sm">Calculating luck ratings…</div>
      ) : (
        <>
          {/* ── Career Luck Rankings ── */}
          <div className={card}>
            <div className={cardHeader}>
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Career Luck Rankings</span>
            </div>

            {careerLuckData.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-white/5">
                  {careerLuckData.slice().sort((a, b) => (b.luckRating || 0) - (a.luckRating || 0)).map((data, index) => (
                    <div key={data.team} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-bold text-gray-600 w-5 flex-shrink-0 text-right">{index + 1}</span>
                          <Avatar ownerId={data.ownerId} year={null} />
                          <span className="text-sm font-semibold text-gray-200 truncate">{data.team}</span>
                        </div>
                        <div className={`text-lg font-bold tabular-nums flex-shrink-0 ml-2 ${luckColor(data.luckRating)}`}>
                          {formatLuckRating(data.luckRating)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[['Actual Wins', data.actualWins, 'text-gray-300'],
                          ['Projected Wins', formatLuckRating(data.projectedWins), 'text-gray-300']
                        ].map(([label, value, color]) => (
                          <div key={label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                            <div className={`text-xs font-semibold ${color} tabular-nums`}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>Team</th>
                        <th className={thCenter}>Career Luck</th>
                        <th className={thCenter}>Actual Wins</th>
                        <th className={thCenter}>Projected Wins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {careerLuckData.slice().sort((a, b) => (b.luckRating || 0) - (a.luckRating || 0)).map((data, index) => (
                        <tr key={data.team} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">{index + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar ownerId={data.ownerId} year={null} />
                              <span className="text-sm font-medium text-gray-200 truncate">{data.team}</span>
                            </div>
                          </td>
                          <td className={`py-2.5 px-3 text-center text-sm font-bold tabular-nums ${luckColor(data.luckRating)}`}>{formatLuckRating(data.luckRating)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums font-semibold">{data.actualWins}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums font-semibold">{formatLuckRating(data.projectedWins)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-sm p-6">No career luck data available.</p>
            )}
          </div>

          {/* ── Seasonal Luck Rankings ── */}
          <div className={card}>
            <div className={cardHeader}>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Seasonal Luck Rankings</span>
            </div>

            {seasonalLuckData.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-white/5">
                  {displayedSeasonalLuckData.map((data, idx) => {
                    const isCurrent = Number(data.year) === Number(dataCurrentSeason);
                    return (
                      <div key={`${data.team}-${data.year}`} className={`px-4 py-3 ${isCurrent ? 'border-l-2 border-emerald-500/50 bg-emerald-900/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs font-bold text-gray-600 w-5 flex-shrink-0 text-right">{idx + 1}</span>
                            <Avatar ownerId={data.ownerId} year={data.year} />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-200 truncate">{data.team}</div>
                              <div className="text-[10px] text-gray-600">{data.year}</div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold tabular-nums flex-shrink-0 ml-2 ${luckColor(data.luckRating)}`}>
                            {formatLuckRating(data.luckRating)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[['Actual Wins', data.actualWins, 'text-gray-300'],
                            ['Projected Wins', formatLuckRating(data.projectedWins), 'text-gray-300']
                          ].map(([label, value, color]) => (
                            <div key={label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                              <div className={`text-xs font-semibold ${color} tabular-nums`}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>Team</th>
                        <th className={th}>Season</th>
                        <th className={thCenter}>Luck Rating</th>
                        <th className={thCenter}>Actual Wins</th>
                        <th className={thCenter}>Projected Wins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        let actualRank = 0;
                        return displayedSeasonalLuckData.map((data, index) => {
                          actualRank++;
                          const isCurrent = data.year && Number(data.year) === Number(dataCurrentSeason);
                          return (
                            <tr key={`${data.team}-${data.year}`} className={`hover:bg-white/[0.02] transition-colors ${isCurrent ? 'border-l-2 border-emerald-500/50' : ''}`}>
                              <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">{actualRank}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar ownerId={data.ownerId} year={data.year} />
                                  <span className="text-sm font-medium text-gray-200 truncate">{data.team}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-gray-400 tabular-nums">{data.year}</td>
                              <td className={`py-2.5 px-3 text-center text-sm font-bold tabular-nums ${luckColor(data.luckRating)}`}>{formatLuckRating(data.luckRating)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums font-semibold">{data.actualWins}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums font-semibold">{formatLuckRating(data.projectedWins)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-sm p-6">No seasonal luck data available.</p>
            )}

            {seasonalLuckData.length > 20 && (
              <div className="px-4 py-3 border-t border-white/10 text-center">
                <button
                  onClick={() => setShowAllSeasonal(!showAllSeasonal)}
                  className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors"
                >
                  {showAllSeasonal ? 'Show Less ▲' : 'Show All Seasons ▼'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LuckRatingAnalysis;