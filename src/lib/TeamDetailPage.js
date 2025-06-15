// src/lib/TeamDetailPage.js
import React, { useState, useEffect } from 'react';

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
      championships: 0, // This will be calculated from finalSeedingGame = 1
      totalDPR: 0, // Sum of adjusted DPRs across seasons - will become average
      seasonsWithDPR: 0,
      allPlayWinsTotal: 0,
      allPlayLossesTotal: 0,
      allPlayTiesTotal: 0,
      averageAdjustedDPR: 0, // New: Average Adjusted DPR
      // For overall rank calculations
      allTeamsOverallStats: {},
    };

    const seasonHistoryMap = {}; // { year: { team: { wins, losses, ties, pointsFor, pointsAgainst, luckRating, dpr, finish, weeklyScores: [] } } }
    const weeklyGameScoresByYearAndWeek = {}; // { year: { week: [{ team: 'TeamA', score: 100 }, ...] } }
    const allLeagueScoresByYear = {}; // { year: [score1, score2, ...] } for league-wide min/max for DPR

    // Initialize allTeamsOverallStats for all teams found in matchups for ranking purposes
    const allUniqueTeamsInLeague = new Set(); // To collect all unique teams across all years
    historicalMatchups.forEach(match => {
        allUniqueTeamsInLeague.add(getMappedTeamName(String(match.team1 || '').trim()));
        allUniqueTeamsInLeague.add(getMappedTeamName(String(match.team2 || '').trim()));
    });
    Array.from(allUniqueTeamsInLeague).forEach(team => {
        if (team) { // Ensure team name is not empty
            overallStats.allTeamsOverallStats[team] = {
                totalWins: 0,
                totalLosses: 0,
                totalTies: 0,
                totalPointsFor: 0,
                highestScore: 0,
                playoffAppearances: new Set(), // Use a Set to count unique years
                championships: 0 // Will count championships for all teams for ranking
            };
        }
    });

    historicalMatchups.forEach(match => {
      const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
      const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (!displayTeam1 && !displayTeam2)) {
          return; // Skip invalid records
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Update overall stats for ALL teams for ranking purposes
      [displayTeam1, displayTeam2].forEach(currentTeam => {
        if (overallStats.allTeamsOverallStats[currentTeam]) {
            if (currentTeam === displayTeam1) {
                overallStats.allTeamsOverallStats[currentTeam].totalPointsFor += team1Score;
                overallStats.allTeamsOverallStats[currentTeam].highestScore = Math.max(overallStats.allTeamsOverallStats[currentTeam].highestScore, team1Score);
            } else {
                overallStats.allTeamsOverallStats[currentTeam].totalPointsFor += team2Score;
                overallStats.allTeamsOverallStats[currentTeam].highestScore = Math.max(overallStats.allTeamsOverallStats[currentTeam].highestScore, team2Score);
            }

            if (match.playoffs === true) {
                overallStats.allTeamsOverallStats[currentTeam].playoffAppearances.add(year);
            }
            // Count championships for all teams for ranking here based on finalSeedingGame
            if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame === 1) {
                const winningTeam = team1Won ? displayTeam1 : (isTie ? null : displayTeam2);
                if (winningTeam === currentTeam) {
                    overallStats.allTeamsOverallStats[currentTeam].championships++;
                }
            }
        }
      });


      // Process specific data for the selected team
      if (displayTeam1 !== teamName && displayTeam2 !== teamName) {
        return; // Only process matches involving the selected team for its specific history
      }

      // Initialize season history for current year if not present
      if (!seasonHistoryMap[year]) {
        seasonHistoryMap[year] = {
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          luckRating: 0, dpr: 0, adjustedDPR: 0, // Adjusted DPR added
          finish: 'N/A', // Determined from finalSeedingGame
          weeklyScores: [], // For DPR calculation
          allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0, // For all-play win %
        };
        weeklyGameScoresByYearAndWeek[year] = {};
        allLeagueScoresByYear[year] = []; // Initialize for league-wide scores
      }
      if (!weeklyGameScoresByYearAndWeek[year][week]) {
        weeklyGameScoresByYearAndWeek[year][week] = [];
      }

      // Populate weekly scores for ALL teams in the week (needed for all-play and luck score denominators)
      // This is the crucial part to get comprehensive weekly scores for Luck Calculation.
      weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });
      weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });

      // Add all scores to the league-wide array for this year (for DPR min/max calculation)
      if (!allLeagueScoresByYear[year]) {
          allLeagueScoresByYear[year] = [];
      }
      allLeagueScoresByYear[year].push(team1Score, team2Score);


      let selectedTeamScore = 0;
      let opponentScore = 0;

      if (displayTeam1 === teamName) {
        selectedTeamScore = team1Score;
        opponentScore = team2Score;
        if (isTie) {
          seasonHistoryMap[year].ties++;
          overallStats.totalTies++;
        } else if (team1Won) {
          seasonHistoryMap[year].wins++;
          overallStats.totalWins++;
        } else {
          seasonHistoryMap[year].losses++;
          overallStats.totalLosses++;
        }
      } else if (displayTeam2 === teamName) {
        selectedTeamScore = team2Score;
        opponentScore = team1Score;
        if (isTie) {
          seasonHistoryMap[year].ties++;
          overallStats.totalTies++;
        } else if (!team1Won) { // team2Won
          seasonHistoryMap[year].wins++;
          overallStats.totalWins++;
        } else {
          seasonHistoryMap[year].losses++;
          overallStats.totalLosses++;
        }
      }

      // Update common stats for the selected team
      seasonHistoryMap[year].pointsFor += selectedTeamScore;
      seasonHistoryMap[year].pointsAgainst += opponentScore;
      seasonHistoryMap[year].weeklyScores.push(selectedTeamScore);
      overallStats.totalPointsFor += selectedTeamScore;
      overallStats.totalGamesPlayed++;

      // Update highest score for the selected team
      if (selectedTeamScore > overallStats.highestScore.value) {
        overallStats.highestScore = {
          value: selectedTeamScore,
          matchup: `${displayTeam1} vs ${displayTeam2}`,
          year: year,
          week: week,
          team1: displayTeam1,
          team2: displayTeam2,
          team1Score: team1Score,
          team2Score: team2Score,
        };
      }

      // Track playoff appearances (only if match.playoffs is true, distinct years)
      if (match.playoffs === true) {
        overallStats.playoffAppearances.add(year);
      }

      // Determine final season finish using `finalSeedingGame`
      if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
        let winningTeam = team1Won ? displayTeam1 : (isTie ? 'Tie' : displayTeam2);
        let losingTeam = team1Won ? displayTeam2 : (isTie ? 'Tie' : displayTeam1);

        // If the selected team was in this final seeding game
        if (displayTeam1 === teamName || displayTeam2 === teamName) {
            const finalPlace = match.finalSeedingGame;
            const isSelectedTeamWinner = (winningTeam === teamName);

            if (finalPlace === 1) {
                if (isSelectedTeamWinner) {
                    seasonHistoryMap[year].finish = '1st (Champion)';
                    // Increment overall championships here directly from final seeding game for THIS TEAM
                    overallStats.championships++;
                } else if (losingTeam === teamName && !isTie) { // Only assign Runner-Up if not a tie
                    seasonHistoryMap[year].finish = '2nd (Runner-Up)';
                }
            } else if (finalPlace === 3) {
                if (isSelectedTeamWinner) {
                    seasonHistoryMap[year].finish = '3rd Place';
                } else if (losingTeam === teamName && !isTie) {
                    seasonHistoryMap[year].finish = '4th Place';
                }
            } else if (finalPlace === 5) {
                if (isSelectedTeamWinner) {
                    seasonHistoryMap[year].finish = '5th Place';
                } else if (losingTeam === teamName && !isTie) {
                    seasonHistoryMap[year].finish = '6th Place';
                }
            }
            // Can extend for other final seeding games (7th, 9th, etc.)
            else if (typeof finalPlace === 'number' && finalPlace > 0 && finalPlace % 2 !== 0) {
                if (isSelectedTeamWinner) {
                    seasonHistoryMap[year].finish = `${finalPlace}${getOrdinalSuffix(finalPlace)} Place`;
                } else if (losingTeam === teamName && !isTie) {
                    seasonHistoryMap[year].finish = `${finalPlace + 1}${getOrdinalSuffix(finalPlace + 1)} Place`;
                }
            }
        }
      }
    });

    // Second Pass: Calculate DPR, Luck Rating, and All-Play for each season
    Object.keys(seasonHistoryMap).sort().forEach(year => {
      const seasonStats = seasonHistoryMap[year];
      const teamWeeklyScores = seasonStats.weeklyScores;
      const totalGamesInSeason = seasonStats.wins + seasonStats.losses + seasonStats.ties;

      if (totalGamesInSeason === 0) return; // Skip if no games for the team in this season

      // Get league-wide min/max scores for DPR calculation for this year
      const leagueScoresForYear = allLeagueScoresByYear[year] || [];
      const leagueMaxScoreInSeason = leagueScoresForYear.length > 0 ? Math.max(...leagueScoresForYear) : 0;
      const leagueMinScoreInSeason = leagueScoresForYear.length > 0 ? Math.min(...leagueScoresForYear) : 0;

      // --- Calculate DPR for the season ---
      const winPercentage = (totalGamesInSeason > 0) ? ((seasonStats.wins + (0.5 * seasonStats.ties)) / totalGamesInSeason) : 0;

      // Raw DPR Calculation: ((Points Scored * 6) + ((League Max Score + League Min Score) * 2) + ((Win% * 200) * 2)) / 10
      const rawDPR = (
        (seasonStats.pointsFor * 6) +
        ((leagueMaxScoreInSeason + leagueMinScoreInSeason) * 2) + // Use league-wide min/max
        ((winPercentage * 200) * 2)
      ) / 10;

      seasonStats.dpr = rawDPR; // Storing raw DPR

      // Calculate Average Raw DPR for the season (league-wide) to adjust individual team DPR
      let totalRawDPRForCurrentSeason = 0;
      let teamsCountForDPR = 0;
      // Loop through all teams in this specific year to get their raw DPRs
      Object.keys(seasonalTeamStats[year] || {}).forEach(t => {
        const tStats = seasonalTeamStats[year][t];
        const tTotalGames = tStats.totalGames;
        if (tTotalGames > 0) {
          const tSeasonWinPercentage = (tStats.wins + 0.5 * tStats.ties) / tTotalGames;
          const tRawDPR = (
            (tStats.totalPointsFor * 6) +
            ((leagueMaxScoreInSeason + leagueMinScoreInSeason) * 2) +
            ((tSeasonWinPercentage * 200) * 2)
          ) / 10;
          totalRawDPRForCurrentSeason += tRawDPR;
          teamsCountForDPR++;
        }
      });
      const avgRawDPRForCurrentSeason = teamsCountForDPR > 0 ? totalRawDPRForCurrentSeason / teamsCountForDPR : 0;

      if (avgRawDPRForCurrentSeason > 0) {
        seasonStats.adjustedDPR = seasonStats.dpr / avgRawDPRForCurrentSeason; // Adjusted DPR
      } else {
        seasonStats.adjustedDPR = 0;
      }
      overallStats.totalDPR += seasonStats.adjustedDPR; // Sum adjusted DPRs for overall average
      overallStats.seasonsWithDPR++;


      // --- Calculate Luck Rating for the season ---
      let totalWeeklyLuckScoreSum = 0; // This accumulates projected wins for the season

      if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
          const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];
          // Filter to include only unique teams that had a non-zero score in this week
          const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
              .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score)) // Filter for valid numbers
              .map(entry => entry.team)
          );
          // If the selected team isn't even in this week's data, skip.
          if (!uniqueTeamsWithScores.has(teamName)) return;

          const numberOfOpponentsInWeek = uniqueTeamsWithScores.size - 1; // Number of other teams in the week for actual competition


          const currentTeamScoreEntry = allScoresInCurrentWeek.find(entry => entry.team === teamName);

          if (!currentTeamScoreEntry || currentTeamScoreEntry.score === undefined || isNaN(currentTeamScoreEntry.score)) {
              return; // Skip if the selected team didn't play or has invalid score in this week
          }
          const currentTeamScoreForWeek = currentTeamScoreEntry.score;


          let outscoredCount = 0;
          let oneLessCount = 0;

          // Compare current team's score against all *other* teams in the week
          allScoresInCurrentWeek.forEach(otherTeamEntry => {
            if (otherTeamEntry.team !== teamName) { // Don't compare against self
              if (currentTeamScoreForWeek > otherTeamEntry.score) {
                outscoredCount++;
              }
              if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                oneLessCount++;
              }
            }
          });

          // Denominators are the number of *potential opponents* in that week
          // For Luck Score, we compare against every other team that scored.
          const denominatorX = numberOfOpponentsInWeek; // Number of other teams in the league that week
          // The total number of pairwise comparisons (N-1 for each opponent, so N-1 total for outscored)
          // For 'oneLess', it's also N-1, if the formula assumes one specific opponent.
          // If the original source uses *2, it implies two 'chances' per opponent or a fixed number regardless of actual opponents.
          // Let's stick with N-1 for projected wins against 'each' opponent.
          const denominatorY = numberOfOpponentsInWeek;


          const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
          const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;

          const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;

          totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
        });
      }

      let actualRegularSeasonWins = 0;
      // Get actual regular season wins for the specific team for this year
      historicalMatchups.forEach(match => {
        if (!match.regSeason || parseInt(match.year) !== year) return;

        const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());

        if (displayTeam1 !== teamName && displayTeam2 !== teamName) return; // Not involving the selected team

        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (displayTeam1 === teamName) {
            if (team1Won) actualRegularSeasonWins++;
        } else if (displayTeam2 === teamName) {
            if (!team1Won) actualRegularSeasonWins++;
        }
      });

      // Luck Rating = Actual Regular Season Wins - Total Projected Wins (totalWeeklyLuckScoreSum)
      seasonStats.luckRating = actualRegularSeasonWins - totalWeeklyLuckScoreSum;
      seasonStats.projectedWins = totalWeeklyLuckScoreSum; // Also store projected wins for insight


      // --- Calculate All-Play Win Percentage for the season ---
      let allPlayWinsSeason = 0;
      let allPlayLossesSeason = 0;
      let allPlayTiesSeason = 0;

      if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
          const allScoresInWeek = weeklyGameScoresByYearAndWeek[year][week];
          const currentTeamScoreInWeek = allScoresInWeek.find(entry => entry.team === teamName)?.score;

          if (currentTeamScoreInWeek !== undefined) {
            allScoresInWeek.forEach(otherTeamEntry => {
              if (otherTeamEntry.team !== teamName) {
                if (currentTeamScoreInWeek > otherTeamEntry.score) {
                  allPlayWinsSeason++;
                } else if (currentTeamScoreInWeek === otherTeamEntry.score) {
                  allPlayTiesSeason++;
                } else {
                  allPlayLossesSeason++;
                }
              }
            });
          }
        });
      }
      seasonStats.allPlayWins = allPlayWinsSeason;
      seasonStats.allPlayLosses = allPlayLossesSeason;
      seasonStats.allPlayTies = allPlayTiesSeason;
      const totalAllPlayGamesSeason = allPlayWinsSeason + allPlayLossesSeason + allPlayTiesSeason;
      seasonStats.allPlayWinPercentage = totalAllPlayGamesSeason > 0 ? ((allPlayWinsSeason + (0.5 * allPlayTiesSeason)) / totalAllPlayGamesSeason) : 0;

      // Update overall all-play stats
      overallStats.allPlayWinsTotal += allPlayWinsSeason;
      overallStats.allPlayLossesTotal += allPlayLossesSeason;
      overallStats.allPlayTiesTotal += allPlayTiesSeason;
    });


    // Calculate overall Win %
    if (overallStats.totalGamesPlayed > 0) {
      overallStats.overallWinPct = ((overallStats.totalWins + (0.5 * overallStats.totalTies)) / overallStats.totalGamesPlayed);
    } else {
      overallStats.overallWinPct = 0;
    }

    // Convert Set of playoff appearances to number
    overallStats.playoffAppearancesCount = overallStats.playoffAppearances.size;

    // Calculate overall All-Play Win %
    const totalOverallAllPlayGames = overallStats.allPlayWinsTotal + overallStats.allPlayLossesTotal + overallStats.allPlayTiesTotal;
    overallStats.overallAllPlayWinPct = totalOverallAllPlayGames > 0 ? ((overallStats.allPlayWinsTotal + (0.5 * overallStats.allPlayTiesTotal)) / totalOverallAllPlayGames) : 0;

    // Calculate average Adjusted DPR
    overallStats.averageAdjustedDPR = overallStats.seasonsWithDPR > 0 ? overallStats.totalDPR / overallStats.seasonsWithDPR : 0;


    // --- Calculate Ranks among all teams ---
    // Function to calculate rank for a given metric
    const calculateRank = (metricKey, isHigherBetter = true) => {
        const teamsWithMetric = Object.entries(overallStats.allTeamsOverallStats).map(([tName, stats]) => ({
            team: tName,
            value: stats[metricKey]
        })).filter(item => typeof item.value === 'number' && !isNaN(item.value));

        if (teamsWithMetric.length === 0) return 'N/A';

        // For championships rank, we use the `championships` count derived directly from `finalSeedingGame`
        // which has been accumulated into `overallStats.championships` for the selected team,
        // and needs to be calculated for all teams here for ranking.
        if (metricKey === 'championships') {
            const champsRankData = Object.entries(overallStats.allTeamsOverallStats).map(([tName, stats]) => ({
                team: tName,
                value: stats.championships || 0 // Use the championship count stored in allTeamsOverallStats
            })).filter(item => item.value !== undefined);

            if (champsRankData.length > 0) {
                 champsRankData.sort((a, b) => b.value - a.value);
                 const rank = champsRankData.findIndex(item => item.team === teamName) + 1;
                 return rank > 0 ? `${rank} of ${champsRankData.length}` : 'N/A';
            }
            return 'N/A'; // No championship data to rank
        }


        teamsWithMetric.sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value);

        const rank = teamsWithMetric.findIndex(item => item.team === teamName) + 1;
        return rank > 0 ? `${rank} of ${teamsWithMetric.length}` : 'N/A';
    };

    overallStats.rankTotalWins = calculateRank('totalWins');
    overallStats.rankTotalPointsFor = calculateRank('totalPointsFor');
    overallStats.rankHighestScore = calculateRank('highestScore');
    overallStats.rankPlayoffAppearances = calculateRank('playoffAppearancesCount');
    overallStats.rankChampionships = calculateRank('championships'); // Calculate rank for championships
    overallStats.rankDPR = 'N/A'; // Placeholder until full league-wide DPR available for ranking

    // Sort season history by year descending
    const sortedSeasonHistory = Object.keys(seasonHistoryMap)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map(year => ({ year: parseInt(year), ...seasonHistoryMap[year] }));

    setTeamOverallStats(overallStats);
    setTeamSeasonHistory(sortedSeasonHistory);
    setLoadingStats(false);

  }, [teamName, historicalMatchups, getMappedTeamName, historicalChampions]);


  const formatScore = (value) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatLuckRating = (value) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const formatDPR = (value) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  if (loadingStats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading {teamName}'s team page...</p>
      </div>
    );
  }

  if (!teamOverallStats) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Could not load data for {teamName}.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center border-b pb-4">
        {teamName} - Team Overview
      </h2>

      {/* Top Stats Section */}
      <section className="mb-8 p-6 bg-blue-50 rounded-lg shadow-md border border-blue-200">
        <h3 className="text-xl font-bold text-blue-800 mb-4 border-b pb-2">Overall Statistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Total Record:</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.totalWins}-{teamOverallStats.totalLosses}-{teamOverallStats.totalTies}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Overall Win %:</p>
            <p className="text-blue-600 font-bold">{formatPercentage(teamOverallStats.overallWinPct)}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Total Points For:</p>
            <p className="text-blue-600 font-bold">{formatScore(teamOverallStats.totalPointsFor)}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Highest Game Score:</p>
            {teamOverallStats.highestScore.value > 0 ? (
              <p className="text-blue-600 font-bold">
                {formatScore(teamOverallStats.highestScore.value)}{' '}
                <span className="text-xs text-gray-500">({teamOverallStats.highestScore.year} Wk {teamOverallStats.highestScore.week})</span>
              </p>
            ) : (
              <p className="text-gray-500">N/A</p>
            )}
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Playoff Appearances:</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.playoffAppearancesCount}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Championships:</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.championships}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Average Adjusted DPR:</p> {/* Changed label */}
            <p className="text-blue-600 font-bold">{formatDPR(teamOverallStats.averageAdjustedDPR)}</p> {/* Changed to averageAdjustedDPR */}
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">All-Play Win %:</p>
            <p className="text-blue-600 font-bold">{formatPercentage(teamOverallStats.overallAllPlayWinPct)}</p>
          </div>
          {/* Rank among the league - these ranks would ideally come from pre-aggregated league data */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Rank (Wins):</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.rankTotalWins}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Rank (Points For):</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.rankTotalPointsFor}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Rank (Highest Score):</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.rankHighestScore}</p>
          </div>
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
            <p className="font-semibold text-gray-700">Rank (Championships):</p>
            <p className="text-blue-600 font-bold">{teamOverallStats.rankChampionships}</p>
          </div>
        </div>
      </section>

      {/* Season History Chart */}
      <section className="p-6 bg-green-50 rounded-lg shadow-md border border-green-200 w-full">
        <h3 className="text-xl font-bold text-green-800 mb-4 border-b pb-2">Season History</h3>
        {teamSeasonHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
              <thead className="bg-green-100">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Finish</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR Score</th> {/* Changed label */}
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
          <p className="text-center text-gray-600">No season history available for {teamName}.</p>
        )}
      </section>
    </div>
  );
};

export default TeamDetailPage;
