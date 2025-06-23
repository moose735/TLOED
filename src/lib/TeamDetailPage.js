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

    const overallStats = {
      totalWins: 0, totalLosses: 0, totalTies: 0, totalPointsFor: 0, totalGamesPlayed: 0,
      overallTopScoreWeeksCount: 0, playoffAppearancesCount: 0, avgDPR: 0, totalDPRSum: 0,
      seasonsWithDPRData: 0, totalLuckRating: 0, totalChampionships: 0, totalRunnerUps: 0,
      totalThirdPlaces: 0, totalPointsChampionships: 0, totalPointsRunnerUps: 0,
      totalThirdPlacePoints: 0, winRank: 'N/A', winPercentageRank: 'N/A', pointsForRank: 'N/A',
      topScoreWeeksRank: 'N/A', playoffRank: 'N/A', championshipRank: 'N/A', luckRank: 'N/A'
    };

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

    Object.keys(seasonalData).sort().forEach(yearStr => {
      const year = parseInt(yearStr);
      const stats = seasonalData[year][teamName];
      const m = seasonalMetrics[year]?.[teamName];

      if (stats && m && completedSeasons.has(year)) {
        const totalGames = stats.wins + stats.losses + stats.ties;
        const winPct = totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / totalGames) : 0;
        const isSeasonFinished = m.isChampion || m.isRunnerUp || m.isThirdPlace;

        compiledSeasonHistory.push({
          year,
          team: teamName,
          wins: stats.wins,
          losses: stats.losses,
          ties: stats.ties,
          pointsFor: stats.pointsFor,
          pointsAgainst: stats.pointsAgainst,
          luckRating: m.luckRating,
          adjustedDPR: m.adjustedDPR,
          allPlayWinPercentage: m.allPlayWinPercentage,
          winPercentage: winPct,
          finish: isSeasonFinished && m.rank ? `${m.rank}${getOrdinalSuffix(m.rank)}` : 'N/A',
          pointsFinish: isSeasonFinished && m.pointsRank ? `${m.pointsRank}${getOrdinalSuffix(m.pointsRank)}` : 'N/A'
        });
      }
    });

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(compiledSeasonHistory);
    setLoadingStats(false);
  }, [teamName, historicalMatchups, getMappedTeamName]);

  return null; // render logic assumed elsewhere
};

export default TeamDetailPage;
