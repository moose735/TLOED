// src/lib/TeamDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations';

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

const TeamDetailPage = ({ teamName, historicalMatchups, getMappedTeamName }) => {
  const [teamOverallStats, setTeamOverallStats] = useState(null);
  const [teamSeasonHistory, setTeamSeasonHistory] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sortBy, setSortBy] = useState('year');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (!teamName || !historicalMatchups?.length) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    const overallStats = { /* same as your base object */ totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGamesPlayed: 0, overallTopScoreWeeksCount: 0, playoffAppearancesCount: 0, avgDPR: 0, totalDPRSum: 0, seasonsWithDPRData: 0, totalLuckRating: 0, totalChampionships: 0, totalRunnerUps: 0, totalThirdPlaces: 0, totalPointsChampionships: 0, totalPointsRunnerUps: 0, totalThirdPlacePoints: 0, winRank: 'N/A', winPercentageRank: 'N/A', pointsForRank: 'N/A', topScoreWeeksRank: 'N/A', playoffRank: 'N/A', championshipRank: 'N/A', luckRank: 'N/A' };

    const seasonalData = {};
const completedSeasons = new Set();
historicalMatchups.forEach(match => {
  const year = parseInt(match.year);
  const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
  const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());

  if (!isNaN(year) && (displayTeam1 === teamName || displayTeam2 === teamName)) {
    completedSeasons.add(year);
  }
});


    const latestSeason = completedSeasons.size > 0 ? Math.max(...completedSeasons) : null;

    historicalMatchups.forEach(match => {
      const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
      const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!displayTeam1 || !displayTeam2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 !== teamName && displayTeam2 !== teamName)) return;

      if (!seasonalData[year]) seasonalData[year] = {};
      if (!seasonalData[year][teamName]) seasonalData[year][teamName] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, luckRating: 0, adjustedDPR: 0, allPlayWinPercentage: 0, gamesPlayed: 0, weeklyScores: [] };

      const teamIsTeam1 = displayTeam1 === teamName;
      const currentTeamScore = teamIsTeam1 ? team1Score : team2Score;
      const opponentScore = teamIsTeam1 ? team2Score : team1Score;
      const isTie = team1Score === team2Score;

      if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
        overallStats.totalGamesPlayed++;
        seasonalData[year][teamName].gamesPlayed++;
        seasonalData[year][teamName].weeklyScores.push(currentTeamScore);
        if (isTie) {
          overallStats.totalTies++;
          seasonalData[year][teamName].ties++;
        } else if ((teamIsTeam1 && team1Score > team2Score) || (!teamIsTeam1 && team2Score > team1Score)) {
          overallStats.totalWins++;
          seasonalData[year][teamName].wins++;
        } else {
          overallStats.totalLosses++;
          seasonalData[year][teamName].losses++;
        }
      }

      overallStats.totalPointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsFor += currentTeamScore;
      seasonalData[year][teamName].pointsAgainst += opponentScore;
    });

    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);

    const compiledSeasonHistory = [];
    const allTeamsAggregatedStats = {};
    const allUniqueTeams = new Set(historicalMatchups.flatMap(match => [getMappedTeamName(String(match.team1 || '').trim()), getMappedTeamName(String(match.team2 || '').trim())]));

    allUniqueTeams.forEach(team => {
      if (!team) return;
      let stats = { wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGamesPlayed: 0, championships: 0, playoffAppearancesCount: 0, topScoreWeeksCount: 0, totalLuckRating: 0, avgDPR: 0, totalDPRSum: 0, seasonsWithDPRData: 0 };

      Object.keys(seasonalMetrics).forEach(year => {
        const m = seasonalMetrics[year]?.[team];
        if (m && completedSeasons.has(parseInt(year))) {
          stats.wins += m.wins;
          stats.losses += m.losses;
          stats.ties += m.ties;
          stats.pointsFor += m.pointsFor;
          stats.totalGamesPlayed += m.totalGames;
          if (m.isChampion) stats.championships++;
          if (m.isPlayoffTeam) stats.playoffAppearancesCount++;
          if (typeof m.topScoreWeeksCount === 'number') stats.topScoreWeeksCount += m.topScoreWeeksCount;
          if (typeof m.luckRating === 'number') stats.totalLuckRating += m.luckRating;
          if (m.adjustedDPR !== 0) {
            stats.totalDPRSum += m.adjustedDPR;
            stats.seasonsWithDPRData++;
          }
        }
      });

      stats.avgDPR = stats.seasonsWithDPRData > 0 ? stats.totalDPRSum / stats.seasonsWithDPRData : 0;
      allTeamsAggregatedStats[team] = stats;
    });

    const teamStats = allTeamsAggregatedStats[teamName];
    if (teamStats) {
      Object.assign(overallStats, {
        totalWins: teamStats.wins,
        totalLosses: teamStats.losses,
        totalTies: teamStats.ties,
        totalPointsFor: teamStats.pointsFor,
        totalGamesPlayed: teamStats.totalGamesPlayed,
        overallTopScoreWeeksCount: teamStats.topScoreWeeksCount,
        avgDPR: teamStats.avgDPR,
        totalChampionships: teamStats.championships,
        playoffAppearancesCount: teamStats.playoffAppearancesCount,
        totalLuckRating: teamStats.totalLuckRating,
        winRank: calculateRank(teamStats.wins, Object.values(allTeamsAggregatedStats).map(t => t.wins)),
        winPercentageRank: calculateRank((teamStats.wins + 0.5 * teamStats.ties) / teamStats.totalGamesPlayed, Object.values(allTeamsAggregatedStats).map(t => (t.wins + 0.5 * t.ties) / t.totalGamesPlayed)),
        pointsForRank: calculateRank(teamStats.pointsFor, Object.values(allTeamsAggregatedStats).map(t => t.pointsFor)),
        topScoreWeeksRank: calculateRank(teamStats.topScoreWeeksCount, Object.values(allTeamsAggregatedStats).map(t => t.topScoreWeeksCount)),
        playoffRank: calculateRank(teamStats.playoffAppearancesCount, Object.values(allTeamsAggregatedStats).map(t => t.playoffAppearancesCount)),
        championshipRank: calculateRank(teamStats.championships, Object.values(allTeamsAggregatedStats).map(t => t.championships)),
        luckRank: calculateRank(teamStats.totalLuckRating, Object.values(allTeamsAggregatedStats).map(t => t.totalLuckRating)),
      });

      Object.keys(seasonalMetrics).forEach(yearStr => {
        const m = seasonalMetrics[yearStr]?.[teamName];
        if (m && completedSeasons.has(parseInt(yearStr))) {
          if (m.isRunnerUp) overallStats.totalRunnerUps++;
          if (m.isThirdPlace) overallStats.totalThirdPlaces++;
          if (m.isPointsChampion) overallStats.totalPointsChampionships++;
          if (m.isPointsRunnerUp) overallStats.totalPointsRunnerUps++;
          if (m.isThirdPlacePoints) overallStats.totalThirdPlacePoints++;
        }
      });
    }

    Object.keys(seasonalData).sort().forEach(yearStr => {
      const year = parseInt(yearStr);
      const stats = seasonalData[year][teamName];
      const m = seasonalMetrics[year]?.[teamName];
      if (stats && m && completedSeasons.has(year)) {
        const totalGames = stats.wins + stats.losses + stats.ties;
        const winPct = totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / totalGames) : 0;
        compiledSeasonHistory.push({
          year, team: teamName, wins: stats.wins, losses: stats.losses, ties: stats.ties,
          pointsFor: stats.pointsFor, pointsAgainst: stats.pointsAgainst, luckRating: m.luckRating,
          adjustedDPR: m.adjustedDPR, allPlayWinPercentage: m.allPlayWinPercentage, winPercentage: winPct,
          finish: m.rank ? `${m.rank}${getOrdinalSuffix(m.rank)}` : 'N/A',
          pointsFinish: m.pointsRank ? `${m.pointsRank}${getOrdinalSuffix(m.pointsRank)}` : 'N/A'
        });
      }
    });

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName]);

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
        : sortBy === 'finish' || sortBy === 'pointsFinish'
        ? parseRank(b[sortBy])
        : b[sortBy];
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
