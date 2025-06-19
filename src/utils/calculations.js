// src/utils/calculations.js

/**
 * Helper function to calculate raw DPR (Power Rating) for a team.
 * @param {number} averageScore - The team's average score for the period (season or career).
 * @param {number} teamHighScore - The team's highest single-game score for the period (season or career).
 * @param {number} teamLowScore - The team's lowest single-game score for the period (season or career).
 * @param {number} teamWinPercentage - Win percentage of the team for the period (season or career).
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
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing all weekly scores.
 * @param {Function} getMappedTeamName - Function to get mapped team names.
 * @returns {number} The luck rating for the team in that season.
 */
const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek, getMappedTeamName) => {
    // console.log(`\n--- Luck Rating Debugger for ${teamName} in ${year} ---`);
    let totalWeeklyLuckScoreSum = 0; // This accumulates Expected Wins

    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
            const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];

            const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
                .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score) && entry.team !== '')
                .map(entry => entry.team)
            );
            if (!uniqueTeamsWithScores.has(teamName)) return;

            // This filter correctly limits Expected Wins calculation to Regular Season, non-bye weeks.
            const relevantMatchupsForWeek = historicalMatchups.filter(m =>
                parseInt(m?.year || '0') === parseInt(year) &&
                parseInt(m?.week || '0') === parseInt(week) &&
                (m?.regSeason === true || m?.regSeason === 'true') &&
                !(m?.pointsOnlyBye === true || m?.pointsOnlyBye === 'true')
            );

            if (relevantMatchupsForWeek.length === 0) return;

            const currentTeamMatchEntry = relevantMatchupsForWeek.find(match => {
                const matchTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
                const matchTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
                return (matchTeam1 === teamName && matchTeam1 !== '') || (matchTeam2 === teamName && matchTeam2 !== '');
            });

            if (!currentTeamMatchEntry) return;

            let currentTeamScoreForWeek;
            const mappedTeam1 = getMappedTeamName(String(currentTeamMatchEntry?.team1 || '').trim());
            const mappedTeam2 = getMappedTeamName(String(currentTeamMatchEntry?.team2 || '').trim());

            if (mappedTeam1 === teamName) {
                currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team1Score || '0');
            } else if (mappedTeam2 === teamName) {
                currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team2Score || '0');
            } else {
                return;
            }

            if (isNaN(currentTeamScoreForWeek)) return;

            let outscoredCount = 0;
            let oneLessCount = 0;

            allScoresInCurrentWeek.forEach(otherTeamEntry => {
                if (otherTeamEntry.team !== teamName && otherTeamEntry.team !== '' && typeof otherTeamEntry.score === 'number' && !isNaN(otherTeamEntry.score)) {
                    if (currentTeamScoreForWeek > otherTeamEntry.score) {
                        outscoredCount++;
                    }
                    if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                        oneLessCount++;
                    }
                }
            });

            const denominatorX = 11; // Assumes 12-team league for 11 opponents
            const denominatorY = 22; // Assumes 12-team league for 11 opponents * 2

            const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
            const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;

            const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
            totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;

            // console.log(`  Week ${week}: Team Score: ${currentTeamScoreForWeek.toFixed(2)}, Outscored: ${outscoredCount}, One Less: ${oneLessCount}, Weekly Expected Wins: ${combinedWeeklyLuckScore.toFixed(3)}`);
        });
    }

    // This now also limits to Regular Season, non-bye weeks for consistency with Expected Wins.
    let actualWinsFromRecord = 0;
    historicalMatchups.forEach(match => {
        const yearMatch = parseInt(match?.year || '0') === year;
        const isPointsOnlyBye = (match?.pointsOnlyBye === true || match?.pointsOnlyBye === 'true');
        const isRegSeason = (match?.regSeason === true || match?.regSeason === 'true');

        if (yearMatch && isRegSeason && !isPointsOnlyBye) {
            const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
            const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());

            if (displayTeam1 === teamName && displayTeam1 !== '') {
                const team1Score = parseFloat(match?.team1Score || '0');
                const team2Score = parseFloat(match?.team2Score || '0');
                if (team1Score > team2Score) actualWinsFromRecord++;
            } else if (displayTeam2 === teamName && displayTeam2 !== '') {
                const team1Score = parseFloat(match?.team1Score || '0');
                const team2Score = parseFloat(match?.team2Score || '0');
                if (team2Score > team1Score) actualWinsFromRecord++;
            }
        }
    });

    const finalLuckRating = actualWinsFromRecord - totalWeeklyLuckScoreSum;
    // console.log(`  Summary: Total Actual Wins (Regular Season): ${actualWinsFromRecord}`);
    // console.log(`  Summary: Total Expected Wins (Sum of Weekly): ${totalWeeklyLuckScoreSum.toFixed(3)}`);
    // console.log(`  Final Luck Rating (${actualWinsFromRecord} - ${totalWeeklyLuckScoreSum.toFixed(3)}): ${finalLuckRating.toFixed(4)}`);
    // console.log(`--- End Luck Rating Debugger for ${teamName} in ${year} ---`);
    return finalLuckRating;
};


