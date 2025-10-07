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

const DPRAnalysis = ({ onTeamNameClick }) => { // Accept onTeamNameClick prop
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
    const averageSeasonRow = {
      year: null, // Set to null so formatters can ignore it
      team: '----------------Average Season 1.000 DPR----------------',
      dpr: averageDPRValue, // Keep DPR for sorting purposes
      wins: null,
      losses: null,
      ties: null,
      winPercentage: null,
      pointsPerGame: null,
      highestPointsGame: null,
      lowestPointsGame: null,
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
        const totalGames = teamData.wins + teamData.losses + teamData.ties;
        const winPercentage = totalGames > 0 ? ((teamData.wins + (0.5 * teamData.ties)) / totalGames) : 0;
        const pointsPerGame = totalGames > 0 ? (teamData.pointsFor / totalGames) : 0;

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

        return {
            ...teamData,
            winPercentage: winPercentage,
            pointsPerGame: pointsPerGame,
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

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        DPR Analysis (Career & Seasonal)
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        Detailed breakdown of team performance using the DPR (Dominance Performance Rating) metric.
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
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">{index + 1}</div>
                            <img
                              src={getTeamDetails ? (getTeamDetails(data.ownerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                              alt={getTeamName(data.ownerId, null)}
                              className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-blue-300 shadow-sm object-cover"
                              onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm truncate">
                                {onTeamNameClick ? (
                                  <button onClick={() => onTeamNameClick(getTeamName(data.ownerId, null))} className="text-gray-800 hover:underline p-0 bg-transparent border-none truncate">
                                    {getTeamName(data.ownerId, null)}
                                  </button>
                                ) : (
                                  <span className="truncate">{getTeamName(data.ownerId, null)}</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">Record: {renderRecord(data.wins, data.losses, data.ties)}</div>
                            </div>
                          </div>

                          {/* fixed-width right column for rating; increased width and add right padding to avoid clipping */}
                          <div className="text-right flex-shrink-0 w-20 ml-1 pr-2">
                            <div className="text-lg font-bold text-blue-800 truncate">{formatDPR(data.dpr)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs mt-2">
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
                        <th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">PF</th>
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
                                {onTeamNameClick ? (
                                  <button
                                    onClick={() => onTeamNameClick(getTeamName(data.ownerId, null))}
                                    className="text-gray-800 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 text-left"
                                  >
                                    {getTeamName(data.ownerId, null)}
                                  </button>
                                ) : (
                                  getTeamName(data.ownerId, null)
                                )}
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
            {seasonalDPRData.length > 0 ? (
              <>
                {/* Mobile Cards View (PowerRankings-like) */}
                <div className="sm:hidden space-y-3">
                  {displayedSeasonalDPRData.map((data, idx) => {
                    if (data.isAverageRow) {
                      return (
                        <div key={`avg-${idx}`} className="bg-yellow-100 rounded-lg p-3 text-center font-bold">{data.team}</div>
                      );
                    }
                    const isDataCurrent = data.year && Number(data.year) === Number(dataCurrentSeason);
                    return (
                      <div key={`${data.rosterId}-${data.year}`} className={`min-w-0 w-full overflow-hidden rounded-lg shadow p-2 ${isDataCurrent ? 'border-l-4 border-green-500 bg-green-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">{idx + 1}</div>
                            <img
                              src={getTeamDetails ? (getTeamDetails(data.ownerId, data.year)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                              alt={getTeamName(data.ownerId, data.year)}
                              className="w-7 h-7 rounded-full border-2 border-green-300 shadow-sm object-cover flex-shrink-0"
                              onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-semibold text-sm truncate">{onTeamNameClick ? (
                                  <button onClick={() => onTeamNameClick(getTeamName(data.ownerId, data.year))} className="text-gray-800 hover:underline p-0 bg-transparent border-none truncate">
                                    {getTeamName(data.ownerId, data.year)}
                                  </button>
                                ) : (
                                  <span className="truncate">{getTeamName(data.ownerId, data.year)}</span>
                                )}</div>
                                {/* On mobile the green highlight is sufficient for current season; remove redundant 'Current' pill */}
                              </div>
                              <div className="text-xs text-gray-500">Season: {data.year}</div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 w-20 ml-1 pr-2">
                            <div className="text-lg font-bold text-green-800 truncate">{formatDPR(data.dpr)}</div>
                              {/* Avoid showing raw DPR underneath adjusted DPR on mobile to reduce redundancy */}
                              <div className="text-xs text-gray-500">PPG • {formatPointsAvg(data.pointsPerGame)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                          <div className="bg-gray-50 rounded px-2 py-1 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">Rec</div>
                            <div className="font-semibold whitespace-nowrap">{renderRecord(data.wins, data.losses, data.ties)}</div>
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
                                <td colSpan={numberOfSeasonalColumns} className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap text-center">
                                  {data.team}
                                </td>
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
                                        {onTeamNameClick ? (
                                          <button
                                            onClick={() => onTeamNameClick(getTeamName(data.ownerId, data.year))}
                                            className="text-gray-800 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 text-left"
                                          >
                                            {getTeamName(data.ownerId, data.year)}
                                          </button>
                                        ) : (
                                          getTeamName(data.ownerId, data.year)
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 whitespace-nowrap border-b border-gray-200">{data.year}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-green-800">{formatDPR(data.dpr)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{formatPercentage(data.winPercentage)}</td>
                                  <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{renderRecord(data.wins, data.losses, data.ties)}</td>
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
