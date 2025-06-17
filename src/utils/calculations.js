// src/utils/calculations.js

/**
 * Helper function to calculate raw DPR for a team in a season.
 * @param {number} pointsFor - Total points for the team in the season.
 * @param {number} teamWinPercentage - Win percentage of the team in the season.
 * @param {number} leagueMaxScore - League-wide highest single-game score in the season.
 * @param {number} leagueMinScore - League-wide lowest single-game score in the season.
 * @returns {number} The raw DPR value.
 */
export const calculateRawDPR = (pointsFor, teamWinPercentage, leagueMaxScore, leagueMinScore) => {
    // Formula: ((Points Scored * 6) + ((League Max Score + League Min Score) * 2) + ((Win% * 200) * 2)) / 10
    const pointsScoredComponent = pointsFor * 6;
    const maxMinComponent = (leagueMaxScore + leagueMinScore) * 2;
    const winPercentageComponent = (teamWinPercentage * 200) * 2;
    const rawDPR = (pointsScoredComponent + maxMinComponent + winPercentageComponent) / 10;
    return rawDPR;
};

/**
 * Helper function to calculate Luck Rating for a team in a season, using the user's provided logic.
 * @param {Array<Object>} historicalMatchups - All historical matchup data.
 * @param {string} teamName - The name of the team for which to calculate luck.
 * @param {number} year - The year for which to calculate luck.
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing all weekly scores.
 * @param {Function} getDisplayTeamName - Function to get the display name of a team.
 * @returns {Object} An object containing the luckRating, actualWins, and projectedWins.
 */
