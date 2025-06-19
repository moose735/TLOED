// src/lib/Head2HeadGrid.js
import React, { useState, useEffect, useCallback } from 'react';

// Helper function to render record (W-L-T)
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

// Helper function to get ordinal suffix (e.g., 1st, 2nd, 3rd)
const getOrdinalSuffix = (i) => {
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
};

// Function to calculate rank for a given value among all values
const calculateRank = (value, allValues, isHigherBetter = true) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return 'N/A';
    const sortedValues = [...new Set(allValues.filter(v => v !== null && typeof v !== 'undefined' && !isNaN(v)))].sort((a, b) => isHigherBetter ? b - a : a - b);
    const rank = sortedValues.indexOf(value) + 1;
    return rank > 0 ? `${rank}${getOrdinalSuffix(rank)}` : 'N/A';
};

// Head2HeadGrid now accepts onRivalryCellClick prop
const Head2HeadGrid = ({ historicalMatchups, getDisplayTeamName, setSelectedRivalryKey, onRivalryCellClick }) => {
  const [rivalryData, setRivalryData] = useState({});
  const [teamNames, setTeamNames] = useState([]);

  useEffect(() => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
      setRivalryData({});
      setTeamNames([]);
      return;
    }

    const compiledRivalryData = {};
    const uniqueTeamNames = new Set();

    historicalMatchups.forEach(season => {
      season.matchups.forEach(matchup => {
        const team1 = matchup.team1;
        const team2 = matchup.team2;

        uniqueTeamNames.add(team1);
        uniqueTeamNames.add(team2);

        // Ensure both directions of the rivalry exist
        const key1 = `${team1}-${team2}`;
        const key2 = `${team2}-${team1}`;

        if (!compiledRivalryData[key1]) {
          compiledRivalryData[key1] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, games: [] };
        }
        if (!compiledRivalryData[key2]) {
          compiledRivalryData[key2] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, games: [] };
        }

        // Update stats for team1 vs team2
        if (matchup.winner === team1) {
          compiledRivalryData[key1].wins += 1;
          compiledRivalryData[key2].losses += 1;
        } else if (matchup.winner === team2) {
          compiledRivalryData[key1].losses += 1;
          compiledRivalryData[key2].wins += 1;
        } else { // Tie
          compiledRivalryData[key1].ties += 1;
          compiledRivalryData[key2].ties += 1;
        }

        // Points (from team1's perspective for key1)
        compiledRivalryData[key1].pointsFor += matchup.team1Score;
        compiledRivalryData[key1].pointsAgainst += matchup.team2Score;
        compiledRivalryData[key2].pointsFor += matchup.team2Score;
        compiledRivalryData[key2].pointsAgainst += matchup.team1Score;

        // Store game details (optional, but useful for drilling down)
        compiledRivalryData[key1].games.push({ year: season.year, ...matchup });
        compiledRivalryData[key2].games.push({ year: season.year, ...matchup });
      });
    });

    setRivalryData(compiledRivalryData);
    setTeamNames(Array.from(uniqueTeamNames).sort()); // Sort team names alphabetically
  }, [historicalMatchups]);


  return (
    <div className="overflow-x-auto">
      {teamNames.length === 0 ? (
        <p className="text-gray-600">No rivalry data available.</p>
      ) : (
        <>
          <div className="shadow-lg rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"></th>
                  {teamNames.map(team => (
                    <th key={team} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getDisplayTeamName(team)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamNames.map(rowTeam => (
                  <tr key={rowTeam}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {getDisplayTeamName(rowTeam)}
                    </td>
                    {teamNames.map(colTeam => {
                      const rivalryKey = `${rowTeam}-${colTeam}`;
                      const rivalry = rivalryData[rivalryKey];
                      const rowTeamRecord = rivalryData[`${rowTeam}-${colTeam}`];
                      let recordForDisplay = '';
                      let cellClassName = 'px-3 py-2 whitespace-nowrap text-sm cursor-pointer transition-colors duration-150 ';

                      if (rowTeam === colTeam) {
                        recordForDisplay = '---'; // Placeholder for self-vs-self
                        cellClassName += 'bg-gray-200 text-gray-500 cursor-default';
                      } else if (rivalry) {
                        recordForDisplay = renderRecord(rivalry);
                        // Apply color coding based on wins/losses
                        if (rowTeamRecord.wins > rowTeamRecord.losses) {
                            cellClassName += 'bg-green-100 text-green-800 hover:bg-green-200'; // Green for win
                        } else if (rowTeamRecord.losses > rowTeamRecord.wins) {
                            cellClassName += 'bg-red-100 text-red-800 hover:bg-red-200'; // Red for loss
                        } else {
                            cellClassName += 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'; // Yellow for tie
                        }
                      } else {
                           cellClassName += 'text-gray-600 bg-white hover:bg-gray-50'; // Default for no rivalry data
                      }

                      return (
                        <td
                          key={`${rowTeam}-${colTeam}`}
                          className={cellClassName}
                          // NEW onClick: Pass both rowTeam and colTeam to the handler
                          onClick={() => rivalry && rowTeam !== colTeam && onRivalryCellClick(rowTeam, colTeam)}
                        >
                          {recordForDisplay}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Click on any record in the grid for more detailed head-to-head statistics.
          </p>
        </>
      )}
    </div>
  );
};

export default Head2HeadGrid;
