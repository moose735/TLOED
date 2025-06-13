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

    const newSeasonRecords = {}; // { year: { team: { wins, losses, ties, pointsFor, totalGames, weeklyScores: [], rawDPR, adjustedDPR, allPlayWins, allPlayLosses, allPlayTies, weeklyHighestScoreCount, weeklyTop3Count, blowoutWins, blowoutLosses, slimWins, slimLosses, winPercentage, allPlayWinPercentage } } }
    const weeklyGameScoresByYear = {}; // { year: { week: [{ team: 'TeamA', score: 100 }, ...] } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const week = match.week;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.log("DPR DEBUG: Skipping invalid matchup data:", match);
        return; // Skip invalid data
      }

      console.log(`DPR DEBUG: Processing matchup - Year: ${year}, Week: ${week}, Team1: ${team1} (${team1Score}), Team2: ${team2} (${team2Score})`);

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize structures for year and teams
      [team1, team2].forEach(team => {
        if (!newSeasonRecords[year]) {
          newSeasonRecords[year] = {};
          weeklyGameScoresByYear[year] = {};
        }
        if (!newSeasonRecords[year][team]) {
          newSeasonRecords[year][team] = {
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            totalGames: 0,
            weeklyScores: [], // To store individual team's weekly scores
            allPlayWins: 0,
            allPlayLosses: 0,
            allPlayTies: 0,
            weeklyHighestScoreCount: 0,
            weeklyTop3Count: 0,
            blowoutWins: 0,
            blowoutLosses: 0,
            slimWins: 0,
            slimLosses: 0,
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

      // Store individual team's weekly scores for DPR calculation
      newSeasonRecords[year][team1].weeklyScores.push(team1Score);
      newSeasonRecords[year][team2].weeklyScores.push(team2Score);

      console.log(`DPR DEBUG: Initialized/Updated stats for ${team1} in ${year}: Wins: ${newSeasonRecords[year][team1].wins}, Losses: ${newSeasonRecords[year][team1].losses}, Ties: ${newSeasonRecords[year][team1].ties}, PointsFor: ${newSeasonRecords[year][team1].pointsFor}, TotalGames: ${newSeasonRecords[year][team1].totalGames}, WeeklyScores: [${newSeasonRecords[year][team1].weeklyScores.join(', ')}]`);
      console.log(`DPR DEBUG: Initialized/Updated stats for ${team2} in ${year}: Wins: ${newSeasonRecords[year][team2].wins}, Losses: ${newSeasonRecords[year][team2].losses}, Ties: ${newSeasonRecords[year][team2].ties}, PointsFor: ${newSeasonRecords[year][team2].pointsFor}, TotalGames: ${newSeasonRecords[year][team2].totalGames}, WeeklyScores: [${newSeasonRecords[year][team2].weeklyScores.join(', ')}]`);


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
    let currentMostWeeklyTop3ScoresSeason = { value: 0, entries: [] };
    let currentMostBlowoutWinsSeason = { value: 0, entries: [] };
    let currentMostBlowoutLossesSeason = { value: 0, entries: [] };
    let currentMostSlimWinsSeason = { value: 0, entries: [] };
    let currentMostSlimLossesSeason = { value: 0, entries: [] };
    let currentMostPointsSeason = { value: 0, entries: [] };
    let currentFewestPointsSeason = { value: Infinity, entries: [] };


    const updateRecord = (recordObj, newValue, entryDetails, isMin = false) => {
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

      let totalRawDPRForSeason = 0;
      let teamsWithValidDPR = 0;

      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        const totalGames = stats.totalGames;

        if (totalGames === 0) {
          console.log(`DPR DEBUG: Skipping team ${team} in ${year} due to 0 total games.`);
          return;
        }

        // Determine team's own max and min score for the season
        const teamMaxScoreInSeason = stats.weeklyScores.length > 0 ? Math.max(...stats.weeklyScores) : 0;
        const teamMinScoreInSeason = stats.weeklyScores.length > 0 ? Math.min(...stats.weeklyScores) : 0;
        console.log(`DPR DEBUG:   Team's weekly scores for ${team} in ${year}: [${stats.weeklyScores.join(', ')}]`);
        console.log(`DPR DEBUG:   Team Max/Min Score for ${team} in ${year}: Max=${teamMaxScoreInSeason.toFixed(2)}, Min=${teamMinScoreInSeason.toFixed(2)}`);


        // Calculate actual win percentage
        stats.winPercentage = ((stats.wins + (0.5 * stats.ties)) / totalGames);
        console.log(`DPR DEBUG:   Win Percentage for ${team} in ${year}: ${(stats.winPercentage * 100).toFixed(1)}% (${stats.wins}-${stats.losses}-${stats.ties})`);


        // Calculate All-Play Win Percentage
        const totalAllPlayGames = stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies;
        stats.allPlayWinPercentage = totalAllPlayGames > 0 ? ((stats.allPlayWins + (0.5 * stats.allPlayTies)) / totalAllPlayGames) : 0;

        // Raw DPR Calculation: ((Points Scored * 6) + ((Points Scored Max + Points Scored Min) * 2) + ((Win% * 200) * 2)) / 10
        const pointsScoredComponent = stats.pointsFor * 6;
        const maxMinComponent = (teamMaxScoreInSeason + teamMinScoreInSeason) * 2;
        const winPercentageComponent = (stats.winPercentage * 200) * 2;
        const numerator = pointsScoredComponent + maxMinComponent + winPercentageComponent;
        stats.rawDPR = numerator / 10;

        console.log(`DPR DEBUG:   Raw DPR Intermediate parts for ${team} in ${year}:`);
        console.log(`DPR DEBUG:     Points Scored * 6: ${stats.pointsFor.toFixed(2)} * 6 = ${pointsScoredComponent.toFixed(2)}`);
        console.log(`DPR DEBUG:     (Max + Min) * 2: (${teamMaxScoreInSeason.toFixed(2)} + ${teamMinScoreInSeason.toFixed(2)}) * 2 = ${maxMinComponent.toFixed(2)}`);
        console.log(`DPR DEBUG:     (Win% * 200) * 2: (${(stats.winPercentage * 100).toFixed(1)}% * 200) * 2 = ${winPercentageComponent.toFixed(2)}`);
        console.log(`DPR DEBUG:     Numerator: ${numerator.toFixed(2)}`);
        console.log(`DPR DEBUG:   Raw DPR for ${team} in ${year}: ${stats.rawDPR.toFixed(3)}`);

        totalRawDPRForSeason += stats.rawDPR;
        teamsWithValidDPR++;

        // Update league-wide season records
        updateRecord(currentMostWinsSeason, stats.wins, { team, year: parseInt(year), value: stats.wins });
        updateRecord(currentMostLossesSeason, stats.losses, { team, year: parseInt(year), value: stats.losses });
        updateRecord(currentBestAllPlayWinPctSeason, stats.allPlayWinPercentage, { team, year: parseInt(year), value: stats.allPlayWinPercentage });
        updateRecord(currentMostWeeklyHighScoresSeason, stats.weeklyHighestScoreCount, { team, year: parseInt(year), value: stats.weeklyHighestScoreCount });
        updateRecord(currentMostWeeklyTop3ScoresSeason, stats.weeklyTop3Count, { team, year: parseInt(year), value: stats.weeklyTop3Count });
        updateRecord(currentMostBlowoutWinsSeason, stats.blowoutWins, { team, year: parseInt(year), value: stats.blowoutWins });
        updateRecord(currentMostBlowoutLossesSeason, stats.blowoutLosses, { team, year: parseInt(year), value: stats.blowoutLosses });
        updateRecord(currentMostSlimWinsSeason, stats.slimWins, { team, year: parseInt(year), value: stats.slimWins });
        updateRecord(currentMostSlimLossesSeason, stats.slimLosses, { team, year: parseInt(year), value: stats.slimLosses });
        updateRecord(currentMostPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor });
        updateRecord(currentFewestPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor }, true);
      });

      const avgRawDPRForSeason = teamsWithValidDPR > 0 ? totalRawDPRForSeason / teamsWithValidDPR : 0;
      console.log(`DPR DEBUG: Season ${year} Raw DPR totals: Total=${totalRawDPRForSeason.toFixed(2)}, Valid Teams=${teamsWithValidDPR}, Avg=${avgRawDPRForSeason.toFixed(3)}`);


      teamsInSeason.forEach(team => {
        const stats = newSeasonRecords[year][team];
        if (avgRawDPRForSeason > 0) {
          stats.adjustedDPR = stats.rawDPR / avgRawDPRForSeason;
        } else {
          stats.adjustedDPR = 0;
        }

        console.log(`DPR DEBUG:   Adjusted DPR for ${team} in ${year}: ${stats.adjustedDPR.toFixed(3)}`);

        // Update highest/lowest adjusted DPR season records
        if (stats.adjustedDPR !== 0) {
          updateRecord(currentHighestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR });
          updateRecord(currentLowestDPRSeason, stats.adjustedDPR, { team, year: parseInt(year), dpr: stats.adjustedDPR }, true);
        }
      });
      console.log(`DPR DEBUG: Current Highest Adjusted DPR Season Record: Value=${currentHighestDPRSeason.value.toFixed(3)}, Entries=${JSON.stringify(currentHighestDPRSeason.entries)}`);
      console.log(`DPR DEBUG: Current Lowest Adjusted DPR Season Record: Value=${currentLowestDPRSeason.value.toFixed(3)}, Entries=${JSON.stringify(currentLowestDPRSeason.entries)}`);
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
    sortRecordEntries(currentMostWeeklyTop3ScoresSeason);
    sortRecordEntries(currentMostBlowoutWinsSeason);
    sortRecordEntries(currentMostBlowoutLossesSeason);
    sortRecordEntries(currentMostSlimWinsSeason);
    sortRecordEntries(currentMostSlimLossesSeason);
    sortRecordEntries(currentMostPointsSeason);
    sortRecordEntries(currentFewestPointsSeason);


    setSeasonRecords(newSeasonRecords);
    setHighestDPRSeasonRecord(currentHighestDPRSeason);
    setLowestDPRSeasonRecord(currentLowestDPRSeason);
    setMostWinsSeasonRecord(currentMostWinsSeason);
    setMostLossesSeasonRecord(currentMostLossesSeason);
    setBestAllPlayWinPctSeasonRecord(currentBestAllPlayWinPctSeason);
    setMostWeeklyHighScoresSeasonRecord(currentMostWeeklyHighScoresSeason);
    setMostWeeklyTop3ScoresSeasonRecord(currentMostWeeklyTop3ScoresSeason);
    setMostBlowoutWinsSeasonRecord(currentMostBlowoutWinsSeason);
    setMostBlowoutLossesSeasonRecord(currentMostBlowoutLossesSeason);
    setMostSlimWinsSeasonRecord(currentMostSlimWinsSeason);
    setMostSlimLossesSeasonRecord(currentMostSlimLossesSeason);
    setMostPointsSeasonRecord(currentMostPointsSeason);
    setFewestPointsSeasonRecord(currentFewestPointsSeason);


  }, [historicalMatchups, getDisplayTeamName]);

  // Helper to render record (W-L-T)
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
                    <div key={idx}>{entry.team} ({entry.year})</div>
                ))}
            </td>
        </tr>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">SEASON RECORDS - ( SEASON )</h3>
      <p className="text-sm text-gray-600 mb-6">Team performance records calculated per season.</p>

      {/* All Season Records, including DPR Highlights */}
      {(highestDPRSeasonRecord?.entries.length > 0 || lowestDPRSeasonRecord?.entries.length > 0 ||
        mostWinsSeasonRecord?.entries.length > 0 ||
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
        ) ? (
        <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-lg font-bold text-gray-800 mb-3">Season Records Highlights</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {renderSingleRecordEntry(highestDPRSeasonRecord, 'Highest Adjusted DPR', formatDPR)}
              {renderSingleRecordEntry(lowestDPRSeasonRecord, 'Lowest Adjusted DPR', formatDPR)}
              {renderSingleRecordEntry(mostWinsSeasonRecord, 'Most Wins')}
              {renderSingleRecordEntry(mostLossesSeasonRecord, 'Most Losses')}
              {renderSingleRecordEntry(bestAllPlayWinPctSeasonRecord, 'Best All-Play Win %', formatPercentage)}
              {renderSingleRecordEntry(mostWeeklyHighScoresSeasonRecord, 'Most Weekly High Scores')}
              {renderSingleRecordEntry(mostWeeklyTop3ScoresSeasonRecord, 'Most Weekly Top 3 Scores')}
              {renderSingleRecordEntry(mostBlowoutWinsSeasonRecord, 'Most Blowout Wins')}
              {renderSingleRecordEntry(mostBlowoutLossesSeasonRecord, 'Most Blowout Losses')}
              {renderSingleRecordEntry(mostSlimWinsSeasonRecord, 'Most Slim Wins')}
              {renderSingleRecordEntry(mostSlimLossesSeasonRecord, 'Most Slim Losses')}
              {renderSingleRecordEntry(mostPointsSeasonRecord, 'Most Points', formatPoints)}
              {renderSingleRecordEntry(fewestPointsSeasonRecord, 'Fewest Points', formatPoints)}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-center text-gray-600">No season records available to display.</p>
      )}

      {/* Removed the section for sortedYears.map (yearly standings) */}
    </div>
  );
};

export default SeasonRecords;
