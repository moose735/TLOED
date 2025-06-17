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
    let totalWeeklyLuckScoreSum = 0;

    // Iterate through weeks for the given year
    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
            const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];

            const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
                .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score) && entry.team !== '')
                .map(entry => entry.team)
            );
            if (!uniqueTeamsWithScores.has(teamName)) return;

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

            const denominatorX = 11;
            const denominatorY = 22;

            const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
            const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;

            const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
            totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
        });
    }

    let actualRegularSeasonWins = 0;
    historicalMatchups.forEach(match => {
        if (!(match?.regSeason === true || match?.regSeason === 'true') || parseInt(match?.year || '0') !== year) return;

        const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());

        if ((displayTeam1 !== teamName && displayTeam2 !== teamName) || displayTeam1 === '' || displayTeam2 === '' || (match?.pointsOnlyBye === true || match?.pointsOnlyBye === 'true')) return;

        const team1Score = parseFloat(match?.team1Score || '0');
        const team2Score = parseFloat(match?.team2Score || '0');
        const team1Won = team1Score > team2Score;

        if (displayTeam1 === teamName) {
            if (team1Won) actualRegularSeasonWins++;
        } else if (displayTeam2 === teamName) {
            if (!team1Won) actualRegularSeasonWins++;
        }
    });

    return actualRegularSeasonWins - totalWeeklyLuckScoreSum;
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
 * Calculates all league-wide and team-specific metrics (DPR, Luck Rating, All-Play)
 * for all seasons based on historical matchup data.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Function to get mapped team names.
 * @returns {{seasonalMetrics: Object, careerDPRData: Array}}
 * seasonalMetrics: { year: { teamName: { wins, losses, ties, pointsFor, averageScore, adjustedDPR, luckRating, allPlayWinPercentage } } }
 * careerDPRData: Array of { team, dpr, wins, losses, ties, pointsFor, averageScore }
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getMappedTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    const seasonalTeamStatsRaw = {};
    const weeklyGameScoresByYearAndWeek = {};
    const careerTeamStatsRaw = {};

    historicalMatchups.forEach((match, index) => {
        const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
        const year = parseInt(match?.year || '0');
        const week = parseInt(match?.week || '0');
        const team1Score = parseFloat(match?.team1Score || '0');
        const team2Score = parseFloat(match?.team2Score || '0');

        // IMPORTANT: Filter out invalid data or empty team names
        if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 === '' && displayTeam2 === '')) {
            console.warn(`Skipping invalid matchup data at index ${index}:`, match);
            return;
        }

        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        // Points and weekly scores are always populated for valid matches, regardless of bye status
        // These accumulated points and scores will be used for AVERAGE SCORE and HIGH/LOW SCORE
        if (displayTeam1 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam1]) {
                seasonalTeamStatsRaw[year][displayTeam1] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0 // totalGames here is for record only
                };
            }
            seasonalTeamStatsRaw[year][displayTeam1].totalPointsFor += team1Score;

            if (!careerTeamStatsRaw[displayTeam1]) {
                careerTeamStatsRaw[displayTeam1] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam1].totalPointsFor += team1Score;
            careerTeamStatsRaw[displayTeam1].careerWeeklyScores.push(team1Score); // This builds the array for ALL scored weeks

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });
        }

        if (displayTeam2 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam2]) {
                seasonalTeamStatsRaw[year][displayTeam2] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0 // totalGames here is for record only
                };
            }
            seasonalTeamStatsRaw[year][displayTeam2].totalPointsFor += team2Score;

            if (!careerTeamStatsRaw[displayTeam2]) {
                careerTeamStatsRaw[displayTeam2] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam2].totalPointsFor += team2Score;
            careerTeamStatsRaw[displayTeam2].careerWeeklyScores.push(team2Score); // This builds the array for ALL scored weeks

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });
        }

        // Only update win/loss/tie records and totalGames if it's a REGULAR SEASON game AND NOT a PointsOnlyBye
        if ((match.regSeason === true || match.regSeason === 'true') && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            if (displayTeam1 !== '') {
                seasonalTeamStatsRaw[year][displayTeam1].totalGames++; // This `totalGames` is for the W-L-T record
                careerTeamStatsRaw[displayTeam1].totalGames++; // This `totalGames` is for the W-L-T record
                if (isTie) {
                    seasonalTeamStatsRaw[year][displayTeam1].ties++;
                    careerTeamStatsRaw[displayTeam1].ties++;
                } else if (team1Won) {
                    seasonalTeamStatsRaw[year][displayTeam1].wins++;
                    careerTeamStatsRaw[displayTeam1].wins++;
                } else {
                    seasonalTeamStatsRaw[year][displayTeam1].losses++;
                    careerTeamStatsRaw[displayTeam1].losses++;
                }
            }

            if (displayTeam2 !== '') {
                seasonalTeamStatsRaw[year][displayTeam2].totalGames++; // This `totalGames` is for the W-L-T record
                careerTeamStatsRaw[displayTeam2].totalGames++; // This `totalGames` is for the W-L-T record
                if (isTie) {
                    seasonalTeamStatsRaw[year][displayTeam2].ties++;
                    careerTeamStatsRaw[displayTeam2].ties++;
                } else if (!team1Won) {
                    seasonalTeamStatsRaw[year][displayTeam2].wins++;
                    careerTeamStatsRaw[displayTeam2].wins++;
                } else {
                    seasonalTeamStatsRaw[year][displayTeam2].losses++;
                    careerTeamStatsRaw[displayTeam2].losses++;
                }
            }
        }
    });

    const seasonalMetrics = {};

    // --- Calculate Seasonal DPR, Luck Rating, All-Play ---
    console.log("\n--- Calculating Seasonal Metrics (First Pass: Raw DPR) ---");
    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const teamsInSeason = Object.keys(seasonalTeamStatsRaw[year]).filter(team => team !== '');

        let totalRawDPRForSeason = 0;
        let teamsCountForDPR = 0;

        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];

            // Get all scores for the current team in this season to find their high/low AND total weeks played for average score
            const teamSeasonalScores = weeklyGameScoresByYearAndWeek[year] ?
                                         Object.values(weeklyGameScoresByYearAndWeek[year])
                                         .flat()
                                         .filter(entry => entry.team === team && typeof entry.score === 'number' && !isNaN(entry.score))
                                         .map(entry => entry.score)
                                         : [];

            // --- FIX APPLIED HERE for Average Score ---
            // The average score should be total points / total weeks played (including playoffs/consolation/byes)
            const totalWeeksPlayedForAverage = teamSeasonalScores.length;
            const averageScoreForSeason = totalWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalWeeksPlayedForAverage : 0;
            console.log(`\nDEBUG: ${team} in ${year} - Total Points: ${stats.totalPointsFor}, Total Weeks Played (for Avg Score): ${totalWeeksPlayedForAverage}`);
            console.log(`DEBUG: Calculated Average Score for ${team} in ${year}: ${averageScoreForSeason}`);
            // --- END FIX ---

            const teamHighScoreForSeason = totalWeeksPlayedForAverage > 0 ? Math.max(...teamSeasonalScores) : 0;
            const teamLowScoreForSeason = totalWeeksPlayedForAverage > 0 ? Math.min(...teamSeasonalScores) : 0;

            // Win percentage is still based on regular season games that count for record
            const teamWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            if (totalWeeksPlayedForAverage === 0 && stats.totalGames === 0) { // If a team had no games whatsoever where points were scored or record was kept
                console.log(`Team ${team} in ${year} has no recorded scores or games. Skipping Raw DPR calculation.`);
                return;
            }

            const rawDPR = calculateRawDPR(averageScoreForSeason, teamHighScoreForSeason, teamLowScoreForSeason, teamWinPercentage);
            stats.rawDPR = rawDPR; // Store raw DPR temporarily

            console.log(`Calculated Raw DPR for ${team} in ${year}: ${rawDPR}`);

            if (!isNaN(rawDPR)) {
                totalRawDPRForSeason += rawDPR;
                teamsCountForDPR++;
            }
        });

        const avgRawDPRForSeason = teamsCountForDPR > 0 ? totalRawDPRForSeason / teamsCountForDPR : 0;
        console.log(`\nAverage Raw DPR for ${year} season: ${avgRawDPRForSeason} (from ${teamsCountForDPR} teams)`);


        // Second pass for adjusted DPR, Luck Rating, and All-Play
        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];

            const teamSeasonalScores = weeklyGameScoresByYearAndWeek[year] ?
                                         Object.values(weeklyGameScoresByYearAndWeek[year])
                                         .flat()
                                         .filter(entry => entry.team === team && typeof entry.score === 'number' && !isNaN(entry.score))
                                         .map(entry => entry.score)
                                         : [];
            const totalWeeksPlayedForAverage = teamSeasonalScores.length;

            if (totalWeeksPlayedForAverage === 0 && stats.totalGames === 0) {
                seasonalMetrics[year][team] = {
                    wins: stats.wins,
                    losses: stats.losses,
                    ties: stats.ties,
                    pointsFor: stats.totalPointsFor,
                    averageScore: 0,
                    adjustedDPR: 0,
                    luckRating: 0,
                    allPlayWinPercentage: 0,
                };
                return;
            }

            const averageScoreForSeason = totalWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalWeeksPlayedForAverage : 0;

            // Adjusted DPR
            const adjustedDPR = avgRawDPRForSeason > 0 ? stats.rawDPR / avgRawDPRForSeason : 0;

            // Luck Rating
            const luckRating = calculateLuckRating(historicalMatchups, team, parseInt(year), weeklyGameScoresByYearAndWeek, getMappedTeamName);

            // All-Play Win Percentage
            const allPlayWinPercentage = calculateAllPlayWinPercentage(team, parseInt(year), weeklyGameScoresByYearAndWeek);

            seasonalMetrics[year][team] = {
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.totalPointsFor,
                averageScore: averageScoreForSeason,
                adjustedDPR: adjustedDPR,
                luckRating: luckRating,
                allPlayWinPercentage: allPlayWinPercentage,
            };
        });
    });

    // --- Calculate Career DPR ---
    console.log("\n--- Calculating Career DPR ---");
    const careerDPRData = [];
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];

        // --- FIX APPLIED HERE for Career Average Score ---
        // The average score should be total career points / total career weeks played (including playoffs/consolation/byes)
        const totalCareerWeeksPlayedForAverage = stats.careerWeeklyScores.length;
        const averageScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalCareerWeeksPlayedForAverage : 0;
        console.log(`\nDEBUG: ${team} (Career) - Total Points: ${stats.totalPointsFor}, Total Weeks Played (for Avg Score): ${totalCareerWeeksPlayedForAverage}`);
        console.log(`DEBUG: Calculated Career Average Score for ${team}: ${averageScoreOverall}`);
        // --- END FIX ---

        const teamMaxScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
        const teamMinScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

        // Career win percentage is still based on regular season games that count for record
        const careerWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

        if (totalCareerWeeksPlayedForAverage === 0 && stats.totalGames === 0) {
            console.log(`Team ${team} has no recorded scores or games across career. Skipping Career Raw DPR calculation.`);
            return;
        }

        const rawDPR = calculateRawDPR(averageScoreOverall, teamMaxScoreOverall, teamMinScoreOverall, careerWinPercentage);
        stats.rawDPR = rawDPR; // Store raw DPR temporarily

        if (!isNaN(rawDPR)) {
            totalRawDPROverall += rawDPR;
            teamsWithValidCareerDPR++;
        }
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;
    console.log(`\nAverage Raw DPR Overall (across all teams and seasons): ${avgRawDPROverall} (from ${teamsWithValidCareerDPR} teams)`);


    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];
        const totalCareerWeeksPlayedForAverage = stats.careerWeeklyScores.length;
        const averageScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalCareerWeeksPlayedForAverage : 0;

        if (totalCareerWeeksPlayedForAverage === 0 && stats.totalGames === 0) {
            careerDPRData.push({
                team,
                dpr: 0,
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.totalPointsFor,
                averageScore: 0,
            });
            return;
        }

        const adjustedDPR = avgRawDPROverall > 0 ? stats.rawDPR / avgRawDPROverall : 0;

        console.log(`Career Adjusted DPR for ${team}: ${adjustedDPR} (Raw DPR: ${stats.rawDPR}, Avg Raw DPR Overall: ${avgRawDPROverall})`);

        careerDPRData.push({
            team,
            dpr: adjustedDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            averageScore: averageScoreOverall
        });
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr);

    console.log("\n--- Finished calculateAllLeagueMetrics ---");
    return { seasonalMetrics, careerDPRData, weeklyGameScoresByYearAndWeek };
};
