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

const LeagueHistory = ({ historicalMatchups, loading, error, getDisplayTeamName, historicalChampions }) => {
  const [allTimeStandings, setAllTimeStandings] = useState([]);
  const [championshipGames, setChampionshipGames] = useState([]);
  const [seasonalDPRChartData, setSeasonalDPRChartData] = useState([]); // Renamed for more general use
  const [uniqueTeamsForChart, setUniqueTeamsForChart] = useState([]);

  // A color palette for the teams in the chart
  const teamColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#f5222d', '#fa8c16', '#a0d911', '#52c41a', '#1890ff',
    '#2f54eb', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#eb2f96', '#fadb14', '#52c41a'
  ];

  useEffect(() => {
    if (loading || error || !historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeStandings([]);
      setChampionshipGames([]);
      setSeasonalDPRChartData([]);
      setUniqueTeamsForChart([]);
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

    const teamOverallStats = {}; // { teamName: { totalWins, totalLosses, totalTies, totalPointsFor, seasonsPlayed: Set<year>, awards: { champ: N, second: N, third: N, pts1st: N, pts2nd: N, pts3rd: N } } }
    const yearlyPointsLeaders = {}; // { year: [{ team, points, rank }] }

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
              runnerUps: 0, // 2nd place overall finish
              thirdPlace: 0, // 3rd place overall finish
              firstPoints: 0,
              secondPoints: 0,
              thirdPoints: 0,
            }
          };
        }
        // Only count season if it's a completed season. This makes 'Seasons' stat accurate for 'completed seasons'
        if (completedSeasons.has(year)) {
            teamOverallStats[team].seasonsPlayed.add(year); // Track seasons played
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
            points: seasonalMetrics[year][team].pointsFor // Use seasonal total points
        })).sort((a, b) => b.points - a.points); // Sort descending by points

        yearlyPointsLeaders[year] = yearPointsData;
    });

    // Process championship games and final seeding for overall finish awards (Trophies)
    const newChampionshipGames = [];

    historicalMatchups.forEach(match => {
      const year = parseInt(match.year);
      // Only process final seeding games that are part of a completed season
      if (!(typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0 && completedSeasons.has(year))) {
          return; // Skip if not a final seeding game or season not completed
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
      const team2Won = team2Score > team1Score;

      let winner = 'Tie';
      let loser = 'Tie';
      let winnerScore = team1Score;
      let loserScore = team2Score;

      if (team1Won) {
          winner = team1;
          loser = team2;
          winnerScore = team1Score;
          loserScore = team2Score;
      } else if (team2Won) {
          winner = team2;
          loser = team1;
          winnerScore = team2Score;
          loserScore = team1Score;
      }

      const winningPlace = match.finalSeedingGame;
      const losingPlace = match.finalSeedingGame + 1; // This is only accurate for 1st place game loser (2nd place)

      newChampionshipGames.push({
          year: year,
          week: match.week,
          team1: team1,
          team2: team2,
          team1Score: team1Score,
          team2Score: team2Score,
          purpose: getFinalSeedingGamePurpose(match.finalSeedingGame),
          winner: winner,
          loser: loser,
          winnerScore: winnerScore,
          loserScore: loserScore,
          winnerPlace: winningPlace,
          loserPlace: losingPlace
      });

      // Directly assign trophies based on finalSeedingGame value
      if (winner !== 'Tie') { // Only assign if there's a clear winner
          if (match.finalSeedingGame === 1) { // 1st Place Game
              if (teamOverallStats[winner]) {
                  teamOverallStats[winner].awards.championships++; // Gold Trophy
              }
              if (loser && teamOverallStats[loser]) { // Loser of 1st place game gets 2nd (Silver Trophy)
                  teamOverallStats[loser].awards.runnerUps++;
              }
          } else if (match.finalSeedingGame === 3) { // 3rd Place Game
              if (teamOverallStats[winner]) {
                  teamOverallStats[winner].awards.thirdPlace++; // Bronze Trophy
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
      // No trophies for any other placing game (handled by the specific `if` conditions above)
    });

    // Sort championship games (most recent year first, then by winner place)
    setChampionshipGames(newChampionshipGames.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.winnerPlace - b.winnerPlace;
    }));

    // Medal Calculation Pass (based on yearlyPointsLeaders)
    Object.keys(teamOverallStats).forEach(teamName => {
      Object.keys(yearlyPointsLeaders).forEach(year => {
          // Ensure this year is a completed season
          if (!completedSeasons.has(parseInt(year))) return;

          const yearLeaders = yearlyPointsLeaders[year];
          // Filter out empty team names before processing leaders
          const filteredYearLeaders = yearLeaders.filter(entry => entry.team !== '');

          // Find the current team's points for this year
          const teamPointsEntry = filteredYearLeaders.find(entry => entry.team === teamName);
          if (!teamPointsEntry) return; // Skip if team not found in leaders for this year

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


    // Final compilation for display
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
        seasons: seasonsDisplay, // Use the formatted string here
        record: `${stats.totalWins}-${stats.totalLosses}-${stats.totalTies}`,
        winPercentage: winPercentage,
        totalDPR: careerDPR, // This DPR needs to be for games that count towards record, not including byes
        awards: stats.awards,
        // Add more career stats if needed for sorting or display later
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

    setUniqueTeamsForChart(uniqueTeams); // Set unique teams once

    // To store the cumulative DPR for each team as we progress through years
    const cumulativeTeamDPRs = {}; // { teamName: latestDPR }

    allYears.forEach(currentYear => {
        const matchesUpToCurrentYear = historicalMatchups.filter(match => parseInt(match.year) <= currentYear);

        // Recalculate metrics for games up to currentYear to get cumulative career DPR
        // This is a computationally intensive step, but ensures correct cumulative DPR.
        const { careerDPRData: cumulativeCareerDPRData } = calculateAllLeagueMetrics(matchesUpToCurrentYear, getDisplayTeamName);

        const yearDataPoint = { year: currentYear };
        uniqueTeams.forEach(team => {
            const teamDPR = cumulativeCareerDPRData.find(dpr => dpr.team === team)?.dpr;
            if (teamDPR !== undefined) {
                cumulativeTeamDPRs[team] = teamDPR; // Update the latest cumulative DPR for the team
            }
            // Use the latest cumulative DPR. If a team didn't play yet, their DPR will be 0 or undefined.
            yearDataPoint[team] = cumulativeTeamDPRs[team] || 0; // Default to 0 if not played yet
        });
        chartData.push(yearDataPoint);
    });
    setSeasonalDPRChartData(chartData);


  }, [historicalMatchups, loading, error, getDisplayTeamName, historicalChampions]); // Dependencies

  // Formatters
  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${value.toFixed(3)}%`;
    }
    return '0.000%';
  };

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
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
                    {/* Removed Total DPR column */}
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
                      {/* Removed Total DPR data cell */}
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
                              <i className="fas fa-trophy text-amber-800 text-lg"></i> {/* Deeper amber for bronze */}
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
                              <i className="fas fa-medal text-amber-800 text-lg"></i> {/* Deeper amber for bronze */}
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
                  <YAxis label={{ value: "Cumulative Adjusted DPR", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value) => formatDPR(value)} />
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

          {/* Championship and Final Seeding Games */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Championship & Seeding Games History</h3>
            {championshipGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {championshipGames.map((game, index) => (
                        <div key={index} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                            <h4 className="font-bold text-blue-800 text-lg mb-2">{game.year} {game.purpose}</h4>
                            <p className="text-sm text-gray-700">Week {game.week}</p>
                            <p className="text-sm text-gray-700">
                                <strong>{game.team1}</strong> ({game.team1Score}) vs <strong>{game.team2}</strong> ({game.team2Score})
                            </p>
                            {game.winner !== 'Tie' ? (
                                <>
                                    <p className="text-sm text-blue-700 font-semibold mt-1">
                                        Winner: {game.winner} ({game.winnerScore}) - Finished {game.winnerPlace}{getOrdinalSuffix(game.winnerPlace)} Place
                                    </p>
                                    <p className="text-sm text-red-700 font-semibold">
                                        Loser: {game.loser} ({game.loserScore}) - Finished {game.loserPlace}{getOrdinalSuffix(game.loserPlace)} Place
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-gray-700 font-semibold mt-1">
                                    Game was a Tie - Both teams finished {game.winnerPlace}{getOrdinalSuffix(game.winnerPlace)} Place
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-600">No championship or final seeding game data found.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default LeagueHistory;
