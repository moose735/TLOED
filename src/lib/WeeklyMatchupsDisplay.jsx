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
  calculateWeeklyWinPercentageProjection,
  calculateStandardDeviation // Import the new standard deviation helper
} from '../utils/bettingCalculations';

// Import calculateAllLeagueMetrics to get seasonal DPR and average score
import { calculateAllLeagueMetrics } from '../utils/calculations';

const WeeklyMatchupsDisplay = ({ historicalMatchups, getMappedTeamName }) => {
  const [weeklyScheduleData, setWeeklyScheduleData] = useState([]); // Your original schedule data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // URL for your original Google Apps Script schedule data
  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true);
      setError(null);
      console.log("WeeklyMatchupsDisplay: Starting fetch for weekly schedule data..."); // DEBUG
      try {
        const response = await fetch(SCHEDULE_API_URL);
        if (!response.ok) {
          const errorText = await response.text(); // Try to get more detail from response
          console.error("WeeklyMatchupsDisplay: HTTP error fetching schedule data:", response.status, errorText); // DEBUG
          throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}...`);
        }
        const data = await response.json();
        setWeeklyScheduleData(data);
        console.log("WeeklyMatchupsDisplay: Fetched weekly schedule data:", data); // DEBUG
        if (data.length === 0) {
          console.warn("WeeklyMatchupsDisplay: Fetched schedule data is empty."); // DEBUG
        }
      } catch (e) {
        console.error("WeeklyMatchupsDisplay: Error fetching weekly schedule data:", e); // DEBUG
        setError(e.message);
      } finally {
        setLoading(false); // Make sure loading is set to false even on error
        console.log("WeeklyMatchupsDisplay: Fetch operation completed. Loading set to false."); // DEBUG
      }
    };

    fetchScheduleData();
  }, []);

  // Calculate all league metrics once to get seasonal DPR and average score
  const { seasonalMetrics } = useMemo(() => {
    console.log("WeeklyMatchupsDisplay: historicalMatchups received:", historicalMatchups); // DEBUG
    if (historicalMatchups && historicalMatchups.length > 0) {
      const metrics = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);
      console.log("WeeklyMatchupsDisplay: Calculated seasonalMetrics:", metrics.seasonalMetrics); // DEBUG
      if (Object.keys(metrics.seasonalMetrics).length === 0) {
        console.warn("WeeklyMatchupsDisplay: seasonalMetrics object is empty after calculation."); // DEBUG
      }
      return metrics;
    }
    console.warn("WeeklyMatchupsDisplay: seasonalMetrics not calculated because historicalMatchups is empty or null."); // DEBUG
    return { seasonalMetrics: {} };
  }, [historicalMatchups, getMappedTeamName]);

  const processedWeeklyMatchups = useMemo(() => {
    console.log("WeeklyMatchupsDisplay: Starting processedWeeklyMatchups useMemo."); // DEBUG
    console.log("weeklyScheduleData status:", weeklyScheduleData ? `Length: ${weeklyScheduleData.length}` : 'null/undefined'); // DEBUG
    console.log("seasonalMetrics status:", Object.keys(seasonalMetrics).length > 0 ? `Keys: ${Object.keys(seasonalMetrics).join(', ')}` : 'empty'); // DEBUG

    if (!weeklyScheduleData || weeklyScheduleData.length === 0 || Object.keys(seasonalMetrics).length === 0) {
      console.warn("WeeklyMatchupsDisplay: Skipping matchup processing due to missing weeklyScheduleData or seasonalMetrics."); // DEBUG
      return {};
    }

    const matchupsByWeek = {};
    // Ensure playerRow is an object before trying to access keys
    const firstRow = weeklyScheduleData[0];
    if (!firstRow || typeof firstRow !== 'object') {
      console.error("WeeklyMatchupsDisplay: First row of weeklyScheduleData is not an object or is missing."); // DEBUG
      return {};
    }
    const weekHeaders = Object.keys(firstRow).filter(key => key.startsWith('Week_'));

    if (weekHeaders.length === 0) {
      console.warn("WeeklyMatchupsDisplay: No 'Week_' headers found in weeklyScheduleData. Check data format."); // DEBUG
      return {};
    }
    console.log("WeeklyMatchupsDisplay: Detected week headers:", weekHeaders); // DEBUG


    weekHeaders.forEach(weekKey => {
      const weekNumber = parseInt(weekKey.replace('Week_', ''));
      matchupsByWeek[`Week ${weekNumber}`] = [];
      const seenPairs = new Set();

      weeklyScheduleData.forEach(playerRow => {
        const player1Name = playerRow.Player;
        const player2Name = playerRow[weekKey];

        if (player1Name && player2Name && player1Name !== '' && player2Name !== '') {
          const canonicalPair = [player1Name, player2Name].sort().join('-');

          if (!seenPairs.has(canonicalPair)) {
            const years = Object.keys(seasonalMetrics).map(Number).sort((a,b) => b-a);
            const currentYear = years.length > 0 ? years[0] : new Date().getFullYear();
            console.log(`Processing Week ${weekNumber}: ${player1Name} vs ${player2Name} for year ${currentYear}`); // DEBUG

            let moneylineOdds = { player1Odds: 'N/A', player2Odds: 'N/A' };
            let overUnder = 'N/A';

            const player1Metrics = getPlayerMetricsForYear(seasonalMetrics, player1Name, currentYear);
            const player2Metrics = getPlayerMetricsForYear(seasonalMetrics, player2Name, currentYear);

            if (player1Metrics && player2Metrics) {
              overUnder = calculateOverUnder(player1Metrics.averageScore, player2Metrics.averageScore);

              if (weekNumber <= 3) {
                const p1DPR = player1Metrics.adjustedDPR;
                const p2DPR = player2Metrics.adjustedDPR;
                let p1WinProbFromDPR, p2WinProbFromDPR;

                if (p1DPR === 0 && p2DPR === 0) {
                    p1WinProbFromDPR = 0.5;
                    p2WinProbFromDPR = 0.5;
                } else if (p1DPR === 0) {
                    p1WinProbFromDPR = 0.01;
                    p2WinProbFromDPR = 0.99;
                } else if (p2DPR === 0) {
                    p1WinProbFromDPR = 0.99;
                    p2WinProbFromDPR = 0.01;
                } else {
                    const totalDPR = p1DPR + p2DPR;
                    p1WinProbFromDPR = p1DPR / totalDPR;
                    p2WinProbFromDPR = p2DPR / totalDPR;
                }
                moneylineOdds = calculateMoneylineOdds(p1WinProbFromDPR, p2WinProbFromDPR);

              } else {
                const statsUpToWeek = weekNumber; // This is correct, means up to week (current week - 1)
                console.log(`  Calculating advanced metrics for Week ${weekNumber} using stats up to Week ${statsUpToWeek -1}`); // DEBUG

                const p1AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player1Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p2SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player2Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p1ErrorCoeff = calculateErrorFunctionCoefficient(p1AvgDiffVsOpponent, p2SigmaSquaredOverCount);
                console.log(`    ${player1Name} - AvgDiff: ${p1AvgDiffVsOpponent.toFixed(2)}, ErrorCoeff: ${p1ErrorCoeff.toFixed(2)} (Opponent ${player2Name} SigmaSq: ${p2SigmaSquaredOverCount.toFixed(2)})`); // DEBUG

                const p2AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player2Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p1SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player1Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p2ErrorCoeff = calculateErrorFunctionCoefficient(p2AvgDiffVsOpponent, p1SigmaSquaredOverCount);
                console.log(`    ${player2Name} - AvgDiff: ${p2AvgDiffVsOpponent.toFixed(2)}, ErrorCoeff: ${p2ErrorCoeff.toFixed(2)} (Opponent ${player1Name} SigmaSq: ${p1SigmaSquaredOverCount.toFixed(2)})`); // DEBUG

                const p1WinProb = calculateWeeklyWinPercentageProjection(p1AvgDiffVsOpponent, p1ErrorCoeff);
                const p2WinProb = calculateWeeklyWinPercentageProjection(p2AvgDiffVsOpponent, p2ErrorCoeff);
                console.log(`    Raw Win Probs: ${player1Name}: ${p1WinProb.toFixed(3)}, ${player2Name}: ${p2WinProb.toFixed(3)}`); // DEBUG

                const totalCalculatedProb = p1WinProb + p2WinProb;
                const normalizedP1WinProb = totalCalculatedProb > 0 ? p1WinProb / totalCalculatedProb : 0.5;
                const normalizedP2WinProb = totalCalculatedProb > 0 ? p2WinProb / totalCalculatedProb : 0.5;
                console.log(`    Normalized Win Probs: ${player1Name}: ${normalizedP1WinProb.toFixed(3)}, ${player2Name}: ${normalizedP2WinProb.toFixed(3)}`); // DEBUG

                moneylineOdds = calculateMoneylineOdds(normalizedP1WinProb, normalizedP2WinProb);
                console.log(`    Calculated Moneyline: ${player1Name}: ${moneylineOdds.player1Odds}, ${player2Name}: ${moneylineOdds.player2Odds}`); // DEBUG

              }
            } else {
                console.warn(`WeeklyMatchupsDisplay: Missing basic metrics for ${player1Name} or ${player2Name} for year ${currentYear}. Cannot calculate odds/O/U. Player1: ${player1Metrics ? 'OK' : 'MISSING'}, Player2: ${player2Metrics ? 'OK' : 'MISSING'}`); // DEBUG
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
    console.log("WeeklyMatchupsDisplay: Finished processedWeeklyMatchups useMemo. Result:", matchupsByWeek); // DEBUG
    return matchupsByWeek;
  }, [weeklyScheduleData, seasonalMetrics, historicalMatchups, getMappedTeamName]);

  // ... (rest of the component, which you provided and should be fine)
  // The rendering part should now display data once processedWeeklyMatchups is populated
  // Check the `if (Object.keys(processedWeeklyMatchups).length === 0)` block
  // If it's hitting this and the data *should* be there, it means processing failed to populate it.

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter antialiased">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border border-blue-200">
          <p className="text-xl font-semibold text-indigo-600">Loading weekly matchups...</p>
          <div className="mt-4 flex justify-center">
            {/* Simple loading spinner */}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-4 font-inter antialiased">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border-2 border-red-500">
          <p className="text-xl font-semibold text-red-700">Error loading data:</p>
          <p className="text-gray-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Please ensure the Google Apps Script is deployed as a web app with "Anyone" access and returns valid JSON.</p>
        </div>
      </div>
    );
  }

  // Check if processed data is empty after loading
  if (Object.keys(processedWeeklyMatchups).length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter antialiased">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border border-blue-200">
          <p className="text-xl font-semibold text-gray-700">No weekly matchup data available after processing.</p> {/* Updated message */}
          <p className="text-sm text-gray-500 mt-4">This could mean the schedule data is empty, historical data is missing, or an issue occurred during calculation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 font-inter antialiased">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10 overflow-hidden border border-blue-100">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-indigo-800 mb-8 pb-4 border-b-4 border-blue-200 tracking-tight">
          Weekly Matchups
        </h1>

        <div className="space-y-10">
          {Object.entries(processedWeeklyMatchups).sort(([weekA], [weekB]) => {
            const numA = parseInt(weekA.replace('Week ', ''));
            const numB = parseInt(weekB.replace('Week ', ''));
            return numA - numB;
          }).map(([weekTitle, matchups], index) => (
            <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-200">
              <h2 className="text-2xl sm:text-3xl font-bold text-indigo-700 mb-6 border-b border-indigo-300 pb-3">
                {weekTitle} Matchups
              </h2>
              <ul className="list-none space-y-5 text-gray-800">
                {matchups.length > 0 ? (
                  matchups.map((match, matchIndex) => (
                    <li key={matchIndex} className="flex flex-col sm:flex-row bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden transform transition-transform duration-200 hover:scale-[1.01] hover:shadow-lg">
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-[2fr_1fr] divide-x divide-gray-100">
                        <div className="flex items-center justify-between p-4 border-b sm:border-b-0 sm:border-r border-gray-100">
                          <span className="text-lg sm:text-xl font-semibold text-gray-900">{match.player1}</span>
                          <div className="ml-4 flex flex-col items-center justify-center w-24 h-12 bg-indigo-50 rounded-md cursor-pointer hover:bg-indigo-100 transition-colors duration-200">
                            <span className="text-sm font-medium text-gray-600">ML</span>
                            <span className="text-xl font-bold text-indigo-700">{match.moneylineOdds.player1Odds}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <span className="text-lg sm:text-xl font-semibold text-gray-900">{match.player2}</span>
                          <div className="ml-4 flex flex-col items-center justify-center w-24 h-12 bg-indigo-50 rounded-md cursor-pointer hover:bg-indigo-100 transition-colors duration-200">
                            <span className="text-sm font-medium text-gray-600">ML</span>
                            <span className="text-xl font-bold text-indigo-700">{match.moneylineOdds.player2Odds}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col flex-none sm:w-[120px] border-t sm:border-t-0 sm:border-l border-gray-200 divide-x sm:divide-x-0 divide-y divide-gray-100">
                        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-2 h-full bg-blue-50 rounded-bl-lg sm:rounded-bl-none sm:rounded-tr-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200">
                          <span className="text-sm font-medium text-gray-600">O/U</span>
                          <span className="text-xl font-bold text-blue-700">O {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-2 h-full bg-blue-50 rounded-br-lg sm:rounded-br-none sm:rounded-bl-lg cursor-pointer hover:bg-blue-100 transition-colors duration-200">
                          <span className="text-sm font-medium text-gray-600">O/U</span>
                          <span className="text-xl font-bold text-blue-700">U {match.overUnder}</span>
                          <span className="text-sm font-normal text-gray-600">-110</span>
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
    </div>
  );
};

export default WeeklyMatchupsDisplay;
