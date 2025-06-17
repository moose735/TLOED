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
    console.log(`\n--- Luck Rating Debugger for ${teamName} in ${year} ---`);
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

            console.log(`  Week ${week}: Team Score: ${currentTeamScoreForWeek.toFixed(2)}, Outscored: ${outscoredCount}, One Less: ${oneLessCount}, Weekly Expected Wins: ${combinedWeeklyLuckScore.toFixed(3)}`);
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
    console.log(`  Summary: Total Actual Wins (Regular Season): ${actualWinsFromRecord}`);
    console.log(`  Summary: Total Expected Wins (Sum of Weekly): ${totalWeeklyLuckScoreSum.toFixed(3)}`);
    console.log(`  Final Luck Rating (${actualWinsFromRecord} - ${totalWeeklyLuckScoreSum.toFixed(3)}): ${finalLuckRating.toFixed(4)}`);
    console.log(`--- End Luck Rating Debugger for ${teamName} in ${year} ---`);
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

        if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 === '' && displayTeam2 === '')) {
            // console.warn(`Skipping invalid matchup data at index ${index}:`, match); // Debugging removed
            return;
        }

        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (displayTeam1 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam1]) {
                seasonalTeamStatsRaw[year][displayTeam1] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0
                };
            }
            seasonalTeamStatsRaw[year][displayTeam1].totalPointsFor += team1Score;

            if (!careerTeamStatsRaw[displayTeam1]) {
                careerTeamStatsRaw[displayTeam1] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam1].totalPointsFor += team1Score;
            careerTeamStatsRaw[displayTeam1].careerWeeklyScores.push(team1Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });
        }

        if (displayTeam2 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam2]) {
                seasonalTeamStatsRaw[year][displayTeam2] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0
                };
            }
            seasonalTeamStatsRaw[year][displayTeam2].totalPointsFor += team2Score;

            if (!careerTeamStatsRaw[displayTeam2]) {
                careerTeamStatsRaw[displayTeam2] = {
                    totalPointsFor: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: []
                };
            }
            careerTeamStatsRaw[displayTeam2].totalPointsFor += team2Score;
            careerTeamStatsRaw[displayTeam2].careerWeeklyScores.push(team2Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGåmeScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });
        }

        // totalGames, wins, losses, ties count for ALL games that are NOT pointsOnlyBye
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            // console.log(`DEBUG: Matchup ${index + 1} for ${year} Week ${week} between ${displayTeam1} and ${displayTeam2} counts towards W-L-T record.`); // Debugging removed
            if (displayTeam1 !== '') {
                seasonalTeamStatsRaw[year][displayTeam1].totalGames++;
                careerTeamStatsRaw[displayTeam1].totalGames++;
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
                seasonalTeamStatsRaw[year][displayTeam2].totalGames++;
                careerTeamStatsRaw[displayTeam2].totalGames++;
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
        } else {
            // console.log(`DEBUG: Matchup ${index + 1} for ${year} Week ${week} between ${displayTeam1} and ${displayTeam2} is a points-only-bye. NOT counting towards W-L-T record.`); // Debugging removed
        }
    });

    const seasonalMetrics = {};

    // --- Calculate Seasonal DPR, Luck Rating, All-Play ---
    // console.log("\n--- Calculating Seasonal Metrics (First Pass: Raw DPR) ---"); // Debugging removed
    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const teamsInSeason = Object.keys(seasonalTeamStatsRaw[year]).filter(team => team !== '');

        let totalRawDPRForSeason = 0;
        let teamsCountForDPR = 0;

        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];

            const teamSeasonalScores = weeklyGameScoresByYearAndWeek[year] ?
                                         Object.values(weeklyGameScoresByYearAndWeek[year])
                                         .flat()
                                         .filter(entry => entry.team === team && typeof entry.score === 'number' && !isNaN(entry.score))
                                         .map(entry => entry.score)
                                         : [];

            const totalWeeksPlayedForAverage = teamSeasonalScores.length;
            const averageScoreForSeason = totalWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalWeeksPlayedForAverage : 0;

            const teamHighScoreForSeason = totalWeeksPlayedForAverage > 0 ? Math.max(...teamSeasonalScores) : 0;
            const teamLowScoreForSeason = totalWeeksPlayedForAverage > 0 ? Math.min(...teamSeasonalScores) : 0;

            const teamWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            // DPR Debugging removed from here
            if (totalWeeksPlayedForAverage === 0 && stats.totalGames === 0) {
                // console.log(`Skipping Raw DPR calculation for ${team} in ${year} as no scores or games recorded.`); // Debugging removed
                return;
            }

            const rawDPR = calculateRawDPR(averageScoreForSeason, teamHighScoreForSeason, teamLowScoreForSeason, teamWinPercentage);
            stats.rawDPR = rawDPR;

            // console.log(`Calculated Raw DPR for ${team} in ${year}: ${rawDPR.toFixed(4)}`); // Debugging removed

            if (!isNaN(rawDPR)) {
                totalRawDPRForSeason += rawDPR;
                teamsCountForDPR++;
            }
        });

        const avgRawDPRForSeason = teamsCountForDPR > 0 ? totalRawDPRForSeason / teamsCountForDPR : 0;
        // console.log(`\nAverage Raw DPR for ${year} season (used for Adjusted DPR): ${avgRawDPRForSeason.toFixed(4)} (from ${teamsCountForDPR} teams)`); // Debugging removed


        // Second pass for adjusted DPR, Luck Rating, and All-Play
        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];

            const totalWeeksPlayedForAverage = (weeklyGameScoresByYearAndWeek[year] ?
                                         Object.values(weeklyGameScoresByYearAndWeek[year])
                                         .flat()
                                         .filter(entry => entry.team === team && typeof entry.score === 'number' && !isNaN(entry.score))
                                         .map(entry => entry.score)
                                         : []).length;


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

            const adjustedDPR = avgRawDPRForSeason > 0 ? stats.rawDPR / avgRawDPRForSeason : 0;
            const luckRating = calculateLuckRating(historicalMatchups, team, parseInt(year), weeklyGameScoresByYearAndWeek, getMappedTeamName);
            const allPlayWinPercentage = calculateAllPlayWinPercentage(team, parseInt(year), weeklyGameScoresByYearAndWeek);

            // Keep final summary for seasonal metrics, but remove internal DPR details
            console.log(`\nFinal Seasonal Metrics for ${team} in ${year}:`);
            console.log(`  Adjusted DPR: ${adjustedDPR.toFixed(4)}`);
            console.log(`  Luck Rating: ${luckRating.toFixed(4)}`);
            console.log(`  All-Play Win Percentage: ${allPlayWinPercentage.toFixed(4)}`);
            // console.log(`  (Raw DPR: ${stats.rawDPR.toFixed(4)}, Average Score: ${averageScoreForSeason.toFixed(2)}, High: ${teamSeasonalScores.length > 0 ? Math.max(...teamSeasonalScores).toFixed(2) : 0}, Low: ${teamSeasonalScores.length > 0 ? Math.min(...teamSeasonalScores).toFixed(2) : 0}, Win%: ${((stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0).toFixed(3)})`); // Debugging removed


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

    // --- Collect Seasonal Average Scores for Career DPR High/Low Averages ---
    const teamSeasonalAverageScores = {};
    Object.keys(seasonalMetrics).forEach(year => {
        Object.keys(seasonalMetrics[year]).forEach(team => {
            if (!teamSeasonalAverageScores[team]) {
                teamSeasonalAverageScores[team] = [];
            }
            const avgScore = seasonalMetrics[year][team].averageScore;
            if (typeof avgScore === 'number' && !isNaN(avgScore)) {
                teamSeasonalAverageScores[team].push(avgScore);
            }
        });
    });
    // console.log("\nDEBUG: Collected Seasonal Average Scores for Career High/Low Avg:", teamSeasonalAverageScores); // Debugging removed


    // --- Calculate Career DPR ---
    // console.log("\n--- Calculating Career DPR ---"); // Debugging removed
    const careerDPRData = [];
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];

        const totalCareerWeeksPlayedForAverage = stats.careerWeeklyScores.length;
        const averageScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalCareerWeeksPlayedForAverage : 0;

        const teamsAvgScoresForCareerHighLow = teamSeasonalAverageScores[team] || [];
        const careerHighestAvgSeasonScore = teamsAvgScoresForCareerHighLow.length > 0 ? Math.max(...teamsAvgScoresForCareerHighLow) : 0;
        const careerLowestAvgSeasonScore = teamsAvgScoresForCareerHighLow.length > 0 ? Math.min(...teamsAvgScoresForCareerHighLow) : 0;

        const teamMaxScoreOverall = careerHighestAvgSeasonScore;
        const teamMinScoreOverall = careerLowestAvgSeasonScore;

        const careerWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

        // DPR Debugging removed from here
        if (totalCareerWeeksPlayedForAverage === 0 && stats.totalGames === 0) {
            // console.log(`Skipping Career Raw DPR calculation for ${team} as no scores or games recorded.`); // Debugging removed
            return;
        }

        const rawDPR = calculateRawDPR(averageScoreOverall, teamMaxScoreOverall, teamMinScoreOverall, careerWinPercentage);
        stats.rawDPR = rawDPR;

        if (!isNaN(rawDPR)) {
            totalRawDPROverall += rawDPR;
            teamsWithValidCareerDPR++;
        }
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;
    // console.log(`\nAverage Raw DPR Overall (across all teams and seasons, used for Career Adjusted DPR): ${avgRawDPROverall.toFixed(4)} (from ${teamsWithValidCareerDPR} teams)`); // Debugging removed


    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];
        const totalCareerWeeksPlayedForAverage = stats.careerWeeklyScores.length;
        const averageScoreOverall = totalCareerWeeksPlayedForAverage > 0 ? stats.totalPointsFor / totalCareerWeeksPlayedForAverage : 0;

        const teamsAvgScoresForCareerHighLow = teamSeasonalAverageScores[team] || [];
        const careerHighestAvgSeasonScore = teamsAvgScoresForCareerHighLow.length > 0 ? Math.max(...teamsAvgScoresForCareerHighLow) : 0;
        const careerLowestAvgSeasonScore = teamsAvgScoresForCareerHighLow.length > 0 ? Math.min(...teamsAvgScoresForCareerHighLow) : 0;


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

        // Keep final summary for career metrics, but remove internal DPR details
        console.log(`\nFinal Career Metrics for ${team}:`);
        console.log(`  Adjusted DPR: ${adjustedDPR.toFixed(4)}`);
        // console.log(`  (Raw DPR: ${stats.rawDPR.toFixed(4)}, Average Score: ${averageScoreOverall.toFixed(2)}, Highest Avg Season Score: ${careerHighestAvgSeasonScore.toFixed(2)}, Lowest Avg Season Score: ${careerLowestAvgSeasonScore.toFixed(2)}, Win%: ${((stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0).toFixed(3)})`); // Debugging removed


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
