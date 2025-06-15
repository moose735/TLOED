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

    const seasonRecordsRaw = {};
    const weeklyGameScoresByYear = {};

    // First Pass: Aggregate basic data and weekly scores for luck calculation
    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const week = match.week;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      // Initialize structures for teams (seasonal)
      [team1, team2].forEach(team => {
        if (!seasonRecordsRaw[year]) {
          seasonRecordsRaw[year] = {};
        }
        if (!seasonRecordsRaw[year][team]) {
          seasonRecordsRaw[year][team] = {
            pointsFor: 0,
            weeklyScores: [], // To collect all scores by a team in a season
            totalLuckScore: 0, // Accumulator for luck score
          };
        }
      });

      // Populate weekly game scores by year and week for luck rating calculation
      if (!weeklyGameScoresByYear[year]) {
        weeklyGameScoresByYear[year] = {};
      }
      if (!weeklyGameScoresByYear[year][week]) {
        weeklyGameScoresByYear[year][week] = [];
      }
      weeklyGameScoresByYear[year][week].push({ team: team1, score: team1Score }, { team: team2, score: team2Score });

      // Accumulate points for the season
      seasonRecordsRaw[year][team1].pointsFor += team1Score;
      seasonRecordsRaw[year][team2].pointsFor += team2Score;
      seasonRecordsRaw[year][team1].weeklyScores.push(team1Score);
      seasonRecordsRaw[year][team2].weeklyScores.push(team2Score);
    });

    const allSeasonalLuckData = [];

    Object.keys(seasonRecordsRaw).forEach(year => {
      const teamsInSeason = Object.keys(seasonRecordsRaw[year]);
      if (teamsInSeason.length === 0) return;

      teamsInSeason.forEach(team => {
        const stats = seasonRecordsRaw[year][team];

        // Calculate Luck Score for each week and accumulate for the season
        if (weeklyGameScoresByYear[year]) {
          Object.keys(weeklyGameScoresByYear[year]).forEach(week => {
            const allScoresInCurrentWeek = weeklyGameScoresByYear[year][week];
            // Find the team's score for this specific week from allScoresInCurrentWeek
            // This is crucial as weeklyScores in stats is a running list, not week-specific
            const currentTeamEntry = allScoresInCurrentWeek.find(entry => entry.team === team);

            if (currentTeamEntry) {
              const currentTeamScore = currentTeamEntry.score;
              let outscoredCount = 0;
              let oneLessCount = 0;
              let actualOpponentsCount = 0; // Count actual opponents in the week

              allScoresInCurrentWeek.forEach(otherTeamEntry => {
                if (otherTeamEntry.team !== team) { // Only compare with other teams
                  actualOpponentsCount++;
                  if (currentTeamScore > otherTeamEntry.score) {
                    outscoredCount++;
                  }
                  if (currentTeamScore - 1 === otherTeamEntry.score) { // Exactly 1 less than current team's score
                    oneLessCount++;
                  }
                }
              });

              // Assuming a standard league size where max other teams is 11 for 12-team,
              // but use actualOpponentsCount for robustness if league size varies by week/year.
              const maxOpponentsDenominator = actualOpponentsCount > 0 ? actualOpponentsCount : 11; // Fallback if no other teams found (unlikely)

              const weeklyValue1 = outscoredCount / maxOpponentsDenominator;
              const weeklyValue2 = oneLessCount / (maxOpponentsDenominator * 2); // (Max opponents * 2) for the second part of the sum

              const weeklyLuckScore = weeklyValue1 + weeklyValue2;
              stats.totalLuckScore += weeklyLuckScore;
            }
          });
        }
        
        allSeasonalLuckData.push({
          year: parseInt(year),
          team,
          luckRating: stats.totalLuckScore,
          pointsFor: stats.pointsFor, // Include points for context
          // You might want to add wins/losses/ties here too if relevant for context
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
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        A seasonal rating indicating how "lucky" a team was based on their weekly scores relative to other teams.
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
                    <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  </tr>
                </thead>
                <tbody>
                  {luckRatingData.map((data, index) => (
                    <tr key={`${data.team}-${data.year}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-3 text-sm text-gray-800">{index + 1}</td>
                      <td className="py-2 px-3 text-sm text-gray-800">{data.year}</td>
                      <td className="py-2 px-3 text-sm text-gray-800">{data.team}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatLuckRating(data.luckRating)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatPoints(data.pointsFor)}</td>
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
