// PowerRankings.js
import React, { useState, useEffect } from 'react';
// Import the utility for calculating league metrics (DPR)
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Assuming this utility exists

// Helper function to format DPR value
const formatDPR = (dpr) => {
  if (typeof dpr !== 'number' || isNaN(dpr)) return 'N/A';
  return dpr.toFixed(2); // Format to two decimal places
};

// Helper function to render record (W-L-T)
const renderRecord = (wins, losses, ties) => {
  return `${wins || 0}-${losses || 0}-${ties || 0}`;
};

// Helper function to format points
const formatPoints = (points) => {
  if (typeof points !== 'number' || isNaN(points)) return 'N/A';
  return points.toFixed(2); // Format to two decimal places
};

const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
  const [powerRankings, setPowerRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no historical matchups, clear data and stop loading
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setPowerRankings([]);
      setLoading(false);
      setError("No historical matchup data available to calculate power rankings.");
      return;
    }

    setLoading(true); // Indicate loading state
    setError(null);   // Clear any previous errors

    try {
      // Find the newest year from the historical matchups
      const allYears = historicalMatchups
        .map(match => parseInt(match.year))
        .filter(year => !isNaN(year));
      const newestYear = allYears.length > 0 ? Math.max(...allYears) : null;

      if (!newestYear) {
        setError("No valid years found in historical data to determine the current season for power rankings.");
        setLoading(false);
        return;
      }

      // Calculate all league metrics, including seasonal DPR
      const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

      // Check if data for the newest year exists
      if (!seasonalMetrics[newestYear]) {
        setError(`No seasonal data available for the newest year (${newestYear}) to calculate power rankings.`);
        setLoading(false);
        return;
      }

      // Extract teams' DPRs for the newest year and sort them
      const yearData = seasonalMetrics[newestYear];
      const calculatedRankings = Object.keys(yearData)
        .map(teamName => ({
          team: teamName,
          dpr: yearData[teamName].adjustedDPR || 0, // Use adjustedDPR
          wins: yearData[teamName].wins || 0,
          losses: yearData[teamName].losses || 0,
          ties: yearData[teamName].ties || 0,
          pointsFor: yearData[teamName].pointsFor || 0,
          year: newestYear, // Add the year for display context
        }))
        .sort((a, b) => b.dpr - a.dpr); // Sort by DPR in descending order

      // Assign ranks based on the sorted order
      const rankedData = calculatedRankings.map((team, index) => ({
        rank: index + 1,
        ...team
      }));

      setPowerRankings(rankedData);
      setLoading(false);

    } catch (err) {
      console.error("Error calculating power rankings based on DPR:", err);
      setError(`Failed to calculate power rankings: ${err.message}. Ensure historical data is complete and accurate.`);
      setLoading(false);
    }
  }, [historicalMatchups, getDisplayTeamName]); // Recalculate when historicalMatchups or team naming changes

  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">
        {powerRankings.length > 0 ? `Power Rankings (DPR) - ${powerRankings[0].year} Season` : 'Current Power Rankings'}
      </h2>
      {loading ? (
        <p className="text-center text-gray-600">Calculating power rankings...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : powerRankings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
              </tr>
            </thead>
            <tbody>
              {powerRankings.map((row, rowIndex) => (
                <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                  <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.team}</td>
                  <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatDPR(row.dpr)}</td>
                  <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderRecord(row.wins, row.losses, row.ties)}</td>
                  <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsFor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600">No power rankings data found for the current season.</p>
      )}
      <p className="mt-4 text-sm text-gray-500 text-center">
        Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available.
      </p>
    </div>
  );
};

export default PowerRankings;
