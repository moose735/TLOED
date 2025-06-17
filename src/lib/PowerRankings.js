// PowerRankings.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to format DPR value (now to three decimal places)
const formatDPR = (dpr) => {
  if (typeof dpr !== 'number' || isNaN(dpr)) return 'N/A';
  return dpr.toFixed(3); // Format to three decimal decimals
};

// Helper function to render record (W-L, without ties)
const renderRecordNoTies = (wins, losses) => {
  return `${wins || 0}-${losses || 0}`;
};

// Helper function to format points
const formatPoints = (points) => {
  if (typeof points !== 'number' || isNaN(points)) return 'N/A';
  return points.toFixed(2); // Format to two decimals
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
  '#d0ed57', // Lime Green
  '#a4de6c', // Light Green
  '#8dd1e1', // Light Blue
  '#f58231', // Orange
  '#6742a0', // Dark Purple
  '#e74c3c', // Red
  '#2ecc71', // Emerald Green
  '#3498db', // Bright Blue
  '#9b59b6', // Amethyst
  '#f1c40f', // Sunflower Yellow
  '#e67e22', // Carrot Orange
  '#1abc9c', // Turquoise
];

// Custom Tooltip for DPR Rank Chart
const CustomDPRRankTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Label is the week number
    const week = label;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-sm">
        <p className="font-bold text-gray-800 mb-1">Week {week}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} className={`text-${entry.stroke}`}>
            {entry.name}: Rank {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
  const [currentSeasonDPR, setCurrentSeasonDPR] = useState([]);
  const [dprHistoryChartData, setDPRHistoryChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setCurrentSeasonDPR([]);
      setDPRHistoryChartData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { seasonalMetrics, teamsByYear } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // Get the latest season
    const years = Object.keys(seasonalMetrics).map(Number).sort((a, b) => b - a);
    const latestSeasonYear = years[0];

    // Filter and sort current season DPR data
    if (latestSeasonYear && seasonalMetrics[latestSeasonYear]) {
      const seasonDPRs = Object.keys(seasonalMetrics[latestSeasonYear])
        .map(team => ({
          team: team,
          dpr: seasonalMetrics[latestSeasonYear][team].adjustedDPR,
          wins: seasonalMetrics[latestSeasonYear][team].wins,
          losses: seasonalMetrics[latestSeasonYear][team].losses,
          ties: seasonalMetrics[latestSeasonYear][team].ties,
          pointsFor: seasonalMetrics[latestSeasonYear][team].pointsFor,
          pointsAgainst: seasonalMetrics[latestSeasonYear][team].pointsAgainst,
          luckRating: seasonalMetrics[latestSeasonYear][team].luckRating,
          // Include other stats for display if desired
        }))
        .sort((a, b) => b.dpr - a.dpr); // Sort by DPR descending
      setCurrentSeasonDPR(seasonDPRs);

      // Prepare data for DPR Rank History Chart for the latest season
      const teamWeeklyDPRRankings = {}; // { teamName: { week: rank } }

      // Get all unique weeks for the latest season
      const latestSeasonMatches = historicalMatchups.filter(match => parseInt(match.year) === latestSeasonYear);
      const uniqueWeeks = [...new Set(latestSeasonMatches.map(match => parseInt(match.week)))].sort((a, b) => a - b);

      uniqueWeeks.forEach(week => {
        // Aggregate data up to the current week
        const matchupsUpToWeek = latestSeasonMatches.filter(match => parseInt(match.week) <= week);

        // Recalculate seasonal metrics for the subset of data up to this week
        const { seasonalMetrics: weeklySeasonalMetrics } = calculateAllLeagueMetrics(matchupsUpToWeek, getDisplayTeamName);

        if (weeklySeasonalMetrics[latestSeasonYear]) {
          const weeklyDPRs = Object.keys(weeklySeasonalMetrics[latestSeasonYear])
            .map(team => ({
              team: team,
              dpr: weeklySeasonalMetrics[latestSeasonYear][team].adjustedDPR,
            }))
            .sort((a, b) => b.dpr - a.dpr); // Sort to get ranks

          weeklyDPRs.forEach((teamData, index) => {
            const rank = index + 1; // 1-based rank
            if (!teamWeeklyDPRRankings[teamData.team]) {
              teamWeeklyDPRRankings[teamData.team] = {};
            }
            teamWeeklyDPRRankings[teamData.team][week] = rank;
          });
        }
      });

      // Transform teamWeeklyDPRRankings into the format Recharts expects:
      // [{ week: 1, TeamA: 3, TeamB: 1, ... }, { week: 2, ... }]
      const chartData = uniqueWeeks.map(week => {
        const weekEntry = { week: `Wk ${week}` };
        Object.keys(teamWeeklyDPRRankings).forEach(team => {
          weekEntry[team] = teamWeeklyDPRRankings[team][week] || null; // Null for no data yet in that week
        });
        return weekEntry;
      });
      setDPRHistoryChartData(chartData);

    } else {
      setCurrentSeasonDPR([]);
      setDPRHistoryChartData([]);
    }

    setLoading(false);
  }, [historicalMatchups, getDisplayTeamName]);

  const chartTeams = dprHistoryChartData.length > 0 ?
    Object.keys(dprHistoryChartData[0]).filter(key => key !== 'week') : [];

  return (
    <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">Current Season Power Rankings</h2>

      {loading ? (
        <p className="text-center text-gray-600">Loading power rankings...</p>
      ) : currentSeasonDPR.length > 0 ? (
        <>
          <section className="mb-8 overflow-x-auto"> {/* Added overflow-x-auto here */}
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Standings by DPR</h3>
            <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Rank</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Team</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">DPR</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Record (W-L-T)</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Points For</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider">Luck Rating</th>
                </tr>
              </thead>
              <tbody>
                {currentSeasonDPR.map((data, index) => (
                  <tr key={data.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-3 text-sm text-gray-800">{index + 1}</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(data.dpr)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{renderRecordNoTies(data.wins, data.losses)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatPoints(data.pointsFor)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.luckRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* DPR Rank History Chart */}
          {dprHistoryChartData.length > 0 && (
            <section className="mb-8 bg-blue-50 p-6 rounded-lg shadow-inner overflow-x-auto"> {/* Added overflow-x-auto here */}
              <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">DPR Rank History (Current Season)</h3>
              <ResponsiveContainer width="100%" height={400} minWidth={700}> {/* Set a minWidth for the chart */}
                <LineChart
                  data={dprHistoryChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" stroke="#555" />
                  <YAxis
                    stroke="#555"
                    domain={[1, chartTeams.length]} // Ensure y-axis covers all ranks
                    tickFormatter={(tick) => `Rank ${tick}`}
                    reversed={true} // Reverse the axis to put 1 at top
                    interval={0} // Force all labels to show
                  />
                  <Tooltip content={<CustomDPRRankTooltip />} />
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
                This graph shows each team's rank based on their Dominance Power Ranking (DPR), calculated cumulatively based on all games played up to each specific week of the newest season. Rank 1 indicates the highest DPR.
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
