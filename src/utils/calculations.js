// src/utils/calculations.js
import { calculatePlayoffFinishes } from './playoffRankings'; // Import the playoff calculation function

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
 * @param {Object} historicalData - The full historical data object (matchups, rosters, users, leaguesMetadata, brackets).
 * @param {Object} draftHistory - The draft history data.
 * @param {Function} getTeamName - A function (from context) to get the display name of a team given ownerId and/or rosterId/year.
 * @param {Object} nflState - The current NFL state, including the current season.
 * @returns {Object} An object containing seasonalMetrics and careerDPRData.
 */
export const calculateAllLeagueMetrics = (historicalData, draftHistory, getTeamName, nflState) => {
    const seasonalMetrics = {}; // Final structured data for each season
    const careerTeamStatsRaw = {}; // Aggregated raw career stats, keyed by ownerId

    if (!historicalData || Object.keys(historicalData).length === 0) {
        // No historical data provided or it's empty. Returning empty metrics.
        return { seasonalMetrics: {}, careerDPRData: [] };
    }

    const allYears = Object.keys(historicalData.matchupsBySeason || {}).map(Number).sort((a, b) => a - b);

    if (allYears.length === 0) {
        // No years found in historicalData.matchupsBySeason. Returning empty metrics.
        return { seasonalMetrics: {}, careerDPRData: [] };
    }

    // Get the current NFL season from nflState, default to current year if not available
    const currentNFLSeason = nflState?.season ? parseInt(nflState.season) : new Date().getFullYear();

    // Determine if the latest season's playoffs are complete
    // This is used for conditional aggregation of career awards, not for seasonal awards
    let isLatestSeasonPlayoffsComplete = false;
    const latestSeason = allYears.length > 0 ? Math.max(...allYears) : null;
    if (latestSeason && historicalData.winnersBracketBySeason[latestSeason]) {
        const winnersBracketForLatestSeason = historicalData.winnersBracketBySeason[latestSeason];
        const championshipMatch = winnersBracketForLatestSeason.find(match => match.p === 1);
        if (championshipMatch && championshipMatch.w && championshipMatch.l) {
            isLatestSeasonPlayoffsComplete = true;
        }
    }


    allYears.forEach(year => {
        // `matchups` is now expected to be a flat array of all matchups for the year
        const matchups = historicalData.matchupsBySeason[year];
        const leagueMetadata = historicalData.leaguesMetadataBySeason[year];
        const rosters = historicalData.rostersBySeason[year];
        const users = historicalData.usersBySeason[year];
        const winnersBracket = historicalData.winnersBracketBySeason[year]; // Get winners bracket
        const losersBracket = historicalData.losersBracketBySeason[year];


        if (!matchups || !leagueMetadata || !rosters || !users) {
            console.error(`calculateAllLeagueMetrics: Missing critical data for year ${year}. Skipping this year.`);
            return; // Skip this year if data is incomplete
        }

        // Use parseInt with a fallback if playoff_start_week is missing or invalid
        const playoffStartWeek = parseInt(leagueMetadata.settings?.playoff_start_week) || 15;

        // Determine if the current 'year' being processed is completed for playoff awards
        let isCurrentYearPlayoffsComplete = false;
        if (year < currentNFLSeason) {
            isCurrentYearPlayoffsComplete = true; // Past seasons are always complete
        } else if (year === currentNFLSeason) {
            // For the current NFL season, check if the championship match has a winner and loser
            const championshipMatch = winnersBracket?.find(bm => bm.p === 1);
            if (championshipMatch && championshipMatch.w && championshipMatch.l) {
                isCurrentYearPlayoffsComplete = true;
            }
        }


        // Initialize seasonal stats for each roster in the current year
        const yearStatsRaw = {};
        rosters.forEach(roster => {
            const ownerId = roster.owner_id;
            const rosterId = roster.roster_id; // Get rosterId here

            if (!ownerId || !rosterId) { // Check both ownerId and rosterId
                console.warn(`Roster entry in year ${year} is missing owner_id or roster_id. Skipping initialization. Roster:`, roster);
                return; // Skip this roster if no owner_id or roster_id
            }

            const teamName = getTeamName(ownerId, year); // Ensure getTeamName is called with ownerId and year

            yearStatsRaw[rosterId] = { // Use rosterId as the key
                teamName,
                ownerId,
                rosterId: rosterId, // Assign the local rosterId variable
                wins: 0,
                losses: 0,
                ties: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                totalGames: 0, // Total games (regular season + playoffs)
                allPlayWins: 0,
                allPlayLosses: 0,
                allPlayTies: 0,
                weeklyScores: [], // Store all weekly scores for this roster for seasonal high/low/avg
                highScore: -Infinity,
                lowScore: Infinity,
                topScoreWeeksCount: 0, // Regular season only
                blowoutWins: 0, // Regular season only
                blowoutLosses: 0, // Regular season only
                slimWins: 0, // Regular season only
                slimLosses: 0, // Regular season only
                weeklyTop2ScoresCount: 0, // Regular season only
                actualWinsRecord: 0, // Actual regular season wins (for luck calculation)
                seasonalExpectedWinsSum: 0, // Accumulates expected wins for luck calculation for THIS season
                rank: 'N/A', // Initialize rank
                pointsRank: 'N/A', // Initialize points rank
                isChampion: false,
                isRunnerUp: false,
                isThirdPlace: false,
                isPointsChampion: false, // Initialize points award flags
                isPointsRunnerUp: false,
                isThirdPlacePoints: false,
            };

            // Initialize career stats for each owner if not already present
            // This block remains here to initialize careerTeamStatsRaw for an owner ONLY if they haven't appeared in a previous year
            if (!careerTeamStatsRaw[ownerId]) {
                careerTeamStatsRaw[ownerId] = {
                    teamName: getTeamName(ownerId, null), // Career team name (using null for year to get overall name)
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
                    highScore: -Infinity, // Initialize career high score
                    lowScore: Infinity,    // Initialize career low score
                    topScoreWeeksCount: 0,
                    blowoutWins: 0,
                    blowoutLosses: 0,
                    slimWins: 0,
                    slimLosses: 0,
                    weeklyTop2ScoresCount: 0,
                    actualCareerWinsRecord: 0,
                    careerExpectedWinsSum: 0, // Accumulates expected wins for overall career luck
                    // Initialize career award counts
                    championships: 0,
                    runnerUps: 0,
                    thirdPlaces: 0,
                    firstPoints: 0,
                    secondPoints: 0,
                    thirdPoints: 0,
                    playoffAppearancesCount: 0,
                    totalLuckRating: 0,
                    totalDPRSum: 0, // For calculating career avg DPR
                    seasonsWithDPRData: 0, // For calculating career avg DPR
                };
            }
        });

        // Determine the total number of weeks in this season (regular + playoffs)
        const maxPlayoffRound = Math.max(
            // Ensure winnersBracket and losersBracket are arrays before calling reduce
            (winnersBracket || []).reduce((max, match) => Math.max(max, match.r || 0), 0),
            (losersBracket || []).reduce((max, match) => Math.max(max, match.r || 0), 0)
        );
        // Assuming regular season goes up to playoffStartWeek - 1, and playoffs run for maxPlayoffRound weeks
        // If playoffStartWeek is 15, and maxPlayoffRound is 3, then weeks are 1-14 (regular), 15, 16, 17 (playoffs)
        const totalWeeksInSeason = (playoffStartWeek - 1) + maxPlayoffRound;

        // Create maps for quick lookup of scores and matchup details by rosterId and week
        const scoresByRosterIdAndWeek = new Map(); // Map: rosterId -> Map: week -> score
        // Modified to include hasOpponent flag
        const matchupsByRosterIdAndWeek = new Map(); // Map: rosterId -> Map: week -> { opponentScore, isRegularSeasonMatch, hasOpponent }

        // Populate scoresByRosterIdAndWeek and matchupsByRosterIdAndWeek from `matchups` (which is now a flat array)
        matchups.forEach(m => { // Iterate directly over the flattened matchups array
            const week = parseInt(m.week); // Get week from the matchup object itself
            const isRegularSeasonMatch = (week < playoffStartWeek && !isNaN(week));

            // Handle head-to-head matchups
            if (m.team1_roster_id && m.team2_roster_id) {
                const rosterId1 = String(m.team1_roster_id);
                const rosterId2 = String(m.team2_roster_id);
                const score1 = parseFloat(m.team1_score);
                const score2 = parseFloat(m.team2_score);

                // Store score for rosterId1
                if (!scoresByRosterIdAndWeek.has(rosterId1)) scoresByRosterIdAndWeek.set(rosterId1, new Map());
                scoresByRosterIdAndWeek.get(rosterId1).set(week, score1);

                // Store matchup details for rosterId1 (opponent is score2, hasOpponent: true)
                if (!matchupsByRosterIdAndWeek.has(rosterId1)) matchupsByRosterIdAndWeek.set(rosterId1, new Map());
                matchupsByRosterIdAndWeek.get(rosterId1).set(week, { opponentScore: score2, isRegularSeasonMatch, hasOpponent: true });

                // Store score for rosterId2
                if (!scoresByRosterIdAndWeek.has(rosterId2)) scoresByRosterIdAndWeek.set(rosterId2, new Map());
                scoresByRosterIdAndWeek.get(rosterId2).set(week, score2);

                // Store matchup details for rosterId2 (opponent is score1, hasOpponent: true)
                if (!matchupsByRosterIdAndWeek.has(rosterId2)) matchupsByRosterIdAndWeek.set(rosterId2, new Map());
                matchupsByRosterIdAndWeek.get(rosterId2).set(week, { opponentScore: score1, isRegularSeasonMatch, hasOpponent: true });
            }
            // Handle bye weeks where team2_roster_id is null
            else if (m.team1_roster_id && m.team2_roster_id === null) {
                const rosterId1 = String(m.team1_roster_id);
                const score1 = parseFloat(m.team1_score);

                // Store score for rosterId1 (this is the score for the bye week)
                if (!scoresByRosterIdAndWeek.has(rosterId1)) scoresByRosterIdAndWeek.set(rosterId1, new Map());
                scoresByRosterIdAndWeek.get(rosterId1).set(week, score1);

                // For bye weeks, opponent score is 0 and it's a regular season match, but hasOpponent is false
                if (!matchupsByRosterIdAndWeek.has(rosterId1)) matchupsByRosterIdAndWeek.set(rosterId1, new Map());
                matchupsByRosterIdAndWeek.get(rosterId1).set(week, { opponentScore: 0, isRegularSeasonMatch, hasOpponent: false });
            }
        });

        // Collect all weekly scores for all teams in this season to calculate all-play and high/low for the week
        const allScoresInSeasonByWeek = new Map(); // week -> [{ rosterId, score }]
        matchups.forEach(m => { // Iterate directly over the flattened matchups array
            const week = parseInt(m.week);
            if (!allScoresInSeasonByWeek.has(week)) {
                allScoresInSeasonByWeek.set(week, []);
            }
            // Assuming m is already processed into team1/team2 structure
            if (m.team1_roster_id && m.team1_score !== undefined && !isNaN(m.team1_score)) {
                allScoresInSeasonByWeek.get(week).push({ roster_id: String(m.team1_roster_id), score: parseFloat(m.team1_score) });
            }
            // Only add team2 if it's not a bye (team2_roster_id is not null)
            if (m.team2_roster_id && m.team2_score !== undefined && !isNaN(m.team2_score)) {
                allScoresInSeasonByWeek.get(week).push({ roster_id: String(m.team2_roster_id), score: parseFloat(m.team2_score) });
            }
        });


        // Now, iterate through each roster and then through all possible weeks
        Object.keys(yearStatsRaw).forEach(rosterId => {
            const currentTeamStats = yearStatsRaw[rosterId];
            const ownerId = currentTeamStats.ownerId;

            for (let week = 1; week <= totalWeeksInSeason; week++) {
                const currentTeamScoreInWeek = scoresByRosterIdAndWeek.get(rosterId)?.get(week);
                const matchupDetailsInWeek = matchupsByRosterIdAndWeek.get(rosterId)?.get(week);

                const hasValidWeeklyScore = typeof currentTeamScoreInWeek === 'number' && !isNaN(currentTeamScoreInWeek);
                const opponentScore = matchupDetailsInWeek?.opponentScore;
                const isRegularSeasonMatch = matchupDetailsInWeek?.isRegularSeasonMatch;
                const hasOpponent = matchupDetailsInWeek?.hasOpponent; // Get the new flag

                // Always add a score to weeklyScores, even if it's 0 for a bye or missing
                const scoreToAdd = hasValidWeeklyScore ? currentTeamScoreInWeek : 0;
                currentTeamStats.weeklyScores.push(scoreToAdd);
                // Always add to pointsFor, even if it's 0 for a bye
                currentTeamStats.pointsFor += scoreToAdd;
                
                // Update high/low score based on actual valid scores
                if (hasValidWeeklyScore) {
                    currentTeamStats.highScore = Math.max(currentTeamStats.highScore, currentTeamScoreInWeek);
                    currentTeamStats.lowScore = Math.min(currentTeamStats.lowScore, currentTeamScoreInWeek);
                }

                // Update career weekly scores for the owner (these are cumulative across all weeks/seasons)
                if (careerTeamStatsRaw[ownerId]) {
                    careerTeamStatsRaw[ownerId].careerWeeklyScores.push(scoreToAdd);
                }


                // Only update wins/losses/ties, pointsAgainst, and totalGames if there was an actual opponent
                // MODIFIED CONDITION: Use hasOpponent flag
                if (hasOpponent) {
                    currentTeamStats.pointsAgainst += opponentScore;
                    currentTeamStats.totalGames++; // Increment total games played (with an opponent)

                    // Accumulate wins/losses/ties
                    if (currentTeamScoreInWeek > opponentScore) {
                        currentTeamStats.wins++;
                    } else if (currentTeamScoreInWeek < opponentScore) {
                        currentTeamStats.losses++;
                    } else {
                        currentTeamStats.ties++;
                    }

                    // Regular season specific stats (all-play, blowout/slim, top score weeks)
                    if (isRegularSeasonMatch) {
                        const weekScoresForAllTeams = allScoresInSeasonByWeek.get(week) || [];
                        let weeklyAllPlayWinsCount = 0;
                        let weeklyAllPlayTiesCount = 0;
                        let opponentsCount = 0; // Count of actual opponents for this week

                        weekScoresForAllTeams.forEach(otherTeamScore => {
                            if (String(otherTeamScore.roster_id) !== String(rosterId)) {
                                opponentsCount++; // Increment for each actual opponent
                                if (currentTeamScoreInWeek > otherTeamScore.score) {
                                    currentTeamStats.allPlayWins++;
                                    if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].allPlayWins++;
                                    weeklyAllPlayWinsCount++;
                                } else if (currentTeamScoreInWeek < otherTeamScore.score) {
                                    currentTeamStats.allPlayLosses++;
                                    if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].allPlayLosses++;
                                } else {
                                    currentTeamStats.allPlayTies++;
                                    if (careerTeamStatsRaw[ownerId]) careerTeamStatsRaw[ownerId].allPlayTies++;
                                    weeklyAllPlayTiesCount++;
                                }
                            }
                        });

                        // Calculate weeklyExpectedWins based on the new formula: (wins + 0.5 * ties) / total opponents
                        if (opponentsCount > 0) {
                            currentTeamStats.seasonalExpectedWinsSum += (weeklyAllPlayWinsCount + 0.5 * weeklyAllPlayTiesCount) / opponentsCount;
                        }

                        currentTeamStats.actualWinsRecord += (currentTeamScoreInWeek > opponentScore ? 1 : (currentTeamScoreInWeek === opponentScore ? 0.5 : 0));

                        // Weekly High Score / Top 2 Score (only for regular season)
                        const highestScoreInWeek = weekScoresForAllTeams.reduce((max, team) => Math.max(max, team.score), -Infinity);
                        const sortedWeekScores = [...weekScoresForAllTeams].sort((a, b) => b.score - a.score);
                        const top2ScoresValues = [];
                        if (sortedWeekScores[0]) top2ScoresValues.push(sortedWeekScores[0].score);
                        if (sortedWeekScores[1]) top2ScoresValues.push(sortedWeekScores[1].score);

                        if (currentTeamScoreInWeek === highestScoreInWeek) {
                            currentTeamStats.topScoreWeeksCount++;
                        }
                        if (top2ScoresValues.includes(currentTeamScoreInWeek)) {
                            currentTeamStats.weeklyTop2ScoresCount++;
                        }

                        // Blowout/Slim logic
                        if (opponentScore > 0) {
                            if (currentTeamScoreInWeek > (opponentScore * 1.40)) {
                                currentTeamStats.blowoutWins++;
                            } else if (currentTeamScoreInWeek < (opponentScore * 0.60)) {
                                currentTeamStats.blowoutLosses++;
                            } else if (currentTeamScoreInWeek > opponentScore && (currentTeamScoreInWeek - opponentScore) < (opponentScore * 0.025)) {
                                currentTeamStats.slimWins++;
                            } else if (currentTeamScoreInWeek < opponentScore && (opponentScore - currentTeamScoreInWeek) < (opponentScore * 0.025)) {
                                currentTeamStats.slimLosses++;
                            }
                        }
                    }
                }
            } // End of for loop for weeks
        }); // End of Object.keys(yearStatsRaw).forEach(rosterId => ... )


        // --- Phase 3: Post-process year stats for calculations and final structure ---
        seasonalMetrics[year] = {};
        const rosterIdsInSeason = Object.keys(yearStatsRaw);


        rosterIdsInSeason.forEach(rosterId => {
            const stats = yearStatsRaw[rosterId];
            const ownerId = stats.ownerId;

            // These calculations now correctly use stats that include both regular season and playoff games
            // averageScore now uses totalGames (games with opponent), not totalWeeksInSeason
            const averageScore = stats.totalGames > 0 ? stats.pointsFor / stats.totalGames : 0;
            const winPercentage = stats.totalGames > 0 ? ((stats.wins + 0.5 * stats.ties) / stats.totalGames) : 0;

            const rawDPR = calculateRawDPR(
                averageScore,
                stats.highScore !== -Infinity ? stats.highScore : 0,
                stats.lowScore !== Infinity ? stats.lowScore : 0,
                winPercentage
            );

            // Seasonal Luck Rating: Actual wins - Expected wins (sum of weekly expected wins)
            // Note: actualWinsRecord and seasonalExpectedWinsSum are still regular season only
            const seasonalLuckRating = stats.actualWinsRecord - stats.seasonalExpectedWinsSum;

            // Calculate seasonal all-play win percentage
            const seasonalAllPlayTotalGames = stats.allPlayWins + stats.allPlayLosses + stats.allPlayTies;
            const seasonalAllPlayWinPercentage = seasonalAllPlayTotalGames > 0 ?
                ((stats.allPlayWins + stats.allPlayTies * 0.5) / seasonalAllPlayTotalGames) : 0;

            seasonalMetrics[year][rosterId] = {
                teamName: stats.teamName,
                rosterId: rosterId, // Use stats.rosterId directly
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
                actualWinsRecord: stats.actualWinsRecord, // ADDED THIS LINE
                seasonalExpectedWinsSum: stats.seasonalExpectedWinsSum, // ADDED THIS LINE
                allPlayWins: stats.allPlayWins, // Add these for debugging
                allPlayLosses: stats.allPlayLosses,
                allPlayTies: stats.allPlayTies,
                allPlayWinPercentage: seasonalAllPlayWinPercentage, // Use the calculated seasonal percentage
                topScoreWeeksCount: stats.topScoreWeeksCount,
                blowoutWins: stats.blowoutWins,
                blowoutLosses: stats.blowoutLosses,
                slimWins: stats.slimWins,
                slimLosses: stats.slimLosses,
                weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount,
                adjustedDPR: 0, // Calculated after all raw DPRs for the season are known
                totalGames: stats.totalGames, // Now includes playoffs
                highScore: stats.highScore, // Now includes playoffs
                lowScore: stats.lowScore, // Now includes playoffs
                isPlayoffTeam: false,
                isChampion: false, // Reset to false, will be set by playoff results
                isRunnerUp: false,
                isThirdPlace: false,
                isPointsChampion: false, // Initialize points award flags
                isPointsRunnerUp: false,
                isThirdPlacePoints: false,
                rank: 'N/A', // Reset to N/A, will be set by playoff results
                pointsRank: 'N/A', // Will be set by points ranking
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

        // --- APPLY PLAYOFF FINISHES AND POINTS RANKING LOGIC (CONDITIONAL ON PLAYOFF COMPLETION) ---
        // Both playoff awards and points awards are assigned only if the season's playoffs are complete
        if (isCurrentYearPlayoffsComplete) {
            // POINTS RANKING LOGIC
            const teamsRawForPointsSorting = Object.values(seasonalMetrics[year]);

            const teamsSortedByPoints = teamsRawForPointsSorting
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
                const topTeamRosterId = teamsSortedByPoints[0].rosterId;
            } else {
            }

            // PLAYOFF FINISHES LOGIC
            if (winnersBracket && losersBracket && (winnersBracket.length > 0 || losersBracket.length > 0)) {
                const rosterIdToOwnerIdMap = new Map(rosters.map(r => [String(r.roster_id), String(r.owner_id)]));
                const playoffFinishes = calculatePlayoffFinishes(
                    { winnersBracket, losersBracket },
                    rosterIdToOwnerIdMap,
                    getTeamName,
                    parseInt(year),
                    yearStatsRaw
                );


                playoffFinishes.forEach(finishEntry => {
                    const rosterId = finishEntry.roster_id;
                    const rank = finishEntry.playoffFinish;

                    if (seasonalMetrics[year][rosterId]) {
                        seasonalMetrics[year][rosterId].rank = rank; // Set the actual playoff rank

                        seasonalMetrics[year][rosterId].isChampion = false;
                        seasonalMetrics[year][rosterId].isRunnerUp = false;
                        seasonalMetrics[year][rosterId].isThirdPlace = false;

                        if (rank === 1) {
                            seasonalMetrics[year][rosterId].isChampion = true;
                        } else if (rank === 2) {
                            seasonalMetrics[year][rosterId].isRunnerUp = true;
                        } else if (rank === 3) {
                            seasonalMetrics[year][rosterId].isThirdPlace = true;
                        }
                    }
                });
                console.log(`calculations.js: Playoff/Points Award Flags for year ${year}:`); // NEW LOG
                Object.values(seasonalMetrics[year]).forEach(teamStats => {
                    console.log(`  Team: ${teamStats.teamName}, Champion: ${teamStats.isChampion}, RunnerUp: ${teamStats.isRunnerUp}, ThirdPlace: ${teamStats.isThirdPlace}, PointsChamp: ${teamStats.isPointsChampion}, PointsRunnerUp: ${teamStats.isPointsRunnerUp}, PointsThird: ${teamStats.isThirdPlacePoints}`);
                });
            } else {
                Object.keys(seasonalMetrics[year]).forEach(rosterId => {
                    seasonalMetrics[year][rosterId].isChampion = false;
                    seasonalMetrics[year][rosterId].isRunnerUp = false;
                    seasonalMetrics[year][rosterId].isThirdPlace = false;
                    seasonalMetrics[year][rosterId].rank = 'N/A';
                });
            }
        } else {
            // Ensure all playoff and points award flags remain false if not complete
            Object.keys(seasonalMetrics[year]).forEach(rosterId => {
                seasonalMetrics[year][rosterId].isChampion = false;
                seasonalMetrics[year][rosterId].isRunnerUp = false;
                seasonalMetrics[year][rosterId].isThirdPlace = false;
                seasonalMetrics[year][rosterId].isPointsChampion = false;
                seasonalMetrics[year][rosterId].isPointsRunnerUp = false;
                seasonalMetrics[year][rosterId].isThirdPlacePoints = false;
                seasonalMetrics[year][rosterId].rank = 'N/A';
                seasonalMetrics[year][rosterId].pointsRank = 'N/A'; // Also reset pointsRank
            });
        }

        // Store seasonal metrics
        // This is already done at the end of the year loop.
    }); // End of allYears.forEach loop


    // --- Phase 4: Finalize career stats and calculate overall percentages/DPR ---
    const finalCareerDPRData = [];
    const allCareerRawDPRs = [];

    Object.keys(careerTeamStatsRaw).forEach(ownerId => {
        const stats = careerTeamStatsRaw[ownerId];

        // Reset career stats before re-aggregation to prevent double-counting across useEffect runs
        stats.wins = 0;
        stats.losses = 0;
        stats.ties = 0;
        stats.pointsFor = 0;
        stats.pointsAgainst = 0;
        stats.totalGames = 0;
        stats.allPlayWins = 0;
        stats.allPlayLosses = 0;
        stats.allPlayTies = 0;
        stats.careerWeeklyScores = []; // This needs to be re-populated from seasonal data
        stats.topScoreWeeksCount = 0;
        stats.blowoutWins = 0;
        stats.blowoutLosses = 0;
        stats.slimWins = 0;
        stats.slimLosses = 0;
        stats.weeklyTop2ScoresCount = 0;
        stats.actualCareerWinsRecord = 0;
        stats.careerExpectedWinsSum = 0;
        stats.championships = 0;
        stats.runnerUps = 0;
        stats.thirdPlaces = 0;
        stats.firstPoints = 0;
        stats.secondPoints = 0;
        stats.thirdPoints = 0;
        stats.playoffAppearancesCount = 0;
        stats.totalLuckRating = 0;
        stats.totalDPRSum = 0;
        stats.seasonsWithDPRData = 0;


        // Aggregate all stats from seasonalMetrics into careerTeamStatsRaw
        Object.keys(seasonalMetrics).forEach(yearStr => {
            const year = parseInt(yearStr);
            const seasonalStatsForYear = seasonalMetrics[year];
            if (seasonalStatsForYear) {
                const teamSeasonalData = Object.values(seasonalStatsForYear).find(s => s.ownerId === ownerId);
                if (teamSeasonalData) {
                    // Always aggregate core stats
                    stats.wins += teamSeasonalData.wins;
                    stats.losses += teamSeasonalData.losses;
                    stats.ties += teamSeasonalData.ties;
                    stats.pointsFor += teamSeasonalData.pointsFor;
                    stats.pointsAgainst += teamSeasonalData.pointsAgainst;
                    stats.totalGames += teamSeasonalData.totalGames;
                    stats.actualCareerWinsRecord += teamSeasonalData.actualWinsRecord;
                    stats.allPlayWins += teamSeasonalData.allPlayWins; // Re-aggregate all-play stats
                    stats.allPlayLosses += teamSeasonalData.allPlayLosses;
                    stats.allPlayTies += teamSeasonalData.allPlayTies;
                    stats.careerWeeklyScores.push(...(teamSeasonalData.weeklyScores || [])); // Aggregate all weekly scores

                    // Directly aggregate awards based on the flags already set in seasonalMetrics
                    // These flags are already conditional on season completion.
                    stats.topScoreWeeksCount += (teamSeasonalData.topScoreWeeksCount || 0);
                    stats.blowoutWins += (teamSeasonalData.blowoutWins || 0);
                    stats.blowoutLosses += (teamSeasonalData.blowoutLosses || 0);
                    stats.slimWins += (teamSeasonalData.slimWins || 0);
                    stats.slimLosses += (teamSeasonalData.slimLosses || 0);
                    stats.weeklyTop2ScoresCount += (teamSeasonalData.weeklyTop2ScoresCount || 0);
                    stats.totalLuckRating += (teamSeasonalData.luckRating || 0);
                    stats.careerExpectedWinsSum += (teamSeasonalData.seasonalExpectedWinsSum || 0); // Aggregate seasonal expected wins

                    // Playoff appearances are now counted only if rank is 1-6 (winners bracket)
                    if (typeof teamSeasonalData.rank === 'number' && teamSeasonalData.rank <= 6) {
                        stats.playoffAppearancesCount++;
                    }
                    if (teamSeasonalData.isChampion) stats.championships++;
                    if (teamSeasonalData.isRunnerUp) stats.runnerUps++;
                    if (teamSeasonalData.isThirdPlace) stats.thirdPlaces++;
                    if (teamSeasonalData.isPointsChampion) stats.firstPoints++;
                    if (teamSeasonalData.isPointsRunnerUp) stats.secondPoints++;
                    if (teamSeasonalData.isThirdPlacePoints) stats.thirdPoints++;

                    // Only include a season's DPR in the career average if the team played games in that season
                    if (teamSeasonalData.adjustedDPR !== undefined && teamSeasonalData.adjustedDPR !== null && teamSeasonalData.totalGames > 0) {
                        stats.totalDPRSum += teamSeasonalData.adjustedDPR;
                        stats.seasonsWithDPRData++;
                    }
                }
            }
        });


        // Calculate how many times this owner had the highest score in any week (all seasons)
        let weeklyHighScoreCount = 0;
        Object.values(seasonalMetrics).forEach(seasonMetrics => {
            // Build a map: week -> [{ ownerId, score }]
            const weekScores = {};
            Object.values(seasonMetrics).forEach(teamStats => {
                if (Array.isArray(teamStats.weeklyScores)) {
                    teamStats.weeklyScores.forEach((score, idx) => {
                        const week = idx + 1;
                        if (!weekScores[week]) weekScores[week] = [];
                        weekScores[week].push({ ownerId: teamStats.ownerId, score });
                    });
                }
            });

            // For each week, find the highest score and which owner(s) had it
            Object.entries(weekScores).forEach(([week, scoresArr]) => {
                let weekHigh = -Infinity;
                scoresArr.forEach(({ score }) => {
                    if (typeof score === 'number' && !isNaN(score)) {
                        if (score > weekHigh) weekHigh = score;
                    }
                });
                // Count all owners who had the high score this week (ties allowed)
                scoresArr.forEach(({ ownerId: oid, score }) => {
                    if (
                        oid === ownerId &&
                        typeof score === 'number' &&
                        !isNaN(score) &&
                        score === weekHigh &&
                        weekHigh !== -Infinity
                    ) {
                        weeklyHighScoreCount++;
                    }
                });
            });
        });

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
        Object.keys(seasonalMetrics).forEach(yearStr => { // Iterate through calculated seasonal metrics
            const year = parseInt(yearStr);
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
            allPlayWins: stats.allPlayWins, // Add these for debugging
            allPlayLosses: stats.allPlayLosses,
            allPlayTies: stats.allPlayTies,
            allPlayWinPercentage: careerAllPlayWinPercentage, // Use the calculated career percentage
            topScoreWeeksCount: stats.topScoreWeeksCount,
            blowoutWins: stats.blowoutWins,
            blowoutLosses: stats.blowoutLosses,
            slimWins: stats.slimWins,
            slimLosses: stats.slimLosses,
            weeklyTop2ScoresCount: stats.weeklyTop2ScoresCount,
            highScore: stats.careerWeeklyScores.length > 0 ? Math.max(...stats.careerWeeklyScores) : 0,
            lowScore: stats.careerWeeklyScores.length > 0 ? Math.min(...stats.careerWeeklyScores) : 0,
            weeklyHighScoreCount, // <-- Add the count here
            totalLuckRating: stats.totalLuckRating, // This is already conditionally aggregated
            highestSeasonalPointsAvg: highestSeasonalPointsAvg,
            lowestSeasonalPointsAvg: lowestSeasonalPointsAvg,
            // Include the conditionally aggregated award counts
            championships: stats.championships,
            runnerUps: stats.runnerUps,
            thirdPlaces: stats.thirdPlaces,
            pointsChampionships: stats.firstPoints,
            pointsRunnerUps: stats.secondPoints,
            thirdPlacePoints: stats.thirdPoints,
            playoffAppearancesCount: stats.playoffAppearancesCount,
            actualCareerWinsRecord: stats.actualCareerWinsRecord, // Ensure this is also passed
            careerExpectedWinsSum: stats.careerExpectedWinsSum, // Ensure this is also passed
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


    return { seasonalMetrics, careerDPRData: finalCareerDPRData };
};
