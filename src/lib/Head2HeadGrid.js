// src/lib/Head2HeadGrid.js
import React, { useState, useEffect, useCallback } from 'react';

// Helper function to render record (W-L-T) - can be adapted for W-L if needed
const renderRecord = (record) => {
  if (!record) return '0-0-0';
  return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

// Component to render the Head-to-Head Grid and details
const Head2HeadGrid = ({ historicalMatchups, getDisplayTeamName }) => {
  const [headToHeadRecords, setHeadToHeadRecords] = useState({});
  const [selectedRivalryKey, setSelectedRivalryKey] = useState(null); // Stores the H2H key (e.g., "TeamA vs TeamB")

  // Data processing for head-to-head records
  useEffect(() => {
    if (historicalMatchups.length === 0) {
      setHeadToHeadRecords({});
      return;
    }

    const newHeadToHeadRecords = {}; // { h2hKey: { teams: [], teamA: {w,l,t}, teamB: {w,l,t}, allMatches: [] } }

    historicalMatchups.forEach(match => {
      const team1 = getDisplayTeamName(String(match.team1 || '').trim());
      const team2 = getDisplayTeamName(String(match.team2 || '').trim());
      const team1Score = parseFloat(match.team1Score);
      const team2Score = parseFloat(match.team2Score);

      if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score) || team1 === team2) {
        // Skip invalid data or self-matches
        return;
      }

      const isTie = team1Score === team2Score;
      const team1Won = team1Score > team2Score;
      const team2Won = team2Score > team1Score;

      // Ensure consistent ordering for H2H keys (e.g., "TeamA vs TeamB" where TeamA < TeamB alphabetically)
      const sortedTeams = [team1, team2].sort();
      const h2hKey = `${sortedTeams[0]} vs ${sortedTeams[1]}`;

      if (!newHeadToHeadRecords[h2hKey]) {
        newHeadToHeadRecords[h2hKey] = {
          teams: sortedTeams, // Store sorted teams for easy access
          [sortedTeams[0]]: { wins: 0, losses: 0, ties: 0 }, // Record for the first team in sorted pair
          [sortedTeams[1]]: { wins: 0, losses: 0, ties: 0 }, // Record for the second team in sorted pair
          allMatches: []
        };
      }

      const h2hRecord = newHeadToHeadRecords[h2hKey];

      // Update records from the perspective of each team in the pair
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
      h2hRecord.allMatches.push(match);
    });
    setHeadToHeadRecords(newHeadToHeadRecords);
  }, [historicalMatchups, getDisplayTeamName]);

  // Get a sorted list of all unique teams for the grid axes
  const allTeams = Object.keys(headToHeadRecords).reduce((acc, key) => {
    headToHeadRecords[key].teams.forEach(team => acc.add(team));
    return acc;
  }, new Set());
  const sortedTeams = Array.from(allTeams).sort();


  // Component to render the detailed rivalry view
  const renderSelectedRivalryDetails = () => {
    const rivalry = headToHeadRecords[selectedRivalryKey];
    if (!rivalry) return null;

    const teamA = rivalry.teams[0];
    const teamB = rivalry.teams[1];

    // Calculate additional stats for the detailed view
    let teamAMaxScore = 0;
    let teamBMaxScore = 0;
    let teamAMinScore = Infinity;
    let teamBMinScore = Infinity;
    let totalScoreCombined = 0;
    let totalMatchesPlayed = rivalry.allMatches.length;

    rivalry.allMatches.forEach(match => {
        const score1 = parseFloat(match.team1Score);
        const score2 = parseFloat(match.team2Score);

        // Determine which score belongs to teamA and teamB for this specific match
        const currentTeamAScore = (getDisplayTeamName(match.team1) === teamA) ? score1 : score2;
        const currentTeamBScore = (getDisplayTeamName(match.team2) === teamB) ? score2 : score1;


        teamAMaxScore = Math.max(teamAMaxScore, currentTeamAScore);
        teamAMinScore = Math.min(teamAMinScore, currentTeamAScore);
        teamBMaxScore = Math.max(teamBMaxScore, currentTeamBScore);
        teamBMinScore = Math.min(teamBMinScore, currentTeamBScore);

        totalScoreCombined += (score1 + score2); // Sum original scores from match object
    });

    const averageCombinedScore = totalMatchesPlayed > 0 ? (totalScoreCombined / totalMatchesPlayed).toFixed(2) : 'N/A';


    return (
      <div className="p-4 bg-white rounded-lg shadow-inner border border-gray-200">
        <button
          onClick={() => setSelectedRivalryKey(null)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
        >
          &larr; Back to All Rivalries
        </button>
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">
          {teamA} vs {teamB} - Rivalry Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamA} Record:</p>
                <p className="text-gray-800">{renderRecord(rivalry[teamA])}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamB} Record:</p>
                <p className="text-800">{renderRecord(rivalry[teamB])}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">Total Matches:</p>
                <p className="text-gray-800">{totalMatchesPlayed}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">Avg Combined Score:</p>
                <p className="text-gray-800">{averageCombinedScore}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamA} Highest Score:</p>
                <p className="text-gray-800">{teamAMaxScore !== 0 ? teamAMaxScore.toFixed(2) : 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamB} Highest Score:</p>
                <p className="text-gray-800">{teamBMaxScore !== 0 ? teamBMaxScore.toFixed(2) : 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamA} Lowest Score:</p>
                <p className="text-gray-800">{teamAMinScore !== Infinity ? teamAMinScore.toFixed(2) : 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="font-semibold text-blue-700">{teamB} Lowest Score:</p>
                <p className="text-gray-800">{teamBMinScore !== Infinity ? teamBMinScore.toFixed(2) : 'N/A'}</p>
            </div>
        </div>

        {/* Displaying actual matches */}
        <h4 className="text-lg font-bold text-gray-800 mt-6 mb-3 border-b pb-2">Match History</h4>
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">Year</th>
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">Week</th>
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamA} Score</th>
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamB} Score</th>
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">Winner</th>
                    </tr>
                </thead>
                <tbody>
                    {rivalry.allMatches.sort((a,b) => b.year - a.year || b.week - a.week).map((match, idx) => {
                        let currentTeamAScore = (getDisplayTeamName(match.team1) === teamA) ? match.team1Score : match.team2Score;
                        let currentTeamBScore = (getDisplayTeamName(match.team1) === teamB) ? match.team1Score : match.team2Score; // Fixed to ensure correct score for teamB

                        let matchWinner = 'Tie';
                        if (currentTeamAScore > currentTeamBScore) matchWinner = teamA;
                        else if (currentTeamBScore > currentTeamAScore) matchWinner = teamB;

                        return (
                            <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-2 px-3">{match.year}</td>
                                <td className="py-2 px-3">{match.week}</td>
                                <td className="py-2 px-3">{currentTeamAScore}</td>
                                <td className="py-2 px-3">{currentTeamBScore}</td>
                                <td className="py-2 px-3">{matchWinner}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    );
  };


  return (
    <div className="w-full">
      {selectedRivalryKey ? (
        // Display details for the selected rivalry
        renderSelectedRivalryDetails()
      ) : (
        // Display the grid of all rivalries
        <>
          <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Head-to-Head Rivalries</h3>
          <div className="overflow-x-auto relative"> {/* Added relative for sticky positioning */}
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-50">
                <tr>
                  {/* Empty corner for team names - sticky */}
                  <th className="py-2 px-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 sticky left-0 bg-blue-50 z-20 shadow-sm"></th>
                  {sortedTeams.map(team => (
                    <th key={team} className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 min-w-[90px] sticky top-0 bg-blue-50 z-10"> {/* Sticky top for horizontal scroll */}
                      {team}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map(rowTeam => (
                  <tr key={rowTeam} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-3 text-left text-sm text-gray-800 font-semibold sticky left-0 bg-white z-20 border-r border-gray-200 shadow-sm"> {/* Sticky left for vertical scroll */}
                      {rowTeam}
                    </td>
                    {sortedTeams.map(colTeam => {
                      if (rowTeam === colTeam) {
                        return (
                          <td key={`${rowTeam}-${colTeam}`} className="py-2 px-3 text-center text-sm text-gray-400 bg-gray-100 border-b border-gray-200">
                            ---
                          </td>
                        );
                      }
                      // Find the rivalry key in the correct sorted order
                      const rivalryKey = [rowTeam, colTeam].sort().join(' vs ');
                      const rivalry = headToHeadRecords[rivalryKey];

                      let recordForDisplay = '0-0'; // Default for no games or issues
                      let cellClassName = 'py-2 px-3 text-center text-sm border-b border-gray-200 cursor-pointer ';

                      if (rivalry) {
                        const rowTeamRecord = rivalry[rowTeam];
                        const colTeamRecord = rivalry[colTeam]; // Get opponent's record against rowTeam
                        const totalGames = rowTeamRecord.wins + rowTeamRecord.losses + rowTeamRecord.ties;

                        if (totalGames > 0) {
                            recordForDisplay = `${rowTeamRecord.wins}-${rowTeamRecord.losses}`; // Format as W-L
                            if (rowTeamRecord.wins > rowTeamRecord.losses) {
                                cellClassName += 'bg-green-100 text-green-800 hover:bg-green-200'; // Green for win
                            } else if (rowTeamRecord.losses > rowTeamRecord.wins) {
                                cellClassName += 'bg-red-100 text-red-800 hover:bg-red-200'; // Red for loss
                            } else {
                                cellClassName += 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'; // Yellow for tie
                            }
                        } else {
                            cellClassName += 'text-gray-600 bg-white hover:bg-gray-50'; // Default for no games
                        }
                      } else {
                         cellClassName += 'text-gray-600 bg-white hover:bg-gray-50'; // Default for no rivalry data
                      }


                      return (
                        <td
                          key={`${rowTeam}-${colTeam}`}
                          className={cellClassName}
                          onClick={() => rivalry && setSelectedRivalryKey(rivalryKey)} // Only clickable if rivalry data exists
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
