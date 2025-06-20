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
  const SCHEDULE_API_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';


  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(SCHEDULE_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeeklyScheduleData(data);
        // console.log("WeeklyMatchupsDisplay: Fetched weekly schedule data:", data); // Debugging log
      } catch (e) {
        console.error("Error fetching weekly schedule data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduleData();
  }, []); // Only run once on mount for the schedule data


  // Calculate all league metrics once to get seasonal DPR and average scores
  // This is crucial for getting player-specific data for all betting calculations
  const { seasonalMetrics } = useMemo(() => {
    if (historicalMatchups && historicalMatchups.length > 0) {
      const metrics = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);
      // console.log("WeeklyMatchupsDisplay: Calculated seasonalMetrics from historicalMatchups:", metrics.seasonalMetrics); // Debugging log
      return metrics;
    }
    // console.warn("WeeklyMatchupsDisplay: seasonalMetrics not calculated because historicalMatchups is empty."); // Debugging warning
    return { seasonalMetrics: {} }; // Default empty if no historical matchups
  }, [historicalMatchups, getMappedTeamName]);


  const processedWeeklyMatchups = useMemo(() => {
    if (!weeklyScheduleData || weeklyScheduleData.length === 0 || Object.keys(seasonalMetrics).length === 0) {
      // console.warn("WeeklyMatchupsDisplay: Skipping matchup processing due to missing weeklyScheduleData or seasonalMetrics."); // Debugging warning
      return {};
    }

    const matchupsByWeek = {};
    const weekHeaders = Object.keys(weeklyScheduleData[0] || {}).filter(key => key.startsWith('Week_'));

    weekHeaders.forEach(weekKey => {
      const weekNumber = parseInt(weekKey.replace('Week_', ''));
      matchupsByWeek[`Week ${weekNumber}`] = [];
      const seenPairs = new Set(); // To avoid duplicate matchups (e.g., A vs B and B vs A)

      weeklyScheduleData.forEach(playerRow => {
        const player1Name = playerRow.Player;
        const player2Name = playerRow[weekKey];

        if (player1Name && player2Name && player1Name !== '' && player2Name !== '') {
          const canonicalPair = [player1Name, player2Name].sort().join('-');

          if (!seenPairs.has(canonicalPair)) {
            // Determine the current year for statistics (assuming the latest year from historical data)
            const years = Object.keys(seasonalMetrics).map(Number).sort((a,b) => b-a);
            const currentYear = years.length > 0 ? years[0] : new Date().getFullYear();

            let moneylineOdds = { player1Odds: 'N/A', player2Odds: 'N/A' };
            let overUnder = 'N/A';
            let p1WinProbForDisplay = 'N/A'; // For debugging
            let p2WinProbForDisplay = 'N/A'; // For debugging

            // Retrieve basic player metrics for the current year
            const player1Metrics = getPlayerMetricsForYear(seasonalMetrics, player1Name, currentYear);
            const player2Metrics = getPlayerMetricsForYear(seasonalMetrics, player2Name, currentYear);

            if (player1Metrics && player2Metrics) {
              // --- O/U Calculation (always uses average scores) ---
              overUnder = calculateOverUnder(player1Metrics.averageScore, player2Metrics.averageScore);

              // --- Moneyline Odds Logic: DPR for Weeks 1-3, new calculation for later weeks ---
              if (weekNumber <= 3) {
                // Use DPR for early weeks
                // Handle case where DPR might be 0 (e.g., no games played yet or no data)
                const p1DPR = player1Metrics.adjustedDPR;
                const p2DPR = player2Metrics.adjustedDPR;

                let p1WinProbFromDPR;
                let p2WinProbFromDPR;

                if (p1DPR === 0 && p2DPR === 0) {
                    p1WinProbFromDPR = 0.5; // Default to 50/50 if both DPRs are zero
                    p2WinProbFromDPR = 0.5;
                } else if (p1DPR === 0) { // If one is 0, the other is a heavy favorite
                    p1WinProbFromDPR = 0.01;
                    p2WinProbFromDPR = 0.99;
                } else if (p2DPR === 0) { // If one is 0, the other is a heavy favorite
                    p1WinProbFromDPR = 0.99;
                    p2WinProbFromDPR = 0.01;
                } else {
                    const totalDPR = p1DPR + p2DPR;
                    p1WinProbFromDPR = p1DPR / totalDPR;
                    p2WinProbFromDPR = p2DPR / totalDPR;
                }
                moneylineOdds = calculateMoneylineOdds(p1WinProbFromDPR, p2WinProbFromDPR);
                p1WinProbForDisplay = p1WinProbFromDPR.toFixed(4); // For debugging
                p2WinProbForDisplay = p2WinProbFromDPR.toFixed(4); // For debugging

              } else {
                // For later weeks, use the complex calculation chain
                // Calculate metrics up to the *previous* week for projections of the current week's match
                const statsUpToWeek = weekNumber; // For calculateTeamAverageDifferenceVsOpponent and calculateSigmaSquaredOverCount, we use matches *before* currentWeek

                // Calculation 1: Average Difference vs Opponent for Player 1 (up to current week - 1)
                const p1AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player1Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                // Calculation 2: Sigma Squared Over Count for Player 1 (up to current week - 1)
                const p1SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player1Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                // Calculation 3: Error Function Coefficient for Player 1
                const p1ErrorCoeff = calculateErrorFunctionCoefficient(p1AvgDiffVsOpponent, p1SigmaSquaredOverCount);

                // For Player 2 (opponent)
                const p2AvgDiffVsOpponent = calculateTeamAverageDifferenceVsOpponent(player2Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p2SigmaSquaredOverCount = calculateSigmaSquaredOverCount(player2Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);
                const p2ErrorCoeff = calculateErrorFunctionCoefficient(p2AvgDiffVsOpponent, p2SigmaSquaredOverCount);


                // Calculate the average scoring difference *between the two players* for win probability
                // This is player1's average score vs player2's average score, based on historical up to this point
                const matchupAvgScoringDiff = calculateFutureOpponentAverageScoringDifference(player1Name, player2Name, currentYear, statsUpToWeek, historicalMatchups, getMappedTeamName);

                // Calculate win probabilities using the complex formula
                const p1WinProb = calculateWeeklyWinPercentageProjection(matchupAvgScoringDiff, p1ErrorCoeff);
                // The opponent's probability is just 1 minus the player's probability for a two-outcome system
                const p2WinProb = 1 - p1WinProb;

                moneylineOdds = calculateMoneylineOdds(p1WinProb, p2WinProb);
                p1WinProbForDisplay = p1WinProb.toFixed(4); // For debugging
                p2WinProbForDisplay = p2WinProb.toFixed(4); // For debugging
              }

              // Debugging log for win probabilities
              console.log(`DEBUG: Week ${weekNumber} - ${player1Name} vs ${player2Name}`);
              console.log(`DEBUG:   ${player1Name} Win Prob: ${p1WinProbForDisplay}`);
              console.log(`DEBUG:   ${player2Name} Win Prob: ${p2WinProbForDisplay}`);
              console.log(`DEBUG:   Calculated Moneyline: ${player1Name} ${moneylineOdds.player1Odds}, ${player2Name} ${moneylineOdds.player2Odds}`);
              console.log(`DEBUG:   Calculated Over/Under: ${overUnder}`);

            } else {
                console.warn(`WeeklyMatchupsDisplay: Missing basic metrics for ${player1Name} or ${player2Name} for year ${currentYear}. Cannot calculate odds/O/U.`);
            }

            matchupsByWeek[`Week ${weekNumber}`].push({
              player1: player1Name,
              player2: player2Name,
              moneylineOdds: moneylineOdds,
              overUnder: overUnder,
              // Optionally add win probabilities to the matchup object if you want to display them directly
              // p1WinProb: p1WinProbForDisplay,
              // p2WinProb: p2WinProbForDisplay,
            });
            seenPairs.add(canonicalPair);
          }
        }
      });
    });
    // console.log("WeeklyMatchupsDisplay: Processed weekly matchups with odds:", matchupsByWeek); // Debugging log
    return matchupsByWeek;
  }, [weeklyScheduleData, seasonalMetrics, historicalMatchups, getMappedTeamName]);


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
          <p className="text-sm text-gray-500 mt-4">Please ensure the Google Apps Script is deployed as a web app with "Anyone" access and returns valid JSON.</p>
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
