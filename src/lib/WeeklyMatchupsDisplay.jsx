import React, { useState, useEffect, useMemo } from 'react';

import {
  calculateWeeklyWinPercentage,
  calculateAvgDiffVsOpponent,
  calculateErrorCoeff,
  calculateMoneylineOdds,
} from '../utils/bettingCalculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  // Determine current week from schedule data
  const currentWeek = useMemo(() => {
    if (weeklyScheduleData.length > 0) {
      const firstEntry = weeklyScheduleData[0];
      const weekKey = Object.keys(firstEntry).find(
        key => key.startsWith('Week_') && !isNaN(parseInt(key.split('_')[1]))
      );
      if (weekKey) {
        return parseInt(weekKey.split('_')[1]);
      }
    }
    return undefined;
  }, [weeklyScheduleData]);

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

  const processedWeeklyMatchups = useMemo(() => {
    if (!weeklyScheduleData || weeklyScheduleData.length === 0 ||
        !historicalMatchups || historicalMatchups.length === 0 ||
        typeof currentWeek === 'undefined') {
      return [];
    }

    const currentYearForCalculations = historicalMatchups.reduce((maxYear, match) => {
      const matchYear = parseInt(match.year);
      return isNaN(matchYear) ? maxYear : Math.max(maxYear, matchYear);
    }, 0);

    if (currentYearForCalculations === 0) return [];

    const safeGetMappedTeamName = typeof getMappedTeamName === 'function' ? getMappedTeamName : (name) => String(name || '').trim();

    return weeklyScheduleData.map(match => {
      const team1Name = match.Player;
      const team2Name = match[`Week_${currentWeek}`];

      if (!team1Name || !team2Name) return { ...match };

      const avgDiff1 = calculateAvgDiffVsOpponent(team1Name, team2Name, currentYearForCalculations, currentWeek, historicalMatchups, safeGetMappedTeamName);
      const errorCoeff1 = calculateErrorCoeff(avgDiff1, team2Name, currentYearForCalculations, currentWeek, historicalMatchups, safeGetMappedTeamName);
      const winPct1 = calculateWeeklyWinPercentage(avgDiff1, errorCoeff1);

      const avgDiff2 = calculateAvgDiffVsOpponent(team2Name, team1Name, currentYearForCalculations, currentWeek, historicalMatchups, safeGetMappedTeamName);
      const errorCoeff2 = calculateErrorCoeff(avgDiff2, team1Name, currentYearForCalculations, currentWeek, historicalMatchups, safeGetMappedTeamName);
      const winPct2 = calculateWeeklyWinPercentage(avgDiff2, errorCoeff2);

      const moneylineOdds = calculateMoneylineOdds(winPct1, winPct2);

      return {
        ...match,
        team1Metrics: {
          averageDifferenceVsOpponent: avgDiff1,
          errorFunctionCoefficient: errorCoeff1,
          weeklyWinPercentageProjection: winPct1,
        },
        team2Metrics: {
          averageDifferenceVsOpponent: avgDiff2,
          errorFunctionCoefficient: errorCoeff2,
          weeklyWinPercentageProjection: winPct2,
        },
        moneylineOdds,
      };
    });
  }, [weeklyScheduleData, historicalMatchups, getMappedTeamName, currentWeek]);

  if (loading) {
    return <div className="text-center py-4">Loading weekly schedule...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  if (typeof currentWeek === 'undefined') {
    return <div className="text-center py-4 text-yellow-500">Could not determine current week from schedule data.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Weekly Matchups & Projections</h1>
      <div className="space-y-8">
        {processedWeeklyMatchups.length > 0 ? (
          <div key={currentWeek} className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Week {currentWeek} Matchups</h2>
            <ul className="space-y-4">
              {processedWeeklyMatchups.map((match, index) => (
                <li key={index} className="flex flex-col sm:flex-row items-center bg-gray-50 rounded-lg shadow-sm overflow-hidden">
                  {/* Team 1 */}
                  <div className="flex-1 p-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 w-full sm:w-auto">
                    <span className="text-lg font-bold text-blue-800">{match.Player}</span>
                    <span className="text-sm text-gray-600">Avg Diff: {match.team1Metrics?.averageDifferenceVsOpponent?.toFixed(2) || 'N/A'}</span>
                    <span className="text-sm text-gray-600">Win %: {(match.team1Metrics?.weeklyWinPercentageProjection * 100).toFixed(1) || 'N/A'}%</span>
                  </div>

                  {/* Vs. */}
                  <div className="p-2 text-center text-gray-500 font-semibold">VS</div>

                  {/* Team 2 */}
                  <div className="flex-1 p-4 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-gray-200 w-full sm:w-auto">
                    <span className="text-lg font-bold text-green-800">{match[`Week_${currentWeek}`]}</span>
                    <span className="text-sm text-gray-600">Avg Diff: {match.team2Metrics?.averageDifferenceVsOpponent?.toFixed(2) || 'N/A'}</span>
                    <span className="text-sm text-gray-600">Win %: {(match.team2Metrics?.weeklyWinPercentageProjection * 100).toFixed(1) || 'N/A'}%</span>
                  </div>

                  {/* Betting Odds */}
                  <div className="w-full sm:w-auto p-4 bg-gray-100 flex flex-col sm:flex-row justify-around items-center border-t sm:border-t-0 sm:border-l border-gray-200">
                    {/* Team 1 Moneyline */}
                    <div className="flex flex-col items-center justify-center p-3 sm:p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors duration-200 mb-2 sm:mb-0 sm:mr-2">
                      <span className="text-sm font-medium text-gray-600">Moneyline</span>
                      <span className="text-xl font-bold text-purple-700">{match.moneylineOdds?.team1Formatted || 'N/A'}</span>
                    </div>
                    {/* Team 2 Moneyline */}
                    <div className="flex flex-col items-center justify-center p-3 sm:p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors duration-200 mb-2 sm:mb-0 sm:mr-2">
                      <span className="text-sm font-medium text-gray-600">Moneyline</span>
                      <span className="text-xl font-bold text-purple-700">{match.moneylineOdds?.team2Formatted || 'N/A'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-gray-600 italic text-center py-4">No matchups for this week.</p>
        )}
      </div>
    </div>
  );
};

export default WeeklyMatchupsDisplay;
