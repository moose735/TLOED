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
  const [weeklyChartData, setWeeklyChartData] = useState([]); // State for chart data (weekly DPR)
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

      // Calculate all league metrics for the table display (seasonal DPR, etc.)
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


      // --- Chart Data Preparation (Weekly Non-Cumulative Adjusted DPR) ---
      const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
      const uniqueTeamsInNewestYear = Array.from(new Set(
        newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)])
      )).filter(teamName => teamName && teamName.trim() !== '');

      const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);

      const weeklyDPRsChartData = [];

      for (let week = 1; week <= maxWeek; week++) {
        const weeklyEntry = { week: week };
        const matchesInCurrentWeek = newestYearMatchups.filter(match => parseInt(match.week) === week);

        const teamWeeklyStats = {}; // { teamName: { totalPF: 0, totalPA: 0, gamesPlayed: 0 } }
        let leagueTotalPF_Weekly = 0;
        let leagueTotalPA_Weekly = 0; // Same as PF for league total
        let leagueTotalGamesPlayed_Weekly = 0;

        uniqueTeamsInNewestYear.forEach(team => {
          teamWeeklyStats[team] = { totalPF: 0, totalPA: 0, gamesPlayed: 0 };
        });

        matchesInCurrentWeek.forEach(match => {
          const team1 = getDisplayTeamName(match.team1);
          const team2 = getDisplayTeamName(match.team2);
          const team1Score = parseFloat(match.team1Score);
          const team2Score = parseFloat(match.team2Score);

          if (!isNaN(team1Score) && !isNaN(team2Score)) {
            // Update team 1 weekly stats
            if (teamWeeklyStats[team1]) {
              teamWeeklyStats[team1].totalPF += team1Score;
              teamWeeklyStats[team1].totalPA += team2Score;
              teamWeeklyStats[team1].gamesPlayed += 1;
            }
            // Update team 2 weekly stats
            if (teamWeeklyStats[team2]) {
              teamWeeklyStats[team2].totalPF += team2Score;
              teamWeeklyStats[team2].totalPA += team1Score;
              teamWeeklyStats[team2].gamesPlayed += 1;
            }

            // Update league weekly totals
            leagueTotalPF_Weekly += team1Score + team2Score;
            leagueTotalPA_Weekly += team1Score + team2Score;
            leagueTotalGamesPlayed_Weekly += 2; // Each match involves two teams/games
          }
        });

        const leagueAvgPF_Weekly = leagueTotalGamesPlayed_Weekly > 0 ? leagueTotalPF_Weekly / leagueTotalGamesPlayed_Weekly : 0;
        const leagueAvgPA_Weekly = leagueTotalGamesPlayed_Weekly > 0 ? leagueTotalPA_Weekly / leagueTotalGamesPlayed_Weekly : 0;

        uniqueTeamsInNewestYear.forEach(team => {
          const teamStats = teamWeeklyStats[team];
          if (teamStats && teamStats.gamesPlayed > 0) {
            const teamAvgPF_Weekly = teamStats.totalPF / teamStats.gamesPlayed;
            const teamAvgPA_Weekly = teamStats.totalPA / teamStats.gamesPlayed;

            let dpr = 0;
            // The DPR formula from DPRAnalysis.js, applied to weekly averages
            if (leagueAvgPF_Weekly > 0 && leagueAvgPA_Weekly > 0) {
              dpr = (teamAvgPF_Weekly / leagueAvgPF_Weekly) - (teamAvgPA_Weekly / leagueAvgPA_Weekly);
            } else if (leagueAvgPF_Weekly > 0) {
              dpr = (teamAvgPF_Weekly / leagueAvgPF_Weekly);
            } else if (leagueAvgPA_Weekly > 0) {
              dpr = -(teamAvgPA_Weekly / leagueAvgPA_Weekly);
            }

            weeklyEntry[team] = parseFloat(dpr.toFixed(3));
          } else {
            // If team hasn't played in this specific week, or no valid scores, DPR is 0 for this week.
            // This is crucial for non-cumulative display.
            weeklyEntry[team] = 0; 
          }
        });
        weeklyDPRsChartData.push(weeklyEntry);
      }

      setWeeklyChartData(weeklyDPRsChartData);
      
      // Chart teams should include only teams that have recorded a non-zero DPR at any point in the season
      // to avoid drawing lines for teams that never played or only had 0 DPRs.
      const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
        weeklyDPRsChartData.some(weekData => weekData[team] !== 0)
      );
      setChartTeams(activeChartTeams);

      setLoading(false);

    } catch (err) {
      console.error("Error calculating power rankings or chart data:", err);
      setError(`Failed to calculate power rankings or chart data: ${err.message}. Ensure historical data is complete and accurate.`);
      setLoading(false);
    }
  }, [historicalMatchups, getDisplayTeamName]);

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
          <div className="overflow-x-auto mb-8">
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

          {/* Line DPR for Weekly DPR */}
          {weeklyChartData.length > 0 && (
            <section className="mt-8">
              <h3 className="text-xl font-bold text-blue-700 mb-4 text-center">
                DPR by Week - {powerRankings[0].year} Season
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={weeklyChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: 0 }} />
                  <YAxis label={{ value: "DPR", angle: -90, position: "insideLeft" }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(value) => `${value.toFixed(3)} DPR`} />
                  <Legend />
                  {chartTeams.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-4 text-sm text-gray-500 text-center">
                This graph shows each team's Dominance Power Ranking (DPR) calculated based *only* on games played in that specific week of the newest season.
                Note: Early season weekly DPRs can be highly volatile due to a small sample size.
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
