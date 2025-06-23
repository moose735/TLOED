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

    // Get the current year to include it in "completed or current seasons"
    const currentYear = new Date().getFullYear();

    // Modified to include the current season in overall career calculations and display
    const completedOrCurrentSeasons = new Set();
    historicalMatchups.forEach(match => {
        const year = parseInt(match.year);
        if (!isNaN(year)) {
            // A season is considered "completed or current" if it has a final seeding game OR if it is the current year
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
        let careerRunnerUps = 0; // Initialize
        let careerThirdPlaces = 0; // Initialize
        let careerPointsChampionships = 0; // Initialize
        let careerPointsRunnerUps = 0; // Initialize
        let careerThirdPlacePoints = 0; // Initialize
        let careerPlayoffAppearancesCount = 0; // Sum of seasons with playoff appearances
        let careerTopScoreWeeks = 0;
        let careerTotalDPRSum = 0;
        let careerSeasonsWithDPRData = 0;
        let careerTotalLuckRating = 0; // New: Sum of luck ratings

        // Iterate through all seasons to gather career data for this 'team'
        Object.keys(seasonalMetrics).forEach(year => {
            const teamMetrics = seasonalMetrics[year]?.[team];
            if (teamMetrics && completedOrCurrentSeasons.has(parseInt(year))) { // Use completedOrCurrentSeasons
                totalWins += teamMetrics.wins;
                totalLosses += teamMetrics.losses;
                totalTies += teamMetrics.ties;
                totalPointsFor += teamMetrics.pointsFor;
                totalGamesPlayed += teamMetrics.totalGames;

                if (teamMetrics.isChampion) careerChampionships++;
                if (teamMetrics.isRunnerUp) careerRunnerUps++; // Increment
                if (teamMetrics.isThirdPlace) careerThirdPlaces++; // Increment
                if (teamMetrics.isPointsChampion) careerPointsChampionships++; // Increment
                if (teamMetrics.isPointsRunnerUp) careerPointsRunnerUps++; // Increment
                if (teamMetrics.isThirdPlacePoints) careerThirdPlacePoints++; // Increment

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
            runnerUps: careerRunnerUps,
            thirdPlaces: careerThirdPlaces,
            pointsChampionships: careerPointsChampionships,
            pointsRunnerUps: careerPointsRunnerUps,
            thirdPlacePoints: careerThirdPlacePoints,
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
        overallStats.totalRunnerUps = selectedTeamCareerStats.runnerUps; // Set
        overallStats.totalThirdPlaces = selectedTeamCareerStats.thirdPlaces; // Set
        overallStats.totalPointsChampionships = selectedTeamCareerStats.pointsChampionships; // Set
        overallStats.totalPointsRunnerUps = selectedTeamCareerStats.pointsRunnerUps; // Set
        overallStats.totalThirdPlacePoints = selectedTeamCareerStats.thirdPlacePoints; // Set
        overallStats.playoffAppearancesCount = selectedTeamCareerStats.playoffAppearancesCount;
        overallStats.totalLuckRating = selectedTeamCareerStats.totalLuckRating; // Set total luck rating

        const allWins = Object.values(allTeamsAggregatedStats).map(t => t.wins);
        const allWinPercentages = Object.values(allTeamsAggregatedStats).map(t => t.winPercentage);
        const allPointsFor = Object.values(allTeamsAggregatedStats).map(t => t.pointsFor);
        const allTopScoreWeeks = Object.values(allTeamsAggregatedStats).map(t => t.topScoreWeeksCount);
        const allPlayoffAppearances = Object.values(allTeamsAggregatedStats).map(t => t.playoffAppearancesCount);
        const allChampionships = Object.values(allTeamsAggregatedStats).map(t => t.championships);
        const allRunnerUps = Object.values(allTeamsAggregatedStats).map(t => t.runnerUps); // For rank
        const allThirdPlaces = Object.values(allTeamsAggregatedStats).map(t => t.thirdPlaces); // For rank
        const allPointsChampionships = Object.values(allTeamsAggregatedStats).map(t => t.pointsChampionships); // For rank
        const allPointsRunnerUps = Object.values(allTeamsAggregatedStats).map(t => t.pointsRunnerUps); // For rank
        const allThirdPlacePoints = Object.values(allTeamsAggregatedStats).map(t => t.thirdPlacePoints); // For rank
        const allTotalLuckRatings = Object.values(allTeamsAggregatedStats).map(t => t.totalLuckRating); // Get all luck ratings

        overallStats.winRank = calculateRank(selectedTeamCareerStats.wins, allWins);
        overallStats.winPercentageRank = calculateRank(selectedTeamCareerStats.winPercentage, allWinPercentages);
        overallStats.pointsForRank = calculateRank(selectedTeamCareerStats.pointsFor, allPointsFor);
        overallStats.topScoreWeeksRank = calculateRank(selectedTeamCareerStats.topScoreWeeksCount, allTopScoreWeeks);
        overallStats.playoffRank = calculateRank(selectedTeamCareerStats.playoffAppearancesCount, allPlayoffAppearances);
        overallStats.championshipRank = calculateRank(selectedTeamCareerStats.championships, allChampionships);
        overallStats.runnerUpRank = calculateRank(selectedTeamCareerStats.runnerUps, allRunnerUps); // Calculate
        overallStats.thirdPlaceRank = calculateRank(selectedTeamCareerStats.thirdPlaces, allThirdPlaces); // Calculate
        overallStats.pointsChampionshipRank = calculateRank(selectedTeamCareerStats.pointsChampionships, allPointsChampionships); // Calculate
        overallStats.pointsRunnerUpRank = calculateRank(selectedTeamCareerStats.pointsRunnerUps, allPointsRunnerUps); // Calculate
        overallStats.thirdPlacePointsRank = calculateRank(selectedTeamCareerStats.thirdPlacePoints, allThirdPlacePoints); // Calculate
        overallStats.luckRank = calculateRank(selectedTeamCareerStats.totalLuckRating, allTotalLuckRatings); // Calculate luck rank
    }

    // Populate compiledSeasonHistory for display
    Object.keys(seasonalMetrics).sort((a, b) => parseInt(b) - parseInt(a)).forEach(yearStr => {
        const year = parseInt(yearStr);
        const teamMetrics = seasonalMetrics[yearStr]?.[teamName];
        const teamSeasonalData = seasonalData[year]?.[teamName];

        if (teamMetrics && teamSeasonalData && completedOrCurrentSeasons.has(year)) { // Use completedOrCurrentSeasons
            compiledSeasonHistory.push({
                year: year,
                wins: teamMetrics.wins,
                losses: teamMetrics.losses,
                ties: teamMetrics.ties,
                pointsFor: teamMetrics.pointsFor,
                pointsAgainst: teamMetrics.pointsAgainst,
                averageScore: teamMetrics.averageScore,
                winPercentage: teamMetrics.winPercentage,
                allPlayWinPercentage: teamMetrics.allPlayWinPercentage,
                topScoreWeeksCount: teamMetrics.topScoreWeeksCount,
                playoffTeam: teamMetrics.isPlayoffTeam,
                champion: teamMetrics.isChampion,
                runnerUp: teamMetrics.isRunnerUp, // Added
                thirdPlace: teamMetrics.isThirdPlace, // Added
                pointsChampion: teamMetrics.isPointsChampion, // Added
                pointsRunnerUp: teamMetrics.isPointsRunnerUp, // Added
                thirdPlacePoints: teamMetrics.isThirdPlacePoints, // Added
                luckRating: teamMetrics.luckRating,
                adjustedDPR: teamMetrics.adjustedDPR,
                finish: teamMetrics.finish, // Overall league finish
                pointsFinish: teamMetrics.pointsFinish, // Points-based finish
            });
        }
    });

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName]);

  // Helper for sorting season history
  const sortedSeasonHistory = useMemo(() => {
    return [...teamSeasonHistory].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [teamSeasonHistory, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc'); // Default to descending for new sort column
    }
  };

  const renderSortArrow = (column) => {
    if (sortBy === column) {
      return sortOrder === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  if (loadingStats) {
    return <div className="text-center py-8">Loading team data...</div>;
  }

  if (!teamOverallStats) {
    return <div className="text-center py-8 text-gray-600">No data available for {teamName}.</div>;
  }

  // Determine if the current season (2025) is included in the history to show "current season" label
  const isCurrentSeasonPresent = teamSeasonHistory.some(season => season.year === new Date().getFullYear());


  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-4xl font-extrabold text-blue-800 mb-6 text-center">{teamName}</h1>

      {/* Overall Career Statistics Section */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-md border border-blue-200">
        <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">Career Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Overall Record (W-L-T)" value={`${teamOverallStats.totalWins}-${teamOverallStats.totalLosses}-${teamOverallStats.totalTies}`} />
          <StatCard title="Win Percentage" value={formatPercentage(teamOverallStats.totalGamesPlayed > 0 ? ((teamOverallStats.totalWins + 0.5 * teamOverallStats.totalTies) / teamOverallStats.totalGamesPlayed) : 0)} rank={teamOverallStats.winPercentageRank} />
          <StatCard title="Total Points For" value={formatScore(teamOverallStats.totalPointsFor)} rank={teamOverallStats.pointsForRank} />
          <StatCard title="Average DPR" value={formatDPR(teamOverallStats.avgDPR)} />
          <StatCard title="Total Top Score Weeks" value={teamOverallStats.overallTopScoreWeeksCount} rank={teamOverallStats.topScoreWeeksRank} />
          <StatCard title="Playoff Appearances" value={teamOverallStats.playoffAppearancesCount} rank={teamOverallStats.playoffRank} />
          <StatCard title="Championships" value={teamOverallStats.totalChampionships} rank={teamOverallStats.championshipRank} />
          <StatCard title="Runner Ups" value={teamOverallStats.totalRunnerUps} rank={teamOverallStats.runnerUpRank} />
          <StatCard title="Third Place Finishes" value={teamOverallStats.totalThirdPlaces} rank={teamOverallStats.thirdPlaceRank} />
          <StatCard title="Points Championships" value={teamOverallStats.totalPointsChampionships} rank={teamOverallStats.pointsChampionshipRank} />
          <StatCard title="Points Runner Ups" value={teamOverallStats.totalPointsRunnerUps} rank={teamOverallStats.pointsRunnerUpRank} />
          <StatCard title="Third Place (Points)" value={teamOverallStats.totalThirdPlacePoints} rank={teamOverallStats.thirdPlacePointsRank} />
          <StatCard title="Total Luck Rating" value={formatLuckRating(teamOverallStats.totalLuckRating)} rank={teamOverallStats.luckRank} />
        </div>
      </section>

      {/* Season-by-Season History Section */}
      <section className="mb-8 p-6 bg-white rounded-lg shadow-md border border-blue-200">
        <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">Season-by-Season History</h2>
        {sortedSeasonHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300 rounded-lg">
              <thead>
                <tr className="bg-blue-100 text-blue-800 uppercase text-sm leading-normal">
                  <th className="py-3 px-3 text-left cursor-pointer" onClick={() => handleSort('year')}>Season{renderSortArrow('year')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('wins')}>W{renderSortArrow('wins')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('losses')}>L{renderSortArrow('losses')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('ties')}>T{renderSortArrow('ties')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('pointsFor')}>PF{renderSortArrow('pointsFor')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('pointsAgainst')}>PA{renderSortArrow('pointsAgainst')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('averageScore')}>Avg Score{renderSortArrow('averageScore')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('winPercentage')}>Win%{renderSortArrow('winPercentage')}</th>
                  <th className="py-3 px-3 text-center">Playoffs</th>
                  <th className="py-3 px-3 text-center">Champ</th>
                  <th className="py-3 px-3 text-center">Runner Up</th>
                  <th className="py-3 px-3 text-center">3rd Place</th>
                  <th className="py-3 px-3 text-center">Points Champ</th>
                  <th className="py-3 px-3 text-center">Points Runner Up</th>
                  <th className="py-3 px-3 text-center">3rd Place Pts</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('topScoreWeeksCount')}>Top Score Weeks{renderSortArrow('topScoreWeeksCount')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('luckRating')}>Luck Rating{renderSortArrow('luckRating')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('finish')}>Finish{renderSortArrow('finish')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('pointsFinish')}>Points Finish{renderSortArrow('pointsFinish')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('adjustedDPR')}>Adjusted DPR{renderSortArrow('adjustedDPR')}</th>
                  <th className="py-3 px-3 text-center cursor-pointer" onClick={() => handleSort('allPlayWinPercentage')}>All-Play W%{renderSortArrow('allPlayWinPercentage')}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {sortedSeasonHistory.map((season) => (
                  <tr key={season.year} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm text-gray-700 font-medium whitespace-nowrap">
                        {season.year} {season.year === new Date().getFullYear() && isCurrentSeasonPresent && '(Current)'} {/* Label current season */}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.wins}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.losses}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.ties}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsFor)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.pointsAgainst)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatScore(season.averageScore)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{formatPercentage(season.winPercentage)}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.playoffTeam ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.champion ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.runnerUp ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.thirdPlace ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.pointsChampion ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.pointsRunnerUp ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.thirdPlacePoints ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">{season.topScoreWeeksCount}</td>
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
    {/* Changed text-blue-800 to text-gray-600 because ranks are informational, not primary values */}
    <p className="text-gray-600 text-sm">{title}</p>
    {value !== undefined && value !== null && value !== '' && <p className="text-xl font-semibold text-blue-800 mt-1">{value}</p>}
  </div>
);

export default TeamDetailPage;