export const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek, getDisplayTeamName) => {
    let totalWeeklyLuckScoreSum = 0;

    console.log(`--- Calculating Luck for ${teamName} in ${year} ---`);

    // Iterate through weeks for the given year
    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
            console.log(`  Week: ${week}`);
            const allScoresInCurrentWeek = weeklyGameScoresByYearAndWeek[year][week];
            console.log('    All scores in current week (raw):', allScoresInCurrentWeek.map(s => `${s.team}: ${s.score}`));

            // If the selected team isn't in this week's data, skip.
            const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
                .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score) && entry.team !== '') // Ensure valid team name
                .map(entry => entry.team)
            );
            if (!uniqueTeamsWithScores.has(teamName)) {
                console.log(`    Team ${teamName} did not play in week ${week}. Skipping.`);
                return;
            }

            // Explicitly filter for regular season matches in this specific week and year
            const relevantMatchupsForWeek = historicalMatchups.filter(m =>
                parseInt(m?.year || '0') === parseInt(year) &&
                parseInt(m?.week || '0') === parseInt(week) &&
                (m?.regSeason === true || m?.regSeason === 'true') && // Only regular season games
                !(m?.pointsOnlyBye === true || m?.pointsOnlyBye === 'true') // Exclude points-only-bye
            );

            if (relevantMatchupsForWeek.length === 0) {
                console.log(`    No relevant regular season matchups found for week ${week}. Skipping.`);
                return;
            }

            const currentTeamMatchEntry = relevantMatchupsForWeek.find(match => {
                const matchTeam1 = getDisplayTeamName(String(match?.team1 || '').trim());
                const matchTeam2 = getDisplayTeamName(String(match?.team2 || '').trim());
                return (matchTeam1 === teamName && matchTeam1 !== '') || (matchTeam2 === teamName && matchTeam2 !== ''); // Ensure team name is not empty
            });

            if (!currentTeamMatchEntry) {
                console.log(`    Current team's match entry not found for week ${week}. Skipping.`);
                return;
            }

            let currentTeamScoreForWeek;
            const mappedTeam1 = getDisplayTeamName(String(currentTeamMatchEntry?.team1 || '').trim());
            const mappedTeam2 = getDisplayTeamName(String(currentTeamMatchEntry?.team2 || '').trim());

            if (mappedTeam1 === teamName) {
                currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team1Score || '0');
            } else if (mappedTeam2 === teamName) {
                currentTeamScoreForWeek = parseFloat(currentTeamMatchEntry?.team2Score || '0');
            } else {
                console.log(`    Team ${teamName} score not found in match entry for week ${week}. Skipping.`);
                return; // Should not happen if currentTeamMatchEntry was found correctly
            }

            if (isNaN(currentTeamScoreForWeek)) {
                console.log(`    Current team's score is NaN for week ${week}. Skipping.`);
                return;
            }
            console.log(`    Team ${teamName} score in week ${week}: ${currentTeamScoreForWeek}`);

            let outscoredCount = 0;
            let oneLessCount = 0;

            allScoresInCurrentWeek.forEach(otherTeamEntry => {
                // Ensure the other team is not empty and not the current team, and has a valid score
                if (otherTeamEntry.team !== teamName && otherTeamEntry.team !== '' && typeof otherTeamEntry.score === 'number' && !isNaN(otherTeamEntry.score)) {
                    console.log(`      Comparing ${currentTeamScoreForWeek} (Team ${teamName}) vs ${otherTeamEntry.score} (Team ${otherTeamEntry.team})`);
                    if (currentTeamScoreForWeek > otherTeamEntry.score) {
                        outscoredCount++;
                    }
                    if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                        oneLessCount++;
                    }
                } else {
                    // Log why an entry might be skipped in the comparison
                    // console.log(`      Skipping comparison for entry: ${JSON.stringify(otherTeamEntry)} (is current team, empty, or invalid score)`);
                }
            });
            console.log(`    Outscored Count: ${outscoredCount}, One Less Count: ${oneLessCount}`);

            // Fixed denominators as per Excel formula
            const denominatorX = 11; // Assumes 12-team league, so 11 opponents
            const denominatorY = 22; // Assumes 11 opponents * 2 (for win + 1 point less)

            const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
            const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;
            console.log(`    Weekly Projected Win Comp X: ${weeklyProjectedWinComponentX.toFixed(3)}, Weekly Luck Score Part Y: ${weeklyLuckScorePartY.toFixed(3)}`);

            const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
            totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
            console.log(`    Combined Weekly Luck Score: ${combinedWeeklyLuckScore.toFixed(3)}, Total Weekly Luck Score Sum (cumulative): ${totalWeeklyLuckScoreSum.toFixed(3)}`);
        });
    }

    let actualRegularSeasonWins = 0;
    // Get actual regular season wins for the specific team for this year
    historicalMatchups.forEach(match => {
        if (!(match?.regSeason === true || match?.regSeason === 'true') || parseInt(match?.year || '0') !== year) return;

        const displayTeam1 = getDisplayTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getDisplayTeamName(String(match?.team2 || '').trim());

        // Skip if not selected team or empty, and ensure it's not a pointsOnlyBye for actual record
        if ((displayTeam1 !== teamName && displayTeam2 !== teamName) || displayTeam1 === '' || displayTeam2 === '' || (match?.pointsOnlyBye === true || match?.pointsOnlyBye === 'true')) return;

        const team1Score = parseFloat(match?.team1Score || '0');
        const team2Score = parseFloat(match?.team2Score || '0');
        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        if (displayTeam1 === teamName) {
            if (team1Won) actualRegularSeasonWins++;
        } else if (displayTeam2 === teamName) {
            if (!team1Won) actualRegularSeasonWins++;
        }
    });
    console.log(`  Actual Regular Season Wins for ${teamName} in ${year}: ${actualRegularSeasonWins}`);

    const finalLuckRating = actualRegularSeasonWins - totalWeeklyLuckScoreSum;
    console.log(`  Final Luck Rating for ${teamName} in ${year}: ${finalLuckRating.toFixed(3)} (Actual Wins: ${actualRegularSeasonWins}, Projected Wins: ${totalWeeklyLuckScoreSum.toFixed(3)})`);

    return {
        luckRating: finalLuckRating,
        actualWins: actualRegularSeasonWins,
        projectedWins: totalWeeklyLuckScoreSum // This now correctly represents the projected wins
    };
};


