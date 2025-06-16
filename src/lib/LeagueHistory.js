// src/lib/LeagueHistory.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // For career DPR
// Recharts for charting
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

// Helper to get the descriptive name of a final seeding game (e.g., "Championship Game")
const getFinalSeedingGamePurpose = (value) => {
  if (value === 1) return 'Championship Game';
  if (value === 3) return '3rd Place Game';
  if (value === 5) return '5th Place Game';
  if (value === 7) return '7th Place Game';
  if (value === 9) return '9th Place Game';
  if (value === 11) return '11th Place Game';
  if (typeof value === 'number' && value > 0 && value % 2 !== 0) {
      return `${value}${getOrdinalSuffix(value)} Place Game`;
  }
  return 'Final Seeding Game';
};

const LeagueHistory = ({ historicalMatchups, loading, error, getDisplayTeamName }) => {
  const [allTimeStandings, setAllTimeStandings] = useState([]);
  const [seasonalDPRChartData, setSeasonalDPRChartData] = useState([]);
  const [uniqueTeamsForChart, setUniqueTeamsForChart] = useState([]);
  const [seasonAwardsSummary, setSeasonAwardsSummary] = useState({});
  const [sortedYearsForAwards, setSortedYearsForAwards] = useState([]); // New state for sorted years

  // A color palette for the teams in the chart
  const teamColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#f5222d', '#fa8c16', '#a0d911', '#52c41a', '#1890ff',
    '#2f54eb', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#eb2f96', '#fadb14', '#52c41a'
  ];

  useEffect(() => {
    if (loading || error || !historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeStandings([]);
      setSeasonalDPRChartData([]);
      setUniqueTeamsForChart([]);
      setSeasonAwardsSummary({});
      setSortedYearsForAwards([]); // Reset new state
      return;
    }

    // Identify completed seasons (those with a championship game: finalSeedingGame = 1)
    const completedSeasons = new Set();
    historicalMatchups.forEach(match => {
        // Check for both number 1 and string '1' for finalSeedingGame
        if (match.finalSeedingGame === 1 || match.finalSeedingGame === '1') {
            const year = parseInt(match.year);
            if (!isNaN(year)) {
                completedSeasons.add(year);
            }
        }
    });

    const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    const teamOverallStats = {};
    const yearlyPointsLeaders = {};

    // First pass: Aggregate basic stats and identify yearly points leaders
    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || team1 === '' || !team2 || team2 === '' || isNaN(year) || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid or incomplete data
      }

      // Initialize team stats if not already present
      [team1, team2].forEach(team => {
        if (!teamOverallStats[team]) {
          teamOverallStats[team] = {
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            totalPointsFor: 0,
            seasonsPlayed: new Set(),
            awards: {
              championships: 0,
              runnerUps: 0,
              thirdPlace: 0,
              firstPoints: 0,
              secondPoints: 0,
              thirdPoints: 0,
            }
          };
        }
        // Only count season if it's a completed season. This makes 'Seasons' stat accurate for 'completed seasons'
        if (completedSeasons.has(year)) {
            teamOverallStats[team].seasonsPlayed.add(year);
        }
      });

      // Aggregate overall wins, losses, ties, and points (ONLY if not a PointsOnlyBye game)
      // And ONLY if the season is considered completed for record purposes
      if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (isTie) {
          teamOverallStats[team1].totalTies++;
          teamOverallStats[team2].totalTies++;
        } else if (team1Won) {
          teamOverallStats[team1].totalWins++;
          teamOverallStats[team2].totalLosses++;
        } else { // team2Won
          teamOverallStats[team2].totalWins++;
          teamOverallStats[team1].totalLosses++;
        }
      }

      // Points For is accumulated regardless of PointsOnlyBye
      teamOverallStats[team1].totalPointsFor += team1Score;
      teamOverallStats[team2].totalPointsFor += team2Score;
    });

    // Populate yearlyPointsLeaders using seasonalMetrics (which has totalPointsFor per team per year)
    Object.keys(seasonalMetrics).forEach(year => {
        // Only consider completed seasons for points awards
        if (!completedSeasons.has(parseInt(year))) {
            return;
        }

        const teamsInSeason = Object.keys(seasonalMetrics[year]);
        const yearPointsData = teamsInSeason.map(team => ({
            team,
            points: seasonalMetrics[year][team].pointsFor
        })).sort((a, b) => b.points - a.points); // Sort descending by points

        yearlyPointsLeaders[year] = yearPointsData;
    });

    // Process championship games and final seeding for overall finish awards (Trophies) for All-Time Awards table
    historicalMatchups.forEach(match => {
      const year = parseInt(match.year);
      // Only process final seeding games that are part of a completed season
      if (!(typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0 && completedSeasons.has(year))) {
          return;
      }

      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || team1 === '' || !team2 || team2 === '' || isNaN(team1Score) || isNaN(team2Score)) {
          return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      let winner = 'Tie';
      let loser = 'Tie';

      if (team1Won) {
          winner = team1;
          loser = team2;
      } else if (team2Score > team1Score) {
          winner = team2;
          loser = team1;
      }

      // Directly assign trophies based on finalSeedingGame value
      if (winner !== 'Tie') { // Only assign if there's a clear winner
          if (match.finalSeedingGame === 1) { // 1st Place Game
              if (teamOverallStats[winner]) {
                  teamOverallStats[winner].awards.championships++;
              }
              if (loser && teamOverallStats[loser]) { // Loser of 1st place game gets 2nd (Silver Trophy)
                  teamOverallStats[loser].awards.runnerUps++;
              }
          } else if (match.finalSeedingGame === 3) { // 3rd Place Game
              if (teamOverallStats[winner]) {
                  teamOverallStats[winner].awards.thirdPlace++;
              }
          }
      } else if (match.finalSeedingGame === 1) { // Special case: Tie in Championship Game
          // If championship game is a tie, both get a championship (Gold Trophy)
          if (teamOverallStats[team1]) {
            teamOverallStats[team1].awards.championships++;
          }
          if (teamOverallStats[team2]) {
            teamOverallStats[team2].awards.championships++;
          }
      }
    });

    // Medal Calculation Pass (based on yearlyPointsLeaders) for All-Time Awards table
    Object.keys(teamOverallStats).forEach(teamName => {
      Object.keys(yearlyPointsLeaders).forEach(year => {
          // Ensure this year is a completed season
          if (!completedSeasons.has(parseInt(year))) return;

          const yearLeaders = yearlyPointsLeaders[year];
          // Filter out empty team names before processing leaders
          const filteredYearLeaders = yearLeaders.filter(entry => entry.team !== '');

          // Find the current team's points for this year
          const teamPointsEntry = filteredYearLeaders.find(entry => entry.team === teamName);
          if (!teamPointsEntry) return;

          const currentTeamYearlyScore = teamPointsEntry.points;

          // Determine the unique scores for 1st, 2nd, and 3rd place
          const uniqueSortedScores = Array.from(new Set(filteredYearLeaders.map(l => l.points))).sort((a, b) => b - a);
          const firstPlaceScore = uniqueSortedScores[0];
          const secondPlaceScore = uniqueSortedScores[1];
          const thirdPlaceScore = uniqueSortedScores[2];

          // Assign awards based on strict score comparison
          if (currentTeamYearlyScore === firstPlaceScore) {
              teamOverallStats[teamName].awards.firstPoints++;
          }
          // Only count as second place if score matches secondPlaceScore AND it's strictly less than firstPlaceScore
          if (secondPlaceScore !== undefined && currentTeamYearlyScore === secondPlaceScore && currentTeamYearlyScore < firstPlaceScore) {
              teamOverallStats[teamName].awards.secondPoints++;
          }
          // Only count as third place if score matches thirdPlaceScore AND it's strictly less than firstPlaceScore and secondPlaceScore
          if (thirdPlaceScore !== undefined && currentTeamYearlyScore === thirdPlaceScore && currentTeamYearlyScore < firstPlaceScore && currentTeamYearlyScore < secondPlaceScore) {
              teamOverallStats[teamName].awards.thirdPoints++;
          }
      });
    });


    // Final compilation for All-Time Standings display
    const compiledStandings = Object.keys(teamOverallStats).map(teamName => {
      const stats = teamOverallStats[teamName];
      // Only include teams that have actually participated in completed seasons
      if (stats.seasonsPlayed.size === 0) return null;

      const careerDPR = careerDPRData.find(dpr => dpr.team === teamName)?.dpr || 0;
      const totalGames = stats.totalWins + stats.totalLosses + stats.totalTies;
      const winPercentage = totalGames > 0 ? ((stats.totalWins + (0.5 * stats.totalTies)) / totalGames) : 0;

      // Determine the season display string
      const sortedYearsArray = Array.from(stats.seasonsPlayed).sort((a, b) => a - b);
      const minYear = sortedYearsArray.length > 0 ? sortedYearsArray[0] : '';
      const maxYear = sortedYearsArray.length > 0 ? sortedYearsArray[sortedYearsArray.length - 1] : '';
      const seasonsCount = stats.seasonsPlayed.size;

      let seasonsDisplay = '';
      if (seasonsCount > 0) {
          seasonsDisplay = `${minYear}-${maxYear} (${seasonsCount})`;
          if (minYear === maxYear) { // Handle single season case: "2023 (1)"
              seasonsDisplay = `${minYear} (${seasonsCount})`;
          }
      }

      return {
        team: teamName,
        seasons: seasonsDisplay,
        record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`,
        winPercentage: winPercentage,
        totalDPR: careerDPR,
        awards: stats.awards,
      };
    }).filter(Boolean).sort((a, b) => b.totalDPR - a.totalDPR); // Filter out nulls and sort by total DPR descending

    setAllTimeStandings(compiledStandings);


    // Prepare data for the total DPR progression line graph
    const chartData = [];
    const allYears = Array.from(new Set(historicalMatchups.map(m => parseInt(m.year)).filter(y => !isNaN(y)))).sort((a, b) => a - b);
    const uniqueTeams = Array.from(new Set(
      historicalMatchups.flatMap(m => [getDisplayTeamName(m.team1), getDisplayTeamName(m.team2)])
        .filter(name => name !== null && name !== '')
    )).sort();

    setUniqueTeamsForChart(uniqueTeams);

    // To store the cumulative DPR for each team as we progress through years
    const cumulativeTeamDPRs = {};

    allYears.forEach(currentYear => {
        const matchesUpToCurrentYear = historicalMatchups.filter(match => parseInt(match.year) <= currentYear);

        // Recalculate metrics for games up to currentYear to get cumulative career DPR.
        // This is a computationally intensive step, but ensures correct cumulative DPR.
        const { careerDPRData: cumulativeCareerDPRData } = calculateAllLeagueMetrics(matchesUpToCurrentYear, getDisplayTeamName);

        const yearDataPoint = { year: currentYear };
        uniqueTeams.forEach(team => {
            const teamDPR = cumulativeCareerDPRData.find(dpr => dpr.team === team)?.dpr;
            if (teamDPR !== undefined) {
                cumulativeTeamDPRs[team] = teamDPR;
            }
            yearDataPoint[team] = cumulativeTeamDPRs[team] || 0;
        });
        chartData.push(yearDataPoint);
    });
    setSeasonalDPRChartData(chartData);


    // --- New: Process Season-by-Season Champions & Awards ---
    const newSeasonAwardsSummary = {};

    completedSeasons.forEach(year => {
        newSeasonAwardsSummary[year] = {
            champion: 'N/A',
            secondPlace: 'N/A',
            thirdPlace: 'N/A',
            pointsChamp: 'N/A',
            pointsSecond: 'N/A',
            pointsThird: 'N/A',
        };

        // Find final seeding games for this year
        const yearFinalGames = historicalMatchups.filter(match =>
            parseInt(match.year) === year &&
            (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0)
        );

        yearFinalGames.forEach(game => {
            const team1 = getDisplayTeamName(String(game.team1 || '').trim());
            const team2 = getDisplayTeamName(String(game.team2 || '').trim());
            const team1Score = parseFloat(game.team1Score);
            const team2Score = parseFloat(game.team2Score);

            const isTie = team1Score === team2Score;
            const team1Won = team1Score > team2Score;

            let winner = '';
            let loser = '';
            if (!isTie) {
                winner = team1Won ? team1 : team2;
                loser = team1Won ? team2 : team1;
            }

            if (game.finalSeedingGame === 1) { // Championship Game
                if (isTie) {
                    newSeasonAwardsSummary[year].champion = `${team1} & ${team2} (Tie)`;
                    newSeasonAwardsSummary[year].secondPlace = 'N/A';
                } else {
                    newSeasonAwardsSummary[year].champion = winner;
                    newSeasonAwardsSummary[year].secondPlace = loser;
                }
            } else if (game.finalSeedingGame === 3) { // 3rd Place Game
                if (teamOverallStats[winner]) { // Ensure winner is defined
                  newSeasonAwardsSummary[year].thirdPlace = winner;
                }
            }
        });

        // Assign Points Champions for the year
        const leaders = yearlyPointsLeaders[year];
        if (leaders && leaders.length > 0) {
            newSeasonAwardsSummary[year].pointsChamp = leaders[0].team;
            // Ensure strictly lower for 2nd and 3rd place to avoid ties getting higher ranks
            if (leaders.length > 1 && leaders[1].points < leaders[0].points) {
                newSeasonAwardsSummary[year].pointsSecond = leaders[1].team;
            }
            if (leaders.length > 2 && leaders[2].points < leaders[1].points) {
                newSeasonAwardsSummary[year].pointsThird = leaders[2].team;
            }
        }
    });

    // Sort years in descending order (most recent first) for display in the table
    const sortedYearsArray = Object.keys(newSeasonAwardsSummary).sort((a, b) => parseInt(b) - parseInt(a));
    console.log("Sorted years for awards (most recent first):", sortedYearsArray); // Debugging line

    setSeasonAwardsSummary(newSeasonAwardsSummary); // Set the summary object
    setSortedYearsForAwards(sortedYearsArray); // Set the sorted array of years

  }, [historicalMatchups, loading, error, getDisplayTeamName]); // Dependencies

  // Formatters
  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${(value * 100).toFixed(1)}%`; // Format as percentage with 1 decimal
    }
    return '0.0%';
  };

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Sort the payload by value (DPR) in descending order
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
          <p className="font-bold text-gray-800 mb-1">{`Year: ${label}`}</p>
          {sortedPayload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${formatDPR(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">League History & Awards</h2>

      {loading ? (
        <p className="text-center text-gray-600">Loading league history data...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : allTimeStandings.length === 0 ? (
        <p className="text-center text-gray-600">No historical matchup data found to display league history. Please check your Apps Script URL.</p>
      ) : (
        <>
          {/* All-Time League Standings */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">All-Time Standings & Awards</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                    <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Seasons</th>
                    <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record</th>
                    <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                    <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Awards</th>
                  </tr>
                </thead>
                <tbody>
                  {allTimeStandings.map((team, index) => (
                    <tr key={team.team} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{team.team}</td>
                      <td className="py-2 px-3 text-sm text-gray-700 text-center">{team.seasons}</td>
                      <td className="py-2 px-3 text-sm text-gray-700 text-center">{team.record}</td>
                      <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatPercentage(team.winPercentage)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700 text-center">
                        <div className="flex flex-wrap justify-center items-center gap-2">
                          {team.awards.championships > 0 && (
                            <span title="Championships (1st Place)" className="flex items-center space-x-1">
                              <i className="fas fa-trophy text-yellow-500 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.championships}x</span>
                            </span>
                          )}
                          {team.awards.runnerUps > 0 && (
                            <span title="Runner-Up Finishes (2nd Place)" className="flex items-center space-x-1">
                              <i className="fas fa-trophy text-gray-400 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.runnerUps}x</span>
                            </span>
                          )}
                          {team.awards.thirdPlace > 0 && (
                            <span title="Third Place Finishes (3rd Place)" className="flex items-center space-x-1">
                              <i className="fas fa-trophy text-amber-800 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.thirdPlace}x</span>
                            </span>
                          )}
                          {team.awards.firstPoints > 0 && (
                            <span title="1st Place in Total Points" className="flex items-center space-x-1">
                              <i className="fas fa-medal text-yellow-500 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.firstPoints}x</span>
                            </span>
                          )}
                          {team.awards.secondPoints > 0 && (
                            <span title="2nd Place in Total Points" className="flex items-center space-x-1">
                              <i className="fas fa-medal text-gray-400 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.secondPoints}x</span>
                            </span>
                          )}
                          {team.awards.thirdPoints > 0 && (
                            <span title="3rd Place in Total Points" className="flex items-center space-x-1">
                              <i className="fas fa-medal text-amber-800 text-lg"></i>
                              <span className="text-xs font-medium">{team.awards.thirdPoints}x</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Total DPR Progression Line Graph */}
          <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Total DPR Progression Over Seasons</h3>
            {seasonalDPRChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={seasonalDPRChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: "Season Year", position: "insideBottom", offset: 0 }} />
                  <YAxis
                    label={{ value: "Cumulative Adjusted DPR", angle: -90, position: "insideLeft" }}
                    domain={[0.900, 1.100]}
                    tickFormatter={formatDPR}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {uniqueTeamsForChart.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={teamColors[index % teamColors.length]}
                      activeDot={{ r: 8 }}
                      dot={{ r: 4 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600">No total DPR progression data available for charting.</p>
            )}
          </section>

          {/* New: Season-by-Season Champions & Awards */}
          <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season-by-Season Champions & Awards</h3>
            {Object.keys(seasonAwardsSummary).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Year</th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-trophy text-yellow-500 mr-1"></i> Champion
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-trophy text-gray-400 mr-1"></i> 2nd Place
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-trophy text-amber-800 mr-1"></i> 3rd Place
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-medal text-yellow-500 mr-1"></i> Points Champ
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-medal text-gray-400 mr-1"></i> Points 2nd
                      </th>
                      <th className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                        <i className="fas fa-medal text-amber-800 mr-1"></i> Points 3rd
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedYearsForAwards.map((year, index) => { // Use sortedYearsForAwards directly
                      const awards = seasonAwardsSummary[year];
                      return (
                        <tr key={year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 px-3 text-sm text-gray-800 font-semibold text-center">{year}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.champion}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.secondPlace}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.thirdPlace}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsChamp}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsSecond}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 text-center">{awards.pointsThird}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">No season-by-season award data available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default LeagueHistory;
