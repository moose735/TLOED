// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';

const SeasonRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [seasonRecords, setSeasonRecords] = useState({});
  const [highestDPRSeasonRecord, setHighestDPRSeasonRecord] = useState(null);
  const [lowestDPRSeasonRecord, setLowestDPRSeasonRecord] = useState(null);
  const [mostWinsSeasonRecord, setMostWinsSeasonRecord] = useState(null);
  const [mostLossesSeasonRecord, setMostLossesSeasonRecord] = useState(null);
  const [bestAllPlayWinPctSeasonRecord, setBestAllPlayWinPctSeasonRecord] = useState(null);
  const [mostWeeklyHighScoresSeasonRecord, setMostWeeklyHighScoresSeasonRecord] = useState(null);
  const [mostWeeklyTop3ScoresSeasonRecord, setMostWeeklyTop3ScoresSeasonRecord] = useState(null);
  const [mostBlowoutWinsSeasonRecord, setMostBlowoutWinsSeasonRecord] = useState(null);
  const [mostBlowoutLossesSeasonRecord, setMostBlowoutLossesSeasonRecord] = useState(null);
  const [mostSlimWinsSeasonRecord, setMostSlimWinsSeasonRecord] = useState(null);
  const [mostSlimLossesSeasonRecord, setMostSlimLossesSeasonRecord] = useState(null);
  const [mostPointsSeasonRecord, setMostPointsSeasonRecord] = useState(null);
  const [fewestPointsSeasonRecord, setFewestPointsSeasonRecord] = useState(null);


  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setSeasonRecords({});
      setHighestDPRSeasonRecord(null);
      setLowestDPRSeasonRecord(null);
      setMostWinsSeasonRecord(null);
      setMostLossesSeasonRecord(null);
      setBestAllPlayWinPctSeasonRecord(null);
      setMostWeeklyHighScoresSeasonRecord(null);
      setMostWeeklyTop3ScoresSeasonRecord(null);
      setMostBlowoutWinsSeasonRecord(null);
      setMostBlowoutLossesSeasonRecord(null);
      setMostSlimWinsSeasonRecord(null);
      setMostSlimLossesSeasonRecord(null);
      setMostPointsSeasonRecord(null);
      setFewestPointsSeasonRecord(null);
      return;
    }

    const newSeasonRecords = {}; // { year: { team: { wins, losses, ties, pointsFor, totalGames, rawDPR, adjustedDPR, allPlayWins, allPlayLosses, allPlayTies, weeklyHighestScoreCount, weeklyTop3Count, blowoutWins, blowoutLosses, slimWins, slimLosses, winPercentage, allPlayWinPercentage } } }
    const weeklyGameScoresByYear = {}; // { year: { week: [{ team: 'TeamA', score: 100 }, ...] } }
    const seasonMaxMinScores = {}; // { year: { allGameScores: [] } }

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

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize structures for year and teams
      [team1, team2].forEach(team => {
        if (!newSeasonRecords[year]) {
          newSeasonRecords[year] = {};
          weeklyGameScoresByYear[year] = {};
          seasonMaxMinScores[year] = { allGameScores: [] };
        }
        if (!newSeasonRecords[year][team]) {
          newSeasonRecords[year][team] = {
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            totalGames: 0,
            allPlayWins: 0,
            allPlayLosses: 0,
            allPlayTies: 0,
            weeklyHighestScoreCount: 0,
            weeklyTop3Count: 0, // New
            blowoutWins: 0, // New
            blowoutLosses: 0, // New
            slimWins: 0, // New
            slimLosses: 0, // New
            rawDPR: 0,
            adjustedDPR: 0,
            winPercentage: 0,
            allPlayWinPercentage: 0,
          };
        }
      });

      // Update Season Records (actual W-L-T, points, totalGames)
      if (isTie) {
        newSeasonRecords[year][team1].ties++;
        newSeasonRecords[year][team2].ties++;
      } else if (team1Won) {
        newSeasonRecords[year][team1].wins++;
        newSeasonRecords[year][team2].losses++;
      } else { // team2Won
        newSeasonRecords[year][team2].wins++;
        newSeasonRecords[year][team1].losses++;
      }

      newSeasonRecords[year][team1].pointsFor += team1Score;
      newSeasonRecords[year][team2].pointsFor += team2Score;
      newSeasonRecords[year][team1].totalGames++;
      newSeasonRecords[year][team2].totalGames++;

      // Calculate Blowout/Slim Wins/Losses for both teams
      // Team 1 perspective
      if (team1Won) { // Team 1 won
        const margin = team1Score - team2Score;
        const opponentScoreForPercentage = team2Score === 0 ? 1 : team2Score; // Avoid division by zero
        if (margin / opponentScoreForPercentage > 0.40) {
          newSeasonRecords[year][team1].blowoutWins++;
        }
        if (margin / opponentScoreForPercentage < 0.025) {
          newSeasonRecords[year][team1].slimWins++;
        }
      } else if (team2Score > team1Score) { // Team 1 lost (Team 2 won)
        const margin = team2Score - team1Score;
        const teamScoreForPercentage = team1Score === 0 ? 1 : team1Score; // Avoid division by zero
        if (margin / teamScoreForPercentage > 0.40) {
          newSeasonRecords[year][team1].blowoutLosses++;
        }
        if (margin / teamScoreForPercentage < 0.025) {
          newSeasonRecords[year][team1].slimLosses++;
        }
      }

      // Team 2 perspective
      if (team2Score > team1Score) { // Team 2 won
        const margin = team2Score - team1Score;
        const opponentScoreForPercentage = team1Score === 0 ? 1 : team1Score; // Avoid division by zero
        if (margin / opponentScoreForPercentage > 0.40) {
          newSeasonRecords[year][team2].blowoutWins++;
        }
        if (margin / opponentScoreForPercentage < 0.025) {
          newSeasonRecords[year][team2].slimWins++;
        }
      } else if (team1Won) { // Team 2 lost (Team 1 won)
        const margin = team1Score - team2Score;
        const teamScoreForPercentage = team2Score === 0 ? 1 : team2Score; // Avoid division by zero
        if (margin / teamScoreForPercentage > 0.40) {
          newSeasonRecords[year][team2].blowoutLosses++;
        }
        if (margin / teamScoreForPercentage < 0.025) {
          newSeasonRecords[year][team2].slimLosses++;
        }
      }


      // Collect all game scores for the season to find max/min for DPR calculation
      seasonMaxMinScores[year].allGameScores.push(team1Score, team2Score);

      // Collect all scores for this specific week (for All-Play and Top 3 calculation)
      if (!weeklyGameScoresByYear[year][week]) {
        weeklyGameScoresByYear[year][week] = [];
      }
      weeklyGameScoresByYear[year][week].push({ team: team1, score: team1Score }, { team: team2, score: team2Score });
    });

    let currentHighestDPRSeason = { value: -Infinity, entries: [] };
    let currentLowestDPRSeason = { value: Infinity, entries: [] };
    let currentMostWinsSeason = { value: 0, entries: [] };
    let currentMostLossesSeason = { value: 0, entries: [] };
    let currentBestAllPlayWinPctSeason = { value: -Infinity, entries: [] };
    let currentMostWeeklyHighScoresSeason = { value: 0, entries: [] };
    let currentMostWeeklyTop3ScoresSeason = { value: 0, entries: [] }; // New
    let currentMostBlowoutWinsSeason = { value: 0, entries: [] }; // New
    let currentMostBlowoutLossesSeason = { value: 0, entries: [] }; // New
    let currentMostSlimWinsSeason = { value: 0, entries: [] }; // New
    let currentMostSlimLossesSeason = { value: 0, entries: [] }; // New
    let currentMostPointsSeason = { value: 0, entries: [] }; // New
    let currentFewestPointsSeason = { value: Infinity, entries: [] }; // New


    const updateRecord = (recordObj, newValue, entryDetails, isMin = false, isPercentage = false) => {
      if (isMin) {
        if (newValue < recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      } else {
        if (newValue > recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      }
    };

    Object.keys(newSeasonRecords).sort().forEach(year => {
      const teamsInSeason = Object.keys(newSeasonRecords[year]);
      if (teamsInSeason.length === 0) return;

      // Calculate all-play and weekly high/top3 scores for this year
      const weeksInYear = weeklyGameScoresByYear[year];
      Object.keys(weeksInYear).forEach(week => {
        const allScoresInWeek = weeksInYear[week];
        // Sort all scores to find the highest and top 3 for this week
        const sortedScoresInWeek = [...allScoresInWeek].sort((a, b) => b.score - a.score);
        const highestScoreInWeek = sortedScoresInWeek.length > 0 ? sortedScoresInWeek[0].score : -Infinity;
        const top3Scores = sortedScoresInWeek.slice(0, Math.min(3, sortedScoresInWeek.length)).map(entry => entry.score);

        allScoresInWeek.forEach(({ team, score }) => {
          if (!newSeasonRecords[year][team]) return; // Should not happen if initialized

          // Update weekly highest score count
          if (score === highestScoreInWeek) {
            newSeasonRecords[year][team].weeklyHighestScoreCount++;
          }
          // Update weekly top 3 score count
          if (top3Scores.includes(score)) {
            newSeasonRecords[year][team].weeklyTop3Count++;
          }

          // Calculate all-play for this week (comparing current team's score to all other scores in the week)
          allScoresInWeek.forEach(({ team: otherTeam, score: otherScore }) => {
            if (team !== otherTeam) { // Don't compare against self
              if (score > otherScore) {
                newSeasonRecords[year][team].allPlayWins++;
              } else if (score === otherScore) {
                newSeasonRecords[year][team].allPlayTies++;
              } else {
                newSeasonRecords[year][team].allPlayLosses++;
              }
            }
          });
        });
      });

      const maxScoreInSeason = Math.max(...seasonMaxMinScores[year].allGameScores);
      const minScoreInSeason = Math.min(...seasonMaxMinScores[year].allGameScores);

      let totalRawDPRForSeason = 0;
      let teamsWithValidDPR = 0;

      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        const totalGames = stats.totalGames;

        if (totalGames === 0) {
          return;
        }

        // Calculate actual win percentage
        stats.winPercentage = (stats.wins + 0.5 * stats.ties) / totalGames;

        // Calculate All-Play Win Percentage
        const totalAllPlayGames = stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies;
        stats.allPlayWinPercentage = totalAllPlayGames > 0 ? (stats.allPlayWins + 0.5 * stats.allPlayTies) / totalAllPlayGames : 0;

        // Raw DPR Calculation: ((Points Scored * 6) + ((Points Scored Max + Points Scored Min) * 2) + ((Win% * 200) * 2)) / 10
        stats.rawDPR = (
          (stats.pointsFor * 6) +
          ((maxScoreInSeason + minScoreInSeason) * 2) +
          ((stats.winPercentage * 200) * 2) // Using actual win percentage for DPR calculation
        ) / 10;

        totalRawDPRForSeason += stats.rawDPR;
        teamsWithValidDPR++;

        // Update league-wide season records
        updateRecord(currentMostWinsSeason, stats.wins, { team, year: parseInt(year), value: stats.wins });
        updateRecord(currentMostLossesSeason, stats.losses, { team, year: parseInt(year), value: stats.losses });
        updateRecord(currentBestAllPlayWinPctSeason, stats.allPlayWinPercentage, { team, year: parseInt(year), value: stats.allPlayWinPercentage }, false, true); // isPercentage = true
        updateRecord(currentMostWeeklyHighScoresSeason, stats.weeklyHighestScoreCount, { team, year: parseInt(year), value: stats.weeklyHighestScoreCount });
        updateRecord(currentMostWeeklyTop3ScoresSeason, stats.weeklyTop3Count, { team, year: parseInt(year), value: stats.weeklyTop3Count }); // New
        updateRecord(currentMostBlowoutWinsSeason, stats.blowoutWins, { team, year: parseInt(year), value: stats.blowoutWins }); // New
        updateRecord(currentMostBlowoutLossesSeason, stats.blowoutLosses, { team, year: parseInt(year), value: stats.blowoutLosses }); // New
        updateRecord(currentMostSlimWinsSeason, stats.slimWins, { team, year: parseInt(year), value: stats.slimWins }); // New
        updateRecord(currentMostSlimLossesSeason, stats.slimLosses, { team, year: parseInt(year), value: stats.slimLosses }); // New
        updateRecord(currentMostPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor }); // New
        updateRecord(currentFewestPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor }, true); // New
      });

      const avgRawDPRForSeason = teamsWithValidDPR > 0 ? totalRawDPRForSeason / teamsWithValidDPR : 0;

      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        if (avgRawDPRForSeason > 0) {
          stats.adjustedDPR = stats.rawDPR / avgRawDPRForSeason;
        } else {
          stats.adjustedDPR = 0;
        }

        // Update highest/lowest adjusted DPR season records
        if (stats.adjustedDPR !== 0) {
          updateRecord(currentHighestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR });
          updateRecord(currentLowestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR }, true);
        }
      });
    });

    // Final sorting for all-time record entries if there are ties
    const sortRecordEntries = (record) => {
        if (record && record.entries.length > 1) {
            record.entries.sort((a, b) => {
                // Sort by year, then by team name for consistent display of ties
                if (a.year !== b.year) return a.year - b.year;
                return (a.team || '').localeCompare(b.team || '');
            });
        }
    };

    sortRecordEntries(currentHighestDPRSeason);
    sortRecordEntries(currentLowestDPRSeason);
    sortRecordEntries(currentMostWinsSeason);
    sortRecordEntries(currentMostLossesSeason);
    sortRecordEntries(currentBestAllPlayWinPctSeason);
    sortRecordEntries(currentMostWeeklyHighScoresSeason);
    sortRecordEntries(currentMostWeeklyTop3ScoresSeason); // New
    sortRecordEntries(currentMostBlowoutWinsSeason); // New
    sortRecordEntries(currentMostBlowoutLossesSeason); // New
    sortRecordEntries(currentMostSlimWinsSeason); // New
    sortRecordEntries(currentMostSlimLossesSeason); // New
    sortRecordEntries(currentMostPointsSeason); // New
    sortRecordEntries(currentFewestPointsSeason); // New


    setSeasonRecords(newSeasonRecords);
    setHighestDPRSeasonRecord(currentHighestDPRSeason);
    setLowestDPRSeasonRecord(currentLowestDPRSeason);
    setMostWinsSeasonRecord(currentMostWinsSeason);
    setMostLossesSeasonRecord(currentMostLossesSeason);
    setBestAllPlayWinPctSeasonRecord(currentBestAllPlayWinPctSeason);
    setMostWeeklyHighScoresSeasonRecord(currentMostWeeklyHighScoresSeason);
    setMostWeeklyTop3ScoresSeasonRecord(currentMostWeeklyTop3ScoresSeason); // New
    setMostBlowoutWinsSeasonRecord(currentMostBlowoutWinsSeason); // New
    setMostBlowoutLossesSeasonRecord(currentMostBlowoutLossesSeason); // New
    setMostSlimWinsSeasonRecord(currentMostSlimWinsSeason); // New
    setMostSlimLossesSeasonRecord(currentMostSlimLossesSeason); // New
    setMostPointsSeasonRecord(currentMostPointsSeason); // New
    setFewestPointsSeasonRecord(currentFewestPointsSeason); // New


  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to render record (W-L-T)
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  // Sort years for consistent display (descending year)
  const sortedYears = Object.keys(seasonRecords).sort((a, b) => parseInt(b) - parseInt(a));

  const formatDPR = (dprValue) => {
    if (typeof dprValue === 'number' && !isNaN(dprValue)) {
      return dprValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return 'N/A';
  };

  const formatPercentage = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return 'N/A';
  };

  const formatPoints = (value) => {
    if (typeof value === 'number' && !isNaN(value)) {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'N/A';
  };

  const renderSingleRecordEntry = (recordItem, formatFn = val => val) => {
    if (!recordItem || recordItem.entries.length === 0 || (typeof recordItem.value === 'number' && recordItem.value === -Infinity) || (typeof recordItem.value === 'number' && recordItem.value === Infinity)) {
        return <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>;
    }
    return (
        <>
            <td className="py-2 px-3 text-sm text-gray-800">{formatFn(recordItem.value)}</td>
            <td className="py-2 px-3 text-sm text-gray-700">
                {recordItem.entries.map((entry, idx) => (
                    <div key={idx}>{entry.team} ({entry.year})</div>
                ))}
            </td>
        </>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Team performance records calculated per season.</p>

      {/* Season DPR Highlights */}
      {(highestDPRSeasonRecord?.entries.length > 0 || lowestDPRSeasonRecord?.entries.length > 0) && (
        <section className="mb-8 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200">
          <h4 className="text-lg font-bold text-blue-800 mb-3">Season DPR Highlights</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {highestDPRSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Highest Adjusted DPR</td>
                  {renderSingleRecordEntry(highestDPRSeasonRecord, formatDPR)}
                </tr>
              )}
              {lowestDPRSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Lowest Adjusted DPR</td>
                  {renderSingleRecordEntry(lowestDPRSeasonRecord, formatDPR)}
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Other Season Records */}
      {(mostWinsSeasonRecord?.entries.length > 0 ||
        mostLossesSeasonRecord?.entries.length > 0 ||
        bestAllPlayWinPctSeasonRecord?.entries.length > 0 ||
        mostWeeklyHighScoresSeasonRecord?.entries.length > 0 ||
        mostWeeklyTop3ScoresSeasonRecord?.entries.length > 0 ||
        mostBlowoutWinsSeasonRecord?.entries.length > 0 ||
        mostBlowoutLossesSeasonRecord?.entries.length > 0 ||
        mostSlimWinsSeasonRecord?.entries.length > 0 ||
        mostSlimLossesSeasonRecord?.entries.length > 0 ||
        mostPointsSeasonRecord?.entries.length > 0 ||
        fewestPointsSeasonRecord?.entries.length > 0
        ) && (
        <section className="mb-8 p-4 bg-green-50 rounded-lg shadow-sm border border-green-200">
          <h4 className="text-lg font-bold text-green-800 mb-3">Other Season Records</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {mostWinsSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Wins</td>
                  {renderSingleRecordEntry(mostWinsSeasonRecord)}
                </tr>
              )}
              {mostLossesSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Losses</td>
                  {renderSingleRecordEntry(mostLossesSeasonRecord)}
                </tr>
              )}
              {bestAllPlayWinPctSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Best All-Play Win %</td>
                  {renderSingleRecordEntry(bestAllPlayWinPctSeasonRecord, formatPercentage)}
                </tr>
              )}
              {mostWeeklyHighScoresSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Weekly High Scores</td>
                  {renderSingleRecordEntry(mostWeeklyHighScoresSeasonRecord)}
                </tr>
              )}
              {mostWeeklyTop3ScoresSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Weekly Top 3 Scores</td>
                  {renderSingleRecordEntry(mostWeeklyTop3ScoresSeasonRecord)}
                </tr>
              )}
              {mostBlowoutWinsSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Blowout Wins</td>
                  {renderSingleRecordEntry(mostBlowoutWinsSeasonRecord)}
                </tr>
              )}
              {mostBlowoutLossesSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Blowout Losses</td>
                  {renderSingleRecordEntry(mostBlowoutLossesSeasonRecord)}
                </tr>
              )}
              {mostSlimWinsSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Slim Wins</td>
                  {renderSingleRecordEntry(mostSlimWinsSeasonRecord)}
                </tr>
              )}
              {mostSlimLossesSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Slim Losses</td>
                  {renderSingleRecordEntry(mostSlimLossesSeasonRecord)}
                </tr>
              )}
              {mostPointsSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Most Points</td>
                  {renderSingleRecordEntry(mostPointsSeasonRecord, formatPoints)}
                </tr>
              )}
              {fewestPointsSeasonRecord?.entries.length > 0 && (
                <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                  <td className="py-2 px-3 text-sm font-semibold text-gray-800">Fewest Points</td>
                  {renderSingleRecordEntry(fewestPointsSeasonRecord, formatPoints)}
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}


      {sortedYears.map(year => (
        <div key={year} className="mb-6">
          <h4 className="text-lg font-bold text-gray-700 mb-3 bg-gray-50 p-2 rounded-md border-l-4 border-blue-500">{year} Season</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-b border-gray-200">Win %</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">All-Play Win %</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Weekly High Scores</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Weekly Top 3 Scores</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Blowout Wins</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Blowout Losses</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Slim Wins</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Slim Losses</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Adjusted DPR</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(seasonRecords[year]).sort().map(team => {
                  const record = seasonRecords[year][team];
                  return (
                    <tr key={team} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-3 text-sm text-gray-800">{team}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(record)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatPercentage(record.winPercentage)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatPercentage(record.allPlayWinPercentage)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.pointsFor.toFixed(2)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.weeklyHighestScoreCount}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.weeklyTop3Count}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.blowoutWins}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.blowoutLosses}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.slimWins}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{record.slimLosses}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{formatDPR(record.adjustedDPR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SeasonRecords;
