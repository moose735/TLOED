// TLOED/src/lib/WeeklyMatchupsDisplay.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateAverageScore,
  calculateSigmaSquaredOverCount,
  calculateErrorFunctionCoefficient,
  calculateWinPercentage,
  calculateMoneylineOdds,
  calculateOverUnder
} from '../utils/bettingCalculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  const currentWeek = useMemo(() => {
    const first = weeklyScheduleData[0];
    const key = first && Object.keys(first).find(k => k.startsWith('Week_'));
    return key ? parseInt(key.split('_')[1]) : undefined;
  }, [weeklyScheduleData]);

  useEffect(() => {
    fetch(SCHEDULE_API_URL)
      .then(res => res.json())
      .then(setWeeklyScheduleData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const processed = useMemo(() => {
    if (!weeklyScheduleData.length || !historicalMatchups.length || currentWeek === undefined) return [];

    const year = Math.max(...historicalMatchups.map(m => +m.year));
    const map = typeof getMappedTeamName === 'function' ? getMappedTeamName : x => x;

    return weeklyScheduleData.map(row => {
      const team1 = map(row.Player);
      const team2 = map(row[`Week_${currentWeek}`]);

      const avg1 = calculateAverageScore(team1, year, currentWeek, historicalMatchups, map);
      const avg2 = calculateAverageScore(team2, year, currentWeek, historicalMatchups, map);

      const std1 = Math.sqrt(calculateSigmaSquaredOverCount(team1, year, currentWeek, historicalMatchups, map));
      const std2 = Math.sqrt(calculateSigmaSquaredOverCount(team2, year, currentWeek, historicalMatchups, map));

      const diff1 = avg1 - avg2;
      const diff2 = -diff1;

      const coeff1 = calculateErrorFunctionCoefficient(diff1, std2);
      const coeff2 = calculateErrorFunctionCoefficient(diff2, std1);

      const win1 = calculateWinPercentage(diff1, coeff1);
      const win2 = calculateWinPercentage(diff2, coeff2);

      const moneylineOdds = calculateMoneylineOdds(win1, win2);
      const overUnder = calculateOverUnder(avg1, avg2);

      return {
        ...row,
        team1,
        team2,
        moneylineOdds,
        overUnder,
        avg1,
        avg2
      };
    });
  }, [weeklyScheduleData, historicalMatchups, currentWeek]);

  if (loading) return <div className="text-center py-4">Loading weekly schedule...</div>;
  if (error) return <div className="text-red-500 text-center py-4">Error: {error}</div>;
  if (!currentWeek) return <div className="text-yellow-500 text-center py-4">Could not determine current week.</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Week {currentWeek} Matchups</h1>
      {processed.map((match, i) => (
        <div key={i} className="bg-white shadow-md rounded p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-800 font-bold">{match.team1}</span>
            <span className="text-gray-500">vs</span>
            <span className="text-green-800 font-bold">{match.team2}</span>
          </div>
          <div className="flex justify-around text-sm">
            <div className="text-center">
              <div className="text-purple-700 font-bold">ML: {match.moneylineOdds.team1Formatted}</div>
              <div className="text-gray-500">Avg: {match.avg1.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-purple-700 font-bold">ML: {match.moneylineOdds.team2Formatted}</div>
              <div className="text-gray-500">Avg: {match.avg2.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-blue-700 font-bold">O/U: {match.overUnder}</div>
              <div className="text-gray-500">-110</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeeklyMatchupsDisplay;
