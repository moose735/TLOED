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
 * @param {Object} historicalMatchups - All historical matchup data, structured as {year: {week: [{matchup_id, roster_id, points, ...}]}}.
 * @param {string} teamName - The name of the team for which to calculate luck.
 * @param {number} year - The year for which to calculate luck.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing all weekly scores.
 * @param {Function} getDisplayTeamName - Function to get mapped team names.
 * @returns {number} The luck rating for the team in that season.
 */
const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek, getDisplayTeamName) => {
    let totalExpectedWins = 0; // This accumulates Expected Wins
    let actualWinsFromRecord = 0; // For regular season wins only

    const currentYearMatchups = historicalMatchups[year.toString()] || {};

    // First, process weekly scores to calculate Expected Wins
    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(weekNum => {
            const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][weekNum];

            // Filter for regular season weeks (assuming week <= 14 for regular season)
            const isRegSeasonWeek = parseInt(weekNum) <= 14;

            if (!isRegSeasonWeek || !allScoresInCurrentWeek || allScoresInCurrentWeek.length === 0) {
                return;
            }

            const currentTeamScoreEntry = allScoresInCurrentWeek.find(entry => entry.team === teamName);

            if (!currentTeamScoreEntry || typeof currentTeamScoreEntry.score !== 'number' || isNaN(currentTeamScoreEntry.score)) {
                return;
            }

            const currentTeamScoreForWeek = currentTeamScoreEntry.score;
            let outscoredCount = 0;
            let oneLessCount = 0;
            let opponentCount = 0;

            allScoresInCurrentWeek.forEach(otherTeamEntry => {
                if (otherTeamEntry.team !== teamName && otherTeamEntry.team !== '' && typeof otherTeamEntry.score === 'number' && !isNaN(otherTeamEntry.score)) {
                    opponentCount++;
                    if (currentTeamScoreForWeek > otherTeamEntry.score) {
                        outscoredCount++;
                    }
                    if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                        oneLessCount++;
                    }
                }
            });

            // Assuming a typical 12-team league, there are 11 other teams for all-play calculation
            // Adjust denominators if your league size varies or if only direct opponents count
            const denominatorX = opponentCount > 0 ? opponentCount : 11;
            const denominatorY = opponentCount > 0 ? (opponentCount * 2) : 22;


            const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
            const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;

            const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
            totalExpectedWins += combinedWeeklyLuckScore;
        });
    }

    // Now, calculate actual wins from record for the regular season
    Object.values(currentYearMatchups).flat().forEach(match => {
        const week = parseInt(match?.week || '0');
        const isRegSeason = week <= 14; // Infer regular season

        if (isRegSeason) {
            // Find the opponent for this matchup_id
            const matchupGroup = currentYearMatchups[week]?.filter(m => m.matchup_id === match.matchup_id);
            if (matchupGroup && matchupGroup.length === 2) {
                const team1Entry = matchupGroup.find(e => getDisplayTeamName(e.roster_id) === teamName);
                const team2Entry = matchupGroup.find(e => getDisplayTeamName(e.roster_id) !== teamName); // The opponent

                if (team1Entry && team2Entry) {
                    const team1Score = team1Entry.points;
                    const team2Score = team2Entry.points;

                    if (team1Score > team2Score) {
                        actualWinsFromRecord++;
                    }
                }
            }
        }
    });

    const finalLuckRating = actualWinsFromRecord - totalExpectedWins;
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
    const yearsToProcess = year ? [year.toString()] : Object.keys(weeklyGameScoresByYearAndWeek);

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
 * @param {Object} historicalMatchups - The raw historical matchup data, structured as {year: {week: [{matchup_id, roster_id, points, ...}]}}.
 * @param {Function} getDisplayTeamName - Function to get mapped team names.
 * @returns {{seasonalMetrics: Object, careerDPRData: Array, weeklyGameScoresByYearAndWeek: Object}}
 * seasonalMetrics: { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, averageScore, adjustedDPR, luckRating, allPlayWinPercentage, rank, topScoreWeeksCount, isChampion, isRunnerUp, isThirdPlace, isPointsChampion, isPointsRunnerUp, isThirdPlacePoints, isPlayoffTeam } } }
 * careerDPRData: Array of { team, dpr, wins, losses, ties, pointsFor, pointsAgainst, averageScore, topScoreWeeksCount, totalLuckRating, careerHighScore, careerLowScore }
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getDisplayTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    const seasonalTeamStatsRaw = {};
    const weeklyGameScoresByYearAndWeek = {};
    const careerTeamStatsRaw = {};
    // Removed finalSeedingGameResults as it's a custom Google Sheet concept not available in Sleeper matchups

    // Iterate through years
    Object.keys(historicalMatchups).forEach(yearStr => {
        const year = parseInt(yearStr);
        const yearMatchups = historicalMatchups[yearStr];

        // Iterate through weeks in each year
        Object.keys(yearMatchups).forEach(weekStr => {
            const week = parseInt(weekStr);
            const weekMatchups = yearMatchups[weekStr];

            // Group individual team entries by matchup_id to reconstruct head-to-head matches
            const matchupsByPair = new Map(); // Map<matchup_id, [team1_entry, team2_entry]>
            weekMatchups.forEach(entry => {
                if (!matchupsByPair.has(entry.matchup_id)) {
                    matchupsByPair.set(entry.matchup_id, []);
                }
                matchupsByPair.get(entry.matchup_id).push(entry);
            });

            matchupsByPair.forEach(matchupPair => {
                if (matchupPair.length !== 2) {
                    console.warn(`[calculateAllLeagueMetrics] Skipping incomplete matchup pair in year ${year}, week ${week}, matchup_id ${matchupPair[0]?.matchup_id}. Expected 2 entries, got ${matchupPair.length}.`);
                    return; // Skip invalid pairs (e.g., bye weeks or incomplete data)
                }

                const team1Entry = matchupPair[0];
                const team2Entry = matchupPair[1];

                const displayTeam1 = getDisplayTeamName(team1Entry.roster_id);
                const displayTeam2 = getDisplayTeamName(team2Entry.roster_id);

                const team1Score = team1Entry.points || 0;
                const team2Score = team2Entry.points || 0;

                if (isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 === 'Unknown Team' && displayTeam2 === 'Unknown Team')) {
                    console.warn(`[calculateAllLeagueMetrics] Skipping matchup due to invalid scores or unresolved teams (year: ${year}, week: ${week}):`, {
                        team1RosterId: team1Entry.roster_id, resolvedTeam1: displayTeam1,
                        team2RosterId: team2Entry.roster_id, resolvedTeam2: displayTeam2,
                        team1Score, team2Score
                    });
                    return; // Skip if scores are invalid or teams cannot be identified
                }

                const isTie = team1Score === team2Score;
                const team1Won = team1Score > team2Score;

                const isRegSeason = week <= 14; // Assume weeks 1-14 are regular season
                const isPlayoffMatch = week > 14; // Assume weeks after 14 are playoffs (can be refined with league settings)

                // Initialize seasonal and career stats for team1 if not present
                if (displayTeam1 !== 'Unknown Team') {
                    if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
                    if (!seasonalTeamStatsRaw[year][displayTeam1]) {
                        seasonalTeamStatsRaw[year][displayTeam1] = {
                            totalPointsFor: 0, pointsAgainst: 0,
                            wins: 0, losses: 0, ties: 0, totalGames: 0,
                            highScore: -Infinity, lowScore: Infinity,
                            weeklyScores: [],
                            isPlayoffTeam: false,
                        };
                    }
                    seasonalTeamStatsRaw[year][displayTeam1].totalPointsFor += team1Score;
                    seasonalTeamStatsRaw[year][displayTeam1].pointsAgainst += team2Score;

                    if (!careerTeamStatsRaw[displayTeam1]) {
                        careerTeamStatsRaw[displayTeam1] = {
                            totalPointsFor: 0, pointsAgainst: 0,
                            wins: 0, losses: 0, ties: 0, totalGames: 0,
                            careerWeeklyScores: [],
                            careerHighScore: -Infinity, // Initialize career high score
                            careerLowScore: Infinity, // Initialize career low score
                        };
                    }
                    careerTeamStatsRaw[displayTeam1].totalPointsFor += team1Score;
                    careerTeamStatsRaw[displayTeam1].pointsAgainst += team2Score;
                    careerTeamStatsRaw[displayTeam1].careerWeeklyScores.push(team1Score);
                    careerTeamStatsRaw[displayTeam1].careerHighScore = Math.max(careerTeamStatsRaw[displayTeam1].careerHighScore, team1Score);
                    careerTeamStatsRaw[displayTeam1].careerLowScore = Math.min(careerTeamStatsRaw[displayTeam1].careerLowScore, team1Score);


                    // Populate weeklyGameScoresByYearAndWeek for Luck Rating/All-Play
                    if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
                    if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
                    weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });


                    // Only count for record if it's a regular season match
                    if (isRegSeason) {
                        seasonalTeamStatsRaw[year][displayTeam1].totalGames++;
                        careerTeamStatsRaw[displayTeam1].totalGames++; // Career games count all games
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
                    // Mark as playoff team if it's a playoff match
                    if (isPlayoffMatch) {
                        seasonalTeamStatsRaw[year][displayTeam1].isPlayoffTeam = true;
                    }
                }

                // Initialize seasonal and career stats for team2 if not present
                if (displayTeam2 !== 'Unknown Team') {
                    if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
                    if (!seasonalTeamStatsRaw[year][displayTeam2]) {
                        seasonalTeamStatsRaw[year][displayTeam2] = {
                            totalPointsFor: 0, pointsAgainst: 0,
                            wins: 0, losses: 0, ties: 0, totalGames: 0,
                            highScore: -Infinity, lowScore: Infinity,
                            weeklyScores: [],
                            isPlayoffTeam: false,
                        };
                    }
                    seasonalTeamStatsRaw[year][displayTeam2].totalPointsFor += team2Score;
                    seasonalTeamStatsRaw[year][displayTeam2].pointsAgainst += team1Score;

                    if (!careerTeamStatsRaw[displayTeam2]) {
                        careerTeamStatsRaw[displayTeam2] = {
                            totalPointsFor: 0, pointsAgainst: 0,
                            wins: 0, losses: 0, ties: 0, totalGames: 0,
                            careerWeeklyScores: [],
                            careerHighScore: -Infinity,
                            careerLowScore: Infinity,
                        };
                    }
                    careerTeamStatsRaw[displayTeam2].totalPointsFor += team2Score;
                    careerTeamStatsRaw[displayTeam2].pointsAgainst += team1Score;
                    careerTeamStatsRaw[displayTeam2].careerWeeklyScores.push(team2Score);
                    careerTeamStatsRaw[displayTeam2].careerHighScore = Math.max(careerTeamStatsRaw[displayTeam2].careerHighScore, team2Score);
                    careerTeamStatsRaw[displayTeam2].careerLowScore = Math.min(careerTeamStatsRaw[displayTeam2].careerLowScore, team2Score);


                    // Populate weeklyGameScoresByYearAndWeek for Luck Rating/All-Play
                    if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
                    if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
                    weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });


                    // Only count for record if it's a regular season match
                    if (isRegSeason) {
                        seasonalTeamStatsRaw[year][displayTeam2].totalGames++;
                        careerTeamStatsRaw[displayTeam2].totalGames++; // Career games count all games
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
                    // Mark as playoff team if it's a playoff match
                    if (isPlayoffMatch) {
                        seasonalTeamStatsRaw[year][displayTeam2].isPlayoffTeam = true;
                    }
                }
            });
        });
    });

    const seasonalMetrics = {};

    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const teamsInSeason = Object.keys(seasonalTeamStatsRaw[year]);

        // Explicitly get raw DPRs and filter for numbers before calculating average
        const allRawDPRsInSeason = teamsInSeason
            .map(team => seasonalMetrics[year][team]?.rawDPR) // Use optional chaining for safety
            .filter(dpr => typeof dpr === 'number' && !isNaN(dpr) && dpr !== 0); // Filter out non-numbers and zeros

        let avgRawDPRInSeason = 0; // Declare with let and initialize
        if (allRawDPRsInSeason.length > 0) {
            avgRawDPRInSeason = allRawDPRsInSeason.reduce((sum, dpr) => sum + dpr, 0) / allRawDPRsInSeason.length;
        }

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
            const luckRating = calculateLuckRating(historicalMatchups, team, parseInt(year), weeklyGameScoresByYearAndWeek, getDisplayTeamName);
            const allPlayWinPercentage = calculateAllPlayWinPercentage(team, parseInt(year), weeklyGameScoresByYearAndWeek);
            const topScoreWeeksCount = calculateTopScoreWeeksCount(team, weeklyGameScoresByYearAndWeek, parseInt(year));

            seasonalMetrics[year][team] = {
                teamName: team, // Crucial: Add teamName to the object itself
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
                topScoreWeeksCount: topScoreWeeksCount,
                adjustedDPR: 0, // Will be calculated after all raw DPRs are known for the season
                totalGames: stats.totalGames,
                highScore: stats.highScore, // Include these in seasonalMetrics
                lowScore: stats.lowScore, // Include these in seasonalMetrics
                isChampion: false, // Initialize for championship trophy
                isRunnerUp: false, // Initialize for runner-up trophy
                isThirdPlace: false, // Initialize for third place trophy
                isPointsChampion: false, // Initialize for points champion medal
                isPointsRunnerUp: false, // Initialize for points runner-up medal
                isThirdPlacePoints: false, // Initialize for third place points medal
                isPlayoffTeam: stats.isPlayoffTeam, // Pass the calculated playoff flag
                rank: 'N/A', // Initialize rank
                pointsRank: 'N/A', // Initialize points rank
            };

            // Set adjusted DPR here, inside the loop where it's populated
            if (avgRawDPRInSeason > 0) {
                seasonalMetrics[year][team].adjustedDPR = seasonalMetrics[year][team].rawDPR / avgRawDPRInSeason;
            } else {
                seasonalMetrics[year][team].adjustedDPR = 0;
            }
        });

        // --- RANK CALCULATION LOGIC (Overall Finish - Regular Season based) ---
        // Prepare all teams for ranking, including those with 0 games
        const allTeamsInSeasonForRanking = Object.keys(seasonalMetrics[year]).map(team => ({
            teamName: team, // Ensure teamName is available here
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

        // Assign preliminary ranks to all teams and set initial trophy flags
        allTeamsInSeasonForRanking.forEach((rankedTeam, index) => {
            seasonalMetrics[year][rankedTeam.teamName].rank = index + 1;
            // Set trophy flags based on rank (these are regular season finish flags now)
            if (index === 0) seasonalMetrics[year][rankedTeam.teamName].isChampion = true; // This will signify regular season champion
            else if (index === 1) seasonalMetrics[year][rankedTeam.teamName].isRunnerUp = true; // Regular season runner-up
            else if (index === 2) seasonalMetrics[year][rankedTeam.teamName].isThirdPlace = true; // Regular season third place
        });
        // Removed finalSeedingGameResults overlay logic as it's not applicable to Sleeper API data
        // --- END RANK CALCULATION LOGIC ---

        // --- POINTS RANKING LOGIC ---
        const teamsSortedByPoints = Object.values(seasonalMetrics[year])
            .filter(teamStats => typeof teamStats.pointsFor === 'number' && !isNaN(teamStats.pointsFor))
            .sort((a, b) => b.pointsFor - a.pointsFor);

        // Assign points ranks and set medal flags
        if (teamsSortedByPoints.length > 0) {
            let currentRank = 1;
            for (let i = 0; i < teamsSortedByPoints.length; i++) {
                const teamStats = teamsSortedByPoints[i];
                if (i > 0 && teamStats.pointsFor < teamsSortedByPoints[i - 1].pointsFor) {
                    currentRank = i + 1;
                }
                seasonalMetrics[year][teamStats.teamName].pointsRank = currentRank;

                // Set points trophy flags
                if (currentRank === 1) {
                    seasonalMetrics[year][teamStats.teamName].isPointsChampion = true;
                } else if (currentRank === 2) {
                    seasonalMetrics[year][teamStats.teamName].isPointsRunnerUp = true;
                } else if (currentRank === 3) {
                    seasonalMetrics[year][teamStats.teamName].isThirdPlacePoints = true;
                }
            }
        }
        // --- END POINTS RANKING LOGIC ---
    });

    const careerDPRData = [];
    const allCareerRawDPRs = [];

    // Calculate career average scores and DPRs for all teams
    Object.keys(careerTeamStatsRaw).forEach(team => {
        const stats = careerTeamStatsRaw[team];
        const careerScores = stats.careerWeeklyScores; // Using careerWeeklyScores for high/low
        const careerHighScore = stats.careerHighScore !== -Infinity ? stats.careerHighScore : 0;
        const careerLowScore = stats.careerLowScore !== Infinity ? stats.careerLowScore : 0;
        const careerAverageScore = stats.totalGames > 0 ? stats.totalPointsFor / stats.totalGames : 0;
        const careerWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

        if (stats.totalGames > 0) { // Check totalGames for valid stats
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

        // Pass null for year to calculateTopScoreWeeksCount to get career total
        const careerTopScoreWeeksCount = calculateTopScoreWeeksCount(team, weeklyGameScoresByYearAndWeek, null);

        careerDPRData.push({
            team,
            dpr: stats.rawDPR, // Will be adjusted later
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            pointsAgainst: stats.pointsAgainst,
            averageScore: careerAverageScore,
            winPercentage: careerWinPercentage,
            totalGames: stats.totalGames,
            topScoreWeeksCount: careerTopScoreWeeksCount,
            careerHighScore: careerHighScore, // Include career high score in career DPR data
            careerLowScore: careerLowScore, // Include career low score in career DPR data
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

    console.log("Calculated career DPR data:", careerDPRData); // Added log for debugging
    console.log("--- Finished calculateAllLeagueMetrics ---");
    return { seasonalMetrics, careerDPRData, weeklyGameScoresByYearAndWeek };
};
