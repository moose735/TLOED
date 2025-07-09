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
    console.log("Initial historicalData received:", historicalData ? `Keys: ${Object.keys(historicalData).join(', ')}` : 'null/undefined');

    const seasonalMetrics = {}; // Final structured data for each season
    const careerTeamStatsRaw = {}; // Aggregated raw career stats, keyed by ownerId

    if (!historicalData || Object.keys(historicalData).length === 0) {
        console.error("calculateAllLeagueMetrics: No historical data provided or it's empty. Returning empty metrics.");
        return { seasonalMetrics: {}, careerDPRData: [] };
    }

    const allYears = Object.keys(historicalData.matchupsBySeason || {}).sort();
    console.log("Years found in historicalData.matchupsBySeason:", allYears);

    if (allYears.length === 0) {
        console.warn("calculateAllLeagueMetrics: No years found in historicalData.matchupsBySeason. Returning empty metrics.");
        return { seasonalMetrics: {}, careerDPRData: [] };
    }

    allYears.forEach(year => {
        const matchups = historicalData.matchupsBySeason[year];
        const leagueMetadata = historicalData.leaguesMetadataBySeason[year];
        const rosters = historicalData.rostersBySeason[year];
        const users = historicalData.usersBySeason[year];

        console.log(`Processing year: ${year}`);
        console.log(`  Matchups for ${year} present: ${!!matchups} (Count: ${matchups ? Object.keys(matchups).length : 0})`);
        console.log(`  League Metadata for ${year} present: ${!!leagueMetadata}`);
        console.log(`  Rosters for ${year} present: ${!!rosters} (Count: ${rosters ? rosters.length : 0})`);
        console.log(`  Users for ${year} present: ${!!users} (Count: ${users ? users.length : 0})`);


        if (!matchups || !leagueMetadata || !rosters || !users) {
            console.error(`calculateAllLeagueMetrics: Missing critical data for year ${year}. Skipping this year.`);
            return; // Skip this year if data is incomplete
        }

        // Use parseInt with a fallback if playoff_start_week is missing or invalid
        const playoffStartWeek = parseInt(leagueMetadata.settings?.playoff_start_week) || 99; // Default to a high number if not found
        console.log(`  Playoff start week for ${year}: ${playoffStartWeek}`);

        // Initialize seasonal stats for each roster in the current year
        const yearStatsRaw = {};
        rosters.forEach(roster => {
            const ownerId = roster.owner_id;
            const teamName = getTeamName(roster.roster_id, year);

            if (!ownerId) {
                console.warn(`  Roster ${roster.roster_id} in year ${year} has no owner_id. Skipping initialization for this roster.`);
                return; // Skip this roster if no owner_id
            }

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
                weeklyScores: [], // Store all weekly scores for this roster for seasonal high/low/avg
                highScore: -Infinity,
                lowScore: Infinity,
                topScoreWeeksCount: 0,
                blowoutWins: 0,
                blowoutLosses: 0,
                slimWins: 0,
                slimLosses: 0,
                weeklyTop2ScoresCount: 0,
                isPlayoffTeam: false,
                actualWinsRecord: 0, // Actual regular season wins (for luck calculation)
                seasonalExpectedWinsSum: 0, // Accumulates expected wins for luck calculation for THIS season
            };

            // Initialize career stats for each owner if not already present
            // This ensures career stats are only initialized once per owner across all years
            if (!careerTeamStatsRaw[ownerId]) {
                careerTeamStatsRaw[ownerId] = {
                    teamName: getTeamName(ownerId, null), // Career team name
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
                    careerWeeklyScores: [],
                    topScoreWeeksCount: 0,
                    blowoutWins: 0,
                    blowoutLosses: 0,
                    slimWins: 0,
                    slimLosses: 0,
                    weeklyTop2ScoresCount: 0,
                    actualCareerWinsRecord: 0,
                    careerExpectedWinsSum: 0, // Accumulates expected wins for overall career luck
                };
            }
        });
        console.log(`  Initialized ${Object.keys(yearStatsRaw).length} rosters for year ${year}`);


        // Iterate through each week's matchups in the current year
        const sortedWeeks = Object.keys(matchups).sort((a, b) => parseInt(a) - parseInt(b));
        console.log(`  Starting weekly matchup processing for ${year}. Total weeks: ${sortedWeeks.length}`);

        sortedWeeks.forEach(weekStr => {
            const week = parseInt(weekStr);
            const weeklyMatchups = matchups[weekStr];

            if (!weeklyMatchups || weeklyMatchups.length === 0) {
                return;
            }

            const isRegularSeasonMatch = (week < playoffStartWeek && !isNaN(week));

            // --- Step 1: Collect all scores for the current week from all matchup entries ---
            const weekScoresForAllTeams = [];
            const processedRosterIdsInWeek = new Set(); // To prevent duplicate score entries for a roster

            weeklyMatchups.forEach(m => {
                // Determine if this matchup entry is V2 (single roster per entry) or V1 (two rosters per entry)
                // Prioritize V1 style as confirmed by MatchupHistory.js
                if (m.team1_roster_id && m.team2_roster_id) { // This looks like a V1 style matchup object
                    // Team 1
                    if (typeof m.team1_score === 'number' && !isNaN(m.team1_score)) {
                        const rosterId1 = String(m.team1_roster_id);
                        const points1 = m.team1_score;
                        if (!processedRosterIdsInWeek.has(rosterId1) && yearStatsRaw[rosterId1]) {
                            weekScoresForAllTeams.push({ roster_id: rosterId1, score: points1 });
                            processedRosterIdsInWeek.add(rosterId1);
                        }
                    } else {
                           // console.warn(`      Matchup V1: Invalid team1_score for roster ${m.team1_roster_id} in week ${week}, year ${year}. Matchup ID: ${m.matchup_id}`);
                    }

                    // Team 2
                    if (typeof m.team2_score === 'number' && !isNaN(m.team2_score)) {
                        const rosterId2 = String(m.team2_roster_id);
                        const points2 = m.team2_score;
                        if (!processedRosterIdsInWeek.has(rosterId2) && yearStatsRaw[rosterId2]) {
                            weekScoresForAllTeams.push({ roster_id: rosterId2, score: points2 });
                            processedRosterIdsInWeek.add(rosterId2);
                        }
                    } else {
                           // console.warn(`      Matchup V1: Invalid team2_score for roster ${m.team2_roster_id} in week ${week}, year ${year}. Matchup ID: ${m.matchup_id}`);
                    }
                }
                // Fallback to Sleeper V2 style if the above V1 style is not present
                else if (m.roster_id && typeof m.points === 'number' && !isNaN(m.points)) {
                    const rosterId = String(m.roster_id);
                    const points = m.points;
                    if (!processedRosterIdsInWeek.has(rosterId) && yearStatsRaw[rosterId]) {
                        weekScoresForAllTeams.push({ roster_id: rosterId, score: points });
                        processedRosterIdsInWeek.add(rosterId);
                    }
                } else {
                    // console.warn(`      Unknown or incomplete matchup structure in week ${week}, year ${year}:`, m);
                }
            });

            if (weekScoresForAllTeams.length === 0) {
                // console.warn(`    Week ${week} in ${year}: No valid scores collected for any team. Skipping weekly calculations.`);
                return;
            }

            const highestScoreInWeek = weekScoresForAllTeams.reduce((max, team) => Math.max(max, team.score), -Infinity);
            const sortedWeekScores = [...weekScoresForAllTeams].sort((a, b) => b.score - a.score);
            const top2ScoresValues = [];
            if (sortedWeekScores[0]) top2ScoresValues.push(sortedWeekScores[0].score);
            if (sortedWeekScores[1]) top2ScoresValues.push(sortedWeekScores[1].score);


            // --- Step 2: Process each roster's performance in the current week ---
            // Iterate over ALL rosters for this year, not just those in `weekScoresForAllTeams`
            // This ensures we can still check `isPlayoffTeam` if a team had a bye in regular season but appears in playoffs
            Object.keys(yearStatsRaw).forEach(rosterId => {
                const currentTeamStats = yearStatsRaw[rosterId];
                const ownerId = currentTeamStats.ownerId;

                // Find the score for the current team in this week
                const currentTeamScoreInWeekEntry = weekScoresForAllTeams.find(s => String(s.roster_id) === String(rosterId));
                const currentTeamScoreInWeek = currentTeamScoreInWeekEntry ? currentTeamScoreInWeekEntry.score : null;

                // Determine if this roster participated in a valid matchup this week
                const hasValidWeeklyScore = typeof currentTeamScoreInWeek === 'number' && !isNaN(currentTeamScoreInWeek);

                // Mark as playoff team if they appeared in a playoff week matchup
                if (!isRegularSeasonMatch && hasValidWeeklyScore) { // Only if they actually had a matchup entry in playoff week
                    currentTeamStats.isPlayoffTeam = true;
                }

                if (!hasValidWeeklyScore) {
                    // This team did not play a valid scoring game this week, or their score was invalid.
                    // console.warn(`      Roster ID ${rosterId} in week ${week}, year ${year} has no valid score. Skipping detailed weekly stats for this team.`);
                    return; // Skip to next roster if no valid score for this week
                }

                // Update seasonal weekly scores, high/low score
                currentTeamStats.weeklyScores.push(currentTeamScoreInWeek);
                currentTeamStats.highScore = Math.max(currentTeamStats.highScore, currentTeamScoreInWeek);
                currentTeamStats.lowScore = Math.min(currentTeamStats.lowScore, currentTeamScoreInWeek);

                // Update career weekly scores for the owner
                if (careerTeamStatsRaw[ownerId]) {
                    careerTeamStatsRaw[ownerId].careerWeeklyScores.push(currentTeamScoreInWeek);
                }

                // All-Play calculations for the week
                let weeklyExpectedWins = 0;
                // let allPlayOpponentsCount = 0; // Not strictly needed for calculation, just for debug

                weekScoresForAllTeams.forEach(otherTeamScore => {
                    if (String(otherTeamScore.roster_id) !== String(rosterId)) { // Don't compare a team to itself
                        // allPlayOpponentsCount++; // debug
                        if (currentTeamScoreInWeek > otherTeamScore.score) {
                            currentTeamStats.allPlayWins++;
                            weeklyExpectedWins++;
                        } else if (currentTeamScoreInWeek < otherTeamScore.score) {
                            currentTeamStats.allPlayLosses++;
                        } else {
                            currentTeamStats.allPlayTies++;
                            weeklyExpectedWins += 0.5; // Tie counts as 0.5 expected win for all-play
                        }
                    }
                });

                // Accumulate expected wins for seasonal luck calculation (only for regular season)
                if (isRegularSeasonMatch) {
                    currentTeamStats.seasonalExpectedWinsSum += weeklyExpectedWins;
                    // Also aggregate to career expected wins sum
                    if (careerTeamStatsRaw[ownerId]) {
                        careerTeamStatsRaw[ownerId].careerExpectedWinsSum += weeklyExpectedWins;
                    }
                }

                // Weekly High Score / Top 2 Score (only for regular season)
                if (isRegularSeasonMatch) {
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

                // Find the specific matchup for this team to get opponent score for head-to-head stats
                let opponentScore = null;
                const foundMatchup = weeklyMatchups.find(m =>
                    // V1 style check (current roster is team1 or team2)
                    (m.team1_roster_id && String(m.team1_roster_id) === String(rosterId)) ||
                    (m.team2_roster_id && String(m.team2_roster_id) === String(rosterId)) ||
                    // V2 style check (matchup entry belongs to the current rosterId AND has points)
                    (m.roster_id && String(m.roster_id) === String(rosterId) && typeof m.points === 'number' && !isNaN(m.points))
                );

                if (foundMatchup) {
                    // Extract opponent score based on the matchup type found
                    if (foundMatchup.roster_id && String(foundMatchup.roster_id) === String(rosterId)) { // V2 style
                        // In V2, opponents are separate entries with the same matchup_id
                        const opponent = weeklyMatchups.find(m => m.matchup_id === foundMatchup.matchup_id && String(m.roster_id) !== String(rosterId));
                        if (opponent && typeof opponent.points === 'number' && !isNaN(opponent.points)) opponentScore = opponent.points;
                    } else if (foundMatchup.team1_roster_id && String(foundMatchup.team1_roster_id) === String(rosterId)) { // V1 style (current roster is team1)
                        if (typeof foundMatchup.team2_score === 'number' && !isNaN(foundMatchup.team2_score)) opponentScore = foundMatchup.team2_score;
                    } else if (foundMatchup.team2_roster_id && String(foundMatchup.team2_roster_id) === String(rosterId)) { // V1 style (current roster is team2)
                        if (typeof foundMatchup.team1_score === 'number' && !isNaN(foundMatchup.team1_score)) opponentScore = foundMatchup.team1_score;
                    }
                }

                // Regular season head-to-head stats (points for/against, wins/losses/ties, blowout/slim)
                if (isRegularSeasonMatch && typeof opponentScore === 'number' && !isNaN(opponentScore)) {
                    currentTeamStats.pointsFor += currentTeamScoreInWeek;
                    currentTeamStats.pointsAgainst += opponentScore;
                    currentTeamStats.totalGames++; // Increment regular season games played
                    currentTeamStats.actualWinsRecord += (currentTeamScoreInWeek > opponentScore ? 1 : (currentTeamScoreInWeek === opponentScore ? 0.5 : 0)); // Actual regular season wins (for luck)

                    if (currentTeamScoreInWeek > opponentScore) {
                        currentTeamStats.wins++;
                    } else if (currentTeamScoreInWeek < opponentScore) {
                        currentTeamStats.losses++;
                    } else {
                        currentTeamStats.ties++;
                    }

                    // --- NEW BLOWOUT/SLIM WIN/LOSS LOGIC ---
                    if (opponentScore > 0) { // Only apply percentage-based rules if opponentScore is positive
                        // Most Blowout Wins: win by more than 40% opponent score
                        if (currentTeamScoreInWeek > (opponentScore * 1.40)) {
                            currentTeamStats.blowoutWins++;
                            if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].blowoutWins++;
                        }
                        // Most Blowout Losses: loss by more than 40% opponent score
                        else if (currentTeamScoreInWeek < (opponentScore * 0.60)) {
                            currentTeamStats.blowoutLosses++;
                            if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].blowoutLosses++;
                        }
                        // Most Slim Wins: win by less than 2.5% opponent score
                        else if (currentTeamScoreInWeek > opponentScore && (currentTeamScoreInWeek - opponentScore) < (opponentScore * 0.025)) {
                            currentTeamStats.slimWins++;
                            if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].slimWins++;
                        }
                        // Most Slim Losses: loss by less than 2.5% opponent score
                        else if (currentTeamScoreInWeek < opponentScore && (opponentScore - currentTeamScoreInWeek) < (opponentScore * 0.025)) {
                            currentTeamStats.slimLosses++;
                            if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].slimLosses++;
                        }
                    }
                    // --- END NEW BLOWOUT/SLIM LOGIC ---


                    // Aggregate regular season stats to career (already done in weekly loop for points, wins, losses, ties, games)
                    if (careerTeamStatsRaw[ownerId]) {
                        careerTeamStatsRaw[ownerId].pointsFor += currentTeamScoreInWeek;
                        careerTeamStatsRaw[ownerId].pointsAgainst += opponentScore;
                        careerTeamStatsRaw[ownerId].totalGames++;
                        careerTeamStatsRaw[ownerId].wins += (currentTeamScoreInWeek > opponentScore ? 1 : 0);
                        careerTeamStatsRaw[ownerId].losses += (currentTeamScoreInWeek < opponentScore ? 1 : 0);
                        careerTeamStatsRaw[ownerId].ties += (currentTeamScoreInWeek === opponentScore ? 1 : 0);
                    }

                } else if (isRegularSeasonMatch && (!foundMatchup || typeof opponentScore !== 'number' || isNaN(opponentScore))) {
                       // Log if a regular season matchup was expected but opponent score was invalid
                       // This could indicate a bye week that still contributes to totalGames but not to opponent stats
                       // console.warn(`      Roster ID ${rosterId} in week ${week}, year ${year}: Regular season match expected but opponent score invalid.`);
                }
            });
        }); // End of sortedWeeks.forEach

        console.log(`  Finished weekly matchup processing for ${year}.`);


        // --- Phase 3: Post-process year stats for calculations and final structure ---
        seasonalMetrics[year] = {};
        const rosterIdsInSeason = Object.keys(yearStatsRaw);
        console.log(`  Starting seasonal post-processing for ${year}. Teams: ${rosterIdsInSeason.length}`);


        rosterIdsInSeason.forEach(rosterId => {
            const stats = yearStatsRaw[rosterId];
            const ownerId = stats.ownerId;

            const averageScore = stats.totalGames > 0 ? stats.pointsFor / stats.totalGames : 0;
            const winPercentage = stats.totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            const rawDPR = calculateRawDPR(
                averageScore,
                stats.highScore !== -Infinity ? stats.highScore : 0,
                stats.lowScore !== Infinity ? stats.lowScore : 0,
                winPercentage
            );

            // Seasonal Luck Rating: Actual wins - Expected wins (sum of weekly expected wins)
            // Note: actualWinsRecord already factors in 0.5 for ties
            const seasonalLuckRating = stats.actualWinsRecord - stats.seasonalExpectedWinsSum;

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
                luckRating: seasonalLuckRating,
                allPlayWinPercentage: (stats.allPlayWins + (stats.allPlayTies * 0.5)) / (stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies) || 0,
                topScoreWeeksCount: stats.topScoreWeeksCount,
                blowoutWins: stats.blowoutWins,
                blowoutLosses: stats.blowoutLosses,
                slimWins: stats.slimWins,
                slimLosses: stats.slimLosses,
                weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount,
                adjustedDPR: 0, // Calculated after all raw DPRs for the season are known
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
            if (seasonalMetrics[year][rankedTeam.rosterId]) {
                seasonalMetrics[year][rankedTeam.rosterId].rank = index + 1;
                // These trophy flags will be *overlaid* by playoff results from SleeperMatchupTester, if used.
                // For now, they represent regular season rank.
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
    }); // End of allYears.forEach loop

    // --- Phase 4: Finalize career stats and calculate overall percentages/DPR ---
    console.log("--- Starting career data finalization ---");
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

        // Career Luck Rating: Actual Career Wins - Total Expected Wins from all-play across career
        const careerLuckRating = stats.actualCareerWinsRecord - stats.careerExpectedWinsSum;

        // Calculate highest/lowest seasonal points avg for career data
        let highestSeasonalPointsAvg = 0;
        let lowestSeasonalPointsAvg = Infinity;
        Object.keys(seasonalMetrics).forEach(year => {
            const seasonalTeams = Object.values(seasonalMetrics[year]);
            const teamSeasonalStats = seasonalTeams.find(team => team.ownerId === ownerId);

            if (teamSeasonalStats && teamSeasonalStats.totalGames > 0) {
                const currentSeasonalAvg = teamSeasonalStats.pointsFor / teamSeasonalStats.totalGames;
                highestSeasonalPointsAvg = Math.max(highestSeasonalPointsAvg, currentSeasonalAvg);
                lowestSeasonalPointsAvg = Math.min(lowestSeasonalPointsAvg, currentSeasonalAvg);
            }
        });
        if (lowestSeasonalPointsAvg === Infinity) lowestSeasonalPointsAvg = 0;

        finalCareerDPRData.push({
            ownerId: ownerId,
            teamName: stats.teamName,
            dpr: careerRawDPR,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.pointsFor,
            pointsAgainst: stats.pointsAgainst,
            averageScore: careerAverageScore,
            winPercentage: careerWinPercentage,
            totalGames: stats.totalGames,
            allPlayWinPercentage: careerAllPlayWinPercentage,
            topScoreWeeksCount: stats.topScoreWeeksCount,
            blowoutWins: stats.blowoutWins,
            blowoutLosses: stats.blowoutLosses,
            slimWins: stats.slimWins,
            slimLosses: stats.slimLosses,
            weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount,
            highScore: careerHighScore,
            lowScore: careerLowScore,
            totalLuckRating: careerLuckRating,
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
    console.log("Final seasonalMetrics keys:", Object.keys(seasonalMetrics));
    console.log("Final careerDPRData count:", finalCareerDPRData.length);
    if (finalCareerDPRData.length > 0) {
        console.log("Sample careerDPRData entry (after adjustment):", finalCareerDPRData[0]);
    }


    return { seasonalMetrics, careerDPRData: finalCareerDPRData };
};
