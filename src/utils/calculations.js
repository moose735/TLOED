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

            // If the selected team isn't in this week's data, skip.
            // This is a quick check, detailed check below with relevantMatchupsForWeek
            const uniqueTeamsWithScores = new Set(allScoresInCurrentWeek
                .filter(entry => typeof entry.score === 'number' && !isNaN(entry.score) && entry.team !== '') // Ensure valid team name
                .map(entry => entry.team)
            );
            if (!uniqueTeamsWithScores.has(teamName)) return;

            // Explicitly filter for regular season matches in this specific week and year
            const relevantMatchupsForWeek = historicalMatchups.filter(m =>
                parseInt(m?.year || '0') === parseInt(year) &&
                parseInt(m?.week || '0') === parseInt(week) &&
                (m?.regSeason === true || m?.regSeason === 'true') && // Only regular season games
                !(m?.pointsOnlyBye === true || m?.pointsOnlyBye === 'true') // Exclude points-only-bye
            );

            if (relevantMatchupsForWeek.length === 0) return;

            const currentTeamMatchEntry = relevantMatchupsForWeek.find(match => {
                const matchTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
                const matchTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
                return (matchTeam1 === teamName && matchTeam1 !== '') || (matchTeam2 === teamName && matchTeam2 !== ''); // Ensure team name is not empty
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
                return; // Should not happen if currentTeamMatchEntry was found correctly
            }

            if (isNaN(currentTeamScoreForWeek)) return;

            let outscoredCount = 0;
            let oneLessCount = 0;

            allScoresInCurrentWeek.forEach(otherTeamEntry => {
                // Ensure the other team is not empty and not the current team, and has a valid score
                if (otherTeamEntry.team !== teamName && otherTeamEntry.team !== '' && typeof otherTeamEntry.score === 'number' && !isNaN(otherTeamEntry.score)) {
                    if (currentTeamScoreForWeek > otherTeamEntry.score) {
                        outscoredCount++;
                    }
                    if (currentTeamScoreForWeek - 1 === otherTeamEntry.score) {
                        oneLessCount++;
                    }
                }
            });

            // Fixed denominators as per Excel formula
            const denominatorX = 11; // Assumes 12-team league, so 11 opponents
            const denominatorY = 22; // Assumes 11 opponents * 2 (for win + 1 point less)

            const weeklyProjectedWinComponentX = denominatorX > 0 ? (outscoredCount / denominatorX) : 0;
            const weeklyLuckScorePartY = denominatorY > 0 ? (oneLessCount / denominatorY) : 0;

            const combinedWeeklyLuckScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
            totalWeeklyLuckScoreSum += combinedWeeklyLuckScore;
        });
    }

    let actualRegularSeasonWins = 0;
    // Get actual regular season wins for the specific team for this year
    historicalMatchups.forEach(match => {
        if (!(match?.regSeason === true || match?.regSeason === 'true') || parseInt(match?.year || '0') !== year) return;

        const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());

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

    return actualRegularSeasonWins - totalWeeklyLuckScoreSum;
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
    // Note: seasonalTeamStats will store the final processed seasonal metrics
    const seasonalTeamStats = {}; // { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, totalGames, weeklyScores: [], allPlayWins: 0, allPlayGames: 0, luckRating: null, adjustedDPR: null, finish: null, weeklyHighScores: 0, weeklyTop2Scores: 0, weeklyTop3Scores: 0, projectedWins: 0 } } }
    const careerTeamStatsRaw = {}; // { teamName: { wins, losses, ties, totalPointsFor, totalPointsAgainst, totalGames, careerWeeklyScores: [], championships: 0, playoffAppearances: Set<year>, highestScore: {value, year, week, matchup}, lowestScore: {value: Infinity, year, week, matchup} } }
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

        // Crucial check: Ensure scores are numbers before proceeding
        if (isNaN(team1Score) || isNaN(team2Score)) {
            // console.warn(`Skipping matchup due to invalid scores for year ${year}, week ${week}:`, match);
            return;
        }

        // Initialize structures for year, teams if they don't exist
        if (!seasonalTeamStats[year]) seasonalTeamStats[year] = {};
        if (!seasonLeagueScores[year]) seasonLeagueScores[year] = { allGameScores: [], weeklyScores: {} };
        if (!seasonLeagueScores[year].weeklyScores[week]) seasonLeagueScores[year].weeklyScores[week] = [];

        // Helper to initialize team stats if they don't exist for the current year or career
        const initializeTeamStats = (teamName) => {
            if (teamName && teamName !== '') {
                if (!seasonalTeamStats[year][teamName]) {
                    seasonalTeamStats[year][teamName] = {
                        wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, totalGames: 0,
                        weeklyScores: [], allPlayWins: 0, allPlayGames: 0, luckRating: null, adjustedDPR: null, finish: null,
                        weeklyHighScores: 0, weeklyTop2Scores: 0, weeklyTop3Scores: 0, projectedWins: 0
                    };
                }
                if (!careerTeamStatsRaw[teamName]) {
                    careerTeamStatsRaw[teamName] = {
                        wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0,
                        careerWeeklyScores: [], championships: 0, playoffAppearances: new Set(),
                        highestScore: { value: 0, matchup: null, year: null, week: null },
                        lowestScore: { value: Infinity, matchup: null, year: null, week: null },
                    };
                }
            }
        };

        initializeTeamStats(team1);
        initializeTeamStats(team2);

        // Update pointsFor and weeklyScores for both teams
        if (team1 && team1 !== '') {
            const team1SeasonStats = seasonalTeamStats[year][team1];
            const team1CareerStats = careerTeamStatsRaw[team1];

            team1SeasonStats.pointsFor += team1Score;
            team1SeasonStats.weeklyScores.push(team1Score);
            team1CareerStats.totalPointsFor += team1Score;
            team1CareerStats.careerWeeklyScores.push(team1Score);

            if (team1Score > team1CareerStats.highestScore.value) {
                team1CareerStats.highestScore = { value: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week };
            }
            if (team1Score < team1CareerStats.lowestScore.value) {
                team1CareerStats.lowestScore = { value: team1Score, matchup: `${team1} vs ${team2}`, year: year, week: week };
            }

            seasonLeagueScores[year].weeklyScores[week].push({ team: team1, score: team1Score });
        }

        if (team2 && team2 !== '') {
            const team2SeasonStats = seasonalTeamStats[year][team2];
            const team2CareerStats = careerTeamStatsRaw[team2];

            team2SeasonStats.pointsFor += team2Score;
            team2SeasonStats.weeklyScores.push(team2Score);
            team2CareerStats.totalPointsFor += team2Score;
            team2CareerStats.careerWeeklyScores.push(team2Score);

            if (team2Score > team2CareerStats.highestScore.value) {
                team2CareerStats.highestScore = { value: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week };
            }
            if (team2Score < team2CareerStats.lowestScore.value) {
                team2CareerStats.lowestScore = { value: team2Score, matchup: `${team2} vs ${team1}`, year: year, week: week };
            }

            seasonLeagueScores[year].weeklyScores[week].push({ team: team2, score: team2Score });
        }

        // Handle head-to-head win/loss/tie records, totalGames, and points against
        // This block executes if both team names are valid and non-empty
        if (team1 && team2 && team1 !== '' && team2 !== '') {
            const team1SeasonStats = seasonalTeamStats[year][team1];
            const team2SeasonStats = seasonalTeamStats[year][team2];
            const team1CareerStats = careerTeamStatsRaw[team1];
            const team2CareerStats = careerTeamStatsRaw[team2];

            const isTie = team1Score === team2Score;
            const team1Won = team1Score > team2Score;
            // No need for team2Won, as it's the opposite of team1Won if not a tie

            // Update points against regardless of regSeason or pointsOnlyBye, as it's a raw stat
            team1SeasonStats.pointsAgainst += team2Score;
            team2SeasonStats.pointsAgainst += team1Score;
            team1CareerStats.totalPointsAgainst += team2Score;
            team2CareerStats.totalPointsAgainst += team1Score;

            // Only update win/loss/tie records and totalGames if it's a regular season game and not a points-only-bye
            if ((match.regSeason === true || match.regSeason === 'true') && !(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
                team1SeasonStats.totalGames++;
                team2SeasonStats.totalGames++;
                team1CareerStats.totalGames++;
                team2CareerStats.totalGames++;

                if (isTie) {
                    team1SeasonStats.ties++;
                    team2SeasonStats.ties++;
                    team1CareerStats.ties++;
                    team2CareerStats.ties++;
                } else if (team1Won) {
                    team1SeasonStats.wins++;
                    team2SeasonStats.losses++;
                    team1CareerStats.wins++;
                    team2CareerStats.losses++;
                } else { // team2Won
                    team1SeasonStats.losses++;
                    team2SeasonStats.wins++;
                    team1CareerStats.losses++;
                    team2CareerStats.wins++;
                }
            } else {
                console.warn(`Skipping W-L-T and total games for non-regular season or points-only-bye matchup:`, match);
            }
        } else {
            console.warn(`Skipping head-to-head stats (W-L-T, totalGames, pointsAgainst) for incomplete matchup (missing team name):`, match);
        }

        // Aggregate all game scores for league-wide min/max (used by DPR)
        seasonLeagueScores[year].allGameScores.push(team1Score, team2Score);

        // Process final seeding games for champions
        if (match.finalSeedingGame !== undefined && match.finalSeedingGame !== null && !isNaN(match.finalSeedingGame)) {
            if (!championshipData[year]) {
                championshipData[year] = {
                    champion: null, secondPlace: null, thirdPlace: null, fourthPlace: null,
                    winnerScore: null, loserScore: null,
                    games: []
                };
            }
            const matchWinner = team1Score > team2Score ? team1 : (team2Score > team1Score ? team2 : 'Tie');
            const matchLoser = team1Score > team2Score ? team2 : (team2Score > team1Score ? team1 : 'Tie');

            championshipData[year].games.push({
                week: week,
                team1: team1, team2: team2,
                team1Score: team1Score, team2Score: team2Score,
                winner: matchWinner,
                loser: matchLoser,
                winnerScore: matchWinner === team1 ? team1Score : team2Score,
                loserScore: matchLoser === team1 ? team1Score : team2Score,
                winnerPlace: match.finalSeedingGame, // Place for the winner/participants
                loserPlace: match.finalSeedingGame + 1, // Place for the loser
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


                // Calculate Luck Rating - this now returns a single number
                const luckRatingValue = calculateLuckRating(
                    historicalMatchups,
                    team,
                    year,
                    seasonLeagueScores[year].weeklyScores,
                    getDisplayTeamName // Pass getDisplayTeamName as getMappedTeamName
                );
                stats.luckRating = luckRatingValue;
                // Projected wins are not directly returned by the calculateLuckRating function
                // in its current (user-requested) format, so it will remain 0 here.
                stats.projectedWins = 0; // Explicitly set to 0 if not returned by luck calc


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
