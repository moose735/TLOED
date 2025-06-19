// TLOED/src/lib/WeeklyMatchupsDisplay.jsx
import React, { useState, useEffect, useMemo } from 'react';
// Import the new betting calculations
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
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Assuming this provides seasonalMetrics

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => { // Accept props
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const JSON_DATA_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchWeeklyData = async () => {
      try {
        const response = await fetch(JSON_DATA_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeeklyData(data);
      } catch (e) {
        console.error("Error fetching weekly data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyData();
  }, []);

  // Calculate all league metrics once to get seasonal DPR and average scores
  // This is crucial for getting player-specific data for betting calculations
  const { seasonalMetrics } = useMemo(() => {
    // Only calculate if historicalMatchups is available
    if (historicalMatchups && historicalMatchups.length > 0) {
      return calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);
    }
    return { seasonalMetrics: {} }; // Default empty if no historical matchups
  }, [historicalMatchups, getMappedTeamName]);


  const processedWeeklyMatchups = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0 || Object.keys(seasonalMetrics).length === 0) return {};

    const matchupsByWeek = {};
    const weekHeaders = Object.keys(weeklyData[0] || {}).filter(key => key.startsWith('Week_'));

    weekHeaders.forEach(weekKey => {
      const weekNumber = parseInt(weekKey.replace('Week_', ''));
      matchupsByWeek[`Week ${weekNumber}`] = [];
      const seenPairs = new Set(); // To avoid duplicate matchups (e.g., A vs B and B vs A)

      weeklyData.forEach(playerRow => {
        const player1Name = playerRow.Player;
        const player2Name = playerRow[weekKey];

        if (player1Name && player2Name && player1Name !== '' && player2Name !== '') {
          const canonicalPair = [player1Name, player2Name].sort().join('-');

          if (!seenPairs.has(canonicalPair)) {
            const years = Object.keys(seasonalMetrics).map(Number).sort((a,b) => b-a);
            const currentYear = years.length > 0 ? years[0] : new Date().getFullYear(); // Use latest year from seasonalMetrics

            const player1Metrics = getPlayerMetricsForYear(seasonalMetrics, player1Name, currentYear);
            const player2Metrics = getPlayerMetricsForYear(seasonalMetrics, player2Name, currentYear);

            let moneylineOdds = { player1Odds: 'N/A', player2Odds: 'N/A' };
            let overUnder = 'N/A';

            if (player1Metrics && player2Metrics) {
              // Calculate O/U regardless of week, using average scores
              overUnder = calculateOverUnder(player1Metrics.averageScore, player2Metrics.averageScore);

              // Moneyline Odds Logic: DPR for Weeks 1-3, new calculation for later weeks
              if (weekNumber <= 3) {
                // Use DPR for early weeks
                moneylineOdds = calculateMoneylineOdds(player1Metrics.adjustedDPR, player2Metrics.adjustedDPR);
              } else {
                // For later weeks, apply the more complex calculation
                const p1AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player1Name, currentYear, seasonalMetrics);
                const p1SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player1Name, currentYear, seasonalMetrics);
                const p1ErrorCoeff = calculateErrorFunctionCoefficient(p1AvgDiffVsOpponent, p1SigmaSquaredOverCount);

                const p2AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player2Name, currentYear, seasonalMetrics);
                const p2SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player2Name, currentYear, seasonalMetrics);
                const p2ErrorCoeff = calculateErrorFunctionCoefficient(p2AvgDiffVsOpponent, p2SigmaSquaredOverCount);

                // Calculate the average scoring difference between the two teams for win probability
                const p1FutureOpponentAvgScoringDiff = calculateFutureOpponentAverageScoringDifference(player1Name, player2Name, currentYear, seasonalMetrics);
                const p2FutureOpponentAvgScoringDiff = calculateFutureOpponentAverageScoringDifference(player2Name, player1Name, currentYear, seasonalMetrics); // This will be the negative of p1's diff if symmetric

                // Use the new formula for win percentage projection
                const p1WinProb = calculateWeeklyWinPercentageProjection(p1FutureOpponentAvgScoringDiff, p1ErrorCoeff);
                // Ensure p2WinProb is (1 - p1WinProb) to represent a two-outcome event for moneyline
                const p2WinProb = 1 - p1WinProb; // Or calculate it symmetrically: calculateWeeklyWinPercentageProjection(p2FutureOpponentAvgScoringDiff, p2ErrorCoeff);

                // Use the calculated win probabilities for moneyline odds
                moneylineOdds = calculateMoneylineOdds(p1WinProb, p2WinProb);
              }
            }

            matchupsByWeek[`Week ${weekNumber}`].push({
              player1: player1Name,
              player2: player2Name,
              moneylineOdds: moneylineOdds,
              overUnder: overUnder,
            });
            seenPairs.add(canonicalPair);
          }
        }
      });
    });
    return matchupsByWeek;
  }, [weeklyData, seasonalMetrics, getMappedTeamName]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <p className="text-xl font-semibold text-blue-600">Loading weekly matchups...</p>
          <div className="mt-4 flex justify-center">
            {/* Simple loading spinner */}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-red-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border-2 border-red-500">
          <p className="text-xl font-semibold text-red-700">Error loading data:</p>
          <p className="text-gray-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Please ensure the Google Apps Script is deployed as a web app with "Anyone" access.</p>
        </div>
      </div>
    );
  }

  // Check if processed data is empty after loading
  if (Object.keys(processedWeeklyMatchups).length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <p className="text-xl font-semibold text-gray-700">No weekly matchup data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-8 overflow-hidden">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-blue-800 mb-6 border-b-2 pb-4">
          Weekly Matchups
        </h1>

        <div className="space-y-8"> {/* Container for weekly sections */}
          {Object.entries(processedWeeklyMatchups).sort(([weekA], [weekB]) => {
            // Sort weeks numerically (e.g., "Week 1" before "Week 10")
            const numA = parseInt(weekA.replace('Week ', ''));
            const numB = parseInt(weekB.replace('Week ', ''));
            return numA - numB;
          }).map(([weekTitle, matchups], index) => (
            <div key={index} className="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200">
              <h2 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
                {weekTitle} Matchups
              </h2>
              <ul className="list-none space-y-4 text-gray-800">
                {matchups.length > 0 ? (
                  matchups.map((match, matchIndex) => (
                    <li key={matchIndex} className="flex bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                      {/* Player Names and ML Odds Column */}
                      <div className="flex flex-col flex-1 divide-y divide-gray-200">
                        {/* Player 1 Row */}
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-lg font-semibold text-gray-900">{match.player1}</span>
                          <div className="flex items-center justify-center w-24 h-10 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors duration-200">
                            <span className="text-xl font-bold text-blue-700">{match.moneylineOdds.player1Odds}</span>
                          </div>
                        </div>
                        {/* Player 2 Row */}
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-lg font-semibold text-gray-900">{match.player2}</span>
                          <div className="flex items-center justify-center w-24 h-10 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors duration-200">
                            <span className="text-xl font-bold text-blue-700">{match.moneylineOdds.player2Odds}</span>
                          </div>
                        </div>
                      </div>

                      {/* Over/Under Column */}
                      <div className="flex flex-col flex-none w-[100px] border-l border-gray-200 divide-y divide-gray-200">
                        {/* Over */}
                        <div className="flex flex-col items-center justify-center p-2 h-1/2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors duration-200">
                          <span className="text-xl font-bold text-blue-700">O {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
                        </div>
                        {/* Under */}
                        <div className="flex flex-col items-center justify-center p-2 h-1/2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors duration-200">
                          <span className="text-xl font-bold text-blue-700">U {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-gray-600">No matchups for this week.</p>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyMatchupsDisplay;
