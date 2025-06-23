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

  const SCHEDULE_API_URL =
    'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    fetch(SCHEDULE_API_URL)
      .then(res => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then(setWeeklyScheduleData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const mapName =
    typeof getMappedTeamName === 'function'
      ? getMappedTeamName
      : name => String(name || '').trim();

  const allMatchupsByWeek = useMemo(() => {
    if (!weeklyScheduleData.length || !historicalMatchups?.length) return [];

    const year = Math.max(
      ...historicalMatchups.map(m => parseInt(m.year, 10)).filter(y => !isNaN(y))
    );

    const weekCols = Object.keys(weeklyScheduleData[0] || {}).filter(k =>
      k.startsWith('Week_')
    );
    const weeks = [...new Set(weekCols.map(k => parseInt(k.split('_')[1], 10)))]
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    return weeks.map(weekNum => {
      const matchups = weeklyScheduleData
        .map(row => {
          const t1 = mapName(row.Player);
          const t2 = mapName(row[`Week_${weekNum}`]);
          if (!t1 || !t2) return null;

          const avg1 = calculateAverageScore(
            t1,
            year,
            weekNum,
            historicalMatchups,
            mapName
          );
          const avg2 = calculateAverageScore(
            t2,
            year,
            weekNum,
            historicalMatchups,
            mapName
          );
          const sigma1 = Math.sqrt(
            calculateSigmaSquaredOverCount(
              t1,
              year,
              weekNum,
              historicalMatchups,
              mapName
            )
          );
          const sigma2 = Math.sqrt(
            calculateSigmaSquaredOverCount(
              t2,
              year,
              weekNum,
              historicalMatchups,
              mapName
            )
          );

          const diff1 = avg1 - avg2;
          const diff2 = -diff1;
          const err1 = calculateErrorFunctionCoefficient(diff1, sigma2);
          const err2 = calculateErrorFunctionCoefficient(diff2, sigma1);
          const winPct1 = calculateWinPercentage(diff1, err1);
          const winPct2 = calculateWinPercentage(diff2, err2);

          return {
            team1: t1,
            team2: t2,
            avg1,
            avg2,
            odds: calculateMoneylineOdds(winPct1, winPct2),
            overUnder: calculateOverUnder(avg1, avg2)
          };
        })
        .filter(Boolean);

      return { week: weekNum, matchups };
    });
  }, [weeklyScheduleData, historicalMatchups]);

  if (loading) return <div className="py-4 text-center">Loading...</div>;
  if (error) return <div className="py-4 text-center text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-center text-3xl font-bold mb-6">
        Full Season Matchups & Odds
      </h1>

      {allMatchupsByWeek.map(({ week, matchups }) => (
        <div key={week} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Week {week}</h2>
          {matchups.map((m, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-center bg-white shadow rounded p-4 mb-4"
            >
              <div className="flex-1 text-center sm:text-left">
                <span className="text-blue-800 font-bold">{m.team1}</span> vs{' '}
                <span className="text-green-800 font-bold">{m.team2}</span>
              </div>
              <div className="flex-1 text-center">
                ML: <span className="font-semibold">{m.odds.team1Formatted}</span> /
                <span className="font-semibold">{m.odds.team2Formatted}</span>
              </div>
              <div className="flex-1 text-center">
                O/U: <span className="font-semibold">{m.overUnder}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WeeklyMatchupsDisplay;
