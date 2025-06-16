// src/lib/TeamDetailPage.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

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
      allTeamsOverallStats: {}, // Used for overall ranking calculations
    };

    const seasonHistoryMap = {}; // { year: { ...stats, adjustedDPR, luckRating, allPlayWinPercentage } }

    // Use the centralized calculation logic
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getMappedTeamName);

    // Initialize allTeamsOverallStats for all teams found in matchups for ranking purposes
    const allUniqueTeamsInLeague = new Set();
    historicalMatchups.forEach(match => {
        allUniqueTeamsInLeague.add(getMappedTeamName(String(match?.team1 || '').trim()));
        allUniqueTeamsInLeague.add(getMappedTeamName(String(match?.team2 || '').trim()));
    });
    Array.from(allUniqueTeamsInLeague).forEach(team => {
        if (team) {
            overallStats.allTeamsOverallStats[team] = {
                totalWins: 0,
                totalLosses: 0,
                totalTies: 0,
                totalPointsFor: 0,
                highestScore: 0,
                playoffAppearances: new Set(),
                championships: 0
            };
        }
    });

    historicalMatchups.forEach(match => {
      const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
      const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
      const year = parseInt(match?.year || '0');
      const week = parseInt(match?.week || '0');
      const team1Score = parseFloat(match?.team1Score || '0');
      const team2Score = parseFloat(match?.team2Score || '0');

      if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (!displayTeam1 && !displayTeam2)) {
          console.warn('Skipping invalid match data (TeamDetailPage main loop):', match);
          return;
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

            if (match?.playoffs === true) {
                overallStats.allTeamsOverallStats[currentTeam].playoffAppearances.add(year);
            }
            if (typeof match?.finalSeedingGame === 'number' && match.finalSeedingGame === 1) {
                const winningTeam = team1Won ? displayTeam1 : (isTie ? null : displayTeam2);
                if (winningTeam === currentTeam) {
                    overallStats.allTeamsOverallStats[currentTeam].championships++;
                }
            }
        }
      });

      // ONLY Process data specific to the 'teamName' being viewed
      if (displayTeam1 !== teamName && displayTeam2 !== teamName) {
        return;
      }

      // Initialize season history for current year for the SELECTED TEAM if not present
      if (!seasonHistoryMap[year]) {
        seasonHistoryMap[year] = {
          wins: 0, losses: 0, ties: 0,
          pointsFor: 0, pointsAgainst: 0,
          luckRating: 0, dpr: 0, adjustedDPR: 0, // These will be populated from seasonalMetrics
          finish: 'N/A',
        };
      }

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
      seasonHistoryMap[year].pointsFor += selectedTeamScore;
      seasonHistoryMap[year].pointsAgainst += opponentScore;
      overallStats.totalPointsFor += selectedTeamScore;
      overallStats.totalGamesPlayed++;

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

      if (match?.playoffs === true) {
        overallStats.playoffAppearances.add(year);
      }

      if (typeof match?.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
        let winningTeam = team1Won ? displayTeam1 : (isTie ? 'Tie' : displayTeam2);
        let losingTeam = team1Won ? displayTeam2 : (isTie ? 'Tie' : displayTeam1);

        if (displayTeam1 === teamName || displayTeam2 === teamName) {
            const finalPlace = match.finalSeedingGame;
            const isSelectedTeamWinner = (winningTeam === teamName);

            if (finalPlace === 1) {
                if (isSelectedTeamWinner) {
                    seasonHistoryMap[year].finish = '1st (Champion)';
                    overallStats.championships++;
                } else if (losingTeam === teamName && !isTie) {
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

    // Populate calculated metrics from the centralized `seasonalMetrics`
    Object.keys(seasonHistoryMap).sort().forEach(year => {
      const teamSeasonData = seasonalMetrics[year]?.[teamName];
      if (teamSeasonData) {
        seasonHistoryMap[year].adjustedDPR = teamSeasonData.adjustedDPR;
        seasonHistoryMap[year].luckRating = teamSeasonData.luckRating;
        seasonHistoryMap[year].allPlayWinPercentage = teamSeasonData.allPlayWinPercentage;
        overallStats.totalDPR += teamSeasonData.adjustedDPR;
        overallStats.seasonsWithDPR++;
      } else {
        // If no seasonal data for the team for this year, ensure defaults are set
        seasonHistoryMap[year].adjustedDPR = 0;
        seasonHistoryMap[year].luckRating = 0;
        seasonHistoryMap[year].allPlayWinPercentage = 0;
      }
    });

    // Calculate overall Win %
    if (overallStats.totalGamesPlayed > 0) {
      overallStats.overallWinPct = ((overallStats.totalWins + (0.5 * overallStats.ties)) / overallStats.totalGamesPlayed);
    } else {
      overallStats.overallWinPct = 0;
    }

    // Convert Set of playoff appearances to number
    overallStats.playoffAppearancesCount = overallStats.playoffAppearances.size;

    // Calculate overall All-Play Win %
    const totalOverallAllPlayGames = Object.values(seasonHistoryMap).reduce((sum, season) => sum + (season.wins + season.losses + season.ties) * (season.allPlayWinPercentage > 0 ? (12-1) : 0), 0); // Approx. total all-play games, adjust based on actual data
    overallStats.overallAllPlayWinPct = overallStats.allPlayWinsTotal > 0 ? ((overallStats.allPlayWinsTotal + (0.5 * overallStats.allPlayTiesTotal)) / totalOverallAllPlayGames) : 0;
    // Recalculate based on aggregated data from calculations.js if needed, or stick to this

    // Calculate average Adjusted DPR
    overallStats.averageAdjustedDPR = overallStats.seasonsWithDPR > 0 ? overallStats.totalDPR / overallStats.seasonsWithDPR : 0;


    // --- Calculate Ranks among all teams ---
    const calculateRank = (metricKey, isHigherBetter = true, allTeamsRawStats) => {
        const teamsWithMetric = Object.entries(allTeamsRawStats).map(([tName, stats]) => ({
            team: tName,
            value: stats[metricKey]
        })).filter(item => typeof item.value === 'number' && !isNaN(item.value));

        if (teamsWithMetric.length === 0) return 'N/A';

        if (metricKey === 'championships') {
            const champsRankData = Object.entries(allTeamsRawStats).map(([tName, stats]) => ({
                team: tName,
                value: stats.championships || 0
            })).filter(item => item.value !== undefined);

            if (champsRankData.length > 0) {
                 champsRankData.sort((a, b) => b.value - a.value);
                 const rank = champsRankData.findIndex(item => item.team === teamName) + 1;
                 return rank > 0 ? `${rank} of ${champsRankData.length}` : 'N/A';
            }
            return 'N/A';
        }

        teamsWithMetric.sort((a, b) => isHigherBetter ? b.value - a.value : a.value - b.value);

        const rank = teamsWithMetric.findIndex(item => item.team === teamName) + 1;
        return rank > 0 ? `${rank} of ${teamsWithMetric.length}` : 'N/A';
    };

    overallStats.rankTotalWins = calculateRank('totalWins', true, overallStats.allTeamsOverallStats);
    overallStats.rankTotalPointsFor = calculateRank('totalPointsFor', true, overallStats.allTeamsOverallStats);
    overallStats.rankHighestScore = calculateRank('highestScore', true, overallStats.allTeamsOverallStats);
    overallStats.rankPlayoffAppearances = calculateRank('playoffAppearancesCount', true, overallStats.allTeamsOverallStats);
    overallStats.rankChampionships = calculateRank('championships', true, overallStats.allTeamsOverallStats);
    // DPR rank would require calculating career DPR for all teams in a separate process or in calculateAllLeagueMetrics

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
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
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
            <p className="font-semibold text-gray-700">Average Adjusted DPR:</p>
            <p className="text-blue-600 font-bold">{formatDPR(teamOverallStats.averageAdjustedDPR)}</p>
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
                  <th className="py-2 px-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR Score</th>
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
                    <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(season.adjustedDPR)}</td>
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
