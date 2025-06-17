// src/lib/LuckRatingAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LuckRatingAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [luckRatingData, setLuckRatingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setLuckRatingData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the centralized calculation logic, which now correctly returns projectedWins
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    const allLuckRatings = [];
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        const teamData = seasonalMetrics[year][team];
        // Ensure that luckRating and projectedWins are populated for the team in this year
        if (typeof teamData.luckRating === 'number' && !isNaN(teamData.luckRating) &&
            typeof teamData.projectedWins === 'number' && !isNaN(teamData.projectedWins)) {
          
          allLuckRatings.push({
            year: parseInt(year),
            team: team,
            luckRating: teamData.luckRating,
            actualWins: teamData.wins, // Use actual wins directly from seasonalMetrics (first pass calculation)
            projectedWins: teamData.projectedWins // Use projected wins directly from seasonalMetrics
          });
        }
      });
    });

    allLuckRatings.sort((a, b) => b.luckRating - a.luckRating); // Sort by luck rating descending
    setLuckRatingData(allLuckRatings);
    setLoading(false);

  }, [historicalMatchups, getDisplayTeamName]);

  const formatLuckRating = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        Luck Rating Analysis
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        This analysis indicates how much "luckier" or "unluckier" a team was
        compared to their projected wins if every possible matchup against other teams
        in their league week-by-week were played. A positive score means luckier, negative means unluckier.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating luck ratings...</p>
      ) : luckRatingData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-yellow-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Actual Wins</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Projected Wins</th>
              </tr>
            </thead>
            <tbody>
              {luckRatingData.map((data, index) => (
                <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-3 text-sm text-gray-800">{index + 1}</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{data.year}</td>
                  <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.luckRating)}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{data.actualWins}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.projectedWins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600">No luck rating data found.</p>
      )}
    </div>
  );
};

export default LuckRatingAnalysis;
