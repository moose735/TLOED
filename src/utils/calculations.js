// src/utils/calculations.js
/**
 * Helper function to calculate raw DPR (Power Rating) for a team.
 * @param {number} averageScore - The team's average score for the period (season or career).
 * @param {number} teamHighScore - The team's highest single-game score for the period (season or career).\n * @param {number} teamLowScore - The team's lowest single-game score for the period (season or career).\n * @param {number} teamWinPercentage - Win percentage of the team for the period (season or career).
 * @returns {number} The raw DPR value (Power Rating).
 */
export const calculateRawDPR = (averageScore, teamHighScore, teamLowScore, teamWinPercentage) => {
    // Formula: ((Average Score * 6) + ((Team High Score + Team Low Score) * 2) + ((Win% * 200) * 2)) / 10
    const pointsComponent = averageScore * 6;
    const deviationComponent = (teamHighScore + teamLowScore) * 2;
    const winPercentageComponent = (teamWinPercentage * 200) * 2;
    const rawDPR = (pointsComponent + deviationComponent + winPercentageComponent) / 10;
    return rawDPR;
};

/**
 * Helper function to calculate Luck Rating for a team in a season.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {string} teamName - The name of the team for which to calculate luck.
 * @param {number} year - The year for which to calculate luck.
 * @param {Object} weeklyGameScoresByTeamAndYear - Object containing weekly scores for each team in each year.
 * @returns {number} The Luck Rating.
 */
export const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByTeamAndYear) => {
    let totalScore = 0;
    let opponentScores = [];
    let gamesPlayed = 0;

    historicalMatchups.forEach(match => {
        const matchYear = parseInt(match.year);
        const team1 = String(match.team1 || '').trim();
        const team2 = String(match.team2 || '').trim();

        if (matchYear === year) {
            let currentTeamScore = 0;
            let currentOpponentScore = 0;

            if (team1 === teamName) {
                currentTeamScore = parseFloat(match.team1Score);
                currentOpponentScore = parseFloat(match.team2Score);
            } else if (team2 === teamName) {
                currentTeamScore = parseFloat(match.team2Score);
                currentOpponentScore = parseFloat(match.team1Score);
            } else {
                return; // Not a match for this team in this year
            }

            // Exclude pointsOnlyBye matches from luck calculation
            if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                totalScore += currentTeamScore;
                opponentScores.push(currentOpponentScore);
                gamesPlayed++;
            }
        }
    });

    if (gamesPlayed === 0) return 0; // No games played for valid luck calculation

    const averageScore = totalScore / gamesPlayed;

    // Calculate All-Play Win Percentage
    let allPlayWins = 0;
    let allPlayTies = 0;
    let allPlayLosses = 0;

    const allScoresInSeason = [];
    Object.keys(weeklyGameScoresByTeamAndYear[year] || {}).forEach(tName => {
        weeklyGameScoresByTeamAndYear[year][tName].forEach(score => {
            allScoresInSeason.push(score);
        });
    });

    if (allScoresInSeason.length > 0) {
        // For each of the team's scores, compare against all other scores in the league for that week
        historicalMatchups.forEach(match => {
            const matchYear = parseInt(match.year);
            const week = parseInt(match.week);
            const team1 = String(match.team1 || '').trim();
            const team2 = String(match.team2 || '').trim();

            if (matchYear === year && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                let currentTeamScore = 0;
                if (team1 === teamName) {
                    currentTeamScore = parseFloat(match.team1Score);
                } else if (team2 === teamName) {
                    currentTeamScore = parseFloat(match.team2Score);
                } else {
                    return;
                }

                // Get all scores for this specific week from all teams
                const scoresInThisWeek = [];
                Object.keys(weeklyGameScoresByTeamAndYear[year] || {}).forEach(tName => {
                    const weeklyScoresForTeam = weeklyGameScoresByTeamAndYear[year][tName];
                    // Find the score for this team in this specific week
                    // Assuming weeklyGameScoresByTeamAndYear is structured to get scores by week easily
                    // This part might need adjustment based on exact structure of weeklyGameScoresByTeamAndYear
                    // For now, let's simplify and use the full weeklyGameScoresByTeamAndYear data structure
                    // The 'allScoresInSeason' already has all individual scores, so we can use that for direct comparison.
                    // A more accurate all-play would compare team's score against *all other scores in that specific week*
                    // However, given the current input, a simpler comparison against all scores in the season is made here for luck calculation.
                    // To be truly "all-play", we need week-specific scores from *all* teams.
                    // Let's assume weeklyGameScoresByTeamAndYear stores scores per week as well.

                    // To simplify, let's use the concept that for each score a team had, how many times would it have won against every other score that week
                    // This is usually an N-vs-N comparison, which is complex.
                    // A simpler approximation of luck rating is often just (Actual Wins - Expected Wins)
                    // Expected wins could be All-Play Win % * total games.

                    // Re-evaluating based on common luck rating definitions:
                    // Luck is often (Actual Win % - All-Play Win %).
                    // So we need All-Play Win % first.

                    // All-Play Win Percentage for the team in that season
                    let winsAgainstLeague = 0;
                    let tiesAgainstLeague = 0;
                    let totalComparisons = 0;

                    Object.entries(weeklyGameScoresByTeamAndYear[year]).forEach(([otherTeam, otherScores]) => {
                        if (otherTeam !== teamName) { // Compare only against other teams' scores
                            otherScores.forEach(otherScore => {
                                totalComparisons++;
                                if (currentTeamScore > otherScore) {
                                    winsAgainstLeague++;
                                } else if (currentTeamScore === otherScore) {
                                    tiesAgainstLeague++;
                                }
                            });
                        }
                    });

                    // Update all-play wins/ties/losses for this specific team's game score
                    // This needs to be done once per game, not per score in other teams.
                    // The `allPlayWinPercentage` is calculated globally within `calculateAllLeagueMetrics`
                    // and then retrieved, not re-calculated here.
                });
            }
        });
    }

    // The calculation of allPlayWinPercentage is done outside this function in calculateAllLeagueMetrics
    // Here we're just calculating the "luck" based on (actualWinPercentage - allPlayWinPercentage)
    // The allPlayWinPercentage comes from the main calculateAllLeagueMetrics function.
    // This `calculateLuckRating` function is likely deprecated or used for something else.
    // The luckRating in seasonalMetrics is calculated directly in calculateAllLeagueMetrics.
    return 0; // Return 0 for this helper, as luck is calculated in the main function.
};