/**
 * Helper function to calculate All-Play Win Percentage for a team in a season.
 * @param {string} teamName - The name of the team.
 * @param {number} year - The year.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing all weekly scores.
 * @returns {number} The all-play win percentage.
*/
const calculateAllPlayWinPercentage = (teamName, year, weeklyGameScoresByYearAndWeek) => {
    let allPlayWinsSeason = 0;
    let allPlayLossesSeason = 0;
    let allPlayTiesSeason = 0;

    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
            const allScoresInWeek = weeklyGameScoresByYearAndWeek[year][week];
            const currentTeamScoreInWeek = allScoresInWeek.find(entry => entry.team === teamName)?.score;

            if (currentTeamScoreInWeek !== undefined && !isNaN(currentTeamScoreInWeek)) {
                allScoresInWeek.forEach(otherTeamEntry => {
                    if (otherTeamEntry.team !== teamName && otherTeamEntry.team !== '' && otherTeamEntry.score !== undefined && !isNaN(otherTeamEntry.score)) {
                        if (currentTeamScoreInWeek > otherTeamEntry.score) {
                            allPlayWinsSeason++;
                        } else if (currentTeamScoreInWeek === otherTeamEntry.score) {
                            allPlayTiesSeason++;
                        } else {
                            allPlayLossesSeason++;
                        }
                    }
                });
            }
        });
    }
    const totalAllPlayGamesSeason = allPlayWinsSeason + allPlayLossesSeason + allPlayTiesSeason;
    return totalAllPlayGamesSeason > 0 ? ((allPlayWinsSeason + (0.5 * allPlayTiesSeason)) / totalAllPlayGamesSeason) : 0;
};

/**
 * Calculates the count of weeks where a team had the absolute highest score in a given year or across their career.
 * Handles ties: if multiple teams tie for the highest score, all of them count for that week.
 *
 * @param {string} teamName - The name of the team.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing all weekly scores, structured as {year: {week: [{team: score}]}}.
 * @param {number|null} year - The specific year to calculate for, or null for career total.
 * @returns {number} The count of weeks where the team had the top score.
 */
const calculateTopScoreWeeksCount = (teamName, weeklyGameScoresByYearAndWeek, year = null) => {
    let topScoreWeeks = 0;
    const yearsToProcess = year ? [year] : Object.keys(weeklyGameScoresByYearAndWeek);

    yearsToProcess.forEach(yr => {
        if (weeklyGameScoresByYearAndWeek[yr]) {
            Object.keys(weeklyGameScoresByYearAndWeek[yr]).forEach(week => {
                const allScoresInWeek = weeklyGameScoresByYearAndWeek[yr][week];

                // Find the maximum score in the current week
                const maxScore = Math.max(...allScoresInWeek.map(entry => entry.score).filter(score => typeof score === 'number' && !isNaN(score)));

                // Check if the current team's score is equal to the maximum score
                const teamScoreEntry = allScoresInWeek.find(entry => entry.team === teamName);

                if (teamScoreEntry && teamScoreEntry.score === maxScore && typeof teamScoreEntry.score === 'number' && !isNaN(teamScoreEntry.score)) {
                    topScoreWeeks++;
                }
            });
        }
    });
    return topScoreWeeks;
};


