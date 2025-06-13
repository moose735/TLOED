// src/lib/LeagueHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { HISTORICAL_MATCHUPS_API_URL, NICKNAME_TO_SLEEPER_USER } from '../config';

const LeagueHistory = () => {
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derived states for processed data
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [seasonRecords, setSeasonRecords] = useState({});
  const [headToHeadRecords, setHeadToHeadRecords] = useState({});

  // Helper to map team names using NICKNAME_TO_SLEEPER_USER from config
  const getMappedTeamName = useCallback((originalName) => {
    if (!originalName) return originalName;
    const lowerOriginalName = String(originalName).toLowerCase();
    // Find the original name in the NICKNAME_TO_SLEEPER_USER values
    const foundCustomName = Object.keys(NICKNAME_TO_SLEEPER_USER).find(
        key => String(NICKNAME_TO_SLEEPER_USER[key]).toLowerCase() === lowerOriginalName
    );
    // If a match is found, return the custom name, otherwise return the original name
    return foundCustomName || originalName;
}, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchMatchups = async () => {
      if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_NEW_HISTORICAL_MATCHUPS_APPS_SCRIPT_URL') {
        setLoading(false);
        setError("Please update HISTORICAL_MATCHUPS_API_URL in config.js with your actual Apps Script URL.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setHistoricalMatchups(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error("Error fetching historical matchups:", err);
        setError(
          `Failed to fetch historical matchups: ${err.message}. ` +
          `Ensure your Apps Script URL (${HISTORICAL_MATCHUPS_API_URL}) is correct and publicly accessible.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMatchups();
  }, [HISTORICAL_MATCHUPS_API_URL]);

  // --- Data Processing (when historicalMatchups changes) ---
  useEffect(() => {
    if (historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setSeasonRecords({});
      setHeadToHeadRecords({});
      return;
    }

    const newAllTimeRecords = {};
    const newSeasonRecords = {}; // { year: { team: { wins, losses, ties } } }
    const newHeadToHeadRecords = {}; // { team1: { team2: { wins, losses, ties } } }

    historicalMatchups.forEach(match => {
      // Ensure team names exist and are strings before processing
      const team1 = getMappedTeamName(String(match.team1 || '').trim());
      const team2 = getMappedTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      // Skip if essential data is missing or invalid
      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

      // Initialize records if team not seen before
      [team1, team2].forEach(team => {
        if (!newAllTimeRecords[team]) {
          newAllTimeRecords[team] = { wins: 0, losses: 0, ties: 0 };
        }
        if (!newSeasonRecords[year]) {
          newSeasonRecords[year] = {};
        }
        if (!newSeasonRecords[year][team]) {
          newSeasonRecords[year][team] = { wins: 0, losses: 0, ties: 0 };
        }
      });

      // Update All-Time Records
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

      // Update Season Records
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

      // Update Head-to-Head Records
      // Ensure consistent ordering for H2H keys (e.g., "TeamA_TeamB" vs "TeamB_TeamA")
      const sortedTeams = [team1, team2].sort();
      const h2hKey = `${sortedTeams[0]} vs ${sortedTeams[1]}`;

      if (!newHeadToHeadRecords[h2hKey]) {
        newHeadToHeadRecords[h2hKey] = {
          teams: sortedTeams,
          [sortedTeams[0]]: { wins: 0, losses: 0, ties: 0 },
          [sortedTeams[1]]: { wins: 0, losses: 0, ties: 0 },
        };
      }

      const h2hRecord = newHeadToHeadRecords[h2hKey];
      if (isTie) {
        h2hRecord[team1].ties++;
        h2hRecord[team2].ties++;
      } else if (team1Won) {
        h2hRecord[team1].wins++;
        h2hRecord[team2].losses++;
      } else { // team2Won
        h2hRecord[team2].wins++;
        h2hRecord[team1].losses++;
      }
    });

    setAllTimeRecords(newAllTimeRecords);
    setSeasonRecords(newSeasonRecords);
    setHeadToHeadRecords(newHeadToHeadRecords);

  }, [historicalMatchups, getMappedTeamName]); // Recalculate if matchups or mapping changes

  // Helper to render record
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  // Sort teams for consistent display in all-time records
  const sortedAllTimeTeams = Object.keys(allTimeRecords).sort();

  // Sort years for consistent display in season records
  const sortedYears = Object.keys(seasonRecords).sort((a, b) => parseInt(b) - parseInt(a)); // Descending year

  // Sort head-to-head records by rivalry key
  const sortedHeadToHeadKeys = Object.keys(headToHeadRecords).sort();


  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">League History & Stats</h2>

      {loading ? (
        <p className="text-center text-gray-600">Loading league history data...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : historicalMatchups.length === 0 ? (
        <p className="text-center text-gray-600">No historical matchup data found. Ensure your Apps Script is correctly deployed and Google Sheet has data.</p>
      ) : (
        <>
          {/* All-Time Records */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">All-Time Team Records</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAllTimeTeams.map(team => {
                    const record = allTimeRecords[team];
                    const totalGames = record.wins + record.losses + record.ties;
                    const winPercentage = totalGames > 0 ? ((record.wins + (record.ties / 2)) / totalGames * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={team} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-3 text-sm text-gray-800">{team}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(record)}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{winPercentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Season-by-Season Records */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Season-by-Season Records</h3>
            {sortedYears.map(year => (
              <div key={year} className="mb-6">
                <h4 className="text-lg font-bold text-gray-700 mb-3 bg-gray-50 p-2 rounded-md border-l-4 border-blue-500">{year} Season</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L-T)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(seasonRecords[year]).sort().map(team => (
                        <tr key={team} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-2 px-3 text-sm text-gray-800">{team}</td>
                          <td className="py-2 px-3 text-sm text-gray-700">{renderRecord(seasonRecords[year][team])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          {/* Head-to-Head Rivalries */}
          <section>
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Head-to-Head Rivalries</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedHeadToHeadKeys.map(key => {
                const rivalry = headToHeadRecords[key];
                const teamA = rivalry.teams[0];
                const teamB = rivalry.teams[1];
                return (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="font-bold text-blue-800 text-lg mb-2">{teamA} vs {teamB}</h4>
                    <p className="text-sm text-gray-700">
                      <strong>{teamA}:</strong> {renderRecord(rivalry[teamA])}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>{teamB}:</strong> {renderRecord(rivalry[teamB])}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default LeagueHistory;
