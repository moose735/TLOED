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

// Component to render the Head-to-Head Grid and details
const Head2HeadGrid = ({ historicalMatchups, getDisplayTeamName, allLeagueStats }) => {
    const [headToHeadRecords, setHeadToHeadRecords] = useState({});
    const [selectedRivalryKey, setSelectedRivalryKey] = useState(null); // Stores the H2H key (e.g., "TeamA vs TeamB")

    // Data processing for head-to-head records
    useEffect(() => {
        if (!historicalMatchups || Object.keys(historicalMatchups).length === 0) {
            setHeadToHeadRecords({});
            return;
        }

        const newHeadToHeadRecords = {}; // { h2hKey: { teams: [], teamA: {w,l,t}, teamB: {w,l,t}, allMatches: [] } }

        Object.keys(historicalMatchups).forEach(year => {
            const yearMatchups = historicalMatchups[year];
            Object.keys(yearMatchups).forEach(week => {
                const weekMatchups = yearMatchups[week]; // Array of {roster_id, points, matchup_id, ...}

                // Group entries by matchup_id to form head-to-head pairs
                const matchupsByPair = new Map(); // Map<matchup_id, [team1_entry, team2_entry]>
                weekMatchups.forEach(entry => {
                    if (!matchupsByPair.has(entry.matchup_id)) {
                        matchupsByPair.set(entry.matchup_id, []);
                    }
                    matchupsByPair.get(entry.matchup_id).push(entry);
                });

                matchupsByPair.forEach(matchupPair => {
                    if (matchupPair.length !== 2) {
                        // Skip invalid pairs (e.g., bye weeks or incomplete data)
                        return;
                    }

                    const team1Entry = matchupPair[0];
                    const team2Entry = matchupPair[1];

                    const team1 = getDisplayTeamName(team1Entry.roster_id);
                    const team2 = getDisplayTeamName(team2Entry.roster_id);
                    const team1Score = team1Entry.points;
                    const team2Score = team2Entry.points;

                    if (!team1 || !team2 || isNaN(team1Score) || isNaN(team2Score) || team1 === team2) {
                        // Skip invalid data or self-matches
                        return;
                    }

                    const isTie = team1Score === team2Score;
                    const team1Won = team1Score > team2Score;

                    // Infer playoff status based on week number (adjust as per your league's typical structure)
                    const isPlayoff = parseInt(week) > 14; // Common: weeks 1-14 regular season, >14 playoffs

                    // Ensure consistent ordering for H2H keys (e.g., "TeamA vs TeamB" where TeamA < TeamB alphabetically)
                    const sortedTeams = [team1, team2].sort();
                    const h2hKey = `${sortedTeams[0]} vs ${sortedTeams[1]}`;

                    if (!newHeadToHeadRecords[h2hKey]) {
                        newHeadToHeadRecords[h2hKey] = {
                            teams: sortedTeams,
                            [sortedTeams[0]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                            [sortedTeams[1]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                            allMatches: []
                        };
                    }

                    const h2hRecord = newHeadToHeadRecords[h2hKey];

                    let winner = 'Tie';
                    let loser = 'Tie';
                    if (team1Won) {
                        winner = team1;
                        loser = team2;
                    } else if (team2Score > team1Score) {
                        winner = team2;
                        loser = team1;
                    }

                    // Update records
                    if (isTie) {
                        h2hRecord[team1].ties++;
                        h2hRecord[team2].ties++;
                        if (isPlayoff) {
                            h2hRecord[team1].playoffTies++;
                            h2hRecord[team2].playoffTies++;
                        }
                    } else if (team1Won) {
                        h2hRecord[team1].wins++;
                        h2hRecord[team2].losses++;
                        if (isPlayoff) {
                            h2hRecord[team1].playoffWins++;
                            h2hRecord[team2].playoffLosses++;
                        }
                    } else { // team2Won
                        h2hRecord[team2].wins++;
                        h2hRecord[team1].losses++;
                        if (isPlayoff) {
                            h2hRecord[team2].playoffWins++;
                            h2hRecord[team1].playoffLosses++;
                        }
                    }

                    // Add simplified match object for details view
                    h2hRecord.allMatches.push({
                        year: parseInt(year),
                        week: parseInt(week),
                        team1: team1, // Store display names directly
                        team2: team2,
                        team1Score: team1Score,
                        team2Score: team2Score,
                        winner: winner,
                        loser: loser,
                        isTie: isTie,
                        playoffs: isPlayoff, // Add inferred playoff flag
                        // Removed custom flags like consolation, finalSeedingGame, pointsOnlyBye
                    });
                });
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

        // Initialize total points for each team in the rivalry
        let teamATotalPointsScored = 0;
        let teamBTotalPointsScored = 0;

        // Streak calculation
        let currentStreakTeam = null;
        let currentStreakCount = 0;

        // Sort matches by year then week for streak and biggest/slimmest win
        const sortedMatches = [...rivalry.allMatches].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - b.week;
        });

        sortedMatches.forEach(match => {
            let scoreAValue, scoreBValue;

            // Assign scores based on which team in the match corresponds to teamA/teamB of the rivalry
            if (match.team1 === teamA) {
                scoreAValue = match.team1Score;
                scoreBValue = match.team2Score;
            } else if (match.team1 === teamB) {
                scoreAValue = match.team2Score;
                scoreBValue = match.team1Score;
            } else {
                return; // Should not happen for valid matches in the rivalry
            }

            // --- Calculate and store highlight stats ---
            teamATotalPointsScored += scoreAValue;
            teamBTotalPointsScored += scoreBValue;

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

        // Prepare data for ranking and comparison from allLeagueStats (which is careerDPRData)
        // Ensure allLeagueStats is an array and has the correct properties
        const allLeagueTeamNames = allLeagueStats ? allLeagueStats.map(d => d.team) : [];

        const allTotalWins = allLeagueStats ? allLeagueStats.map(d => d.wins) : []; // Use 'wins' from careerDPRData
        const allWinPercentages = allLeagueStats ? allLeagueStats.map(d => d.winPercentage) : [];
        const allCareerDPRs = allLeagueStats ? allLeagueStats.map(d => d.dpr) : []; // Use 'dpr' from careerDPRData
        const allTotalPointsScored = allLeagueStats ? allLeagueStats.map(d => d.pointsFor) : []; // Use 'pointsFor' from careerDPRData
        // Assuming careerDPRData now has a 'careerHighScore' property from calculations.js
        const allCareerHighScores = allLeagueStats ? allLeagueStats.map(d => d.careerHighScore).filter(s => typeof s === 'number' && !isNaN(s)) : [];

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
                        const overallTeamStats = allLeagueStats?.find(d => d.team === team);

                        // Find the opponent's stats by filtering based on team name
                        const opponentTeamStats = allLeagueStats?.find(d => d.team === (team === teamA ? teamB : teamA));

                        // Individual Stats values
                        const totalWins = overallTeamStats ? overallTeamStats.wins : null; // Use 'wins'
                        const winPercentage = overallTeamStats && typeof overallTeamStats.winPercentage === 'number'
                                                 ? overallTeamStats.winPercentage
                                                 : null;
                        const careerDPR = overallTeamStats ? overallTeamStats.dpr : null; // Use 'dpr'
                        const careerHighScore = overallTeamStats ? overallTeamStats.careerHighScore : null; // Use 'careerHighScore'
                        const totalPointsScored = overallTeamStats ? overallTeamStats.pointsFor : null; // Use 'pointsFor'

                        // Opponent's Individual Stats values for comparison
                        const oppTotalWins = opponentTeamStats ? opponentTeamStats.wins : null;
                        const oppWinPercentage = opponentTeamStats ? opponentTeamStats.winPercentage : null;
                        const oppCareerDPR = opponentTeamStats ? opponentTeamStats.dpr : null;
                        const oppCareerHighScore = opponentTeamStats ? opponentTeamStats.careerHighScore : null;
                        const oppTotalPointsScored = opponentTeamStats ? opponentTeamStats.pointsFor : null;

                        // Function to determine cell background class
                        const getComparisonClass = (teamValue, opponentValue, isHigherBetter = true) => {
                            if (teamValue === null || typeof teamValue === 'undefined' || isNaN(teamValue) ||
                                opponentValue === null || typeof opponentValue === 'undefined' || isNaN(opponentValue)) {
                                return 'bg-blue-50'; // Default if data is missing or invalid
                            }
                            if (teamValue === opponentValue) return 'bg-yellow-100 text-yellow-800'; // Tie
                            if (isHigherBetter) {
                                return teamValue > opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            } else { // Lower is better (e.g., lower rank, though not used here directly)
                                return teamValue < opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            }
                        };

                        // Rank calculations for career stats
                        const totalWinsRank = calculateRank(totalWins, allTotalWins, true);
                        const winPercentageRank = calculateRank(winPercentage, allWinPercentages, true);
                        const careerDPRRank = calculateRank(careerDPR, allCareerDPRs, true);
                        const careerHighScoreRank = calculateRank(careerHighScore, allCareerHighScores, true);
                        const totalPointsScoredRank = calculateRank(totalPointsScored, allTotalPointsScored, true);


                        return (
                            <div key={team} className="bg-white p-5 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-2xl mb-3">
                                    {team.charAt(0)} {/* Placeholder avatar */}
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">{team}</h4>
                                <div className="grid grid-cols-2 gap-2 w-full text-xs font-medium text-gray-700">
                                    <div className={`${getComparisonClass(totalWins, oppTotalWins)} p-2 rounded-md`}>
                                        Total Wins: {totalWins !== null ? totalWins : 'N/A'} (Rank: {totalWinsRank})
                                    </div>
                                    <div className={`${getComparisonClass(winPercentage, oppWinPercentage)} p-2 rounded-md`}>
                                        Win %: {winPercentage !== null ? (winPercentage * 100).toFixed(1) + '%' : 'N/A'} (Rank: {winPercentageRank})
                                    </div>
                                    <div className={`${getComparisonClass(careerDPR, oppCareerDPR)} p-2 rounded-md`}>
                                        Career DPR: {careerDPR !== null ? careerDPR.toFixed(2) : 'N/A'} (Rank: {careerDPRRank})
                                    </div>
                                    <div className={`${getComparisonClass(careerHighScore, oppCareerHighScore)} p-2 rounded-md`}>
                                        Career High Score: {careerHighScore !== null ? careerHighScore.toFixed(2) : 'N/A'} (Rank: {careerHighScoreRank})
                                    </div>
                                    <div className={`${getComparisonClass(totalPointsScored, oppTotalPointsScored)} p-2 rounded-md`}>
                                        Total Points Scored: {totalPointsScored !== null ? totalPointsScored.toFixed(2) : 'N/A'} (Rank: {totalPointsScoredRank})
                                    </div>
                                    {/* Placeholder stats */}
                                    <div className="bg-blue-50 p-2 rounded-md">Draft Rank: N/A</div>
                                    <div className="bg-blue-50 p-2 rounded-md">Manager Rank: N/A</div>
                                    <div className="bg-blue-50 p-2 rounded-md">Medal Score: N/A</div>
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
                    {/* Repeat similar sections for Team B's highlights */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-red-700">{teamB} Highest Score</p>
                        <p className="text-xl font-bold text-gray-800">
                        {teamBHighestScore.value !== null ? teamBHighestScore.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                        {teamBHighestScore.value !== null ? `${teamBHighestScore.year} Week ${teamBHighestScore.week}` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-red-700">{teamB} Biggest Win</p>
                        <p className="text-xl font-bold text-gray-800">
                        {teamBBiggestWinMargin.value !== null ? teamBBiggestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                        {teamBBiggestWinMargin.value !== null ? `Margin (${teamBBiggestWinMargin.year} Week ${teamBBiggestWinMargin.week})` : 'Margin'}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-red-700">{teamB} Slimmest Win</p>
                        <p className="text-xl font-bold text-gray-800">
                        {teamBSlimmestWinMargin.value !== null ? teamBSlimmestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                        {teamBSlimmestWinMargin.value !== null ? `Margin (${teamBSlimmestWinMargin.year} Week ${teamBSlimmestWinMargin.week})` : 'Margin'}
                        </p>
                    </div>
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
                                // Match object now directly contains team1, team2 (display names), team1Score, team2Score
                                let currentTeamAScore = (match.team1 === teamA) ? match.team1Score : match.team2Score;
                                let currentTeamBScore = (match.team1 === teamB) ? match.team1Score : match.team2Score;

                                let matchType = match.playoffs ? 'Playoffs' : 'Reg. Season'; // Simplified type based on inferred playoffs

                                return (
                                    <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                        <td className="py-2 px-3">{match.year}</td>
                                        <td className="py-2 px-3">{match.week}</td>
                                        <td className="py-2 px-3">{currentTeamAScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{currentTeamBScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{match.isTie ? 'Tie' : match.winner}</td>
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