/**
 * Calculates all league-wide and team-specific metrics (DPR, Luck Rating, All-Play)
 * for all seasons based on historical matchup data.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Function to get mapped team names.
 * @returns {{seasonalMetrics: Object, careerDPRData: Array, weeklyGameScoresByYearAndWeek: Object}}
 * seasonalMetrics: { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, averageScore, adjustedDPR, luckRating, allPlayWinPercentage, rank, topScoreWeeksCount } } } // Added rank and topScoreWeeksCount to doc
 * careerDPRData: Array of { team, dpr, wins, losses, ties, pointsFor, pointsAgainst, averageScore, topScoreWeeksCount } // Added topScoreWeeksCount to doc
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getMappedTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    const seasonalTeamStatsRaw = {};
    const weeklyGameScoresByYearAndWeek = {};
    const careerTeamStatsRaw = {};
    const finalSeedingGameResults = {}; // New object to store final game outcomes

    historicalMatchups.forEach((match, index) => {
        const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
        const year = parseInt(match?.year || '0');
        const week = parseInt(match?.week || '0');
        const team1Score = parseFloat(match?.team1Score || '0');
        const team2Score = parseFloat(match?.team2Score || '0');

        if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 === '' && displayTeam2 === '')) {
            return;
        }

        // Collect final seeding game results
        if ((match.finalSeedingGame === 1 || match.finalSeedingGame === '1' ||
             match.finalSeedingGame === 3 || match.finalSeedingGame === '3' ||
             match.finalSeedingGame === 5 || match.finalSeedingGame === '5' ||
             match.finalSeedingGame === 7 || match.finalSeedingGame === '7' ||
             match.finalSeedingGame === 9 || match.finalSeedingGame === '9' ||
             match.finalSeedingGame === 11 || match.finalSeedingGame === '11') &&
            !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {

            const gamePlace = parseInt(match.finalSeedingGame);
            const winner = team1Score > team2Score ? displayTeam1 : displayTeam2;
            const loser = team1Score > team2Score ? displayTeam2 : displayTeam1;
            const isTie = team1Score === team2Score;

            if (!finalSeedingGameResults[year]) {
                finalSeedingGameResults[year] = {};
            }

            if (isTie) {
                // For ties, both teams get the 'winner's' place
                finalSeedingGameResults[year][displayTeam1] = gamePlace;
                finalSeedingGameResults[year][displayTeam2] = gamePlace;
            } else {
                finalSeedingGameResults[year][winner] = gamePlace;
                finalSeedingGameResults[year][loser] = gamePlace + 1; // Loser gets next place
            }
        }


        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        // Initialize seasonal and career stats for team1 if not present
        if (displayTeam1 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam1]) {
                seasonalTeamStatsRaw[year][displayTeam1] = {
                    totalPointsFor: 0, pointsAgainst: 0, // Added pointsAgainst
                    wins: 0, losses: 0, ties: 0, totalGames: 0,
                    highScore: -Infinity, lowScore: Infinity,
                    weeklyScores: [] // For DPR
                };
            }
            seasonalTeamStatsRaw[year][displayTeam1].totalPointsFor += team1Score;
            seasonalTeamStatsRaw[year][displayTeam1].pointsAgainst += team2Score;

            if (!careerTeamStatsRaw[displayTeam1]) {
                careerTeamStatsRaw[displayTeam1] = {
                    totalPointsFor: 0, pointsAgainst: 0, // Added pointsAgainst
                    wins: 0, losses: 0, ties: 0, totalGames: 0,
                    careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam1].totalPointsFor += team1Score;
            careerTeamStatsRaw[displayTeam1].pointsAgainst += team2Score;
            careerTeamStatsRaw[displayTeam1].careerWeeklyScores.push(team1Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });


            if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) { // Only count for record if not a points-only bye
                seasonalTeamStatsRaw[year][displayTeam1].totalGames++;
                careerTeamStatsRaw[displayTeam1].totalGames++;
                if (team1Won) {
                    seasonalTeamStatsRaw[year][displayTeam1].wins++;
                    careerTeamStatsRaw[displayTeam1].wins++;
                } else if (isTie) {
                    seasonalTeamStatsRaw[year][displayTeam1].ties++;
                    careerTeamStatsRaw[displayTeam1].ties++;
                } else {
                    seasonalTeamStatsRaw[year][displayTeam1].losses++;
                    careerTeamStatsRaw[displayTeam1].losses++;
                }
            }
            seasonalTeamStatsRaw[year][displayTeam1].highScore = Math.max(seasonalTeamStatsRaw[year][displayTeam1].highScore, team1Score);
            seasonalTeamStatsRaw[year][displayTeam1].lowScore = Math.min(seasonalTeamStatsRaw[year][displayTeam1].lowScore, team1Score);
            seasonalTeamStatsRaw[year][displayTeam1].weeklyScores.push(team1Score);
        }

        // Initialize seasonal and career stats for team2 if not present
        if (displayTeam2 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam2]) {
                seasonalTeamStatsRaw[year][displayTeam2] = {
                    totalPointsFor: 0, pointsAgainst: 0,
                    wins: 0, losses: 0, ties: 0, totalGames: 0,
                    highScore: -Infinity, lowScore: Infinity,
                    weeklyScores: []
                };
            }
            seasonalTeamStatsRaw[year][displayTeam2].totalPointsFor += team2Score;
            seasonalTeamStatsRaw[year][displayTeam2].pointsAgainst += team1Score; // Team2's opponent's score

            if (!careerTeamStatsRaw[displayTeam2]) {
                careerTeamStatsRaw[displayTeam2] = {
                    totalPointsFor: 0, pointsAgainst: 0,
                    wins: 0, losses: 0, ties: 0, totalGames: 0,
                    careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam2].totalPointsFor += team2Score;
            careerTeamStatsRaw[displayTeam2].pointsAgainst += team1Score;
            careerTeamStatsRaw[displayTeam2].careerWeeklyScores.push(team2Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });


            if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) { // Only count for record if not a points-only bye
                seasonalTeamStatsRaw[year][displayTeam2].totalGames++;
                careerTeamStatsRaw[displayTeam2].totalGames++;
                if (!team1Won) { // If team1 didn't win, then team2 either won or tied
                    if (isTie) {
                        seasonalTeamStatsRaw[year][displayTeam2].ties++;
                        careerTeamStatsRaw[displayTeam2].ties++;
                    } else { // team2 won
                        seasonalTeamStatsRaw[year][displayTeam2].wins++;
                        careerTeamStatsRaw[displayTeam2].wins++;
                    }
                } else { // team1 won, so team2 lost
                    seasonalTeamStatsRaw[year][displayTeam2].losses++;
                    careerTeamStatsRaw[displayTeam2].losses++;
                }
            }
            seasonalTeamStatsRaw[year][displayTeam2].highScore = Math.max(seasonalTeamStatsRaw[year][displayTeam2].highScore, team2Score);
            seasonalTeamStatsRaw[year][displayTeam2].lowScore = Math.min(seasonalTeamStatsRaw[year][displayTeam2].lowScore, team2Score);
            seasonalTeamStatsRaw[year][displayTeam2].weeklyScores.push(team2Score);
        }
    });

    const seasonalMetrics = {};

    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const teamsInSeason = Object.keys(seasonalTeamStatsRaw[year]);

        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];
            const averageScore = stats.totalGames > 0 ? stats.totalPointsFor / stats.totalGames : 0;
            const winPercentage = stats.totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            const rawDPR = calculateRawDPR(
                averageScore,
                stats.highScore !== -Infinity ? stats.highScore : 0, // Handle initial -Infinity
                stats.lowScore !== Infinity ? stats.lowScore : 0,    // Handle initial Infinity
                winPercentage
            );

            // Calculate Luck Rating and All-Play Win Percentage
            const luckRating = calculateLuckRating(historicalMatchups, team, parseInt(year), weeklyGameScoresByYearAndWeek, getMappedTeamName);
            const allPlayWinPercentage = calculateAllPlayWinPercentage(team, parseInt(year), weeklyGameScoresByYearAndWeek);
            const topScoreWeeksCount = calculateTopScoreWeeksCount(team, weeklyGameScoresByYearAndWeek, parseInt(year));

            seasonalMetrics[year][team] = {
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.totalPointsFor,
                pointsAgainst: stats.pointsAgainst,
                averageScore: averageScore,
                winPercentage: winPercentage,
                rawDPR: rawDPR, // Store raw DPR for potential league-wide average calculation
                luckRating: luckRating,
                allPlayWinPercentage: allPlayWinPercentage,
                topScoreWeeksCount: topScoreWeeksCount, // Add top score weeks count
                adjustedDPR: 0, // Will be calculated after all raw DPRs are known for the season
                totalGames: stats.totalGames,
                highScore: stats.highScore, // Include these in seasonalMetrics
                lowScore: stats.lowScore, // Include these in seasonalMetrics
            };
        });

        // Calculate adjusted DPR for each team in the current season
        const allRawDPRsInSeason = teamsInSeason.map(team => seasonalMetrics[year][team].rawDPR).filter(dpr => dpr !== 0);
        const avgRawDPRInSeason = allRawDPRsInSeason.length > 0 ? allRawDPRsInSeason.reduce((sum, dpr) => sum + dpr, 0) / allRawDPRsInSeason.length : 0;

        teamsInSeason.forEach(team => {
            if (avgRawDPRInSeason > 0) {
                seasonalMetrics[year][team].adjustedDPR = seasonalMetrics[year][team].rawDPR / avgRawDPRInSeason;
            } else {
                seasonalMetrics[year][team].adjustedDPR = 0;
            }
        });

        // --- RANK CALCULATION LOGIC ---
        // Prepare all teams for ranking, including those with 0 games
        const allTeamsInSeasonForRanking = Object.keys(seasonalMetrics[year]).map(team => ({
            team: team,
            winPercentage: seasonalMetrics[year][team].winPercentage,
            pointsFor: seasonalMetrics[year][team].pointsFor,
            totalGames: seasonalMetrics[year][team].totalGames // Keep this to differentiate
        }));

        // Sort teams for preliminary ranking. Teams with 0 games go to the very end.
        allTeamsInSeasonForRanking.sort((a, b) => {
            // Teams with 0 games are always ranked lower
            if (a.totalGames === 0 && b.totalGames > 0) return 1; // a goes after b
            if (a.totalGames > 0 && b.totalGames === 0) return -1; // a goes before b
            if (a.totalGames === 0 && b.totalGames === 0) return 0; // Both 0 games, maintain current relative order

            // For teams with games, sort by win percentage (descending), then by points for (descending)
            if (b.winPercentage !== a.winPercentage) {
                return b.winPercentage - a.winPercentage;
            }
            return b.pointsFor - a.pointsFor;
        });

        // Assign preliminary ranks to all teams
        allTeamsInSeasonForRanking.forEach((rankedTeam, index) => {
            seasonalMetrics[year][rankedTeam.team].rank = index + 1;
        });

        // Overlay final seeding game results to determine definitive rank
        if (finalSeedingGameResults[year]) {
            const finalRanksThisYear = finalSeedingGameResults[year];
            Object.keys(seasonalMetrics[year]).forEach(team => {
                // If a final rank is explicitly defined for this team, overwrite the preliminary rank
                if (finalRanksThisYear[team] !== undefined) {
                    seasonalMetrics[year][team].rank = finalRanksThisYear[team];
                }
            });
        }
        // --- END RANK CALCULATION LOGIC ---
    });

    const careerDPRData = [];
    const allCareerRawDPRs = [];

    // Calculate career average scores and DPRs for all teams
    Object.keys(careerTeamStatsRaw).forEach(team => {
        const stats = careerTeamStatsRaw[team];
        const averageScoreOverall = stats.totalGames > 0 ? stats.totalPointsFor / stats.totalGames : 0;
        const careerWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

        // Find career high and low scores
        const careerHighScore = stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
        const careerLowScore = stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

        const rawDPRCareer = calculateRawDPR(
            averageScoreOverall,
            careerHighScore,
            careerLowScore,
            careerWinPercentage
        );
        allCareerRawDPRs.push(rawDPRCareer);

        const careerTopScoreWeeksCount = calculateTopScoreWeeksCount(team, weeklyGameScoresByYearAndWeek, null);


        // This block handles cases where teams might have 0 games/points, ensuring they still appear
        if (rawDPRCareer === 0 && stats.totalGames === 0) {
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
                topScoreWeeksCount: careerTopScoreWeeksCount, // Add top score weeks count to career data
            });
            return;
        }

        careerDPRData.push({
            team,
            dpr: rawDPRCareer, // Will be adjusted later
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            pointsAgainst: stats.pointsAgainst, // Include pointsAgainst here
            averageScore: averageScoreOverall,
            winPercentage: careerWinPercentage, // Include winPercentage here
            totalGames: stats.totalGames, // Include totalGames
            topScoreWeeksCount: careerTopScoreWeeksCount, // Add top score weeks count to career data
        });
    });

    // Calculate overall average raw DPR for career adjustment
    const avgRawDPROverall = allCareerRawDPRs.length > 0 ? allCareerRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allCareerRawDPRs.length : 0;

    // Adjust career DPRs based on overall average
    careerDPRData.forEach(entry => {
        if (avgRawDPROverall > 0) {
            entry.dpr = entry.dpr / avgRawDPROverall;
        } else {
            entry.dpr = 0;
        }
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr);

    console.log("--- Finished calculateAllLeagueMetrics ---");
    return { seasonalMetrics, careerDPRData, weeklyGameScoresByYearAndWeek };
};
