// src/lib/MatchupHistory.js
import React, { useState, useEffect, useCallback } from 'react';
// Removed import of HISTORICAL_MATCHUPS_API_URL
import Head2HeadGrid from './Head2HeadGrid';
// Removed import of RecordBook

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return (s[v - 20] || s[v] || s[0]);
};

// Helper to get the descriptive name of a final seeding game (e.g., "Championship Game")
const getFinalSeedingGamePurpose = (value) => {
  if (value === 1) return 'Championship Game';
  if (value === 3) return '3rd Place Game';
  if (value === 5) return '5th Place Game';
  if (value === 7) return '7th Place Game';
  if (value === 9) return '9th Place Game';
  if (value === 11) return '11th Place Game';
  if (typeof value === 'number' && value > 0 && value % 2 !== 0) {
      return `${value}${getOrdinalSuffix(value)} Place Game`;
  }
  return 'Final Seeding Game';
};


// MatchupHistory now receives historicalMatchups, loading, and error as props
const MatchupHistory = ({ historicalMatchups, loading, error, getMappedTeamName }) => {
  // Removed internal historicalMatchups, loading, error states

  const [seasonRecords, setSeasonRecords] = useState({});
  const [championshipGames, setChampionshipGames] = useState([]);

  const getDisplayTeamName = useCallback((originalName) => {
    return getMappedTeamName ? getMappedTeamName(originalName) : originalName;
  }, [getMappedTeamName]);


  // --- Data Processing (for sections remaining in MatchupHistory) ---
  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setSeasonRecords({});
      setChampionshipGames([]);
      return;
    }

    const newSeasonRecords = {};
    const newChampionshipGames = [];

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

      [team1, team2].forEach(team => {
        if (!newSeasonRecords[year]) {
          newSeasonRecords[year] = {};
        }
        if (!newSeasonRecords[year][team]) {
          newSeasonRecords[year][team] = { wins: 0, losses: 0, ties: 0 };
        }
      });

      if (isTie) {
        newSeasonRecords[year][team1].ties++;
        newSeasonRecords[year][team2].ties++;
      } else if (team1Won) {
        newSeasonRecords[year][team1].wins++;
        newSeasonRecords[year][team2].losses++;
      } else {
        newSeasonRecords[year][team2].wins++;
        newSeasonRecords[year][team1].losses++;
      }

      if (typeof match.finalSeedingGame === 'number' && match.finalSeedingGame > 0) {
          let winner = 'Tie';
          let loser = 'Tie';
          let winnerScore = team1Score;
          let loserScore = team2Score;

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
              loser: loser,
              winnerScore: winnerScore,
              loserScore: loserScore,
              winnerPlace: winningPlace,
              loserPlace: losingPlace
          });
      }
    });

    setSeasonRecords(newSeasonRecords);
    setChampionshipGames(newChampionshipGames.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.winnerPlace - b.winnerPlace;
    }));

  }, [historicalMatchups, getDisplayTeamName]);

  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  const sortedYears = Object.keys(seasonRecords).sort((a, b) => parseInt(b) - parseInt(a));


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
          <section className="mb-8">
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