/**
 * Calculates various league metrics (DPR, Luck Rating, records) across all seasons and career.
 * This is a centralized utility to avoid redundant calculations across components.
 * @param {Array<Object>} historicalMatchups - Array of all historical matchup data.
 * @param {Function} getDisplayTeamName - Function to map raw team names to display names.
 * @returns {Object} Contains seasonalMetrics and careerDPRData.
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getDisplayTeamName) => {
    // --- Data Aggregation Structures ---
    const seasonalTeamStats = {}; // { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, totalGames, weeklyScores: [], allPlayWins: 0, allPlayGames: 0, luckRating: null, adjustedDPR: null, finish: null, weeklyHighScores: 0, weeklyTop2Scores: 0, weeklyTop3Scores: 0, projectedWins: 0 } } }
    const careerTeamStatsRaw = {}; // { teamName: { wins, losses, ties, totalPointsFor, totalPointsAgainst, totalGames, careerWeeklyScores: [], championships: 0, playoffAppearances: Set<year>, highestScore: {value, year, week, matchup}, lowestScore: {value, year, week, matchup} } }
    const seasonLeagueScores = {}; // { year: { allGameScores: [], weeklyScores: { week: [{ team, score }] } } }
    const championshipData = {}; // { year: { champion: 'Team', secondPlace: 'Team', thirdPlace: 'Team', fourthPlace: 'Team', winnerScore: 0, loserScore: 0, games: [] } }

    // --- First Pass: Aggregate raw seasonal and career stats ---
    historicalMatchups.forEach(match => {
        const team1 = getDisplayTeamName(String(match.team1 || '').trim());
        const team2 = getDisplayTeamName(String(match.team2 || '').trim());
        const year = parseInt(match.year);
        const week = parseInt(match.week);
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);

        if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
            console.warn('Skipping invalid matchup data:', match);
            return; // Skip invalid matchups
        }

        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;
        const team2Won = team2Score > team1Score;

        // Initialize structures for year, teams if they don't exist
        if (!seasonalTeamStats[year]) seasonalTeamStats[year] = {};
        if (!seasonLeagueScores[year]) seasonLeagueScores[year] = { allGameScores: [], weeklyScores: {} };
        if (!seasonLeagueScores[year].weeklyScores[week]) seasonLeagueScores[year].weeklyScores[week] = [];

        [team1, team2].forEach(team => {
            if (!seasonalTeamStats[year][team]) {
                seasonalTeamStats[year][team] = {
                    wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, totalGames: 0,
                    weeklyScores: [], allPlayWins: 0, allPlayGames: 0, luckRating: null, adjustedDPR: null, finish: null,
                    weeklyHighScores: 0, weeklyTop2Scores: 0, weeklyTop3Scores: 0, projectedWins: 0
                };
            }
            if (!careerTeamStatsRaw[team]) {
                careerTeamStatsRaw[team] = {
                    wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0,
                    careerWeeklyScores: [], championships: 0, playoffAppearances: new Set(),
                    highestScore: { value: 0, matchup: null, year: null, week: null },
                    lowestScore: { value: Infinity, matchup: null, year: null, week: null },
                };
            }
        });

        // Update seasonal stats for team1
        const team1SeasonStats = seasonalTeamStats[year][team1];
        team1SeasonStats.pointsFor += team1Score;
        team1SeasonStats.pointsAgainst += team2Score; // Team1 points against Team2's score
        team1SeasonStats.totalGames++;
        team1SeasonStats.weeklyScores.push(team1Score);
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) { // Only count for W-L if not a points-only-bye
            if (isTie) team1SeasonStats.ties++;
            else if (team1Won) team1SeasonStats.wins++;
            else team1SeasonStats.losses++;
        }


        // Update seasonal stats for team2
        const team2SeasonStats = seasonalTeamStats[year][team2];
        team2SeasonStats.pointsFor += team2Score;
        team2SeasonStats.pointsAgainst += team1Score; // Team2 points against Team1's score
        team2SeasonStats.totalGames++;
        team2SeasonStats.weeklyScores.push(team2Score);
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) { // Only count for W-L if not a points-only-bye
            if (isTie) team2SeasonStats.ties++;
            else if (team2Won) team2SeasonStats.wins++;
            else team2SeasonStats.losses++;
        }

        // Update career stats for team1
        const team1CareerStats = careerTeamStatsRaw[team1];
        team1CareerStats.totalPointsFor += team1Score;
        team1CareerStats.totalPointsAgainst += team2Score; // Team1 career points against Team2's score
        team1CareerStats.totalGames++;
        team1CareerStats.careerWeeklyScores.push(team1Score);
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            if (isTie) team1CareerStats.ties++;
            else if (team1Won) team1CareerStats.wins++;
            else team1CareerStats.losses++;
        }
        if (team1Score > team1CareerStats.highestScore.value) {
            team1CareerStats.highestScore = { value: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week };
        }
        if (team1Score < team1CareerStats.lowestScore.value) {
            team1CareerStats.lowestScore = { value: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week };
        }


        // Update career stats for team2
        const team2CareerStats = careerTeamStatsRaw[team2];
        team2CareerStats.totalPointsFor += team2Score;
        team2CareerStats.totalPointsAgainst += team1Score; // Team2 career points against Team1's score
        team2CareerStats.totalGames++;
        team2CareerStats.careerWeeklyScores.push(team2Score);
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
            if (isTie) team2CareerStats.ties++;
            else if (team2Won) team2CareerStats.wins++;
            else team2CareerStats.losses++;
        }
        if (team2Score > team2CareerStats.highestScore.value) {
            team2CareerStats.highestScore = { value: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week };
        }
        if (team2Score < team2CareerStats.lowestScore.value) {
            team2CareerStats.lowestScore = { value: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week };
        }


        // Aggregate all game scores for league-wide min/max
        seasonLeagueScores[year].allGameScores.push(team1Score, team2Score);
        seasonLeagueScores[year].weeklyScores[week].push(
            { team: team1, score: team1Score },
            { team: team2, score: team2Score }
        );

        // Process final seeding games for champions
        if (match.finalSeedingGame !== undefined && match.finalSeedingGame !== null && !isNaN(match.finalSeedingGame)) {
            if (!championshipData[year]) {
                championshipData[year] = {
                    champion: null, secondPlace: null, thirdPlace: null, fourthPlace: null,
                    winnerScore: null, loserScore: null,
                    games: []
                };
            }
            championshipData[year].games.push({
                week: week,
                team1: team1, team2: team2,
                team1Score: team1Score, team2Score: team2Score,
                winner: team1Won ? team1 : (team2Won ? team2 : 'Tie'),
                loser: team1Won ? team2 : (team2Won ? team1 : 'Tie'),
                winnerScore: team1Won ? team1Score : (team2Won ? team2Score : team1Score),
                loserScore: team1Won ? team2Score : (team2Won ? team1Score : team2Score),
                winnerPlace: team1Won ? match.finalSeedingGame : (team2Won ? match.finalSeedingGame : match.finalSeedingGame), // Place for the winner/participants
                loserPlace: team1Won ? match.finalSeedingGame + 1 : (team2Won ? match.finalSeedingGame + 1 : match.finalSeedingGame + 1), // Place for the loser
            });
        }
    });


    // --- Second Pass: Calculate derived metrics (DPR, All-Play, Luck, Finishes) ---
    const allYears = Object.keys(seasonalTeamStats).map(Number).sort((a, b) => a - b);
    const careerDPRData = [];

    // Process each year for seasonal metrics
    allYears.forEach(year => {
        const currentYearTeams = Object.keys(seasonalTeamStats[year]);
        const leagueMaxScore = seasonLeagueScores[year].allGameScores.length > 0 ? Math.max(...seasonLeagueScores[year].allGameScores) : 0;
        const leagueMinScore = seasonLeagueScores[year].allGameScores.length > 0 ? Math.min(...seasonLeagueScores[year].allGameScores) : 0;

        let totalRawDPRThisSeason = 0;
        let teamsWithValidSeasonalDPR = 0;
        const seasonalDPRsForNormalization = {}; // { team: rawDPR }

        currentYearTeams.forEach(team => {
            const stats = seasonalTeamStats[year][team];
            if (stats.totalGames > 0) {
                const teamWinPercentage = (stats.wins + 0.5 * stats.ties) / stats.totalGames;
                stats.winPercentage = teamWinPercentage; // Store for direct access

                const rawDPR = calculateRawDPR(
                    stats.pointsFor,
                    teamWinPercentage,
                    leagueMaxScore,
                    leagueMinScore
                );
                seasonalDPRsForNormalization[team] = rawDPR;

                if (!isNaN(rawDPR)) {
                    totalRawDPRThisSeason += rawDPR;
                    teamsWithValidSeasonalDPR++;
                }

                // Calculate All-Play Win Percentage for the season
                let allPlayWinsSeason = 0;
                let allPlayTiesSeason = 0;
                let allPlayGamesSeason = 0;

                Object.keys(seasonLeagueScores[year].weeklyScores).forEach(week => {
                    const weeklyScores = seasonLeagueScores[year].weeklyScores[week];
                    const teamScoreInWeek = weeklyScores.find(entry => entry.team === team)?.score;

                    if (teamScoreInWeek !== undefined) {
                        const otherScoresInWeek = weeklyScores.filter(entry => entry.team !== team);
                        allPlayGamesSeason += otherScoresInWeek.length; // Number of 'games' played in all-play format
                        otherScoresInWeek.forEach(otherTeam => {
                            if (teamScoreInWeek > otherTeam.score) {
                                allPlayWinsSeason++;
                            } else if (teamScoreInWeek === otherTeam.score) {
                                allPlayTiesSeason++;
                            }
                        });
                    }
                });

                stats.allPlayWins = allPlayWinsSeason;
                stats.allPlayTies = allPlayTiesSeason; // Storing ties for completeness
                stats.allPlayGames = allPlayGamesSeason; // Storing total games for completeness
                stats.allPlayWinPercentage = allPlayGamesSeason > 0 ? (allPlayWinsSeason + 0.5 * allPlayTiesSeason) / allPlayGamesSeason : 0;


                // Calculate Luck Rating
                const { luckRating, actualWins, projectedWins } = calculateLuckRating(
                    historicalMatchups,
                    team,
                    year,
                    seasonLeagueScores[year].weeklyScores,
                    getDisplayTeamName
                );
                stats.luckRating = luckRating;
                stats.projectedWins = projectedWins; // Store projected wins directly in seasonalMetrics
                // stats.wins is already correctly populated from the first pass, no need to re-assign
                // stats.wins = actualWins; // Removed this line

            } else {
                seasonalDPRsForNormalization[team] = 0; // No games played, raw DPR is 0
                stats.winPercentage = 0;
                stats.allPlayWinPercentage = 0;
                stats.luckRating = 0;
                stats.projectedWins = 0;
            }
        });

        const avgRawDPRThisSeason = teamsWithValidSeasonalDPR > 0 ? totalRawDPRThisSeason / teamsWithValidSeasonalDPR : 0;

        // Normalize seasonal DPRs and determine finish based on adjusted DPR
        const teamsSortedByDPR = currentYearTeams
            .map(team => ({
                team,
                dpr: seasonalDPRsForNormalization[team],
                adjustedDPR: avgRawDPRThisSeason > 0 ? seasonalDPRsForNormalization[team] / avgRawDPRThisSeason : 0
            }))
            .sort((a, b) => b.adjustedDPR - a.adjustedDPR); // Sort by adjusted DPR descending

        teamsSortedByDPR.forEach((teamEntry, index) => {
            seasonalTeamStats[year][teamEntry.team].adjustedDPR = teamEntry.adjustedDPR;
            seasonalTeamStats[year][teamEntry.team].finish = index + 1; // Assign rank as finish
        });
    });

    // --- Process Career DPR for normalization ---
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => { // Filter out empty teams
        const stats = careerTeamStatsRaw[team];
        if (stats.totalGames === 0) { // Skip teams with no games
            stats.rawDPR = 0;
            return;
        }

        const careerWinPercentage = (stats.wins + 0.5 * stats.ties) / stats.totalGames;
        const teamMaxScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
        const teamMinScoreOverall = stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

        // For career DPR, we use the team's *own* career max/min scores, not league-wide
        const rawDPR = calculateRawDPR(stats.totalPointsFor, careerWinPercentage, teamMaxScoreOverall, teamMinScoreOverall);
        stats.rawDPR = rawDPR; // Store raw DPR temporarily

        if (!isNaN(rawDPR)) {
            totalRawDPROverall += rawDPR;
            teamsWithValidCareerDPR++;
        }
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;

    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => { // Filter out empty teams
        const stats = careerTeamStatsRaw[team];
        const adjustedDPR = avgRawDPROverall > 0 ? stats.rawDPR / avgRawDPROverall : 0;
        careerDPRData.push({
            team,
            dpr: adjustedDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            pointsAgainst: stats.totalPointsAgainst, // Include pointsAgainst here
            winPercentage: (stats.wins + 0.5 * stats.ties) / stats.totalGames,
            totalGames: stats.totalGames
            // You might want to add career all-play win percentage, etc. here later if needed
        });
    });


    // --- Process Championship Data (to determine champions/runner-ups from finalSeedingGame) ---
    Object.keys(championshipData).forEach(year => {
        // Sort games for the year by their 'finalSeedingGame' value to determine 1st, 3rd, etc.
        const sortedGames = championshipData[year].games.sort((a, b) => a.winnerPlace - b.winnerPlace);

        // Assuming finalSeedingGame=1 is Championship, 3 is 3rd place, etc.
        sortedGames.forEach(game => {
            if (game.winnerPlace === 1) {
                championshipData[year].champion = game.winner;
                championshipData[year].secondPlace = game.loser;
                championshipData[year].winnerScore = game.winnerScore;
                championshipData[year].loserScore = game.loserScore;
            } else if (game.winnerPlace === 3) {
                championshipData[year].thirdPlace = game.winner;
                championshipData[year].fourthPlace = game.loser;
            }
            // Can add more conditions for 5th, 7th etc. if desired
        });

        // Update career stats for playoff appearances and championships
        const championTeam = championshipData[year].champion;
        const secondPlaceTeam = championshipData[year].secondPlace;

        if (championTeam && careerTeamStatsRaw[championTeam]) {
            careerTeamStatsRaw[championTeam].championships++;
            careerTeamStatsRaw[championTeam].playoffAppearances.add(year); // Add year to set
        }
        if (secondPlaceTeam && careerTeamStatsRaw[secondPlaceTeam]) {
            careerTeamStatsRaw[secondPlaceTeam].playoffAppearances.add(year); // Add year to set
        }

        // Also update playoff appearances for all teams involved in final seeding games
        championshipData[year].games.forEach(game => {
            if (careerTeamStatsRaw[game.team1]) careerTeamStatsRaw[game.team1].playoffAppearances.add(year);
            if (careerTeamStatsRaw[game.team2]) careerTeamStatsRaw[game.team2].playoffAppearances.add(year);
        });
    });


    return {
        seasonalMetrics: seasonalTeamStats,
        careerDPRData: careerDPRData.sort((a, b) => b.dpr - a.dpr), // Ensure career DPR is sorted
        championshipData: championshipData, // Include championship data
        careerStats: careerTeamStatsRaw // Include full career stats for other records
    };
};
