// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';

const LeagueRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [highestDPRCareerRecord, setHighestDPRCareerRecord] = useState(null);
  const [lowestDPRCareerRecord, setLowestDPRCareerRecord] = useState(null);

  // New state variables for other all-time records
  const [mostWinsCareerRecord, setMostWinsCareerRecord] = useState(null);
  const [mostLossesCareerRecord, setMostLossesCareerRecord] = useState(null);
  const [bestWinPctCareerRecord, setBestWinPctCareerRecord] = useState(null);
  const [bestAllPlayWinPctCareerRecord, setBestAllPlayWinPctCareerRecord] = useState(null);
  const [mostWeeklyHighScoresCareerRecord, setMostWeeklyHighScoresCareerRecord] = useState(null);
  const [mostWeeklyTop2ScoresCareerRecord, setMostWeeklyTop2ScoresCareerRecord] = useState(null);
  const [mostWinningSeasonsRecord, setMostWinningSeasonsRecord] = useState(null);
  const [mostLosingSeasonsRecord, setMostLosingSeasonsRecord] = useState(null);
  const [mostBlowoutWinsCareerRecord, setMostBlowoutWinsCareerRecord] = useState(null);
  const [mostBlowoutLossesCareerRecord, setMostBlowoutLossesCareerRecord] = useState(null);
  const [mostSlimWinsCareerRecord, setMostSlimWinsCareerRecord] = useState(null);
  const [mostSlimLossesCareerRecord, setMostSlimLossesCareerRecord] = useState(null);
  const [mostTotalPointsCareerRecord, setMostTotalPointsCareerRecord] = useState(null);
  const [mostPointsAgainstCareerRecord, setMostPointsAgainstCareerRecord] = useState(null); // New record

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setHighestDPRCareerRecord(null);
      setLowestDPRCareerRecord(null);
      setMostWinsCareerRecord(null);
      setMostLossesCareerRecord(null);
      setBestWinPctCareerRecord(null);
      setBestAllPlayWinPctCareerRecord(null);
      setMostWeeklyHighScoresCareerRecord(null);
      setMostWeeklyTop2ScoresCareerRecord(null);
      setMostWinningSeasonsRecord(null);
      setMostLosingSeasonsRecord(null);
      setMostBlowoutWinsCareerRecord(null);
      setMostBlowoutLossesCareerRecord(null);
      setMostSlimWinsCareerRecord(null);
      setMostSlimLossesCareerRecord(null);
      setMostTotalPointsCareerRecord(null);
      setMostPointsAgainstCareerRecord(null);
      return;
    }

    const newAllTimeRecords = {}; // { team: { wins, losses, ties, totalPointsFor, totalPointsAgainst, totalGames, careerWeeklyScores: [], careerRawDPR, adjustedDPR, allPlayWins, allPlayLosses, allPlayTies, weeklyHighestScoreCount, weeklyTop2Count, blowoutWins, blowoutLosses, slimWins, slimLosses, winningSeasonsCount, losingSeasonsCount } }
    const allWeeklyGameScores = {}; // { year: { week: [{ team: 'TeamA', score: 100 }, ...] } }
    const teamSeasonRecordsTemp = {}; // { team: { year: { wins, losses, ties } } }

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

      // Initialize structures for all-time records
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = {
            wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0,
            careerWeeklyScores: [],
            careerRawDPR: 0, adjustedDPR: 0,
            allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0,
            weeklyHighestScoreCount: 0, weeklyTop2Count: 0,
            blowoutWins: 0, blowoutLosses: 0, slimWins: 0, slimLosses: 0,
            winningSeasonsCount: 0, losingSeasonsCount: 0,
          };
        }
      });

      // Initialize structures for weekly game scores (for All-Play and Top N)
      if (!allWeeklyGameScores[year]) allWeeklyGameScores[year] = {};
      if (!allWeeklyGameScores[year][week]) allWeeklyGameScores[year][week] = [];
      allWeeklyGameScores[year][week].push({ team: team1, score: team1Score }, { team: team2, score: team2Score });

      // Initialize structures for team season records (for Most Winning/Losing Seasons)
      [team1, team2].forEach(team => {
        if (!teamSeasonRecordsTemp[team]) teamSeasonRecordsTemp[team] = {};
        if (!teamSeasonRecordsTemp[team][year]) teamSeasonRecordsTemp[team][year] = { wins: 0, losses: 0, ties: 0 };
      });


      // Update All-Time Records
      if (isTie) {
        newAllTimeRecords[team1].ties++;
        newAllTimeRecords[team2].ties++;
        teamSeasonRecordsTemp[team1][year].ties++;
        teamSeasonRecordsTemp[team2][year].ties++;
      } else if (team1Won) {
        newAllTimeRecords[team1].wins++;
        newAllTimeRecords[team2].losses++;
        teamSeasonRecordsTemp[team1][year].wins++;
        teamSeasonRecordsTemp[team2][year].losses++;
      } else { // team2Won
        newAllTimeRecords[team2].wins++;
        newAllTimeRecords[team1].losses++;
        teamSeasonRecordsTemp[team2][year].wins++;
        teamSeasonRecordsTemp[team1][year].losses++;
      }

      newAllTimeRecords[team1].totalPointsFor += team1Score;
      newAllTimeRecords[team2].totalPointsFor += team2Score;
      newAllTimeRecords[team1].totalPointsAgainst += team2Score; // Points against team1 is score of team2
      newAllTimeRecords[team2].totalPointsAgainst += team1Score; // Points against team2 is score of team1
      newAllTimeRecords[team1].totalGames++;
      newAllTimeRecords[team2].totalGames++;

      newAllTimeRecords[team1].careerWeeklyScores.push(team1Score);
      newAllTimeRecords[team2].careerWeeklyScores.push(team2Score);

      // Calculate Blowout/Slim Wins/Losses for both teams (All-Time)
      // Team 1 perspective
      if (team1Won) {
        const margin = team1Score - team2Score;
        const opponentScoreForPercentage = team2Score === 0 ? 1 : team2Score;
        if (margin / opponentScoreForPercentage > 0.40) newAllTimeRecords[team1].blowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newAllTimeRecords[team1].slimWins++;
      } else if (team2Score > team1Score) {
        const margin = team2Score - team1Score;
        const teamScoreForPercentage = team1Score === 0 ? 1 : team1Score;
        if (margin / teamScoreForPercentage > 0.40) newAllTimeRecords[team1].blowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newAllTimeRecords[team1].slimLosses++;
      }

      // Team 2 perspective
      if (team2Score > team1Score) {
        const margin = team2Score - team1Score;
        const opponentScoreForPercentage = team1Score === 0 ? 1 : team1Score;
        if (margin / opponentScoreForPercentage > 0.40) newAllTimeRecords[team2].blowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newAllTimeRecords[team2].slimWins++;
      } else if (team1Won) {
        const margin = team1Score - team2Score;
        const teamScoreForPercentage = team2Score === 0 ? 1 : team2Score;
        if (margin / teamScoreForPercentage > 0.40) newAllTimeRecords[team2].blowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newAllTimeRecords[team2].slimLosses++;
      }
    });

    // Second Pass: Calculate All-Play and Weekly Top N Scores
    Object.keys(allWeeklyGameScores).forEach(year => {
      Object.keys(allWeeklyGameScores[year]).forEach(week => {
        const allScoresInWeek = allWeeklyGameScores[year][week];
        const sortedScoresInWeek = [...allScoresInWeek].sort((a, b) => b.score - a.score);
        const highestScoreInWeek = sortedScoresInWeek.length > 0 ? sortedScoresInWeek[0].score : -Infinity;
        const top2Scores = sortedScoresInWeek.slice(0, Math.min(2, sortedScoresInWeek.length)).map(entry => entry.score); // Top 2

        allScoresInWeek.forEach(({ team, score }) => {
          if (!newAllTimeRecords[team]) return; // Should not happen

          // Update weekly highest score count
          if (score === highestScoreInWeek) {
            newAllTimeRecords[team].weeklyHighestScoreCount++;
          }
          // Update weekly top 2 score count
          if (top2Scores.includes(score)) {
            newAllTimeRecords[team].weeklyTop2Count++;
          }

          // Calculate all-play for this week (comparing current team's score to all other scores in the week)
          allScoresInWeek.forEach(({ team: otherTeam, score: otherScore }) => {
            if (team !== otherTeam) { // Don't compare against self
              if (score > otherScore) {
                newAllTimeRecords[team].allPlayWins++;
              } else if (score === otherScore) {
                newAllTimeRecords[team].allPlayTies++;
              } else {
                newAllTimeRecords[team].allPlayLosses++;
              }
            }
          });
        });
      });
    });


    // Third Pass: Calculate DPR and other aggregate career records
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
      if (isMin) {
        if (newValue < recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      } else { // Max
        if (newValue > recordObj.value) {
          recordObj.value = newValue;
          recordObj.entries = [entryDetails];
        } else if (newValue === recordObj.value) {
          recordObj.entries.push(entryDetails);
        }
      }
    };

    let currentMostWinsCareer = { value: 0, entries: [] };
    let currentMostLossesCareer = { value: 0, entries: [] };
    let currentBestWinPctCareer = { value: -Infinity, entries: [] };
    let currentBestAllPlayWinPctCareer = { value: -Infinity, entries: [] };
    let currentMostWeeklyHighScoresCareer = { value: 0, entries: [] };
    let currentMostWeeklyTop2ScoresCareer = { value: 0, entries: [] };
    let currentMostWinningSeasons = { value: 0, entries: [] };
    let currentMostLosingSeasons = { value: 0, entries: [] };
    let currentMostBlowoutWinsCareer = { value: 0, entries: [] };
    let currentMostBlowoutLossesCareer = { value: 0, entries: [] };
    let currentMostSlimWinsCareer = { value: 0, entries: [] };
    let currentMostSlimLossesCareer = { value: 0, entries: [] };
    let currentMostTotalPointsCareer = { value: 0, entries: [] };
    let currentMostPointsAgainstCareer = { value: 0, entries: [] };

    Object.keys(newAllTimeRecords).forEach(team => {
      const stats = newAllTimeRecords[team];
      if (stats.totalGames === 0) {
        return;
      }

      // Calculate career win percentages
      stats.winPercentage = ((stats.wins + (0.5 * stats.ties)) / stats.totalGames);
      const totalAllPlayGames = stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies;
      stats.allPlayWinPercentage = totalAllPlayGames > 0 ? ((stats.allPlayWins + (0.5 * stats.allPlayTies)) / totalAllPlayGames) : 0;

      // Determine team's own max and min score for their career
      const teamMaxScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
      const teamMinScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

      // Raw DPR Calculation
      stats.careerRawDPR = (
        (stats.totalPointsFor * 6) +
        ((teamMaxScoreOverall + teamMinScoreOverall) * 2) +
        ((stats.winPercentage * 200) * 2)
      ) / 10;
      totalRawDPROverall += stats.careerRawDPR;
      teamsWithValidCareerDPR++;

      // Count winning/losing seasons
      const teamSeasons = teamSeasonRecordsTemp[team];
      let winningSeasons = 0;
      let losingSeasons = 0;
      if (teamSeasons) {
        Object.keys(teamSeasons).forEach(year => {
          const seasonStats = teamSeasons[year];
          if (seasonStats.wins > seasonStats.losses) {
            winningSeasons++;
          } else if (seasonStats.losses > seasonStats.wins) {
            losingSeasons++;
          }
        });
      }
      stats.winningSeasonsCount = winningSeasons;
      stats.losingSeasonsCount = losingSeasons;

      // Update all-time records for display
      updateRecord(currentMostWinsCareer, stats.wins, { team, value: stats.wins });
      updateRecord(currentMostLossesCareer, stats.losses, { team, value: stats.losses });
      updateRecord(currentBestWinPctCareer, stats.winPercentage, { team, value: stats.winPercentage });
      updateRecord(currentBestAllPlayWinPctCareer, stats.allPlayWinPercentage, { team, value: stats.allPlayWinPercentage });
      updateRecord(currentMostWeeklyHighScoresCareer, stats.weeklyHighestScoreCount, { team, value: stats.weeklyHighestScoreCount });
      updateRecord(currentMostWeeklyTop2ScoresCareer, stats.weeklyTop2Count, { team, value: stats.weeklyTop2Count });
      updateRecord(currentMostWinningSeasons, stats.winningSeasonsCount, { team, value: stats.winningSeasonsCount });
      updateRecord(currentMostLosingSeasons, stats.losingSeasonsCount, { team, value: stats.losingSeasonsCount });
      updateRecord(currentMostBlowoutWinsCareer, stats.blowoutWins, { team, value: stats.blowoutWins });
      updateRecord(currentMostBlowoutLossesCareer, stats.blowoutLosses, { team, value: stats.blowoutLosses });
      updateRecord(currentMostSlimWinsCareer, stats.slimWins, { team, value: stats.slimWins });
      updateRecord(currentMostSlimLossesCareer, stats.slimLosses, { team, value: stats.slimLosses });
      updateRecord(currentMostTotalPointsCareer, stats.totalPointsFor, { team, value: stats.totalPointsFor });
      updateRecord(currentMostPointsAgainstCareer, stats.totalPointsAgainst, { team, value: stats.totalPointsAgainst });
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;

    let currentHighestDPRCareer = { value: -Infinity, entries: [] };
    let currentLowestDPRCareer = { value: Infinity, entries: [] };

    // Calculate Adjusted DPR for each team
    Object.keys(newAllTimeRecords).forEach(team => {
      const stats = newAllTimeRecords[team];
      if (avgRawDPROverall > 0) {
        stats.adjustedDPR = stats.careerRawDPR / avgRawDPROverall;
      } else {
        stats.adjustedDPR = 0;
      }

      // Update highest/lowest adjusted DPR career records
      if (stats.adjustedDPR !== 0) {
        updateRecord(currentHighestDPRCareer, stats.adjustedDPR, { team, dpr: stats.adjustedDPR });
        updateRecord(currentLowestDPRCareer, stats.adjustedDPR, { team, dpr: stats.adjustedDPR }, true);
      }
    });

    // Final sorting for record entries if there are ties
    const sortRecordEntries = (record) => {
        if (record && record.entries.length > 1) {
            record.entries.sort((a, b) => (a.team || '').localeCompare(b.team || ''));
        }
    };

    sortRecordEntries(currentHighestDPRCareer);
    sortRecordEntries(currentLowestDPRCareer);
    sortRecordEntries(currentMostWinsCareer);
    sortRecordEntries(currentMostLossesCareer);
    sortRecordEntries(currentBestWinPctCareer);
    sortRecordEntries(currentBestAllPlayWinPctCareer);
    sortRecordEntries(currentMostWeeklyHighScoresCareer);
    sortRecordEntries(currentMostWeeklyTop2ScoresCareer);
    sortRecordEntries(currentMostWinningSeasons);
    sortRecordEntries(currentMostLosingSeasons);
    sortRecordEntries(currentMostBlowoutWinsCareer);
    sortRecordEntries(currentMostBlowoutLossesCareer);
    sortRecordEntries(currentMostSlimWinsCareer);
    sortRecordEntries(currentMostSlimLossesCareer);
    sortRecordEntries(currentMostTotalPointsCareer);
    sortRecordEntries(currentMostPointsAgainstCareer);


    setAllTimeRecords(newAllTimeRecords); // Keep for potential future use if full table is reintroduced or other parts need it
    setHighestDPRCareerRecord(currentHighestDPRCareer);
    setLowestDPRCareerRecord(currentLowestDPRCareer);
    setMostWinsCareerRecord(currentMostWinsCareer);
    setMostLossesCareerRecord(currentMostLossesCareer);
    setBestWinPctCareerRecord(currentBestWinPctCareer);
    setBestAllPlayWinPctCareerRecord(currentBestAllPlayWinPctCareer);
    setMostWeeklyHighScoresCareerRecord(currentMostWeeklyHighScoresCareer);
    setMostWeeklyTop2ScoresCareerRecord(currentMostWeeklyTop2ScoresCareer);
    setMostWinningSeasonsRecord(currentMostWinningSeasons);
    setMostLosingSeasonsRecord(currentMostLosingSeasons);
    setMostBlowoutWinsCareerRecord(currentMostBlowoutWinsCareer);
    setMostBlowoutLossesCareerRecord(currentMostBlowoutLossesCareer);
    setMostSlimWinsCareerRecord(currentMostSlimWinsCareer);
    setMostSlimLossesCareerRecord(currentMostSlimLossesCareer);
    setMostTotalPointsCareerRecord(currentMostTotalPointsCareer);
    setMostPointsAgainstCareerRecord(currentMostPointsAgainstCareer);


  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to render record (W-L-T) for individual teams (not used for aggregate records display)
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

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

  // Generic render function for single record entries
  const renderSingleRecordEntry = (recordItem, label, formatFn = val => val) => {
    if (!recordItem || recordItem.entries.length === 0 || (typeof recordItem.value === 'number' && (recordItem.value === -Infinity || recordItem.value === Infinity))) {
        return (
            <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                <td className="py-2 px-3 text-sm font-semibold text-gray-800">{label}</td>
                <td colSpan="2" className="py-2 px-3 text-sm text-gray-500 text-center">N/A</td>
            </tr>
        );
    }
    const isFirstEntryEven = recordItem.entries.findIndex((_, idx) => idx === 0) % 2 === 0;
    return (
        <tr className={`border-b border-gray-100 last:border-b-0 ${isFirstEntryEven ? 'bg-white' : 'bg-gray-50'}`}>
            <td className="py-2 px-3 text-sm font-semibold text-gray-800">{label}</td>
            <td className="py-2 px-3 text-sm text-gray-800">{formatFn(recordItem.value)}</td>
            <td className="py-2 px-3 text-sm text-gray-700">
                {recordItem.entries.map((entry, idx) => (
                    <div key={idx}>{entry.team}</div> // No year for career records
                ))}
            </td>
        </tr>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">LEAGUE RECORDS - ( ALL-TIME )</h3>
      <p className="text-sm text-gray-600 mb-6">Overall league performance and ranking records across all seasons.</p>

      {/* All-Time Records Section */}
      <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
        <h4 className="text-lg font-bold text-gray-800 mb-3">All-Time Records Highlights</h4>
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
          <tbody>
            {renderSingleRecordEntry(highestDPRCareerRecord, 'Highest Adjusted DPR (Career)', formatDPR)}
            {renderSingleRecordEntry(lowestDPRCareerRecord, 'Lowest Adjusted DPR (Career)', formatDPR)}
            {renderSingleRecordEntry(mostWinsCareerRecord, 'Most Wins (Career)')}
            {renderSingleRecordEntry(mostLossesCareerRecord, 'Most Losses (Career)')}
            {renderSingleRecordEntry(bestWinPctCareerRecord, 'Best Win % (Career)', formatPercentage)}
            {renderSingleRecordEntry(bestAllPlayWinPctCareerRecord, 'Best All-Play Win % (Career)', formatPercentage)}
            {renderSingleRecordEntry(mostWeeklyHighScoresCareerRecord, 'Most Weekly High Scores (Career)')}
            {renderSingleRecordEntry(mostWeeklyTop2ScoresCareerRecord, 'Most Weekly Top 2 Scores (Career)')}
            {renderSingleRecordEntry(mostWinningSeasonsRecord, 'Most Winning Seasons')}
            {renderSingleRecordEntry(mostLosingSeasonsRecord, 'Most Losing Seasons')}
            {renderSingleRecordEntry(mostBlowoutWinsCareerRecord, 'Most Blowout Wins (Career)')}
            {renderSingleRecordEntry(mostBlowoutLossesCareerRecord, 'Most Blowout Losses (Career)')}
            {renderSingleRecordEntry(mostSlimWinsCareerRecord, 'Most Slim Wins (Career)')}
            {renderSingleRecordEntry(mostSlimLossesCareerRecord, 'Most Slim Losses (Career)')}
            {renderSingleRecordEntry(mostTotalPointsCareerRecord, 'Most Total Points (Career)', formatPoints)}
            {renderSingleRecordEntry(mostPointsAgainstCareerRecord, 'Most Points Against (Career)', formatPoints)}
          </tbody>
        </table>
      </section>

      {/* Removed the full All-Time Team Records table from here as it's now in DPRAnalysis for DPR ranking */}
    </div>
  );
};

export default LeagueRecords;
