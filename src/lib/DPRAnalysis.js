// src/lib/DPRAnalysis.js

import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import PowerRankings from './PowerRankings';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

// ── Module-level metric refs (untouched) ─────────────────────────────────────
let metricsResult = {};
let seasonalMetrics = {};
let calculatedCareerDPRs = [];

// ── Shared style tokens ───────────────────────────────────────────────────────
const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";
const th = "py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";
const thCenter = "py-2.5 px-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10";

const DPRAnalysis = () => {
  const {
    loading: contextLoading,
    error: contextError,
    historicalData,
    allDraftHistory,
    getTeamName,
    nflState,
    getTeamDetails,
  } = useSleeperData();

  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllSeasonal, setShowAllSeasonal] = useState(false);
  const [showEmpirical, setShowEmpirical] = useState(false);

  // ── All calculation logic (completely untouched) ──────────────────────────
  useEffect(() => {
    metricsResult = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
    seasonalMetrics = metricsResult?.seasonalMetrics || {};
    calculatedCareerDPRs = metricsResult?.careerDPRData || [];

    if (contextLoading) { setLoading(true); return; }
    if (contextError) { setLoading(false); return; }

    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
      setCareerDPRData([]); setSeasonalDPRData([]); setLoading(false); return;
    }
    if (typeof getTeamName !== 'function') {
      logger.error("DPRAnalysis: getTeamName is not a function from SleeperDataContext.");
      setLoading(false); setCareerDPRData([]); setSeasonalDPRData([]); return;
    }

    setLoading(true);

    let allSeasonalDPRs = [];
    const allYearsSet = new Set([
      ...Object.keys(seasonalMetrics || {}),
      ...Object.keys(historicalData?.matchupsBySeason || {}),
      ...Object.keys(historicalData?.rostersBySeason || {})
    ].map(Number));
    let currentSeason = null;
    if (allYearsSet.size > 0) currentSeason = Math.max(...Array.from(allYearsSet));

    Object.keys(seasonalMetrics).sort((a, b) => parseInt(b) - parseInt(a)).forEach(year => {
      const teamRawDPRs = [];
      Object.keys(seasonalMetrics[year]).forEach(rosterId => {
        const teamSeasonalData = seasonalMetrics[year][rosterId];
        if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
          let currentOwnerId = teamSeasonalData.ownerId;
          if (!currentOwnerId && historicalData?.rostersBySeason?.[year]) {
            const rosterInHistoricalData = historicalData.rostersBySeason[year].find(r => String(r.roster_id) === String(rosterId));
            if (rosterInHistoricalData) currentOwnerId = rosterInHistoricalData.owner_id;
          }
          const avgScore = teamSeasonalData.averageScore || 0;
          const highScore = teamSeasonalData.highScore || 0;
          const lowScore = teamSeasonalData.lowScore || 0;
          const winPct = teamSeasonalData.winPercentage || 0;
          const rawDPR = (((avgScore * 6) + ((highScore + lowScore) * 2) + ((winPct * 200) * 2)) / 10);
          teamRawDPRs.push(rawDPR);
          allSeasonalDPRs.push({ year: parseInt(year), team: getTeamName(currentOwnerId, year), rosterId, ownerId: currentOwnerId, rawDPR, wins: teamSeasonalData.wins, losses: teamSeasonalData.losses, ties: teamSeasonalData.ties, winPercentage: winPct, pointsPerGame: avgScore, highestPointsGame: highScore, lowestPointsGame: lowScore, isCurrentSeason: currentSeason !== null && parseInt(year) === currentSeason });
        }
      });
      const leagueAvgRawDPR = teamRawDPRs.length > 0 ? (teamRawDPRs.reduce((a, b) => a + b, 0) / teamRawDPRs.length) : 1;
      allSeasonalDPRs.forEach(row => { if (row.year === parseInt(year)) row.dpr = leagueAvgRawDPR > 0 ? (row.rawDPR / leagueAvgRawDPR) : 1.0; });
    });

    allSeasonalDPRs.sort((a, b) => b.dpr - a.dpr);

    const averageDPRValue = 1.000;
    const statRows = allSeasonalDPRs.filter(r => r && r.wins != null && !r.isAverageRow);
    const statCount = statRows.length;
    let avgWins = null, avgLosses = null, avgWinPct = null, avgPPG = null, avgHigh = null, avgLow = null;
    if (statCount > 0) {
      avgWins = Math.round(statRows.reduce((s, r) => s + (r.wins || 0), 0) / statCount);
      avgLosses = Math.round(statRows.reduce((s, r) => s + (r.losses || 0), 0) / statCount);
      avgWinPct = statRows.reduce((s, r) => s + (typeof r.winPercentage === 'number' ? r.winPercentage : 0), 0) / statCount;
      avgPPG = statRows.reduce((s, r) => s + (typeof r.pointsPerGame === 'number' ? r.pointsPerGame : 0), 0) / statCount;
      avgHigh = statRows.reduce((s, r) => s + (typeof r.highestPointsGame === 'number' ? r.highestPointsGame : 0), 0) / statCount;
      avgLow = statRows.reduce((s, r) => s + (typeof r.lowestPointsGame === 'number' ? r.lowestPointsGame : 0), 0) / statCount;
    }
    const averageSeasonRow = { year: null, team: 'Average Season', dpr: averageDPRValue, wins: avgWins, losses: avgLosses, ties: 0, winPercentage: avgWinPct, pointsPerGame: avgPPG, highestPointsGame: avgHigh, lowestPointsGame: avgLow, isAverageRow: true };
    let insertIndex = allSeasonalDPRs.findIndex(data => data.dpr < averageDPRValue);
    if (insertIndex === -1) allSeasonalDPRs.push(averageSeasonRow);
    else allSeasonalDPRs.splice(insertIndex, 0, averageSeasonRow);

    const enhancedCareerDPRs = calculatedCareerDPRs.map(teamData => {
      let highestSeasonalPointsAvg = 0, lowestSeasonalPointsAvg = Infinity, seasonsPlayedCount = 0;
      Object.keys(seasonalMetrics).forEach(year => {
        const teamSeasonalStats = Object.values(seasonalMetrics[year]).find(s => s.ownerId === teamData.ownerId);
        if (teamSeasonalStats) {
          const seasonalGames = teamSeasonalStats.totalGames;
          if (seasonalGames > 0) {
            const seasonalAvg = teamSeasonalStats.pointsFor / seasonalGames;
            if (seasonalAvg > highestSeasonalPointsAvg) highestSeasonalPointsAvg = seasonalAvg;
            if (seasonalAvg < lowestSeasonalPointsAvg) lowestSeasonalPointsAvg = seasonalAvg;
            seasonsPlayedCount++;
          }
        }
      });
      if (seasonsPlayedCount === 0) lowestSeasonalPointsAvg = 0;
      const computedPPG = (typeof teamData.pointsPerGame === 'number' && !isNaN(teamData.pointsPerGame)) ? teamData.pointsPerGame : (typeof teamData.averageScore === 'number' && !isNaN(teamData.averageScore)) ? teamData.averageScore : (teamData.pointsFor && teamData.totalGames) ? (teamData.pointsFor / teamData.totalGames) : 0;
      return { ...teamData, winPercentage: teamData.winPercentage, pointsPerGame: computedPPG, highestSeasonalPointsAvg, lowestSeasonalPointsAvg };
    });

    setCareerDPRData(enhancedCareerDPRs);
    setSeasonalDPRData(allSeasonalDPRs);
    setLoading(false);
  }, [historicalData, allDraftHistory, getTeamName, contextLoading, contextError]);

  // ── Formatters (untouched) ────────────────────────────────────────────────
  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      let formatted = value.toFixed(3);
      if (formatted.startsWith('0.')) formatted = formatted.substring(1);
      else if (formatted.startsWith('-0.')) formatted = `-${formatted.substring(2)}`;
      return `${formatted}%`;
    }
    return '';
  };
  const formatDPR = (dprValue) => typeof dprValue === 'number' && !isNaN(dprValue) ? dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '';
  const formatPoints = (value) => typeof value === 'number' && !isNaN(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const formatPointsAvg = (value) => typeof value === 'number' && !isNaN(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const renderRecord = (wins, losses, ties) => { if (wins === null) return ''; return ties > 0 ? `${wins || 0}-${losses || 0}-${ties}` : `${wins || 0}-${losses || 0}`; };

  const getCurrentNFLSeason = () => { const today = new Date(); const year = today.getFullYear(); const month = today.getMonth(); return (month >= 8) ? year : year - 1; };
  const currentNFLSeason = getCurrentNFLSeason();

  // ── Display logic (untouched) ─────────────────────────────────────────────
  const dedupeRows = (rows) => { const key = (row) => `${row.rosterId}-${row.year}`; const seen = new Set(); const deduped = []; for (const row of rows) { if (!seen.has(key(row))) { deduped.push(row); seen.add(key(row)); } } return deduped; };
  const allRows = dedupeRows(seasonalDPRData);
  allRows.sort((a, b) => b.dpr - a.dpr);
  let displayedSeasonalDPRData;
  if (showAllSeasonal) {
    displayedSeasonalDPRData = allRows;
  } else {
    const avgRowIndex = allRows.findIndex(row => row.isAverageRow);
    if (avgRowIndex >= 0 && avgRowIndex < 20) displayedSeasonalDPRData = allRows.slice(0, 20);
    else { const nonAverageRows = allRows.filter(row => !row.isAverageRow); displayedSeasonalDPRData = nonAverageRows.slice(0, 20); }
  }
  const numberOfSeasonalColumns = 9;
  const dataCurrentSeason = (() => { try { const yrs = seasonalDPRData.map(r => (r && r.year) ? Number(r.year) : null).filter(Boolean); return yrs.length > 0 ? Math.max(...yrs) : currentNFLSeason; } catch (e) { return currentNFLSeason; } })();

  const didMakePlayoffs = (row) => {
    try {
      const year = row.year; const rosterId = row.rosterId;
      if (year && rosterId && seasonalMetrics && seasonalMetrics[year] && seasonalMetrics[year][rosterId]) {
        const meta = seasonalMetrics[year][rosterId];
        const explicitPlayoff = Boolean(meta.isChampion || meta.isRunnerUp || meta.isThirdPlace || meta.isPointsChampion || (typeof meta.playoffAppearancesCount === 'number' && meta.playoffAppearancesCount > 0) || meta.playoffs || meta.playoff || meta.inPlayoffs || meta.clinched || meta.clinchedPlayoff);
        if (explicitPlayoff) return true;
        if (!row.isCurrentSeason && typeof meta.rank === 'number' && meta.rank > 0) return meta.rank <= 6;
      }
      if (!row.isCurrentSeason && typeof row.wins === 'number' && typeof row.losses === 'number') {
        const games = (row.wins || 0) + (row.losses || 0) + (row.ties || 0);
        const pct = games > 0 ? ((row.wins || 0) + 0.5 * (row.ties || 0)) / games : 0;
        return pct >= 0.5;
      }
      return false;
    } catch (e) { return false; }
  };

  const historicalRows = seasonalDPRData.filter(r => r && !r.isAverageRow && typeof r.dpr === 'number' && r.year != null && !r.isCurrentSeason);
  const dprBucketBounds = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3];
  const dprBuckets = [];
  for (let i = 0; i <= dprBucketBounds.length; i++) {
    const min = i === 0 ? -Infinity : dprBucketBounds[i - 1];
    const max = i === dprBucketBounds.length ? Infinity : dprBucketBounds[i];
    const label = min === -Infinity ? `< ${dprBucketBounds[0]}` : (max === Infinity ? `>= ${dprBucketBounds[dprBucketBounds.length - 1]}` : `${min.toFixed(2)} - ${max.toFixed(2)}`);
    dprBuckets.push({ min, max, label, count: 0, made: 0 });
  }
  historicalRows.forEach(row => { const dpr = Number(row.dpr); const made = didMakePlayoffs(row) ? 1 : 0; for (let i = 0; i < dprBuckets.length; i++) { if (dpr > dprBuckets[i].min && dpr <= dprBuckets[i].max) { dprBuckets[i].count += 1; dprBuckets[i].made += made; break; } } });
  const dprBucketStats = dprBuckets.map(b => ({ label: b.label, count: b.count, made: b.made, rate: b.count > 0 ? (b.made / b.count) : null }));
  const getPlayoffProbabilityForDPR = (dprValue) => { if (typeof dprValue !== 'number' || isNaN(dprValue)) return null; for (let i = 0; i < dprBuckets.length; i++) { if (dprValue > dprBuckets[i].min && dprValue <= dprBuckets[i].max) return dprBuckets[i].count > 0 ? (dprBuckets[i].made / dprBuckets[i].count) : null; } return null; };
  const currentSeasonTeams = (seasonalDPRData || []).filter(r => r && r.isCurrentSeason && !r.isAverageRow).map(r => ({ rosterId: r.rosterId, ownerId: r.ownerId, team: r.team, year: r.year, dpr: r.dpr, playoffProb: getPlayoffProbabilityForDPR(Number(r.dpr)) }));

  // ── Avatar helper ─────────────────────────────────────────────────────────
  const Avatar = ({ ownerId, year, border = 'border-white/20' }) => (
    <img
      src={getTeamDetails ? (getTeamDetails(ownerId, year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
      alt={getTeamName(ownerId, year)}
      className={`w-7 h-7 rounded-full border ${border} object-cover flex-shrink-0`}
      onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6">

      {/* Page header */}
      <div className="text-center pt-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">DPR Analysis</h2>
        <p className="text-xs text-gray-500 mt-1">Detailed breakdown of team performance using the DPR (Douchebag Power Rating) metric.</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10 animate-pulse text-sm">Calculating DPR data…</div>
      ) : (
        <>
          {/* ── Career DPR Rankings ── */}
          <div className={card}>
            <div className={cardHeader}>
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Career DPR Rankings</span>
            </div>

            {careerDPRData.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-white/5">
                  {careerDPRData.slice().sort((a, b) => (b.dpr || 0) - (a.dpr || 0)).map((data, index) => (
                    <div key={data.ownerId} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-bold text-gray-600 w-5 flex-shrink-0 text-right">{index + 1}</span>
                          <Avatar ownerId={data.ownerId} year={null} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-200 truncate">{getTeamName(data.ownerId, null)}</div>
                            <div className="text-[10px] text-gray-600">Record: {renderRecord(data.wins, data.losses, data.ties)}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-lg font-bold text-blue-400 tabular-nums">{formatDPR(data.dpr)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[['PPG', formatPointsAvg(data.pointsPerGame), 'text-emerald-400'],
                          ['H / L', `${formatPointsAvg(data.highestSeasonalPointsAvg)} / ${formatPointsAvg(data.lowestSeasonalPointsAvg)}`, 'text-gray-300'],
                          ['Win %', formatPercentage(data.winPercentage), 'text-gray-300']
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
                        <th className={thCenter}>Career DPR</th>
                        <th className={thCenter}>Win %</th>
                        <th className={thCenter}>Record</th>
                        <th className={thCenter}>PPG</th>
                        <th className={thCenter}>Highest Avg</th>
                        <th className={thCenter}>Lowest Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {careerDPRData.slice().sort((a, b) => (b.dpr || 0) - (a.dpr || 0)).map((data, index) => (
                        <tr key={data.ownerId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">{index + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar ownerId={data.ownerId} year={null} />
                              <span className="text-sm font-medium text-gray-200 truncate">{getTeamName(data.ownerId, null)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center text-sm font-bold text-blue-400 tabular-nums">{formatDPR(data.dpr)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPercentage(data.winPercentage)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{renderRecord(data.wins, data.losses, data.ties)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-emerald-400 font-semibold tabular-nums">{formatPointsAvg(data.pointsPerGame)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPointsAvg(data.highestSeasonalPointsAvg)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPointsAvg(data.lowestSeasonalPointsAvg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-sm p-6">No career DPR data available.</p>
            )}
          </div>

          {/* ── Best Seasons by DPR ── */}
          <div className={card}>
            <div className={cardHeader}>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Best Seasons by DPR</span>
            </div>

            {/* ── Empirical Playoff Probability ── */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Empirical Playoff Probability by DPR</span>
                <button
                  type="button"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                  onClick={() => setShowEmpirical(s => !s)}
                  aria-expanded={showEmpirical}
                >
                  {showEmpirical ? 'Hide ▲' : 'Show ▼'}
                </button>
              </div>

              {showEmpirical ? (
                <div className="mt-3 space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className={th}>DPR Range</th>
                          <th className={thCenter}>Samples</th>
                          <th className={thCenter}>Made Playoffs</th>
                          <th className={thCenter}>Empirical %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dprBucketStats.map(b => (
                          <tr key={b.label} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2 px-3 text-gray-300">{b.label}</td>
                            <td className="py-2 px-3 text-center text-gray-400 tabular-nums">{b.count}</td>
                            <td className="py-2 px-3 text-center text-gray-400 tabular-nums">{b.made}</td>
                            <td className="py-2 px-3 text-center font-semibold text-gray-200 tabular-nums">{b.rate === null ? 'N/A' : `${Math.round(b.rate * 100)}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {currentSeasonTeams.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-1">Current Season — Empirical Playoff Probability</p>
                      <p className="text-[10px] text-gray-600 mb-2">Each team's empirical playoff probability for the current season based on historical DPR buckets.</p>
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className={th}>Team</th>
                              <th className={thCenter}>DPR</th>
                              <th className={thCenter}>Empirical %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {currentSeasonTeams.map(t => (
                              <tr key={`${t.rosterId}-${t.year}`} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-2 px-3 text-gray-200">{t.team}</td>
                                <td className="py-2 px-3 text-center text-blue-400 tabular-nums font-semibold">{formatDPR(t.dpr)}</td>
                                <td className="py-2 px-3 text-center font-semibold text-gray-200 tabular-nums">{t.playoffProb === null ? 'N/A' : `${Math.round(t.playoffProb * 100)}%`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-600 mt-1">Click "Show" to view empirical playoff probabilities.</p>
              )}
            </div>

            {seasonalDPRData.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-white/5">
                  {displayedSeasonalDPRData.map((data, idx) => {
                    const isDataCurrent = data.year && Number(data.year) === Number(dataCurrentSeason);
                    if (data.isAverageRow) {
                      return (
                        <div key={`average-${idx}`} className="px-4 py-3 bg-yellow-900/20 border-l-2 border-yellow-500/40">
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-yellow-300">Average Season</div>
                              <div className="text-[10px] text-gray-600">Record: {renderRecord(data.wins, data.losses, data.ties)}</div>
                            </div>
                            <div className="text-lg font-bold text-yellow-300 tabular-nums">{formatDPR(data.dpr)}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[['PPG', formatPointsAvg(data.pointsPerGame), 'text-emerald-400'],
                              ['Win %', formatPercentage(data.winPercentage), 'text-gray-300'],
                              ['H / L', `${formatPointsAvg(data.highestPointsGame)} / ${formatPointsAvg(data.lowestPointsGame)}`, 'text-gray-300']
                            ].map(([label, value, color]) => (
                              <div key={label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                                <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                                <div className={`text-xs font-semibold ${color} tabular-nums`}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`${data.rosterId}-${data.year}`} className={`px-4 py-3 ${isDataCurrent ? 'border-l-2 border-emerald-500/50 bg-emerald-900/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs font-bold text-gray-600 w-5 flex-shrink-0 text-right">{idx + 1}</span>
                            <Avatar ownerId={data.ownerId} year={data.year} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-gray-200 truncate">{getTeamName(data.ownerId, data.year)}</span>
                                {didMakePlayoffs(data) && <span className="text-yellow-400 text-xs" title="Made Playoffs">⭐</span>}
                              </div>
                              <div className="text-[10px] text-gray-600">{data.year} · {renderRecord(data.wins, data.losses, data.ties)}</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-emerald-400 tabular-nums flex-shrink-0 ml-2">{formatDPR(data.dpr)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[['PPG', formatPointsAvg(data.pointsPerGame), 'text-emerald-400'],
                            ['Win %', formatPercentage(data.winPercentage), 'text-gray-300'],
                            ['H / L', `${formatPointsAvg(data.highestPointsGame)} / ${formatPointsAvg(data.lowestPointsGame)}`, 'text-gray-300']
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
                        <th className={thCenter}>DPR</th>
                        <th className={thCenter}>Win %</th>
                        <th className={thCenter}>Record</th>
                        <th className={thCenter}>PPG</th>
                        <th className={thCenter}>Highest</th>
                        <th className={thCenter}>Lowest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        let actualRank = 0;
                        return displayedSeasonalDPRData.map((data, index) => {
                          if (!data.isAverageRow) actualRank++;
                          const isCurrentSeasonRow = data.year && Number(data.year) === Number(dataCurrentSeason) && !data.isAverageRow;

                          if (data.isAverageRow) {
                            return (
                              <tr key={`avg-${index}`} className="bg-yellow-900/20">
                                <td className="py-2.5 px-3 text-gray-600">&nbsp;</td>
                                <td className="py-2.5 px-3 text-sm font-bold text-yellow-300">Average Season</td>
                                <td className="py-2.5 px-3 text-gray-600">&nbsp;</td>
                                <td className="py-2.5 px-3 text-center font-bold text-yellow-300 tabular-nums">{formatDPR(data.dpr)}</td>
                                <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums">{formatPercentage(data.winPercentage)}</td>
                                <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums">{renderRecord(data.wins, data.losses, data.ties)}</td>
                                <td className="py-2.5 px-3 text-center text-emerald-400 font-semibold tabular-nums">{formatPointsAvg(data.pointsPerGame)}</td>
                                <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums">{formatPointsAvg(data.highestPointsGame)}</td>
                                <td className="py-2.5 px-3 text-center text-gray-400 tabular-nums">{formatPointsAvg(data.lowestPointsGame)}</td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={`${data.rosterId}-${data.year}`} className={`hover:bg-white/[0.02] transition-colors ${isCurrentSeasonRow ? 'border-l-2 border-emerald-500/50' : ''}`}>
                              <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">{actualRank}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar ownerId={data.ownerId} year={data.year} />
                                  <span className="text-sm font-medium text-gray-200 truncate">
                                    {getTeamName(data.ownerId, data.year)}
                                    {didMakePlayoffs(data) && <span className="text-yellow-400 ml-1.5 text-xs" title="Made Playoffs">⭐</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-gray-400 tabular-nums">{data.year}</td>
                              <td className="py-2.5 px-3 text-center text-sm font-bold text-emerald-400 tabular-nums">{formatDPR(data.dpr)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPercentage(data.winPercentage)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{renderRecord(data.wins, data.losses, data.ties)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-emerald-400 font-semibold tabular-nums">{formatPointsAvg(data.pointsPerGame)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPointsAvg(data.highestPointsGame)}</td>
                              <td className="py-2.5 px-3 text-center text-xs text-gray-400 tabular-nums">{formatPointsAvg(data.lowestPointsGame)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-sm p-6">No seasonal DPR data available.</p>
            )}

            {seasonalDPRData.length > 20 && (
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

export default DPRAnalysis;