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

// Formatting functions moved outside the component for accessibility
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


const TeamDetailPage = ({ teamName, historicalMatchups, getMappedTeamName }) => { // Removed historicalChampions prop
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
      overallTopScoreWeeksCount: 0, // Total count of weekly top scores
      playoffAppearances: new Set(),
      championships: 0, // Now derived from seasonalMetrics
      avgDPR: 0, // Career average DPR
      totalDPRSum: 0, // To calculate average
      seasonsWithDPRData: 0, // To count seasons with valid DPR for average
    };

    const seasonalData = {};
    
    const completedSeasons = new Set();
    historicalMatchups.forEach(match => {
        // We consider a season "completed" if there's a championship game recorded for it.
        // This helps in accurately filtering historical data for the team.
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

      // Skip invalid or irrelevant matches
      if (!displayTeam1 || displayTeam1 === '' || !displayTeam2 || displayTeam2 === '' || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 !== teamName && displayTeam2 !== teamName)) {
        return;
      }

      // Initialize seasonal data for the current year and team if not already present
      if (!seasonalData[year]) {
        seasonalData[year] = {};
      }
      if (!seasonalData[year][teamName]) {
        seasonalData[year][teamName] = {
          wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
          luckRating: 0, adjustedDPR: 0, allPlayWinPercentage: 0,
          gamesPlayed: 0,
          weeklyScores: [], // Store weekly scores for this team in this season
        };
      }

      const teamIsTeam1 = displayTeam1 === teamName;
      const currentTeamScore = teamIsTeam1 ? team1Score : team2Score;
      const opponentScore = teamIsTeam1 ? team2Score : team1Score;
      const isTie = team1Score === team2Score;

      // Update overall and seasonal statistics, excluding points-only byes from game counts
      if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
          overallStats.totalGamesPlayed++;
          seasonalData[year][teamName].gamesPlayed++;
          seasonalData[year][teamName].weeklyScores.push(currentTeamScore); // Store weekly score

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

      // Accumulate points regardless of bye status
      overallStats.totalPointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsAgainst += opponentScore;

      // Track playoff appearances
      if ((match.playoffs === true || match.playoffs === 'true') && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
        overallStats.playoffAppearances.add(year);
      }
    });

    // Calculate all league metrics including seasonal ranks and awards
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);

    const compiledSeasonHistory = [];
    Object.keys(seasonalData).sort().forEach(yearStr => {
      const year = parseInt(yearStr);
      const seasonTeamStats = seasonalData[year][teamName];
      const metricsForSeason = seasonalMetrics[year]?.[teamName];

      // Only include completed seasons with valid metrics for the team
      if (seasonTeamStats && metricsForSeason && completedSeasons.has(year)) {
        const seasonTotalGames = seasonTeamStats.wins + seasonTeamStats.losses + seasonTeamStats.ties;
        const seasonWinPercentage = seasonTotalGames > 0 ? ((seasonTeamStats.wins + (0.5 * seasonTeamStats.ties)) / seasonTotalGames) : 0;

        compiledSeasonHistory.push({
          year: year,
          // Render team name with award icons based on seasonal metrics
          team: (
            <span>
              {seasonTeamStats.teamName}
              {metricsForSeason.isChampion && <span title="League Champion" style={{ marginLeft: '5px', color: 'gold' }}>🏆</span>}
              {metricsForSeason.isRunnerUp && <span title="League Runner-Up" style={{ marginLeft: '5px', color: 'silver' }}>🥈</span>}
              {metricsForSeason.isThirdPlace && <span title="League Third Place" style={{ marginLeft: '5px', color: '#cd7f32' }}>🥉</span>}
              {metricsForSeason.isPointsChampion && <span title="Points Champion" style={{ marginLeft: '5px', color: 'gold' }}>🥇</span>}
              {metricsForSeason.isPointsRunnerUp && <span title="2nd Place Total Points" style={{ marginLeft: '5px', color: 'silver' }}>🥈</span>}
              {metricsForSeason.isThirdPlacePoints && <span title="3rd Place Total Points" style={{ marginLeft: '5px', color: '#cd7f32' }}>🥉</span>}
            </span>
          ),
          wins: seasonTeamStats.wins,
          losses: seasonTeamStats.losses,
          ties: seasonTeamStats.ties,
          pointsFor: seasonTeamStats.pointsFor,
          pointsAgainst: seasonTeamStats.pointsAgainst,
          luckRating: metricsForSeason.luckRating,
          adjustedDPR: metricsForSeason.adjustedDPR,
          allPlayWinPercentage: metricsForSeason.allPlayWinPercentage,
          winPercentage: seasonWinPercentage,
          finish: metricsForSeason.rank ? `${metricsForSeason.rank}${getOrdinalSuffix(metricsForSeason.rank)}` : 'N/A', // Use rank from seasonalMetrics
        });

        // Sum up topScoreWeeksCount for overall total
        if (typeof metricsForSeason.topScoreWeeksCount === 'number') {
            overallStats.overallTopScoreWeeksCount += metricsForSeason.topScoreWeeksCount;
        }

        if (metricsForSeason.adjustedDPR !== 0) {
            overallStats.totalDPRSum += metricsForSeason.adjustedDPR;
            overallStats.seasonsWithDPRData++;
        }

        // Sum up championships based on seasonalMetrics.isChampion flag
        if (metricsForSeason.isChampion) {
            overallStats.championships++;
        }
      }
    });

    if (overallStats.seasonsWithDPRData > 0) {
      overallStats.avgDPR = overallStats.totalDPRSum / overallStats.seasonsWithDPRData;
    } else {
        overallStats.avgDPR = 0;
    }

    setTeamOverallStats(overallStats); // Set the state variable here
    setTeamSeasonHistory(compiledSeasonHistory.sort((a, b) => b.year - a.year)); // Sort by year descending
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName]);


  if (loadingStats) {
    return (
      <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8 text-center text-gray-600">
        Loading {teamName}'s historical data...
      </div>
    );
  }

  // Handle case where teamOverallStats is null (e.g., initial render or no data found)
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
        <span className="block text-lg font-medium text-gray-600 mt-2">
          Record: {teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies} | Career DPR: {formatDPR(teamOverallStats.avgDPR)}
          {teamOverallStats.championships > 0 && (
            <span className="ml-3 text-yellow-500">
              🏆 {teamOverallStats.championships} {teamOverallStats.championships === 1 ? 'Championship' : 'Championships'}
            </span>
          )}
        </span>
      </h2>

      {/* Overall Stats */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Overall Career Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Wins" value={teamOverallStats.totalWins} />
          <StatCard title="Win Percentage" value={formatPercentage((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed)} />
          <StatCard title="Total Points For" value={formatScore(teamOverallStats.totalPointsFor)} />
          <StatCard
            title="Weekly Top Scores"
            value={
              teamOverallStats.overallTopScoreWeeksCount !== undefined
                ? `${teamOverallStats.overallTopScoreWeeksCount} week${teamOverallStats.overallTopScoreWeeksCount === 1 ? '' : 's'}`
                : 'N/A'
            }
          />
          <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearances.size} />
          <StatCard title="Championships" value={teamOverallStats.championships} />
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
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
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
                    <td className="py-2 px-3 text-sm text-gray-800">{season.team}</td>
                    <td className="py-2 px-3 text-sm text-gray-800">{season.wins}-{season.losses}-{season.ties}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatScore(season.pointsFor)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatScore(season.pointsAgainst)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(season.luckRating)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{season.finish}</td>
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(season.adjustedDPR)}</td>
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
  <div className="bg-blue-50 p-2 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200">
    <p className="text-sm font-semibold text-blue-800 mb-1">{title}</p>
    <p className="text-lg font-bold text-gray-800">{value}</p>
  </div>
);

export default TeamDetailPage;
