// PowerRankings.js
import React, { useState, useEffect } from 'react';
// Import the utility for calculating league metrics (DPR) and its helper calculateRawDPR
import { calculateAllLeagueMetrics, calculateRawDPR } from '../utils/calculations';
// Recharts for charting
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

// Custom Tooltip Component for sorting by DPR
const CustomDPRRankTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Each entry in payload now has a 'dprValue' property for sorting
    const sortedPayload = [...payload].sort((a, b) => b.payload.dprValues[a.name] - b.payload.dprValues[b.name]);

    return (
      <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
        <p className="font-bold text-gray-800 mb-2">Week: {label}</p>
        {sortedPayload.map((entry, index) => (
          // Display Rank and the actual DPR value for context
          <p key={`item-${index}`} style={{ color: entry.color }}>
            {entry.name}: Rank {entry.value} ({entry.payload.dprValues[entry.name].toFixed(3)} DPR)
          </p>
        ))}
      </div>
    );
  }

  return null;
};


const PowerRankings = ({ historicalMatchups, getDisplayTeamName }) => {
  const [powerRankings, setPowerRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState([]); // State for chart data (weekly DPR)
  const [chartTeams, setChartTeams] = useState([]); // State for teams represented in the chart
  const [maxTeamsInChart, setMaxTeamsInChart] = useState(1); // To set Y-axis domain dynamically


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
      // This uses the calculateAllLeagueMetrics from utils/calculations.js
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
          pointsAgainst: yearData[teamName].pointsAgainst || 0, // This is expected from seasonalMetrics
          luckRating: yearData[teamName].luckRating || 0, // This is expected from seasonalMetrics
          year: newestYear,
        }))
        .sort((a, b) => b.dpr - a.dpr); // Sort by DPR in descending order

      setPowerRankings(calculatedRankings.map((team, index) => ({ rank: index + 1, ...team })));


      // --- Chart Data Preparation (Weekly Cumulative Adjusted DPR and Rank) ---
      const newestYearMatchups = historicalMatchups.filter(match => parseInt(match.year) === newestYear);
      const uniqueTeamsInNewestYear = Array.from(new Set(
        newestYearMatchups.flatMap(match => [getDisplayTeamName(match.team1), getDisplayTeamName(match.team2)])
      )).filter(teamName => teamName && teamName.trim() !== '');

      const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week)), 0);

      const weeklyDPRsChartData = [];

      // Initialize cumulative stats for each team and for the league outside the loop
      const cumulativeTeamStats = {}; // { teamName: { totalPF: 0, wins: 0, losses: 0, ties: 0, gamesPlayed: 0, scores: [] } }
      uniqueTeamsInNewestYear.forEach(team => {
        cumulativeTeamStats[team] = { totalPF: 0, wins: 0, losses: 0, ties: 0, gamesPlayed: 0, scores: [] };
      });

      let cumulativeLeagueScores = []; // All individual scores in the league up to current week

      for (let week = 1; week <= maxWeek; week++) {
        const weeklyEntry = { week: week, dprValues: {} }; // Add dprValues for tooltip sorting
        const matchesInCurrentWeek = newestYearMatchups.filter(match => parseInt(match.week) === week);

        // Accumulate stats based on matches in the current week
        matchesInCurrentWeek.forEach(match => {
          const team1 = getDisplayTeamName(match.team1);
          const team2 = getDisplayTeamName(match.team2);
          const team1Score = parseFloat(match.team1Score);
          const team2Score = parseFloat(match.team2Score);

          if (!isNaN(team1Score) && !isNaN(team2Score)) {
            const isTie = team1Score === team2Score;
            const team1Won = team1Score > team2Score;

            // Update team 1 cumulative stats
            if (cumulativeTeamStats[team1]) {
              cumulativeTeamStats[team1].totalPF += team1Score;
              cumulativeTeamStats[team1].gamesPlayed += 1;
              cumulativeTeamStats[team1].scores.push(team1Score);
              if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                if (isTie) cumulativeTeamStats[team1].ties += 1;
                else if (team1Won) cumulativeTeamStats[team1].wins += 1;
                else cumulativeTeamStats[team1].losses += 1;
              }
            }
            // Update team 2 cumulative stats
            if (cumulativeTeamStats[team2]) {
              cumulativeTeamStats[team2].totalPF += team2Score;
              cumulativeTeamStats[team2].gamesPlayed += 1;
              cumulativeTeamStats[team2].scores.push(team2Score);
              if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                if (isTie) cumulativeTeamStats[team2].ties += 1;
                else if (!team1Won) cumulativeTeamStats[team2].wins += 1;
                else cumulativeTeamStats[team2].losses += 1;
              }
            }
            
            // Update cumulative league scores
            cumulativeLeagueScores.push(team1Score, team2Score);
          }
        });

        // Calculate League Max/Min Score for the cumulative period up to this week
        const leagueMaxScore_Cumulative = cumulativeLeagueScores.length > 0 ? Math.max(...cumulativeLeagueScores) : 0;
        const leagueMinScore_Cumulative = cumulativeLeagueScores.length > 0 ? Math.min(...cumulativeLeagueScores) : 0;

        let totalRawDPRForWeek = 0;
        let teamsCountForWeeklyDPR = 0;
        const currentWeekTeamDPRs = []; // To store { team, dpr } for ranking this week

        uniqueTeamsInNewestYear.forEach(team => {
          const teamStats = cumulativeTeamStats[team];
          if (teamStats && teamStats.gamesPlayed > 0) {
            const teamWinPercentage = (teamStats.wins + 0.5 * teamStats.ties) / teamStats.gamesPlayed;
            
            // Use the calculateRawDPR function from calculations.js
            const rawDPR = calculateRawDPR(
              teamStats.totalPF,
              teamWinPercentage,
              leagueMaxScore_Cumulative,
              leagueMinScore_Cumulative
            );
            
            if (!isNaN(rawDPR)) {
              totalRawDPRForWeek += rawDPR;
              teamsCountForWeeklyDPR++;
            }
            currentWeekTeamDPRs.push({ team, dpr: rawDPR }); // Store raw DPR for ranking
          } else {
            currentWeekTeamDPRs.push({ team, dpr: 0 }); // Team hasn't played or no valid scores yet
          }
        });

        const avgRawDPRForWeek = teamsCountForWeeklyDPR > 0 ? totalRawDPRForWeek / teamsCountForWeeklyDPR : 0;

        // Calculate adjusted DPR and assign ranks for this week
        const rankedTeamsForWeek = currentWeekTeamDPRs
          .map(teamDPR => {
            let adjustedDPR = 0;
            if (avgRawDPRForWeek > 0) {
              adjustedDPR = teamDPR.dpr / avgRawDPRForWeek;
            }
            return { team: teamDPR.team, dpr: adjustedDPR };
          })
          .sort((a, b) => b.dpr - a.dpr); // Sort by adjusted DPR descending for ranking

        rankedTeamsForWeek.forEach((rankedTeam, index) => {
          weeklyEntry[rankedTeam.team] = index + 1; // Store rank (1-based)
          weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr; // Store actual DPR for tooltip
        });
        
        weeklyDPRsChartData.push(weeklyEntry);
      }

      setWeeklyChartData(weeklyDPRsChartData);
      
      // Chart teams should include only teams that have recorded a non-zero DPR (and thus a rank) at any point in the season
      const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
        weeklyDPRsChartData.some(weekData => weekData[team] !== 0) // Check for non-zero rank
      );
      setChartTeams(activeChartTeams);
      // Ensure maxTeamsInChart reflects the actual number of participating teams for the Y-axis domain
      setMaxTeamsInChart(activeChartTeams.length > 0 ? activeChartTeams.length : 1);


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

          {/* Line Graph for Weekly DPR Rank */}
          {weeklyChartData.length > 0 && (
            <section className="mt-8">
              <h3 className="text-xl font-bold text-blue-700 mb-4 text-center">
                DPR Rank by Week - {powerRankings[0].year} Season
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={weeklyChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: 0 }} />
                  <YAxis
                    label={{ value: "Rank", angle: -90, position: "insideLeft" }}
                    domain={[1, maxTeamsInChart]} // Set domain from 1 (top) to max (bottom)
                    ticks={Array.from({ length: maxTeamsInChart }, (_, i) => i + 1)} // Show ticks for each rank
                    allowDecimals={false} // Ranks are integers
                    reversed={true} // Explicitly reverse the axis to put 1 at top
                    interval={0} // Force all labels to show
                  />
                  <Tooltip content={<CustomDPRRankTooltip />} /> {/* Using custom tooltip */}
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
