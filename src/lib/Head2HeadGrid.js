// src/lib/Head2HeadGrid.js
import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the custom hook

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
const Head2HeadGrid = ({ careerDPRData }) => { // Expecting careerDPRData as a prop
    const {
        loading: contextLoading,
        error: contextError,
        historicalData, // Contains matchupsBySeason, leaguesMetadataBySeason, rostersBySeason
        getTeamName
    } = useSleeperData();

    const [headToHeadRecords, setHeadToHeadRecords] = useState({});
    const [selectedRivalryKey, setSelectedRivalryKey] = useState(null); // Stores the H2H key (e.g., "ownerId1 vs ownerId2")
    const [loading, setLoading] = useState(true); // Local loading state for calculations

    // Data processing for head-to-head records
    useEffect(() => {
        if (contextLoading || contextError) {
            setLoading(true);
            return;
        }

        if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
            setHeadToHeadRecords({});
            setLoading(false);
            return;
        }

        setLoading(true);
        const newHeadToHeadRecords = {}; // { h2hKey: { owners: [], ownerId1: {w,l,t,pw,pl,pt}, ownerId2: {w,l,t,pw,pl,pt}, allMatches: [] } }

        // Iterate through all seasons and their matchups
        Object.keys(historicalData.matchupsBySeason).forEach(year => {
            const weeklyMatchupsForYear = historicalData.matchupsBySeason[year];
            const leagueMetadataForYear = historicalData.leaguesMetadataBySeason[year];
            const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;
            const rostersForYear = historicalData.rostersBySeason?.[year] || [];

            Object.keys(weeklyMatchupsForYear).forEach(weekStr => {
                const week = parseInt(weekStr);
                const matchupsInWeek = weeklyMatchupsForYear[weekStr];

                if (!matchupsInWeek || matchupsInWeek.length === 0) return;

                matchupsInWeek.forEach(matchup => {
                    const team1RosterId = String(matchup.team1_roster_id);
                    const team2RosterId = String(matchup.team2_roster_id);
                    const team1Score = parseFloat(matchup.team1_score);
                    const team2Score = parseFloat(matchup.team2_score);

                    // Skip invalid data, self-matches, or matches without valid scores
                    if (!team1RosterId || !team2RosterId || team1RosterId === team2RosterId || isNaN(team1Score) || isNaN(team2Score)) {
                        return;
                    }

                    // Get owner IDs from roster IDs for the current year
                    const team1Roster = rostersForYear.find(r => String(r.roster_id) === team1RosterId);
                    const team2Roster = rostersForYear.find(r => String(r.roster_id) === team2RosterId);

                    const team1OwnerId = team1Roster?.owner_id;
                    const team2OwnerId = team2Roster?.owner_id;

                    // Skip if owner IDs cannot be resolved
                    if (!team1OwnerId || !team2OwnerId) {
                        return;
                    }

                    // Get display names using owner IDs for the current matchup's year
                    const team1DisplayName = getTeamName(team1OwnerId, year);
                    const team2DisplayName = getTeamName(team2OwnerId, year);

                    // Skip if display names are not resolved to actual names (i.e., they are still 'Unknown Team (ID:...)')
                    if (team1DisplayName.startsWith('Unknown Team') || team2DisplayName.startsWith('Unknown Team')) {
                        return;
                    }

                    const isTie = team1Score === team2Score;
                    const team1Won = team1Score > team2Score;
                    const isPlayoffMatch = week >= playoffStartWeek;

                    // Ensure consistent ordering for H2H keys using owner IDs
                    const sortedOwners = [team1OwnerId, team2OwnerId].sort();
                    const h2hKey = `${sortedOwners[0]} vs ${sortedOwners[1]}`;

                    if (!newHeadToHeadRecords[h2hKey]) {
                        newHeadToHeadRecords[h2hKey] = {
                            owners: sortedOwners, // Store sorted owner IDs
                            [sortedOwners[0]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                            [sortedOwners[1]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                            allMatches: []
                        };
                    }

                    const h2hRecord = newHeadToHeadRecords[h2hKey];

                    // Determine the winner and loser for this specific match (using owner IDs)
                    let winnerOwnerId = 'Tie';
                    let loserOwnerId = 'Tie';
                    if (team1Won) {
                        winnerOwnerId = team1OwnerId;
                        loserOwnerId = team2OwnerId;
                    } else if (team2Score > team1Score) {
                        winnerOwnerId = team2OwnerId;
                        loserOwnerId = team1OwnerId;
                    }

                    // Update records from the perspective of each owner in the pair
                    const recordForOwner1 = (team1OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];
                    const recordForOwner2 = (team2OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];

                    if (isTie) {
                        recordForOwner1.ties++;
                        recordForOwner2.ties++;
                        if (isPlayoffMatch) {
                            recordForOwner1.playoffTies++;
                            recordForOwner2.playoffTies++;
                        }
                    } else if (team1Won) {
                        recordForOwner1.wins++;
                        recordForOwner2.losses++;
                        if (isPlayoffMatch) {
                            recordForOwner1.playoffWins++;
                            recordForOwner2.playoffLosses++;
                        }
                    } else { // team2Won
                        recordForOwner2.wins++;
                        recordForOwner1.losses++;
                        if (isPlayoffMatch) {
                            recordForOwner2.playoffWins++;
                            recordForOwner1.playoffLosses++;
                        }
                    }

                    // Add match details to allMatches array
                    h2hRecord.allMatches.push({
                        year: parseInt(year),
                        week: week,
                        team1OwnerId: team1OwnerId, // Store owner IDs for history
                        team2OwnerId: team2OwnerId,
                        team1DisplayName: team1DisplayName, // Store display names for history
                        team2DisplayName: team2DisplayName,
                        team1Score: team1Score,
                        team2Score: team2Score,
                        winnerOwnerId: winnerOwnerId, // Store owner ID of winner
                        loserOwnerId: loserOwnerId,
                        winnerDisplayName: winnerOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                        loserDisplayName: loserOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                        winnerScore: winnerOwnerId === team1OwnerId ? team1Score : team2Score,
                        loserScore: loserOwnerId === team1OwnerId ? team1Score : team2Score,
                        isTie: isTie,
                        isPlayoff: isPlayoffMatch,
                        // Sleeper API matchups do not directly provide 'consolation', 'finalSeedingGame', 'pointsOnlyBye' flags.
                        // These would need to be inferred from bracket data or other league settings if desired.
                        // For now, we simplify to 'Reg. Season' or 'Playoffs'.
                    });
                });
            });
        });
        setHeadToHeadRecords(newHeadToHeadRecords);
        setLoading(false);
    }, [historicalData, getTeamName, contextLoading, contextError]); // Dependencies updated

    // Create a single, consistent sorted list of display names for the grid axes
    const sortedDisplayNamesAndOwners = useMemo(() => {
        const uniqueOwnerIds = new Set();
        Object.values(headToHeadRecords).forEach(rivalry => {
            rivalry.owners.forEach(ownerId => uniqueOwnerIds.add(ownerId));
        });

        const displayNamesWithOwners = Array.from(uniqueOwnerIds).map(ownerId => ({
            ownerId: ownerId,
            displayName: getTeamName(ownerId, null) // Get the canonical display name
        }));

        // Sort by display name alphabetically
        return displayNamesWithOwners.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [headToHeadRecords, getTeamName]);

    // Component to render the detailed rivalry view
    const renderSelectedRivalryDetails = useCallback(() => {
        const rivalry = headToHeadRecords[selectedRivalryKey];
        if (!rivalry) return null;

        const ownerA = rivalry.owners[0]; // These are now owner IDs
        const ownerB = rivalry.owners[1]; // These are now owner IDs

        const teamADisplayName = getTeamName(ownerA, null); // Resolve display name for owner A
        const teamBDisplayName = getTeamName(ownerB, null); // Resolve display name for owner B

        const ownerARecord = rivalry[ownerA]; // Access records by owner ID
        const ownerBRecord = rivalry[ownerB]; // Access records by owner ID

        // Initialize highlight stats with null values for robust 'N/A' display
        let teamAHighestScore = { value: null, year: null, week: null };
        let teamBHighestScore = { value: null, year: null, week: null };
        let teamABiggestWinMargin = { value: null, year: null, week: null };
        let teamBBiggestWinMargin = { value: null, year: null, week: null };
        let teamASlimmestWinMargin = { value: null, year: null, week: null, margin: Infinity }; // Added margin for tracking
        let teamBSlimmestWinMargin = { value: null, year: null, week: null, margin: Infinity }; // Added margin for tracking

        // Initialize total points for each team in the rivalry
        let teamATotalPointsScored = 0;
        let teamBTotalPointsScored = 0;

        // Streak calculation
        let currentStreakTeam = null; // Stores owner ID of the team on streak
        let currentStreakCount = 0;

        // Sort matches by year then week for streak and biggest/slimmest win
        const sortedMatches = [...rivalry.allMatches].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - b.week;
        });

        sortedMatches.forEach(match => {
            let scoreAValue, scoreBValue;

            // Assign scores based on whether team1OwnerId or team2OwnerId in the match is ownerA in the rivalry
            if (match.team1OwnerId === ownerA) {
                scoreAValue = match.team1Score;
                scoreBValue = match.team2Score;
            } else if (match.team1OwnerId === ownerB) {
                // If team1 is ownerB, then team2 must be ownerA
                scoreAValue = match.team2Score;
                scoreBValue = match.team1Score;
            } else {
                // Should not happen for matches within the selected rivalry, but as a safeguard
                return;
            }

            // Ensure scores are valid numbers
            if (isNaN(scoreAValue) || isNaN(scoreBValue)) return;


            // --- Calculate and store highlight stats ---

            // Total Points Scored
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
                if (teamASlimmestWinMargin.value === null || margin < teamASlimmestWinMargin.margin) { // Compare with margin property
                    teamASlimmestWinMargin = { value: margin, year: match.year, week: match.week, margin: margin };
                }
            } else if (scoreBValue > scoreAValue) { // Team B won
                const margin = scoreBValue - scoreAValue;
                if (teamBBiggestWinMargin.value === null || margin > teamBBiggestWinMargin.value) {
                    teamBBiggestWinMargin = { value: margin, year: match.year, week: match.week };
                }
                if (teamBSlimmestWinMargin.value === null || margin < teamBSlimmestWinMargin.margin) { // Compare with margin property
                    teamBSlimmestWinMargin = { value: margin, year: match.year, week: match.week, margin: margin };
                }
            }

            // Streak
            if (!match.isTie) {
                const matchWinnerOwnerId = scoreAValue > scoreBValue ? ownerA : ownerB;
                if (currentStreakTeam === matchWinnerOwnerId) {
                    currentStreakCount++;
                } else {
                    currentStreakTeam = matchWinnerOwnerId;
                    currentStreakCount = 1;
                }
            } else {
                currentStreakTeam = null; // Tie breaks streak
                currentStreakCount = 0;
            }
        });

        const currentStreak = currentStreakTeam ? `${getTeamName(currentStreakTeam, null)} ${currentStreakCount}-game W streak` : 'No current streak';

        // Prepare data for ranking and comparison using careerDPRData prop
        // careerDPRData is keyed by rosterId and contains teamName.
        // We need to find the careerDPRData entry for the current owner's team name.
        const allTotalWins = careerDPRData ? careerDPRData.map(d => d.wins) : [];
        const allWinPercentages = careerDPRData ? careerDPRData.map(d => d.winPercentage) : [];
        const allCareerDPRs = careerDPRData ? careerDPRData.map(d => d.dpr) : [];
        const allTotalPointsScored = careerDPRData ? careerDPRData.map(d => d.pointsFor) : [];
        const allHighestSingleGameScores = careerDPRData ? careerDPRData.map(d => d.highScore) : [];


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
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-2">{teamADisplayName} vs {teamBDisplayName}</h3>
                    <p className="text-sm text-gray-600">Performance, stats, and records</p>
                </div>

                {/* Main Teams Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {[ownerA, ownerB].map(currentOwnerId => { // Iterate through owner IDs
                        const currentTeamDisplayName = getTeamName(currentOwnerId, null); // Get display name for current owner
                        const overallTeamStats = careerDPRData?.find(d => d.teamName === currentTeamDisplayName); // Find stats by resolved team name
                        const opponentTeamDisplayName = (currentTeamDisplayName === teamADisplayName) ? teamBDisplayName : teamADisplayName;
                        const opponentTeamStats = careerDPRData?.find(d => d.teamName === opponentTeamDisplayName);

                        // Individual Stats values
                        const totalWins = overallTeamStats ? overallTeamStats.wins : null;
                        const winPercentage = overallTeamStats && typeof overallTeamStats.winPercentage === 'number'
                                                 ? overallTeamStats.winPercentage
                                                 : null;
                        const careerDPR = overallTeamStats ? overallTeamStats.dpr : null;
                        const weeklyHighScore = overallTeamStats ? overallTeamStats.highScore : null;
                        const totalPointsScored = overallTeamStats ? overallTeamStats.pointsFor : null;

                        // Opponent's Individual Stats values for comparison
                        const oppTotalWins = opponentTeamStats ? opponentTeamStats.wins : null;
                        const oppWinPercentage = opponentTeamStats ? opponentTeamStats.winPercentage : null;
                        const oppCareerDPR = opponentTeamStats ? opponentTeamStats.dpr : null;
                        const oppWeeklyHighScore = opponentTeamStats ? opponentTeamStats.highScore : null;
                        const oppTotalPointsScored = opponentTeamStats ? opponentTeamStats.pointsFor : null;

                        // Function to determine cell background class
                        const getComparisonClass = (teamValue, opponentValue, isHigherBetter = true) => {
                            if (teamValue === null || opponentValue === null || typeof teamValue === 'undefined' || typeof opponentValue === 'undefined') {
                                return 'bg-blue-50'; // Default if data is missing
                            }
                            if (teamValue === opponentValue) return 'bg-yellow-100 text-yellow-800'; // Tie
                            if (isHigherBetter) {
                                return teamValue > opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            } else { // Lower is better (e.g., lower rank)
                                return teamValue < opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            }
                        };

                        // Rank calculations
                        const totalWinsRank = calculateRank(totalWins, allTotalWins, true);
                        const winPercentageRank = calculateRank(winPercentage, allWinPercentages, true);
                        const careerDPRRank = calculateRank(careerDPR, allCareerDPRs, true);
                        const weeklyHighScoreRank = calculateRank(weeklyHighScore, allHighestSingleGameScores, true);
                        const totalPointsScoredRank = calculateRank(totalPointsScored, allTotalPointsScored, true);


                        return (
                            <div key={currentOwnerId} className="bg-white p-5 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-2xl mb-3">
                                    {currentTeamDisplayName.charAt(0)} {/* Placeholder avatar */}
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">{currentTeamDisplayName}</h4>
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
                                    <div className={`${getComparisonClass(weeklyHighScore, oppWeeklyHighScore)} p-2 rounded-md`}>
                                        Weekly High Score: {weeklyHighScore !== null ? weeklyHighScore.toFixed(2) : 'N/A'} (Rank: {weeklyHighScoreRank})
                                    </div>
                                    <div className={`${getComparisonClass(totalPointsScored, oppTotalPointsScored)} p-2 rounded-md`}>
                                        Total Points Scored: {totalPointsScored !== null ? totalPointsScored.toFixed(2) : 'N/A'} (Rank: {totalPointsScoredRank})
                                    </div>
                                    {/* Add other stats if needed from overallTeamStats that are not directly compared */}
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
                    <p className="text-lg font-semibold mb-1">Record: {renderRecord(ownerARecord)} vs {renderRecord(ownerBRecord)}</p>
                    <p className="text-md">Current Streak: {currentStreak}</p>
                    <p className="text-md">
                        Playoff Record: {ownerARecord.playoffWins}-{ownerARecord.playoffLosses}-{ownerARecord.playoffTies}
                        {' '}vs{' '}
                        {ownerBRecord.playoffWins}-{ownerBRecord.playoffLosses}-{ownerBRecord.playoffTies}
                    </p>
                </div>


                {/* Matchup Highlights */}
                <h4 className="text-xl font-bold text-gray-800 mt-6 mb-4 border-b pb-2">Matchup Highlights</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">{teamADisplayName} Highest Score</p>
                        <p className="text-xl font-bold text-gray-800">
                            {teamAHighestScore.value !== null ? teamAHighestScore.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {teamAHighestScore.value !== null ? `${teamAHighestScore.year} Week ${teamAHighestScore.week}` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">{teamADisplayName} Biggest Win</p>
                        <p className="text-xl font-bold text-gray-800">
                            {teamABiggestWinMargin.value !== null ? teamABiggestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {teamABiggestWinMargin.value !== null ? `Margin (${teamABiggestWinMargin.year} Week ${teamABiggestWinMargin.week})` : 'Margin'}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">{teamADisplayName} Slimmest Win</p>
                        <p className="text-xl font-bold text-gray-800">
                            {teamASlimmestWinMargin.value !== null ? teamASlimmestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {teamASlimmestWinMargin.value !== null ? `Margin (${teamASlimmestWinMargin.year} Week ${teamASlimmestWinMargin.week})` : 'Margin'}
                        </p>
                    </div>
                    {/* Repeat similar sections for Team B's highlights */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-md font-semibold text-red-700">{teamBDisplayName} Highest Score</p>
                            <p className="text-xl font-bold text-gray-800">
                            {teamBHighestScore.value !== null ? teamBHighestScore.value.toFixed(2) : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                            {teamBHighestScore.value !== null ? `${teamBHighestScore.year} Week ${teamBHighestScore.week}` : ''}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-md font-semibold text-red-700">{teamBDisplayName} Biggest Win</p>
                            <p className="text-xl font-bold text-gray-800">
                            {teamBBiggestWinMargin.value !== null ? teamBBiggestWinMargin.value.toFixed(2) : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                            {teamBBiggestWinMargin.value !== null ? `Margin (${teamBBiggestWinMargin.year} Week ${teamBBiggestWinMargin.week})` : 'Margin'}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-md font-semibold text-red-700">{teamBDisplayName} Slimmest Win</p>
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
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">Week</th> {/* Added Week header */}
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamADisplayName} Score</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamBDisplayName} Score</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">Winner</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rivalry.allMatches.sort((a,b) => b.year - a.year || b.week - a.week).map((match, idx) => {
                                // Scores are already correctly assigned based on owner IDs in the stored match object
                                let currentTeamAScore = (match.team1OwnerId === ownerA) ? match.team1Score : match.team2Score;
                                let currentTeamBScore = (match.team1OwnerId === ownerB) ? match.team1Score : match.team2Score;

                                let matchType = 'Reg. Season';
                                if (match.isPlayoff) matchType = 'Playoffs';

                                return (
                                    <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                        <td className="py-2 px-3">{match.year}</td>
                                        <td className="py-2 px-3">{match.week}</td> {/* Display match.week */}
                                        <td className="py-2 px-3">{currentTeamAScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{currentTeamBScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{match.winnerDisplayName === 'Tie' ? 'Tie' : match.winnerDisplayName}</td>
                                        <td className="py-2 px-3 text-xs text-gray-500">{matchType}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [selectedRivalryKey, headToHeadRecords, careerDPRData, getTeamName]); // Dependencies for useCallback

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium">Loading Head-to-Head data...</p>
            </div>
        );
    }

    if (contextError) {
        return (
            <div className="text-center text-red-600 text-lg p-4">
                <p>Error loading historical data: {contextError.message || String(contextError)}</p>
                <p>Please check your Sleeper API configuration and network connection.</p>
            </div>
        );
    }

    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
        return (
            <div className="text-center text-orange-600 text-lg p-4">
                No historical matchup data available to build Head-to-Head grid.
            </div>
        );
    }

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
                                    {sortedDisplayNamesAndOwners.map(team => (
                                        <th key={team.ownerId} className="py-2 px-3 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200 min-w-[90px] sticky top-0 bg-blue-50 z-10"> {/* Sticky top for horizontal scroll */}
                                            {team.displayName}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDisplayNamesAndOwners.map(rowTeam => ( // Iterate over sorted display names for rows
                                    <tr key={rowTeam.ownerId} className="border-b border-gray-100 last:border-b-0">
                                        <td className="py-2 px-3 text-left text-sm text-gray-800 font-semibold sticky left-0 bg-white z-20 border-r border-gray-200 shadow-sm"> {/* Sticky left for vertical scroll */}
                                            {rowTeam.displayName}
                                        </td>
                                        {sortedDisplayNamesAndOwners.map(colTeam => { // Iterate over sorted display names for columns
                                            if (rowTeam.ownerId === colTeam.ownerId) {
                                                return (
                                                    <td key={`${rowTeam.ownerId}-${colTeam.ownerId}`} className="py-2 px-3 text-center text-sm text-gray-400 bg-gray-100 border-b border-gray-200">
                                                        ---
                                                    </td>
                                                );
                                            }
                                            // Find the rivalry key in the correct sorted order of owner IDs
                                            const rivalryKey = [rowTeam.ownerId, colTeam.ownerId].sort().join(' vs ');
                                            const rivalry = headToHeadRecords[rivalryKey];

                                            let recordForDisplay = '0-0'; // Default for no games or issues
                                            let cellClassName = 'py-2 px-3 text-center text-sm border-b border-gray-200 cursor-pointer ';

                                            if (rivalry) {
                                                const rowOwnerRecord = rivalry[rowTeam.ownerId]; // Get record for the row owner
                                                const totalGames = rowOwnerRecord.wins + rowOwnerRecord.losses + rowOwnerRecord.ties;

                                                if (totalGames > 0) {
                                                    recordForDisplay = `${rowOwnerRecord.wins}-${rowOwnerRecord.losses}`; // Format as W-L
                                                    if (rowOwnerRecord.wins > rowOwnerRecord.losses) {
                                                        cellClassName += 'bg-green-100 text-green-800 hover:bg-green-200'; // Green for win
                                                    } else if (rowOwnerRecord.losses > rowOwnerRecord.wins) {
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
                                                    key={`${rowTeam.ownerId}-${colTeam.ownerId}`}
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
