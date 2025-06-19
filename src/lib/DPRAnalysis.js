// src/lib/DPRAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const DPRAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllSeasonal, setShowAllSeasonal] = useState(false); // New state for "Show More"

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setCareerDPRData([]);
      setSeasonalDPRData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the centralized calculation logic to get seasonal and career metrics
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // Enhance careerDPRData with additional metrics
    const enhancedCareerDPRs = calculatedCareerDPRs.map(teamData => {
        const totalGames = teamData.wins + teamData.losses + teamData.ties;
        const winPercentage = totalGames > 0 ? ((teamData.wins + (0.5 * teamData.ties)) / totalGames) : 0;
        const pointsPerGame = totalGames > 0 ? (teamData.pointsFor / totalGames) : 0;

        let highestSeasonalPointsAvg = 0;
        let lowestSeasonalPointsAvg = Infinity;
        let seasonsPlayedCount = 0;

        // Iterate through seasonal metrics to find highest and lowest seasonal points average for this team
        Object.keys(seasonalMetrics).forEach(year => {
            if (seasonalMetrics[year][teamData.team]) {
                const seasonalPoints = seasonalMetrics[year][teamData.team].pointsFor;
                const seasonalWins = seasonalMetrics[year][teamData.team].wins;
                const seasonalLosses = seasonalMetrics[year][teamData.team].losses;
                const seasonalTies = seasonalMetrics[year][teamData.team].ties;
                const seasonalGames = seasonalWins + seasonalLosses + seasonalTies;

                if (seasonalGames > 0) {
                    const seasonalAvg = seasonalPoints / seasonalGames;
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
            ...teamData,
            winPercentage: winPercentage,
            pointsPerGame: pointsPerGame,
            highestSeasonalPointsAvg: highestSeasonalPointsAvg,
            lowestSeasonalPointsAvg: lowestSeasonalPointsAvg // Will be 0 if no games played, otherwise actual lowest
        };
    });

    // Flatten seasonalMetrics into an array for display in the table
    let allSeasonalDPRs = []; // Changed to 'let' because we'll modify it
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        const teamSeasonalData = seasonalMetrics[year][team];
        const seasonalWins = teamSeasonalData.wins;
        const seasonalLosses = teamSeasonalData.losses;
        const seasonalTies = teamSeasonalData.ties;
        const seasonalPointsFor = teamSeasonalData.pointsFor;
        const seasonalTotalGames = seasonalWins + seasonalLosses + seasonalTies;

        const seasonalWinPercentage = seasonalTotalGames > 0 ? ((seasonalWins + (0.5 * seasonalTies)) / seasonalTotalGames) : 0;
        const seasonalPointsPerGame = seasonalTotalGames > 0 ? (seasonalPointsFor / seasonalTotalGames) : 0;

        let seasonalHighestPointsGame = 0;
        let seasonalLowestPointsGame = Infinity;

        // Find highest and lowest points scored in a single game for this team in this season
        historicalMatchups.forEach(match => {
            const matchYear = parseInt(match.year);
            const team1 = getDisplayTeamName(String(match.team1 || '').trim());
            const team2 = getDisplayTeamName(String(match.team2 || '').trim());
            const team1Score = parseFloat(match.team1Score);
            const team2Score = parseFloat(match.team2Score);

            if (matchYear === parseInt(year) && !isNaN(team1Score) && !isNaN(team2Score)) {
                if (team1 === team) {
                    if (team1Score > seasonalHighestPointsGame) {
                        seasonalHighestPointsGame = team1Score;
                    }
                    if (team1Score < seasonalLowestPointsGame) {
                        seasonalLowestPointsGame = team1Score;
                    }
                } else if (team2 === team) {
                    if (team2Score > seasonalHighestPointsGame) {
                        seasonalHighestPointsGame = team2Score;
                    }
                    if (team2Score < seasonalLowestPointsGame) {
                        seasonalLowestPointsGame = team2Score;
                    }
                }
            }
        });

        // If no games played, set lowest game score to 0 instead of Infinity
        if (seasonalTotalGames === 0 || seasonalLowestPointsGame === Infinity) {
            seasonalLowestPointsGame = 0;
        }

        allSeasonalDPRs.push({
          year: parseInt(year),
          team: team,
          dpr: teamSeasonalData.adjustedDPR,
          wins: seasonalWins,
          losses: seasonalLosses,
          ties: seasonalTies,
          winPercentage: seasonalWinPercentage,
          pointsPerGame: seasonalPointsPerGame,
          highestPointsGame: seasonalHighestPointsGame,
          lowestPointsGame: seasonalLowestPointsGame
        });
      });
    });

    // Sort the consolidated seasonal DPR data by DPR descending
    allSeasonalDPRs.sort((a, b) => b.dpr - a.dpr);

    // Insert the "AVERAGE SEASON" row
    const averageDPRValue = 1.000;
    const averageSeasonRow = {
      year: 'N/A',
      team: 'AVERAGE SEASON',
      dpr: averageDPRValue,
      wins: 'N/A',
      losses: 'N/A',
      ties: 'N/A',
      winPercentage: 0.500, // Assuming an average season would have a .500 win percentage
      pointsPerGame: 'N/A',
      highestPointsGame: 'N/A',
      lowestPointsGame: 'N/A',
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

  }, [historicalMatchups, getDisplayTeamName]);

  // Formatter for win percentage (consistent with LeagueHistory)
  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      let formatted = value.toFixed(3);
      if (formatted.startsWith('0.')) {
        formatted = formatted.substring(1); // Remove the '0'
      } else if (formatted.startsWith('-0.')) {
        formatted = `-${formatted.substring(2)}`; // Remove '-0'
      }
      return `${formatted}%`;
    }
    // Handle the 'N/A' case for the average row
    if (value === 'N/A') return 'N/A';
    return '.000%';
  };

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  const formatPoints = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'N/A';
  };

  // New formatter for points average (similar to formatPoints)
  const formatPointsAvg = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'N/A';
  };

  const renderRecord = (wins, losses, ties) => {
    // Handle 'N/A' for the average row
    if (wins === 'N/A') return 'N/A';
    return `${wins || 0}-${losses || 0}-${ties || 0}`;
  };

  const displayedSeasonalDPRData = showAllSeasonal ? seasonalDPRData : seasonalDPRData.slice(0, 20);

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
                      <tr key={data.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td>
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
                    {displayedSeasonalDPRData.map((data, index) => (
                      <tr key={`${data.team}-${data.year}`} className={data.isAverageRow ? 'bg-yellow-100 font-bold' : (index % 2 === 0 ? 'bg-gray-50' : 'bg-white')}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.isAverageRow ? '' : index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.year}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPercentage(data.winPercentage)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.pointsPerGame)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.highestPointsGame)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatPointsAvg(data.lowestPointsGame)}</td>
                      </tr>
                    ))}
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
