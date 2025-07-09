// src/lib/TeamDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

const calculateRank = (value, allValues, isHigherBetter = true) => {
  if (value === null || typeof value === 'undefined' || isNaN(value)) return 'N/A';
  const numericValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));
  if (numericValues.length === 0) return 'N/A';
  const uniqueSortedValues = [...new Set(numericValues)].sort((a, b) => isHigherBetter ? b - a : a - b);
  let rank = 1;
  for (let i = 0; i < uniqueSortedValues.length; i++) {
    const currentUniqueValue = uniqueSortedValues[i];
    if (currentUniqueValue === value) {
      const tieCount = numericValues.filter(v => v === value).length;
      return tieCount > 1 ? `T-${rank}${getOrdinalSuffix(rank)}` : `${rank}${getOrdinalSuffix(rank)}`;
    }
    rank += numericValues.filter(v => v === currentUniqueValue).length;
  }
  return 'N/A';
};

const formatScore = (score) =>
  typeof score === 'number' ? score.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
const formatPercentage = (value) =>
  typeof value === 'number' ? `${(value).toFixed(3).substring(1)}%` : 'N/A';
const formatLuckRating = (value) =>
  typeof value === 'number' ? value.toFixed(3) : 'N/A';
const formatDPR = (value) =>
  typeof value === 'number' ? value.toFixed(3) : 'N/A';

