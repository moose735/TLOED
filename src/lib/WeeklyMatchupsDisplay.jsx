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
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeeklyScheduleData(data);
        console.log("WeeklyMatchupsDisplay: Fetch response received. Status: " + response.status + " OK: " + response.ok); // DEBUG
        console.log("WeeklyMatchupsDisplay: Data parsed from JSON. Type: " + typeof data + " Length: " + data.length + " Sample: ", data[0]); // DEBUG
        console.log("WeeklyMatchupsDisplay: weeklyScheduleData state updated."); // DEBUG
      } catch (e) {
        console.error("WeeklyMatchupsDisplay: Fetch error:", e);
        setError(e.message);
      } finally {
        setLoading(false);
        console.log("WeeklyMatchupsDisplay: --- FETCH OPERATION COMPLETED. Loading set to false. ---"); // DEBUG
      }
    };

    fetchScheduleData();
  }, []); // Empty dependency array means this runs once on mount

  const processedWeeklyMatchups = useMemo(() => {
    console.log("WeeklyMatchupsDisplay: Starting processedWeeklyMatchups useMemo.");
    console.log("WeeklyMatchupsDisplay: weeklyScheduleData status: Length:", weeklyScheduleData.length);
    // Removed the problematic log: console.log("WeeklyMatchupsDisplay: seasonalMetrics status: Keys:", Object.keys(seasonalMetrics || {}));
    console.log("WeeklyMatchupsDisplay: historicalMatchups status: Type:", typeof historicalMatchups, "Length:", historicalMatchups ? historicalMatchups.length : 0);

    // Add historicalMatchups to the condition for skipping processing
    if (!weeklyScheduleData || weeklyScheduleData.length === 0 ||
        !historicalMatchups || historicalMatchups.length === 0) { // MODIFIED CONDITION
      console.log("WeeklyMatchupsDisplay: Skipping matchup processing due to missing weeklyScheduleData or historicalMatchups."); // MODIFIED LOG
      return [];
    }

    const currentYear = new Date().getFullYear(); // Assuming current year for projections
    const currentWeek = weeklyScheduleData[0]?.Week_Number; // Assuming week number is available in the first entry

    // Ensure getMappedTeamName is a function before passing it, or provide a fallback
    const safeGetMappedTeamName = typeof getMappedTeamName === 'function' ? getMappedTeamName : (name) => String(name || '').trim();

    // Call calculateAllLeagueMetrics here to get current seasonal and career data
    // This will now be called within the useMemo, ensuring it has the latest historicalMatchups
    const metrics = calculateAllLeagueMetrics(historicalMatchups, safeGetMappedTeamName); // Use safeGetMappedTeamName
    const seasonalMetricsForBetting = metrics.seasonalMetrics; // This will hold the seasonal stats for betting calculations

    // Now seasonalMetricsForBetting is defined, so we can log its keys
    console.log("WeeklyMatchupsDisplay: seasonalMetricsForBetting status: Keys:", Object.keys(seasonalMetricsForBetting || {})); // Corrected log

    // Ensure seasonalMetricsForBetting is available before proceeding with mapping
    if (!seasonalMetricsForBetting || Object.keys(seasonalMetricsForBetting).length === 0) {
      console.log("WeeklyMatchupsDisplay: Skipping matchup processing because seasonalMetricsForBetting is not available.");
      return [];
    }

    // Existing logic for processing matchups
    return weeklyScheduleData.map(match => {
        const team1Name = match.Player;
        const team2Name = match[`Week_${currentWeek}`]; // Dynamically get opponent for current week

        // Fetch metrics for Team 1
        const team1Metrics = getPlayerMetricsForYear(team1Name, currentYear, historicalMatchups, seasonalMetricsForBetting, metrics.weeklyGameScoresByYearAndWeek, safeGetMappedTeamName);
        // Fetch metrics for Team 2
        const team2Metrics = getPlayerMetricsForYear(team2Name, currentYear, historicalMatchups, seasonalMetricsForBetting, metrics.weeklyGameScoresByYearAndWeek, safeGetMappedTeamName);

        // Calculate moneyline odds and over/under for each matchup
        const team1WinPercentageProjection = calculateWeeklyWinPercentageProjection(team1Metrics.averageDifferenceVsOpponent, team1Metrics.errorFunctionCoefficient);
        const team2WinPercentageProjection = calculateWeeklyWinPercentageProjection(team2Metrics.averageDifferenceVsOpponent, team2Metrics.errorFunctionCoefficient);

        const moneylineOdds = calculateMoneylineOdds(team1WinPercentageProjection, team2WinPercentageProjection);
        const overUnder = calculateOverUnder(team1Metrics.projectedScore, team2Metrics.projectedScore);

        // Return the processed matchup data
        return {
            ...match, // Keep original matchup data
            team1Metrics,
            team2Metrics,
            moneylineOdds,
            overUnder
        };
    });
  }, [weeklyScheduleData, historicalMatchups, getMappedTeamName]); // Add historicalMatchups to dependencies

  if (loading) {
    return <div className="text-center py-4">Loading weekly schedule...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Weekly Matchups & Projections</h1>
      <div className="space-y-8">
        {processedWeeklyMatchups.length > 0 ? (
          // Group matchups by week if necessary, or just display them
          // Assuming all matchups in weeklyScheduleData are for the current week for simplicity based on your example
          // You might want to group them by week if weeklyScheduleData contains multiple weeks
          [weeklyScheduleData[0]?.Week_Number].map(weekNum => ( // Assuming all fetched data is for one week
            <div key={weekNum} className="bg-white shadow-lg rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Week {weekNum} Matchups</h2>
              <ul className="space-y-4">
                {processedWeeklyMatchups.map((match, index) => (
                  <li key={index} className="flex flex-col sm:flex-row items-center bg-gray-50 rounded-lg shadow-sm overflow-hidden">
                    {/* Team 1 */}
                    <div className="flex-1 p-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 w-full sm:w-auto">
                      <span className="text-lg font-bold text-blue-800">{match.team1Name}</span>
                      <span className="text-sm text-gray-600">DPR: {match.team1Metrics?.currentDPR?.toFixed(2) || 'N/A'}</span>
                      <span className="text-sm text-gray-600">Proj. Score: {match.team1Metrics?.projectedScore?.toFixed(2) || 'N/A'}</span>
                    </div>

                    {/* Vs. */}
                    <div className="p-2 text-center text-gray-500 font-semibold">VS</div>

                    {/* Team 2 */}
                    <div className="flex-1 p-4 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-gray-200 w-full sm:w-auto">
                      <span className="text-lg font-bold text-green-800">{match.team2Name}</span>
                      <span className="text-sm text-gray-600">DPR: {match.team2Metrics?.currentDPR?.toFixed(2) || 'N/A'}</span>
                      <span className="text-sm text-gray-600">Proj. Score: {match.team2Metrics?.projectedScore?.toFixed(2) || 'N/A'}</span>
                    </div>

                    {/* Betting Odds */}
                    <div className="w-full sm:w-auto p-4 bg-gray-100 flex flex-col sm:flex-row justify-around items-center border-t sm:border-t-0 sm:border-l border-gray-200">
                      {/* Moneyline */}
                      <div className="flex flex-col items-center justify-center p-3 sm:p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors duration-200 mb-2 sm:mb-0 sm:mr-2">
                        <span className="text-sm font-medium text-gray-600">Moneyline</span>
                        <span className="text-xl font-bold text-purple-700">{match.moneylineOdds?.team1Formatted || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 sm:p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors duration-200 mb-2 sm:mb-0 sm:mr-2">
                        <span className="text-sm font-medium text-gray-600">Moneyline</span>
                        <span className="text-xl font-bold text-purple-700">{match.moneylineOdds?.team2Formatted || 'N/A'}</span>
                      </div>

                      {/* Over/Under */}
                      <div className="flex-1 flex w-full sm:w-auto">
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
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-gray-600 italic text-center py-4">No matchups for this week.</p>
        )}
      </div>
    </div>
  );
};

export default WeeklyMatchupsDisplay;
