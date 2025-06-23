// src/lib/TeamDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import for consistency

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

// Function to calculate rank for a given value among all values, handling ties
const calculateRank = (value, allValues, isHigherBetter = true) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return 'N/A';

    const numericValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));
    if (numericValues.length === 0) return 'N/A';

    // Create a sorted list of unique values to determine rank positions
    const uniqueSortedValues = [...new Set(numericValues)].sort((a, b) => isHigherBetter ? b - a : a - b);

    let rank = 1;
    for (let i = 0; i < uniqueSortedValues.length; i++) {
        const currentUniqueValue = uniqueSortedValues[i];
        if (currentUniqueValue === value) {
            const tieCount = numericValues.filter(v => v === value).length;
            if (tieCount > 1) {
                return `T-${rank}${getOrdinalSuffix(rank)}`;
            } else {
                return `${rank}${getOrdinalSuffix(rank)}`;
            }
        }
        // Increment rank by the number of values tied at the current unique position
        const countAtCurrentRank = numericValues.filter(v => v === currentUniqueValue).length;
        if (i < uniqueSortedValues.length - 1 && value !== currentUniqueValue) {
             rank += countAtCurrentRank;
        }
    }

    return 'N/A'; // Should not be reached if value exists in numericValues, but as a safeguard
};


// Formatting functions moved outside the component for accessibility
const formatScore = (score) => {
  // Directly use toLocaleString with minimumFractionDigits and maximumFractionDigits
  return typeof score === 'number' ? score.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
};

const formatPercentage = (value) => {
  return typeof value === 'number' ? `${(value).toFixed(3).substring(1)}%` : 'N/A';
};

const formatLuckRating = (value) => {
  return typeof value === 'number' ? value.toFixed(3) : 'N/A'; // Changed to toFixed(3)
};

const formatDPR = (value) => {
  return typeof value === 'number' ? value.toFixed(3) : 'N/A';
};


