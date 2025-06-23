import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateMoneylineOdds,
  calculateOverUnder,
  getPlayerMetricsForYear,
  calculateAllLeagueMetrics,
} from '../utils/bettingCalculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(SCHEDULE_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setWeeklyScheduleData(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchScheduleData();
  }, []);

  const safeGetMappedTeamName = typeof getMappedTeamName === 'function'
    ? getMappedTeamName
    : name => String(name || '').trim();

  const allMatchupsByWeek = useMemo(() => {
    if (!weeklyScheduleData.length || !historicalMatchups?.length) return [];

    const currentYear = Math.max(...historicalMatchups.map(m => parseInt(m.year)).filter(y => !isNaN(y)));
    const metrics = calculateAllLeagueMetrics(historicalMatchups, safeGetMappedTeamName);
    const seasonalMetrics = metrics.seasonalMetrics;

    // Detect all unique weeks
    const weekKeys = Object.keys(weeklyScheduleData[0] || {}).filter(k => k.startsWith('Week_'));
    const weekNumbers = weekKeys.map(k => parseInt(k.split('_')[1])).filter(Boolean).sort((a, b) => a - b);

    return weekNumbers.map(weekNum => {
      const weekMatchups = weeklyScheduleData.map(match => {
        const team1Name = match.Player;
        const team2Name = match[`Week_${weekNum}`];

        if (!team1Name || !team2Name) return null;

        const team1Metrics = getPlayerMetricsForYear(
          team1Name, currentYear, historicalMatchups,
          seasonalMetrics, metrics.weeklyGameScoresByYearAndWeek,
          safeGetMappedTeamName, weekNum
        );

        const team2Metrics = getPlayerMetricsForYear(
          team2Name, currentYear, historicalMatchups,
          seasonalMetrics, metrics.weeklyGameScoresByYearAndWeek,
          safeGetMappedTeamName, weekNum
        );

        const team1WinPct = team1Metrics && team1Metrics.errorFunctionCoefficient !== undefined
          ? team1Metrics.averageDifferenceVsOpponent > 0
            ? erf((team1Metrics.errorFunctionCoefficient / team1Metrics.averageDifferenceVsOpponent) / Math.sqrt(2)) / 2 + 0.5
            : 1 - (erf((team1Metrics.errorFunctionCoefficient / Math.abs(team1Metrics.averageDifferenceVsOpponent)) / Math.sqrt(2)) / 2 + 0.5)
          : 0.5;

        const team2WinPct = 1 - team1WinPct;

        const moneylineOdds = calculateMoneylineOdds(team1WinPct, team2WinPct);
        const overUnder = calculateOverUnder(team1Metrics.projectedScore, team2Metrics.projectedScore);

        return {
          team1Name,
          team2Name,
          team1Metrics,
          team2Metrics,
          moneylineOdds,
          overUnder
        };
      }).filter(Boolean);

      return {
        week: weekNum,
        matchups: weekMatchups
      };
    });
  }, [weeklyScheduleData, historicalMatchups, getMappedTeamName]);

  if (loading) return <div className="text-center py-4">Loading weekly schedule...</div>;
  if (error) return <div className="text-center py-4 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Full Season Matchups & Projections</h1>
      {allMatchupsByWeek.map(({ week, matchups }) => (
        <div key={week} className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Week {week} Matchups</h2>
          <ul className="space-y-4">
            {matchups.map((match, index) => (
              <li key={index} className="flex flex-col sm:flex-row items-center bg-gray-50 rounded-lg shadow-sm overflow-hidden">
                {/* Team 1 */}
                <div className="flex-1 p-4 flex flex-col items-center border-b sm:border-b-0 sm:border-r border-gray-200">
                  <span className="text-lg font-bold text-blue-800">{match.team1Name}</span>
                  <span className="text-sm text-gray-600">Avg: {match.team1Metrics?.projectedScore?.toFixed(2) || 'N/A'}</span>
                  <span className="text-sm text-gray-600">ML: {match.moneylineOdds?.team1Formatted || 'N/A'}</span>
                </div>
                <div className="p-2 font-semibold text-gray-500">VS</div>
                {/* Team 2 */}
                <div className="flex-1 p-4 flex flex-col items-center border-t sm:border-t-0 sm:border-l border-gray-200">
                  <span className="text-lg font-bold text-green-800">{match.team2Name}</span>
                  <span className="text-sm text-gray-600">Avg: {match.team2Metrics?.projectedScore?.toFixed(2) || 'N/A'}</span>
                  <span className="text-sm text-gray-600">ML: {match.moneylineOdds?.team2Formatted || 'N/A'}</span>
                </div>
                {/* Over/Under */}
                <div className="p-4 bg-gray-100 border-t sm:border-t-0 sm:border-l border-gray-200 flex flex-col items-center">
                  <span className="text-sm font-medium text-gray-600">O/U</span>
                  <span className="text-xl font-bold text-blue-700">{match.overUnder?.toFixed(2) || '0.00'}</span>
                  <span className="text-sm text-gray-600">-110</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// Helper function since you use ERF logic
function erf(x) {
  // Approximation of the Gauss error function
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.5 * x);
  const tau = t * Math.exp(
    -x * x - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277)))))))))
  );
  return sign * (1 - tau);
}

export default WeeklyMatchupsDisplay;