export const calculateAllLeagueMetrics = (historicalMatchups, getMappedTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");
    const teamStats = {}; // { teamName: { wins, losses, ties, pointsFor, gamesPlayed, rawDPR, ... } }
    const seasonalMetrics = {}; // { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, luckRating, adjustedDPR, allPlayWinPercentage, rank, ... } } }
    const weeklyGameScoresByYear = {}; // { year: { teamName: [score1, score2, ...], ... } }

    const allTeamNames = new Set();

    // First pass to populate basic stats and all team names
    historicalMatchups.forEach(match => {
        const team1Mapped = getMappedTeamName(String(match.team1 || '').trim());
        const team2Mapped = getMappedTeamName(String(match.team2 || '').trim());
        const year = parseInt(match.year);
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);

        if (isNaN(year) || !team1Mapped || !team2Mapped || isNaN(team1Score) || isNaN(team2Score)) {
            return;
        }

        allTeamNames.add(team1Mapped);
        allTeamNames.add(team2Mapped);

        if (!weeklyGameScoresByYear[year]) {
            weeklyGameScoresByYear[year] = {};
        }
        if (!weeklyGameScoresByYear[year][team1Mapped]) {
            weeklyGameScoresByYear[year][team1Mapped] = [];
        }
        if (!weeklyGameScoresByYear[year][team2Mapped]) {
            weeklyGameScoresByYear[year][team2Mapped] = [];
        }

        // Only count actual games for weekly scores, not points-only byes
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            weeklyGameScoresByYear[year][team1Mapped].push(team1Score);
            weeklyGameScoresByYear[year][team2Mapped].push(team2Score);
        }

        // Initialize teamStats for all teams across all years
        [team1Mapped, team2Mapped].forEach(team => {
            if (!teamStats[team]) {
                teamStats[team] = { wins: 0, losses: 0, ties: 0, totalPointsFor: 0, gamesPlayed: 0, highScores: [], lowScores: [] };
            }
        });

        // Initialize seasonalMetrics for all teams for the current year
        if (!seasonalMetrics[year]) {
            seasonalMetrics[year] = {};
        }
        [team1Mapped, team2Mapped].forEach(team => {
            if (!seasonalMetrics[year][team]) {
                seasonalMetrics[year][team] = {
                    wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
                    luckRating: 0, adjustedDPR: 0, allPlayWinPercentage: 0, rank: 0,
                    isChampion: false, isRunnerUp: false, isThirdPlace: false,
                    isPointsChampion: false, // Initialized here
                    isPointsRunnerUp: false, // New: Initialized here
                    isThirdPlacePoints: false, // New: Initialized here
                    totalGames: 0, // Track games played per season
                };
            }
        });


        // Update overall career stats (used for career DPR)
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            teamStats[team1Mapped].gamesPlayed++;
            teamStats[team2Mapped].gamesPlayed++;
            teamStats[team1Mapped].totalPointsFor += team1Score;
            teamStats[team2Mapped].totalPointsFor += team2Score;
            teamStats[team1Mapped].highScores.push(team1Score);
            teamStats[team1Mapped].lowScores.push(team1Score);
            teamStats[team2Mapped].highScores.push(team2Score);
            teamStats[team2Mapped].lowScores.push(team2Score);

            if (team1Score > team2Score) {
                teamStats[team1Mapped].wins++;
                teamStats[team2Mapped].losses++;
            } else if (team1Score < team2Score) {
                teamStats[team1Mapped].losses++;
                teamStats[team2Mapped].wins++;
            } else {
                teamStats[team1Mapped].ties++;
                teamStats[team2Mapped].ties++;
            }
        }


        // Update seasonal stats
        if (!seasonalMetrics[year][team1Mapped].totalGames) seasonalMetrics[year][team1Mapped].totalGames = 0;
        if (!seasonalMetrics[year][team2Mapped].totalGames) seasonalMetrics[year][team2Mapped].totalGames = 0;

        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            seasonalMetrics[year][team1Mapped].totalGames++;
            seasonalMetrics[year][team2Mapped].totalGames++;
            seasonalMetrics[year][team1Mapped].pointsFor += team1Score;
            seasonalMetrics[year][team2Mapped].pointsFor += team2Score;
            seasonalMetrics[year][team1Mapped].pointsAgainst += team2Score;
            seasonalMetrics[year][team2Mapped].pointsAgainst += team1Score;

            if (team1Score > team2Score) {
                seasonalMetrics[year][team1Mapped].wins++;
                seasonalMetrics[year][team2Mapped].losses++;
            } else if (team1Score < team2Score) {
                seasonalMetrics[year][team1Mapped].losses++;
                seasonalMetrics[year][team2Mapped].wins++;
            } else {
                seasonalMetrics[year][team1Mapped].ties++;
                seasonalMetrics[year][team2Mapped].ties++;
            }
        }
    });

    // Second pass for seasonal calculations (Luck, All-Play Win %, DPR)
    Object.keys(seasonalMetrics).sort().forEach(year => {
        // Calculate All-Play Win Percentage for each team in the current season
        const allTeamsInSeason = Object.keys(seasonalMetrics[year]);
        allTeamsInSeason.forEach(teamName => {
            let allPlayWins = 0;
            let allPlayTies = 0;
            let allPlayLosses = 0;
            let totalPossibleGames = 0;

            const teamScoresInSeason = weeklyGameScoresByYear[year][teamName];
            if (!teamScoresInSeason) return;

            teamScoresInSeason.forEach(currentTeamScore => {
                allTeamsInSeason.forEach(opponentTeamName => {
                    if (teamName === opponentTeamName) return; // Don't compare a team against itself

                    const opponentScoresInSeason = weeklyGameScoresByYear[year][opponentTeamName];
                    if (!opponentScoresInSeason) return;

                    opponentScoresInSeason.forEach(opponentScore => {
                        totalPossibleGames++;
                        if (currentTeamScore > opponentScore) {
                            allPlayWins++;
                        } else if (currentTeamScore < opponentScore) {
                            allPlayLosses++;
                        } else {
                            allPlayTies++;
                        }
                    });
                });
            });

            if (totalPossibleGames > 0) {
                seasonalMetrics[year][teamName].allPlayWinPercentage = (allPlayWins + 0.5 * allPlayTies) / totalPossibleGames;
            } else {
                seasonalMetrics[year][teamName].allPlayWinPercentage = 0;
            }

            // Calculate Luck Rating: (Actual Win % - All-Play Win %)
            const actualWinPercentage = (seasonalMetrics[year][teamName].totalGames > 0) ?
                ((seasonalMetrics[year][teamName].wins + 0.5 * seasonalMetrics[year][teamName].ties) / seasonalMetrics[year][teamName].totalGames) : 0;
            seasonalMetrics[year][teamName].luckRating = actualWinPercentage - seasonalMetrics[year][teamName].allPlayWinPercentage;

            // Calculate Raw DPR for the season
            const seasonTeamScores = weeklyGameScoresByYear[year][teamName] || [];
            const seasonHighScore = seasonTeamScores.length > 0 ? Math.max(...seasonTeamScores) : 0;
            const seasonLowScore = seasonTeamScores.length > 0 ? Math.min(...seasonTeamScores) : 0;
            const seasonAverageScore = seasonTeamScores.length > 0 ? seasonTeamScores.reduce((a, b) => a + b, 0) / seasonTeamScores.length : 0;

            if (seasonTeamScores.length > 0) {
                seasonalMetrics[year][teamName].rawDPR = calculateRawDPR(
                    seasonAverageScore,
                    seasonHighScore,
                    seasonLowScore,
                    actualWinPercentage
                );
            } else {
                seasonalMetrics[year][teamName].rawDPR = 0;
            }
        });

        // Determine adjusted DPR for the season
        const allRawDPRsInSeason = Object.values(seasonalMetrics[year]).map(metrics => metrics.rawDPR);
        const avgRawDPRInSeason = allRawDPRsInSeason.length > 0 ? allRawDPRsInSeason.reduce((sum, dpr) => sum + dpr, 0) / allRawDPRsInSeason.length : 0;

        Object.keys(seasonalMetrics[year]).forEach(teamName => {
            if (avgRawDPRInSeason > 0) {
                seasonalMetrics[year][teamName].adjustedDPR = seasonalMetrics[year][teamName].rawDPR / avgRawDPRInSeason;
            } else {
                seasonalMetrics[year][teamName].adjustedDPR = 0;
            }
        });

        // Determine Rank based on wins/losses/ties first, then points for, then adjusted DPR
        const teamsWithCalculatedMetrics = Object.values(seasonalMetrics[year]);
        teamsWithCalculatedMetrics.sort((a, b) => {
            // Primary sort: Win percentage
            const winPercentageA = (a.wins + 0.5 * a.ties) / a.totalGames;
            const winPercentageB = (b.wins + 0.5 * b.ties) / b.totalGames;
            if (winPercentageB !== winPercentageA) return winPercentageB - winPercentageA;

            // Secondary sort: Points For
            if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;

            // Tertiary sort: Adjusted DPR
            return b.adjustedDPR - a.adjustedDPR;
        });

        teamsWithCalculatedMetrics.forEach((team, index) => {
            team.rank = index + 1;
            if (index === 0) team.isChampion = true;
            if (index === 1) team.isRunnerUp = true;
            if (index === 2) team.isThirdPlace = true;
        });

        // Determine Points Champion, Runner-Up, Third Place for each season
        const sortedTeamsByPoints = Object.values(seasonalMetrics[year])
            .filter(team => typeof team.pointsFor === 'number' && !isNaN(team.pointsFor))
            .sort((a, b) => b.pointsFor - a.pointsFor);

        if (sortedTeamsByPoints.length > 0) {
            sortedTeamsByPoints[0].isPointsChampion = true; // 1st Place Total Points
        }
        if (sortedTeamsByPoints.length > 1) {
            const secondPlacePoints = sortedTeamsByPoints[1].pointsFor;
            sortedTeamsByPoints.forEach((team, index) => {
                if (index === 1 && team.pointsFor === secondPlacePoints) {
                    team.isPointsRunnerUp = true; // 2nd Place Total Points
                }
            });
        }
        if (sortedTeamsByPoints.length > 2) {
            const thirdPlacePoints = sortedTeamsByPoints[2].pointsFor;
            sortedTeamsByPoints.forEach((team, index) => {
                if (index === 2 && team.pointsFor === thirdPlacePoints) {
                    team.isThirdPlacePoints = true; // 3rd Place Total Points
                }
            });
        }

        // Calculate Top Score Weeks Count for each team in each season
        const weeklyGameScores = Object.values(weeklyGameScoresByYear[year]).flat();
        const sortedWeeklyGameScores = [...weeklyGameScores].sort((a, b) => b - a);

        const topWeeklyScore = sortedWeeklyGameScores.length > 0 ? sortedWeeklyGameScores[0] : 0;
        const topWeeklyScoreThreshold = topWeeklyScore > 0 ? topWeeklyScore * 0.95 : 0; // Within 5% of the top score

        // Initialize topScoreWeeksCount for each team in the current season
        Object.keys(seasonalMetrics[year]).forEach(team => {
            seasonalMetrics[year][team].topScoreWeeksCount = 0;
        });

        // Iterate through weeklyGameScoresByYear to count top scores
        Object.entries(weeklyGameScoresByYear[year]).forEach(([team, scores]) => {
            scores.forEach(score => {
                // Check if this score is a top weekly score (within 5% of the overall top weekly score for that year)
                if (topWeeklyScoreThreshold > 0 && score >= topWeeklyScoreThreshold) {
                    seasonalMetrics[year][team].topScoreWeeksCount = (seasonalMetrics[year][team].topScoreWeeksCount || 0) + 1;
                }
            });
        });
    });

    // Third pass for career DPR and other overall stats
    const careerDPRData = [];
    const allCareerRawDPRs = [];

    // Calculate raw DPR for each team across their entire career
    Object.keys(teamStats).forEach(team => {
        const stats = teamStats[team];
        const careerScores = stats.highScores; // highScores and lowScores contain all scores for the team
        const careerHighScore = careerScores.length > 0 ? Math.max(...careerScores) : 0;
        const careerLowScore = careerScores.length > 0 ? Math.min(...careerScores) : 0;
        const careerAverageScore = careerScores.length > 0 ? stats.totalPointsFor / stats.gamesPlayed : 0;
        const careerWinPercentage = (stats.gamesPlayed > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.gamesPlayed) : 0;

        if (stats.gamesPlayed > 0) {
            stats.rawDPR = calculateRawDPR(
                careerAverageScore,
                careerHighScore,
                careerLowScore,
                careerWinPercentage
            );
            allCareerRawDPRs.push(stats.rawDPR);
        } else {
            stats.rawDPR = 0;
        }
    });

    const avgRawDPROverall = allCareerRawDPRs.length > 0 ? allCareerRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allCareerRawDPRs.length : 0;
    const allAverageScoresOverall = Object.values(teamStats).map(stats => stats.gamesPlayed > 0 ? stats.totalPointsFor / stats.gamesPlayed : 0);
    const averageScoreOverall = allAverageScoresOverall.length > 0 ? allAverageScoresOverall.reduce((sum, score) => sum + score, 0) / allAverageScoresOverall.length : 0;


    Object.keys(teamStats).forEach(team => {
        const stats = teamStats[team];

        // Handle cases where a team might have no games played (e.g., from future years in data)
        if (stats.rawDPR === 0 && stats.totalGames === 0) {
            careerDPRData.push({
                team,
                dpr: 0,
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.totalPointsFor,
                pointsAgainst: stats.pointsAgainst, // Include pointsAgainst here
                averageScore: 0,
                winPercentage: 0, // Include winPercentage here
                totalGames: stats.totalGames, // Include totalGames
            });
            return;
        }

        const adjustedDPR = avgRawDPROverall > 0 ? stats.rawDPR / avgRawDPROverall : 0;
        const careerWinPercentage = (stats.gamesPlayed > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.gamesPlayed) : 0; // Recalculate or use existing


        careerDPRData.push({
            team,
            dpr: adjustedDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            pointsAgainst: stats.pointsAgainst, // Include pointsAgainst here
            averageScore: careerAverageScore,
            winPercentage: careerWinPercentage, // Include winPercentage here
            totalGames: stats.gamesPlayed, // Include totalGames
        });
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr);

    console.log("--- Finished calculateAllLeagueMetrics ---");
    return { seasonalMetrics, careerDPRData, weeklyGameScoresByYear };
};
