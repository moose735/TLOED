// src/lib/MatchupHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { HISTORICAL_MATCHUPS_API_URL } from '../config';
import Head2HeadGrid from './Head2HeadGrid'; // Import the new Head2HeadGrid component

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

const MatchupHistory = () => {
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derived states for processed data (Head-to-Head moved to Head2HeadGrid.js)
  const [allTimeRecords, setAllTimeRecords] = useState({});
  const [seasonRecords, setSeasonRecords] = useState({});
  const [championshipGames, setChampionshipGames] = useState([]);


  // Teams names will be displayed as they are in the fetched data.
  const getDisplayTeamName = useCallback((originalName) => {
    return originalName; // Directly return original name, no mapping for now
  }, []);

  // Helper to get the descriptive name of a final seeding game (e.g., "Championship Game")
  const getFinalSeedingGamePurpose = useCallback((value) => {
    if (value === 1) return 'Championship Game';
    if (value === 3) return '3rd Place Game';
    if (value === 5) return '5th Place Game';
    if (value === 7) return '7th Place Game';
    if (value === 9) return '9th Place Game';
    if (value === 11) return '11th Place Game';
    // Generic fallback for other odd numeric values or unexpected values
    if (typeof value === 'number' && value > 0 && value % 2 !== 0) {
        return `${value}${getOrdinalSuffix(value)} Place Game`;
    }
    return 'Final Seeding Game'; // Generic fallback
  }, []);


  // --- Data Fetching ---
  useEffect(() => {
    const fetchMatchups = async () => {
      // Adjusted placeholder check for clarity
      if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_NEW_HISTORICAL_MATCHUPS_APPS_SCRIPT_URL' || !HISTORICAL_MATCHUPS_API_URL) {
        setLoading(false);
        setError("Please update HISTORICAL_MATCHUPS_API_URL in config.js with your actual Apps Script URL for historical matchups.");
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

  // --- Data Processing (for sections remaining in MatchupHistory) ---
  useEffect(() => {
    if (historicalMatchups.length === 0) {
      setAllTimeRecords({});
      setSeasonRecords({});
      setChampionshipGames([]);
      return;
    }

    const newAllTimeRecords = {};
    const newSeasonRecords = {}; // { year: { team: { wins, losses, ties } } }
    const newChampionshipGames = []; // Collect special games

    historicalMatchups.forEach(match => {
      // Ensure team names exist and are strings before processing
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
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

      // Check for final seeding games
      if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
          let winner = 'Tie';
          let loser = 'Tie';
          let winnerScore = team1Score;
          let loserScore = team2Score; // Default for ties

          if (team1Won) {
              winner = team1;
              loser = team2;
              winnerScore = team1Score;
              loserScore = team2Score;
          } else if (team2Won) {
              winner = team2;
              loser = team1;
              winnerScore = team2Score;
              loserScore = team1Score;
          }

          const winningPlace = match.finalSeedingGame;
          const losingPlace = match.finalSeedingGame + 1;

          newChampionshipGames.push({
              year: year,
              week: match.week,
              team1: team1,
              team2: team2,
              team1Score: team1Score,
              team2Score: team2Score,
              purpose: getFinalSeedingGamePurpose(match.finalSeedingGame),
              winner: winner,
              loser: loser, // Store the loser
              winnerScore: winnerScore, // Store winner's score
              loserScore: loserScore, // Store loser's score
              winnerPlace: winningPlace,
              loserPlace: losingPlace
          });
      }
    });

    setAllTimeRecords(newAllTimeRecords);
    setSeasonRecords(newSeasonRecords);
    // Sort championship games by year descending, then by winnerPlace ascending (Championship first)
    setChampionshipGames(newChampionshipGames.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.winnerPlace - b.winnerPlace; // Championship game (1st place) before 3rd, etc.
    }));

  }, [historicalMatchups, getDisplayTeamName, getFinalSeedingGamePurpose]); // Recalculate if matchups or mapping changes

  // Helper to render record
  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  // Sort teams for consistent display in all-time records
  const sortedAllTimeTeams = Object.keys(allTimeRecords).sort();

  // Sort years for consistent display in season records
  const sortedYears = Object.keys(seasonRecords).sort((a, b) => parseInt(b) - parseInt(a)); // Descending year


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
          {/* Championship and Final Seeding Games */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Championship & Seeding Games</h3>
            {championshipGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {championshipGames.map((game, index) => (
                        <div key={index} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                            <h4 className="font-bold text-blue-800 text-lg mb-2">{game.year} {game.purpose}</h4>
                            <p className="text-sm text-gray-700">Week {game.week}</p>
                            <p className="text-sm text-gray-700">
                                <strong>{game.team1}</strong> ({game.team1Score}) vs <strong>{game.team2}</strong> ({game.team2Score})
                            </p>
                            {game.winner !== 'Tie' ? (
                                <>
                                    <p className="text-sm text-blue-700 font-semibold mt-1">
                                        Winner: {game.winner} ({game.winnerScore}) - Finished {game.winnerPlace}{getOrdinalSuffix(game.winnerPlace)} Place
                                    </p>
                                    <p className="text-sm text-red-700 font-semibold">
                                        Loser: {game.loser} ({game.loserScore}) - Finished {game.loserPlace}{getOrdinalSuffix(game.loserPlace)} Place
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-gray-700 font-semibold mt-1">
                                    Game was a Tie - Both teams finished {game.winnerPlace}{getOrdinalSuffix(game.winnerPlace)} Place
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-600">No championship or final seeding game data found.</p>
            )}
          </section>

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

          {/* Head-to-Head Rivalries / Versus History section handled by Head2HeadGrid */}
          <section>
            <Head2HeadGrid
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          </section>
        </>
      )}
    </div>
  );
};

export default MatchupHistory;
