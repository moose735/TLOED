// TLOED/src/lib/WeeklyMatchupsDisplay.jsx

import React, { useState, useEffect, useMemo } from 'react';

// Import the new betting calculation
import {
  calculateMoneylineOdds,
  calculateOverUnder,
  getPlayerMetricsForYear,
  calculateTeamAverageDifferenceVsOpponent,
  calculateSigmaSquaredOverCount,
  calculateFutureOpponentAverageScoringDifference,
  calculateErrorFunctionCoefficient,
  calculateWeeklyWinPercentageProjection
} from '../utils/bettingCalculations';

// Import calculateAllLeagueMetrics to get seasonal DPR and average score
import { calculateAllLeagueMetrics } from '../utils/calculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]); // Your original schedule data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // URL for your original Google Apps Script schedule data
  // Ensure this matches the *correct* API URL for schedule data that returns 200 OK with JSON
  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true); // Ensure loading is true at the start of fetch
      setError(null);
      console.log("WeeklyMatchupsDisplay: --- STARTING FETCH ---"); // DEBUG
      try {
        const response = await fetch(SCHEDULE_API_URL);
        console.log("WeeklyMatchupsDisplay: Fetch response received. Status:", response.status, "OK:", response.ok); // DEBUG

        if (!response.ok) {
          const errorText = await response.text();
          console.error("WeeklyMatchupsDisplay: HTTP error fetching schedule data:", response.status, errorText.substring(0, 100) + '...');
          throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}...`);
        }

        const data = await response.json();
        console.log("WeeklyMatchupsDisplay: Data parsed from JSON. Type:", typeof data, "Length:", Array.isArray(data) ? data.length : 'N/A', "Sample:", data ? data[0] : 'N/A'); // DEBUG: Inspect parsed data
        
        setWeeklyScheduleData(data);
        console.log("WeeklyMatchupsDisplay: weeklyScheduleData state updated."); // DEBUG: Confirm state update
        
        if (data.length === 0) {
          console.warn("WeeklyMatchupsDisplay: Fetched schedule data is empty after parsing."); // DEBUG
        }

      } catch (e) {
        console.error("WeeklyMatchupsDisplay: Error during fetch or JSON parsing:", e.message, e); // DEBUG: More detailed error
        setError(e.message);
      } finally {
        setLoading(false);
        console.log("WeeklyMatchupsDisplay: --- FETCH OPERATION COMPLETED. Loading set to false. ---"); // DEBUG
      }
    };

    fetchScheduleData();
  }, []); // Empty dependency array means this runs once on mount

  // Memoize seasonal metrics calculation to prevent re-calculation on every render
  const seasonalMetrics = useMemo(() => {
    console.log("WeeklyMatchupsDisplay: --- Starting calculateAllLeagueMetrics ---");
    const metrics = calculateAllLeagueMetrics(historicalMatchups);
    console.log("WeeklyMatchupsDisplay: --- Finished calculateAllLeagueMetrics ---");
    console.log("WeeklyMatchupsDisplay: Calculated seasonalMetrics:", metrics);
    return metrics;
  }, [historicalMatchups]);

  // Memoize processed weekly matchups data
  const processedWeeklyMatchups = useMemo(() => {
    console.log("WeeklyMatchupsDisplay: Starting processedWeeklyMatchups useMemo.");
    console.log("WeeklyMatchupsDisplay: weeklyScheduleData status: Length:", weeklyScheduleData.length);
    console.log("WeeklyMatchupsDisplay: seasonalMetrics status: Keys:", Object.keys(seasonalMetrics));

    // Ensure both weeklyScheduleData and seasonalMetrics are available before processing
    if (weeklyScheduleData.length === 0 || Object.keys(seasonalMetrics).length === 0) {
      console.log("WeeklyMatchupsDisplay: Skipping matchup processing due to missing weeklyScheduleData or seasonalMetrics.");
      return {};
    }

    const currentYear = new Date().getFullYear();
    const metricsForCurrentYear = seasonalMetrics[currentYear] || {};
    const processed = {};

    weeklyScheduleData.forEach(match => {
      const week = Object.keys(match).find(key => key.startsWith('Week_'));
      if (week) {
        const weekNum = parseInt(week.replace('Week_', ''));
        const player1Name = match.Player;
        const player2Name = match[week];

        // Retrieve player metrics for both players
        const player1Metrics = getPlayerMetricsForYear(player1Name, currentYear, seasonalMetrics);
        const player2Metrics = getPlayerMetricsForYear(player2Name, currentYear, seasonalMetrics);

        // Calculate average point differentials
        const avgDiffVsOpponentPlayer1 = calculateTeamAverageDifferenceVsOpponent(player1Metrics, player2Metrics);
        const avgDiffVsOpponentPlayer2 = calculateTeamAverageDifferenceVsOpponent(player2Metrics, player1Metrics);

        // Calculate error function coefficients
        const errorCoeffPlayer1 = calculateErrorFunctionCoefficient(player1Metrics, player2Metrics);
        const errorCoeffPlayer2 = calculateErrorFunctionCoefficient(player2Metrics, player1Metrics);

        // Calculate win percentages
        const winProbabilityPlayer1 = calculateWeeklyWinPercentageProjection(avgDiffVsOpponentPlayer1, errorCoeffPlayer1);
        const winProbabilityPlayer2 = calculateWeeklyWinPercentageProjection(avgDiffVsOpponentPlayer2, errorCoeffPlayer2);

        // Moneyline odds for Player 1 winning (based on Player 1's win probability)
        const moneylinePlayer1 = calculateMoneylineOdds(winProbabilityPlayer1);
        // Moneyline odds for Player 2 winning (based on Player 2's win probability)
        const moneylinePlayer2 = calculateMoneylineOdds(winProbabilityPlayer2);

        // Calculate over/under
        const overUnder = calculateOverUnder(player1Metrics, player2Metrics, metricsForCurrentYear.averageScore || 0);

        if (!processed[weekNum]) {
          processed[weekNum] = [];
        }

        processed[weekNum].push({
          player1: player1Name,
          player2: player2Name,
          player1WinProb: winProbabilityPlayer1,
          player2WinProb: winProbabilityPlayer2,
          moneylinePlayer1: moneylinePlayer1,
          moneylinePlayer2: moneylinePlayer2,
          overUnder: overUnder,
        });
      }
    });
    console.log("WeeklyMatchupsDisplay: Finished processedWeeklyMatchups useMemo.");
    return processed;
  }, [weeklyScheduleData, seasonalMetrics, getMappedTeamName]);

  const currentYear = new Date().getFullYear();
  const weeks = Object.keys(processedWeeklyMatchups).map(Number).sort((a, b) => a - b);

  if (loading) {
    return <div className="text-center py-4 text-lg text-blue-600">Loading weekly matchups...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-lg text-red-600">Error: {error}</div>;
  }

  if (weeks.length === 0) {
    return <div className="text-center py-4 text-lg text-gray-600 italic">No weekly matchup data available.</div>;
  }

  return (
    <div className="weekly-matchups-display bg-white shadow-lg rounded-lg p-6 mb-8 w-full max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Weekly Matchups {currentYear}</h2>
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {weeks.map(weekNum => (
          <div key={weekNum} className="week-card bg-gray-50 rounded-lg shadow-md overflow-hidden">
            <h3 className="text-xl font-semibold text-gray-700 bg-gray-200 p-3 text-center">Week {weekNum}</h3>
            <ul className="divide-y divide-gray-200">
              {processedWeeklyMatchups[weekNum] && processedWeeklyMatchups[weekNum].length > 0 ? (
                processedWeeklyMatchups[weekNum].map((match, index) => (
                  <li key={index} className="matchup-item p-4 flex flex-col sm:flex-row items-center justify-between text-gray-800">
                    <div className="flex flex-col items-center sm:items-start mb-3 sm:mb-0 sm:w-1/3">
                      <span className="text-lg font-bold">{getMappedTeamName(match.player1)}</span>
                      <span className="text-sm text-gray-500">({getMappedTeamName(match.player2)})</span>
                    </div>
                    <div className="matchup-details flex flex-col items-center sm:w-2/3 sm:ml-4">
                      <div className="flex justify-around w-full mb-2">
                        {/* Player 1 Win Probability */}
                        <div className="flex-1 text-center border-r border-gray-200 pr-2">
                          <span className="block text-xs font-medium text-gray-600">P1 Win %</span>
                          <span className="block text-lg font-bold text-green-700">{(match.player1WinProb * 100).toFixed(1)}%</span>
                        </div>
                        {/* Player 2 Win Probability */}
                        <div className="flex-1 text-center pl-2">
                          <span className="block text-xs font-medium text-gray-600">P2 Win %</span>
                          <span className="block text-lg font-bold text-red-700">{(match.player2WinProb * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-around w-full"> {/* This was the div with a missing closing tag */}
                        {/* Moneyline Display for Player 1 */}
                        <div className="flex-1 text-center border-r border-gray-200 pr-2">
                          <span className="block text-xs font-medium text-gray-600">Moneyline P1</span>
                          <span className="block text-lg font-bold text-blue-700">{match.moneylinePlayer1}</span>
                        </div>
                        {/* Moneyline Display for Player 2 */}
                        <div className="flex-1 text-center pl-2">
                          <span className="block text-xs font-medium text-gray-600">Moneyline P2</span>
                          <span className="block text-lg font-bold text-blue-700">{match.moneylinePlayer2}</span>
                        </div>
                      </div> {/* Added missing closing div here */}
                      <div className="flex w-full mt-2 border-t border-gray-200 pt-2">
                        {/* Over */}
                        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-2 h-full bg-blue-50 rounded-bl-lg sm:rounded-bl-none sm:rounded-tr-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200">
                          <span className="text-sm font-medium text-gray-600">O/U</span>
                          <span className="text-xl font-bold text-blue-700">O {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
                        </div>
                        {/* Under */}
                        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-2 h-full bg-blue-50 rounded-br-lg sm:rounded-br-none sm:rounded-bl-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200">
                          <span className="text-sm font-medium text-gray-600">O/U</span>
                          <span className="text-xl font-bold text-blue-700">U {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <p className="text-gray-600 italic text-center py-4">No matchups for this week.</p>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyMatchupsDisplay;
