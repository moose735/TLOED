// src/lib/MatchupHistory.js
import React, { useState, useEffect, useCallback } from 'react';
// Removed import of HISTORICAL_MATCHUPS_API_URL, as data is passed from App.js
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
  // Removed internal historicalMatchups, loading, error states, as they are props now

  // Removed seasonRecords state, as its data processing moved to SeasonRecords.js
  const [championshipGames, setChampionshipGames] = useState([]);

  const getDisplayTeamName = useCallback((originalName) => {
    return getMappedTeamName ? getMappedTeamName(originalName) : originalName;
  }, [getMappedTeamName]);


  // --- Data Processing (only for sections remaining in MatchupHistory, like championship games) ---
  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      // Removed setSeasonRecords({});
      setChampionshipGames([]);
      return;
    }

    // Removed newSeasonRecords processing here
    const newChampionshipGames = [];

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const year = match.year;
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score)) {
        console.warn('Skipping invalid matchup data in MatchupHistory for championship games:', match);
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

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

    setChampionshipGames(newChampionshipGames.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.winnerPlace - b.winnerPlace;
    }));

  }, [historicalMatchups, getDisplayTeamName]); // historicalMatchups is a prop now

  const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
  };

  // Removed sortedYears as seasonRecords state is gone

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

          {/* Removed Season-by-Season Records from here */}

          {/* Head-to-Head Rivalries / Versus History section handled by Head2HeadGrid */}
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Head-to-Head Rivalries</h3>
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
