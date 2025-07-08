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
 * @param {Object} historicalData - The full historical data object from SleeperDataContext.
 * @param {string} teamRosterId - The roster ID of the team for which to calculate luck.
 * @param {string} year - The year for which to calculate luck.
 * @returns {number} The luck rating for the team in that season.
 */
const calculateLuckRating = (historicalData, teamRosterId, year) => {
    let totalWeeklyLuckScoreSum = 0; // This accumulates Expected Wins

    const weeklyMatchupsForYear = historicalData.matchupsBySeason?.[year];
    const leagueMetadataForYear = historicalData.leaguesMetadataBySeason?.[year];
    // Default playoffStartWeek to a high number if not found, to treat all weeks as regular season
    const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;

    if (!weeklyMatchupsForYear) return 0;

    Object.keys(weeklyMatchupsForYear).forEach(weekStr => {
        const week = parseInt(weekStr);
        if (isNaN(week) || week >= playoffStartWeek) return; // Only consider regular season weeks

        const matchupsInWeek = weeklyMatchupsForYear[weekStr];
        if (!matchupsInWeek || matchupsInWeek.length === 0) return;

        // Find the current team's score in this week
        let currentTeamScoreForWeek = null;

        for (const matchup of matchupsInWeek) {
            if (String(matchup.team1_roster_id) === String(teamRosterId)) {
                currentTeamScoreForWeek = matchup.team1_score;
                break;
            } else if (String(matchup.team2_roster_id) === String(teamRosterId)) {
                currentTeamScoreForWeek = matchup.team2_score;
                break;
            }
        }

        if (currentTeamScoreForWeek === null || isNaN(currentTeamScoreForWeek)) return;

        let outscoredCount = 0;
        let oneLessCount = 0;
        let totalOpponents = 0;

        // Collect all scores for the week to calculate all-play wins
        const allScoresInCurrentWeek = [];
        matchupsInWeek.forEach(matchup => {
            if (matchup.team1_roster_id && typeof matchup.team1_score === 'number' && !isNaN(matchup.team1_score)) {
                allScoresInCurrentWeek.push({ roster_id: matchup.team1_roster_id, score: matchup.team1_score });
            }
            if (matchup.team2_roster_id && typeof matchup.team2_score === 'number' && !isNaN(matchup.team2_score)) {
                allScoresInCurrentWeek.push({ roster_id: matchup.team2_roster_id, score: matchup.team2_score });
            }
        });

        allScoresInCurrentWeek.forEach(otherTeamEntry => {
            if (String(otherTeamEntry.roster_id) !== String(teamRosterId) && typeof otherTeamEntry.score === 'number' && !isNaN(otherTeamEntry.score)) {
                totalOpponents++; // Count all other teams in the league for the denominator
                if (currentTeamScoreForWeek > otherTeamEntry.score) {
                    outscoredCount++;
                } else if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                    oneLessCount++;
                }
            }
        });

        // Ensure denominators are not zero to prevent division by zero errors
        const denominatorX = totalOpponents > 0 ? totalOpponents : 1;
        const denominatorY = totalOpponents > 0 ? (totalOpponents * 2) : 1;

        const weeklyProjectedWinComponentX = (outscoredCount / denominatorX);
        const weeklyLuckScorePartY = (oneLessCount / denominatorY);

        const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
        totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
    });

    let actualWinsFromRecord = 0;
    // Iterate through all matchups for the year to get actual wins
    Object.keys(weeklyMatchupsForYear || {}).forEach(weekStr => {
        const week = parseInt(weekStr);
        if (isNaN(week) || week >= playoffStartWeek) return; // Only regular season wins

        const matchupsInWeek = weeklyMatchupsForYear[weekStr];
        if (!matchupsInWeek) return;

        for (const matchup of matchupsInWeek) {
            if (String(matchup.team1_roster_id) === String(teamRosterId) && matchup.team1_score !== null && matchup.team2_score !== null) {
                if (matchup.team1_score > matchup.team2_score) {
                    actualWinsFromRecord++;
                }
            } else if (String(matchup.team2_roster_id) === String(teamRosterId) && matchup.team1_score !== null && matchup.team2_score !== null) {
                if (matchup.team2_score > matchup.team1_score) {
                    actualWinsFromRecord++;
                }
            }
        }
    });

    const finalLuckRating = actualWinsFromRecord - totalWeeklyLuckScoreSum;
    return finalLuckRating;
};


