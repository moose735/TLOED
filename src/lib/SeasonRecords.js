// src/lib/SeasonRecords.js
import React, { useState, useEffect } from 'react';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the new utility

const SeasonRecords = ({ historicalMatchups, getDisplayTeamName }) => {
  const [seasonRecords, setSeasonRecords] = useState({}); // This will hold raw aggregated seasonal stats
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

    // Use the centralized calculation logic to get all metrics
    const { seasonalMetrics, weeklyGameScoresByYearAndWeek } = calculateAllLeagueMetrics(historicalMatchups, getDisplayTeamName);

    // This map will still aggregate additional season-specific records not directly from `seasonalMetrics`
    const newSeasonRecordsAggregated = {}; // { year: { team: { ...stats } } }

    // --- Helper for finding top/bottom records ---
    let currentHighestDPRSeason = { value: -Infinity, entries: [] };
    let currentLowestDPRSeason = { value: Infinity, entries: [] };
    let currentMostWinsSeason = { value: 0, entries: [] };
    let currentMostLossesSeason = { value: 0, entries: [] };
    let currentBestAllPlayWinPctSeason = { value: 0, entries: [] }; // Initialized to 0 for percentage
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


    // First pass to aggregate basic seasonal stats and find records
    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = parseInt(match.year);
      const week = parseInt(match.week);
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
        return; // Skip invalid data
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;

      // Initialize team season record
      [team1, team2].forEach(team => {
        if (!newSeasonRecordsAggregated[year]) newSeasonRecordsAggregated[year] = {};
        if (!newSeasonRecordsAggregated[year][team]) {
          newSeasonRecordsAggregated[year][team] = {
            wins: 0, losses: 0, ties: 0, pointsFor: 0, totalGames: 0,
            blowoutWins: 0, blowoutLosses: 0, slimWins: 0, slimLosses: 0,
            weeklyHighestScoreCount: 0, weeklyTop3Count: 0, // Will be updated later in second pass
          };
        }
      });

      // Update basic win/loss/tie and points stats
      if (isTie) {
        newSeasonRecordsAggregated[year][team1].ties++;
        newSeasonRecordsAggregated[year][team2].ties++;
      } else if (team1Won) {
        newSeasonRecordsAggregated[year][team1].wins++;
        newSeasonRecordsAggregated[year][team2].losses++;
      } else { // team2Won
        newSeasonRecordsAggregated[year][team2].wins++;
        newSeasonRecordsAggregated[year][team1].losses++;
      }
      newSeasonRecordsAggregated[year][team1].pointsFor += team1Score;
      newSeasonRecordsAggregated[year][team2].pointsFor += team2Score;
      newSeasonRecordsAggregated[year][team1].totalGames++;
      newSeasonRecordsAggregated[year][team2].totalGames++;

      // Calculate Blowout/Slim Wins/Losses for both teams
      // Team 1 perspective
      if (team1Won) { // Team 1 won
        const margin = team1Score - team2Score;
        const opponentScoreForPercentage = team2Score === 0 ? 1 : team2Score; // Avoid division by zero
        if (margin / opponentScoreForPercentage > 0.40) newSeasonRecordsAggregated[year][team1].blowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newSeasonRecordsAggregated[year][team1].slimWins++;
      } else if (team2Score > team1Score) { // Team 1 lost (Team 2 won)
        const margin = team2Score - team1Score;
        const teamScoreForPercentage = team1Score === 0 ? 1 : team1Score; // Avoid division by zero
        if (margin / teamScoreForPercentage > 0.40) newSeasonRecordsAggregated[year][team1].blowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newSeasonRecordsAggregated[year][team1].slimLosses++;
      }

      // Team 2 perspective
      if (team2Score > team1Score) { // Team 2 won
        const margin = team2Score - team1Score;
        const opponentScoreForPercentage = team1Score === 0 ? 1 : team1Score; // Avoid division by zero
        if (margin / opponentScoreForPercentage > 0.40) newSeasonRecordsAggregated[year][team2].blowoutWins++;
        if (margin / opponentScoreForPercentage < 0.025) newSeasonRecordsAggregated[year][team2].slimWins++;
      } else if (team1Won) { // Team 2 lost (Team 1 won)
        const margin = team1Score - team2Score;
        const teamScoreForPercentage = team2Score === 0 ? 1 : team2Score; // Avoid division by zero
        if (margin / teamScoreForPercentage > 0.40) newSeasonRecordsAggregated[year][team2].blowoutLosses++;
        if (margin / teamScoreForPercentage < 0.025) newSeasonRecordsAggregated[year][team2].slimLosses++;
      }
    });

    // Second pass: Populate records based on the aggregated data and centralized metrics
    Object.keys(newSeasonRecordsAggregated).sort().forEach(year => {
      const teamsInSeason = Object.keys(newSeasonRecordsAggregated[year]);

      // Calculate weekly high/top3 scores for this year
      const weeksInYear = weeklyGameScoresByYearAndWeek[year];
      if (weeksInYear) { // Ensure weekly data exists for the year
          Object.keys(weeksInYear).forEach(week => {
            const allScoresInWeek = weeksInYear[week];
            const sortedScoresInWeek = [...allScoresInWeek].sort((a, b) => b.score - a.score); // Descending
            const highestScoreInWeek = sortedScoresInWeek.length > 0 ? sortedScoresInWeek[0].score : -Infinity;
            const top3Scores = sortedScoresInWeek.slice(0, Math.min(3, sortedScoresInWeek.length)).map(entry => entry.score);

            allScoresInWeek.forEach(({ team, score }) => {
              if (newSeasonRecordsAggregated[year][team]) { // Ensure team is initialized
                if (score === highestScoreInWeek) {
                  newSeasonRecordsAggregated[year][team].weeklyHighestScoreCount++;
                }
                if (top3Scores.includes(score)) {
                  newSeasonRecordsAggregated[year][team].weeklyTop3Count++;
                }
              }
            });
          });
      }


      teamsInSeason.forEach(team => {
        const stats = newSeasonRecordsAggregated[year][team]; // Stats aggregated from first pass
        const centralizedStats = seasonalMetrics[year]?.[team]; // Metrics from centralized calculations

        if (!centralizedStats) return; // Skip if no centralized metrics for this team/year

        // Update records using centralized values where applicable
        updateRecord(currentHighestDPRSeason, centralizedStats.adjustedDPR, { team, year: parseInt(year), dpr: centralizedStats.adjustedDPR });
        updateRecord(currentLowestDPRSeason, centralizedStats.adjustedDPR, { team, year: parseInt(year), dpr: centralizedStats.adjustedDPR }, true);
        updateRecord(currentMostWinsSeason, stats.wins, { team, year: parseInt(year), value: stats.wins });
        updateRecord(currentMostLossesSeason, stats.losses, { team, year: parseInt(year), value: stats.losses });
        updateRecord(currentBestAllPlayWinPctSeason, centralizedStats.allPlayWinPercentage, { team, year: parseInt(year), value: centralizedStats.allPlayWinPercentage });
        updateRecord(currentMostWeeklyHighScoresSeason, stats.weeklyHighestScoreCount, { team, year: parseInt(year), value: stats.weeklyHighestScoreCount });
        updateRecord(currentMostWeeklyTop3ScoresSeason, stats.weeklyTop3Count, { team, year: parseInt(year), value: stats.weeklyTop3Count });
        updateRecord(currentMostBlowoutWinsSeason, stats.blowoutWins, { team, year: parseInt(year), value: stats.blowoutWins });
        updateRecord(currentMostBlowoutLossesSeason, stats.blowoutLosses, { team, year: parseInt(year), value: stats.blowoutLosses });
        updateRecord(currentMostSlimWinsSeason, stats.slimWins, { team, year: parseInt(year), value: stats.slimWins });
        updateRecord(currentMostSlimLossesSeason, stats.slimLosses, { team, year: parseInt(year), value: stats.slimLosses });
        updateRecord(currentMostPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor });
        updateRecord(currentFewestPointsSeason, stats.pointsFor, { team, year: parseInt(year), value: stats.pointsFor }, true);
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
    sortRecordEntries(currentMostWeeklyTop3ScoresSeason);
    sortRecordEntries(currentMostBlowoutWinsSeason);
    sortRecordEntries(currentMostBlowoutLossesSeason);
    sortRecordEntries(currentMostSlimWinsSeason);
    sortRecordEntries(currentMostSlimLossesSeason);
    sortRecordEntries(currentMostPointsSeason);
    sortRecordEntries(currentFewestPointsSeason);


    setSeasonRecords(newSeasonRecordsAggregated); // Keep this for other potential uses
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
    // No specific background logic for these internal rows, let parent handle it or keep default.
    return (
        <tr className={`border-b border-gray-100 last:border-b-0`}>
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
              {/* Using a fixed background for rows in this table for simplicity and consistent appearance */}
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(highestDPRSeasonRecord, 'Highest Adjusted DPR', formatDPR)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(lowestDPRSeasonRecord, 'Lowest Adjusted DPR', formatDPR)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostWinsSeasonRecord, 'Most Wins')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostLossesSeasonRecord, 'Most Losses')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(bestAllPlayWinPctSeasonRecord, 'Best All-Play Win %', formatPercentage)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostWeeklyHighScoresSeasonRecord, 'Most Weekly High Scores')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostWeeklyTop3ScoresSeasonRecord, 'Most Weekly Top 3 Scores')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostBlowoutWinsSeasonRecord, 'Most Blowout Wins')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostBlowoutLossesSeasonRecord, 'Most Blowout Losses')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostSlimWinsSeasonRecord, 'Most Slim Wins')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(mostSlimLossesSeasonRecord, 'Most Slim Losses')}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-gray-50">
                {renderSingleRecordEntry(mostPointsSeasonRecord, 'Most Points', formatPoints)}
              </tr>
              <tr className="border-b border-gray-100 last:border-b-0 bg-white">
                {renderSingleRecordEntry(fewestPointsSeasonRecord, 'Fewest Points', formatPoints)}
              </tr>
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-center text-gray-600">No season records available to display.</p>
      )}
    </div>
  );
};

export default SeasonRecords;
