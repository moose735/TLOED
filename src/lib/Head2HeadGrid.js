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

// Component to render the Head-to-Head Grid and details
// Added careerDPRData to props
const Head2HeadGrid = ({ historicalMatchups, getDisplayTeamName, careerDPRData }) => {
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
      
      // Ensure consistent ordering for H2H keys (e.g., "TeamA vs TeamB" where TeamA < TeamB alphabetically)
      const sortedTeams = [team1, team2].sort();
      const h2hKey = `${sortedTeams[0]} vs ${sortedTeams[1]}`;

      if (!newHeadToHeadRecords[h2hKey]) {
        newHeadToHeadRecords[h2hKey] = {
          teams: sortedTeams, // Store sorted teams for easy access
          [sortedTeams[0]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 }, // Record for the first team in sorted pair
          [sortedTeams[1]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 }, // Record for the second team in sorted pair
          allMatches: []
        };
      }

      const h2hRecord = newHeadToHeadRecords[h2hKey];

      // Determine the winner and loser for this specific match
      let winner = 'Tie';
      let loser = 'Tie';
      if (team1Won) {
        winner = team1;
        loser = team2;
      } else if (team2Score > team1Score) { // team2Won
        winner = team2;
        loser = team1;
      }

      // Update records from the perspective of each team in the pair
      if (isTie) {
        h2hRecord[team1].ties++;
        h2hRecord[team2].ties++;
        if (match.playoffs) { // Also track playoff ties
          h2hRecord[team1].playoffTies++;
          h2hRecord[team2].playoffTies++;
        }
      } else if (team1Won) {
        h2hRecord[team1].wins++;
        h2hRecord[team2].losses++;
        if (match.playoffs) { // Also track playoff wins/losses
          h2hRecord[team1].playoffWins++;
          h2hRecord[team2].playoffLosses++;
        }
      } else { // team2Won
        h2hRecord[team2].wins++;
        h2hRecord[team1].losses++;
        if (match.playoffs) { // Also track playoff wins/losses
          h2hRecord[team2].playoffWins++;
          h2hRecord[team1].playoffLosses++;
        }
      }

      // Add winner/loser/scores to match object for easier processing in details view
      h2hRecord.allMatches.push({
          ...match,
          winner: winner,
          loser: loser,
          winnerScore: winner === team1 ? team1Score : team2Score,
          loserScore: loser === team1 ? team1Score : team2Score,
          isTie: isTie
      });
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

    const teamARecord = rivalry[teamA];
    const teamBRecord = rivalry[teamB];

    // Initialize highlight stats with null values for robust 'N/A' display
    let teamAHighestScore = { value: null, year: null, week: null };
    let teamBHighestScore = { value: null, year: null, week: null };
    let teamABiggestWinMargin = { value: null, year: null, week: null };
    let teamBBiggestWinMargin = { value: null, year: null, week: null };
    let teamASlimmestWinMargin = { value: null, year: null, week: null };
    let teamBSlimmestWinMargin = { value: null, year: null, week: null };

    // Streak calculation
    let currentStreakTeam = null;
    let currentStreakCount = 0;

    // Sort matches by year then week for streak and biggest/slimmest win
    const sortedMatches = [...rivalry.allMatches].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
    });

    sortedMatches.forEach(match => {
        // Consistently get display names for the current match teams
        const currentMatchTeam1Display = getDisplayTeamName(match.team1);
        const currentMatchTeam2Display = getDisplayTeamName(match.team2);

        let scoreAValue, scoreBValue;

        // Assign scores based on whether team1 or team2 in the match is teamA in the rivalry
        if (currentMatchTeam1Display === teamA) {
            scoreAValue = parseFloat(match.team1Score);
            scoreBValue = parseFloat(match.team2Score);
        } else if (currentMatchTeam1Display === teamB) {
            // If team1 is teamB, then team2 must be teamA
            scoreAValue = parseFloat(match.team2Score);
            scoreBValue = parseFloat(match.team1Score);
        } else {
            // Should not happen for matches within the selected rivalry, but as a safeguard
            return;
        }

        // --- Calculate and store highlight stats ---

        // Highest Score
        if (teamAHighestScore.value === null || scoreAValue > teamAHighestScore.value) {
            teamAHighestScore = { value: scoreAValue, year: match.year, week: match.week };
        }
        if (teamBHighestScore.value === null || scoreBValue > teamBHighestScore.value) {
            teamBHighestScore = { value: scoreBValue, year: match.year, week: match.week };
        }

        // Biggest/Slimmest Win Margin
        if (scoreAValue > scoreBValue) { // Team A won
            const margin = scoreAValue - scoreBValue;
            if (teamABiggestWinMargin.value === null || margin > teamABiggestWinMargin.value) {
                teamABiggestWinMargin = { value: margin, year: match.year, week: match.week };
            }
            if (teamASlimmestWinMargin.value === null || margin < teamASlimmestWinMargin.value) {
                teamASlimmestWinMargin = { value: margin, year: match.year, week: match.week };
            }
        } else if (scoreBValue > scoreAValue) { // Team B won
            const margin = scoreBValue - scoreAValue;
            if (teamBBiggestWinMargin.value === null || margin > teamBBiggestWinMargin.value) {
                teamBBiggestWinMargin = { value: margin, year: match.year, week: match.week };
            }
            if (teamBSlimmestWinMargin.value === null || margin < teamBSlimmestWinMargin.value) {
                teamBSlimmestWinMargin = { value: margin, year: match.year, week: match.week };
            }
        }

        // Streak
        if (!match.isTie) {
            const matchWinner = scoreAValue > scoreBValue ? teamA : teamB;
            if (currentStreakTeam === matchWinner) {
                currentStreakCount++;
            } else {
                currentStreakTeam = matchWinner;
                currentStreakCount = 1;
            }
        } else {
            currentStreakTeam = null; // Tie breaks streak
            currentStreakCount = 0;
        }
    });

    const currentStreak = currentStreakTeam ? `${currentStreakTeam} ${currentStreakCount}-game W streak` : 'No current streak';

    return (
      <div className="p-4 bg-gray-100 rounded-lg shadow-md border border-gray-200">
        <button
          onClick={() => setSelectedRivalryKey(null)}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
        >
          &larr; Back to All Rivalries
        </button>

        {/* Header Section */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-extrabold text-gray-800 mb-2">{teamA} vs {teamB}</h3>
          <p className="text-sm text-gray-600">Performance, stats, and records</p>
        </div>

        {/* Main Teams Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {[teamA, teamB].map(team => {
            // Find overall career stats for the current team from careerDPRData
            const overallTeamStats = careerDPRData?.find(d => d.team === team);

            const totalWinsOverall = overallTeamStats ? overallTeamStats.totalWins : 'N/A';
            const winPercentageOverall = overallTeamStats && typeof overallTeamStats.winPercentage === 'number'
                                         ? (overallTeamStats.winPercentage * 100).toFixed(1) + '%' // Format as percentage
                                         : 'N/A';
            // Placeholder for other stats not available in careerDPRData
            const rating = 'N/A';
            const draftRank = 'N/A';
            const managerRank = 'N/A';
            const medalScore = 'N/A';

            return (
              <div key={team} className="bg-white p-5 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-2xl mb-3">
                    {team.charAt(0)} {/* Placeholder avatar */}
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">{team}</h4>
                <div className="grid grid-cols-2 gap-2 w-full text-xs font-medium text-gray-700">
                    <div className="bg-blue-50 p-2 rounded-md">Total Wins: {totalWinsOverall}</div>
                    <div className="bg-blue-50 p-2 rounded-md">Win %: {winPercentageOverall}</div>
                    <div className="bg-blue-50 p-2 rounded-md">Rating: {rating}</div>
                    <div className="bg-blue-50 p-2 rounded-md">Draft Rank: {draftRank}</div>
                    <div className="bg-blue-50 p-2 rounded-md">Manager Rank: {managerRank}</div>
                    <div className="bg-blue-50 p-2 rounded-md">Medal Score: {medalScore}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* VERSUS Section */}
        <div className="bg-blue-700 text-white p-4 rounded-lg shadow-inner text-center mb-6">
          <h4 className="text-xl font-bold mb-2">★ VERSUS ★</h4>
          <p className="text-lg font-semibold mb-1">Record: {renderRecord(teamARecord)} vs {renderRecord(teamBRecord)}</p>
          <p className="text-md">Current Streak: {currentStreak}</p>
          <p className="text-md">
            Playoff Record: {teamARecord.playoffWins}-{teamARecord.playoffLosses}-{teamARecord.playoffTies}
            {' '}vs{' '}
            {teamBRecord.playoffWins}-{teamBRecord.playoffLosses}-{teamBRecord.playoffTies}
          </p>
        </div>


        {/* Matchup Highlights */}
        <h4 className="text-xl font-bold text-gray-800 mt-6 mb-4 border-b pb-2">Matchup Highlights</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <p className="text-md font-semibold text-blue-700">{teamA} Highest Score</p>
            <p className="text-xl font-bold text-gray-800">
              {teamAHighestScore.value !== null ? teamAHighestScore.value.toFixed(2) : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              {teamAHighestScore.value !== null ? `${teamAHighestScore.year} Week ${teamAHighestScore.week}` : ''}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <p className="text-md font-semibold text-blue-700">{teamA} Biggest Win</p>
            <p className="text-xl font-bold text-gray-800">
              {teamABiggestWinMargin.value !== null ? teamABiggestWinMargin.value.toFixed(2) : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              {teamABiggestWinMargin.value !== null ? `Margin (${teamABiggestWinMargin.year} Week ${teamABiggestWinMargin.week})` : 'Margin'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <p className="text-md font-semibold text-blue-700">{teamA} Slimmest Win</p>
            <p className="text-xl font-bold text-gray-800">
              {teamASlimmestWinMargin.value !== null ? teamASlimmestWinMargin.value.toFixed(2) : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              {teamASlimmestWinMargin.value !== null ? `Margin (${teamASlimmestWinMargin.year} Week ${teamASlimmestWinMargin.week})` : 'Margin'}
            </p>
          </div>
          {/* Repeat similar sections for Team B's highlights if desired */}
        </div>

        {/* Detailed Match History */}
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
                        <th className="py-2 px-3 text-left font-semibold text-blue-700">Type</th>
                    </tr>
                </thead>
                <tbody>
                    {rivalry.allMatches.sort((a,b) => b.year - a.year || b.week - a.week).map((match, idx) => {
                        let currentTeamAScore = (getDisplayTeamName(match.team1) === teamA) ? match.team1Score : match.team2Score;
                        let currentTeamBScore = (getDisplayTeamName(match.team1) === teamB) ? match.team1Score : match.team2Score;

                        let matchType = 'Reg. Season';
                        if (match.playoffs) matchType = 'Playoffs';
                        if (match.consolation) matchType = 'Consolation';
                        if (match.finalSeedingGame) matchType = `Final Seeding (${match.finalSeedingGame}${getOrdinalSuffix(match.finalSeedingGame)})`;
                        if (match.pointsOnlyBye) matchType = 'Points Only Bye';


                        return (
                            <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-2 px-3">{match.year}</td>
                                <td className="py-2 px-3">{match.week}</td>
                                <td className="py-2 px-3">{currentTeamAScore}</td>
                                <td className="py-2 px-3">{currentTeamBScore}</td>
                                <td className="py-2 px-3">{match.winner === 'Tie' ? 'Tie' : match.winner}</td>
                                <td className="py-2 px-3 text-xs text-gray-500">{matchType}</td>
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
