// src/lib/TeamDetailPage.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import for consistency

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

const TeamDetailPage = ({ teamName, historicalMatchups, getMappedTeamName, historicalChampions }) => {
  const [teamOverallStats, setTeamOverallStats] = useState(null);
  const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!teamName || !historicalMatchups || historicalMatchups.length === 0) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    const overallStats = {
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      totalPointsFor: 0,
      totalGamesPlayed: 0,
      highestScore: { value: 0, matchup: null, year: null, week: null },
      playoffAppearances: new Set(),
      championships: 0, // This will now be derived from historicalChampions
      runnerUps: 0, // This will now be derived from historicalChampions
      totalDPR: 0, // Sum of adjusted DPRs across seasons - will become average
      luckRatingTotal: 0, // Sum of luck ratings across seasons - will become average
      allPlayWinPercentageTotal: 0, // Sum of all-play win percentages across seasons - will become average
      seasonsCount: 0, // Number of seasons with valid data for this team
    };

    const seasonalData = {}; // { year: { wins, losses, ties, pointsFor, pointsAgainst, luckRating, adjustedDPR, allPlayWinPercentage } }

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

    historicalMatchups.forEach(match => {
      const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
      const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip invalid matchups or non-participating teams or empty team names
      if (!displayTeam1 || displayTeam1 === '' || !displayTeam2 || displayTeam2 === '' || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 !== teamName && displayTeam2 !== teamName)) {
        return;
      }

      // Initialize seasonal data for the year and team if not exists
      if (!seasonalData[year]) {
        seasonalData[year] = {};
      }
      if (!seasonalData[year][teamName]) {
        seasonalData[year][teamName] = {
          wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
          luckRating: 0, adjustedDPR: 0, allPlayWinPercentage: 0,
          gamesPlayed: 0, // Track games played per season for correct averages
        };
      }

      const teamIsTeam1 = displayTeam1 === teamName;
      const currentTeamScore = teamIsTeam1 ? team1Score : team2Score;
      const opponentScore = teamIsTeam1 ? team2Score : team1Score;
      const isTie = team1Score === team2Score;

      // Update overall highest score
      if (currentTeamScore > overallStats.highestScore.value) {
        overallStats.highestScore = {
          value: currentTeamScore,
          matchup: `${displayTeam1} vs ${displayTeam2}`,
          year: year,
          week: week,
        };
      }

      // Only count W/L/T and total games for actual games (not PointsOnlyBye)
      if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
          overallStats.totalGamesPlayed++;
          seasonalData[year][teamName].gamesPlayed++;

          if (isTie) {
              overallStats.totalTies++;
              seasonalData[year][teamName].ties++;
          } else if (teamIsTeam1 && team1Score > team2Score) {
              overallStats.totalWins++;
              seasonalData[year][teamName].wins++;
          } else if (!teamIsTeam1 && team2Score > team1Score) {
              overallStats.totalWins++;
              seasonalData[year][teamName].wins++;
          } else {
              overallStats.totalLosses++;
              seasonalData[year][teamName].losses++;
          }
      }

      // Points For and Against are always accumulated regardless of PointsOnlyBye
      overallStats.totalPointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsAgainst += opponentScore;

      // Track playoff appearances if the match is a playoff match AND it's not a PointsOnlyBye
      if ((match.playoffs === true || match.playoffs === 'true') && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
        overallStats.playoffAppearances.add(year);
      }
    });

    // Populate team-specific DPR, Luck Rating, All-Play from calculateAllLeagueMetrics
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);

    // After aggregating raw stats, fill in derived seasonal metrics
    const compiledSeasonHistory = [];
    Object.keys(seasonalData).sort().forEach(yearStr => {
      const year = parseInt(yearStr);
      const seasonTeamStats = seasonalData[year][teamName];
      const metricsForSeason = seasonalMetrics[year]?.[teamName];

      // Only process and display seasonal data for completed seasons in the table
      if (seasonTeamStats && metricsForSeason && completedSeasons.has(year)) {
        // Calculate season record win percentage
        const seasonTotalGames = seasonTeamStats.wins + seasonTeamStats.losses + seasonTeamStats.ties;
        const seasonWinPercentage = seasonTotalGames > 0 ? ((seasonTeamStats.wins + (0.5 * seasonTeamStats.ties)) / seasonTotalGames) : 0;

        compiledSeasonHistory.push({
          year: year,
          wins: seasonTeamStats.wins,
          losses: seasonTeamStats.losses,
          ties: seasonTeamStats.ties,
          pointsFor: seasonTeamStats.pointsFor,
          pointsAgainst: seasonTeamStats.pointsAgainst,
          // Use metrics from calculateAllLeagueMetrics
          luckRating: metricsForSeason.luckRating,
          adjustedDPR: metricsForSeason.adjustedDPR,
          allPlayWinPercentage: metricsForSeason.allPlayWinPercentage,
          winPercentage: seasonWinPercentage,
          // Add dummy finish for now as it's complex to derive without full league data
          // This should ideally come from Google Sheet if available
          finish: 'N/A', // Placeholder for actual league finish
        });

        // Accumulate for overall averages ONLY if season is completed
        if (metricsForSeason.adjustedDPR !== 0) {
            overallStats.totalDPR += metricsForSeason.adjustedDPR;
        }
        if (metricsForSeason.luckRating !== 0) {
            overallStats.luckRatingTotal += metricsForSeason.luckRating;
        }
        if (metricsForSeason.allPlayWinPercentage !== 0) {
            overallStats.allPlayWinPercentageTotal += metricsForSeason.allPlayWinPercentage;
        }
        overallStats.seasonsCount++;
      }
    });

    // Calculate overall averages
    if (overallStats.seasonsCount > 0) {
      overallStats.avgDPR = overallStats.totalDPR / overallStats.seasonsCount;
      overallStats.avgLuckRating = overallStats.luckRatingTotal / overallStats.seasonsCount;
      overallStats.avgAllPlayWinPercentage = overallStats.allPlayWinPercentageTotal / overallStats.seasonsCount;
    } else {
        overallStats.avgDPR = 0;
        overallStats.avgLuckRating = 0;
        overallStats.avgAllPlayWinPercentage = 0;
    }

    // Process championships from historicalChampions prop ONLY for completed seasons
    overallStats.championships = historicalChampions.filter(champ =>
      getMappedTeamName(String(champ.champion || '').trim()) === teamName &&
      completedSeasons.has(parseInt(champ.year)) // Add condition for completed season
    ).length;

    overallStats.runnerUps = historicalChampions.filter(champ =>
      getMappedTeamName(String(champ.runnerUp || '').trim()) === teamName &&
      completedSeasons.has(parseInt(champ.year)) // Add condition for completed season
    ).length;

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory.sort((a, b) => b.year - a.year)); // Sort by year descending
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName, historicalChampions]);


  const formatScore = (score) => {
    return typeof score === 'number' ? score.toFixed(2) : 'N/A';
  };

  const formatPercentage = (value) => {
    return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';
  };

  const formatLuckRating = (value) => {
    return typeof value === 'number' ? value.toFixed(2) : 'N/A';
  };

  const formatDPR = (value) => {
    return typeof value === 'number' ? value.toFixed(3) : 'N/A';
  };


  if (loadingStats) {
    return (
      <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8 text-center text-gray-600">
        Loading {teamName}'s historical data...
      </div>
    );
  }

  if (!teamOverallStats) {
    return (
      <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8 text-center text-red-500">
        No data found for {teamName}.
      </div>
    );
  }

  return (
    <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center border-b pb-3">
        {teamName} - Team Profile
      </h2>

      {/* Overall Stats */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Overall Career Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard title="Overall Record" value={`${teamOverallStats.totalWins}-${teamOverallStats.totalLosses}-${teamOverallStats.totalTies}`} />
          <StatCard title="Win Percentage" value={formatPercentage((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed)} />
          <StatCard title="Total Points For" value={formatScore(teamOverallStats.totalPointsFor)} />
          <StatCard title="Highest Single Score" value={`${formatScore(teamOverallStats.highestScore.value)} (Week ${teamOverallStats.highestScore.week}, ${teamOverallStats.highestScore.year})`} />
          <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearances.size} />
          <StatCard title="Championships" value={teamOverallStats.championships} />
          <StatCard title="Runner-Up Finishes" value={teamOverallStats.runnerUps} />
          <StatCard title="Avg. Adjusted DPR" value={formatDPR(teamOverallStats.avgDPR)} />
          <StatCard title="Avg. Luck Rating" value={formatLuckRating(teamOverallStats.avgLuckRating)} />
          <StatCard title="Avg. All-Play Win %" value={formatPercentage(teamOverallStats.avgAllPlayWinPercentage)} />
        </div>
      </section>

      {/* Season by Season History Table */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season-by-Season History</h3>
        {teamSeasonHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Year</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider border-b border-gray-200">Finish</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">All-Play Win %</th>
                </tr>
              </thead>
              <tbody>
                {teamSeasonHistory.map((season, index) => (
                  <tr key={season.year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-3 text-sm text-gray-800">{season.year}</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{season.wins}-{season.losses}-{season.ties}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatScore(season.pointsFor)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatScore(season.pointsAgainst)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(season.luckRating)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{season.finish}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(season.adjustedDPR)}</td> {/* Changed to adjustedDPR */}
                    <td className="py-2 px-3 text-sm text-gray-700">{formatPercentage(season.allPlayWinPercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No season-by-season data available for {teamName} for completed seasons.</p>
        )}
      </section>
    </div>
  );
};

// Simple Stat Card Component (reused from PowerRankings or other places)
const StatCard = ({ title, value }) => (
  <div className="bg-blue-50 p-4 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200">
    <p className="text-md font-semibold text-blue-800 mb-1">{title}</p>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
  </div>
);

export default TeamDetailPage;
