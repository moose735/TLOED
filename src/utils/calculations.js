// src/utils/calculations.js

/**
 * Helper function to calculate raw DPR (Dominance Power Ranking) for a team in a given context (season or career).
 * DPR is a custom metric intended to quantify a team's overall strength based on points scored, win percentage,
 * and their performance relative to the league's highest and lowest weekly scores.
 *
 * The formula used is:
 * ((Points Scored * 6) + ((League Max Score + League Min Score) * 2) + ((Win% * 200) * 2)) / 10
 *
 * @param {number} pointsFor - Total points scored by the team in the defined period (season or career).
 * @param {number} teamWinPercentage - Win percentage of the team in the defined period (decimal, e.g., 0.75 for 75%).
 * @param {number} leagueMaxScore - The highest single-game score recorded in the league within the relevant scope (e.g., season-wide max for seasonal DPR, or overall max for career DPR).
 * @param {number} leagueMinScore - The lowest single-game score recorded in the league within the relevant scope.
 * @returns {number} The raw Dominance Power Ranking (DPR) value. Returns 0 if inputs are invalid or lead to division by zero (though current formula avoids this directly).
 */
export const calculateRawDPR = (pointsFor, teamWinPercentage, leagueMaxScore, leagueMinScore) => {
    // Input validation to ensure numerical and non-negative values where expected
    if (typeof pointsFor !== 'number' || isNaN(pointsFor) || pointsFor < 0) {
        console.warn('Invalid pointsFor in calculateRawDPR:', pointsFor);
        return 0;
    }
    if (typeof teamWinPercentage !== 'number' || isNaN(teamWinPercentage) || teamWinPercentage < 0 || teamWinPercentage > 1) {
        console.warn('Invalid teamWinPercentage in calculateRawDPR:', teamWinPercentage);
        return 0;
    }
    if (typeof leagueMaxScore !== 'number' || isNaN(leagueMaxScore) || leagueMaxScore < 0) {
        console.warn('Invalid leagueMaxScore in calculateRawDPR:', leagueMaxScore);
        return 0;
    }
    if (typeof leagueMinScore !== 'number' || isNaN(leagueMinScore) || leagueMinScore < 0) {
        console.warn('Invalid leagueMinScore in calculateRawDPR:', leagueMinScore);
        return 0;
    }

    // Components of the DPR formula
    const pointsScoredComponent = pointsFor * 6;
    const maxMinComponent = (leagueMaxScore + leagueMinScore) * 2;
    const winPercentageComponent = (teamWinPercentage * 200) * 2; // Win percentage scaled to 0-200 and then doubled

    const rawDPR = (pointsScoredComponent + maxMinComponent + winPercentageComponent) / 10;
    return rawDPR;
};

/**
 * Helper function to calculate a team's Luck Rating for a specific year.
 * Luck Rating attempts to quantify how much a team's actual wins deviate from their "expected" wins,
 * where expected wins are based on how many games they would have won if they played against every other team's score in that week (All-Play).
 * A positive luck rating suggests "good luck" (winning more than expected), a negative rating suggests "bad luck".
 *
 * @param {Array<Object>} historicalMatchups - All historical matchup data for the league. Each object should have properties like `year`, `week`, `team1`, `team1Score`, `team2`, `team2Score`.
 * @param {string} teamName - The display name of the team for which to calculate the luck rating.
 * @param {number} year - The specific year for which the luck rating is to be calculated.
 * @param {Object} weeklyGameScoresByYearAndWeek - An object structured as `{ [year]: { [week]: [{ team: string, score: number }] } }`, containing all game scores for all teams per week. This is pre-calculated for efficiency.
 * @returns {number} The calculated Luck Rating for the team in the specified year. Returns 0 if data is insufficient or invalid.
 */
