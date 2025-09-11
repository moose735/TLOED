// src/lib/DPRAnalysis.js

import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

// Always define metrics at the top level so it's available everywhere
let metricsResult = {};
let seasonalMetrics = {};
let calculatedCareerDPRs = [];

const DPRAnalysis = () => { // Removed props as data will come from context
  const {
    loading: contextLoading, // Rename to avoid conflict with local loading state
    error: contextError,      // Rename to avoid conflict with local error state
    historicalData,
    allDraftHistory, // FIXED: Import allDraftHistory from context
    getTeamName
  } = useSleeperData();

  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true); // Local loading state for calculations
  const [showAllSeasonal, setShowAllSeasonal] = useState(false); // New state for "Show More"

  useEffect(() => {
    // Always define metrics before any other logic
    metricsResult = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName);
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
        console.error("DPRAnalysis: getTeamName is not a function from SleeperDataContext. Cannot perform calculations.");
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
        if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
          let currentOwnerId = teamSeasonalData.ownerId;
          if (!currentOwnerId && historicalData?.rostersBySeason?.[year]) {
            const rosterInHistoricalData = historicalData.rostersBySeason[year].find(
              (r) => String(r.roster_id) === String(rosterId)
            );
            if (rosterInHistoricalData) {
              currentOwnerId = rosterInHistoricalData.owner_id;
            }
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

    // Ensure current season is always included, even if only partial weeks are completed
    if (currentSeason !== null) {
      const hasCurrentSeason = allSeasonalDPRs.some(row => row.year === currentSeason);
      if (!hasCurrentSeason && seasonalMetrics[currentSeason]) {
        Object.keys(seasonalMetrics[currentSeason]).forEach(rosterId => {
          const teamSeasonalData = seasonalMetrics[currentSeason][rosterId];
          if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
            let currentOwnerId = teamSeasonalData.ownerId;
            if (!currentOwnerId && historicalData?.rostersBySeason?.[currentSeason]) {
              const rosterInHistoricalData = historicalData.rostersBySeason[currentSeason].find(
                (r) => String(r.roster_id) === String(rosterId)
              );
              if (rosterInHistoricalData) {
                currentOwnerId = rosterInHistoricalData.owner_id;
              }
            }
            const avgScore = teamSeasonalData.averageScore || 0;
            const highScore = teamSeasonalData.highScore || 0;
            const lowScore = teamSeasonalData.lowScore || 0;
            const winPct = teamSeasonalData.winPercentage || 0;
            const rawDPR = (((avgScore * 6) + ((highScore + lowScore) * 2) + ((winPct * 200) * 2)) / 10);
            // Calculate league average Raw DPR for current season
            const teamRawDPRs = Object.values(seasonalMetrics[currentSeason]).map(tsd => (((tsd.averageScore || 0) * 6) + (((tsd.highScore || 0) + (tsd.lowScore || 0)) * 2) + (((tsd.winPercentage || 0) * 200) * 2)) / 10);
            const leagueAvgRawDPR = teamRawDPRs.length > 0 ? (teamRawDPRs.reduce((a, b) => a + b, 0) / teamRawDPRs.length) : 1;
            const adjustedDPR = leagueAvgRawDPR > 0 ? (rawDPR / leagueAvgRawDPR) : 1.0;
            allSeasonalDPRs.push({
              year: currentSeason,
              team: getTeamName(currentOwnerId, currentSeason),
              rosterId: rosterId,
              ownerId: currentOwnerId,
              rawDPR,
              dpr: adjustedDPR,
              wins: teamSeasonalData.wins,
              losses: teamSeasonalData.losses,
              ties: teamSeasonalData.ties,
              winPercentage: winPct,
              pointsPerGame: avgScore,
              highestPointsGame: highScore,
              lowestPointsGame: lowScore,
              isCurrentSeason: true
            });
          }
        });
      }
    }

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
    return `${wins || 0}-${losses || 0}-${ties || 0}`;
  };

  const displayedSeasonalDPRData = showAllSeasonal ? seasonalDPRData : seasonalDPRData.slice(0, 20);
  // Find current season for highlighting
  // Highlight the latest season found in any data source (matches LuckAnalysis logic)
  let highlightCurrentSeasonYear = null;
  const highlightYearsSet = new Set([
    ...Object.keys(seasonalMetrics || {}),
    ...Object.keys(historicalData?.matchupsBySeason || {}),
    ...Object.keys(historicalData?.rostersBySeason || {})
  ].map(Number));
  if (highlightYearsSet.size > 0) {
    highlightCurrentSeasonYear = Math.max(...Array.from(highlightYearsSet));
  }

  // Determine the number of columns for the colSpan
  const numberOfSeasonalColumns = 9; // Rank, Team, Season, Season DPR, Win %, Record, Points Avg, Highest Points, Lowest Points

  // Initialize actualRank here, within the component's render function, but outside JSX
  let actualRank = 0;

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
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Career DPR</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Avg </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Highest Points Avg</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Lowest Points Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerDPRData.map((data, index) => (
                      <tr key={data.ownerId} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}> {/* FIXED: Use ownerId for key */}
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{getTeamName(data.ownerId, null)}</td> {/* FIXED: Use getTeamName with ownerId and null for current name */}
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPercentage(data.winPercentage)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.pointsPerGame)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.highestSeasonalPointsAvg)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.lowestSeasonalPointsAvg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No career DPR data available.</p>
            )}
          </section>

          {/* Seasonal DPR Rankings (Consolidated) */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Best Seasons by DPR</h3>
            {seasonalDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Season DPR</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Points Avg</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Highest Points</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Lowest Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* The initialization of actualRank needs to be here, but not rendered directly */}
                    {displayedSeasonalDPRData.map((data) => {
                      if (!data.isAverageRow) {
                        actualRank++;
                      }
                      // Highlight current season row
                      const isCurrentSeasonRow = data.isCurrentSeason && data.year === highlightCurrentSeasonYear;
                      return (
                        <tr
                          key={`${data.rosterId}-${data.year}`}
                          className={
                            data.isAverageRow
                              ? 'bg-yellow-100 font-bold'
                              : isCurrentSeasonRow
                                ? 'bg-green-200 font-bold'
                                : (actualRank % 2 === 0 ? 'bg-gray-50' : 'bg-white')
                          }
                        >
                          {data.isAverageRow ? (
                            <td colSpan={numberOfSeasonalColumns} className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap text-center">
                              {data.team}
                            </td>
                          ) : (
                            <>
                              <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{actualRank}</td>
                              <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{getTeamName(data.ownerId, data.year)}</td>
                              <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.year}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(data.dpr)}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPercentage(data.winPercentage)}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{renderRecord(data.wins, data.losses, data.ties)}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.pointsPerGame)}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.highestPointsGame)}</td>
                              <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.lowestPointsGame)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
