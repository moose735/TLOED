// src/lib/LeagueHistory.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // For career DPR
// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

// Helper to get the descriptive name of a final seeding game (e.g., "Championship Game")
const getFinalSeedingGamePurpose = (value) => {
  if (value === 1) return 'Championship Game';
  if (value === 3) return '3rd Place Game';
  if (value === 5) return '5th Place Game';
  if (value === 7) return '7th Place Game';
  if (value === 9) return '9th Place Game';
  if (value === 11) return '11th Place Game';
  if (typeof value === 'number' && value > 0 && value % 2 !== 0) {
      return `${value}${getOrdinalSuffix(value)} Place Game`;
  }
  return 'Final Seeding Game';
};

const LeagueHistory = ({ historicalMatchups, ...otherProps }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    if (historicalMatchups) {
      setIsLoading(true);
      setError(null);
      try {
        const result = calculateAllLeagueMetrics(historicalMatchups);
        setProcessedData(result);
        setIsLoading(false);
      } catch (err) {
        console.error("Error processing historical data:", err);
        setError("Failed to process historical data.");
        setIsLoading(false);
      }
    }
  }, [historicalMatchups]);

  if (isLoading) {
    return <p className="text-center text-gray-600 py-8">Loading historical data...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500 py-8">Error: {error}</p>;
  }

  if (!processedData) {
    return <p className="text-center text-gray-600 py-8">No historical data available.</p>;
  }

  const {
    careerWinLossRecords,
    careerPointsForAgainst,
    h2hRecords,
    careerDPR,
    seasonAwardsSummary,
    mostRecentYearsForAwards
  } = processedData;

  return (
    <div className="container mx-auto px-4 py-8">
      {isLoading && <p className="text-center text-gray-600">Loading historical data...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}

      {historicalMatchups && (
        <>
          {/* Historical Matchup Data Section */}
          {/* This section's outer card styling was removed as per your request */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Historical Matchup Data</h2>

            {careerWinLossRecords && Object.keys(careerWinLossRecords).length > 0 ? (
              <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-md"> {/* Inner div retains table styling */}
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Career Win/Loss Records</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wins</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Losses</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ties</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(careerWinLossRecords).map(([managerName, record]) => (
                      <tr key={managerName}>
                        <td className="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">{managerName}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{record.wins}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{record.losses}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{record.ties}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{(record.winPercentage * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No career win/loss records available.</p>
            )}

            {careerPointsForAgainst && Object.keys(careerPointsForAgainst).length > 0 && (
              <div className="mt-8 overflow-x-auto bg-white p-4 rounded-lg shadow-md"> {/* Inner div retains table styling */}
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Career Points For/Against</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points For</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points Against</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PF Rank</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PA Rank</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(careerPointsForAgainst).map(([managerName, data]) => (
                      <tr key={managerName}>
                        <td className="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">{managerName}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.pointsFor.toFixed(2)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.pointsAgainst.toFixed(2)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.rankPF}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.rankPA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {careerDPR && Object.keys(careerDPR).length > 0 && (
              <div className="mt-8 overflow-x-auto bg-white p-4 rounded-lg shadow-md"> {/* Inner div retains table styling */}
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Career DPR (Dominance Performance Rating)</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DPR</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(careerDPR).map(([managerName, data]) => (
                      <tr key={managerName}>
                        <td className="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">{managerName}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.dpr.toFixed(2)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{data.rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {h2hRecords && Object.keys(h2hRecords).length > 0 && (
              <div className="mt-8 overflow-x-auto bg-white p-4 rounded-lg shadow-md"> {/* Inner div retains table styling */}
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Head-to-Head Records</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                      {Object.keys(h2hRecords).map(opponentName => (
                        <th key={opponentName} scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{opponentName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(h2hRecords).map(([managerName, records]) => (
                      <tr key={managerName}>
                        <td className="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">{managerName}</td>
                        {Object.keys(h2hRecords).map(opponentName => {
                          const record = records[opponentName];
                          if (managerName === opponentName) {
                            return <td key={opponentName} className="py-2 px-3 text-sm text-gray-500 whitespace-nowrap text-center">-</td>;
                          }
                          return (
                            <td key={opponentName} className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">
                              {record ? `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}` : 'N/A'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Season-by-Season Awards Section */}
          {/* This section's outer card styling was removed as per your request */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Season-by-Season Awards</h2>
            {seasonAwardsSummary && mostRecentYearsForAwards && mostRecentYearsForAwards.length > 0 ? (
              <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-md"> {/* Inner div retains table styling */}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <i className="fas fa-trophy text-yellow-500 mr-1"></i> Champion
                      </th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <i className="fas fa-medal text-gray-400 mr-1"></i> 2nd Place
                      </th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <i className="fas fa-medal text-orange-600 mr-1"></i> 3rd Place
                      </th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points Champ</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points 2nd</th>
                      <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points 3rd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mostRecentYearsForAwards.map((year, index) => {
                      const awards = seasonAwardsSummary[year];
                      return (
                        <tr key={year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          {/* Corrected: Removed unnecessary backslashes from className attributes */}
                          <td className="py-2 px-3 text-sm text-gray-800 font-semibold text-center whitespace-nowrap">{year}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.champion}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.secondPlace}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.thirdPlace}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsChamp}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsSecond}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center whitespace-nowrap">{awards.pointsThird}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No season-by-season award data available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default LeagueHistory;