/**
 * Helper function to calculate All-Play Win Percentage for a team in a season.
 * @param {Object} historicalData - The full historical data object from SleeperDataContext.
 * @param {string} teamRosterId - The roster ID of the team.
 * @param {string} year - The year.
 * @returns {number} The all-play win percentage.
 */
const calculateAllPlayWinPercentage = (historicalData, teamRosterId, year) => {
    let allPlayWinsSeason = 0;
    let allPlayLossesSeason = 0;
    let allPlayTiesSeason = 0;

    const weeklyMatchupsForYear = historicalData.matchupsBySeason?.[year];
    const leagueMetadataForYear = historicalData.leaguesMetadataBySeason?.[year];
    const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;

    if (!weeklyMatchupsForYear) return 0;

    Object.keys(weeklyMatchupsForYear).forEach(weekStr => {
        const week = parseInt(weekStr);
        if (isNaN(week) || week >= playoffStartWeek) return; // Only consider regular season weeks

        const matchupsInWeek = weeklyMatchupsForYear[weekStr];
        if (!matchupsInWeek || matchupsInWeek.length === 0) return;

        let currentTeamScoreInWeek = null;
        for (const matchup of matchupsInWeek) {
            if (String(matchup.team1_roster_id) === String(teamRosterId)) {
                currentTeamScoreInWeek = matchup.team1_score;
                break;
            } else if (String(matchup.team2_roster_id) === String(teamRosterId)) {
                currentTeamScoreInWeek = matchup.team2_score;
                break;
            }
        }

        if (currentTeamScoreInWeek !== null && !isNaN(currentTeamScoreInWeek)) {
            // Collect all scores for the week to compare against
            const allScoresInWeek = [];
            matchupsInWeek.forEach(matchup => {
                if (matchup.team1_roster_id && typeof matchup.team1_score === 'number' && !isNaN(matchup.team1_score)) {
                    allScoresInWeek.push({ roster_id: matchup.team1_roster_id, score: matchup.team1_score });
                }
                if (matchup.team2_roster_id && typeof matchup.team2_score === 'number' && !isNaN(matchup.team2_score)) {
                    allScoresInWeek.push({ roster_id: matchup.team2_roster_id, score: matchup.team2_score });
                }
            });

            allScoresInWeek.forEach(otherTeamEntry => {
                if (String(otherTeamEntry.roster_id) !== String(teamRosterId) && otherTeamEntry.score !== null && !isNaN(otherTeamEntry.score)) {
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
    const totalAllPlayGamesSeason = allPlayWinsSeason + allPlayLossesSeason + allPlayTiesSeason;
    return totalAllPlayGamesSeason > 0 ? ((allPlayWinsSeason + (0.5 * allPlayTiesSeason)) / totalAllPlayGamesSeason) : 0;
};

/**
 * Calculates the count of weeks where a team had the absolute highest score in a given year or across their career.
 * Handles ties: if multiple teams tie for the highest score, all of them count for that week.
 *
 * @param {Object} historicalData - The full historical data object from SleeperDataContext.
 * @param {string} teamRosterId - The roster ID of the team.
 * @param {string|null} year - The specific year to calculate for (as string), or null for career total.
 * @returns {number} The count of weeks where the team had the top score.
 */
const calculateTopScoreWeeksCount = (historicalData, teamRosterId, year = null) => {
    let topScoreWeeks = 0;
    const yearsToProcess = year ? [year] : Object.keys(historicalData.matchupsBySeason || {});

    yearsToProcess.forEach(yr => {
        const weeklyMatchupsForYear = historicalData.matchupsBySeason?.[yr];
        if (!weeklyMatchupsForYear) return;

        const leagueMetadataForYear = historicalData.leaguesMetadataBySeason?.[yr];
        const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;

        Object.keys(weeklyMatchupsForYear).forEach(weekStr => {
            const week = parseInt(weekStr);
            if (isNaN(week) || week >= playoffStartWeek) return; // Only regular season weeks

            const matchupsInWeek = weeklyMatchupsForYear[weekStr];
            if (!matchupsInWeek || matchupsInWeek.length === 0) return;

            const allScoresInWeek = [];
            matchupsInWeek.forEach(matchup => {
                if (matchup.team1_roster_id && typeof matchup.team1_score === 'number' && !isNaN(matchup.team1_score)) {
                    allScoresInWeek.push({ roster_id: matchup.team1_roster_id, score: matchup.team1_score });
                }
                if (matchup.team2_roster_id && typeof matchup.team2_score === 'number' && !isNaN(matchup.team2_score)) {
                    allScoresInWeek.push({ roster_id: matchup.team2_roster_id, score: matchup.team2_score });
                }
            });

            if (allScoresInWeek.length === 0) return;

            // Find the maximum score in the current week among all teams
            const maxScore = Math.max(...allScoresInWeek.map(entry => entry.score));

            // Check if the current team's score is equal to the maximum score
            const teamScoreEntry = allScoresInWeek.find(entry => String(entry.roster_id) === String(teamRosterId));

            if (teamScoreEntry && teamScoreEntry.score === maxScore) {
                topScoreWeeks++;
            }
        });
    });
    return topScoreWeeks;
};


/**
 * Calculates all league-wide and team-specific metrics (DPR, Luck Rating, All-Play)
 * for all seasons based on historical matchup data.
 *
 * @param {Object} historicalData - The full historical data object from SleeperDataContext.
 * @param {Function} getTeamName - Function to get team display name from roster_id or user_id, now accepts season.
 * @returns {{seasonalMetrics: Object, careerDPRData: Array}}
 * seasonalMetrics: { year: { teamRosterId: { wins, losses, ties, pointsFor, pointsAgainst, averageScore, adjustedDPR, luckRating, allPlayWinPercentage, rank, topScoreWeeksCount, isChampion, isRunnerUp, isThirdPlace, isPointsChampion, isPointsRunnerUp, isThirdPlacePoints, isPlayoffTeam } } }
 * careerDPRData: Array of { teamRosterId, dpr, wins, losses, ties, pointsFor, pointsAgainst, averageScore, topScoreWeeksCount, totalLuckRating }
 */
export const calculateAllLeagueMetrics = (historicalData, getTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    const seasonalTeamStatsRaw = {}; // Stores raw stats per team per season (using roster_id as key)
    const careerTeamStatsRaw = {}; // Stores raw career stats per team (using roster_id as key)

    // Iterate through each season's matchups
    Object.keys(historicalData.matchupsBySeason || {}).sort().forEach(year => {
        const weeklyMatchupsForYear = historicalData.matchupsBySeason[year];
        const leagueMetadataForYear = historicalData.leaguesMetadataBySeason[year];
        // Default playoffStartWeek to a high number if not found, to treat all weeks as regular season
        const playoffStartWeek = leagueMetadataForYear?.settings?.playoff_start_week ? parseInt(leagueMetadataForYear.settings.playoff_start_week) : 99;
        const rostersForYear = historicalData.rostersBySeason?.[year] || []; // Get rosters for the current year

        if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};

        // Iterate through each week's matchups in the current season
        Object.keys(weeklyMatchupsForYear || {}).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekStr => {
            const week = parseInt(weekStr);
            const matchupsInWeek = weeklyMatchupsForYear[weekStr];

            if (!matchupsInWeek || matchupsInWeek.length === 0) return;

            matchupsInWeek.forEach(matchup => {
                const team1RosterId = String(matchup.team1_roster_id);
                const team2RosterId = String(matchup.team2_roster_id);
                const team1Score = parseFloat(matchup.team1_score);
                const team2Score = parseFloat(matchup.team2_score);

                // Skip if scores are invalid or roster IDs are missing
                if (isNaN(team1Score) || isNaN(team2Score) || !team1RosterId || !team2RosterId) {
                    return;
                }

                // Get owner IDs for current teams
                const team1OwnerId = rostersForYear.find(r => String(r.roster_id) === team1RosterId)?.owner_id;
                const team2OwnerId = rostersForYear.find(r => String(r.roster_id) === team2RosterId)?.owner_id;

                // Skip if owner IDs are not found (shouldn't happen if data is consistent, but good safeguard)
                if (!team1OwnerId || !team2OwnerId) {
                    return;
                }


                const isRegularSeasonMatch = week < playoffStartWeek;
                const isTie = team1Score === team2Score;
                const team1Won = team1Score > team2Score;

                // Process Team 1
                if (!seasonalTeamStatsRaw[year][team1RosterId]) {
                    seasonalTeamStatsRaw[year][team1RosterId] = {
                        totalPointsFor: 0, pointsAgainst: 0,
                        wins: 0, losses: 0, ties: 0, totalGames: 0,
                        highScore: -Infinity, lowScore: Infinity,
                        weeklyScores: [],
                        isPlayoffTeam: false,
                        ownerId: team1OwnerId, // Store ownerId
                    };
                }
                seasonalTeamStatsRaw[year][team1RosterId].totalPointsFor += team1Score;
                seasonalTeamStatsRaw[year][team1RosterId].pointsAgainst += team2Score;
                seasonalTeamStatsRaw[year][team1RosterId].weeklyScores.push(team1Score);
                seasonalTeamStatsRaw[year][team1RosterId].highScore = Math.max(seasonalTeamStatsRaw[year][team1RosterId].highScore, team1Score);
                seasonalTeamStatsRaw[year][team1RosterId].lowScore = Math.min(seasonalTeamStatsRaw[year][team1RosterId].lowScore, team1Score);

                if (isRegularSeasonMatch) {
                    seasonalTeamStatsRaw[year][team1RosterId].totalGames++;
                    if (team1Won) {
                        seasonalTeamStatsRaw[year][team1RosterId].wins++;
                    } else if (isTie) {
                        seasonalTeamStatsRaw[year][team1RosterId].ties++;
                    } else {
                        seasonalTeamStatsRaw[year][team1RosterId].losses++;
                    }
                } else { // It's a playoff match
                    seasonalTeamStatsRaw[year][team1RosterId].isPlayoffTeam = true;
                }

                // Update career stats for Team 1 (using ownerId as key for career stats)
                if (!careerTeamStatsRaw[team1OwnerId]) { // Use ownerId here
                    careerTeamStatsRaw[team1OwnerId] = {
                        totalPointsFor: 0, pointsAgainst: 0,
                        wins: 0, losses: 0, ties: 0, totalGames: 0,
                        careerWeeklyScores: [],
                        highScore: -Infinity, lowScore: Infinity, // Add high/low for career
                        rosterId: team1RosterId, // Store an example rosterId for this owner
                    };
                }
                careerTeamStatsRaw[team1OwnerId].totalPointsFor += team1Score;
                careerTeamStatsRaw[team1OwnerId].pointsAgainst += team2Score;
                careerTeamStatsRaw[team1OwnerId].careerWeeklyScores.push(team1Score);
                careerTeamStatsRaw[team1OwnerId].highScore = Math.max(careerTeamStatsRaw[team1OwnerId].highScore, team1Score);
                careerTeamStatsRaw[team1OwnerId].lowScore = Math.min(careerTeamStatsRaw[team1OwnerId].lowScore, team1Score);

                if (isRegularSeasonMatch) {
                    careerTeamStatsRaw[team1OwnerId].totalGames++;
                    if (team1Won) {
                        careerTeamStatsRaw[team1OwnerId].wins++;
                    } else if (isTie) {
                        careerTeamStatsRaw[team1OwnerId].ties++;
                    } else {
                        careerTeamStatsRaw[team1OwnerId].losses++;
                    }
                }

                // Process Team 2
                if (!seasonalTeamStatsRaw[year][team2RosterId]) {
                    seasonalTeamStatsRaw[year][team2RosterId] = {
                        totalPointsFor: 0, pointsAgainst: 0,
                        wins: 0, losses: 0, ties: 0, totalGames: 0,
                        highScore: -Infinity, lowScore: Infinity,
                        weeklyScores: [],
                        isPlayoffTeam: false,
                        ownerId: team2OwnerId, // Store ownerId
                    };
                }
                seasonalTeamStatsRaw[year][team2RosterId].totalPointsFor += team2Score;
                seasonalTeamStatsRaw[year][team2RosterId].pointsAgainst += team1Score;
                seasonalTeamStatsRaw[year][team2RosterId].weeklyScores.push(team2Score);
                seasonalTeamStatsRaw[year][team2RosterId].highScore = Math.max(seasonalTeamStatsRaw[year][team2RosterId].highScore, team2Score);
                seasonalTeamStatsRaw[year][team2RosterId].lowScore = Math.min(seasonalTeamStatsRaw[year][team2RosterId].lowScore, team2Score);

                if (isRegularSeasonMatch) {
                    seasonalTeamStatsRaw[year][team2RosterId].totalGames++;
                    if (!team1Won && !isTie) { // Team 2 won
                        seasonalTeamStatsRaw[year][team2RosterId].wins++;
                    } else if (isTie) {
                        seasonalTeamStatsRaw[year][team2RosterId].ties++;
                    } else { // Team 2 lost
                        seasonalTeamStatsRaw[year][team2RosterId].losses++;
                    }
                } else { // It's a playoff match
                    seasonalTeamStatsRaw[year][team2RosterId].isPlayoffTeam = true;
                }

                // Update career stats for Team 2 (using ownerId as key for career stats)
                if (!careerTeamStatsRaw[team2OwnerId]) { // Use ownerId here
                    careerTeamStatsRaw[team2OwnerId] = {
                        totalPointsFor: 0, pointsAgainst: 0,
                        wins: 0, losses: 0, ties: 0, totalGames: 0,
                        careerWeeklyScores: [],
                        highScore: -Infinity, lowScore: Infinity, // Add high/low for career
                        rosterId: team2RosterId, // Store an example rosterId for this owner
                    };
                }
                careerTeamStatsRaw[team2OwnerId].totalPointsFor += team2Score;
                careerTeamStatsRaw[team2OwnerId].pointsAgainst += team1Score;
                careerTeamStatsRaw[team2OwnerId].careerWeeklyScores.push(team2Score);
                careerTeamStatsRaw[team2OwnerId].highScore = Math.max(careerTeamStatsRaw[team2OwnerId].highScore, team2Score);
                careerTeamStatsRaw[team2OwnerId].lowScore = Math.min(careerTeamStatsRaw[team2OwnerId].lowScore, team2Score);

                if (isRegularSeasonMatch) {
                    careerTeamStatsRaw[team2OwnerId].totalGames++;
                    if (!team1Won && !isTie) { // Team 2 won
                        careerTeamStatsRaw[team2OwnerId].wins++;
                    } else if (isTie) {
                        careerTeamStatsRaw[team2OwnerId].ties++;
                    } else { // Team 2 lost
                        careerTeamStatsRaw[team2OwnerId].losses++;
                    }
                }
            });
        });
    });

    const seasonalMetrics = {};

    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const rosterIdsInSeason = Object.keys(seasonalTeamStatsRaw[year]);

        rosterIdsInSeason.forEach(rosterId => {
            const stats = seasonalTeamStatsRaw[year][rosterId];
            const averageScore = stats.totalGames > 0 ? stats.totalPointsFor / stats.totalGames : 0;
            const winPercentage = stats.totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            const rawDPR = calculateRawDPR(
                averageScore,
                stats.highScore !== -Infinity ? stats.highScore : 0, // Handle initial -Infinity
                stats.lowScore !== Infinity ? stats.lowScore : 0,    // Handle initial Infinity
                winPercentage
            );

            // Calculate Luck Rating and All-Play Win Percentage
            const luckRating = calculateLuckRating(historicalData, rosterId, year); // Pass historicalData
            const allPlayWinPercentage = calculateAllPlayWinPercentage(historicalData, rosterId, year); // Pass historicalData
            const topScoreWeeksCount = calculateTopScoreWeeksCount(historicalData, rosterId, year); // Pass historicalData

            seasonalMetrics[year][rosterId] = {
                teamName: getTeamName(rosterId, year), // Use getTeamName with season
                rosterId: rosterId, // Store roster ID
                ownerId: stats.ownerId, // Store ownerId
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
                highScore: stats.highScore,
                lowScore: stats.lowScore,
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
        });

        // Calculate adjusted DPR for each team in the current season
        const allRawDPRsInSeason = rosterIdsInSeason.map(rosterId => seasonalMetrics[year][rosterId].rawDPR).filter(dpr => dpr !== 0);
        const avgRawDPRInSeason = allRawDPRsInSeason.length > 0 ? allRawDPRsInSeason.reduce((sum, dpr) => sum + dpr, 0) / allRawDPRsInSeason.length : 0;

        rosterIdsInSeason.forEach(rosterId => {
            if (avgRawDPRInSeason > 0) {
                seasonalMetrics[year][rosterId].adjustedDPR = seasonalMetrics[year][rosterId].rawDPR / avgRawDPRInSeason;
            } else {
                seasonalMetrics[year][rosterId].adjustedDPR = 0;
            }
        });

        // --- RANK CALCULATION LOGIC (Overall Finish) ---
        // Prepare all teams for ranking, including those with 0 games
        const allTeamsInSeasonForRanking = Object.keys(seasonalMetrics[year]).map(rosterId => ({
            rosterId: rosterId, // Ensure rosterId is available here
            teamName: seasonalMetrics[year][rosterId].teamName,
            winPercentage: seasonalMetrics[year][rosterId].winPercentage,
            pointsFor: seasonalMetrics[year][rosterId].pointsFor,
            totalGames: seasonalMetrics[year][rosterId].totalGames // Keep this to differentiate
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
            seasonalMetrics[year][rankedTeam.rosterId].rank = index + 1;
            // Set trophy flags based on rank
            if (index === 0) seasonalMetrics[year][rankedTeam.rosterId].isChampion = true;
            else if (index === 1) seasonalMetrics[year][rankedTeam.rosterId].isRunnerUp = true;
            else if (index === 2) seasonalMetrics[year][rankedTeam.rosterId].isThirdPlace = true;
        });

        // The original code had finalSeedingGameResults, which came from Google Sheet data.
        // This logic is now replaced by playoffRankings.js, which is consumed by SleeperMatchupTester.
        // calculateAllLeagueMetrics focuses on regular season performance and points.
        // Playoff finish data (isChampion, isRunnerUp, isThirdPlace) will be overlaid
        // by the component that uses both seasonalMetrics and playoffRankings.
        // So, the finalSeedingGameResults overlay logic is removed from here.

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
                seasonalMetrics[year][teamStats.rosterId].pointsRank = currentRank;

                // Set points trophy flags
                if (currentRank === 1) {
                    seasonalMetrics[year][teamStats.rosterId].isPointsChampion = true;
                } else if (currentRank === 2) {
                    seasonalMetrics[year][teamStats.rosterId].isPointsRunnerUp = true;
                } else if (currentRank === 3) {
                    seasonalMetrics[year][teamStats.rosterId].isThirdPlacePoints = true;
                }
            }
        }
        // --- END POINTS RANKING LOGIC ---
    });

    const careerDPRData = [];
    const allCareerRawDPRs = [];

    // Calculate career average scores and DPRs for all teams
    Object.keys(careerTeamStatsRaw).forEach(ownerId => { // Iterate over owner IDs
        const stats = careerTeamStatsRaw[ownerId];
        const careerScores = stats.careerWeeklyScores;
        const careerHighScore = careerScores.length > 0 ? Math.max(...careerScores) : 0;
        const careerLowScore = careerScores.length > 0 ? Math.min(...careerScores) : 0;
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

        // Use the ownerId to get the team name for career stats
        const teamNameForOwner = getTeamName(ownerId, null);
        const careerTopScoreWeeksCount = calculateTopScoreWeeksCount(historicalData, stats.rosterId, null); // Pass historicalData, use an example rosterId for this owner, null for career total

        careerDPRData.push({
            ownerId: ownerId, // Store ownerId
            teamName: teamNameForOwner, // Use the resolved team name for this owner
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
            highScore: careerHighScore, // Ensure this is the career high score
            lowScore: careerLowScore, // Ensure this is the career low score
            // Luck rating for career is sum of seasonal luck ratings
            totalLuckRating: Object.keys(seasonalMetrics).reduce((sum, year) => {
                // Find the seasonal stats for this owner's roster in this year
                const seasonalStatsForOwnerRoster = Object.values(seasonalMetrics[year]).find(s => s.ownerId === ownerId);
                return sum + (seasonalStatsForOwnerRoster?.luckRating || 0);
            }, 0),
            // Add highest/lowest seasonal points avg to career data
            highestSeasonalPointsAvg: Object.keys(seasonalMetrics).reduce((maxAvg, year) => {
                const seasonalStats = Object.values(seasonalMetrics[year]).find(s => s.ownerId === ownerId);
                if (seasonalStats && seasonalStats.totalGames > 0) {
                    return Math.max(maxAvg, seasonalStats.pointsFor / seasonalStats.totalGames); // FIX: Corrected typo
                }
                return maxAvg;
            }, 0),
            lowestSeasonalPointsAvg: Object.keys(seasonalMetrics).reduce((minAvg, year) => {
                const seasonalStats = Object.values(seasonalMetrics[year]).find(s => s.ownerId === ownerId);
                if (seasonalStats && seasonalStats.totalGames > 0) {
                    return Math.min(minAvg, seasonalStats.pointsFor / seasonalStats.totalGames); // FIX: Corrected typo
                }
                return minAvg;
            }, Infinity),
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
    return { seasonalMetrics, careerDPRData };
};
