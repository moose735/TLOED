// PowerRankings.js
import React, { useState, useEffect } from 'react';
// Import the utility for calculating league metrics (DPR)
import { calculateAllLeagueMetrics } from '../utils/calculations';
// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// Helper function to format DPR value (now to three decimal places)
const formatDPR = (dpr) => {
  if (typeof dpr !== 'number' || isNaN(dpr)) return 'N/A';
  return dpr.toFixed(3); // Format to three decimal places
};

// Helper function to render record (W-L, without ties)
const renderRecordNoTies = (wins, losses) => {
  return `${wins || 0}-${losses || 0}`;
};

// Helper function to format points
const formatPoints = (points) => {
  if (typeof points !== 'number' || isNaN(points)) return 'N/A';
  return points.toFixed(2); // Format to two decimal places
};

// Helper function to format luck rating
const formatLuckRating = (luck) => {
  if (typeof luck !== 'number' || isNaN(luck)) return 'N/A';
  // Luck rating can be positive or negative, display with sign and two decimals
  return luck.toFixed(2);
};

// Color palette for chart lines - a diverse set for multiple teams
const CHART_COLORS = [
  '#8884d8', // Violet
  '#82ca9d', // Green
  '#ffc658', // Yellow
  '#ff7300', // Orange
  '#00c49f', // Teal
  '#ff0000', // Red
  '#0088fe', // Blue
  '#bb3f85', // Pink
  '#7a421a', // Brown
  '#4a4a4a', // Dark Gray
  '#a5d6a7', // Light Green
  '#ef9a9a'  // Light Red
];


const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
  const [powerRankings, setPowerRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState([]); // State for chart data (cumulative points)
  const [chartTeams, setChartTeams] = useState([]); // State for teams represented in the chart


  useEffect(() => {
    // If no historical matchups, clear data and stop loading
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setPowerRankings([]);
      setWeeklyChartData([]);
      setChartTeams([]);
      setLoading(false);
      setError("No historical matchup data available to calculate power rankings or chart data.");
      return;
    }

    setLoading(true); // Indicate loading state
    setError(null);   // Clear any previous errors

    try {
      // Find the newest year from the historical matchups
      const allYears = historicalMatchups
        .map(match => parseInt(match.year))
        .filter(year => !isNaN(year));
      const newestYear = allYears.length > 0 ? Math.max(...allYears) : null;

      if (!newestYear) {
        setError("No valid years found in historical data to determine the current season for power rankings.");
        setLoading(false);
        return;
      }

      // Calculate all league metrics for the table display
      const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

      // Check if data for the newest year exists for the table
      if (!seasonalMetrics[newestYear]) {
        setError(`No seasonal data available for the newest year (${newestYear}) to calculate power rankings table.`);
        setLoading(false);
        return;
      }

      // Extract teams' DPRs and other stats for the newest year and sort them for the table
      const yearData = seasonalMetrics[newestYear];
      const calculatedRankings = Object.keys(yearData)
        .map(teamName => ({
          team: teamName,
          dpr: yearData[teamName].adjustedDPR || 0,
          wins: yearData[teamName].wins || 0,
          losses: yearData[teamName].losses || 0,
          ties: yearData[teamName].ties || 0,
          pointsFor: yearData[teamName].pointsFor || 0,
          pointsAgainst: yearData[teamName].pointsAgainst || 0,
          luckRating: yearData[teamName].luckRating || 0,
          year: newestYear,
        }))
        .sort((a, b) => b.dpr - a.dpr); // Sort by DPR in descending order

      setPowerRankings(calculatedRankings.map((team, index) => ({ rank: index + 1, ...team })));


      // --- Chart Data Preparation (Cumulative Points For by Week) ---
      const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
      const uniqueTeamsInNewestYear = Array.from(new Set(newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)]))).sort();

      const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);
      const cumulativePoints = {};
      uniqueTeamsInNewestYear.forEach(team => { cumulativePoints[team] = 0; }); // Initialize all teams to 0 points

      const chartData = [];
      for (let week = 1; week <= maxWeek; week++) {
        const weekEntry = { week: week };
        const matchesInWeek = newestYearMatchups.filter(match => parseInt(match.week) === week);

        matchesInWeek.forEach(match => {
          const team1 = getDisplayTeamName(match.team1);
          const team2 = getDisplayTeamName(match.team2);
          const team1Score = parseFloat(match.team1Score);
          const team2Score = parseFloat(match.team2Score);

          // Only add score if valid number
          if (!isNaN(team1Score)) cumulativePoints[team1] = (cumulativePoints[team1] || 0) + team1Score;
          if (!isNaN(team2Score)) cumulativePoints[team2] = (cumulativePoints[team2] || 0) + team2Score;
        });

        // Add current cumulative points for all teams to this week's entry
        uniqueTeamsInNewestYear.forEach(team => {
          weekEntry[team] = parseFloat(cumulativePoints[team].toFixed(2)); // Store as a number with 2 decimals
        });
        chartData.push(weekEntry);
      }

      setWeeklyChartData(chartData);
      setChartTeams(uniqueTeamsInNewestYear); // Set teams for lines in the chart
      setLoading(false);

    } catch (err) {
      console.error("Error calculating power rankings or chart data:", err);
      setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate and 'calculations.js' provides necessary metrics.`);
      setLoading(false);
    }
  }, [historicalMatchups, getDisplayTeamName]); // Recalculate when historicalMatchups or team naming changes

  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">
        {powerRankings.length > 0 ? `Power Rankings (DPR) - ${powerRankings[0].year} Season` : 'Current Power Rankings'}
      </h2>
      {loading ? (
        <p className="text-center text-gray-600">Calculating power rankings...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : powerRankings.length > 0 ? (
        <>
          <div className="overflow-x-auto mb-8"> {/* Added mb-8 for spacing */}
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L)</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck Score</th>
                </tr>
              </thead>
              <tbody>
                {powerRankings.map((row, rowIndex) => (
                  <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.team}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatDPR(row.dpr)}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderRecordNoTies(row.wins, row.losses)}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsFor)}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsAgainst)}</td>
                    <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatLuckRating(row.luckRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line Graph for Cumulative Points For by Week */}
          {weeklyChartData.length > 0 && (
            <section className="mt-8"> {/* Added mt-8 for spacing from the table */}
              <h3 className="text-xl font-bold text-blue-700 mb-4 text-center">
                Cumulative Points For by Week - {powerRankings[0].year} Season
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={weeklyChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: 0 }} />
                  <YAxis label={{ value: "Cumulative Points", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)} pts`} />
                  <Legend />
                  {chartTeams.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]} // Cycle through colors
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-4 text-sm text-gray-500 text-center">
                This graph shows each team's cumulative points scored throughout the newest season.
                A true "DPR by Week" graph would require specific weekly DPR calculations from `calculations.js`.
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="text-center text-gray-600">No power rankings data found for the current season.</p>
      )}
      <p className="mt-4 text-sm text-gray-500 text-center">
        Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available.
      </p>
    </div>
  );
};

export default PowerRankings;