export const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek) => {
    if (!historicalMatchups || historicalMatchups.length === 0 || !teamName || !year || !weeklyGameScoresByYearAndWeek) {
        console.warn("Missing data for calculateLuckRating.");
        return 0;
    }

    let actualWins = 0;
    let actualLosses = 0;
    let actualTies = 0;
    let allPlayWins = 0;
    let allPlayLosses = 0;
    let allPlayTies = 0;
    let gamesPlayed = 0;

    const teamGamesInYear = historicalMatchups.filter(
        match => parseInt(match.year) === year && (match.team1 === teamName || match.team2 === teamName)
    );

    teamGamesInYear.forEach(match => {
        const currentTeamScore = match.team1 === teamName ? parseFloat(match.team1Score) : parseFloat(match.team2Score);
        const opponentScore = match.team1 === teamName ? parseFloat(match.team2Score) : parseFloat(match.team1Score);
        const week = parseInt(match.week);

        if (isNaN(currentTeamScore) || isNaN(opponentScore) || isNaN(week)) {
            console.warn(`Skipping invalid score or week in match for ${teamName}, year ${year}:`, match);
            return;
        }

        gamesPlayed++;

        // Calculate actual wins/losses/ties
        if (currentTeamScore > opponentScore) {
            actualWins++;
        } else if (currentTeamScore < opponentScore) {
            actualLosses++;
        } else {
            actualTies++;
        }

        // Calculate All-Play wins/losses/ties for the current week
        const scoresInThisWeek = weeklyGameScoresByYearAndWeek[year]?.[week];

        if (scoresInThisWeek && scoresInThisWeek.length > 1) { // Need at least two teams to compare
            scoresInThisWeek.forEach(weeklyGame => {
                if (weeklyGame.team !== teamName) { // Don't compare a team against itself
                    if (currentTeamScore > weeklyGame.score) {
                        allPlayWins++;
                    } else if (currentTeamScore < weeklyGame.score) {
                        allPlayLosses++;
                    } else {
                        allPlayTies++;
                    }
                }
            });
        }
    });

    if (gamesPlayed === 0) {
        return 0; // No games played for this team in this year
    }

    // The total number of 'all-play' matchups is gamesPlayed * (totalTeamsInWeek - 1) * 2 (as each game is a comparison)
    // A simpler way: it's the sum of comparisons the team made against every *other* score in each week.
    // So, if there are N teams, and a team plays W weeks, in each week it compares against N-1 other scores.
    // totalAllPlayGames = number of weeks played * (total teams in that week - 1)
    let totalAllPlayGames = 0;
    if (weeklyGameScoresByYearAndWeek[year]) {
        Object.keys(weeklyGameScoresByYearAndWeek[year]).forEach(week => {
            const numTeamsInWeek = weeklyGameScoresByYearAndWeek[year][week]?.length || 0;
            if (numTeamsInWeek > 1) { // Must have other teams to compare against
                totalAllPlayGames += (numTeamsInWeek - 1);
            }
        });
    }

    if (totalAllPlayGames === 0) {
        console.warn(`Insufficient all-play comparison data for ${teamName} in year ${year}.`);
        return 0;
    }

    // Projected wins are based on all-play win percentage applied to actual games played
    const projectedWins = (allPlayWins + 0.5 * allPlayTies) / totalAllPlayGames * gamesPlayed;

    // Luck Rating: Actual Wins - Projected Wins. Higher value means more "lucky".
    const luckRating = actualWins - projectedWins;

    // Return an object including projectedWins as it's often displayed alongside luck rating
    return luckRating;
};


/**
 * Calculates various league-wide and team-specific metrics across all historical matchups.
 * This is the central aggregation function that processes raw game data into structured statistics.
 *
 * @param {Array<Object>} historicalMatchups - An array of raw historical matchup objects from the data source.
 * Each object is expected to have:
 * - `year`: string (e.g., "2023")
 * - `week`: string (e.g., "1")
 * - `team1`: string (raw team ID/name)
 * - `team1Score`: string (score for team 1)
 * - `team2`: string (raw team ID/name)
 * - `team2Score`: string (score for team 2)
 * - `playoffs`: boolean (true if playoff game)
 * - `finalSeedingGame`: number | null (e.g., 1 for championship, 3 for 3rd place, etc.)
 * @param {Function} getDisplayTeamName - A callback function that takes a raw team name/ID and returns its display name.
 * This ensures consistent team naming throughout the application.
 * @returns {{
 * seasonalMetrics: Object<string, Object<string, Object>>,
 * careerDPRData: Array<Object>,
 * allTimeLeagueMaxScore: number,
 * allTimeLeagueMinScore: number,
 * historicalChampions: Object<string, string>,
 * teamsByYear: Object<string, Array<string>>
 * }} An object containing all calculated metrics:
 * - `seasonalMetrics`: Nested object `{ [year]: { [teamName]: { ...stats for that team in that year... } } }`.
 * Includes: `wins`, `losses`, `ties`, `pointsFor`, `pointsAgainst`, `totalGames`, `winPercentage`, `allPlayWinPercentage`,
 * `rawDPR`, `adjustedDPR`, `luckRating`, `weeklyScores`.
 * - `careerDPRData`: An array of objects, each containing a team's career DPR and associated stats.
 * - `allTimeLeagueMaxScore`: The single highest score achieved by any team in any game across all history.
 * - `allTimeLeagueMinScore`: The single lowest score achieved by any team in any game across all history (excluding 0 or invalid scores).
 * - `historicalChampions`: Object mapping years to champion team names: `{ [year]: championTeamName }`.
 * - `teamsByYear`: Object mapping years to an array of unique team names that played in that year: `{ [year]: [team1, team2, ...] }`.
 */
