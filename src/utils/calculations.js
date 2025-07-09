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
 * Calculates comprehensive league metrics for each season and aggregated career metrics.
 * @param {Object} historicalData - The full historical data object (matchups, rosters, users, leaguesMetadata).
 * @param {Function} getTeamName - A function (from context) to get the display name of a team given ownerId and/or rosterId/year.
 * @returns {Object} An object containing seasonalMetrics and careerDPRData.
 */
export const calculateAllLeagueMetrics = (historicalData, getTeamName) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    const seasonalMetrics = {}; // Final structured data for each season
    const careerTeamStatsRaw = {}; // Aggregated raw career stats, keyed by ownerId

    if (!historicalData || Object.keys(historicalData).length === 0) {
        console.warn("calculateAllLeagueMetrics: No historical data provided.");
        return { seasonalMetrics: {}, careerDPRData: [] };
    }

    const allYears = Object.keys(historicalData.matchupsBySeason).sort();

    allYears.forEach(year => {
        const matchups = historicalData.matchupsBySeason[year];
        const leagueMetadata = historicalData.leaguesMetadataBySeason[year];
        const rosters = historicalData.rostersBySeason[year];
        const users = historicalData.usersBySeason[year]; // Users for current year, if needed

        if (!matchups || !leagueMetadata || !rosters || !users) {
            console.warn(`calculateAllLeagueMetrics: Missing data for year ${year}. Skipping.`);
            return;
        }

        const playoffStartWeek = leagueMetadata.settings?.playoff_start_week ? parseInt(leagueMetadata.settings.playoff_start_week) : 99;

        const rosterIdToOwnerId = {};
        rosters.forEach(roster => {
            if (roster.owner_id) {
                rosterIdToOwnerId[roster.roster_id] = roster.owner_id;
            }
        });

        // Initialize seasonal stats for each roster in the current year
        // This object will be filled with detailed stats per roster per year
        const yearStatsRaw = {};
        rosters.forEach(roster => {
            const ownerId = roster.owner_id;
            const teamName = getTeamName(roster.roster_id, year); // Get seasonal team name

            yearStatsRaw[roster.roster_id] = {
                teamName,
                ownerId,
                rosterId: roster.roster_id,
                wins: 0,
                losses: 0,
                ties: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                totalGames: 0, // Regular season games
                allPlayWins: 0,
                allPlayLosses: 0,
                allPlayTies: 0,
                weeklyScores: [], // Store all weekly scores for this roster
                highScore: -Infinity, // Seasonal high score
                lowScore: Infinity,  // Seasonal low score
                topScoreWeeksCount: 0, // Number of weeks with absolute highest score
                blowoutWins: 0,
                blowoutLosses: 0,
                slimWins: 0,
                slimLosses: 0,
                weeklyTop2ScoresCount: 0, // New metric
                isPlayoffTeam: false, // Flag initialized here, set if found in playoff matchups
                actualWinsRecord: 0, // For luck calculation (regular season)
            };

            // Initialize career stats for each owner if not already present
            if (ownerId && !careerTeamStatsRaw[ownerId]) {
                careerTeamStatsRaw[ownerId] = {
                    teamName: getTeamName(ownerId, null), // Career team name, passed ownerId, null for year
                    ownerId: ownerId,
                    wins: 0,
                    losses: 0,
                    ties: 0,
                    pointsFor: 0,
                    pointsAgainst: 0,
                    totalGames: 0,
                    allPlayWins: 0,
                    allPlayLosses: 0,
                    allPlayTies: 0,
                    careerWeeklyScores: [], // Stores ALL weekly scores across career for high/low/avg
                    topScoreWeeksCount: 0,
                    blowoutWins: 0,
                    blowoutLosses: 0,
                    slimWins: 0,
                    slimLosses: 0,
                    weeklyTop2ScoresCount: 0,
                    totalLuckScoreSum: 0, // For career luck calculation
                    actualCareerWinsRecord: 0, // For career luck calculation
                };
            }
        });

        // Iterate through each week's matchups in the current year (regular season only for stats)
        Object.keys(matchups).forEach(weekStr => {
            const week = parseInt(weekStr);
            // Process regular season matchups for core stats
            const isRegularSeasonMatch = (week < playoffStartWeek && !isNaN(week));

            const weeklyMatchups = matchups[weekStr];
            if (!weeklyMatchups || weeklyMatchups.length === 0) return;

            // --- Step 1: Collect all scores for the current week ---
            // This is crucial for all-play, top score, and top 2 score calculations.
            // Handles both V1 (team1/team2) and V2 (roster_id/points) structures
            const weekScoresForAllTeams = [];
            const processedRosterIdsInWeek = new Set(); // To avoid duplicate scores from the same roster_id if data is messy

            weeklyMatchups.forEach(m => {
                let rosterId, points;
                if (m.roster_id && typeof m.points === 'number' && !isNaN(m.points)) { // Sleeper V2 style
                    rosterId = String(m.roster_id);
                    points = m.points;
                } else if (m.team1_roster_id && typeof m.team1_points === 'number' && !isNaN(m.team1_points)) { // Sleeper V1 style
                    rosterId = String(m.team1_roster_id);
                    points = m.team1_points;
                }

                if (rosterId && typeof points === 'number' && !processedRosterIdsInWeek.has(rosterId)) {
                    if (yearStatsRaw[rosterId]) { // Only add if it's a known roster for this year
                        weekScoresForAllTeams.push({ roster_id: rosterId, score: points });
                        processedRosterIdsInWeek.add(rosterId);
                    }
                }

                // For V1, also add team2's score if present and valid
                if (m.team2_roster_id && typeof m.team2_points === 'number' && !isNaN(m.team2_points)) {
                    rosterId = String(m.team2_roster_id);
                    points = m.team2_points;
                    if (rosterId && typeof points === 'number' && !processedRosterIdsInWeek.has(rosterId)) {
                        if (yearStatsRaw[rosterId]) { // Only add if it's a known roster for this year
                            weekScoresForAllTeams.push({ roster_id: rosterId, score: points });
                            processedRosterIdsInWeek.add(rosterId);
                        }
                    }
                }
            });

            if (weekScoresForAllTeams.length === 0) return; // No valid scores for this week

            // Determine highest score for the week
            const highestScoreInWeek = weekScoresForAllTeams.reduce((max, team) => Math.max(max, team.score), -Infinity);

            // Sort for top 2 scores
            const sortedWeekScores = [...weekScoresForAllTeams].sort((a, b) => b.score - a.score);
            const top2ScoresValues = [sortedWeekScores[0]?.score, sortedWeekScores[1]?.score].filter(s => typeof s === 'number');

            // --- Step 2: Process each roster's performance in the current week ---
            // Iterate over all rosters to ensure we process teams even if they had a bye (though bye weeks might not generate matchup entries)
            Object.keys(yearStatsRaw).forEach(rosterId => {
                const currentTeamStats = yearStatsRaw[rosterId];
                const ownerId = currentTeamStats.ownerId;

                const currentTeamScoreInWeek = weekScoresForAllTeams.find(s => String(s.roster_id) === String(rosterId))?.score;

                if (typeof currentTeamScoreInWeek !== 'number' || isNaN(currentTeamScoreInWeek)) {
                    // This team did not play this week or had invalid score, skip detailed weekly stats for them.
                    return;
                }

                // Update seasonal weekly scores, high/low score
                currentTeamStats.weeklyScores.push(currentTeamScoreInWeek);
                currentTeamStats.highScore = Math.max(currentTeamStats.highScore, currentTeamScoreInWeek);
                currentTeamStats.lowScore = Math.min(currentTeamStats.lowScore, currentTeamScoreInWeek);

                // Update career weekly scores for the owner
                if (careerTeamStatsRaw[ownerId]) {
                    careerTeamStatsRaw[ownerId].careerWeeklyScores.push(currentTeamScoreInWeek);
                    // Career high/low will be calculated at the end from careerWeeklyScores
                }

                // All-Play calculations for the week
                let weeklyExpectedWins = 0;
                let weeklyOneLessExpectedWins = 0; // For luck calculation component 'Y'
                let allPlayOpponentsCount = 0;

                weekScoresForAllTeams.forEach(otherTeamScore => {
                    if (String(otherTeamScore.roster_id) !== String(rosterId)) { // Don't compare a team to itself
                        allPlayOpponentsCount++;
                        if (currentTeamScoreInWeek > otherTeamScore.score) {
                            currentTeamStats.allPlayWins++;
                            weeklyExpectedWins++;
                        } else if (currentTeamScoreInWeek < otherTeamScore.score) {
                            currentTeamStats.allPlayLosses++;
                        } else {
                            currentTeamStats.allPlayTies++;
                            weeklyExpectedWins += 0.5; // Tie counts as 0.5 expected win
                        }

                        // Specific for luck calculation: one less score
                        if (currentTeamScoreInWeek - 1 === otherTeamScore.score) {
                            weeklyOneLessExpectedWins++;
                        }
                    }
                });

                // Update career all-play counts
                if (careerTeamStatsRaw[ownerId]) {
                    careerTeamStatsRaw[ownerId].allPlayWins += (currentTeamStats.allPlayWins - (yearStatsRaw[rosterId].allPlayWins || 0)); // Only add what's new this week
                    careerTeamStatsRaw[ownerId].allPlayLosses += (currentTeamStats.allPlayLosses - (yearStatsRaw[rosterId].allPlayLosses || 0)); // Only add what's new this week
                    careerTeamStatsRaw[ownerId].allPlayTies += (currentTeamStats.allPlayTies - (yearStatsRaw[rosterId].allPlayTies || 0)); // Only add what's new this week
                }

                // Luck Rating calculation (seasonal component)
                if (isRegularSeasonMatch && allPlayOpponentsCount > 0) {
                    const weeklyProjectedWinComponentX = (weeklyExpectedWins / allPlayOpponentsCount);
                    const weeklyLuckScorePartY = (weeklyOneLessExpectedWins / (allPlayOpponentsCount * 2));
                    const combinedWeeklyExpectedScore = weeklyProjectedWinComponentX + weeklyLuckScorePartY;
                    if (careerTeamStatsRaw[ownerId]) {
                        careerTeamStatsRaw[ownerId].totalLuckScoreSum += combinedWeeklyExpectedScore;
                    }
                }

                // Weekly High Score / Top 2 Score
                if (isRegularSeasonMatch) { // These are generally based on regular season
                    if (currentTeamScoreInWeek === highestScoreInWeek) {
                        currentTeamStats.topScoreWeeksCount++;
                        if (careerTeamStatsRaw[ownerId]) {
                            careerTeamStatsRaw[ownerId].topScoreWeeksCount++;
                        }
                    }
                    if (top2ScoresValues.includes(currentTeamScoreInWeek)) {
                        currentTeamStats.weeklyTop2ScoresCount++;
                        if (careerTeamStatsRaw[ownerId]) {
                            careerTeamStatsRaw[ownerId].weeklyTop2ScoresCount++;
                        }
                    }
                }

                // Find the specific matchup for this team to get opponent score
                let opponentScore = null;
                const foundMatchup = weeklyMatchups.find(m =>
                    (m.roster_id && String(m.roster_id) === String(rosterId)) || // V2 style
                    (m.team1_roster_id && String(m.team1_roster_id) === String(rosterId)) || // V1 team1
                    (m.team2_roster_id && String(m.team2_roster_id) === String(rosterId))    // V1 team2
                );

                if (foundMatchup) {
                    if (foundMatchup.roster_id && String(foundMatchup.roster_id) === String(rosterId)) { // V2 style
                        const opponent = weeklyMatchups.find(m => m.matchup_id === foundMatchup.matchup_id && String(m.roster_id) !== String(rosterId));
                        if (opponent) opponentScore = opponent.points;
                    } else if (foundMatchup.team1_roster_id && String(foundMatchup.team1_roster_id) === String(rosterId)) { // V1 style
                        opponentScore = foundMatchup.team2_points;
                    } else if (foundMatchup.team2_roster_id && String(foundMatchup.team2_roster_id) === String(rosterId)) { // V1 style
                        opponentScore = foundMatchup.team1_points;
                    }
                }

                // Regular season head-to-head stats
                if (isRegularSeasonMatch && typeof opponentScore === 'number' && !isNaN(opponentScore)) {
                    currentTeamStats.pointsFor += currentTeamScoreInWeek;
                    currentTeamStats.pointsAgainst += opponentScore;
                    currentTeamStats.totalGames++; // Increment regular season games
                    currentTeamStats.actualWinsRecord++; // For luck calculation (actual wins)

                    if (currentTeamScoreInWeek > opponentScore) {
                        currentTeamStats.wins++;
                    } else if (currentTeamScoreInWeek < opponentScore) {
                        currentTeamStats.losses++;
                    } else {
                        currentTeamStats.ties++;
                    }

                    // Blowout/Slim Win/Loss
                    const scoreDifference = currentTeamScoreInWeek - opponentScore;
                    if (scoreDifference >= 30) {
                        currentTeamStats.blowoutWins++;
                    } else if (scoreDifference <= -30) {
                        currentTeamStats.blowoutLosses++;
                    } else if (scoreDifference > 0 && scoreDifference <= 5) {
                        currentTeamStats.slimWins++;
                    } else if (scoreDifference < 0 && scoreDifference >= -5) {
                        currentTeamStats.slimLosses++;
                    }
                } else if (!isRegularSeasonMatch) {
                    // Mark as playoff team if they appeared in a playoff week
                    if (foundMatchup) { // Only if they actually had a matchup entry in playoff week
                        currentTeamStats.isPlayoffTeam = true;
                    }
                }

                // Update career regular season stats (points, wins, losses, ties, games)
                if (isRegularSeasonMatch && careerTeamStatsRaw[ownerId] && typeof opponentScore === 'number' && !isNaN(opponentScore)) {
                    careerTeamStatsRaw[ownerId].pointsFor += currentTeamScoreInWeek;
                    careerTeamStatsRaw[ownerId].pointsAgainst += opponentScore;
                    careerTeamStatsRaw[ownerId].totalGames++;
                    careerTeamStatsRaw[ownerId].actualCareerWinsRecord++;

                    if (currentTeamScoreInWeek > opponentScore) {
                        careerTeamStatsRaw[ownerId].wins++;
                    } else if (currentTeamScoreInWeek < opponentScore) {
                        careerTeamStatsRaw[ownerId].losses++;
                    } else {
                        careerTeamStatsRaw[ownerId].ties++;
                    }

                    // Update career blowout/slim wins/losses
                    const scoreDifference = currentTeamScoreInWeek - opponentScore;
                    if (scoreDifference >= 30) {
                        careerTeamStatsRaw[ownerId].blowoutWins++;
                    } else if (scoreDifference <= -30) {
                        careerTeamStatsRaw[ownerId].blowoutLosses++;
                    } else if (scoreDifference > 0 && scoreDifference <= 5) {
                        careerTeamStatsRaw[ownerId].slimWins++;
                    } else if (scoreDifference < 0 && scoreDifference >= -5) {
                        careerTeamStatsRaw[ownerId].slimLosses++;
                    }
                }
            });
        });

        // --- Phase 3: Post-process year stats for calculations and final structure ---
        seasonalMetrics[year] = {};
        const rosterIdsInSeason = Object.keys(yearStatsRaw);

        rosterIdsInSeason.forEach(rosterId => {
            const stats = yearStatsRaw[rosterId];
            const ownerId = stats.ownerId; // Get the ownerId from the raw stats

            const averageScore = stats.totalGames > 0 ? stats.pointsFor / stats.totalGames : 0;
            const winPercentage = stats.totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            const rawDPR = calculateRawDPR(
                averageScore,
                stats.highScore !== -Infinity ? stats.highScore : 0,
                stats.lowScore !== Infinity ? stats.lowScore : 0,
                winPercentage
            );

            // Luck Rating for the season
            const seasonalLuckRating = stats.actualWinsRecord - (careerTeamStatsRaw[ownerId]?.totalLuckScoreSum || 0); // Need to re-think this. The `totalLuckScoreSum` on career needs to be `weeklyExpectedWins` summed per season.

            // To correct seasonal luck calculation: it should be actual seasonal wins minus seasonal expected wins.
            // The `careerTeamStatsRaw[ownerId].totalLuckScoreSum` accumulates across seasons, not reset per season.
            // So, for seasonal luck, we need a seasonal `weeklyExpectedWins` sum.
            // Let's calculate expected wins for the season directly here.
            let seasonalExpectedWins = 0;
            let seasonalActualWins = 0;
            // Iterate through weekly scores again for accurate expected wins, or modify above loop to store it.
            // For efficiency, it's better to store `weeklyExpectedWins` in `yearStatsRaw[rosterId]` during the first pass.
            // Since that wasn't done, for now, we'll use a simplified version, or calculate it on the fly.
            // A more direct way to calculate luck: (seasonal actual wins) - (seasonal all-play win percentage * total regular season games).
            // Or sum up `weeklyExpectedWins` for each roster during the initial pass.
            // Re-evaluating the original `calculateLuckRating` logic:
            // `totalWeeklyLuckScoreSum` effectively acted as "Expected Wins" for the season.
            // Let's re-integrate that logic better within the main loop to store it per season.

            // For now, let's just use placeholder for seasonal luck until re-integration.
            // If the goal of the `calculateLuckRating` function was to provide the difference,
            // we need to pass the *seasonal* `actualWins` and *seasonal* `allPlayExpectedWins` (based on weekly averages).
            // The `allPlayWinPercentage` being calculated below is a good proxy for expected win rate.

            const seasonalAllPlayWinPercentage = (stats.allPlayWins + (stats.allPlayTies * 0.5)) / (stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies) || 0;
            // Simple luck for season: Actual Win % - All Play Win % (normalized by total games)
            // Or, following previous definition: Actual Wins - Expected Wins
            // Expected wins = All Play Win Percentage * Total Games (Regular Season)
            const seasonalCalculatedLuckRating = stats.actualWinsRecord - (seasonalAllPlayWinPercentage * stats.totalGames);


            seasonalMetrics[year][rosterId] = {
                teamName: stats.teamName,
                rosterId: stats.rosterId,
                ownerId: stats.ownerId,
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsFor: stats.pointsFor,
                pointsAgainst: stats.pointsAgainst,
                averageScore: averageScore,
                winPercentage: winPercentage,
                rawDPR: rawDPR,
                luckRating: seasonalCalculatedLuckRating, // This is the revised seasonal luck rating
                allPlayWinPercentage: seasonalAllPlayWinPercentage, // Derived from direct counts
                topScoreWeeksCount: stats.topScoreWeeksCount,
                blowoutWins: stats.blowoutWins,
                blowoutLosses: stats.blowoutLosses,
                slimWins: stats.slimWins,
                slimLosses: stats.slimLosses,
                weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount,
                adjustedDPR: 0, // Will be calculated after all raw DPRs are known for the season
                totalGames: stats.totalGames,
                highScore: stats.highScore,
                lowScore: stats.lowScore,
                isPlayoffTeam: stats.isPlayoffTeam,
                isChampion: false,
                isRunnerUp: false,
                isThirdPlace: false,
                isPointsChampion: false,
                isPointsRunnerUp: false,
                isThirdPlacePoints: false,
                rank: 'N/A',
                pointsRank: 'N/A',
            };
        });

        // Calculate adjusted DPR for each team in the current season
        const allRawDPRsInSeason = Object.values(seasonalMetrics[year]).map(s => s.rawDPR).filter(dpr => dpr !== 0);
        const avgRawDPRInSeason = allRawDPRsInSeason.length > 0 ? allRawDPRsInSeason.reduce((sum, dpr) => sum + dpr, 0) / allRawDPRsInSeason.length : 0;

        Object.keys(seasonalMetrics[year]).forEach(rosterId => {
            if (avgRawDPRInSeason > 0) {
                seasonalMetrics[year][rosterId].adjustedDPR = seasonalMetrics[year][rosterId].rawDPR / avgRawDPRInSeason;
            } else {
                seasonalMetrics[year][rosterId].adjustedDPR = 0;
            }
        });

        // --- RANK CALCULATION LOGIC (Overall Finish) ---
        const allTeamsInSeasonForRanking = Object.values(seasonalMetrics[year]).map(teamStats => ({
            rosterId: teamStats.rosterId,
            teamName: teamStats.teamName,
            winPercentage: teamStats.winPercentage,
            pointsFor: teamStats.pointsFor,
            totalGames: teamStats.totalGames
        }));

        allTeamsInSeasonForRanking.sort((a, b) => {
            if (a.totalGames === 0 && b.totalGames > 0) return 1;
            if (a.totalGames > 0 && b.totalGames === 0) return -1;
            if (a.totalGames === 0 && b.totalGames === 0) return 0; // Both 0 games, maintain current relative order

            if (b.winPercentage !== a.winPercentage) {
                return b.winPercentage - a.winPercentage;
            }
            return b.pointsFor - a.pointsFor;
        });

        allTeamsInSeasonForRanking.forEach((rankedTeam, index) => {
            if (seasonalMetrics[year][rankedTeam.rosterId]) { // Ensure team still exists
                seasonalMetrics[year][rankedTeam.rosterId].rank = index + 1;
                if (index === 0) seasonalMetrics[year][rankedTeam.rosterId].isChampion = true;
                else if (index === 1) seasonalMetrics[year][rankedTeam.rosterId].isRunnerUp = true;
                else if (index === 2) seasonalMetrics[year][rankedTeam.rosterId].isThirdPlace = true;
            }
        });

        // --- POINTS RANKING LOGIC ---
        const teamsSortedByPoints = Object.values(seasonalMetrics[year])
            .filter(teamStats => typeof teamStats.pointsFor === 'number' && !isNaN(teamStats.pointsFor))
            .sort((a, b) => b.pointsFor - a.pointsFor);

        if (teamsSortedByPoints.length > 0) {
            let currentRank = 1;
            for (let i = 0; i < teamsSortedByPoints.length; i++) {
                const teamStats = teamsSortedByPoints[i];
                if (i > 0 && teamStats.pointsFor < teamsSortedByPoints[i - 1].pointsFor) {
                    currentRank = i + 1;
                }
                if (seasonalMetrics[year][teamStats.rosterId]) {
                    seasonalMetrics[year][teamStats.rosterId].pointsRank = currentRank;
                    if (currentRank === 1) {
                        seasonalMetrics[year][teamStats.rosterId].isPointsChampion = true;
                    } else if (currentRank === 2) {
                        seasonalMetrics[year][teamStats.rosterId].isPointsRunnerUp = true;
                    } else if (currentRank === 3) {
                        seasonalMetrics[year][teamStats.rosterId].isThirdPlacePoints = true;
                    }
                }
            }
        }
    }); // End of allYears.forEach

    // --- Phase 4: Finalize career stats and calculate overall percentages/DPR ---
    const finalCareerDPRData = [];
    const allCareerRawDPRs = [];

    Object.keys(careerTeamStatsRaw).forEach(ownerId => {
        const stats = careerTeamStatsRaw[ownerId];

        // Ensure high/low scores are calculated from the *accumulated* careerWeeklyScores
        const careerHighScore = stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0;
        const careerLowScore = stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0;

        const careerAverageScore = stats.totalGames > 0 ? stats.pointsFor / stats.totalGames : 0;
        const careerWinPercentage = (stats.totalGames > 0) ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

        let careerRawDPR = 0;
        if (stats.totalGames > 0) {
            careerRawDPR = calculateRawDPR(
                careerAverageScore,
                careerHighScore,
                careerLowScore,
                careerWinPercentage
            );
            allCareerRawDPRs.push(careerRawDPR);
        }

        const careerAllPlayTotalGames = stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies;
        const careerAllPlayWinPercentage = careerAllPlayTotalGames > 0 ?
            ((stats.allPlayWins + stats.allPlayTies * 0.5) / careerAllPlayTotalGames) : 0;

        // Career Luck Rating: Sum of (Actual Wins - Expected Wins) for each season this owner participated.
        // OR, just Actual Career Wins - Total Expected Wins from all-play.
        // Given your previous `calculateLuckRating` logic, it seems to sum `totalWeeklyLuckScoreSum` (expected wins)
        // and subtract actual wins *per season*.
        // Let's use the simpler, more common definition:
        const careerLuckRating = stats.actualCareerWinsRecord - (careerAllPlayWinPercentage * stats.totalGames);


        // Calculate highest/lowest seasonal points avg for career data
        let highestSeasonalPointsAvg = 0;
        let lowestSeasonalPointsAvg = Infinity;
        Object.keys(seasonalMetrics).forEach(year => {
            // Find the roster ID for this owner in the current year
            const seasonalRosterId = Object.keys(seasonalMetrics[year]).find(rId => seasonalMetrics[year][rId].ownerId === ownerId);
            if (seasonalRosterId) {
                const seasonalStats = seasonalMetrics[year][seasonalRosterId];
                if (seasonalStats && seasonalStats.totalGames > 0) {
                    const currentSeasonalAvg = seasonalStats.pointsFor / seasonalStats.totalGames;
                    highestSeasonalPointsAvg = Math.max(highestSeasonalPointsAvg, currentSeasonalAvg);
                    lowestSeasonalPointsAvg = Math.min(lowestSeasonalPointsAvg, currentSeasonalAvg);
                }
            }
        });
        if (lowestSeasonalPointsAvg === Infinity) lowestSeasonalPointsAvg = 0; // If no games played, set to 0

        finalCareerDPRData.push({
            ownerId: ownerId,
            teamName: stats.teamName, // Already derived at initialization
            dpr: careerRawDPR, // Will be adjusted later
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.pointsFor,
            pointsAgainst: stats.pointsAgainst,
            averageScore: careerAverageScore,
            winPercentage: careerWinPercentage,
            totalGames: stats.totalGames,
            allPlayWinPercentage: careerAllPlayWinPercentage, // Career All-Play Win %
            topScoreWeeksCount: stats.topScoreWeeksCount, // Aggregated directly
            blowoutWins: stats.blowoutWins, // Aggregated directly
            blowoutLosses: stats.blowoutLosses, // Aggregated directly
            slimWins: stats.slimWins, // Aggregated directly
            slimLosses: stats.slimLosses, // Aggregated directly
            weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount, // Aggregated directly
            highScore: careerHighScore,
            lowScore: careerLowScore,
            totalLuckRating: careerLuckRating, // This is the revised career luck rating
            highestSeasonalPointsAvg: highestSeasonalPointsAvg,
            lowestSeasonalPointsAvg: lowestSeasonalPointsAvg,
        });
    });

    // Calculate overall average raw DPR for career adjustment
    const avgRawDPROverall = allCareerRawDPRs.length > 0 ? allCareerRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allCareerRawDPRs.length : 0;

    // Adjust career DPRs based on overall average
    finalCareerDPRData.forEach(entry => {
        if (avgRawDPROverall > 0) {
            entry.dpr = entry.dpr / avgRawDPROverall;
        } else {
            entry.dpr = 0;
        }
    });

    finalCareerDPRData.sort((a, b) => b.dpr - a.dpr);

    console.log("--- Finished calculateAllLeagueMetrics ---");
    return { seasonalMetrics, careerDPRData: finalCareerDPRData };
};
