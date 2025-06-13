// src/lib/StreaksRecords.js
import React, { useState, useEffect } from 'react';

const StreaksRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [aggregatedStreaks, setAggregatedStreaks] = useState({});

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAggregatedStreaks({});
      return;
    }

    // Helper to store chronological game data for each team
    const teamGameLogs = {}; // { teamName: [{ year, week, isWin, isLoss, score, opponentScore, totalTeamsInWeek }] }
    const weeklyScoresAcrossLeague = {}; // { year: { week: [{ team, score }] } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid matchups
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Populate teamGameLogs
      if (!teamGameLogs[team1]) teamGameLogs[team1] = [];
      if (!teamGameLogs[team2]) teamGameLogs[team2] = [];

      teamGameLogs[team1].push({ year, week, isWin: team1Won, isLoss: !team1Won && !isTie, isTie: isTie, score: team1Score, opponentScore: team2Score });
      teamGameLogs[team2].push({ year, week, isWin: !team1Won, isLoss: team1Won && !isTie, isTie: isTie, score: team2Score, opponentScore: team1Score });

      // Populate weeklyScoresAcrossLeague for score-based streaks
      if (!weeklyScoresAcrossLeague[year]) weeklyScoresAcrossLeague[year] = {};
      if (!weeklyScoresAcrossLeague[year][week]) weeklyScoresAcrossLeague[year][week] = [];

      weeklyScoresAcrossLeague[year][week].push({ team: team1, score: team1Score });
      weeklyScoresAcrossLeague[year][week].push({ team: team2, score: team2Score });
    });

    // Sort game logs for each team chronologically
    Object.keys(teamGameLogs).forEach(team => {
      teamGameLogs[team].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
      });
    });

    // Calculate weekly rankings (highest, lowest, top 3)
    const weeklyRankings = {}; // { year: { week: { highestScore, lowestScore, top3Scores } } }
    Object.keys(weeklyScoresAcrossLeague).forEach(year => {
      weeklyRankings[year] = {};
      Object.keys(weeklyScoresAcrossLeague[year]).forEach(week => {
        const scoresInWeek = weeklyScoresAcrossLeague[year][week];
        const sortedScores = [...scoresInWeek].sort((a, b) => b.score - a.score); // Descending

        weeklyRankings[year][week] = {
          highestScore: sortedScores.length > 0 ? sortedScores[0].score : -Infinity,
          lowestScore: sortedScores.length > 0 ? sortedScores[sortedScores.length - 1].score : Infinity,
          top3Scores: sortedScores.slice(0, Math.min(3, sortedScores.length)).map(s => s.score)
        };
      });
    });


    // Initialize results for aggregated streaks
    const newAggregatedStreaks = {
      longestWinStreak: { value: 0, entries: [] }, // { team, streak, startYear, startWeek, endYear, endWeek }
      longestLosingStreak: { value: 0, entries: [] },
      longestConsecutiveHighestScoreWeeks: { value: 0, entries: [] },
      longestConsecutiveLowestScoreWeeks: { value: 0, entries: [] },
      longestConsecutiveTop3Weeks: { value: 0, entries: [] },
    };

    // Helper to update a streak record (max)
    const updateStreakRecord = (recordObj, newStreak, entryDetails) => {
      if (newStreak > recordObj.value) {
        recordObj.value = newStreak;
        recordObj.entries = [entryDetails];
      } else if (newStreak === recordObj.value && newStreak > 0) { // Only add if it's a tie for the record and streak is positive
        recordObj.entries.push(entryDetails);
      }
    };


    // --- Calculate Streaks ---
    Object.keys(teamGameLogs).forEach(teamName => {
      const games = teamGameLogs[teamName];

      // Win Streak & Losing Streak
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let winStreakStartYear = null;
      let winStreakStartWeek = null;
      let lossStreakStartYear = null;
      let lossStreakStartWeek = null;

      for (let i = 0; i < games.length; i++) {
        const game = games[i];

        // Win Streak Logic
        if (game.isWin) {
          if (currentWinStreak === 0) {
            winStreakStartYear = game.year;
            winStreakStartWeek = game.week;
          }
          currentWinStreak++;
          currentLossStreak = 0; // Reset loss streak
          lossStreakStartYear = null;
          lossStreakStartWeek = null;
        } else {
          // Record longest win streak found so far
          if (currentWinStreak > 0) {
            updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { team: teamName, streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: game.year, endWeek: game.week });
          }
          currentWinStreak = 0; // Reset win streak
          winStreakStartYear = null;
          winStreakStartWeek = null;

          // Loss Streak Logic
          if (game.isLoss) {
            if (currentLossStreak === 0) {
              lossStreakStartYear = game.year;
              lossStreakStartWeek = game.week;
            }
            currentLossStreak++;
          } else { // Tie or win (should have been handled by isWin)
            if (currentLossStreak > 0) {
              updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { team: teamName, streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: game.year, endWeek: game.week });
            }
            currentLossStreak = 0;
            lossStreakStartYear = null;
            lossStreakStartWeek = null;
          }
        }
      }
      // After loop, check for any active streaks
      if (currentWinStreak > 0) {
        updateStreakRecord(newAggregatedStreaks.longestWinStreak, currentWinStreak, { team: teamName, streak: currentWinStreak, startYear: winStreakStartYear, startWeek: winStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
      }
      if (currentLossStreak > 0) {
        updateStreakRecord(newAggregatedStreaks.longestLosingStreak, currentLossStreak, { team: teamName, streak: currentLossStreak, startYear: lossStreakStartYear, startWeek: lossStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
      }


      // Consecutive Weeks with Highest/Lowest/Top 3 Score
      let currentHighestScoreStreak = 0;
      let currentLowestScoreStreak = 0;
      let currentTop3Streak = 0;
      let highestScoreStreakStartYear = null;
      let highestScoreStreakStartWeek = null;
      let lowestScoreStreakStartYear = null;
      let lowestScoreStreakStartWeek = null;
      let top3StreakStartYear = null;
      let top3StreakStartWeek = null;

      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        const weekRanking = weeklyRankings[game.year]?.[game.week];

        if (!weekRanking) continue; // Skip if no ranking data for this week

        // Highest Score Streak
        if (game.score === weekRanking.highestScore) {
          if (currentHighestScoreStreak === 0) {
            highestScoreStreakStartYear = game.year;
            highestScoreStreakStartWeek = game.week;
          }
          currentHighestScoreStreak++;
        } else {
          if (currentHighestScoreStreak > 0) {
            updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { team: teamName, streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : highestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : highestScoreStreakStartWeek });
          }
          currentHighestScoreStreak = 0;
          highestScoreStreakStartYear = null;
          highestScoreStreakStartWeek = null;
        }

        // Lowest Score Streak
        if (game.score === weekRanking.lowestScore) {
          if (currentLowestScoreStreak === 0) {
            lowestScoreStreakStartYear = game.year;
            lowestScoreStreakStartWeek = game.week;
          }
          currentLowestScoreStreak++;
        } else {
          if (currentLowestScoreStreak > 0) {
            updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { team: teamName, streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[i-1] ? games[i-1].year : lowestScoreStreakStartYear, endWeek: games[i-1] ? games[i-1].week : lowestScoreStreakStartWeek });
          }
          currentLowestScoreStreak = 0;
          lowestScoreStreakStartYear = null;
          lowestScoreStreakStartWeek = null;
        }

        // Top 3 Score Streak
        if (weekRanking.top3Scores.includes(game.score)) {
          if (currentTop3Streak === 0) {
            top3StreakStartYear = game.year;
            top3StreakStartWeek = game.week;
          }
          currentTop3Streak++;
        } else {
          if (currentTop3Streak > 0) {
            updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { team: teamName, streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[i-1] ? games[i-1].year : top3StreakStartYear, endWeek: games[i-1] ? games[i-1].week : top3StreakStartWeek });
          }
          currentTop3Streak = 0;
          top3StreakStartYear = null;
          top3StreakStartWeek = null;
        }
      }

      // Check after loop for any ending streaks
      if (currentHighestScoreStreak > 0) {
        updateStreakRecord(newAggregatedStreaks.longestConsecutiveHighestScoreWeeks, currentHighestScoreStreak, { team: teamName, streak: currentHighestScoreStreak, startYear: highestScoreStreakStartYear, startWeek: highestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
      }
      if (currentLowestScoreStreak > 0) {
        updateStreakRecord(newAggregatedStreaks.longestConsecutiveLowestScoreWeeks, currentLowestScoreStreak, { team: teamName, streak: currentLowestScoreStreak, startYear: lowestScoreStreakStartYear, startWeek: lowestScoreStreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
      }
      if (currentTop3Streak > 0) {
        updateStreakRecord(newAggregatedStreaks.longestConsecutiveTop3Weeks, currentTop3Streak, { team: teamName, streak: currentTop3Streak, startYear: top3StreakStartYear, startWeek: top3StreakStartWeek, endYear: games[games.length - 1].year, endWeek: games[games.length - 1].week });
      }
    });

    // Filter out records that are 0 (no streaks found) and sort entries
    Object.keys(newAggregatedStreaks).forEach(key => {
        const record = newAggregatedStreaks[key];
        if (record.value === 0 && record.entries.length === 0) { // If value is 0 and no entries, it means no valid streak was found
            record.entries = []; // Ensure empty if no record
        }
        // Sort entries consistently for tied records: by team name, then start date
        record.entries.sort((a, b) => {
            const teamCompare = (a.team || '').localeCompare(b.team || '');
            if (teamCompare !== 0) return teamCompare;
            // Compare by start year then start week
            if (a.startYear !== b.startYear) return a.startYear - b.startYear;
            return a.startWeek - b.startWeek;
        });
    });

    setAggregatedStreaks(newAggregatedStreaks);

  }, [historicalMatchups, getDisplayTeamName]);

  const recordsToDisplay = [
    { key: 'longestWinStreak', label: 'Longest Win Streak' },
    { key: 'longestLosingStreak', label: 'Longest Losing Streak' },
    { key: 'longestConsecutiveHighestScoreWeeks', label: 'Longest Consecutive Weeks Highest Score' },
    { key: 'longestConsecutiveLowestScoreWeeks', label: 'Longest Consecutive Weeks Lowest Score' },
    { key: 'longestConsecutiveTop3Weeks', label: 'Longest Consecutive Weeks in Top 3' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">STREAK RECORDS - ( CONSECUTIVE )</h3>
      <p className="text-sm text-gray-600 mb-6">Longest historical streaks for teams.</p>

      {Object.keys(aggregatedStreaks).length === 0 || recordsToDisplay.every(r => aggregatedStreaks[r.key]?.entries.length === 0) ? (
        <p className="text-center text-gray-600">No streak data available to display records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Record</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Value</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/4">Team</th>
                <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">Start</th>
                <th className="py-2 px-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/6">End</th>
              </tr>
            </thead>
            <tbody>
              {recordsToDisplay.map((recordDef, recordGroupIndex) => {
                const recordData = aggregatedStreaks[recordDef.key];
                if (!recordData || recordData.entries.length === 0) {
                  return (
                    <tr key={recordDef.key} className={recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 text-sm text-gray-800 font-semibold">{recordDef.label}</td>
                      <td colSpan="4" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
                    </tr>
                  );
                }
                return recordData.entries.map((entry, entryIndex) => (
                  <tr
                    key={`${recordDef.key}-${entry.team}-${entry.startYear}-${entry.startWeek}-${entryIndex}`}
                    className={`
                      ${recordGroupIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      ${entryIndex === recordData.entries.length - 1 ? 'border-b border-gray-100' : ''}
                    `}
                  >
                    <td className="py-2 px-3 text-sm text-gray-800 font-semibold">
                      {entryIndex === 0 ? recordDef.label : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800">
                      {entryIndex === 0 ? entry.streak : ''}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700">{entry.team}</td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">
                        <div className="flex items-center justify-center"> {/* Removed space-x-1 */}
                            <span>{entry.startYear}</span>
                            <span>-</span> {/* Changed . to - */}
                            <span>Week {entry.startWeek}</span>
                        </div>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700 text-center">
                        <div className="flex items-center justify-center"> {/* Removed space-x-1 */}
                            <span>{entry.endYear}</span>
                            <span>-</span> {/* Changed . to - */}
                            <span>Week {entry.endWeek}</span>
                        </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StreaksRecords;
