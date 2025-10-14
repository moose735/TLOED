// src/lib/DPRAnalysis.js

import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import PowerRankings from './PowerRankings';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook
import logger from '../utils/logger';

// Always define metrics at the top level so it's available everywhere
let metricsResult = {};
let seasonalMetrics = {};
let calculatedCareerDPRs = [];

const DPRAnalysis = () => {
  const {
    loading: contextLoading, // Rename to avoid conflict with local loading state
    error: contextError,      // Rename to avoid conflict with local error state
    historicalData,
    allDraftHistory, // FIXED: Import allDraftHistory from context
  getTeamName,
  nflState, // Import nflState to get current week
  getTeamDetails,
  } = useSleeperData();

  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true); // Local loading state for calculations
  const [showAllSeasonal, setShowAllSeasonal] = useState(false); // New state for "Show More"
  const [showEmpirical, setShowEmpirical] = useState(false); // Collapsible empirical DPR section (collapsed by default)

  useEffect(() => {
    // Always define metrics before any other logic
    metricsResult = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
    seasonalMetrics = metricsResult?.seasonalMetrics || {};
    calculatedCareerDPRs = metricsResult?.careerDPRData || [];

    // If context is still loading or has an error, set local loading/error states accordingly
    if (contextLoading) {
      setLoading(true);
      return;
    }
    if (contextError) {
      setLoading(false);
      // You might want to display contextError message in the UI here as well
      return;
    }

    // Check if historicalData is available and has any matchup data
    // historicalData.matchupsBySeason is an object where keys are years
    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
      setCareerDPRData([]);
      setSeasonalDPRData([]);
      setLoading(false);
      return;
    }

    // FIXED: Add a defensive check to ensure getTeamName is a function
    if (typeof getTeamName !== 'function') {
    logger.error("DPRAnalysis: getTeamName is not a function from SleeperDataContext. Cannot perform calculations.");
        setLoading(false);
        setCareerDPRData([]);
        setSeasonalDPRData([]);
        // Optionally, display an error message to the user
        // setError(new Error("Team name resolution function is unavailable."));
        return;
    }

    setLoading(true);

    let allSeasonalDPRs = [];
    // Find all years present in any data source (seasonalMetrics, matchupsBySeason, rostersBySeason)
    const allYearsSet = new Set([
      ...Object.keys(seasonalMetrics || {}),
      ...Object.keys(historicalData?.matchupsBySeason || {}),
      ...Object.keys(historicalData?.rostersBySeason || {})
    ].map(Number));
    // Always use the max year found as the current season (matches LuckAnalysis logic)
    let currentSeason = null;
    if (allYearsSet.size > 0) {
      currentSeason = Math.max(...Array.from(allYearsSet));
    }

    // For each season, calculate raw DPRs and adjusted DPRs
    Object.keys(seasonalMetrics).sort((a, b) => parseInt(b) - parseInt(a)).forEach(year => {
      const teamRawDPRs = [];
      Object.keys(seasonalMetrics[year]).forEach(rosterId => {
        const teamSeasonalData = seasonalMetrics[year][rosterId];
        // Only include teams with at least one completed game (like LuckRatingAnalysis)
        if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
          let currentOwnerId = teamSeasonalData.ownerId;
          if (!currentOwnerId && historicalData?.rostersBySeason?.[year]) {
            const rosterInHistoricalData = historicalData.rostersBySeason[year].find(
              (r) => String(r.roster_id) === String(rosterId)
            );
            if (rosterInHistoricalData) currentOwnerId = rosterInHistoricalData.owner_id;
          }
          // Calculate Raw DPR
          const avgScore = teamSeasonalData.averageScore || 0;
          const highScore = teamSeasonalData.highScore || 0;
          const lowScore = teamSeasonalData.lowScore || 0;
          const winPct = teamSeasonalData.winPercentage || 0;
          const rawDPR = (((avgScore * 6) + ((highScore + lowScore) * 2) + ((winPct * 200) * 2)) / 10);
          teamRawDPRs.push(rawDPR);
          allSeasonalDPRs.push({
            year: parseInt(year),
            team: getTeamName(currentOwnerId, year),
            rosterId: rosterId,
            ownerId: currentOwnerId,
            rawDPR,
            wins: teamSeasonalData.wins,
            losses: teamSeasonalData.losses,
            ties: teamSeasonalData.ties,
            winPercentage: winPct,
            pointsPerGame: avgScore,
            highestPointsGame: highScore,
            lowestPointsGame: lowScore,
            isCurrentSeason: currentSeason !== null && parseInt(year) === currentSeason
          });
        }
      });
      // Calculate league average Raw DPR for this season
      const leagueAvgRawDPR = teamRawDPRs.length > 0 ? (teamRawDPRs.reduce((a, b) => a + b, 0) / teamRawDPRs.length) : 1;
      // Assign adjusted DPR for each team in this season
      allSeasonalDPRs.forEach((row) => {
        if (row.year === parseInt(year)) {
          row.dpr = leagueAvgRawDPR > 0 ? (row.rawDPR / leagueAvgRawDPR) : 1.0;
        }
      });
    });

    // No need to separately inject current season rows here; handled above like LuckRatingAnalysis

    // Sort the consolidated seasonal DPR data by DPR descending
    allSeasonalDPRs.sort((a, b) => b.dpr - a.dpr);

    // Insert the "AVERAGE SEASON" row
    const averageDPRValue = 1.000;
    // Compute average stats across seasonal rows (exclude any rows that might be special)
    const statRows = allSeasonalDPRs.filter(r => r && r.wins != null && !r.isAverageRow);
    const statCount = statRows.length;
    let avgWins = null, avgLosses = null, avgWinPct = null, avgPPG = null, avgHigh = null, avgLow = null;
    if (statCount > 0) {
      const sumWins = statRows.reduce((s, r) => s + (r.wins || 0), 0);
      const sumLosses = statRows.reduce((s, r) => s + (r.losses || 0), 0);
      const sumWinPct = statRows.reduce((s, r) => s + (typeof r.winPercentage === 'number' ? r.winPercentage : 0), 0);
      const sumPPG = statRows.reduce((s, r) => s + (typeof r.pointsPerGame === 'number' ? r.pointsPerGame : 0), 0);
      const sumHigh = statRows.reduce((s, r) => s + (typeof r.highestPointsGame === 'number' ? r.highestPointsGame : 0), 0);
      const sumLow = statRows.reduce((s, r) => s + (typeof r.lowestPointsGame === 'number' ? r.lowestPointsGame : 0), 0);
      avgWins = Math.round(sumWins / statCount);
      avgLosses = Math.round(sumLosses / statCount);
      avgWinPct = sumWinPct / statCount;
      avgPPG = sumPPG / statCount;
      avgHigh = sumHigh / statCount;
      avgLow  = sumLow / statCount;
    }

    const averageSeasonRow = {
      year: null, // Set to null so formatters can ignore it
      team: 'Average Season',
      dpr: averageDPRValue, // Keep DPR for sorting purposes
      wins: avgWins,
      losses: avgLosses,
      ties: 0,
      winPercentage: avgWinPct,
      pointsPerGame: avgPPG,
      highestPointsGame: avgHigh,
      lowestPointsGame: avgLow,
      isAverageRow: true // A flag to identify this special row
    };

    // Find the correct position to insert the average season row
    let insertIndex = allSeasonalDPRs.findIndex(data => data.dpr < averageDPRValue);
    if (insertIndex === -1) {
      // If no DPR is less than average, insert at the end
      allSeasonalDPRs.push(averageSeasonRow);
    } else {
      allSeasonalDPRs.splice(insertIndex, 0, averageSeasonRow);
    }

  // --- Career DPR Calculation (unchanged, but could be updated to use new formula if needed) ---
  const enhancedCareerDPRs = calculatedCareerDPRs.map(teamData => {
    let highestSeasonalPointsAvg = 0;
    let lowestSeasonalPointsAvg = Infinity;
    let seasonsPlayedCount = 0;

    Object.keys(seasonalMetrics).forEach(year => {
      const teamSeasonalStats = Object.values(seasonalMetrics[year]).find(
        (seasonalTeam) => seasonalTeam.ownerId === teamData.ownerId
      );

      if (teamSeasonalStats) {
        const seasonalGames = teamSeasonalStats.totalGames;

        if (seasonalGames > 0) {
          const seasonalAvg = teamSeasonalStats.pointsFor / seasonalGames;
          if (seasonalAvg > highestSeasonalPointsAvg) {
            highestSeasonalPointsAvg = seasonalAvg;
          }
          if (seasonalAvg < lowestSeasonalPointsAvg) {
            lowestSeasonalPointsAvg = seasonalAvg;
          }
          seasonsPlayedCount++;
        }
      }
    });

    if (seasonsPlayedCount === 0) {
      lowestSeasonalPointsAvg = 0;
    }

    // Some upstream calculations provide `averageScore` for career rows; normalize to `pointsPerGame` here
    const computedPPG = (typeof teamData.pointsPerGame === 'number' && !isNaN(teamData.pointsPerGame))
      ? teamData.pointsPerGame
      : (typeof teamData.averageScore === 'number' && !isNaN(teamData.averageScore))
        ? teamData.averageScore
        : (teamData.pointsFor && teamData.totalGames) ? (teamData.pointsFor / teamData.totalGames) : 0;

    return {
      ...teamData,
      winPercentage: teamData.winPercentage,
      pointsPerGame: computedPPG,
      highestSeasonalPointsAvg: highestSeasonalPointsAvg,
      lowestSeasonalPointsAvg: lowestSeasonalPointsAvg
    };
  });

    setCareerDPRData(enhancedCareerDPRs);
    setSeasonalDPRData(allSeasonalDPRs);
    setLoading(false);

  }, [historicalData, allDraftHistory, getTeamName, contextLoading, contextError]); // Dependencies updated

  // Formatter for win percentage (consistent with LeagueHistory)
  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      let formatted = value.toFixed(3); // Keep as decimal, fix to 3 places
      if (formatted.startsWith('0.')) {
        formatted = formatted.substring(1); // Remove the leading '0' for values between 0 and 1
      } else if (formatted.startsWith('-0.')) {
        formatted = `-${formatted.substring(2)}`; // Remove '-0' for negative values between -1 and 0
      }
      return `${formatted}%`;
    }
    return ''; // Return empty string for non-numeric or null values
  };

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return ''; // Return empty string for non-numeric or null values
  };

  const formatPoints = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return ''; // Return empty string for non-numeric or null values
  };

  // New formatter for points average (similar to formatPoints)
  const formatPointsAvg = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return ''; // Return empty string for non-numeric or null values
  };

  const renderRecord = (wins, losses, ties) => {
    if (wins === null) return ''; // Check for null to handle the average row
    if (ties > 0) {
      return `${wins || 0}-${losses || 0}-${ties}`;
    }
    return `${wins || 0}-${losses || 0}`;
  };

  // Use the real current NFL season (from system date or constant)
  // You can replace this with a dynamic value if you have nflState or similar available
  const getCurrentNFLSeason = () => {
    // Use system date to determine NFL season (September or later = current year, else previous year)
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed: 0=Jan, 8=Sep
    return (month >= 8) ? year : year - 1;
  };
  const currentNFLSeason = getCurrentNFLSeason();

  // Always show all current season rows, even if not in top 20, when Show All is off
  let displayedSeasonalDPRData;
  // Helper to dedupe by rosterId and year
  const dedupeRows = (rows) => {
    const key = (row) => `${row.rosterId}-${row.year}`;
    const seen = new Set();
    const deduped = [];
    for (const row of rows) {
      if (!seen.has(key(row))) {
        deduped.push(row);
        seen.add(key(row));
      }
    }
    return deduped;
  };

  // Always dedupe and sort the full list, then slice top 20 for above the button
  const allRows = dedupeRows(seasonalDPRData);
  allRows.sort((a, b) => b.dpr - a.dpr);
  if (showAllSeasonal) {
    displayedSeasonalDPRData = allRows;
  } else {
    // Find the position of the average row in the sorted list
    const avgRowIndex = allRows.findIndex(row => row.isAverageRow);
    if (avgRowIndex >= 0 && avgRowIndex < 20) {
      // Average row naturally falls in top 20, show it in its correct position
      displayedSeasonalDPRData = allRows.slice(0, 20);
    } else {
      // Average row is not in top 20, only show non-average rows
      const nonAverageRows = allRows.filter(row => !row.isAverageRow);
      displayedSeasonalDPRData = nonAverageRows.slice(0, 20);
    }
  }

  // Determine the number of columns for the colSpan
  const numberOfSeasonalColumns = 9; // Rank, Team, Season, Season DPR, Win %, Record, Points Avg, Highest Points, Lowest Points

  // Determine current season from available seasonal data to keep highlighting consistent
  const dataCurrentSeason = (() => {
    try {
      const yrs = seasonalDPRData.map(r => (r && r.year) ? Number(r.year) : null).filter(Boolean);
      return yrs.length > 0 ? Math.max(...yrs) : currentNFLSeason;
    } catch (e) {
      return currentNFLSeason;
    }
  })();

  // Helper: determine whether a seasonal row indicates the team made the playoffs
  const didMakePlayoffs = (row) => {
    try {
      // Prefer explicit flags in seasonalMetrics if available
      const year = row.year;
      const rosterId = row.rosterId;
      if (year && rosterId && seasonalMetrics && seasonalMetrics[year] && seasonalMetrics[year][rosterId]) {
        const meta = seasonalMetrics[year][rosterId];
        // if any of these explicit flags are present, they participated in playoff bracket
        // include several possible flag names to be defensive about data shape
        const explicitPlayoff = Boolean(
          meta.isChampion ||
          meta.isRunnerUp ||
          meta.isThirdPlace ||
          meta.isPointsChampion ||
          (typeof meta.playoffAppearancesCount === 'number' && meta.playoffAppearancesCount > 0) ||
          meta.playoffs ||
          meta.playoff ||
          meta.inPlayoffs ||
          meta.clinched ||
          meta.clinchedPlayoff
        );
        if (explicitPlayoff) return true;

        // Some data sets use 'rank' to identify playoff teams (e.g., top 6).
        // Only use a rank-based heuristic for PAST seasons — do NOT assume current-season ranks imply playoff status.
        if (!row.isCurrentSeason && typeof meta.rank === 'number' && meta.rank > 0) {
          // assume top 6 qualify by default unless league settings available; this is a reasonable heuristic for past seasons
          return meta.rank <= 6;
        }
      }

      // Fallback heuristic (based on .500 record) should only apply to past seasons.
      if (!row.isCurrentSeason && typeof row.wins === 'number' && typeof row.losses === 'number') {
        const games = (row.wins || 0) + (row.losses || 0) + (row.ties || 0);
        // conservative: require >= .500 to count as making playoffs in fallback
        const pct = games > 0 ? ((row.wins || 0) + 0.5 * (row.ties || 0)) / games : 0;
        return pct >= 0.5;
      }

      // For current season rows without explicit playoff/clinch flags, do not claim they made the playoffs.
      return false;
    } catch (e) {
      return false;
    }
  };

  // --- Playoff probability estimation based on historical DPR ---
  // Build historical rows (exclude average row, null DPRs, and CURRENT season rows)
  const historicalRows = seasonalDPRData.filter(r => r && !r.isAverageRow && typeof r.dpr === 'number' && r.year != null && !r.isCurrentSeason);

  // Define fixed DPR buckets (adjust boundaries if desired)
  const dprBucketBounds = [0.8, 0.9, 1.0, 1.1, 1.2];
  const dprBuckets = [];
  // Prepare bucket structures
  for (let i = 0; i <= dprBucketBounds.length; i++) {
    const min = i === 0 ? -Infinity : dprBucketBounds[i - 1];
    const max = i === dprBucketBounds.length ? Infinity : dprBucketBounds[i];
    const label = min === -Infinity
      ? `< ${dprBucketBounds[0]}`
      : (max === Infinity
        ? `>= ${dprBucketBounds[dprBucketBounds.length - 1]}`
        : `${min.toFixed(2)} - ${max.toFixed(2)}`);
    dprBuckets.push({ min, max, label, count: 0, made: 0 });
  }

  // Populate bucket counts using historical rows
  historicalRows.forEach(row => {
    const dpr = Number(row.dpr);
    const made = didMakePlayoffs(row) ? 1 : 0;
    for (let i = 0; i < dprBuckets.length; i++) {
      if (dpr > dprBuckets[i].min && dpr <= dprBuckets[i].max) {
        dprBuckets[i].count += 1;
        dprBuckets[i].made += made;
        break;
      }
    }
  });

  // Compute empirical rates and safety for small samples
  const dprBucketStats = dprBuckets.map(b => ({
    label: b.label,
    count: b.count,
    made: b.made,
    rate: b.count > 0 ? (b.made / b.count) : null
  }));

  // Helper to get probability for a DPR value
  const getPlayoffProbabilityForDPR = (dprValue) => {
    if (typeof dprValue !== 'number' || isNaN(dprValue)) return null;
    for (let i = 0; i < dprBuckets.length; i++) {
      if (dprValue > dprBuckets[i].min && dprValue <= dprBuckets[i].max) {
        return dprBuckets[i].count > 0 ? (dprBuckets[i].made / dprBuckets[i].count) : null;
      }
    }
    return null;
  };

  // Prepare current-season teams (if any) to display their DPR and empirical playoff probability
  const currentSeasonTeams = (seasonalDPRData || []).filter(r => r && r.isCurrentSeason && !r.isAverageRow).map(r => ({
    rosterId: r.rosterId,
    ownerId: r.ownerId,
    team: r.team,
    year: r.year,
    dpr: r.dpr,
    playoffProb: getPlayoffProbabilityForDPR(Number(r.dpr))
  }));

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        DPR Analysis
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        Detailed breakdown of team performance using the DPR (Douchebag Power Rating) metric.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating DPR data...</p>
      ) : (
        <>
          {/* Career DPR Rankings */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">Career DPR Rankings</h3>
            {careerDPRData.length > 0 ? (
              <>
                {/* Mobile Cards View (match PowerRankings style) */}
                <div className="sm:hidden space-y-3">
                  {careerDPRData
                    .slice()
                    .sort((a, b) => (b.dpr || 0) - (a.dpr || 0))
                    .map((data, index) => (
                      <div key={data.ownerId} className="bg-white rounded-lg shadow-md mobile-card p-2 border-l-4 border-blue-500 min-w-0 w-full overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">{index + 1}</div>
                            <img
                              src={getTeamDetails ? (getTeamDetails(data.ownerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                              alt={getTeamName(data.ownerId, null)}
                              className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-blue-300 shadow-sm object-cover"
                              onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col">
                                <div className="font-semibold text-sm truncate leading-tight">
                                  <span className="truncate">{getTeamName(data.ownerId, null)}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-0 leading-tight">Record: {renderRecord(data.wins, data.losses, data.ties)}</div>
                              </div>
                            </div>
                          </div>

                          {/* fixed-width right column for rating; increased width and add right padding to avoid clipping */}
                          <div className="text-right flex-shrink-0 w-20 ml-1 pr-2">
                            <div className="text-lg font-bold text-blue-800 truncate">{formatDPR(data.dpr)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                            <div className="bg-gray-50 rounded-lg px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">PPG</div>
                              <div className="font-semibold text-green-700 whitespace-nowrap">{formatPointsAvg(data.pointsPerGame)}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">H / L</div>
                              <div className="font-semibold whitespace-nowrap">{formatPointsAvg(data.highestSeasonalPointsAvg)} / {formatPointsAvg(data.lowestSeasonalPointsAvg)}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">Win %</div>
                              <div className="font-semibold whitespace-nowrap">{formatPercentage(data.winPercentage)}</div>
                            </div>
                          </div>
                      </div>
                    ))}
                </div>

                {/* Desktop Table View (PowerRankings-style) */}
                <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-blue-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Career DPR</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">PPG</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Highest Avg</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Lowest Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careerDPRData.slice().sort((a,b)=>(b.dpr||0)-(a.dpr||0)).map((data, index) => (
                        <tr key={data.ownerId} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-blue-700 font-bold border-b border-gray-200">{index + 1}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 font-medium border-b border-gray-200">
                            <div className="flex items-center gap-2 md:gap-3">
                              <img
                                src={getTeamDetails ? (getTeamDetails(data.ownerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                                alt={getTeamName(data.ownerId, null)}
                                className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
                                onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                              />
                              <span className="truncate font-semibold text-xs md:text-sm">
                                {getTeamName(data.ownerId, null)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-800">{formatDPR(data.dpr)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPercentage(data.winPercentage)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{renderRecord(data.wins, data.losses, data.ties)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-green-700">{formatPointsAvg(data.pointsPerGame)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.highestSeasonalPointsAvg)}</td>
                          <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.lowestSeasonalPointsAvg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-600">No career DPR data available.</p>
            )}
          </section>

          {/* Seasonal DPR Rankings (Consolidated) */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Best Seasons by DPR</h3>
            {/* Playoff probability summary based on historical DPR buckets */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Empirical Playoff Probability by DPR</h4>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setShowEmpirical(s => !s)}
                  aria-expanded={showEmpirical}
                  aria-controls="empirical-dpr-section"
                >
                  {showEmpirical ? 'Hide' : 'Show'}
                </button>
              </div>

              {showEmpirical ? (
                <>
                  <div id="empirical-dpr-section" className="overflow-x-auto bg-white rounded shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-600 uppercase">
                          <th className="px-3 py-2">DPR Range</th>
                          <th className="px-3 py-2 text-right">Samples</th>
                          <th className="px-3 py-2 text-right">Made Playoffs</th>
                          <th className="px-3 py-2 text-right">Empirical %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dprBucketStats.map((b) => (
                          <tr key={b.label} className="border-t">
                            <td className="px-3 py-2 text-gray-800">{b.label}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{b.count}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{b.made}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{b.rate === null ? 'N/A' : `${Math.round(b.rate * 100)}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {currentSeasonTeams.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Current Season — Empirical Playoff Probability</h4>
                      <p className="text-xs text-gray-500 mb-2">This shows each team's empirical playoff probability for the current season based on historical DPR buckets.</p>
                      <div className="overflow-x-auto bg-white rounded shadow-sm">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-600 uppercase">
                              <th className="px-3 py-2">Team</th>
                              <th className="px-3 py-2 text-right">DPR</th>
                              <th className="px-3 py-2 text-right">Empirical %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentSeasonTeams.map(t => (
                              <tr key={`${t.rosterId}-${t.year}`} className="border-t">
                                <td className="px-3 py-2 text-gray-800">{t.team}</td>
                                <td className="px-3 py-2 text-right text-gray-700">{formatDPR(t.dpr)}</td>
                                <td className="px-3 py-2 text-right font-semibold">{t.playoffProb === null ? 'N/A' : `${Math.round(t.playoffProb * 100)}%`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Section collapsed. Click "Show" to view empirical playoff probabilities.</p>
              )}
            </div>
            {seasonalDPRData.length > 0 ? (
              <>
                {/* Mobile Cards View (PowerRankings-like) */}
                <div className="sm:hidden space-y-3">
                  {displayedSeasonalDPRData.map((data, idx) => {
                    const isDataCurrent = data.year && Number(data.year) === Number(dataCurrentSeason);
                    if (data.isAverageRow) {
                      // Render the average DPR row inline at its sorted position on mobile with full stats
                      return (
                        <div key={`average-${idx}`} className="min-w-0 w-full overflow-hidden rounded-lg shadow p-2 bg-yellow-50">
                          <div className="flex items-center justify-between mb-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-center">Average Season</div>
                              <div className="text-xs text-gray-500 text-center">Record: {renderRecord(data.wins, data.losses, data.ties)}</div>
                            </div>
                            <div className="text-right flex-shrink-0 w-20 ml-1 pr-2">
                              <div className="text-lg font-bold text-gray-800 truncate">{formatDPR(data.dpr)}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                            <div className="bg-gray-50 rounded px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">PPG</div>
                              <div className="font-semibold text-green-700 whitespace-nowrap">{formatPointsAvg(data.pointsPerGame)}</div>
                            </div>
                            <div className="bg-gray-50 rounded px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">Win %</div>
                              <div className="font-semibold whitespace-nowrap">{formatPercentage(data.winPercentage)}</div>
                            </div>
                            <div className="bg-gray-50 rounded px-2 py-1 text-center">
                              <div className="text-[10px] text-gray-500 mb-0.5">H / L</div>
                              <div className="font-semibold whitespace-nowrap">{formatPointsAvg(data.highestPointsGame)} / {formatPointsAvg(data.lowestPointsGame)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`${data.rosterId}-${data.year}`} className={`min-w-0 w-full overflow-hidden rounded-lg shadow p-2 ${isDataCurrent ? 'border-l-4 border-green-500 bg-green-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">{idx + 1}</div>
                            <img
                              src={getTeamDetails ? (getTeamDetails(data.ownerId, data.year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                              alt={getTeamName(data.ownerId, data.year)}
                              className="w-7 h-7 rounded-full border-2 border-green-300 shadow-sm object-cover flex-shrink-0"
                              onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="font-semibold text-sm truncate leading-tight">
                                    <span className="truncate">{getTeamName(data.ownerId, data.year)}</span>
                                  </div>
                                  {/* small star if made playoffs */}
                                  {didMakePlayoffs(data) && (
                                    <span className="text-yellow-500 text-sm ml-1" title="Made Playoffs">⭐</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-0 leading-tight">Season: {data.year} • Rec: {renderRecord(data.wins, data.losses, data.ties)}</div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 w-20 ml-1 pr-2">
                            <div className="text-lg font-bold text-green-800 truncate">{formatDPR(data.dpr)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <div className="bg-gray-50 rounded px-2 py-1 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">PPG</div>
                            <div className="font-semibold whitespace-nowrap text-green-700">{formatPointsAvg(data.pointsPerGame)}</div>
                          </div>
                          <div className="bg-gray-50 rounded px-2 py-1 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">Win %</div>
                            <div className="font-semibold whitespace-nowrap">{formatPercentage(data.winPercentage)}</div>
                          </div>
                          <div className="bg-gray-50 rounded px-2 py-1 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">H / L</div>
                            <div className="font-semibold whitespace-nowrap">{formatPointsAvg(data.highestPointsGame)} / {formatPointsAvg(data.lowestPointsGame)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (PowerRankings-style) */}
                <div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-green-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Season DPR</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Record</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Points Avg</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Highest</th>
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-gray-200">Lowest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let actualRank = 0;
                        return displayedSeasonalDPRData.map((data, index) => {
                          if (!data.isAverageRow) {
                            actualRank++;
                          }
                          // Highlight current season row (use dataCurrentSeason for consistency)
                          const isCurrentSeasonRow = data.year && Number(data.year) === Number(dataCurrentSeason) && !data.isAverageRow;
                          const rowClass = data.isAverageRow
                            ? 'bg-yellow-100 font-bold'
                            : isCurrentSeasonRow
                              ? 'bg-green-50'
                              : (actualRank % 2 === 0 ? 'bg-gray-50' : 'bg-white');
                          return (
                            <tr
                              key={`${data.rosterId}-${data.year}`}
                              className={rowClass}
                            >
                              {data.isAverageRow ? (
                                <>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">&nbsp;</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                      <span className="truncate font-semibold text-xs md:text-sm">{data.team}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">&nbsp;</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-green-800">{formatDPR(data.dpr)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPercentage(data.winPercentage)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{renderRecord(data.wins, data.losses, data.ties)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-700">{formatPointsAvg(data.pointsPerGame)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.highestPointsGame)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.lowestPointsGame)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200 relative pl-3">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-sm ${isCurrentSeasonRow ? 'bg-green-500' : 'bg-transparent'}`} />
                                    <span className="">{actualRank}</span>
                                  </td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                      <img
                                        src={getTeamDetails ? (getTeamDetails(data.ownerId, data.year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                                        alt={getTeamName(data.ownerId, data.year)}
                                        className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-green-300 shadow-sm object-cover flex-shrink-0"
                                        onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                                      />
                                      <span className="truncate font-semibold text-xs md:text-sm">
                                        {getTeamName(data.ownerId, data.year)}
                                        {didMakePlayoffs(data) && (
                                          <span className="text-yellow-500 ml-1" title="Made Playoffs">⭐</span>
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">{data.year}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-green-800">{formatDPR(data.dpr)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPercentage(data.winPercentage)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{renderRecord(data.wins, data.losses, data.ties)}</td>
                                  {/* Playoffs column removed; show star next to name instead */}
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-700">{formatPointsAvg(data.pointsPerGame)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.highestPointsGame)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPointsAvg(data.lowestPointsGame)}</td>
                                </>
                              )}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-600">No seasonal DPR data available.</p>
            )}

            {seasonalDPRData.length > 20 && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAllSeasonal(!showAllSeasonal)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                  {showAllSeasonal ? 'Show Less' : 'Show All Seasons'}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DPRAnalysis;
