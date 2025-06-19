// src/lib/MatchupHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import Head2HeadGrid from './Head2HeadGrid';

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


// MatchupHistory now receives onRivalryCellClick as the new prop
const MatchupHistory = ({ historicalMatchups, getMappedTeamName, onRivalryCellClick }) => { // <-- Updated prop name
  const [selectedRivalryKey, setSelectedRivalryKey] = useState(null);

  useEffect(() => {
    if (selectedRivalryKey) {
      console.log("Rivalry selected:", selectedRivalryKey);
    }
  }, [selectedRivalryKey]);

  const getDisplayTeamName = useCallback((teamName) => {
    return getMappedTeamName(teamName);
  }, [getMappedTeamName]);

  const finalSeedingGames = historicalMatchups.flatMap(season =>
    season.matchups.filter(matchup => matchup.finalSeedingGamePurpose)
  );

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {historicalMatchups.length === 0 ? (
        <p className="text-gray-600">No historical matchup data available.</p>
      ) : (
        <>
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Championship and Final Seeding Games History</h3>
            {finalSeedingGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {finalSeedingGames.map((game, index) => (
                        <div key={index} className="border p-4 rounded-lg bg-blue-50 shadow-sm">
                            <p className="text-lg font-semibold text-blue-800 mb-2">{game.year} - {getFinalSeedingGamePurpose(game.finalSeedingGamePurpose)}</p>
                            <p className="text-sm text-green-700 font-semibold">
                                Winner: {game.winner} ({game.winnerScore}) - Finished {game.winnerPlace}{getOrdinalSuffix(game.winnerPlace)} Place
                            </p>
                            {game.loser ? (
                                <>
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

          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Head-to-Head Rivalries</h3>
            <Head2HeadGrid
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
              setSelectedRivalryKey={setSelectedRivalryKey}
              onRivalryCellClick={onRivalryCellClick} // <-- Pass the new handler from App.js
            />
          </section>
        </>
      )}
    </div>
  );
};

export default MatchupHistory;