const TeamDetailPage = ({ teamName, historicalMatchups, getMappedTeamName }) => {
  const [teamOverallStats, setTeamOverallStats] = useState(null);
  const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // State for sorting
  const [sortBy, setSortBy] = useState('year');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (!teamName || !historicalMatchups || historicalMatchups.length === 0) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    const currentYear = new Date().getFullYear(); // Get the current year

    const overallStats = {
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      totalPointsFor: 0,
      totalGamesPlayed: 0,
      overallTopScoreWeeksCount: 0, // Total count of weekly top scores
      playoffAppearancesCount: 0, // Cumulative count
      avgDPR: 0, // Career average DPR
      totalDPRSum: 0, // To calculate average
      seasonsWithDPRData: 0, // To count seasons with valid DPR for average
      totalLuckRating: 0, // New: Cumulative luck rating
      // Cumulative award counts
      totalChampionships: 0,
      totalRunnerUps: 0,
      totalThirdPlaces: 0,
      totalPointsChampionships: 0,
      totalPointsRunnerUps: 0,
      totalThirdPlacePoints: 0,
      // Ranks (will be populated later)
      winRank: 'N/A',
      winPercentageRank: 'N/A',
      pointsForRank: 'N/A',
      topScoreWeeksRank: 'N/A',
      playoffRank: 'N/A',
      championshipRank: 'N/A',
      luckRank: 'N/A', // New: Luck rating rank
    };

    const seasonalData = {};
    
    const completedOrCurrentSeasons = new Set();
    historicalMatchups.forEach(match => {
        const year = parseInt(match.year);
        if (!isNaN(year)) {
            // A season is "completed" if there's a championship game recorded for it OR it's the current year
            if ((match.finalSeedingGame === 1 || match.finalSeedingGame === '1') || year === currentYear) {
                completedOrCurrentSeasons.add(year);
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
    });

    // Calculate all league metrics including seasonal ranks and awards
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);

    const compiledSeasonHistory = [];
    // Aggregate all teams' career stats for ranking purposes
    const allTeamsAggregatedStats = {};
    const allUniqueTeams = new Set();
    historicalMatchups.forEach(match => {
        allUniqueTeams.add(getMappedTeamName(String(match.team1 || '').trim()));
        allUniqueTeams.add(getMappedTeamName(String(match.team2 || '').trim()));
    });

    allUniqueTeams.forEach(team => {
        if (team === '') return; // Skip empty team names

        let totalWins = 0;
        let totalLosses = 0;
        let totalTies = 0;
        let totalPointsFor = 0;
        let totalGamesPlayed = 0;
        let careerChampionships = 0;
        let careerPlayoffAppearancesCount = 0; // Sum of seasons with playoff appearances
        let careerTopScoreWeeks = 0;
        let careerTotalDPRSum = 0;
        let careerSeasonsWithDPRData = 0;
        let careerTotalLuckRating = 0; // New: Sum of luck ratings

        // Iterate through all seasons to gather career data for this 'team'
        Object.keys(seasonalMetrics).forEach(year => {
            const teamMetrics = seasonalMetrics[year]?.[team];
            if (teamMetrics && completedOrCurrentSeasons.has(parseInt(year))) { // Only count completed or current seasons
                totalWins += teamMetrics.wins;
                totalLosses += teamMetrics.losses;
                totalTies += teamMetrics.ties;
                totalPointsFor += teamMetrics.pointsFor;
                totalGamesPlayed += teamMetrics.totalGames;

                if (teamMetrics.isChampion) careerChampionships++;
                if (teamMetrics.isPlayoffTeam) careerPlayoffAppearancesCount++; // Increment count if team made playoffs this season
                if (typeof teamMetrics.topScoreWeeksCount === 'number') careerTopScoreWeeks += teamMetrics.topScoreWeeksCount;
                if (typeof teamMetrics.luckRating === 'number' && !isNaN(teamMetrics.luckRating)) {
                    careerTotalLuckRating += teamMetrics.luckRating;
                }

                if (teamMetrics.adjustedDPR !== 0) {
                  careerTotalDPRSum += teamMetrics.adjustedDPR;
                  careerSeasonsWithDPRData++;
                }
            }
        });

        allTeamsAggregatedStats[team] = {
            wins: totalWins,
            losses: totalLosses,
            ties: totalTies,
            pointsFor: totalPointsFor,
            totalGamesPlayed: totalGamesPlayed,
            winPercentage: totalGamesPlayed > 0 ? ((totalWins + 0.5 * totalTies) / totalGamesPlayed) : 0,
            championships: careerChampionships,
            playoffAppearancesCount: careerPlayoffAppearancesCount,
            topScoreWeeksCount: careerTopScoreWeeks,
            avgDPR: careerSeasonsWithDPRData > 0 ? careerTotalDPRSum / careerSeasonsWithDPRData : 0,
            totalLuckRating: careerTotalLuckRating, // Add total luck rating here
        };
    });

    // Populate the selected team's overall stats and calculate ranks
    const selectedTeamCareerStats = allTeamsAggregatedStats[teamName];
    if (selectedTeamCareerStats) {
        overallStats.totalWins = selectedTeamCareerStats.wins;
        overallStats.totalLosses = selectedTeamCareerStats.losses;
        overallStats.totalTies = selectedTeamCareerStats.ties;
        overallStats.totalPointsFor = selectedTeamCareerStats.pointsFor;
        overallStats.totalGamesPlayed = selectedTeamCareerStats.totalGamesPlayed;
        overallStats.overallTopScoreWeeksCount = selectedTeamCareerStats.topScoreWeeksCount;
        overallStats.avgDPR = selectedTeamCareerStats.avgDPR;
        overallStats.totalChampionships = selectedTeamCareerStats.championships;
        overallStats.playoffAppearancesCount = selectedTeamCareerStats.playoffAppearancesCount;
        overallStats.totalLuckRating = selectedTeamCareerStats.totalLuckRating; // Set total luck rating

        const allWins = Object.values(allTeamsAggregatedStats).map(t => t.wins);
        const allWinPercentages = Object.values(allTeamsAggregatedStats).map(t => t.winPercentage);
        const allPointsFor = Object.values(allTeamsAggregatedStats).map(t => t.pointsFor);
        const allTopScoreWeeks = Object.values(allTeamsAggregatedStats).map(t => t.topScoreWeeksCount);
        const allPlayoffAppearances = Object.values(allTeamsAggregatedStats).map(t => t.playoffAppearancesCount);
        const allChampionships = Object.values(allTeamsAggregatedStats).map(t => t.championships);
        const allTotalLuckRatings = Object.values(allTeamsAggregatedStats).map(t => t.totalLuckRating); // Get all luck ratings

        overallStats.winRank = calculateRank(selectedTeamCareerStats.wins, allWins);
        overallStats.winPercentageRank = calculateRank(selectedTeamCareerStats.winPercentage, allWinPercentages);
        overallStats.pointsForRank = calculateRank(selectedTeamCareerStats.pointsFor, allPointsFor);
        overallStats.topScoreWeeksRank = calculateRank(selectedTeamCareerStats.topScoreWeeksCount, allTopScoreWeeks);
        overallStats.playoffRank = calculateRank(selectedTeamCareerStats.playoffAppearancesCount, allPlayoffAppearances);
        overallStats.championshipRank = calculateRank(selectedTeamCareerStats.championships, allChampionships);
        overallStats.luckRank = calculateRank(selectedTeamCareerStats.totalLuckRating, allTotalLuckRatings); // Calculate luck rank

        // Sum up other awards based on seasonalMetrics flags for the current team
        Object.keys(seasonalMetrics).forEach(yearStr => {
            const metricsForSeason = seasonalMetrics[yearStr]?.[teamName];
            if (metricsForSeason && completedOrCurrentSeasons.has(parseInt(yearStr))) {
                if (metricsForSeason.isRunnerUp) {
                    overallStats.totalRunnerUps++;
                }
                if (metricsForSeason.isThirdPlace) {
                    overallStats.totalThirdPlaces++;
                }
                if (metricsForSeason.isPointsChampion) {
                    overallStats.totalPointsChampionships++;
                }
                if (metricsForSeason.isPointsRunnerUp) {
                    overallStats.totalPointsRunnerUps++;
                }
                if (metricsForSeason.isThirdPlacePoints) {
                    overallStats.totalThirdPlacePoints++;
                }
            }
        });
    }

    Object.keys(seasonalData).sort().forEach(yearStr => {
        const year = parseInt(yearStr);
        const seasonTeamStats = seasonalData[year][teamName];
        const metricsForSeason = seasonalMetrics[year]?.[teamName];

        // Only include completed or current seasons with valid metrics for the team
        if (seasonTeamStats && metricsForSeason && completedOrCurrentSeasons.has(year)) {
            const seasonTotalGames = seasonTeamStats.wins + seasonTeamStats.losses + seasonTeamStats.ties;
            const seasonWinPercentage = seasonTotalGames > 0 ? ((seasonTeamStats.wins + (0.5 * seasonTeamStats.ties)) / seasonTotalGames) : 0;

            compiledSeasonHistory.push({
                year: year,
                // Removed individual season award icons from here as per user request
                team: seasonTeamStats.teamName, // Keep this as plain team name for table
                wins: seasonTeamStats.wins,
                losses: seasonTeamStats.losses,
                ties: seasonTeamStats.ties,
                pointsFor: seasonTeamStats.pointsFor,
                pointsAgainst: seasonTeamStats.pointsAgainst,
                luckRating: metricsForSeason.luckRating,
                adjustedDPR: metricsForSeason.adjustedDPR,
                allPlayWinPercentage: metricsForSeason.allPlayWinPercentage,
                finish: metricsForSeason.overallFinish, // Positional finish
                pointsFinish: metricsForSeason.seasonPointsFinish, // Points finish (changed from pointsFinish to seasonPointsFinish to match calculateAllLeagueMetrics output)
                // Include award flags for potential future use or conditional rendering within the component
                isChampion: metricsForSeason.isChampion,
                isRunnerUp: metricsForSeason.isRunnerUp,
                isThirdPlace: metricsForSeason.isThirdPlace,
                isPointsChampion: metricsForSeason.isPointsChampion,
                isPointsRunnerUp: metricsForSeason.isPointsRunnerUp,
                isThirdPlacePoints: metricsForSeason.isThirdPlacePoints,
                isPlayoffTeam: metricsForSeason.isPlayoffTeam,
            });
        }
    });

    // Sort the compiled history by year
    compiledSeasonHistory.sort((a, b) => b.year - a.year); // Sort descending by year by default

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setLoadingStats(false);

  }, [teamName, historicalMatchups, getMappedTeamName]);


  // Handle sorting for season history table
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc'); // Default to descending for new sort column
    }
  };

  const sortedSeasonHistory = useMemo(() => {
    if (!teamSeasonHistory || teamSeasonHistory.length === 0) return [];

    const sortableHistory = [...teamSeasonHistory]; // Create a mutable copy

    sortableHistory.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle numerical comparisons, ensuring 'N/A' or non-numbers are treated
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      } else {
        // Fallback to string comparison for non-numerical or mixed values
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
    });
    return sortableHistory;
  }, [teamSeasonHistory, sortBy, sortOrder]);


  if (loadingStats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading team data...</p>
      </div>
    );
  }

  if (!teamOverallStats && !teamSeasonHistory.length) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">No data available for {teamName}.</p>
      </div>
    );
  }

  const formatRecord = (wins, losses, ties) => `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  const getWinPercentage = (wins, losses, ties) => {
    const totalGames = wins + losses + ties;
    return totalGames > 0 ? ((wins + 0.5 * ties) / totalGames) : 0;
  };
  const getAverageScore = (totalPoints, totalGames) => totalGames > 0 ? totalPoints / totalGames : 0;


  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-3xl font-bold text-blue-800 mb-6 text-center">{getMappedTeamName(teamName)} Dashboard</h2>

      {/* Overall Stats */}
      {teamOverallStats && (
        <section className="mb-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Career Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Overall Record" value={formatRecord(teamOverallStats.totalWins, teamOverallStats.totalLosses, teamOverallStats.totalTies)} rank={teamOverallStats.winRank} />
            <StatCard title="Win Percentage" value={formatPercentage(getWinPercentage(teamOverallStats.totalWins, teamOverallStats.totalLosses, teamOverallStats.totalTies))} rank={teamOverallStats.winPercentageRank} />
            <StatCard title="Total Points For" value={formatScore(teamOverallStats.totalPointsFor)} rank={teamOverallStats.pointsForRank} />
            <StatCard title="Average Score" value={formatScore(getAverageScore(teamOverallStats.totalPointsFor, teamOverallStats.totalGamesPlayed))} />
            <StatCard title="Championships" value={teamOverallStats.totalChampionships} rank={teamOverallStats.championshipRank} />
            <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearancesCount} rank={teamOverallStats.playoffRank} />
            <StatCard title="Top Score Weeks" value={teamOverallStats.overallTopScoreWeeksCount} rank={teamOverallStats.topScoreWeeksRank} />
            <StatCard title="Average DPR" value={formatDPR(teamOverallStats.avgDPR)} />
            <StatCard title="Overall Luck" value={formatLuckRating(teamOverallStats.totalLuckRating)} rank={teamOverallStats.luckRank} /> {/* Displaying total luck */}
          </div>

          <div className="mt-6">
            <h4 className="text-xl font-semibold text-gray-800 mb-3">Career Awards</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {teamOverallStats.totalRunnerUps > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg shadow-sm border border-yellow-200 text-center">
                  <p className="text-lg font-bold text-yellow-700">{teamOverallStats.totalRunnerUps}x Runner-Up</p>
                </div>
              )}
              {teamOverallStats.totalThirdPlaces > 0 && (
                <div className="bg-green-50 p-3 rounded-lg shadow-sm border border-green-200 text-center">
                  <p className="text-lg font-bold text-green-700">{teamOverallStats.totalThirdPlaces}x Third Place</p>
                </div>
              )}
              {teamOverallStats.totalPointsChampionships > 0 && (
                <div className="bg-purple-50 p-3 rounded-lg shadow-sm border border-purple-200 text-center">
                  <p className="text-lg font-bold text-purple-700">{teamOverallStats.totalPointsChampionships}x Points Champion</p>
                </div>
              )}
              {teamOverallStats.totalPointsRunnerUps > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg shadow-sm border border-orange-200 text-center">
                  <p className="text-lg font-bold text-orange-700">{teamOverallStats.totalPointsRunnerUps}x Points Runner-Up</p>
                </div>
              )}
              {teamOverallStats.totalThirdPlacePoints > 0 && (
                <div className="bg-pink-50 p-3 rounded-lg shadow-sm border border-pink-200 text-center">
                  <p className="text-lg font-bold text-pink-700">{teamOverallStats.totalThirdPlacePoints}x Third Place (Points)</p>
                </div>
              )}
            </div>
            {!teamOverallStats.totalRunnerUps && !teamOverallStats.totalThirdPlaces && !teamOverallStats.totalPointsChampionships && !teamOverallStats.totalPointsRunnerUps && !teamOverallStats.totalThirdPlacePoints && (
              <p className="text-gray-600">No additional career awards.</p>
            )}
          </div>
        </section>
      )}


      {/* Season-by-Season History */}
      <section>
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Season-by-Season History</h3>
        {sortedSeasonHistory && sortedSeasonHistory.length > 0 ? (
          <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('year')}>Year {sortBy === 'year' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('wins')}>Wins {sortBy === 'wins' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('losses')}>Losses {sortBy === 'losses' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('ties')}>Ties {sortBy === 'ties' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('pointsFor')}>Points For {sortBy === 'pointsFor' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('pointsAgainst')}>Points Against {sortBy === 'pointsAgainst' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('luckRating')}>Luck Rating {sortBy === 'luckRating' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('finish')}>Finish {sortBy === 'finish' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('pointsFinish')}>Points Finish {sortBy === 'pointsFinish' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('adjustedDPR')}>Adj. DPR {sortBy === 'adjustedDPR' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('allPlayWinPercentage')}>All-Play Win % {sortBy === 'allPlayWinPercentage' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSeasonHistory.map((season) => (
                  <tr key={season.year} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">{season.year}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">{getMappedTeamName(season.team)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.wins}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.losses}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.ties}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsFor)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsAgainst)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatLuckRating(season.luckRating)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.finish}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.pointsFinish}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatDPR(season.adjustedDPR)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatPercentage(season.allPlayWinPercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No season-by-season data available for {teamName} for completed or current seasons.</p>
        )}
      </section>
    </div>
  );
};

// Simple Stat Card Component (reused from PowerRankings or other places)
const StatCard = ({ title, value, rank }) => ( // Added rank prop
  <div className="bg-blue-50 p-2 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200">
    {rank && rank !== 'N/A' && <p className="text-2xl font-bold text-blue-700">{rank}</p>} {/* Larger font for rank */}
    {/* Changed text-blue-800 to text-gray-600 to avoid conflicting with rank color */}
    <p className="text-sm text-gray-600">{title}</p>
    <p className="text-lg font-semibold text-blue-600">{value}</p>
  </div>
);

export default TeamDetailPage;
