// src/utils/calculations.js

/**
 * Helper function to calculate raw DPR (Power Rating) for a team.
 * @param {number} averageScore - The team's average score for the period (season or career).
 * @param {number} teamHighScore - The team's highest single-game score for the period (season or career).
 * @param {number} teamLowScore - The team's lowest single-game score for the period (season or career).
 * @param {number} teamWinPercentage - Win percentage of the team for the period (season or career).\
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
 * @param {Object} weeklyGameScoresByYearAndWeek - Weekly game scores by year and week.
 * @returns {number} The calculated Luck Rating.
 */
export const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek) => {
    const playerGamesInYear = historicalMatchups.filter(match =>
        parseInt(match.year) === year &&
        (match.team1 === teamName || match.team2 === teamName)
    );

    if (playerGamesInYear.length === 0) {
        return 0; // No games for the team in this year
    }

    let totalPointsFor = 0;
    let totalPointsAgainst = 0;
    let totalOpponentAverageScore = 0;
    let gamesCount = 0;

    playerGamesInYear.forEach(match => {
        const isTeam1 = match.team1 === teamName;
        const teamScore = isTeam1 ? parseFloat(match.team1score) : parseFloat(match.team2score);
        const opponentScore = isTeam1 ? parseFloat(match.team2score) : parseFloat(match.team1score);

        if (!isNaN(teamScore) && !isNaN(opponentScore)) {
            totalPointsFor += teamScore;
            totalPointsAgainst += opponentScore;
            gamesCount++;

            // Calculate opponent's average score for this specific game's opponent
            const opponentName = isTeam1 ? match.team2 : match.team1;
            const opponentGames = historicalMatchups.filter(
                (m) =>
                    parseInt(m.year) === year &&
                    (m.team1 === opponentName || m.team2 === opponentName)
            );

            let sumOpponentScores = 0;
            let countOpponentGames = 0;
            opponentGames.forEach((oppMatch) => {
                const isOpponentTeam1 = oppMatch.team1 === opponentName;
                const oppScore = isOpponentTeam1 ? parseFloat(oppMatch.team1score) : parseFloat(oppMatch.team2score);
                if (!isNaN(oppScore)) {
                    sumOpponentScores += oppScore;
                    countOpponentGames++;
                }
            });

            const opponentAverageScore = countOpponentGames > 0 ? sumOpponentScores / countOpponentGames : 0;
            totalOpponentAverageScore += opponentAverageScore;
        }
    });

    if (gamesCount === 0) {
        return 0;
    }

    const averagePointsFor = totalPointsFor / gamesCount;
    const averagePointsAgainst = totalPointsAgainst / gamesCount;
    const averageOpponentAverageScore = totalOpponentAverageScore / gamesCount;

    // A simplified luck rating: how much the team outscored their opponents vs. what their opponents typically score
    const luckRating = (averagePointsFor - averagePointsAgainst) - averageOpponentAverageScore;

    return luckRating;
};

/**
 * Helper function to calculate the number of times a team had the highest score in a week.
 * @param {string} teamName - The name of the team.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing weekly game scores.
 * @param {number|null} year - The specific year to check, or null for career.
 * @returns {number} The count of top-scoring weeks.
 */
export const calculateTopScoreWeeksCount = (teamName, weeklyGameScoresByYearAndWeek, year = null) => {
    let topScoreWeeksCount = 0;
    const yearsToProcess = year ? [year] : Object.keys(weeklyGameScoresByYearAndWeek);

    yearsToProcess.forEach(yr => {
        if (weeklyGameScoresByYearAndWeek[yr]) {
            for (const week in weeklyGameScoresByYearAndWeek[yr]) {
                const gamesInWeek = weeklyGameScoresByYearAndWeek[yr][week];
                let maxScoreInWeek = 0;
                let teamScoreInWeek = 0;

                gamesInWeek.forEach(game => {
                    maxScoreInWeek = Math.max(maxScoreInWeek, game.team1score, game.team2score);
                    if (game.team1 === teamName) {
                        teamScoreInWeek = game.team1score;
                    } else if (game.team2 === teamName) {
                        teamScoreInWeek = game.team2score;
                    }
                });

                if (teamScoreInWeek > 0 && teamScoreInWeek === maxScoreInWeek) {
                    // Check if this team is the *sole* top scorer, or if ties count
                    // For now, let's count if they are among the top scorers
                    const topScorers = gamesInWeek.filter(game =>
                        game.team1score === maxScoreInWeek || game.team2score === maxScoreInWeek
                    ).map(game => (game.team1score === maxScoreInWeek ? game.team1 : game.team2score === maxScoreInWeek ? game.team2 : null));

                    if (topScorers.includes(teamName)) {
                        topScoreWeeksCount++;
                    }
                }
            }
        }
    });
    return topScoreWeeksCount;
};