const TeamDetailPage = ({ teamName }) => { // Removed historicalMatchups and getMappedTeamName from props
  const {
    loading: contextLoading,
    error: contextError,
    historicalData, // Full historical data object from context
    allDraftHistory, // All draft history from context
    getTeamName: getTeamNameFromContext // Renamed to avoid conflict
  } = useSleeperData();

  const [teamOverallStats, setTeamOverallStats] = useState(null);
  const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sortBy, setSortBy] = useState('year');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    // Ensure teamName is always treated as a string for consistency
    const currentTeamName = String(teamName || '');

    if (contextLoading || contextError || !historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
      setLoadingStats(false);
      return;
    }

    // Ensure getTeamNameFromContext is a function
    if (typeof getTeamNameFromContext !== 'function') {
      console.error("TeamDetailPage: getTeamNameFromContext is not a function. Cannot process data.");
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    // Call calculateAllLeagueMetrics with the full historicalData object and allDraftHistory
    const { seasonalMetrics, careerDPRData: calculatedCareerDPRs } = calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameFromContext);

    // Find the ownerId for the current teamName
    let currentTeamOwnerId = null;
    const teamCareerStats = calculatedCareerDPRs.find(dpr => getTeamNameFromContext(dpr.ownerId, null) === currentTeamName);
    if (teamCareerStats) {
      currentTeamOwnerId = teamCareerStats.ownerId;
    }

    if (!currentTeamOwnerId) {
      console.warn(`TeamDetailPage: Could not find ownerId for teamName: ${currentTeamName}. Displaying no data.`);
      setLoadingStats(false);
      setTeamOverallStats(null);
      setTeamSeasonHistory([]);
      return;
    }

    const overallStats = {
      totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGamesPlayed: 0,
      overallTopScoreWeeksCount: 0, playoffAppearancesCount: 0, avgDPR: 0,
      totalChampionships: 0, totalRunnerUps: 0, totalThirdPlaces: 0,
      totalPointsChampionships: 0, totalPointsRunnerUps: 0, totalThirdPlacePoints: 0,
      winRank: 'N/A', winPercentageRank: 'N/A', pointsForRank: 'N/A',
      topScoreWeeksRank: 'N/A', playoffRank: 'N/A', championshipRank: 'N/A', luckRank: 'N/A',
      ownerId: currentTeamOwnerId
    };

    const compiledSeasonHistory = [];
    const allTeamsAggregatedStats = {}; // To hold aggregated stats for all teams for ranking purposes

    const allYears = Object.keys(historicalData.matchupsBySeason).map(Number).sort((a, b) => a - b);
    const latestSeason = allYears.length > 0 ? Math.max(...allYears) : null;

    // First, aggregate stats for ALL teams from seasonalMetrics for overall ranks
    Object.keys(seasonalMetrics).forEach(yearStr => {
      const year = parseInt(yearStr);
      const seasonalStatsForYear = seasonalMetrics[year];
      if (seasonalStatsForYear) {
        Object.values(seasonalStatsForYear).forEach(teamSeasonalData => {
          const ownerId = teamSeasonalData.ownerId;
          const teamDisplayName = getTeamNameFromContext(ownerId, null); // Use current name for overall aggregation

          if (!teamDisplayName || teamDisplayName.startsWith('Unknown Team (ID:')) {
            return; // Skip if team name cannot be resolved
          }

          if (!allTeamsAggregatedStats[teamDisplayName]) {
            allTeamsAggregatedStats[teamDisplayName] = {
              wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGamesPlayed: 0,
              championships: 0, runnerUps: 0, thirdPlaces: 0,
              firstPoints: 0, secondPoints: 0, thirdPoints: 0,
              topScoreWeeksCount: 0, playoffAppearancesCount: 0,
              totalLuckRating: 0, totalDPRSum: 0, seasonsWithDPRData: 0,
              ownerId: ownerId
            };
          }

          const stats = allTeamsAggregatedStats[teamDisplayName];
          stats.wins += teamSeasonalData.wins;
          stats.losses += teamSeasonalData.losses;
          stats.ties += teamSeasonalData.ties;
          stats.pointsFor += teamSeasonalData.pointsFor;
          stats.totalGamesPlayed += teamSeasonalData.totalGames;
          stats.topScoreWeeksCount += (teamSeasonalData.topScoreWeeksCount || 0);
          stats.totalLuckRating += (teamSeasonalData.luckRating || 0);

          if (teamSeasonalData.adjustedDPR !== undefined && teamSeasonalData.adjustedDPR !== null) {
            stats.totalDPRSum += teamSeasonalData.adjustedDPR;
            stats.seasonsWithDPRData++;
          }

          if (teamSeasonalData.isPlayoffTeam) stats.playoffAppearancesCount++;
          if (teamSeasonalData.isChampion) stats.championships++;
          if (teamSeasonalData.isRunnerUp) stats.runnerUps++;
          if (teamSeasonalData.isThirdPlace) stats.thirdPlaces++;
          if (teamSeasonalData.isPointsChampion) stats.firstPoints++;
          if (teamSeasonalData.isPointsRunnerUp) stats.secondPoints++;
          if (teamSeasonalData.isThirdPlacePoints) stats.thirdPoints++;
        });
      }
    });

    // Now, populate overallStats for the specific `teamName`
    const currentTeamAggregatedStats = allTeamsAggregatedStats[currentTeamName];

    if (currentTeamAggregatedStats) {
      Object.assign(overallStats, {
        totalWins: currentTeamAggregatedStats.wins,
        totalLosses: currentTeamAggregatedStats.losses,
        totalTies: currentTeamAggregatedStats.ties,
        totalPointsFor: currentTeamAggregatedStats.pointsFor,
        totalGamesPlayed: currentTeamAggregatedStats.totalGamesPlayed,
        overallTopScoreWeeksCount: currentTeamAggregatedStats.topScoreWeeksCount,
        playoffAppearancesCount: currentTeamAggregatedStats.playoffAppearancesCount,
        avgDPR: currentTeamAggregatedStats.seasonsWithDPRData > 0 ? currentTeamAggregatedStats.totalDPRSum / currentTeamAggregatedStats.seasonsWithDPRData : 0,
        totalChampionships: currentTeamAggregatedStats.championships,
        totalRunnerUps: currentTeamAggregatedStats.runnerUps,
        totalThirdPlaces: currentTeamAggregatedStats.thirdPlaces,
        totalPointsChampionships: currentTeamAggregatedStats.firstPoints,
        totalPointsRunnerUps: currentTeamAggregatedStats.secondPoints,
        totalThirdPlacePoints: currentTeamAggregatedStats.thirdPoints,
        luckRating: currentTeamAggregatedStats.totalLuckRating, // This is the sum, not average.
      });

      // Calculate ranks based on allTeamsAggregatedStats
      const allWins = Object.values(allTeamsAggregatedStats).map(s => s.wins);
      const allWinPercentages = Object.values(allTeamsAggregatedStats).map(s => (s.wins + 0.5 * s.ties) / s.totalGamesPlayed);
      const allPointsFor = Object.values(allTeamsAggregatedStats).map(s => s.pointsFor);
      const allTopScoreWeeks = Object.values(allTeamsAggregatedStats).map(s => s.topScoreWeeksCount);
      const allPlayoffAppearances = Object.values(allTeamsAggregatedStats).map(s => s.playoffAppearancesCount);
      const allChampionships = Object.values(allTeamsAggregatedStats).map(s => s.championships);
      const allLuckRatings = Object.values(allTeamsAggregatedStats).map(s => s.totalLuckRating);

      overallStats.winRank = calculateRank(overallStats.totalWins, allWins);
      overallStats.winPercentageRank = calculateRank((overallStats.totalWins + 0.5 * overallStats.totalTies) / overallStats.totalGamesPlayed, allWinPercentages);
      overallStats.pointsForRank = calculateRank(overallStats.totalPointsFor, allPointsFor);
      overallStats.topScoreWeeksRank = calculateRank(overallStats.overallTopScoreWeeksCount, allTopScoreWeeks);
      overallStats.playoffRank = calculateRank(overallStats.playoffAppearancesCount, allPlayoffAppearances);
      overallStats.championshipRank = calculateRank(overallStats.totalChampionships, allChampionships);
      overallStats.luckRank = calculateRank(overallStats.luckRating, allLuckRatings, false); // Lower luck rating is better

    } else {
      // If the current teamName is not found in aggregated stats, it means no data for it.
      setLoadingStats(false);
      setTeamOverallStats(null);
      setTeamSeasonHistory([]);
      return;
    }


    // Populate compiledSeasonHistory for the specific `teamName`
    allYears.forEach(year => {
      const seasonalStatsForYear = seasonalMetrics[year];
      if (seasonalStatsForYear) {
        const teamSeasonalData = Object.values(seasonalStatsForYear).find(s => s.ownerId === currentTeamOwnerId);

        if (teamSeasonalData && teamSeasonalData.totalGames > 0) {
          // Ensure team name is resolved for this specific year for display in the table
          const displayTeamNameForSeason = getTeamNameFromContext(currentTeamOwnerId, year);

          compiledSeasonHistory.push({
            year,
            team: displayTeamNameForSeason,
            wins: teamSeasonalData.wins,
            losses: teamSeasonalData.losses,
            ties: teamSeasonalData.ties,
            pointsFor: teamSeasonalData.pointsFor,
            pointsAgainst: teamSeasonalData.pointsAgainst,
            luckRating: teamSeasonalData.luckRating,
            adjustedDPR: teamSeasonalData.adjustedDPR,
            allPlayWinPercentage: teamSeasonalData.allPlayWinPercentage,
            winPercentage: teamSeasonalData.winPercentage,
            // Display N/A for finish and points finish if it's the current/latest season
            finish: (year === latestSeason) ? 'N/A' : (teamSeasonalData.rank ? `${teamSeasonalData.rank}${getOrdinalSuffix(teamSeasonalData.rank)}` : 'N/A'),
            pointsFinish: (year === latestSeason) ? 'N/A' : (teamSeasonalData.pointsRank ? `${teamSeasonalData.pointsRank}${getOrdinalSuffix(teamSeasonalData.pointsRank)}` : 'N/A')
          });
        }
      }
    });

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setLoadingStats(false);

  }, [teamName, historicalData, allDraftHistory, getTeamNameFromContext, contextLoading, contextError]); // Dependencies updated

  const sortedSeasonHistory = useMemo(() => {
    const sortable = [...teamSeasonHistory];
    const parseRank = (r) => r === 'N/A' ? Infinity : parseInt(r.replace(/^T-/, '').match(/\d+/)?.[0] || '0');
    return sortable.sort((a, b) => {
      const valA = sortBy === 'record'
        ? (a.wins + 0.5 * a.ties) / (a.wins + a.losses + a.ties)
        : sortBy === 'finish' || sortBy === 'pointsFinish'
        ? parseRank(a[sortBy])
        : a[sortBy];
      const valB = sortBy === 'record'
        ? (b.wins + 0.5 * b.ties) / (b.wins + b.losses + b.ties)
        : (sortBy === 'finish' || sortBy === 'pointsFinish' // FIXED: Added parentheses for correct ternary nesting
          ? parseRank(b[sortBy])
          : b[sortBy]);
      return (valA < valB ? -1 : valA > valB ? 1 : 0) * (sortOrder === 'asc' ? 1 : -1);
    });
  }, [teamSeasonHistory, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortOrder('asc'); }
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
        {teamName}
        <span className="block text-lg font-medium text-gray-600 mt-2">
          Record: {teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies} | Career DPR: {formatDPR(teamOverallStats.avgDPR)}
          <div className="flex justify-center items-center gap-2 whitespace-nowrap mt-1">
            {teamOverallStats.totalChampionships > 0 && (
              <span title={`Sween Bowl Champion (${teamOverallStats.totalChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-trophy text-yellow-500 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalChampionships}x</span>
              </span>
            )}
            {teamOverallStats.totalRunnerUps > 0 && (
              <span title={`Sween Bowl Runner-Up (${teamOverallStats.totalRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-trophy text-gray-400 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalRunnerUps}x</span>
              </span>
            )}
            {teamOverallStats.totalThirdPlaces > 0 && (
              <span title={`3rd Place Finish (${teamOverallStats.totalThirdPlaces}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-trophy text-amber-800 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalThirdPlaces}x</span>
              </span>
            )}
            {teamOverallStats.totalPointsChampionships > 0 && (
              <span title={`1st Place - Points (${teamOverallStats.totalPointsChampionships}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-medal text-yellow-500 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalPointsChampionships}x</span>
              </span>
            )}
            {teamOverallStats.totalPointsRunnerUps > 0 && (
              <span title={`2nd Place - Points (${teamOverallStats.totalPointsRunnerUps}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-medal text-gray-400 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalPointsRunnerUps}x</span>
              </span>
            )}
            {teamOverallStats.totalThirdPlacePoints > 0 && (
              <span title={`3rd Place - Points (${teamOverallStats.totalThirdPlacePoints}x)`} className="flex items-center space-x-1 whitespace-nowrap">
                <i className="fas fa-medal text-amber-800 text-2xl"></i>
                <span className="text-xs font-medium">{teamOverallStats.totalThirdPlacePoints}x</span>
              </span>
            )}
          </div>
        </span>
      </h2>

      {/* Overall Stats */}
      <section className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">League Ranks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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

const StatCard = ({ title, value, rank }) => (
  <div className="bg-blue-50 p-2 rounded-lg shadow-sm flex flex-col items-center justify-center text-center border border-blue-200">
    {rank && rank !== 'N/A' && <p className="text-2xl font-bold text-blue-700">{rank}</p>}
    <p className="text-sm font-semibold text-gray-600">
      {title} (<span className="font-semibold text-gray-600">{value}</span>)
    </p>
  </div>
);

export default TeamDetailPage;
