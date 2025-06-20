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
            if (teamMetrics && completedSeasons.has(parseInt(year))) { // Only count completed seasons
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
            if (metricsForSeason && completedSeasons.has(parseInt(yearStr))) {
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

      // Only include completed seasons with valid metrics for the team
      if (seasonTeamStats && metricsForSeason && completedSeasons.has(year)) {
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
          winPercentage: seasonWinPercentage,
          finish: metricsForSeason.rank ? `${metricsForSeason.rank}${getOrdinalSuffix(metricsForSeason.rank)}` : 'N/A', // Use rank from seasonalMetrics
          pointsFinish: metricsForSeason.pointsRank ? `${metricsForSeason.pointsRank}${getOrdinalSuffix(metricsForSeason.pointsRank)}` : 'N/A', // New: Points finish rank
        });
      }
    });


    setTeamOverallStats(overallStats); // Set the state variable here
    setTeamSeasonHistory(compiledSeasonHistory); // Do not sort here, use useMemo below
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName]);

  // Handle sorting logic for season history
  const sortedSeasonHistory = useMemo(() => {
    if (!teamSeasonHistory.length) return [];

    const sortableHistory = [...teamSeasonHistory]; // Create a mutable copy

    // Helper to convert ordinal/tie ranks to numbers for sorting
    const parseRankForSort = (rankString) => {
        if (rankString === 'N/A') return Infinity; // Put N/A at the end
        if (rankString.startsWith('T-')) {
            return parseInt(rankString.substring(2));
        }
        const match = rankString.match(/^(\d+)/);
        return match ? parseInt(match[1]) : Infinity;
    };

    return sortableHistory.sort((a, b) => {
        let valA, valB;

        switch (sortBy) {
            case 'year':
            case 'pointsFor':
            case 'pointsAgainst':
            case 'luckRating':
            case 'adjustedDPR':
            case 'allPlayWinPercentage':
                valA = a[sortBy];
                valB = b[sortBy];
                break;
            case 'record': // Sort by win percentage for record
                valA = (a.wins + 0.5 * a.ties) / (a.wins + a.losses + a.ties);
                valB = (b.wins + 0.5 * b.ties) / (b.wins + b.losses + b.ties);
                // Handle division by zero for games played
                valA = isNaN(valA) ? -Infinity : valA;
                valB = isNaN(valB) ? -Infinity : valB;
                break;
            case 'finish':
            case 'pointsFinish':
                valA = parseRankForSort(a[sortBy]);
                valB = parseRankForSort(b[sortBy]);
                break;
            default:
                // Fallback to year if sortBy is unrecognized
                valA = a.year;
                valB = b.year;
        }

        if (valA < valB) {
            return sortOrder === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortOrder === 'asc' ? 1 : -1;
        }
        return 0;
    });
  }, [teamSeasonHistory, sortBy, sortOrder]);

  // Function to handle sort column click
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc'); // Default to ascending for new sort column
    }
  };


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
        {teamName}
        <span className="block text-lg font-medium text-gray-600 mt-2">
          Record: {teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies} | Career DPR: {formatDPR(teamOverallStats.avgDPR)}
            {/* Display trophy and medal icons based on accumulated totals */}
            <div className="flex justify-center items-center gap-2 whitespace-nowrap mt-1">
                {teamOverallStats.totalChampionships > 0 && (
                  <span title={`Sween Bowl Champion (${teamOverallStats.totalChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      <i className="fas fa-trophy text-yellow-500 text-2xl"></i> {/* Made icons larger */}
                      <span className="text-xs font-medium">{teamOverallStats.totalChampionships}x</span>
                  </span>
                )}
                {teamOverallStats.totalRunnerUps > 0 && (
                  <span title={`Sween Bowl Runner-Up (${teamOverallStats.totalRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      <i className="fas fa-trophy text-gray-400 text-2xl"></i> {/* Made icons larger */}
                      <span className="text-xs font-medium">{teamOverallStats.totalRunnerUps}x</span>
                  </span>
                )}
                {teamOverallStats.totalThirdPlaces > 0 && (
                  <span title={`3rd Place Finish (${teamOverallStats.totalThirdPlaces}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      <i className="fas fa-trophy text-amber-800 text-2xl"></i> {/* Made icons larger */}
                      <span className="text-xs font-medium">{teamOverallStats.totalThirdPlaces}x</span>
                  </span>
                )}
                {teamOverallStats.totalPointsChampionships > 0 && (
                  <span title={`1st Place - Points (${teamOverallStats.totalPointsChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      {/* Corrected color to yellow-500 for gold medal */}
                      <i className="fas fa-medal text-yellow-500 text-2xl"></i>
                      <span className="text-xs font-medium">{teamOverallStats.totalPointsChampionships}x</span>
                  </span>
                )}
                {teamOverallStats.totalPointsRunnerUps > 0 && (
                  <span title={`2nd Place - Points (${teamOverallStats.totalPointsRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      <i className="fas fa-medal text-gray-400 text-2xl"></i> {/* Made icons larger */}
                      <span className="text-xs font-medium">{teamOverallStats.totalPointsRunnerUps}x</span>
                  </span>
                )}
                {teamOverallStats.totalThirdPlacePoints > 0 && (
                  <span title={`3rd Place - Points (${teamOverallStats.totalThirdPlacePoints}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                      <i className="fas fa-medal text-amber-800 text-2xl"></i> {/* Made icons larger */}
                      <span className="text-xs font-medium">{teamOverallStats.totalThirdPlacePoints}x</span>
                  </span>
                )}
            </div>
        </span>
      </h2>

      {/* Overall Stats */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">League Ranks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"> {/* Updated grid for desktop */}
          <StatCard title="Total Wins" value={teamOverallStats.totalWins} rank={teamOverallStats.winRank} />
          <StatCard title="Win %" value={formatPercentage((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed)} rank={teamOverallStats.winPercentageRank} />
          <StatCard title="Total Points" value={formatScore(teamOverallStats.totalPointsFor)} rank={teamOverallStats.pointsForRank} />
          <StatCard
            title="Weekly Top Scores"
            value={
              teamOverallStats.overallTopScoreWeeksCount !== undefined
                ? `${teamOverallStats.overallTopScoreWeeksCount}`
                : 'N/A'
            }
            rank={teamOverallStats.topScoreWeeksRank}
          />
          <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearancesCount} rank={teamOverallStats.playoffRank} />
          <StatCard title="Championships" value={teamOverallStats.totalChampionships} rank={teamOverallStats.championshipRank} />
          {/* Removed the 'Total Luck Rating' StatCard */}
        </div>
      </section>

      {/* Season by Season History Table */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season History</h3>
        {teamSeasonHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('year')}>
                    Year {sortBy === 'year' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('record')}>
                    Record (W-L-T) {sortBy === 'record' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsFor')}>
                    Points For {sortBy === 'pointsFor' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-red-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsAgainst')}>
                    Points Against {sortBy === 'pointsAgainst' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('luckRating')}>
                    Luck Rating {sortBy === 'luckRating' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-purple-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('finish')}>
                    Finish {sortBy === 'finish' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('pointsFinish')}>
                    Points Finish {sortBy === 'pointsFinish' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('adjustedDPR')}>
                    Adjusted DPR {sortBy === 'adjustedDPR' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="py-2 px-3 text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200 text-center cursor-pointer" onClick={() => handleSort('allPlayWinPercentage')}>
                    All-Play Win % {sortBy === 'allPlayWinPercentage' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasonHistory.map((season, index) => (
                  <tr key={season.year} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-3 text-sm text-gray-800 text-center">{season.year}</td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-center">{season.wins}-{season.losses}-{season.ties}</td>
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
          <p className="text-gray-600">No season-by-season data available for {teamName} for completed seasons.</p>
        )}
      </section>
    </div>
  );
};

// Simple Stat Card Component (reused from PowerRankings or other places)
const StatCard = ({ title, value, rank }) => ( // Added rank prop
  <div className="bg-blue-50 p-2 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200">
    {rank && rank !== 'N/A' && <p className="text-2xl font-bold text-blue-700">{rank}</p>} {/* Larger font for rank */}
    {/* Changed text-blue-800 to text-gray-600 for consistency */}
    <p className="text-sm font-semibold text-gray-600">
      {title} (<span className="font-semibold text-gray-600">{value}</span>)
    </p>
  </div>
);

export default TeamDetailPage;
