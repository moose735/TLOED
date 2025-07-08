// src/lib/DPRAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

const DPRAnalysis = () => { // Removed props as data will come from context
  const {
    loading: contextLoading, // Rename to avoid conflict with local loading state
    error: contextError,     // Rename to avoid conflict with local error state
    historicalData,
    getTeamName
  } = useSleeperData();

  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true); // Local loading state for calculations
  const [showAllSeasonal, setShowAllSeasonal] = useState(false); // New state for "Show More"

  useEffect(() => {
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

    setLoading(true);

    // Use the centralized calculation logic to get seasonal and career metrics
    // Pass historicalData and the getTeamName function from context
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, getTeamName);

    // Enhance careerDPRData with additional metrics
    const enhancedCareerDPRs = calculatedCareerDPRs.map(teamData => {
        const totalGames = teamData.wins + teamData.losses + teamData.ties;
        const winPercentage = totalGames > 0 ? ((teamData.wins + (0.5 * teamData.ties)) / totalGames) : 0;
        const pointsPerGame = totalGames > 0 ? (teamData.pointsFor / totalGames) : 0;

        let highestSeasonalPointsAvg = 0;
        let lowestSeasonalPointsAvg = Infinity;
        let seasonsPlayedCount = 0;

        // Iterate through seasonal metrics to find highest and lowest seasonal points average for this team
        // Use teamData.rosterId to correctly access seasonalMetrics
        Object.keys(seasonalMetrics).forEach(year => {
            if (seasonalMetrics[year][teamData.rosterId]) {
                const seasonalStats = seasonalMetrics[year][teamData.rosterId];
                const seasonalGames = seasonalStats.totalGames;

                if (seasonalGames > 0) {
                    const seasonalAvg = seasonalStats.pointsFor / seasonalGames;
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

        // If no seasons with games played, set lowest average to 0 instead of Infinity
        if (seasonsPlayedCount === 0) {
            lowestSeasonalPointsAvg = 0;
        }

        return {
            ...teamData, // This already includes teamName and rosterId
            winPercentage: winPercentage,
            pointsPerGame: pointsPerGame,
            highestSeasonalPointsAvg: highestSeasonalPointsAvg,
            lowestSeasonalPointsAvg: lowestSeasonalPointsAvg // Will be 0 if no games played, otherwise actual lowest
        };
    });

    // Flatten seasonalMetrics into an array for display in the table
    let allSeasonalDPRs = [];
    Object.keys(seasonalMetrics).sort((a, b) => parseInt(b) - parseInt(a)).forEach(year => { // Sort years descending
      Object.keys(seasonalMetrics[year]).forEach(rosterId => { // Use rosterId as key
        const teamSeasonalData = seasonalMetrics[year][rosterId];

        // All these metrics are already calculated and available in teamSeasonalData
        allSeasonalDPRs.push({
          year: parseInt(year),
          team: teamSeasonalData.teamName, // Use the teamName already resolved by calculations.js
          rosterId: rosterId, // Keep rosterId for potential future use
          dpr: teamSeasonalData.adjustedDPR,
          wins: teamSeasonalData.wins,
          losses: teamSeasonalData.losses,
          ties: teamSeasonalData.ties,
          winPercentage: teamSeasonalData.winPercentage,
          pointsPerGame: teamSeasonalData.averageScore, // 'averageScore' in seasonalMetrics is points per game
          highestPointsGame: teamSeasonalData.highScore, // Use highScore from seasonalMetrics
          lowestPointsGame: teamSeasonalData.lowScore // Use lowScore from seasonalMetrics
        });
      });
    });

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

    setCareerDPRData(enhancedCareerDPRs);
    setSeasonalDPRData(allSeasonalDPRs);
    setLoading(false);

  }, [historicalData, getTeamName, contextLoading, contextError]); // Dependencies updated

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
                      <tr key={data.rosterId || data.teamName} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.teamName}</td> {/* Use data.teamName */}
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
                      // This conditional block is crucial. It's executed for each item in the map.
                      // `actualRank` is outside the map, so its value persists across iterations.
                      if (!data.isAverageRow) {
                        actualRank++; // Increment rank only for non-average rows
                      }
                      return (
                        <tr key={`${data.rosterId}-${data.year}`} className={data.isAverageRow ? 'bg-yellow-100 font-bold' : (actualRank % 2 === 0 ? 'bg-gray-50' : 'bg-white')}>
                          {data.isAverageRow ? (
                            <td colSpan={numberOfSeasonalColumns} className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap text-center">
                              {data.team}
                            </td>
                          ) : (
                            <>
                              <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{actualRank}</td>
                              <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td> {/* Use data.team (which is teamName) */}
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
