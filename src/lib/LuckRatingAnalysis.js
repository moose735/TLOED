// src/lib/LuckRatingAnalysis.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const LuckRatingAnalysis = ({ historicalMatchups, getDisplayTeamName }) => {
  const [luckRatingData, setLuckRatingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setLuckRatingData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the centralized calculation logic
    const { seasonalMetrics } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    const allLuckRatings = [];
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        // Ensure that the luckRating is populated for the team in this year
        const teamData = seasonalMetrics[year][team];
        if (typeof teamData.luckRating === 'number' && !isNaN(teamData.luckRating)) {
          // We need projectedWins from the luck calculation, which is not directly returned by seasonalMetrics
          // For now, we will re-calculate projected wins here if it's strictly needed for display.
          // Or, better, enhance calculateAllLeagueMetrics to return projected wins per season per team.
          // For simplicity and direct use of the centralized function, we rely on `luckRating` here.
          // If the original component showed projectedWins, we need to adapt this or adjust `calculations.js` output.
          // Assuming `LuckRatingAnalysis` primarily needs `luckRating` and `actualWins`.
          let actualWins = 0;
          historicalMatchups.forEach(match => {
            if (!(match?.regSeason === true || match?.regSeason === 'true') || parseInt(match?.year || '0') !== parseInt(year)) return;
            const displayTeam1 = getDisplayTeamName(String(match?.team1 || '').trim());
            const displayTeam2 = getDisplayTeamName(String(match?.team2 || '').trim());
            if (displayTeam1 === team) {
                if (parseFloat(match?.team1Score || '0') > parseFloat(match?.team2Score || '0')) actualWins++;
            } else if (displayTeam2 === team) {
                if (parseFloat(match?.team2Score || '0') > parseFloat(match?.team1Score || '0')) actualWins++;
            }
          });

          // To get projectedWins, we would need to pass weeklyGameScoresByYearAndWeek to calculateLuckRating
          // and have calculateLuckRating return both luckRating and projectedWins.
          // For now, if the original component showed it, we will put a placeholder or add it if `calculations.js` is updated.
          // Let's assume for this fix, we only show `luckRating` as the primary metric, and `actualWins`.
          // To get projected wins, the calculations.js would need to expose it or be modified.

          // REVISIT: The current `calculateLuckRating` only returns the difference.
          // To show projected wins, we need to extract `totalWeeklyLuckScoreSum` from `calculateLuckRating`.
          // For now, I'll calculate it inline *again* or simplify the table display if not directly available.

          // To avoid redundant calculation and keep components lean:
          // Modify `calculateAllLeagueMetrics` in `calculations.js` to return `projectedWins` per team per season.
          // This will require an update to `calculations.js` structure.

          // For this immediate fix, let's include a temporary re-calculation of projected wins for display only.
          // This is not ideal, but necessary if calculations.js doesn't expose it.
          // Better: update calculations.js.

          // Recalculating projectedWins here for display consistency:
          let totalWeeklyLuckScoreSumForDisplay = 0;
          const weeklyGameScoresByYearAndWeekForLuck = {}; // Rebuild for this specific need

          historicalMatchups.forEach(m => {
            const t1 = getDisplayTeamName(String(m?.team1 || '').trim());
            const t2 = getDisplayTeamName(String(m?.team2 || '').trim());
            const y = parseInt(m?.year || '0');
            const w = parseInt(m?.week || '0');
            const s1 = parseFloat(m?.team1Score || '0');
            const s2 = parseFloat(m?.team2Score || '0');
            if (isNaN(y) || isNaN(w) || isNaN(s1) || isNaN(s2) || !(m?.regSeason === true || m?.regSeason === 'true')) return;

            if (!weeklyGameScoresByYearAndWeekForLuck[y]) weeklyGameScoresByYearAndWeekForLuck[y] = {};
            if (!weeklyGameScoresByYearAndWeekForLuck[y][w]) weeklyGameScoresByYearAndWeekForLuck[y][w] = [];
            weeklyGameScoresByYearAndWeekForLuck[y][w].push({ team: t1, score: s1 });
            weeklyGameScoresByYearAndWeekForLuck[y][w].push({ team: t2, score: s2 });
          });


          if (weeklyGameScoresByYearAndWeekForLuck[year]) {
              Object.keys(weeklyGameScoresByYearAndWeekForLuck[year]).forEach(week => {
                  const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeekForLuck[year][week];
                  const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
                      .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score))
                      .map(entry => entry.team)
                  );
                  if (!uniqueTeamsWithScores.has(team)) return; // Use 'team' (current team in loop)

                  const relevantMatchupsForWeek = historicalMatchups.filter(m =>
                      parseInt(m?.year || '0') === parseInt(year) &&
                      parseInt(m?.week || '0') === parseInt(week) &&
                      (m?.regSeason === true || m?.regSeason === 'true')
                  );
                  if (relevantMatchupsForWeek.length === 0) return;

                  const currentTeamMatchEntry = relevantMatchupsForWeek.find(match => {
                      const matchTeam1 = getDisplayTeamName(String(match?.team1 || '').trim());
                      const matchTeam2 = getDisplayTeamName(String(match?.team2 || '').trim());
                      return matchTeam1 === team || matchTeam2 === team; // Use 'team' (current team in loop)
                  });
                  if (!currentTeamMatchEntry) return;

                  let currentTeamScoreForWeek;
                  const mappedTeam1 = getDisplayTeamName(String(currentTeamMatchEntry?.team1 || '').trim());
                  const mappedTeam2 = getDisplayTeamName(String(currentTeamMatchEntry?.team2 || '').trim());

                  if (mappedTeam1 === team) { // Use 'team'
                      currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team1Score || '0');
                  } else if (mappedTeam2 === team) { // Use 'team'
                      currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team2Score || '0');
                  } else { return; }

                  if (isNaN(currentTeamScoreForWeek)) return;

                  let outscoredCount = 0;
                  let oneLessCount = 0;

                  allScoresInCurrentWeek.forEach(otherTeamEntry => {
                      if (otherTeamEntry.team !== team) { // Use 'team'
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
                  const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
                  const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;
                  totalWeeklyLuckScoreSumForDisplay += (weeklyProjectedWinComponentX + weeklyLuckScorePartY);
              });
          }

          allLuckRatings.push({
            year: parseInt(year),
            team: team,
            luckRating: teamData.luckRating,
            actualWins: actualWins,
            projectedWins: totalWeeklyLuckScoreSumForDisplay // This is a temporary re-calculation for display
          });
        }
      });
    });

    allLuckRatings.sort((a, b) => b.luckRating - a.luckRating); // Sort by luck rating descending
    setLuckRatingData(allLuckRatings);
    setLoading(false);

  }, [historicalMatchups, getDisplayTeamName]);

  const formatLuckRating = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
        Luck Rating Analysis
      </h2>
      <p className="text-sm text-gray-600 mb-6 text-center">
        This analysis indicates how much "luckier" or "unluckier" a team was
        compared to their projected wins if every possible matchup against other teams
        in their league week-by-week were played. A positive score means luckier, negative means unluckier.
      </p>

      {loading ? (
        <p className="text-center text-gray-600">Calculating luck ratings...</p>
      ) : luckRatingData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-yellow-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Season</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Luck Rating</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Actual Wins</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider border-b border-gray-200">Projected Wins</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600">No luck rating data found.</p>
      )}
    </div>
  );
};

export default LuckRatingAnalysis;
