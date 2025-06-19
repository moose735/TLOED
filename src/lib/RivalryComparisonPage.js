// src/lib/RivalryComparisonPage.js
import React, { useMemo } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Assuming calculations.js is in utils

const RivalryComparisonPage = ({ team1Name, team2Name, historicalMatchups, getMappedTeamName }) => {

  // Memoize calculations to avoid recalculating on every render if props don't change
  const { careerDPRData } = useMemo(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      return { careerDPRData: [] };
    }
    // calculateAllLeagueMetrics should return comprehensive career stats for all teams
    return calculateAllLeagueMetrics(historicalMatchups);
  }, [historicalMatchups]);

  // Find the career stats for each of the two teams being compared
  const team1Stats = careerDPRData.find(team => team.team === team1Name);
  const team2Stats = careerDPRData.find(team => team.team === team2Name);

  // Helper to safely get stat value, returning 'N/A' if not found or invalid
  const getStat = (stats, key) => {
    if (!stats || typeof stats[key] === 'undefined' || stats[key] === null || isNaN(stats[key])) {
      return 'N/A';
    }
    // Format percentages
    if (key === 'winPercentage') {
        return (stats[key] * 100).toFixed(2) + '%';
    }
    // Format DPR
    if (key === 'dpr') {
        return stats[key].toFixed(2);
    }
    // For general numeric stats, format to a reasonable number of decimals if needed, or keep as is.
    return stats[key];
  };

  if (!team1Stats && !team2Stats) {
    return (
      <div className="text-center text-gray-700 p-4">
        No detailed comparison data found for {getMappedTeamName(team1Name)} and {getMappedTeamName(team2Name)}.
        Please ensure historical data is loaded and calculations are correct.
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Head-to-Head Comparison: {getMappedTeamName(team1Name)} vs. {getMappedTeamName(team2Name)}
      </h2>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statistic</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{getMappedTeamName(team1Name)}</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{getMappedTeamName(team2Name)}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Wins</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'wins')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'wins')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Losses</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'losses')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'losses')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Ties</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'ties')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'ties')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Win %</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'winPercentage')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'winPercentage')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Career DPR</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'dpr')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'dpr')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Points Scored</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'pointsFor')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'pointsFor')}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Points Against</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team1Stats, 'pointsAgainst')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{getStat(team2Stats, 'pointsAgainst')}</td>
            </tr>
            {/* Add more statistics rows as needed from your `careerDPRData` */}
            {/* For 'Weekly High Score', you might need to adjust your calculations.js or the data structure,
                as it's often a per-game/per-season stat rather than a single career aggregate in DPR. */}
          </tbody>
        </table>
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
        Historical Matchups Between {getMappedTeamName(team1Name)} and {getMappedTeamName(team2Name)}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loser</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historicalMatchups.map(season =>
              season.matchups // Filter matchups within each season
                .filter(matchup =>
                  (matchup.team1 === team1Name && matchup.team2 === team2Name) ||
                  (matchup.team1 === team2Name && matchup.team2 === team1Name)
                )
                .map((matchup, index) => (
                  <tr key={`${season.year}-${matchup.week}-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{season.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{matchup.week}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {matchup.winner ? getMappedTeamName(matchup.winner) : 'Tie'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                      {matchup.team1Score} - {matchup.team2Score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {matchup.loser ? getMappedTeamName(matchup.loser) : 'Tie'}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RivalryComparisonPage;
