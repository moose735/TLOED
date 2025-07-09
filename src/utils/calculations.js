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

        const playoffStartWeek = leagueMetadata.settings?.playoff_start_week ? parseInt(leagueMetadata.settings.playoff_start_week) : 99;
        console.log(`  Playoff start week for ${year}: ${playoffStartWeek}`);

        const rosterIdToOwnerId = {};
        rosters.forEach(roster => {
            if (roster.owner_id) {
                rosterIdToOwnerId[roster.roster_id] = roster.owner_id;
            }
        });
        console.log(`  Roster to Owner ID map for ${year} (sample):`, Object.fromEntries(Object.entries(rosterIdToOwnerId).slice(0, 5)));


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
            if (!careerTeamStatsRaw[ownerId]) {
                careerTeamStatsRaw[ownerId] = {
                    teamName: getTeamName(ownerId, null),
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
                // console.warn(`    Week ${week} in ${year} has no matchups. Skipping.`);
                return;
            }

            // Determine if this is a regular season week
            const isRegularSeasonMatch = (week < playoffStartWeek && !isNaN(week));

            // --- Step 1: Collect all scores for the current week ---
            const weekScoresForAllTeams = [];
            const processedRosterIdsInWeek = new Set();

            weeklyMatchups.forEach(m => {
                let rosterId, points;
                // Prefer Sleeper V2 style if available
                if (m.roster_id && typeof m.points === 'number' && !isNaN(m.points)) {
                    rosterId = String(m.roster_id);
                    points = m.points;
                }
                // Fallback to Sleeper V1 style if V2 is not found or invalid for team1
                else if (m.team1_roster_id && typeof m.team1_points === 'number' && !isNaN(m.team1_points)) {
                    rosterId = String(m.team1_roster_id);
                    points = m.team1_points;
                }

                if (rosterId && typeof points === 'number' && !processedRosterIdsInWeek.has(rosterId) && yearStatsRaw[rosterId]) {
                    weekScoresForAllTeams.push({ roster_id: rosterId, score: points });
                    processedRosterIdsInWeek.add(rosterId);
                }

                // Also check for Team 2 in V1 style
                if (m.team2_roster_id && typeof m.team2_points === 'number' && !isNaN(m.team2_points)) {
                    rosterId = String(m.team2_roster_id);
                    points = m.team2_points;
                    if (rosterId && typeof points === 'number' && !processedRosterIdsInWeek.has(rosterId) && yearStatsRaw[rosterId]) {
                        weekScoresForAllTeams.push({ roster_id: rosterId, score: points });
                        processedRosterIdsInWeek.add(rosterId);
                    }
                }
            });

            if (weekScoresForAllTeams.length === 0) {
                // console.warn(`    Week ${week} in ${year}: No valid scores collected for any team. Skipping weekly calculations.`);
                return;
            }

            const highestScoreInWeek = weekScoresForAllTeams.reduce((max, team) => Math.max(max, team.score), -Infinity);
            const sortedWeekScores = [...weekScoresForAllTeams].sort((a, b) => b.score - a.score);
            const top2ScoresValues = [sortedWeekScores[0]?.score, sortedWeekScores[1]?.score].filter(s => typeof s === 'number');

            // console.log(`    Week ${week} in ${year}: Highest Score = ${highestScoreInWeek}, Top 2 Scores = [${top2ScoresValues.join(', ')}]`);

            // --- Step 2: Process each roster's performance in the current week ---
            Object.keys(yearStatsRaw).forEach(rosterId => {
                const currentTeamStats = yearStatsRaw[rosterId];
                const ownerId = currentTeamStats.ownerId; // Already confirmed ownerId exists during initialization

                const currentTeamScoreInWeek = weekScoresForAllTeams.find(s => String(s.roster_id) === String(rosterId))?.score;

                if (typeof currentTeamScoreInWeek !== 'number' || isNaN(currentTeamScoreInWeek)) {
                    // This team did not play a valid scoring game this week, or their score was invalid.
                    // console.warn(`      Roster ID ${rosterId} in week ${week}, year ${year} has no valid score. Skipping detailed weekly stats for this team.`);
                    return;
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
                            weeklyExpectedWins += 0.5; // Tie counts as 0.5 expected win for all-play
                        }
                    }
                });

                // Accumulate expected wins for seasonal luck calculation
                if (isRegularSeasonMatch) {
                    currentTeamStats.seasonalExpectedWinsSum += weeklyExpectedWins;
                }

                // Weekly High Score / Top 2 Score (only for regular season)
                if (isRegularSeasonMatch) {
                    if (currentTeamScoreInWeek === highestScoreInWeek) {
                        currentTeamStats.topScoreWeeksCount++;
                    }
                    if (top2ScoresValues.includes(currentTeamScoreInWeek)) {
                        currentTeamStats.weeklyTop2ScoresCount++;
                    }
                }

                // Find the specific matchup for this team to get opponent score for head-to-head stats
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
                } else if (!isRegularSeasonMatch) { // It's a playoff week
                    if (foundMatchup) { // Mark as playoff team if they actually had a matchup entry in playoff week
                        currentTeamStats.isPlayoffTeam = true;
                    }
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

            // Seasonal Luck Rating: Actual wins - Expected wins (based on all-play average for the season)
            const seasonalLuckRating = stats.actualWinsRecord - (stats.allPlayWins + (stats.allPlayTies * 0.5));


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

            // Aggregate to career stats (moved here to ensure seasonal data is complete)
            if (careerTeamStatsRaw[ownerId]) {
                careerTeamStatsRaw[ownerId].actualCareerWinsRecord += stats.actualWinsRecord;
                careerTeamStatsRaw[ownerId].careerExpectedWinsSum += (stats.allPlayWins + (stats.allPlayTies * 0.5)); // Aggregate expected wins for career luck
                // Other career stats (wins, losses, points, etc.) were aggregated in the weekly loop
            } else {
                console.error(`  Owner ID ${ownerId} for roster ${rosterId} in year ${year} not found in careerTeamStatsRaw during post-processing. This indicates an issue in initialization.`);
            }
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
        // Need to iterate through seasonalMetrics to find relevant data for this owner
        Object.keys(seasonalMetrics).forEach(year => {
            const seasonalTeams = Object.values(seasonalMetrics[year]);
            const teamSeasonalStats = seasonalTeams.find(team => team.ownerId === ownerId);

            if (teamSeasonalStats && teamSeasonalStats.totalGames > 0) {
                const currentSeasonalAvg = teamSeasonalStats.pointsFor / teamSeasonalStats.totalGames;
                highestSeasonalPointsAvg = Math.max(highestSeasonalPointsAvg, currentSeasonalAvg);
                lowestSeasonalPointsAvg = Math.min(lowestSeasonalPointsAvg, currentSeasonalAvg);
            }
        });
        if (lowestSeasonalPointsAvg === Infinity) lowestSeasonalPointsAvg = 0; // If no games played, set to 0

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
        console.log("Sample careerDPRData entry:", finalCareerDPRData[0]);
    }


    return { seasonalMetrics, careerDPRData: finalCareerDPRData };
};