/**
 * Calculates all league-wide metrics for seasonal and career analysis.
 * @param {Array<Object>} historicalMatchups - Array of historical matchup data.
 * @param {Function} getMappedTeamName - Function to get the consistent mapped team name.
 * @returns {Object} An object containing seasonalMetrics, careerMetrics, weeklyGameScoresByYearAndWeek, and leagueAverageMetrics.
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getMappedTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");
    console.log("DEBUG: historicalMatchups value:", historicalMatchups);
    console.log("DEBUG: Type of historicalMatchups:", typeof historicalMatchups);
    console.log("DEBUG: Is historicalMatchups an array?", Array.isArray(historicalMatchups));
    if (!historicalMatchups || !Array.isArray(historicalMatchups) || historicalMatchups.length === 0) {
        console.warn("calculateAllLeagueMetrics: historicalMatchups is empty or invalid. Returning default metrics.");
        return {
            seasonalMetrics: {},
            careerMetrics: [],
            weeklyGameScoresByYearAndWeek: {},
            leagueAverageMetrics: {
                avgDPR: 0,
                avgWinPercentage: 0,
                avgScore: 0,
            }
        };
    }
    console.log("DEBUG: historicalMatchups length:", historicalMatchups.length);
    console.log("DEBUG: Type of getMappedTeamName:", typeof getMappedTeamName);
    console.log("DEBUG: Is getMappedTeamName a function?", typeof getMappedTeamName === 'function');


    const allTeamNames = [...new Set(historicalMatchups.flatMap(match => [match.team1, match.team2]).map(getMappedTeamName))];
    console.log("DEBUG: All mapped team names:", allTeamNames);


    const yearlyMatchups = historicalMatchups.reduce((acc, match) => {
        const year = parseInt(match.year);
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(match);
        return acc;
    }, {});
    console.log("DEBUG: yearlyMatchups keys (years with data):", Object.keys(yearlyMatchups));


    const seasonalMetrics = {};
    const allCareerRawDPRs = [];
    const allWeeklyGameScoresByYearAndWeek = {};

    // Loop through years and calculate seasonal stats
    Object.keys(yearlyMatchups).forEach(year => {
        const yearInt = parseInt(year);
        const matchesForYear = yearlyMatchups[yearInt];
        console.log(`DEBUG: Processing Year ${yearInt}. Matches found: ${matchesForYear.length}`);
        if (matchesForYear.length > 0) {
            console.log(`DEBUG: Sample match for Year ${yearInt}:`, matchesForYear[0]);
        }


        // Ensure weeklyGameScores exists for this year
        if (!allWeeklyGameScoresByYearAndWeek[yearInt]) {
            allWeeklyGameScoresByYearAndWeek[yearInt] = {};
        }

        const teamStatsForYear = {};
        const teamNamesInYear = [...new Set(matchesForYear.flatMap(match => [match.team1, match.team2]).map(getMappedTeamName))];
        console.log(`DEBUG: Team names found in Year ${yearInt}:`, teamNamesInYear);


        teamNamesInYear.forEach(team => {
            teamStatsForYear[team] = {
                wins: 0,
                losses: 0,
                ties: 0,
                totalPointsFor: 0,
                pointsAgainst: 0,
                highScore: -Infinity, // Initialize with -Infinity for correct max finding
                lowScore: Infinity,    // Initialize with Infinity for correct min finding
                totalGames: 0
            };
        });

        matchesForYear.forEach(match => {
            const team1 = getMappedTeamName(match.team1);
            const team2 = getMappedTeamName(match.team2);
            const team1score = parseFloat(match.team1score);
            const team2score = parseFloat(match.team2score);
            const week = parseInt(match.Week); // Ensure Week is parsed as integer

            // Check for valid scores before processing
            if (isNaN(team1score) || isNaN(team2score)) {
                console.warn(`Skipping match due to invalid scores: Year ${yearInt}, Week ${match.Week}, ${match.team1} vs ${match.team2}`);
                return; // Skip this match
            }

            // Update weeklyGameScoresByYearAndWeek
            if (!allWeeklyGameScoresByYearAndWeek[yearInt][week]) {
                allWeeklyGameScoresByYearAndWeek[yearInt][week] = [];
            }
            allWeeklyGameScoresByYearAndWeek[yearInt][week].push({
                team1: team1,
                team2: team2,
                team1score: team1score,
                team2score: team2score
            });

            // Update stats for Team 1
            const stats1 = teamStatsForYear[team1];
            if (stats1) {
                stats1.totalPointsFor += team1score;
                stats1.pointsAgainst += team2score;
                stats1.highScore = Math.max(stats1.highScore, team1score);
                stats1.lowScore = Math.min(stats1.lowScore, team1score);
                stats1.totalGames++;

                if (team1score > team2score) {
                    stats1.wins++;
                } else if (team1score < team2score) {
                    stats1.losses++;
                } else {
                    stats1.ties++;
                }
            } else {
                console.warn(`TeamStats missing for mapped team: ${team1} in Year ${yearInt}`);
            }


            // Update stats for Team 2
            const stats2 = teamStatsForYear[team2];
            if (stats2) {
                stats2.totalPointsFor += team2score;
                stats2.pointsAgainst += team1score;
                stats2.highScore = Math.max(stats2.highScore, team2score);
                stats2.lowScore = Math.min(stats2.lowScore, team1score);
                stats2.totalGames++;

                if (team2score > team1score) {
                    stats2.wins++;
                } else if (team2score < team1score) {
                    stats2.losses++;
                } else {
                    stats2.ties++;
                }
            } else {
                console.warn(`TeamStats missing for mapped team: ${team2} in Year ${yearInt}`);
            }
        });
        console.log(`DEBUG: teamStatsForYear for ${yearInt} after processing matches:`, teamStatsForYear);


        // Calculate seasonalDPRData and other seasonal metrics
        const seasonalDPRData = [];
        Object.keys(teamStatsForYear).forEach(team => {
            const stats = teamStatsForYear[team];
            const seasonAverageScore = stats.totalGames > 0 ? stats.totalPointsFor / stats.totalGames : 0;
            const seasonWinPercentage = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;
            const seasonHighScore = stats.highScore === -Infinity ? 0 : stats.highScore;
            const seasonLowScore = stats.lowScore === Infinity ? 0 : stats.lowScore;

            let rawDPR = 0;
            if (stats.totalGames > 0) {
                rawDPR = calculateRawDPR(
                    seasonAverageScore,
                    seasonHighScore,
                    seasonLowScore,
                    seasonWinPercentage
                );
            }

            seasonalDPRData.push({
                team: team, // 'team' is already mapped here
                dpr: rawDPR, // Will be adjusted later for the season
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.totalPointsFor,
                pointsAgainst: stats.pointsAgainst,
                averageScore: seasonAverageScore,
                winPercentage: seasonWinPercentage,
                totalGames: stats.totalGames,
                highScore: seasonHighScore,
                lowScore: seasonLowScore
            });
        });

        console.log(`DEBUG: seasonalDPRData for ${yearInt} (before normalization):`, seasonalDPRData);

        // Normalize seasonal DPRs
        const allSeasonRawDPRs = seasonalDPRData.map(d => d.dpr).filter(d => d > 0);
        const avgRawDPRSeason = allSeasonRawDPRs.length > 0 ? allSeasonRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allSeasonRawDPRs.length : 0;
        console.log(`DEBUG: Average raw DPR for ${yearInt} season (for normalization):`, avgRawDPRSeason);


        seasonalDPRData.forEach(entry => {
            if (avgRawDPRSeason > 0) {
                entry.dpr = entry.dpr / avgRawDPRSeason;
            } else {
                entry.dpr = 0;
            }
            // Also calculate average point differential for the season for each player
            const playerGamesInSeason = matchesForYear.filter(match =>
                getMappedTeamName(match.team1) === getMappedTeamName(entry.team) ||
                getMappedTeamName(match.team2) === getMappedTeamName(entry.team)
            );
            let totalDiff = 0;
            playerGamesInSeason.forEach(match => {
                const isTeam1 = getMappedTeamName(match.team1) === getMappedTeamName(entry.team);
                const playerPoints = isTeam1 ? match.team1score : match.team2score;
                const opponentPoints = isTeam1 ? match.team2score : match.team1score;
                totalDiff += (playerPoints - opponentPoints);
            });
            entry.avgPointDifferential = playerGamesInSeason.length > 0 ? totalDiff / playerGamesInSeason.length : 0;
        });


        seasonalMetrics[yearInt] = {
            dprData: seasonalDPRData,
            weeklyGameScores: allWeeklyGameScoresByYearAndWeek[yearInt]
        };
        console.log(`DEBUG: Final seasonalMetrics[${yearInt}] dprData (after normalization and diff calculation):`, seasonalMetrics[yearInt].dprData);
    });

    // Calculate career metrics
    const careerDPRData = [];
    allTeamNames.forEach(team => {
        const teamCareerGames = historicalMatchups.filter(match =>
            getMappedTeamName(match.team1) === team || getMappedTeamName(match.team2) === team
        );

        let totalCareerWins = 0;
        let totalCareerLosses = 0;
        let totalCareerTies = 0;
        let totalCareerPointsFor = 0;
        let totalCareerPointsAgainst = 0;
        let careerHighScore = -Infinity;
        let careerLowScore = Infinity;
        let careerTotalGames = 0;

        teamCareerGames.forEach(match => {
            const isTeam1 = getMappedTeamName(match.team1) === team;
            const teamScore = isTeam1 ? parseFloat(match.team1score) : parseFloat(match.team2score);
            const opponentScore = isTeam1 ? parseFloat(match.team2score) : parseFloat(match.team1score);

            if (!isNaN(teamScore) && !isNaN(opponentScore)) {
                totalCareerPointsFor += teamScore;
                totalCareerPointsAgainst += opponentScore;
                careerHighScore = Math.max(careerHighScore, teamScore);
                careerLowScore = Math.min(careerLowScore, teamScore);
                careerTotalGames++;

                if (teamScore > opponentScore) {
                    totalCareerWins++;
                } else if (teamScore < opponentScore) {
                    totalCareerLosses++;
                } else {
                    totalCareerTies++;
                }
            }
        });

        const careerAverageScore = careerTotalGames > 0 ? totalCareerPointsFor / careerTotalGames : 0;
        const careerWinPercentage = careerTotalGames > 0 ? totalCareerWins / careerTotalGames : 0;

        const stats = {
            rawDPR: 0,
            wins: totalCareerWins,
            losses: totalCareerLosses,
            ties: totalCareerTies,
            totalPointsFor: totalCareerPointsFor,
            pointsAgainst: totalCareerPointsAgainst,
            totalGames: careerTotalGames
        };

        if (careerTotalGames > 0) {
            stats.rawDPR = calculateRawDPR(
                careerAverageScore,
                careerHighScore === -Infinity ? 0 : careerHighScore,
                careerLowScore === Infinity ? 0 : careerLowScore,
                careerWinPercentage
            );
            allCareerRawDPRs.push(stats.rawDPR);
        } else {
            stats.rawDPR = 0;
        }

        const careerTopScoreWeeksCount = calculateTopScoreWeeksCount(team, allWeeklyGameScoresByYearAndWeek, null);

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
        });
    });

    // Calculate overall average raw DPR for career adjustment
    const avgRawDPROverall = allCareerRawDPRs.length > 0 ? allCareerRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allCareerRawDPRs.length : 0;
    console.log("DEBUG: Overall average raw DPR (for career normalization):", avgRawDPROverall);

    // Adjust career DPRs based on overall average
    careerDPRData.forEach(entry => {
        if (avgRawDPROverall > 0) {
            entry.dpr = entry.dpr / avgRawDPROverall;
        } else {
            entry.dpr = 0;
        }
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr);
    console.log("DEBUG: Final careerDPRData (normalized and sorted):", careerDPRData);

    // Calculate league average metrics (can be extended)
    const leagueAverageMetrics = {
        // Example: Calculate average DPR across all players in the latest season
        avgDPR: Object.values(seasonalMetrics).length > 0 ?
            Object.values(seasonalMetrics)[Object.values(seasonalMetrics).length - 1].dprData.reduce((sum, player) => sum + player.dpr, 0) /
            Object.values(seasonalMetrics)[Object.values(seasonalMetrics).length - 1].dprData.length : 0,
        avgWinPercentage: 0, // Placeholder
        avgScore: 0, // Placeholder
    };
    console.log("DEBUG: League Average Metrics:", leagueAverageMetrics);


    console.log("--- Finished calculateAllLeagueMetrics ---");

    return {
        seasonalMetrics, // This contains { year: { dprData: [...], weeklyGameScores: {...} } }
        careerMetrics: careerDPRData,
        weeklyGameScoresByYearAndWeek: allWeeklyGameScoresByYearAndWeek,
        leagueAverageMetrics: leagueAverageMetrics
    };
};
