// src/lib/Head2HeadGrid.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Ensure LineChart, Line, Area, Defs, LinearGradient, Stop are imported for a line graph with area fill
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area } from 'recharts'; // Removed Defs, LinearGradient, Stop from recharts import
import { useSleeperData } from '../contexts/SleeperDataContext';

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

const Head2HeadGrid = () => {
    const {
        loading: contextLoading,
        error: contextError,
        historicalData,
        getTeamName,
        careerDPRData // Use careerDPRData directly from context
    } = useSleeperData();

    const [headToHeadRecords, setHeadToHeadRecords] = useState({});
    const [selectedRivalryKey, setSelectedRivalryKey] = useState(null); // Stores the H2H key (e.g., "ownerId1 vs ownerId2")
    const [loading, setLoading] = useState(true); // Local loading state for calculations
    const [weeklyHighScoreCounts, setWeeklyHighScoreCounts] = useState({});

    // Data processing for head-to-head records and weekly high score counts
    useEffect(() => {
        if (contextLoading || contextError) {
            setLoading(true);
            return;
        }

        if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
            setHeadToHeadRecords({});
            setWeeklyHighScoreCounts({});
            setLoading(false);
            return;
        }

        setLoading(true);
        const newHeadToHeadRecords = {};
        const highScoreCounts = {};

        // Calculate weekly high score counts
        Object.entries(historicalData.matchupsBySeason).forEach(([year, matchupsArray]) => {
            // Group matchups by week
            const matchupsByWeek = {};
            matchupsArray.forEach(matchup => {
                if (!matchup.week) return;
                if (!matchupsByWeek[matchup.week]) matchupsByWeek[matchup.week] = [];
                matchupsByWeek[matchup.week].push(matchup);
            });

            Object.entries(matchupsByWeek).forEach(([week, weekMatchups]) => {
                const rostersForYear = historicalData.rostersBySeason?.[year] || [];
                const scores = [];
                weekMatchups.forEach(matchup => {
                    const team1Roster = rostersForYear.find(r => String(r.roster_id) === String(matchup.team1_roster_id));
                    const team2Roster = rostersForYear.find(r => String(r.roster_id) === String(matchup.team2_roster_id));
                    const team1OwnerId = team1Roster?.owner_id;
                    const team2OwnerId = team2Roster?.owner_id;
                    const team1Score = parseFloat(matchup.team1_score);
                    const team2Score = parseFloat(matchup.team2_score);
                    if (team1OwnerId && !isNaN(team1Score)) {
                        scores.push({ ownerId: team1OwnerId, score: team1Score });
                    }
                    if (team2OwnerId && !isNaN(team2Score)) {
                        scores.push({ ownerId: team2OwnerId, score: team2Score });
                    }
                });
                if (scores.length === 0) return;
                const maxScore = Math.max(...scores.map(s => s.score));
                const highScorers = scores.filter(s => s.score === maxScore).map(s => s.ownerId);
                highScorers.forEach(ownerId => {
                    highScoreCounts[ownerId] = (highScoreCounts[ownerId] || 0) + 1;
                });
            });
        });

        // ...existing code for head-to-head records...
        Object.entries(historicalData.matchupsBySeason).forEach(([year, matchupsArray]) => {
            const leagueMetadataForYear = historicalData.leaguesMetadataBySeason[year];
            const championshipWeek = leagueMetadataForYear?.settings?.championship_week ? parseInt(leagueMetadataForYear.settings.championship_week) : null;
            const rostersForYear = historicalData.rostersBySeason?.[year] || [];
            const winnersBracketForYear = historicalData.winnersBracketBySeason?.[year] || [];
            const losersBracketForYear = historicalData.losersBracketBySeason?.[year] || [];

            matchupsArray.forEach(matchup => {
                const team1RosterId = String(matchup.team1_roster_id);
                const team2RosterId = String(matchup.team2_roster_id);
                const team1Score = parseFloat(matchup.team1_score);
                const team2Score = parseFloat(matchup.team2_score);

                if (!team1RosterId || !team2RosterId || team1RosterId === team2RosterId || isNaN(team1Score) || isNaN(team2Score)) {
                    return;
                }

                const team1Roster = rostersForYear.find(r => String(r.roster_id) === team1RosterId);
                const team2Roster = rostersForYear.find(r => String(r.roster_id) === team2RosterId);

                const team1OwnerId = team1Roster?.owner_id;
                const team2OwnerId = team2Roster?.owner_id;

                if (!team1OwnerId || !team2OwnerId) {
                    return;
                }

                const team1DisplayName = getTeamName(team1OwnerId, year);
                const team2DisplayName = getTeamName(team2OwnerId, year);

                if (team1DisplayName.startsWith('Unknown Team') || team2DisplayName.startsWith('Unknown Team')) {
                    return;
                }

                const isTie = team1Score === team2Score;
                const team1Won = team1Score > team2Score;

                // --- Improved Playoff Game Type Detection (always check bracket data) ---
                let matchType = 'Reg. Season';
                const team1RosterIdStr = String(matchup.team1_roster_id);
                const team2RosterIdStr = String(matchup.team2_roster_id);
                const matchupWeek = parseInt(matchup.week);

                // Helper to find a bracket match for these two teams in the same week
                const findBracketMatch = (bracket) => {
                    return bracket.find(bracketMatch => {
                        const bracketTeams = [String(bracketMatch.t1), String(bracketMatch.t2)].filter(Boolean);
                        const bracketWeek = parseInt(bracketMatch.week);
                        return (
                            bracketWeek === matchupWeek &&
                            bracketTeams.includes(team1RosterIdStr) && bracketTeams.includes(team2RosterIdStr)
                        );
                    });
                };

                const winnersMatch = findBracketMatch(winnersBracketForYear);
                const losersMatch = findBracketMatch(losersBracketForYear);

                if (winnersMatch) {
                    if (winnersMatch.p) {
                        const place = winnersMatch.p;
                        if (place === 1) {
                            matchType = 'Championship Game';
                        } else if (place === 3) {
                            matchType = '3rd Place Game';
                        } else if (place === 5) {
                            matchType = '5th Place Game';
                        } else if (place === 7) {
                            matchType = '7th Place Game';
                        } else if (place === 9) {
                            matchType = '9th Place Game';
                        } else if (place === 11) {
                            matchType = '11th Place Game';
                        } else {
                            matchType = `${place}th Place Game`;
                        }
                    } else if (championshipWeek && matchupWeek === championshipWeek) {
                        matchType = 'Championship Game';
                    } else {
                        matchType = 'Playoffs';
                    }
                } else if (losersMatch) {
                    if (losersMatch.p) {
                        const place = losersMatch.p;
                        // Map losers bracket place values: 1=7th, 3=9th, 5=11th
                        if (place === 1) {
                            matchType = '7th Place Game';
                        } else if (place === 3) {
                            matchType = '9th Place Game';
                        } else if (place === 5) {
                            matchType = '11th Place Game';
                        } else {
                            matchType = `Placement Game`;
                        }
                    } else {
                        matchType = 'Consolation';
                    }
                } else if (matchup.playoff) {
                    // Fallback: if matchup.playoff is set but not found in brackets
                    matchType = 'Playoffs (Uncategorized)';
                }

                const sortedOwners = [team1OwnerId, team2OwnerId].sort();
                const h2hKey = `${sortedOwners[0]} vs ${sortedOwners[1]}`;

                if (!newHeadToHeadRecords[h2hKey]) {
                    newHeadToHeadRecords[h2hKey] = {
                        owners: sortedOwners,
                        [sortedOwners[0]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                        [sortedOwners[1]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                        allMatches: []
                    };
                }

                const h2hRecord = newHeadToHeadRecords[h2hKey];

                let winnerOwnerId = 'Tie';
                let loserOwnerId = 'Tie';
                if (team1Won) {
                    winnerOwnerId = team1OwnerId;
                    loserOwnerId = team2OwnerId;
                } else if (team2Score > team1Score) {
                    winnerOwnerId = team2OwnerId;
                    loserOwnerId = team1OwnerId;
                }

                const recordForOwner1 = (team1OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];
                const recordForOwner2 = (team2OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];

                // Consider all playoff/consolation/placement games for playoff record
                const isActualPlayoffGame = (
                    matchType.includes('Playoff') ||
                    matchType.includes('Championship') ||
                    matchType.includes('Consolation')
                );

                if (isTie) {
                    recordForOwner1.ties++;
                    recordForOwner2.ties++;
                    if (isActualPlayoffGame) {
                        recordForOwner1.playoffTies++;
                        recordForOwner2.playoffTies++;
                    }
                } else if (team1Won) {
                    recordForOwner1.wins++;
                    recordForOwner2.losses++;
                    if (isActualPlayoffGame) {
                        recordForOwner1.playoffWins++;
                        recordForOwner2.playoffLosses++;
                    }
                } else {
                    recordForOwner2.wins++;
                    recordForOwner1.losses++;
                    if (isActualPlayoffGame) {
                        recordForOwner2.playoffWins++;
                        recordForOwner1.playoffLosses++;
                    }
                }

                h2hRecord.allMatches.push({
                    year: parseInt(year),
                    week: matchup.week,
                    matchupId: matchup.match_id,
                    team1RosterId,
                    team2RosterId,
                    team1OwnerId,
                    team2OwnerId,
                    team1Score,
                    team2Score,
                    winnerOwnerId,
                    loserOwnerId,
                    winnerDisplayName: winnerOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                    loserDisplayName: loserOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                    winnerScore: winnerOwnerId === team1OwnerId ? team1Score : team2Score,
                    loserScore: loserOwnerId === team1OwnerId ? team1Score : team2Score,
                    isTie,
                    matchType,
                });
            });
        });
        setHeadToHeadRecords(newHeadToHeadRecords);
        setWeeklyHighScoreCounts(highScoreCounts);
        setLoading(false);
    }, [historicalData, getTeamName, contextLoading, contextError]);

    // Create a single, consistent sorted list of display names and their corresponding owner IDs for the grid axes
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

        // Initialize overall highlight stats
        let overallHighestScore = { value: null, year: null, week: null, teamDisplayName: null };
        let overallBiggestWinMargin = { value: null, year: null, week: null, winningTeamDisplayName: null };
        let overallSlimmestWinMargin = { value: Infinity, year: null, week: null, winningTeamDisplayName: null };

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

        // Prepare net points data for line graph, with split for positive/negative fill and zero-crossing points
        let cumulativeNetPoints = 0; // Initialize cumulative points
        const netPointsData = sortedMatches.map((match) => {
            let mainTeamScore, oppTeamScore;
            if (match.team1OwnerId === ownerA) {
                mainTeamScore = match.team1Score;
                oppTeamScore = match.team2Score;
            } else {
                mainTeamScore = match.team2Score;
                oppTeamScore = match.team1Score;
            }
            const currentMatchNetPoints = mainTeamScore - oppTeamScore;
            cumulativeNetPoints += currentMatchNetPoints; // CRITICAL FIX: Accumulate net points

            return {
                name: `${match.year} W${match.week}`,
                netPoints: currentMatchNetPoints, // Keep individual net points for tooltip if needed
                cumulativeNetPoints: cumulativeNetPoints, // The actual cumulative value
                positiveCumulativeNetPoints: cumulativeNetPoints >= 0 ? cumulativeNetPoints : null, // For green area
                negativeCumulativeNetPoints: cumulativeNetPoints < 0 ? cumulativeNetPoints : null,   // For red area
                mainTeamScore,
                oppTeamScore,
                week: match.week,
                year: match.year,
            };
        });

        console.log('Net Points Data for chart:', netPointsData); // Debugging: Check data before chart

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


            // --- Calculate and store overall highlight stats ---

            // Total Points Scored
            teamATotalPointsScored += scoreAValue;
            teamBTotalPointsScored += scoreBValue;

            // Overall Highest Score
            if (scoreAValue > (overallHighestScore.value || 0)) {
                overallHighestScore = { value: scoreAValue, year: match.year, week: match.week, teamDisplayName: match.team1DisplayName };
            }
            if (scoreBValue > (overallHighestScore.value || 0)) {
                overallHighestScore = { value: scoreBValue, year: match.year, week: match.week, teamDisplayName: match.team2DisplayName };
            }

            // Overall Biggest Win Margin
            if (!match.isTie) {
                const margin = Math.abs(scoreAValue - scoreBValue);
                if (margin > (overallBiggestWinMargin.value || 0)) {
                    overallBiggestWinMargin = {
                        value: margin,
                        year: match.year,
                        week: match.week,
                        winningTeamDisplayName: match.winnerDisplayName
                    };
                }
            }

            // Overall Slimmest Win Margin (excluding ties)
            if (!match.isTie) {
                const margin = Math.abs(scoreAValue - scoreBValue);
                if (margin < overallSlimmestWinMargin.value) {
                    overallSlimmestWinMargin = {
                        value: margin,
                        year: match.year,
                        week: match.week,
                        winningTeamDisplayName: match.winnerDisplayName
                    };
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
        // careerDPRData is keyed by ownerId and contains teamName.
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


                {/* Main Teams Cards and VERSUS section in a 3-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-center">
                    {/* Main Team Card (vertical/row axis, ownerA) */}
                    {(() => {
                        const currentOwnerId = ownerA;
                        const currentTeamDisplayName = getTeamName(currentOwnerId, null);
                        const overallTeamStats = careerDPRData?.find(d => d.ownerId === currentOwnerId);
                        const opponentOwnerId = ownerB;
                        const opponentTeamStats = careerDPRData?.find(d => d.ownerId === opponentOwnerId);
                        // ...stat values and statBubble logic as before...
                        // Individual Stats values
                        const totalWins = overallTeamStats ? overallTeamStats.wins : null;
                        const winPercentage = overallTeamStats && typeof overallTeamStats.winPercentage === 'number'
                            ? overallTeamStats.winPercentage
                            : null;
                        const careerDPR = overallTeamStats ? overallTeamStats.dpr : null;
                        const weeklyHighScoreCount = weeklyHighScoreCounts[currentOwnerId] || 0;
                        const weeklyHighScore = overallTeamStats ? overallTeamStats.highScore : null;
                        const totalPointsScored = overallTeamStats ? overallTeamStats.pointsFor : null;
                        // Medal Score calculation
                        let medalScore = 0;
                        if (overallTeamStats) {
                            medalScore += (overallTeamStats.championships || 0) * 10;
                            medalScore += (overallTeamStats.runnerUps || 0) * 6;
                            medalScore += (overallTeamStats.thirdPlaces || 0) * 4;
                            medalScore += (overallTeamStats.pointsChampionships || 0) * 8;
                            medalScore += (overallTeamStats.pointsRunnerUps || 0) * 5;
                            medalScore += (overallTeamStats.thirdPlacePoints || 0) * 3;
                        }
                        // Medal Score rank and highlight
                        const allMedalScores = careerDPRData ? careerDPRData.map(d => {
                            let ms = 0;
                            ms += (d.championships || 0) * 10;
                            ms += (d.runnerUps || 0) * 6;
                            ms += (d.thirdPlaces || 0) * 4;
                            ms += (d.pointsChampionships || 0) * 8;
                            ms += (d.pointsRunnerUps || 0) * 5;
                            ms += (d.thirdPlacePoints || 0) * 3;
                            return ms;
                        }) : [];
                        const medalScoreRank = calculateRank(medalScore, allMedalScores, true);
                        const oppMedalScore = (() => {
                            if (!opponentTeamStats) return 0;
                            let ms = 0;
                            ms += (opponentTeamStats.championships || 0) * 10;
                            ms += (opponentTeamStats.runnerUps || 0) * 6;
                            ms += (opponentTeamStats.thirdPlaces || 0) * 4;
                            ms += (opponentTeamStats.pointsChampionships || 0) * 8;
                            ms += (opponentTeamStats.pointsRunnerUps || 0) * 5;
                            ms += (opponentTeamStats.thirdPlacePoints || 0) * 3;
                            return ms;
                        })();
                        let medalScoreClass = 'bg-blue-50';
                        if (medalScore > oppMedalScore) {
                            medalScoreClass = 'bg-green-100 text-green-800';
                        } else if (medalScore < oppMedalScore) {
                            medalScoreClass = 'bg-red-100 text-red-800';
                        } else if (medalScore === oppMedalScore && medalScore !== 0) {
                            medalScoreClass = 'bg-yellow-100 text-yellow-800';
                        }
                        // Opponent's Individual Stats values for comparison
                        const oppTotalWins = opponentTeamStats ? opponentTeamStats.wins : null;
                        const oppWinPercentage = opponentTeamStats ? opponentTeamStats.winPercentage : null;
                        const oppCareerDPR = opponentTeamStats ? opponentTeamStats.dpr : null;
                        const oppWeeklyHighScore = opponentTeamStats ? opponentTeamStats.highScore : null;
                        const oppTotalPointsScored = opponentTeamStats ? opponentTeamStats.pointsFor : null;
                        const getComparisonClass = (teamValue, opponentValue, isHigherBetter = true) => {
                            if (teamValue === null || opponentValue === null || typeof teamValue === 'undefined' || typeof opponentValue === 'undefined' || isNaN(teamValue) || isNaN(opponentValue)) {
                                return 'bg-blue-50';
                            }
                            if (teamValue === opponentValue) return 'bg-yellow-100 text-yellow-800';
                            if (isHigherBetter) {
                                return teamValue > opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            } else {
                                return teamValue < opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            }
                        };
                        const totalWinsRank = calculateRank(totalWins, allTotalWins, true);
                        const winPercentageRank = calculateRank(winPercentage, allWinPercentages, true);
                        const careerDPRRank = calculateRank(careerDPR, allCareerDPRs, true);
                        const weeklyHighScoreRank = calculateRank(weeklyHighScore, allHighestSingleGameScores, true);
                        const totalPointsScoredRank = calculateRank(totalPointsScored, allTotalPointsScored, true);
                        // Highlight for weekly high score count: green if more, red if less, yellow if equal
                        const oppWeeklyHighScoreCount = weeklyHighScoreCounts[opponentOwnerId] || 0;
                        let weeklyHighScoreCountClass = 'p-2 rounded-md ';
                        if (weeklyHighScoreCount > oppWeeklyHighScoreCount) {
                            weeklyHighScoreCountClass += 'bg-green-100 text-green-800';
                        } else if (weeklyHighScoreCount < oppWeeklyHighScoreCount) {
                            weeklyHighScoreCountClass += 'bg-red-100 text-red-800';
                        } else {
                            weeklyHighScoreCountClass += 'bg-yellow-100 text-yellow-800';
                        }
                        // Win % highlight (green if higher, red if lower, yellow if equal)
                        const winPctClass = getComparisonClass(winPercentage, oppWinPercentage, true);
                        // Stat bubble display helper (responsive, even sizing)
                        const statBubble = (rank, label, value, className) => (
                            <div className={className + ' flex flex-col items-center justify-center aspect-[5/3] w-full h-full rounded-lg shadow-sm'}>
                                <span className="block text-base font-bold mb-1">{rank}</span>
                                <span className="block text-xs font-semibold text-center">{label} <span className="font-normal">({value})</span></span>
                            </div>
                        );
                        return (
                            <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-2xl mb-3">
                                    {currentTeamDisplayName.charAt(0)}
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">{currentTeamDisplayName}</h4>
                                <div className="grid grid-cols-3 gap-3 w-full text-xs font-medium text-gray-700">
                                    {statBubble(totalWinsRank, 'Total Wins', totalWins !== null ? totalWins : 'N/A', getComparisonClass(totalWins, oppTotalWins))}
                                    {statBubble(winPercentageRank, 'Win %', winPercentage !== null ? winPercentage.toFixed(3) + '%' : 'N/A', winPctClass)}
                                    {statBubble(careerDPRRank, 'Career DPR', careerDPR !== null ? careerDPR.toFixed(3) : 'N/A', getComparisonClass(careerDPR, oppCareerDPR))}
                                    {statBubble(calculateRank(weeklyHighScoreCount, Object.values(weeklyHighScoreCounts), true), 'Weekly High Score', weeklyHighScoreCount, weeklyHighScoreCountClass)}
                                    {statBubble(totalPointsScoredRank, 'Total Points', totalPointsScored !== null ? totalPointsScored.toFixed(2) : 'N/A', getComparisonClass(totalPointsScored, oppTotalPointsScored))}
                                    {statBubble(medalScoreRank, 'Medal Score', medalScore, medalScoreClass)}
                                </div>
                            </div>
                        );
                    })()}

                    {/* VERSUS Section (center column) */}
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-6 rounded-xl shadow-lg border border-blue-600 text-center w-full max-w-xs mx-auto">
                            <h4 className="text-2xl font-extrabold mb-3 tracking-wide">★ VERSUS ★</h4>
                            <p className="text-xl font-semibold mb-2">Record: <span className="font-bold">{
                                ownerARecord.ties && ownerARecord.ties > 0
                                    ? renderRecord(ownerARecord)
                                    : `${ownerARecord.wins || 0}-${ownerARecord.losses || 0}`
                            }</span></p>
                            {currentStreakTeam ? (
                                <p className="text-lg mb-2">Streak: {currentStreakTeam === ownerA ? `W-${currentStreakCount}` : `L-${currentStreakCount}`}</p>
                            ) : (
                                <div className="mb-2 h-6"></div>
                            )}
                            <p className="text-lg">
                                Playoff Record: <span className="font-bold">
                                    {(() => {
                                        // Only count Playoff and Championship games
                                        const playoffWins = rivalry.allMatches.filter(m => (
                                            m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.winnerOwnerId === ownerA
                                        ).length;
                                        const playoffLosses = rivalry.allMatches.filter(m => (
                                            m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.loserOwnerId === ownerA
                                        ).length;
                                        const playoffTies = rivalry.allMatches.filter(m => (
                                            m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.isTie
                                        ).length;
                                        if (playoffTies > 0) {
                                            return `${playoffWins}-${playoffLosses}-${playoffTies}`;
                                        } else {
                                            return `${playoffWins}-${playoffLosses}`;
                                        }
                                    })()}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Opponent Team Card (horizontal/col axis, ownerB) */}
                    {(() => {
                        const currentOwnerId = ownerB;
                        const currentTeamDisplayName = getTeamName(currentOwnerId, null);
                        const overallTeamStats = careerDPRData?.find(d => d.ownerId === currentOwnerId);
                        const opponentOwnerId = ownerA;
                        const opponentTeamStats = careerDPRData?.find(d => d.ownerId === opponentOwnerId);
                        // ...stat values and statBubble logic as before...
                        // Individual Stats values
                        const totalWins = overallTeamStats ? overallTeamStats.wins : null;
                        const winPercentage = overallTeamStats && typeof overallTeamStats.winPercentage === 'number'
                            ? overallTeamStats.winPercentage
                            : null;
                        const careerDPR = overallTeamStats ? overallTeamStats.dpr : null;
                        const weeklyHighScoreCount = weeklyHighScoreCounts[currentOwnerId] || 0;
                        const weeklyHighScore = overallTeamStats ? overallTeamStats.highScore : null;
                        const totalPointsScored = overallTeamStats ? overallTeamStats.pointsFor : null;
                        // Medal Score calculation
                        let medalScore = 0;
                        if (overallTeamStats) {
                            medalScore += (overallTeamStats.championships || 0) * 10;
                            medalScore += (overallTeamStats.runnerUps || 0) * 6;
                            medalScore += (overallTeamStats.thirdPlaces || 0) * 4;
                            medalScore += (overallTeamStats.pointsChampionships || 0) * 8;
                            medalScore += (overallTeamStats.pointsRunnerUps || 0) * 5;
                            medalScore += (overallTeamStats.thirdPlacePoints || 0) * 3;
                        }
                        // Medal Score rank and highlight
                        const allMedalScores = careerDPRData ? careerDPRData.map(d => {
                            let ms = 0;
                            ms += (d.championships || 0) * 10;
                            ms += (d.runnerUps || 0) * 6;
                            ms += (d.thirdPlaces || 0) * 4;
                            ms += (d.pointsChampionships || 0) * 8;
                            ms += (d.pointsRunnerUps || 0) * 5;
                            ms += (d.thirdPlacePoints || 0) * 3;
                            return ms;
                        }) : [];
                        const medalScoreRank = calculateRank(medalScore, allMedalScores, true);
                        const oppMedalScore = (() => {
                            if (!opponentTeamStats) return 0;
                            let ms = 0;
                            ms += (opponentTeamStats.championships || 0) * 10;
                            ms += (opponentTeamStats.runnerUps || 0) * 6;
                            ms += (opponentTeamStats.thirdPlaces || 0) * 4;
                            ms += (opponentTeamStats.pointsChampionships || 0) * 8;
                            ms += (opponentTeamStats.pointsRunnerUps || 0) * 5;
                            ms += (opponentTeamStats.thirdPlacePoints || 0) * 3;
                            return ms;
                        })();
                        let medalScoreClass = 'bg-blue-50';
                        if (medalScore > oppMedalScore) {
                            medalScoreClass = 'bg-green-100 text-green-800';
                        } else if (medalScore < oppMedalScore) {
                            medalScoreClass = 'bg-red-100 text-red-800';
                        } else if (medalScore === oppMedalScore && medalScore !== 0) {
                            medalScoreClass = 'bg-yellow-100 text-yellow-800';
                        }
                        // Opponent's Individual Stats values for comparison
                        const oppTotalWins = opponentTeamStats ? opponentTeamStats.wins : null;
                        const oppWinPercentage = opponentTeamStats ? opponentTeamStats.winPercentage : null;
                        const oppCareerDPR = opponentTeamStats ? opponentTeamStats.dpr : null;
                        const oppWeeklyHighScore = opponentTeamStats ? opponentTeamStats.highScore : null;
                        const oppTotalPointsScored = opponentTeamStats ? opponentTeamStats.pointsFor : null;
                        const getComparisonClass = (teamValue, opponentValue, isHigherBetter = true) => {
                            if (teamValue === null || opponentValue === null || typeof teamValue === 'undefined' || typeof opponentValue === 'undefined' || isNaN(teamValue) || isNaN(opponentValue)) {
                                return 'bg-blue-50';
                            }
                            if (teamValue === opponentValue) return 'bg-yellow-100 text-yellow-800';
                            if (isHigherBetter) {
                                return teamValue > opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            } else {
                                return teamValue < opponentValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            }
                        };
                        const totalWinsRank = calculateRank(totalWins, allTotalWins, true);
                        const winPercentageRank = calculateRank(winPercentage, allWinPercentages, true);
                        const careerDPRRank = calculateRank(careerDPR, allCareerDPRs, true);
                        const weeklyHighScoreRank = calculateRank(weeklyHighScore, allHighestSingleGameScores, true);
                        const totalPointsScoredRank = calculateRank(totalPointsScored, allTotalPointsScored, true);
                        // Highlight for weekly high score count: green if more, red if less, yellow if equal
                        const oppWeeklyHighScoreCount = weeklyHighScoreCounts[opponentOwnerId] || 0;
                        let weeklyHighScoreCountClass = 'p-2 rounded-md ';
                        if (weeklyHighScoreCount > oppWeeklyHighScoreCount) {
                            weeklyHighScoreCountClass += 'bg-green-100 text-green-800';
                        } else if (weeklyHighScoreCount < oppWeeklyHighScoreCount) {
                            weeklyHighScoreCountClass += 'bg-red-100 text-red-800';
                        } else {
                            weeklyHighScoreCountClass += 'bg-yellow-100 text-yellow-800';
                        }
                        // Win % highlight (green if higher, red if lower, yellow if equal)
                        const winPctClass = getComparisonClass(winPercentage, oppWinPercentage, true);
                        // Stat bubble display helper (responsive, even sizing)
                        const statBubble = (rank, label, value, className) => (
                            <div className={className + ' flex flex-col items-center justify-center aspect-[5/3] w-full h-full rounded-lg shadow-sm'}>
                                <span className="block text-base font-bold mb-1">{rank}</span>
                                <span className="block text-xs font-semibold text-center">{label} <span className="font-normal">({value})</span></span>
                            </div>
                        );
                        return (
                            <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-2xl mb-3">
                                    {currentTeamDisplayName.charAt(0)}
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">{currentTeamDisplayName}</h4>
                                <div className="grid grid-cols-3 gap-3 w-full text-xs font-medium text-gray-700">
                                    {statBubble(totalWinsRank, 'Total Wins', totalWins !== null ? totalWins : 'N/A', getComparisonClass(totalWins, oppTotalWins))}
                                    {statBubble(winPercentageRank, 'Win %', winPercentage !== null ? winPercentage.toFixed(3) + '%' : 'N/A', winPctClass)}
                                    {statBubble(careerDPRRank, 'Career DPR', careerDPR !== null ? careerDPR.toFixed(3) : 'N/A', getComparisonClass(careerDPR, oppCareerDPR))}
                                    {statBubble(calculateRank(weeklyHighScoreCount, Object.values(weeklyHighScoreCounts), true), 'Weekly High Score', weeklyHighScoreCount, weeklyHighScoreCountClass)}
                                    {statBubble(totalPointsScoredRank, 'Total Points', totalPointsScored !== null ? totalPointsScored.toFixed(2) : 'N/A', getComparisonClass(totalPointsScored, oppTotalPointsScored))}
                                    {statBubble(medalScoreRank, 'Medal Score', medalScore, medalScoreClass)}
                                </div>
                            </div>
                        );
                    })()}
                </div>


                {/* Net Points Line Graph */}
                <h4 className="text-xl font-bold text-gray-800 mt-6 mb-2 border-b pb-2">Cumulative Net Points Over Time</h4>
                <div className="w-full h-64 mb-8">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={netPointsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="name"
                                fontSize={12}
                                angle={-30}
                                textAnchor="end"
                                height={50}
                                interval={0}
                                tickFormatter={(value, index) => value}
                                ticks={netPointsData.map(d => d.name)}
                            />
                            <YAxis domain={['auto', 'auto']} fontSize={12} />
                            <Tooltip formatter={(value, name) => {
                                if (name === 'cumulativeNetPoints') { // Show cumulative in tooltip
                                    return [`${value.toFixed(2)}`, 'Cumulative Net Points'];
                                }
                                return [value, name];
                            }} />
                            <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />

                            {/* Area for positive cumulative net points */}
                            <Area
                                type="monotone"
                                dataKey="positiveCumulativeNetPoints" // Use positive data key
                                stroke="#22c55e" // Line color for positive segment
                                fill="#22c55e" // Fill color for positive area
                                fillOpacity={0.3}
                                isAnimationActive={false}
                                connectNulls={true}
                                baseLine={0} // Crucial for filling from zero
                            />
                            {/* Area for negative cumulative net points */}
                            <Area
                                type="monotone"
                                dataKey="negativeCumulativeNetPoints" // Use negative data key
                                stroke="#ef4444" // Line color for negative segment
                                fill="#ef4444" // Fill color for negative area
                                fillOpacity={0.3}
                                isAnimationActive={false}
                                connectNulls={true}
                                baseLine={0} // Crucial for filling from zero
                            />
                            {/* A single line to connect all points, with conditional dot coloring */}
                            <Line
                                type="monotone"
                                dataKey="cumulativeNetPoints"
                                stroke="#888" // Default line color, dots will override
                                strokeWidth={2}
                                dot={(props) => { // Custom dot for positive/negative values
                                    const { cx, cy, payload } = props;
                                    let color = '#888'; // Default for 0 or undefined
                                    if (payload.cumulativeNetPoints > 0) {
                                        color = '#22c55e';
                                    } else if (payload.cumulativeNetPoints < 0) {
                                        color = '#ef4444';
                                    } else {
                                        color = '#eab308'; // Yellow for exactly zero
                                    }
                                    return <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={1} />;
                                }}
                                activeDot={(props) => { // Custom active dot for positive/negative values
                                    const { cx, cy, payload } = props;
                                    let color = '#888'; // Default for 0 or undefined
                                    if (payload.cumulativeNetPoints > 0) {
                                        color = '#22c55e';
                                    } else if (payload.cumulativeNetPoints < 0) {
                                        color = '#ef4444';
                                    } else {
                                        color = '#eab308'; // Yellow for exactly zero
                                    }
                                    return <circle cx={cx} cy={cy} r={6} fill={color} stroke={color} strokeWidth={2} />;
                                }}
                                isAnimationActive={false}
                                connectNulls={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-center mt-2 text-gray-600">
                        Green area: {teamADisplayName} leading in cumulative net points. Red area: {teamBDisplayName} leading in cumulative net points.
                    </div>
                </div>

                {/* Matchup Highlights */}
                <h4 className="text-xl font-bold text-gray-800 mt-6 mb-4 border-b pb-2">Matchup Highlights</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">Highest Score</p>
                        <p className="text-xl font-bold text-gray-800">
                            {overallHighestScore.value !== null ? overallHighestScore.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {overallHighestScore.value !== null ?
                                `${overallHighestScore.teamDisplayName} (${overallHighestScore.year} Week ${overallHighestScore.week})` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">Biggest Win Margin</p>
                        <p className="text-xl font-bold text-gray-800">
                            {overallBiggestWinMargin.value !== null ? overallBiggestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {overallBiggestWinMargin.value !== null ?
                                `${overallBiggestWinMargin.winningTeamDisplayName} (${overallBiggestWinMargin.year} Week ${overallBiggestWinMargin.week})` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                        <p className="text-md font-semibold text-blue-700">Slimmest Win Margin</p>
                        <p className="text-xl font-bold text-gray-800">
                            {overallSlimmestWinMargin.value !== Infinity ? overallSlimmestWinMargin.value.toFixed(2) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {overallSlimmestWinMargin.value !== Infinity ?
                                `${overallSlimmestWinMargin.winningTeamDisplayName} (${overallSlimmestWinMargin.year} Week ${overallSlimmestWinMargin.week})` : ''}
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
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamADisplayName} Score</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">{teamBDisplayName} Score</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">Winner</th>
                                <th className="py-2 px-3 text-left font-semibold text-blue-700">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rivalry.allMatches.sort((a,b) => b.year - a.year || b.week - a.week).map((match, idx) => {
                                let currentTeamAScore = (match.team1OwnerId === ownerA) ? match.team1Score : match.team2Score;
                                let currentTeamBScore = (match.team1OwnerId === ownerB) ? match.team1Score : match.team2Score;

                                return (
                                    <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                                        <td className="py-2 px-3">{match.year}</td>
                                        <td className="py-2 px-3">{match.week}</td>
                                        <td className="py-2 px-3">{currentTeamAScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{currentTeamBScore.toFixed(2)}</td>
                                        <td className="py-2 px-3">{match.winnerDisplayName === 'Tie' ? 'Tie' : match.winnerDisplayName}</td>
                                        <td className="py-2 px-3 text-xs text-gray-500">{match.matchType}</td> {/* Use pre-calculated matchType */}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }, [selectedRivalryKey, headToHeadRecords, careerDPRData, getTeamName, historicalData]);

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
                renderSelectedRivalryDetails()
            ) : (
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

                                            let recordForDisplay = '0-0';
                                            let cellClassName = 'py-2 px-3 text-center text-sm border-b border-gray-200 cursor-pointer ';

                                            if (rivalry) {
                                                const rowOwnerRecord = rivalry[rowTeam.ownerId];
                                                const totalGames = rowOwnerRecord.wins + rowOwnerRecord.losses + rowOwnerRecord.ties;

                                                if (totalGames > 0) {
                                                    recordForDisplay = `${rowOwnerRecord.wins}-${rowOwnerRecord.losses}`;
                                                    if (rowOwnerRecord.wins > rowOwnerRecord.losses) {
                                                        cellClassName += 'bg-green-100 text-green-800 hover:bg-green-200';
                                                    } else if (rowOwnerRecord.losses > rowOwnerRecord.wins) {
                                                        cellClassName += 'bg-red-100 text-red-800 hover:bg-red-200';
                                                    } else {
                                                        cellClassName += 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
                                                    }
                                                } else {
                                                    cellClassName += 'text-gray-600 bg-white hover:bg-gray-50';
                                                }
                                            } else {
                                                    cellClassName += 'text-gray-600 bg-white hover:bg-gray-50';
                                            }


                                            return (
                                                <td
                                                    key={`${rowTeam.ownerId}-${colTeam.ownerId}`}
                                                    className={cellClassName}
                                                    onClick={() => rivalry && setSelectedRivalryKey(rivalryKey)}
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
