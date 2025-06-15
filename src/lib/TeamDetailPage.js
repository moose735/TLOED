// src/lib/TeamDetailPage.js
import React, { useState, useEffect } from 'react';

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
      championships: 0,
      totalDPR: 0, // Sum of adjusted DPRs across seasons
      seasonsWithDPR: 0,
      allPlayWinsTotal: 0,
      allPlayLossesTotal: 0,
      allPlayTiesTotal: 0,
    };

    const seasonHistoryMap = {}; // { year: { wins, losses, ties, pointsFor, pointsAgainst, luckRating, dpr, finish, weeklyScores: [] } }
    const weeklyGameScoresByYearAndWeek = {}; // For calculating weekly luck scores and all-play

    // First Pass: Aggregate all base data (actual W-L-T, points, weekly scores, and playoff flags)
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

      // Ensure both teams are valid and either is the selected team
      if (displayTeam1 !== teamName && displayTeam2 !== teamName) {
        return; // Only process matches involving the selected team
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize season history for current year if not present
      if (!seasonHistoryMap[year]) {
        seasonHistoryMap[year] = {
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          luckRating: 0, dpr: 0, // These will be calculated later
          finish: 'N/A', // Determined from champions or other data
          weeklyScores: [], // For DPR calculation
          allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0, // For all-play win %
        };
        weeklyGameScoresByYearAndWeek[year] = {};
      }
      if (!weeklyGameScoresByYearAndWeek[year][week]) {
        weeklyGameScoresByYearAndWeek[year][week] = [];
      }

      // Populate weekly scores for ALL teams in the week (needed for all-play and luck score denominators)
      weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });
      weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });


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

      // Update highest score
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
    });

    // Second Pass: Calculate DPR, Luck Rating, and All-Play for each season
    Object.keys(seasonHistoryMap).sort().forEach(year => {
      const seasonStats = seasonHistoryMap[year];
      const teamWeeklyScores = seasonStats.weeklyScores;
      const totalGamesInSeason = seasonStats.wins + seasonStats.losses + seasonStats.ties;

      if (totalGamesInSeason === 0) return; // Skip if no games for the team in this season

      // --- Calculate DPR for the season ---
      const teamMaxScoreInSeason = teamWeeklyScores.length > 0 ? Math.max(...teamWeeklyScores) : 0;
      const teamMinScoreInSeason = teamWeeklyScores.length > 0 ? Math.min(...teamWeeklyScores) : 0;
      const winPercentage = ((seasonStats.wins + (0.5 * seasonStats.ties)) / totalGamesInSeason);

      const rawDPR = (
        (seasonStats.pointsFor * 6) +
        ((teamMaxScoreInSeason + teamMinScoreInSeason) * 2) +
        ((winPercentage * 200) * 2)
      ) / 10;

      seasonStats.dpr = rawDPR;
      overallStats.totalDPR += rawDPR;
      overallStats.seasonsWithDPR++;


      // --- Calculate Luck Rating for the season ---
      let totalWeeklyLuckScoreSum = 0;

      if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
          const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];
          const regularSeasonMatch = historicalMatchups.find(m =>
              parseInt(m.year) === year &&
              parseInt(m.week) === parseInt(week) &&
              m.regSeason === true &&
              ((getMappedTeamName(String(m.team1 || '').trim()) === teamName) || (getMappedTeamName(String(m.team2 || '').trim()) === teamName))
          );

          if (!regularSeasonMatch) {
              return;
          }

          const currentTeamScoreForWeek = (getMappedTeamName(String(regularSeasonMatch.team1 || '').trim()) === teamName) ?
                                         parseFloat(regularSeasonMatch.team1Score) :
                                         parseFloat(regularSeasonMatch.team2Score);

          let outscoredCount = 0;
          let oneLessCount = 0;

          allScoresInCurrentWeek.forEach(otherTeamEntry => {
            if (otherTeamEntry.team !== teamName) {
              if (currentTeamScoreForWeek > otherTeamEntry.score) {
                outscoredCount++;
              }
              if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                oneLessCount++;
              }
            }
          });

          const denominatorX = 11;
          const denominatorY = 22;

          const weeklyProjectedWinComponentX = outscoredCount / denominatorX;
          const weeklyLuckScorePartY = oneLessCount / denominatorY;

          const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;

          totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
        });
      }

      let actualRegularSeasonWins = 0;
      let actualRegularSeasonLosses = 0;
      let actualRegularSeasonTies = 0;

      historicalMatchups.forEach(match => {
        if (!match.regSeason) return;
        if (parseInt(match.year) !== year) return;

        const displayTeam1 = getMappedTeamName(String(match.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match.team2 || '').trim());

        if (displayTeam1 !== teamName && displayTeam2 !== teamName) return;

        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (displayTeam1 === teamName) {
            if (isTie) actualRegularSeasonTies++;
            else if (team1Won) actualRegularSeasonWins++;
            else actualRegularSeasonLosses++;
        } else if (displayTeam2 === teamName) {
            if (isTie) actualRegularSeasonTies++;
            else if (!team1Won) actualRegularSeasonWins++;
            else actualRegularSeasonLosses++;
        }
      });

      seasonStats.luckRating = actualRegularSeasonWins - totalWeeklyLuckScoreSum;
      seasonStats.projectedWins = totalWeeklyLuckScoreSum;


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


    // --- Determine Season Finish (from Historical Champions data) ---
    historicalChampions.forEach(championEntry => {
      const year = championEntry.year;
      const champ = getMappedTeamName(championEntry.champion);
      const runnerUp = getMappedTeamName(championEntry.runnerUp);

      if (seasonHistoryMap[year]) {
        if (champ === teamName) {
          seasonHistoryMap[year].finish = '1st (Champion)';
          overallStats.championships++;
        } else if (runnerUp === teamName) {
          seasonHistoryMap[year].finish = '2nd (Runner-Up)';
        }
      }
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


    // --- Calculate Ranks among all teams (from historicalMatchups directly) ---
    const allTeamsOverallStats = {}; // { teamName: { totalWins, totalPointsFor, playoffAppearancesCount, highestScore } }

    // Populate allTeamsOverallStats by iterating through all historical matchups
    historicalMatchups.forEach(match => {
        const team1 = getMappedTeamName(String(match.team1 || '').trim());
        const team2 = getMappedTeamName(String(match.team2 || '').trim());
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);
        const year = parseInt(match.year);

        if (isNaN(team1Score) || isNaN(team2Score) || !team1 || !team2) return;

        [team1, team2].forEach(currentTeam => {
            if (!allTeamsOverallStats[currentTeam]) {
                allTeamsOverallStats[currentTeam] = {
                    totalWins: 0,
                    totalLosses: 0,
                    totalTies: 0,
                    totalPointsFor: 0,
                    highestScore: 0,
                    playoffAppearancesCount: 0, // Will be set using Set later
                    dpr: 0, // Placeholder
                };
            }
        });

        // Update overall records and points for each team
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (isTie) {
            allTeamsOverallStats[team1].totalTies++;
            allTeamsOverallStats[team2].totalTies++;
        } else if (team1Won) {
            allTeamsOverallStats[team1].totalWins++;
            allTeamsOverallStats[team2].totalLosses++;
        } else {
            allTeamsOverallStats[team2].totalWins++;
            allTeamsOverallStats[team1].totalLosses++;
        }

        allTeamsOverallStats[team1].totalPointsFor += team1Score;
        allTeamsOverallStats[team2].totalPointsFor += team2Score;

        allTeamsOverallStats[team1].highestScore = Math.max(allTeamsOverallStats[team1].highestScore, team1Score);
        allTeamsOverallStats[team2].highestScore = Math.max(allTeamsOverallStats[team2].highestScore, team2Score);

        if (match.playoffs === true) {
            // Use a temporary Set within allTeamsOverallStats to count unique appearances per team
            if (!allTeamsOverallStats[team1]._playoffYears) allTeamsOverallStats[team1]._playoffYears = new Set();
            if (!allTeamsOverallStats[team2]._playoffYears) allTeamsOverallStats[team2]._playoffYears = new Set();
            allTeamsOverallStats[team1]._playoffYears.add(year);
            allTeamsOverallStats[team2]._playoffYears.add(year);
        }
    });

    // Finalize playoff appearances count for all teams
    Object.keys(allTeamsOverallStats).forEach(team => {
        if (allTeamsOverallStats[team]._playoffYears) {
            allTeamsOverallStats[team].playoffAppearancesCount = allTeamsOverallStats[team]._playoffYears.size;
        }
    });


    // Function to calculate rank for a given metric
    const calculateRank = (metricKey, isHigherBetter = true) => {
        const teamsWithMetric = Object.entries(allTeamsOverallStats).map(([tName, stats]) => ({
            team: tName,
            value: stats[metricKey]
        })).filter(item => typeof item.value === 'number' && !isNaN(item.value));

        if (teamsWithMetric.length === 0) return 'N/A';

        teamsWithMetric.sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value);

        const rank = teamsWithMetric.findIndex(item => item.team === teamName) + 1;
        return rank > 0 ? `${rank} of ${teamsWithMetric.length}` : 'N/A';
    };

    overallStats.rankTotalWins = calculateRank('totalWins');
    overallStats.rankTotalPointsFor = calculateRank('totalPointsFor');
    overallStats.rankHighestScore = calculateRank('highestScore');
    overallStats.rankPlayoffAppearances = calculateRank('playoffAppearancesCount');
    overallStats.rankDPR = 'N/A'; // DPR ranking is complex and requires league-wide adjusted DPR, leaving N/A for now


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
            <p className="font-semibold text-gray-700">Total DPR:</p>
            <p className="text-blue-600 font-bold">{formatDPR(teamOverallStats.totalDPR)}</p>
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
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">DPR Score</th>
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
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(season.dpr)}</td>
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
