// src/lib/LuckRatingAnalysis.js
import React, { useState, useEffect } from 'react';

const LuckRatingAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [luckRatingData, setLuckRatingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setLuckRatingData([]);
      setLoading(false);
      return;
    }

    // Stores weekly game scores for all teams: { year: { week: [{ team: 'TeamA', score: 100 }, { team: 'TeamB', score: 90 }, ...] } }
    const weeklyGameScoresByYearAndWeek = {};

    // Stores basic seasonal team stats (wins) for the final luck rating adjustment: { year: { team: { wins: 0, losses: 0, ties: 0 } } }
    const seasonalTeamOverallRecords = {}; // This will now ONLY count regular season wins for the luck calculation adjustment

    // First Pass: Populate initial data structures, focusing ONLY on regular season games for Luck Rating
    historicalMatchups.forEach(match => {
      // ONLY process regular season games for Luck Rating
      if (!match.regSeason) {
        return; // Skip non-regular season games
      }

      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const week = match.week;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Populate weeklyGameScoresByYearAndWeek (only with regular season games)
      if (!weeklyGameScoresByYearAndWeek[year]) {
        weeklyGameScoresByYearAndWeek[year] = {};
      }
      if (!weeklyGameScoresByYearAndWeek[year][week]) {
        weeklyGameScoresByYearAndWeek[year][week] = [];
      }
      weeklyGameScoresByYearAndWeek[year][week].push({ team: team1, score: team1Score }, { team: team2, score: team2Score });

      // Populate seasonalTeamOverallRecords (only with regular season wins for luck adjustment)
      [team1, team2].forEach(team => {
        if (!seasonalTeamOverallRecords[year]) {
          seasonalTeamOverallRecords[year] = {};
        }
        if (!seasonalTeamOverallRecords[year][team]) {
          seasonalTeamOverallRecords[year][team] = { wins: 0, losses: 0, ties: 0 };
        }
      });

      if (isTie) {
        seasonalTeamOverallRecords[year][team1].ties++;
        seasonalTeamOverallRecords[year][team2].ties++;
      } else if (team1Won) {
        seasonalTeamOverallRecords[year][team1].wins++;
        seasonalTeamOverallRecords[year][team2].losses++;
      } else { // team2Won
        seasonalTeamOverallRecords[year][team2].wins++;
        seasonalTeamOverallRecords[year][team1].losses++;
      }
    });

    // Stores calculated weekly luck/projected wins for each team: { year: { team: { weeklyLuckScores: [], weeklyProjectedWins: [] } } }
    const calculatedWeeklyStats = {};

    // Second Pass: Calculate weekly luck scores and projected wins
    Object.keys(weeklyGameScoresByYearAndWeek).forEach(year => {
      if (!calculatedWeeklyStats[year]) calculatedWeeklyStats[year] = {};

      Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
        const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];
        // The Excel formula implies a fixed 11 opponents, so we'll use 11/22 explicitly.

        // Calculate luck for each team in this specific week
        allScoresInCurrentWeek.forEach(currentTeamEntry => {
          const currentTeam = currentTeamEntry.team;
          const currentTeamScore = currentTeamEntry.score;

          if (!calculatedWeeklyStats[year][currentTeam]) {
            calculatedWeeklyStats[year][currentTeam] = {
              weeklyLuckScores: [],
              weeklyProjectedWins: []
            };
          }

          let outscoredCount = 0; // X from your formula
          let oneLessCount = 0;   // Y from your formula

          // Iterate over all OTHER scores in the same week
          allScoresInCurrentWeek.forEach(otherTeamEntry => {
            if (otherTeamEntry.team !== currentTeam) {
              if (currentTeamScore > otherTeamEntry.score) {
                outscoredCount++;
              }
              if (currentTeamScore - 1 === otherTeamEntry.score) {
                oneLessCount++;
              }
            }
          });

          // Fixed denominators as per Excel formula: /11 and /22
          const denominatorX = 11; // Always 11 as per the formula assuming 12-team league
          const denominatorY = 22; // Always 22 as per the formula

          const weeklyProjectedWin = outscoredCount / denominatorX; // This is the (X/11) part
          const weeklyLuckScorePart2 = oneLessCount / denominatorY; // This is the (Y/22) part

          const combinedWeeklyLuckScore = weeklyProjectedWin + weeklyLuckScorePart2;

          calculatedWeeklyStats[year][currentTeam].weeklyLuckScores.push(combinedWeeklyLuckScore);
          calculatedWeeklyStats[year][currentTeam].weeklyProjectedWins.push(weeklyProjectedWin);
        });
      });
    });

    // Third Pass: Aggregate seasonal luck ratings
    const allSeasonalLuckData = [];

    Object.keys(seasonalTeamOverallRecords).sort().forEach(year => {
      Object.keys(seasonalTeamOverallRecords[year]).forEach(team => {
        const teamSeasonWins = seasonalTeamOverallRecords[year][team].wins; // These are now *only* regular season wins
        const teamWeeklyCalculations = calculatedWeeklyStats[year][team];

        if (!teamWeeklyCalculations) {
            // No regular season data for this team in this season (e.g., didn't play or invalid matchups)
            return;
        }

        const totalLuckScoreSum = teamWeeklyCalculations.weeklyLuckScores.reduce((sum, score) => sum + score, 0); // Sum of (X/11 + Y/22) per week
        const totalProjectedWinsSum = teamWeeklyCalculations.weeklyProjectedWins.reduce((sum, wins) => sum + wins, 0); // Sum of (X/11) per week

        // Final Luck Rating Calculation: (Sum of all weekly luck scores) - Actual Wins
        const finalLuckRating = totalLuckScoreSum - teamSeasonWins;

        allSeasonalLuckData.push({
          year: parseInt(year),
          team,
          luckRating: finalLuckRating,
          actualWins: teamSeasonWins,
          projectedWins: totalProjectedWinsSum, // This is still the sum of (X/11), can be renamed if confusing
          fullProjectedWins: totalLuckScoreSum, // This is the 'Projected Wins' for the final Luck Rating formula
        });
      });
    });

    // Sort the luck data by luckRating descending
    allSeasonalLuckData.sort((a, b) => b.luckRating - a.luckRating);

    setLuckRatingData(allSeasonalLuckData);
    setLoading(false);

  }, [historicalMatchups, getDisplayTeamName]);

  const formatLuckRating = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      // Use 3 decimal places for precision based on the formula
      return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  const formatPoints = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'N/A';
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        Luck Rating Analysis (Seasonal)
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        A seasonal rating indicating how "lucky" a team was, calculated only for **regular season games**.
        Formula: (Sum of all weekly luck scores) - (Actual Regular Season Wins). Weekly luck scores are calculated as: ((Scores less than Team Score) / 11) + ((Scores exactly 1 less than Team Score) / 22).
        Higher values indicate more favorable weekly outcomes.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating Luck Ratings...</p>
      ) : (
        <section className="mb-8 p-4 bg-yellow-50 rounded-lg shadow-sm border border-yellow-200">
          <h3 className="text-xl font-bold text-yellow-800 mb-4 border-b pb-2">Seasonal Luck Rankings</h3>
          {luckRatingData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-yellow-100">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Actual Wins</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Projected Wins (X/11)</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Full Projected Wins (X/11 + Y/22)</th>
                  </tr>
                </thead>
                <tbody>
                  {luckRatingData.map((data, index) => (
                    <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-3 text-sm text-gray-800">{index + 1}</td>
                      <td className="py-2 px-3 text-sm text-gray-800">{data.year}</td>
                      <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.luckRating)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{data.actualWins}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.projectedWins)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.fullProjectedWins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600">No seasonal luck rating data available.</p>
          )}
        </section>
      )}
    </div>
  );
};

export default LuckRatingAnalysis;