export const calculateAllLeagueMetrics = (historicalMatchups, getDisplayTeamName) => {
    if (!historicalMatchups || historicalMatchups.length === 0) {
        return {
            seasonalMetrics: {},
            careerDPRData: [],
            allTimeLeagueMaxScore: 0,
            allTimeLeagueMinScore: Infinity,
            historicalChampions: {},
            teamsByYear: {}
        };
    }

    // --- Intermediate data structures for aggregation ---
    const seasonalTeamStats = {}; // { year: { teamName: { totalPointsFor, totalPointsAgainst, wins, losses, ties, totalGames, weeklyScores: [] } } }
    const careerTeamStatsRaw = {}; // { teamName: { totalPointsFor, totalPointsAgainst, wins, losses, ties, totalGames, careerWeeklyScores: [] } }
    const seasonLeagueScores = {}; // { year: { allGameScores: [], maxScore: 0, minScore: Infinity } }
    const weeklyGameScoresByYearAndWeek = {}; // { year: { week: [{ team: string, score: number }] } }
    const historicalChampions = {}; // { year: championTeamName }
    const teamsByYear = {}; // { year: Set<string> }

    let allTimeLeagueMaxScore = 0;
    let allTimeLeagueMinScore = Infinity; // Initialize with a very high number

    // --- First Pass: Aggregate raw data and identify champions ---
    historicalMatchups.forEach(match => {
        const team1Raw = String(match.team1 || '').trim();
        const team2Raw = String(match.team2 || '').trim();

        // Use the display names consistently
        const team1 = getDisplayTeamName(team1Raw);
        const team2 = getDisplayTeamName(team2Raw);

        const year = parseInt(match.year);
        const week = parseInt(match.week);
        const team1Score = parseFloat(match.team1Score);
        const team2Score = parseFloat(match.team2Score);

        // Skip invalid matchups
        if (!team1 || !team2 || isNaN(year) || isNaN(week) || isNaN(team1Score) || isNaN(team2Score)) {
            console.warn('Skipping invalid matchup data:', match);
            return;
        }

        const isTie = team1Score === team2Score;
        const team1Won = team1Score > team2Score;
        const team2Won = team2Score > team1Score;

        // Initialize structures if they don't exist
        if (!seasonalTeamStats[year]) seasonalTeamStats[year] = {};
        if (!careerTeamStatsRaw[team1]) careerTeamStatsRaw[team1] = { wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0, careerWeeklyScores: [] };
        if (!careerTeamStatsRaw[team2]) careerTeamStatsRaw[team2] = { wins: 0, losses: 0, ties: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0, careerWeeklyScores: [] };
        if (!seasonalTeamStats[year][team1]) seasonalTeamStats[year][team1] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, totalGames: 0, weeklyScores: [] };
        if (!seasonalTeamStats[year][team2]) seasonalTeamStats[year][team2] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, totalGames: 0, weeklyScores: [] };
        if (!seasonLeagueScores[year]) seasonLeagueScores[year] = { allGameScores: [], maxScore: 0, minScore: Infinity };
        if (!weeklyGameScoresByYearAndWeek[year]) weeklyGameScoresByYearAndWeek[year] = {};
        if (!weeklyGameScoresByYearAndWeek[year][week]) weeklyGameScoresByYearAndWeek[year][week] = [];
        if (!teamsByYear[year]) teamsByYear[year] = new Set();


        // Populate team data
        seasonalTeamStats[year][team1].pointsFor += team1Score;
        seasonalTeamStats[year][team1].pointsAgainst += team2Score;
        seasonalTeamStats[year][team1].totalGames++;
        seasonalTeamStats[year][team1].weeklyScores.push(team1Score);
        teamsByYear[year].add(team1); // Add team to the set for the current year

        seasonalTeamStats[year][team2].pointsFor += team2Score;
        seasonalTeamStats[year][team2].pointsAgainst += team1Score;
        seasonalTeamStats[year][team2].totalGames++;
        seasonalTeamStats[year][team2].weeklyScores.push(team2Score);
        teamsByYear[year].add(team2); // Add team to the set for the current year

        careerTeamStatsRaw[team1].totalPointsFor += team1Score;
        careerTeamStatsRaw[team1].totalPointsAgainst += team2Score;
        careerTeamStatsRaw[team1].totalGames++;
        careerTeamStatsRaw[team1].careerWeeklyScores.push(team1Score);

        careerTeamStatsRaw[team2].totalPointsFor += team2Score;
        careerTeamStatsRaw[team2].totalPointsAgainst += team1Score;
        careerTeamStatsRaw[team2].totalGames++;
        careerTeamStatsRaw[team2].careerWeeklyScores.push(team2Score);

        // Update wins/losses/ties
        if (team1Won) {
            seasonalTeamStats[year][team1].wins++;
            seasonalTeamStats[year][team2].losses++;
            careerTeamStatsRaw[team1].wins++;
            careerTeamStatsRaw[team2].losses++;
        } else if (team2Won) {
            seasonalTeamStats[year][team2].wins++;
            seasonalTeamStats[year][team1].losses++;
            careerTeamStatsRaw[team2].wins++;
            careerTeamStatsRaw[team1].losses++;
        } else if (isTie) {
            seasonalTeamStats[year][team1].ties++;
            seasonalTeamStats[year][team2].ties++;
            careerTeamStatsRaw[team1].ties++;
            careerTeamStatsRaw[team2].ties++;
        }

        // Aggregate league-wide scores for DPR calculation
        seasonLeagueScores[year].allGameScores.push(team1Score, team2Score);
        seasonLeagueScores[year].maxScore = Math.max(seasonLeagueScores[year].maxScore, team1Score, team2Score);
        seasonLeagueScores[year].minScore = Math.min(seasonLeagueScores[year].minScore, team1Score, team2Score);

        // Populate weekly game scores for luck rating
        weeklyGameScoresByYearAndWeek[year][week].push(
            { team: team1, score: team1Score },
            { team: team2, score: team2Score }
        );

        // Update all-time max/min scores
        allTimeLeagueMaxScore = Math.max(allTimeLeagueMaxScore, team1Score, team2Score);
        allTimeLeagueMinScore = Math.min(allTimeLeagueMinScore, team1Score, team2Score);

        // Identify Champions from 'finalSeedingGame'
        // Championship game is typically finalSeedingGame === 1
        if (match.finalSeedingGame === 1) {
            if (team1Won) {
                historicalChampions[year] = team1;
            } else if (team2Won) {
                historicalChampions[year] = team2;
            }
        }
    });

    // Convert sets to arrays for teamsByYear
    const finalTeamsByYear = {};
    Object.keys(teamsByYear).forEach(year => {
        finalTeamsByYear[year] = Array.from(teamsByYear[year]);
    });

    // --- Second Pass: Calculate derived seasonal metrics (Win%, All-Play Win%, DPR, Luck Rating) ---
    const seasonalMetrics = {};
    Object.keys(seasonalTeamStats).forEach(year => {
        seasonalMetrics[year] = {};
        const leagueMaxScore = seasonLeagueScores[year].maxScore;
        const leagueMinScore = seasonLeagueScores[year].minScore;

        Object.keys(seasonalTeamStats[year]).forEach(team => {
            const stats = seasonalTeamStats[year][team];
            const totalGamesInSeason = stats.totalGames;

            // Calculate Win Percentage
            const winPercentage = totalGamesInSeason > 0 ?
                (stats.wins + 0.5 * stats.ties) / totalGamesInSeason : 0;

            // Calculate All-Play Win Percentage
            // This logic is duplicated and handled within calculateLuckRating for its output,
            // but we can also calculate it here for direct storage in seasonalMetrics.
            let allPlayWinsInSeason = 0;
            let allPlayTiesInSeason = 0;
            let totalAllPlayComparisonsInSeason = 0;

            stats.weeklyScores.forEach((teamScore, index) => {
                const weekNumber = historicalMatchups.find(
                    m => (getDisplayTeamName(m.team1) === team && parseFloat(m.team1Score) === teamScore) ||
                         (getDisplayTeamName(m.team2) === team && parseFloat(m.team2Score) === teamScore)
                )?.week; // Find the week number corresponding to this score

                if (weekNumber && weeklyGameScoresByYearAndWeek[year]?.[weekNumber]) {
                    const scoresInThisWeek = weeklyGameScoresByYearAndWeek[year][weekNumber];
                    scoresInThisWeek.forEach(weeklyGame => {
                        if (weeklyGame.team !== team) {
                            totalAllPlayComparisonsInSeason++;
                            if (teamScore > weeklyGame.score) {
                                allPlayWinsInSeason++;
                            } else if (teamScore === weeklyGame.score) {
                                allPlayTiesInSeason++;
                            }
                        }
                    });
                }
            });

            const allPlayWinPercentage = totalAllPlayComparisonsInSeason > 0 ?
                (allPlayWinsInSeason + 0.5 * allPlayTiesInSeason) / totalAllPlayComparisonsInSeason : 0;

            // Calculate Raw DPR for the season
            const rawDPR = calculateRawDPR(stats.pointsFor, winPercentage, leagueMaxScore, leagueMinScore);

            // Calculate Luck Rating for the season
            // The `calculateLuckRating` function already calculates projected wins internally.
            // We're adapting it to just return the luck rating as needed for this context,
            // or we could modify it to return an object with both luckRating and projectedWins if needed for display.
            const luckRating = calculateLuckRating(
                historicalMatchups, team, year, weeklyGameScoresByYearAndWeek
            );

            // Store all calculated seasonal metrics
            seasonalMetrics[year][team] = {
                ...stats,
                winPercentage,
                allPlayWinPercentage,
                rawDPR,
                luckRating,
                // adjustedDPR will be calculated in a third pass after finding average rawDPR for the season
            };
        });

        // Calculate average raw DPR for the current season to adjust individual team DPRs
        let totalRawDPRSeason = 0;
        let teamsWithValidDPRSeason = 0;
        Object.keys(seasonalMetrics[year]).forEach(team => {
            const teamDPR = seasonalMetrics[year][team].rawDPR;
            if (typeof teamDPR === 'number' && !isNaN(teamDPR)) {
                totalRawDPRSeason += teamDPR;
                teamsWithValidDPRSeason++;
            }
        });
        const avgRawDPRSeason = teamsWithValidDPRSeason > 0 ? totalRawDPRSeason / teamsWithValidDPRSeason : 0;

        // Adjust seasonal DPRs based on the seasonal average
        Object.keys(seasonalMetrics[year]).forEach(team => {
            if (avgRawDPRSeason > 0) {
                seasonalMetrics[year][team].adjustedDPR = seasonalMetrics[year][team].rawDPR / avgRawDPRSeason;
            } else {
                seasonalMetrics[year][team].adjustedDPR = 0; // Or handle as desired if no average DPR
            }
        });
    });

    // --- Third Pass: Calculate Career DPR (adjusted by overall league average raw DPR) ---
    const careerDPRData = [];
    let totalRawDPROverall = 0;
    let teamsWithValidCareerDPR = 0;

    // Calculate raw DPR for career stats first to find overall average
    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];
        if (stats.totalGames === 0) { // Skip teams with no games
            return;
        }

        const careerWinPercentage = (stats.wins + 0.5 * stats.ties) / stats.totalGames;
        // For career DPR, use the overall league max/min scores, not individual team max/min weekly scores.
        // This makes career DPR comparable across all teams based on league extremes.
        const rawDPR = calculateRawDPR(stats.totalPointsFor, careerWinPercentage, allTimeLeagueMaxScore, allTimeLeagueMinScore);
        stats.rawDPR = rawDPR; // Temporarily store raw DPR

        if (typeof rawDPR === 'number' && !isNaN(rawDPR)) {
            totalRawDPROverall += rawDPR;
            teamsWithValidCareerDPR++;
        }
    });

    const avgRawDPROverall = teamsWithValidCareerDPR > 0 ? totalRawDPROverall / teamsWithValidCareerDPR : 0;

    // Now, adjust career DPRs based on the overall league average
    Object.keys(careerTeamStatsRaw).filter(team => team !== '').forEach(team => {
        const stats = careerTeamStatsRaw[team];
        if (stats.totalGames === 0) {
            return; // Skip teams with no games
        }
        const adjustedDPR = avgRawDPROverall > 0 ? stats.rawDPR / avgRawDPROverall : 0; // Adjusted DPR makes it relative to league average

        careerDPRData.push({
            team,
            dpr: adjustedDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.totalPointsFor,
            pointsAgainst: stats.totalPointsAgainst,
            totalGames: stats.totalGames,
            // Add other career stats if needed
            winPercentage: stats.totalGames > 0 ? (stats.wins + 0.5 * stats.ties) / stats.totalGames : 0,
        });
    });

    // Sort career DPR data by DPR descending for ranking purposes
    careerDPRData.sort((a, b) => b.dpr - a.dpr);

    return {
        seasonalMetrics,
        careerDPRData,
        allTimeLeagueMaxScore,
        allTimeLeagueMinScore: allTimeLeagueMinScore === Infinity ? 0 : allTimeLeagueMinScore, // Handle case where no valid scores found
        historicalChampions,
        teamsByYear: finalTeamsByYear,
    };
};
