// src/utils/calculations.js

/**
 * Helper function to calculate raw DPR for a team in a season.
 * @param {number} pointsFor - Average of seasonal average points scored for career DPR, or total points for seasonal DPR.
 * @param {number} teamWinPercentage - Win percentage of the team in the season/career.
 * @param {number} leagueMaxScore - Highest single-game score in the season for seasonal DPR, or highest season average for career DPR.
 * @param {number} leagueMinScore - Lowest single-game score in the season for seasonal DPR, or lowest season average for career DPR.
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
                    // Ensure the other team is not empty and not the current team
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

## calculateAllLeagueMetrics Function

```javascript
/**
 * Calculates all league-wide and team-specific metrics (DPR, Luck Rating, All-Play)
 * for all seasons based on historical matchup data.
 * @param {Array<Object>} historicalMatchups - The raw historical matchup data.
 * @param {Function} getMappedTeamName - Function to get mapped team names.
 * @returns {{seasonalMetrics: Object, careerDPRData: Array}}
 * seasonalMetrics: { year: { teamName: { wins, losses, ties, pointsFor, pointsAgainst, adjustedDPR, luckRating, allPlayWinPercentage } } }
 * careerDPRData: Array of { team, dpr, wins, losses, ties, pointsFor, pointsAgainst }
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getMappedTeamName) => {
    const seasonalTeamStatsRaw = {}; // { year: { teamName: { totalPointsFor, totalPointsAgainst, wins, losses, ties, totalGames, weeklyScores: [] } } }
    const allLeagueScoresByYear = {}; // { year: [score1, score2, ...] }
    const weeklyGameScoresByYearAndWeek = {}; // { year: { week: [{ team: 'TeamA', score: 100 }, ...] } }
    const careerTeamStatsRaw = {}; // { teamName: { totalPointsFor, totalPointsAgainst, wins, losses, ties, totalGames, careerWeeklyScores: [], seasonalAverageScores: {} } }

    historicalMatchups.forEach(match => {
        const displayTeam1 = getMappedTeamName(String(match?.team1 || '').trim());
        const displayTeam2 = getMappedTeamName(String(match?.team2 || '').trim());
        const year = parseInt(match?.year || '0');
        const week = parseInt(match?.week || '0');
        const team1Score = parseFloat(match?.team1Score || '0');
        const team2Score = parseFloat(match?.team2Score || '0');

        // IMPORTANT: Filter out invalid data or empty team names
        if (isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score) || (displayTeam1 === '' && displayTeam2 === '')) {
            return;
        }

        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;

        // Points and weekly scores are always populated for valid matches, regardless of bye status
        if (displayTeam1 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam1]) {
                seasonalTeamStatsRaw[year][displayTeam1] = {
                    totalPointsFor: 0, totalPointsAgainst: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, weeklyScores: []
                };
            }
            seasonalTeamStatsRaw[year][displayTeam1].totalPointsFor += team1Score;
            seasonalTeamStatsRaw[year][displayTeam1].totalPointsAgainst += team2Score; // Points against for Team 1
            seasonalTeamStatsRaw[year][displayTeam1].weeklyScores.push(team1Score); // Store weekly score for seasonal average

            if (!careerTeamStatsRaw[displayTeam1]) {
                careerTeamStatsRaw[displayTeam1] = {
                    totalPointsFor: 0, totalPointsAgainst: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: [], seasonalAverageScores: {}
                };
            }
            careerTeamStatsRaw[displayTeam1].totalPointsFor += team1Score;
            careerTeamStatsRaw[displayTeam1].totalPointsAgainst += team2Score; // Points against for Team 1
            careerTeamStatsRaw[displayTeam1].careerWeeklyScores.push(team1Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam1, score: team1Score });

            if (!allLeagueScoresByYear[year]) allLeagueScoresByYear[year] = [];
            allLeagueScoresByYear[year].push(team1Score);
        }

        if (displayTeam2 !== '') {
            if (!seasonalTeamStatsRaw[year]) seasonalTeamStatsRaw[year] = {};
            if (!seasonalTeamStatsRaw[year][displayTeam2]) {
                seasonalTeamStatsRaw[year][displayTeam2] = {
                    totalPointsFor: 0, totalPointsAgainst: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, weeklyScores: []
                };
            }
            seasonalTeamStatsRaw[year][displayTeam2].totalPointsFor += team2Score;
            seasonalTeamStatsRaw[year][displayTeam2].totalPointsAgainst += team1Score; // Points against for Team 2
            seasonalTeamStatsRaw[year][displayTeam2].weeklyScores.push(team2Score); // Store weekly score for seasonal average

            if (!careerTeamStatsRaw[displayTeam2]) {
                careerTeamStatsRaw[displayTeam2] = {
                    totalPointsFor: 0, totalPointsAgainst: 0, wins: 0, losses: 0, ties: 0, totalGames: 0, careerWeeklyScores: [], seasonalAverageScores: {}
                };
            }
            careerTeamStatsRaw[displayTeam2].totalPointsFor += team2Score;
            careerTeamStatsRaw[displayTeam2].totalPointsAgainst += team1Score; // Points against for Team 2
            careerTeamStatsRaw[displayTeam2].careerWeeklyScores.push(team2Score);

            if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
            if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
            weeklyGameScoresByYearAndWeek[year][week].push({ team: displayTeam2, score: team2Score });

            if (!allLeagueScoresByYear[year]) allLeagueScoresByYear[year] = [];
            allLeagueScoresByYear[year].push(team2Score);
        }

        // Only update win/loss/tie records and totalGames if it's NOT a PointsOnlyBye
        if (!(match.pointsOnlyBye === true || match.pointsOnlyBye === 'true')) {
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
                } else if (!team1Won) { // Team 2 won if team1 didn't and it wasn't a tie
                    seasonalTeamStatsRaw[year][displayTeam2].wins++;
                    careerTeamStatsRaw[displayTeam2].wins++;
                } else {
                    seasonalTeamStatsRaw[year][displayTeam2].losses++;
                    careerTeamStatsRaw[displayTeam2].losses++;
                }
            }
        }
    });

    // Populate seasonalAverageScores for each team
    Object.keys(seasonalTeamStatsRaw).forEach(year => {
        Object.keys(seasonalTeamStatsRaw[year]).forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];
            if (stats.weeklyScores.length > 0) {
                const seasonalAverage = stats.weeklyScores.reduce((sum, score) => sum + score, 0) / stats.weeklyScores.length;
                careerTeamStatsRaw[team].seasonalAverageScores[year] = seasonalAverage;
            }
        });
    });


    const seasonalMetrics = {}; // Final output structure for seasonal data
    const leagueSeasonalAverageRawDPRs = []; // Stores the average raw DPR for each season

    // --- Calculate Seasonal DPR, Luck Rating, All-Play ---
    Object.keys(seasonalTeamStatsRaw).sort().forEach(year => {
        seasonalMetrics[year] = {};
        const teamsInSeason = Object.keys(seasonalTeamStatsRaw[year]).filter(team => team !== ''); // Filter out empty teams

        const leagueScoresForYear = allLeagueScoresByYear[year] || [];
        const leagueMaxScoreInSeason = leagueScoresForYear.length > 0 ? Math.max(...leagueScoresForYear) : 0;
        const leagueMinScoreInSeason = leagueScoresForYear.length > 0 ? Math.min(...leagueScoresForYear) : 0;

        let totalRawDPRForSeason = 0;
        let teamsCountForDPR = 0;

        // First pass for raw DPR to calculate average raw DPR for the season
        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];
            // Ensure totalGames is not 0 before calculating win percentage
            const teamWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;
            const rawDPR = calculateRawDPR(stats.totalPointsFor, teamWinPercentage, leagueMaxScoreInSeason, leagueMinScoreInSeason);
            stats.rawDPR = rawDPR; // Store raw DPR temporarily

            if (!isNaN(rawDPR)) {
                totalRawDPRForSeason += rawDPR;
                teamsCountForDPR++;
            }
        });

        const avgRawDPRForSeason = teamsCountForDPR > 0 ? totalRawDPRForSeason / teamsCountForDPR : 0;
        if (avgRawDPRForSeason > 0) { // Only add if there were teams with valid DPR for that season
            leagueSeasonalAverageRawDPRs.push(avgRawDPRForSeason);
        }

        // Second pass for adjusted DPR, Luck Rating, and All-Play
        teamsInSeason.forEach(team => {
            const stats = seasonalTeamStatsRaw[year][team];
            if (stats.totalGames === 0) { // If a team had only bye weeks, their totalGames would be 0
                seasonalMetrics[year][team] = {
                    wins: stats.wins,
                    losses: stats.losses,
                    ties: stats.ties,
                    pointsFor: stats.totalPointsFor,
                    pointsAgainst: stats.totalPointsAgainst, // Include pointsAgainst here
                    adjustedDPR: 0, // No adjusted DPR if no games played
                    luckRating: 0,  // No luck rating if no games played
                    allPlayWinPercentage: 0, // No all-play if no games played
                };
                return;
            }

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
                pointsAgainst: stats.totalPointsAgainst, // Include pointsAgainst here
                adjustedDPR: adjustedDPR,
                luckRating: luckRating,
                allPlayWinPercentage: allPlayWinPercentage,
            };
        });
    });

    // --- Calculate Career DPR ---
    const careerDPRData = [];

    // Calculate the "Average Raw DPR of all teams in the league (career)" by averaging seasonal averages
    const avgRawDPROverall = leagueSeasonalAverageRawDPRs.length > 0
        ? leagueSeasonalAverageRawDPRs.reduce((sum, avg) => sum + avg, 0) / leagueSeasonalAverageRawDPRs.length
        : 0;

    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => { // Filter out empty teams
        const stats = careerTeamStatsRaw[team];
        if (stats.totalGames === 0) { // If a team has 0 total games over career (only bye weeks or no games)
            return;
        }

        const careerWinPercentage = (stats.wins + 0.5 * stats.ties) / stats.totalGames;

        const teamSeasonalAverages = Object.values(stats.seasonalAverageScores);

        // Find the highest seasonal average score for the team across their career
        const highestSeasonAverageScore = teamSeasonalAverages.length > 0
            ? Math.max(...teamSeasonalAverages)
            : 0;

        // Find the lowest seasonal average score for the team across their career
        const lowestSeasonAverageScore = teamSeasonalAverages.length > 0
            ? Math.min(...teamSeasonalAverages)
            : 0;

        // Calculate the average of the seasonal average scores for the team
        const averageOfSeasonalAverages = teamSeasonalAverages.length > 0
            ? teamSeasonalAverages.reduce((sum, avg) => sum + avg, 0) / teamSeasonalAverages.length
            : 0;

        // For career DPR, use the AVERAGE OF SEASONAL AVERAGES for the pointsFor component
        const rawDPR = calculateRawDPR(averageOfSeasonalAverages, careerWinPercentage, highestSeasonAverageScore, lowestSeasonAverageScore);
        stats.rawDPR = rawDPR; // Store raw DPR temporarily

        const adjustedDPR = avgRawDPROverall > 0 ? rawDPR / avgRawDPROverall : 0;
        careerDPRData.push({
            team,
            dpr: adjustedDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor, // This remains total for display, but DPR uses the average of averages
            pointsAgainst: stats.totalPointsAgainst // Include pointsAgainst here
        });
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr); // Sort career DPR descending

    return { seasonalMetrics, careerDPRData, weeklyGameScoresByYearAndWeek };
};
