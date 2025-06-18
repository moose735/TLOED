// src/lib/DPRAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const DPRAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [careerDPRData, setCareerDPRData] = useState([]);
  const [seasonalDPRData, setSeasonalDPRData] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const allSeasonalDPRs = [];
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        allSeasonalDPRs.push({
          year: parseInt(year),
          team: team,
          dpr: seasonalMetrics[year][team].adjustedDPR,
          wins: seasonalMetrics[year][team].wins,
          losses: seasonalMetrics[year][team].losses,
          ties: seasonalMetrics[year][team].ties,
          pointsFor: seasonalMetrics[year][team].pointsFor
        });
      });
    });

    // Sort the consolidated seasonal DPR data by DPR descending
    allSeasonalDPRs.sort((a, b) => b.dpr - a.dpr);

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
    return `${wins || 0}-${losses || 0}-${ties || 0}`;
  };

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
            <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">All-Time Career DPR</h3>
            {careerDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th> {/* Removed whitespace-nowrap */}
                      {/* Removed Points For header */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Avg (Career)</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Highest Points Avg (Seasonal)</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Lowest Points Avg (Seasonal)</th> {/* Removed whitespace-nowrap */}
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
                        {/* Removed Points For data cell */}
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
            <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Seasonal DPR Rankings</h3>
            {seasonalDPRData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Rank (Overall)</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Team</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th> {/* Removed whitespace-nowrap */}
                      <th className="py-2 px-3 text-center text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th> {/* Removed whitespace-nowrap */}
                      {/* Removed Points For header */}
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalDPRData.map((data, index) => (
                      <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{index + 1}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.year}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 whitespace-nowrap">{data.team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{formatDPR(data.dpr)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap text-center">{renderRecord(data.wins, data.losses, data.ties)}</td>
                        {/* Removed Points For data cell */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No seasonal DPR data available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DPRAnalysis;
