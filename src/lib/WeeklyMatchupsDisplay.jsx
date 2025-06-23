// src/lib/WeeklyMatchupsDisplay.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  getWeeklyScoresByTeam,
  getPlayerMetricsForYear,
  calculateMoneylineOdds,
  calculateOverUnder
} from '../utils/bettingCalculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(SCHEDULE_API_URL);
        const json = await res.json();
        setWeeklyScheduleData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const processedMatchups = useMemo(() => {
    if (!historicalMatchups || !weeklyScheduleData.length) return [];

    const latestYear = Math.max(...historicalMatchups.map(h => +h.year || 0));
    const weeklyScores = getWeeklyScoresByTeam(historicalMatchups, getMappedTeamName);

    const matchupsByWeek = {};

    weeklyScheduleData.forEach(entry => {
      const team = entry.Player;
      Object.entries(entry).forEach(([key, value]) => {
        if (key.startsWith('Week_') && value && value !== team) {
          const weekNum = key.split('_')[1];
          const matchupId = [team, value].sort().join(' vs ');
          if (!matchupsByWeek[weekNum]) matchupsByWeek[weekNum] = {};
          matchupsByWeek[weekNum][matchupId] = { team1: team, team2: value };
        }
      });
    });

    const flattened = [];
    Object.entries(matchupsByWeek).forEach(([week, matchups]) => {
      Object.entries(matchups).forEach(([_, { team1, team2 }]) => {
        const metrics1 = getPlayerMetricsForYear(team1, team2, latestYear, weeklyScores);
        const metrics2 = getPlayerMetricsForYear(team2, team1, latestYear, weeklyScores);
        const odds = calculateMoneylineOdds(metrics1.winPct, metrics2.winPct);
        const ou = calculateOverUnder(metrics1.teamAvg, metrics2.teamAvg);

        flattened.push({
          week,
          team1,
          team2,
          odds,
          overUnder: ou
        });
      });
    });

    return flattened;
  }, [weeklyScheduleData, historicalMatchups, getMappedTeamName]);

  if (loading) return <div>Loading weekly schedule...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-4">Weekly Matchups & Odds</h1>
      {processedMatchups.length === 0 ? (
        <div>No matchups found.</div>
      ) : (
        processedMatchups.reduce((acc, match) => {
          if (!acc[match.week]) acc[match.week] = [];
          acc[match.week].push(match);
          return acc;
        }, {})
      ).map(([week, games]) => (
        <div key={week} className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Week {week}</h2>
          <ul className="space-y-3">
            {games.map((match, i) => (
              <li key={i} className="bg-white p-4 rounded shadow flex justify-between items-center">
                <div className="flex-1 text-blue-700 font-bold">{match.team1}</div>
                <div className="text-gray-500">vs</div>
                <div className="flex-1 text-green-700 font-bold text-right">{match.team2}</div>
                <div className="ml-4 text-center">
                  <div className="text-sm">ML: {match.odds.team1} / {match.odds.team2}</div>
                  <div className="text-sm">O/U: {match.overUnder}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default WeeklyMatchupsDisplay;
