// src/lib/LeagueRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

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
  const [mostPointsAgainstCareerRecord, setMostPointsAgainstCareerRecord] = useState(null);


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

    // Use the centralized calculation logic to get career DPR data
    const { careerDPRData, seasonalMetrics, weeklyGameScoresByYearAndWeek } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // Initialize structures for other career records
    const newAllTimeRecords = {}; // { team: { wins, losses, ties, totalGames, totalPointsFor, totalPointsAgainst, totalWeeklyHighScores, totalWeeklyTop2Scores, totalBlowoutWins, totalBlowoutLosses, totalSlimWins, totalSlimLosses, seasonsPlayed, winningSeasons, losingSeasons } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(year) || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid matchups
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

      // Initialize team's all-time record if not present
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = {
            wins: 0, losses: 0, ties: 0, totalGames: 0,
            totalPointsFor: 0, totalPointsAgainst: 0,
            totalWeeklyHighScores: 0, totalWeeklyTop2Scores: 0,
            totalBlowoutWins: 0, totalBlowoutLosses: 0,
            totalSlimWins: 0, totalSlimLosses: 0,
            seasonsPlayed: new Set(),
            winningSeasons: 0,
            losingSeasons: 0,
          };
        }
        newAllTimeRecords[team].seasonsPlayed.add(year); // Track seasons played
      });

      // Update basic win/loss/tie and points stats
      if (isTie) {
        newAllTimeRecords[team1].ties++;
        newAllTimeRecords[team2].ties++;
      } else if (team1Won) {
        newAllTimeRecords[team1].wins++;
        newAllTimeRecords[team2].losses++;
      } else { // team2Won
        newAllTimeRecords[team2].wins++;
        newAllTimeRecords[team1].losses++;
      }
      newAllTimeRecords[team1].totalPointsFor += team1Score;
      newAllTimeRecords[team2].totalPointsFor += team2Score;
      newAllTimeRecords[team1].totalPointsAgainst += team2Score;
      newAllTimeRecords[team2].totalPointsAgainst += team1Score;
      newAllTimeRecords[team1].totalGames++;
      newAllTimeRecords[team2].totalGames++;

      // Blowout/Slim Wins/Losses - accumulate from individual matches
      // Team 1 perspective
      if (team1Won) {
        const margin = team1Score - team2Score;
        const opponentScoreForPercentage = team2Score === 0 ? 1 : team2Score;
        if (margin / opponentScoreForPercentage > 0.40) newAllTimeRecords[team1].totalBlowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newAllTimeRecords[team1].totalSlimWins++;
      } else if (team2Won) { // Team 1 lost
        const margin = team2Score - team1Score;
        const teamScoreForPercentage = team1Score === 0 ? 1 : team1Score;
        if (margin / teamScoreForPercentage > 0.40) newAllTimeRecords[team1].totalBlowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newAllTimeRecords[team1].totalSlimLosses++;
      }
      // Team 2 perspective
      if (team2Won) {
        const margin = team2Score - team1Score;
        const opponentScoreForPercentage = team1Score === 0 ? 1 : team1Score;
        if (margin / opponentScoreForPercentage > 0.40) newAllTimeRecords[team2].totalBlowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newAllTimeRecords[team2].totalSlimWins++;
      } else if (team1Won) { // Team 2 lost
        const margin = team1Score - team2Score;
        const teamScoreForPercentage = team2Score === 0 ? 1 : team2Score;
        if (margin / teamScoreForPercentage > 0.40) newAllTimeRecords[team2].totalBlowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newAllTimeRecords[team2].totalSlimLosses++;
      }
    });

    // Post-process seasonal data to count winning/losing seasons
    Object.keys(seasonalMetrics).forEach(year => {
      Object.keys(seasonalMetrics[year]).forEach(team => {
        const seasonStats = seasonalMetrics[year][team];
        const totalGames = seasonStats.wins + seasonStats.losses + seasonStats.ties;
        if (totalGames > 0) {
          const winPercentage = (seasonStats.wins + 0.5 * seasonStats.ties) / totalGames;
          if (newAllTimeRecords[team]) { // Ensure the team exists in overall records
            if (winPercentage > 0.5) {
              newAllTimeRecords[team].winningSeasons++;
            } else if (winPercentage < 0.5) {
              newAllTimeRecords[team].losingSeasons++;
            }
          }
        }
        // Accumulate weekly high/top2 scores from seasonal metrics
        // This requires an enhancement to calculateAllLeagueMetrics to also return these per team per season
        // For now, these will remain 0 unless calculations.js is updated.
        // Assuming seasonalMetrics structure for now does not contain these.
      });
    });

    // Populate weekly high score counts from weeklyGameScoresByYearAndWeek
    Object.keys(weeklyGameScoresByYearAndWeek).forEach(year => {
      Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
        const allScoresInWeek = weeklyGameScoresByYearAndWeek[year][week];
        const sortedScoresInWeek = [...allScoresInWeek].sort((a, b) => b.score - a.score);
        const highestScoreInWeek = sortedScoresInWeek.length > 0 ? sortedScoresInWeek[0].score : -Infinity;
        const top2Scores = sortedScoresInWeek.slice(0, Math.min(2, sortedScoresInWeek.length)).map(entry => entry.score);

        allScoresInWeek.forEach(({ team, score }) => {
          if (newAllTimeRecords[team]) {
            if (score === highestScoreInWeek) {
              newAllTimeRecords[team].totalWeeklyHighScores++;
            }
            if (top2Scores.includes(score)) { // For top 2 scores
                newAllTimeRecords[team].totalWeeklyTop2Scores++;
            }
          }
        });
      });
    });


    // Initialize record holders
    let currentHighestDPRCareer = { value: -Infinity, entries: [] };
    let currentLowestDPRCareer = { value: Infinity, entries: [] };
    let currentMostWinsCareer = { value: 0, entries: [] };
    let currentMostLossesCareer = { value: 0, entries: [] };
    let currentBestWinPctCareer = { value: 0, entries: [] };
    let currentBestAllPlayWinPctCareer = { value: 0, entries: [] };
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

    // Populate records from newAllTimeRecords and careerDPRData
    Object.keys(newAllTimeRecords).forEach(team => {
      const stats = newAllTimeRecords[team];
      const totalGames = stats.totalGames;

      // Career Win Percentage
      const winPercentage = totalGames > 0 ? ((stats.wins + (0.5 * stats.ties)) / totalGames) : 0;

      // Career All-Play Win Percentage (requires summing up allPlayWins/Losses/Ties from seasonalMetrics)
      let careerAllPlayWins = 0;
      let careerAllPlayLosses = 0;
      let careerAllPlayTies = 0;
      Object.keys(seasonalMetrics).forEach(year => {
          if (seasonalMetrics[year][team]) {
              // Assume seasonalMetrics provides allPlayWins, Losses, Ties if needed directly.
              // For simplicity, re-run all-play calculation if not available in seasonalMetrics for career.
              // To avoid re-calculation, calculateAllLeagueMetrics should return these summarized.
              // For now, let's derive it from total career games vs other teams in history.
              // A more accurate all-play career % would be the sum of all-play wins / total all-play games across all seasons.
              // For now, using a simplified average of seasonal all-play percentages is easier.
              // This part would ideally be moved into calculateAllLeagueMetrics for career level.
              careerAllPlayWins += (seasonalMetrics[year][team]?.allPlayWins || 0);
              careerAllPlayLosses += (seasonalMetrics[year][team]?.allPlayLosses || 0);
              careerAllPlayTies += (seasonalMetrics[year][team]?.allPlayTies || 0);
          }
      });
      const totalCareerAllPlayGames = careerAllPlayWins + careerAllPlayLosses + careerAllPlayTies;
      const careerAllPlayWinPercentage = totalCareerAllPlayGames > 0 ? ((careerAllPlayWins + (0.5 * careerAllPlayTies)) / totalCareerAllPlayGames) : 0;


      // Find DPR for this team from careerDPRData (already calculated and sorted)
      const teamDPRData = careerDPRData.find(dprEntry => dprEntry.team === team);
      if (teamDPRData && typeof teamDPRData.dpr === 'number' && !isNaN(teamDPRData.dpr)) {
        updateRecord(currentHighestDPRCareer, teamDPRData.dpr, { team, dpr: teamDPRData.dpr });
        updateRecord(currentLowestDPRCareer, teamDPRData.dpr, { team, dpr: teamDPRData.dpr }, true);
      }

      updateRecord(currentMostWinsCareer, stats.wins, { team, wins: stats.wins });
      updateRecord(currentMostLossesCareer, stats.losses, { team, losses: stats.losses });
      updateRecord(currentBestWinPctCareer, winPercentage, { team, winPercentage: winPercentage });
      updateRecord(currentBestAllPlayWinPctCareer, careerAllPlayWinPercentage, { team, allPlayWinPercentage: careerAllPlayWinPercentage });
      updateRecord(currentMostWeeklyHighScoresCareer, stats.totalWeeklyHighScores, { team, count: stats.totalWeeklyHighScores });
      updateRecord(currentMostWeeklyTop2ScoresCareer, stats.totalWeeklyTop2Scores, { team, count: stats.totalWeeklyTop2Scores });
      updateRecord(currentMostWinningSeasons, stats.winningSeasons, { team, count: stats.winningSeasons });
      updateRecord(currentMostLosingSeasons, stats.losingSeasons, { team, count: stats.losingSeasons });
      updateRecord(currentMostBlowoutWinsCareer, stats.totalBlowoutWins, { team, count: stats.totalBlowoutWins });
      updateRecord(currentMostBlowoutLossesCareer, stats.totalBlowoutLosses, { team, count: stats.totalBlowoutLosses });
      updateRecord(currentMostSlimWinsCareer, stats.totalSlimWins, { team, count: stats.totalSlimWins });
      updateRecord(currentMostSlimLossesCareer, stats.totalSlimLosses, { team, count: stats.totalSlimLosses });
      updateRecord(currentMostTotalPointsCareer, stats.totalPointsFor, { team, points: stats.totalPointsFor });
      updateRecord(currentMostPointsAgainstCareer, stats.totalPointsAgainst, { team, points: stats.totalPointsAgainst });
    });

    // Final sorting for all-time record entries if there are ties
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

    setAllTimeRecords(newAllTimeRecords);
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
    // Determine background color based on the index of the first entry, ensuring consistent stripes for tied records
    const isFirstEntryEven = (recordItem.entries.length > 0 && recordItem.entries.some((entry, idx) => {
        // Need a way to reliably get the "group index" for the row. This is tricky with multiple entries.
        // For simplicity, let's just make the entire "record group" a single color based on its position in recordsToDisplay
        // Or, use a fixed color for all these highlight rows. Let's use bg-gray-50 consistently.
        return true; // Will be overridden by parent mapping
    })) ? 'bg-white' : 'bg-gray-50'; // This logic is flawed here, will be determined by mapping in the render loop

    return (
        <tr className={`border-b border-gray-100 last:border-b-0`}>
            <td className="py-2 px-3 text-sm font-semibold text-gray-800">{label}</td>
            <td className="py-2 px-3 text-sm text-gray-800">{formatFn(recordItem.value)}</td>
            <td className="py-2 px-3 text-sm text-gray-700">
                {recordItem.entries.map((entry, idx) => (
                    <div key={idx}>{entry.team}</div>
                ))}
            </td>
        </tr>
    );
  };


  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">LEAGUE RECORDS - ( CAREER )</h3>
      <p className="text-sm text-gray-600 mb-6">All-time career records for teams in the league.</p>

      {/* All-Time Career Records */}
      {(highestDPRCareerRecord?.entries.length > 0 || lowestDPRCareerRecord?.entries.length > 0 ||
        mostWinsCareerRecord?.entries.length > 0 ||
        mostLossesCareerRecord?.entries.length > 0 ||
        bestWinPctCareerRecord?.entries.length > 0 ||
        bestAllPlayWinPctCareerRecord?.entries.length > 0 ||
        mostWeeklyHighScoresCareerRecord?.entries.length > 0 ||
        mostWeeklyTop2ScoresCareerRecord?.entries.length > 0 ||
        mostWinningSeasonsRecord?.entries.length > 0 ||
        mostLosingSeasonsRecord?.entries.length > 0 ||
        mostBlowoutWinsCareerRecord?.entries.length > 0 ||
        mostBlowoutLossesCareerRecord?.entries.length > 0 ||
        mostSlimWinsCareerRecord?.entries.length > 0 ||
        mostSlimLossesCareerRecord?.entries.length > 0 ||
        mostTotalPointsCareerRecord?.entries.length > 0 ||
        mostPointsAgainstCareerRecord?.entries.length > 0
        ) ? (
        <section className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-lg font-bold text-gray-800 mb-3">Career Records Highlights</h4>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
            <tbody>
              {/* Using a fixed background for rows in this table for simplicity and consistent appearance */}
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(highestDPRCareerRecord, 'Highest Adjusted DPR (Career)', formatDPR)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(lowestDPRCareerRecord, 'Lowest Adjusted DPR (Career)', formatDPR)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostWinsCareerRecord, 'Most Wins (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostLossesCareerRecord, 'Most Losses (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(bestWinPctCareerRecord, 'Best Win % (Career)', formatPercentage)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(bestAllPlayWinPctCareerRecord, 'Best All-Play Win % (Career)', formatPercentage)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostWeeklyHighScoresCareerRecord, 'Most Weekly High Scores (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostWeeklyTop2ScoresCareerRecord, 'Most Weekly Top 2 Scores (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostWinningSeasonsRecord, 'Most Winning Seasons')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostLosingSeasonsRecord, 'Most Losing Seasons')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostBlowoutWinsCareerRecord, 'Most Blowout Wins (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostBlowoutLossesCareerRecord, 'Most Blowout Losses (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostSlimWinsCareerRecord, 'Most Slim Wins (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostSlimLossesCareerRecord, 'Most Slim Losses (Career)')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostTotalPointsCareerRecord, 'Most Total Points (Career)', formatPoints)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostPointsAgainstCareerRecord, 'Most Points Against (Career)', formatPoints)}
              </tr>
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-center text-gray-600">No career records available to display.</p>
      )}
    </div>
  );
};

export default LeagueRecords;
