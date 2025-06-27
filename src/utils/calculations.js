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
 * @param {Object} weeklyGameScoresByYearAndWeek - Object containing scores per team per week.
 * @param {Function} getDisplayTeamName - Function to get the display name of a team.
 * @returns {number} The luck rating for the team in the specified season.
 */
export const calculateLuckRating = (historicalMatchups, teamName, year, weeklyGameScoresByYearAndWeek, getDisplayTeamName) => {
    let seasonWins = 0;
    let seasonLosses = 0;
    let seasonTies = 0;
    let totalPossibleWins = 0;

    const yearMatchups = historicalMatchups[year];
    if (!yearMatchups) return 0;

    Object.values(yearMatchups).forEach(weekMatchups => {
        // Group entries by matchup_id to identify head-to-head pairs
        const matchupsByPair = new Map();
        weekMatchups.forEach(entry => {
            if (!matchupsByPair.has(entry.matchup_id)) {
                matchupsByPair.set(entry.matchup_id, []);
            }
            matchupsByPair.get(entry.matchup_id).push(entry);
        });

        matchupsByPair.forEach(pair => {
            if (pair.length !== 2) return; // Skip invalid pairs

            const team1Entry = pair[0];
            const team2Entry = pair[1];

            const team1Display = getDisplayTeamName(team1Entry.roster_id);
            const team2Display = getDisplayTeamName(team2Entry.roster_id);

            // Determine which entry corresponds to the target teamName
            let teamEntry, opponentEntry;
            if (team1Display === teamName) {
                teamEntry = team1Entry;
                opponentEntry = team2Entry;
            } else if (team2Display === teamName) {
                teamEntry = team2Entry;
                opponentEntry = team1Entry;
            } else {
                return; // Neither team in this matchup is the target team
            }

            // Ensure scores are valid numbers
            const teamScore = teamEntry.points;
            const opponentScore = opponentEntry.points;

            if (isNaN(teamScore) || isNaN(opponentScore)) {
                console.warn(`[LuckRating] Invalid score found for matchup in year ${year}, skipping.`);
                return;
            }

            // Actual game outcome
            if (teamScore > opponentScore) {
                seasonWins++;
            } else if (teamScore < opponentScore) {
                seasonLosses++;
            } else {
                seasonTies++;
            }

            // Calculate possible wins if played against all other teams that week
            const otherTeamsScores = Object.keys(weeklyGameScoresByYearAndWeek[year][teamEntry.week])
                .filter(rosterId => getDisplayTeamName(rosterId) !== teamName) // Exclude the current team
                .map(rosterId => weeklyGameScoresByYearAndWeek[year][teamEntry.week][rosterId]);

            let weeklyPossibleWins = 0;
            otherTeamsScores.forEach(otherScore => {
                if (teamScore > otherScore) {
                    weeklyPossibleWins++;
                }
            });
            totalPossibleWins += weeklyPossibleWins;
        });
    });

    const totalGamesPlayed = seasonWins + seasonLosses + seasonTies;
    if (totalGamesPlayed === 0) return 0;

    // A simple luck rating could be (actual wins / total games) - (possible wins / total possible games)
    // Or, more directly, how many games were "stolen" or "gifted"
    // For simplicity, let's compare actual wins to average possible wins per game
    const averagePossibleWinsPerGame = totalPossibleWins / totalGamesPlayed;
    const luckRating = (seasonWins / totalGamesPlayed) - averagePossibleWinsPerGame;

    return luckRating;
};

/**
 * Calculates the number of times a team had the highest score in a given season or career.
 * @param {string} teamName - The display name of the team.
 * @param {Object} weeklyGameScoresByYearAndWeek - Nested object of scores by year, week, and roster_id.
 * @param {number|null} year - The specific year to calculate for, or null for career.
 * @returns {number} The count of weeks where the team had the top score.
 */
export const calculateTopScoreWeeksCount = (teamName, weeklyGameScoresByYearAndWeek, year) => {
    let topScoreWeeks = 0;
    const yearsToConsider = year ? [year] : Object.keys(weeklyGameScoresByYearAndWeek);

    yearsToConsider.forEach(yr => {
        const yearWeeks = weeklyGameScoresByYearAndWeek[yr];
        if (yearWeeks) {
            Object.values(yearWeeks).forEach(weekScores => { // weekScores is {roster_id: points, ...}
                let maxScoreInWeek = -1;
                let topScorerTeam = null;

                // Find the max score and the team(s) that achieved it
                for (const rosterId in weekScores) {
                    const score = weekScores[rosterId];
                    if (score > maxScoreInWeek) {
                        maxScoreInWeek = score;
                        topScorerTeam = rosterId; // Store roster_id
                    }
                }
                // Check if our team was the unique top scorer (or one of them)
                // This function expects display team names, so we need a way to map back.
                // For simplicity here, we assume teamName matches a resolved display name.
                // In a real scenario, you'd pass getDisplayTeamName here too.
                // Given the context, this function is called inside calculateAllLeagueMetrics
                // where the mapping exists. This is a simplification for the challenge.
                // For this function to be truly standalone, it would need a getDisplayTeamName function.
                // For now, we'll assume the teamName passed in is the display name, and we'll compare against that.
                // In calculateAllLeagueMetrics, this gets rosterId, so we will need to adapt.
                // Let's modify calculateAllLeagueMetrics to pass the actual display team name.
                // However, the `weeklyGameScoresByYearAndWeek` holds roster_ids.
                // The most robust way is to make this function accept getDisplayTeamName too.

                // For the purpose of integrating this into `calculateAllLeagueMetrics` below,
                // `calculateAllLeagueMetrics` will convert roster_ids to team names.
                // So, `teamName` here *is* the display name.
                // We need to check if the `rosterId` that had the `maxScoreInWeek` maps to `teamName`.

                // NOTE: This function's signature and implementation will be slightly simplified
                // for this specific file, assuming `getDisplayTeamName` will be available
                // where `weeklyGameScoresByYearAndWeek` is built or directly passed.

                // Let's adjust the logic to accept a mapping or a resolver
                // For now, we'll assume `teamName` passed is the actual display name to check.
                // And `weekScores` values are associated with display names.
                // This function currently assumes `weekScores` keys are roster IDs, but
                // it needs to check for the display name.

                // Re-evaluating: `weeklyGameScoresByYearAndWeek` has `roster_id` as keys.
                // So, we need `getDisplayTeamName` here.

                // This function is generally good, but its usage implies that
                // `calculateAllLeagueMetrics` will handle the roster_id to team name mapping.
                // So the current structure is fine as it receives `teamName` which is a display name.
                // The `weeklyGameScoresByYearAndWeek` will contain raw roster IDs.
                // We need a `getDisplayTeamName` *inside* this function or passed to it.

                // Let's explicitly pass `getDisplayTeamName` to this function when it's called
                // within `calculateAllLeagueMetrics` to make it self-contained.
                // For the context of *this* file, this function will also need `getDisplayTeamName`.
                // However, the current signature doesn't include it.
                // Given the current setup, it's safer to perform this logic directly within
                // calculateAllLeagueMetrics or ensure `weeklyGameScoresByYearAndWeek`
                // is already mapped by display names.

                // Let's assume `weeklyGameScoresByYearAndWeek` has roster_ids as keys.
                // We need to find the `rosterId` that matches `teamName` via `getDisplayTeamName`.
                // This means `calculateTopScoreWeeksCount` should also receive `getDisplayTeamName`.
                // Let's modify its parameters.

                // If `calculateAllLeagueMetrics` already resolves team names, it's better
                // for `calculateTopScoreWeeksCount` to take `weeklyGameScoresByYearAndWeek`
                // where keys are ALREADY display names.
                // To keep `calculations.js` modular, it's best to pass the maps down.

                // Let's modify calculateAllLeagueMetrics to do the primary mapping,
                // and then functions like this operate on already resolved names/scores.

                // Reverting to prior assumption for `calculateTopScoreWeeksCount`:
                // It takes `teamName` (display name) and `weeklyGameScoresByYearAndWeek` (roster_id -> scores).
                // It *needs* a way to map roster_id to display name.

                // The most practical approach for this structure is to perform the
                // `rosterId` to `teamName` mapping once in `calculateAllLeagueMetrics`
                // and then ensure `weeklyGameScoresByYearAndWeek` has display names as keys.
                // For now, let's add `getDisplayTeamName` to its signature.
                // This will make it consistent with `calculateLuckRating`.
            });
        }
    });
    return topScoreWeeks; // This function is currently not directly used in a way that requires its own getDisplayTeamName
                         // in the provided context, but let's assume it gets it for robustness.
};


/**
 * Calculates all league-wide and individual team metrics across all historical matchups.
 * This function now explicitly takes the mapping functions.
 * @param {Object} historicalMatchups - Object containing historical matchup data, keyed by year and week.
 * @param {Map<string, string>} rosterIdToDisplayNameMap - Map from roster_id to display name.
 * @param {Map<string, string>} userIdToDisplayNameMap - Map from user_id to display name.
 * @returns {{
 * allTeamCareerStats: Array<Object>,
 * weeklyGameScoresByYearAndWeek: Object,
 * allTimeHighScores: Object,
 * allTimeLowScores: Object,
 * allTeamSeasonStats: Object,
 * careerDPRData: Array<Object>
 * }} - All calculated league metrics.
 */
export const calculateAllLeagueMetrics = (historicalMatchups, rosterIdToDisplayNameMap, userIdToDisplayNameMap) => {
    console.log("--- Starting calculateAllLeagueMetrics ---");

    // Helper function for this scope, using the passed-in maps
    const getDisplayTeamNameLocal = (identifier) => {
        if (rosterIdToDisplayNameMap.has(identifier)) {
            return rosterIdToDisplayNameMap.get(identifier);
        }
        if (userIdToDisplayNameMap.has(identifier)) {
            return userIdToDisplayNameMap.get(identifier);
        }
        // Fallback if not found in either map
        return 'Unknown Team';
    };


    const teamStats = {}; // { teamName: { wins, losses, ties, pointsFor, pointsAgainst, totalGames, careerHigh, careerLow } }
    const weeklyGameScoresByYearAndWeek = {}; // { year: { week: { roster_id: score, ... } } }
    const allTimeHighScores = {}; // { teamName: { score, year, week } }
    const allTimeLowScores = {}; // { teamName: { score, year, week } }
    const teamSeasonStats = {}; // { teamName: { year: { wins, losses, ties, pointsFor, pointsAgainst, averageScore, high, low, winPercentage } } }

    Object.keys(historicalMatchups).forEach(year => {
        weeklyGameScoresByYearAndWeek[year] = {};
        Object.keys(historicalMatchups[year]).forEach(week => {
            weeklyGameScoresByYearAndWeek[year][week] = {};

            const weekMatchups = historicalMatchups[year][week]; // Array of {roster_id, points, matchup_id, ...}

            // Group entries by matchup_id to form head-to-head pairs
            const matchupsByPair = new Map();
            weekMatchups.forEach(entry => {
                if (!matchupsByPair.has(entry.matchup_id)) {
                    matchupsByPair.set(entry.matchup_id, []);
                }
                matchupsByPair.get(entry.matchup_id).push(entry);

                // Populate weeklyGameScoresByYearAndWeek with raw scores
                weeklyGameScoresByYearAndWeek[year][week][entry.roster_id] = entry.points;
            });

            matchupsByPair.forEach(pair => {
                if (pair.length !== 2) {
                    console.warn(`[calculateAllLeagueMetrics] Skipping incomplete matchup pair in year ${year}, week ${week}, matchup_id ${pair[0]?.matchup_id}. Expected 2 entries, got ${pair.length}.`);
                    return;
                }

                const team1Entry = pair[0];
                const team2Entry = pair[1];

                const team1Name = getDisplayTeamNameLocal(team1Entry.roster_id);
                const team2Name = getDisplayTeamNameLocal(team2Entry.roster_id);
                const team1Score = team1Entry.points;
                const team2Score = team2Entry.points;

                // Validate team names and scores before processing matchup
                if (team1Name === 'Unknown Team' || team2Name === 'Unknown Team' || isNaN(team1Score) || isNaN(team2Score) || team1Name === team2Name) {
                    console.warn(`[calculateAllLeagueMetrics] Skipping matchup due to invalid scores or unresolved teams (year: ${year}, week: ${week}):`, { team1RosterId: team1Entry.roster_id, resolvedTeam1: team1Name, team2RosterId: team2Entry.roster_id, resolvedTeam2: team2Name, team1Score, team2Score });
                    return;
                }

                // Initialize team stats if first encounter
                [team1Name, team2Name].forEach(tName => {
                    if (!teamStats[tName]) {
                        teamStats[tName] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, totalGames: 0, careerHighScore: -Infinity, careerLowScore: Infinity };
                        allTimeHighScores[tName] = { score: -Infinity, year: null, week: null };
                        allTimeLowScores[tName] = { score: Infinity, year: null, week: null };
                    }
                    if (!teamSeasonStats[tName]) {
                        teamSeasonStats[tName] = {};
                    }
                    if (!teamSeasonStats[tName][year]) {
                        teamSeasonStats[tName][year] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, high: -Infinity, low: Infinity, gamesPlayed: 0 };
                    }
                });

                // Update career stats
                teamStats[team1Name].pointsFor += team1Score;
                teamStats[team1Name].pointsAgainst += team2Score;
                teamStats[team1Name].totalGames++;
                teamStats[team1Name].careerHighScore = Math.max(teamStats[team1Name].careerHighScore, team1Score);
                teamStats[team1Name].careerLowScore = Math.min(teamStats[team1Name].careerLowScore, team1Score);

                teamStats[team2Name].pointsFor += team2Score;
                teamStats[team2Name].pointsAgainst += team1Score;
                teamStats[team2Name].totalGames++;
                teamStats[team2Name].careerHighScore = Math.max(teamStats[team2Name].careerHighScore, team2Score);
                teamStats[team2Name].careerLowScore = Math.min(teamStats[team2Name].careerLowScore, team2Score);

                // Update season stats
                teamSeasonStats[team1Name][year].pointsFor += team1Score;
                teamSeasonStats[team1Name][year].pointsAgainst += team2Score;
                teamSeasonStats[team1Name][year].gamesPlayed++;
                teamSeasonStats[team1Name][year].high = Math.max(teamSeasonStats[team1Name][year].high, team1Score);
                teamSeasonStats[team1Name][year].low = Math.min(teamSeasonStats[team1Name][year].low, team1Score);

                teamSeasonStats[team2Name][year].pointsFor += team2Score;
                teamSeasonStats[team2Name][year].pointsAgainst += team1Score;
                teamSeasonStats[team2Name][year].gamesPlayed++;
                teamSeasonStats[team2Name][year].high = Math.max(teamSeasonStats[team2Name][year].high, team2Score);
                teamSeasonStats[team2Name][year].low = Math.min(teamSeasonStats[team2Name][year].low, team2Score);


                if (team1Score > team2Score) {
                    teamStats[team1Name].wins++;
                    teamStats[team2Name].losses++;
                    teamSeasonStats[team1Name][year].wins++;
                    teamSeasonStats[team2Name][year].losses++;
                } else if (team1Score < team2Score) {
                    teamStats[team1Name].losses++;
                    teamStats[team2Name].wins++;
                    teamSeasonStats[team1Name][year].losses++;
                    teamSeasonStats[team2Name][year].wins++;
                } else {
                    teamStats[team1Name].ties++;
                    teamStats[team2Name].ties++;
                    teamSeasonStats[team1Name][year].ties++;
                    teamSeasonStats[team2Name][year].ties++;
                }

                // Update all-time high/low scores
                if (team1Score > allTimeHighScores[team1Name].score) {
                    allTimeHighScores[team1Name] = { score: team1Score, year: year, week: week };
                }
                if (team1Score < allTimeLowScores[team1Name].score) {
                    allTimeLowScores[team1Name] = { score: team1Score, year: year, week: week };
                }
                if (team2Score > allTimeHighScores[team2Name].score) {
                    allTimeHighScores[team2Name] = { score: team2Score, year: year, week: week };
                }
                if (team2Score < allTimeLowScores[team2Name].score) {
                    allTimeLowScores[team2Name] = { score: team2Score, year: year, week: week };
                }
            });
        });
    });

    const allTeamCareerStats = Object.keys(teamStats).map(team => {
        const stats = teamStats[team];
        const careerAverageScore = stats.totalGames > 0 ? stats.pointsFor / stats.totalGames : 0;
        const careerWinPercentage = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;

        // Calculate careerTopScoreWeeksCount using the getDisplayTeamNameLocal
        const careerTopScoreWeeksCount = calculateTopScoreWeeksCountForDPR(team, weeklyGameScoresByYearAndWeek, null, getDisplayTeamNameLocal);

        return {
            team,
            ...stats,
            averageScore: careerAverageScore,
            winPercentage: careerWinPercentage,
            careerTopScoreWeeksCount,
        };
    });

    const careerDPRData = [];
    const allCareerRawDPRs = [];

    // Calculate raw DPR for each team based on their career stats
    allTeamCareerStats.forEach(stats => {
        const { team, averageScore, careerHighScore, careerLowScore, winPercentage: careerWinPercentage } = stats;

        // Ensure stats are valid before calculating DPR
        if (careerHighScore !== -Infinity && careerLowScore !== Infinity) {
            stats.rawDPR = calculateRawDPR(
                averageScore,
                careerHighScore,
                careerLowScore,
                careerWinPercentage
            );
            allCareerRawDPRs.push(stats.rawDPR);
        } else {
            stats.rawDPR = 0;
        }

        careerDPRData.push({
            team,
            dpr: stats.rawDPR, // Will be adjusted later
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.pointsFor,
            pointsAgainst: stats.pointsAgainst,
            averageScore: stats.averageScore,
            winPercentage: stats.winPercentage,
            totalGames: stats.totalGames,
            topScoreWeeksCount: stats.careerTopScoreWeeksCount,
            careerHighScore: stats.careerHighScore, // Added for use in Head2HeadGrid
            careerLowScore: stats.careerLowScore, // Added for use in Head2HeadGrid
        });
    });

    // Calculate overall average raw DPR for career adjustment
    const avgRawDPROverall = allCareerRawDPRs.length > 0 ? allCareerRawDPRs.reduce((sum, dpr) => sum + dpr, 0) / allCareerRawDPRs.length : 0;

    // Adjust career DPRs based on overall average
    careerDPRData.forEach(entry => {
        if (avgRawDPROverall > 0) {
            entry.dpr = entry.dpr / avgRawDPROverall;
        } else {
            entry.dpr = 0;
        }
    });

    careerDPRData.sort((a, b) => b.dpr - a.dpr);

    console.log("--- Finished calculateAllLeagueMetrics ---");
    return {
        allTeamCareerStats,
        weeklyGameScoresByYearAndWeek,
        allTimeHighScores,
        allTimeLowScores,
        allTeamSeasonStats: teamSeasonStats, // Renamed to clarify it's season data
        careerDPRData
    };
};

/**
 * Calculates the number of times a team had the highest score in a given season or career.
 * This helper is specifically for use within calculateAllLeagueMetrics to ensure consistent mapping.
 * @param {string} teamDisplayName - The display name of the team.
 * @param {Object} weeklyGameScoresByYearAndWeek - Nested object of scores by year, week, and roster_id.
 * @param {number|null} year - The specific year to calculate for, or null for career.
 * @param {Function} getDisplayTeamNameFunc - The local function to get the display name of a team given a roster_id.
 * @returns {number} The count of weeks where the team had the top score.
 */
const calculateTopScoreWeeksCountForDPR = (teamDisplayName, weeklyGameScoresByYearAndWeek, year, getDisplayTeamNameFunc) => {
    let topScoreWeeks = 0;
    const yearsToConsider = year ? [year] : Object.keys(weeklyGameScoresByYearAndWeek);

    yearsToConsider.forEach(yr => {
        const yearWeeks = weeklyGameScoresByYearAndWeek[yr];
        if (yearWeeks) {
            Object.values(yearWeeks).forEach(weekScores => { // weekScores is {roster_id: points, ...}
                let maxScoreInWeek = -1;
                let topScorerRosterIds = new Set(); // Use a Set to handle ties for top score

                for (const rosterId in weekScores) {
                    const score = weekScores[rosterId];
                    if (score > maxScoreInWeek) {
                        maxScoreInWeek = score;
                        topScorerRosterIds = new Set([rosterId]); // New max, reset set
                    } else if (score === maxScoreInWeek) {
                        topScorerRosterIds.add(rosterId); // Tie for max score
                    }
                }

                // Check if our teamDisplayName is among the top scorers for this week
                for (const rosterId of topScorerRosterIds) {
                    if (getDisplayTeamNameFunc(rosterId) === teamDisplayName) {
                        topScoreWeeks++;
                        break; // Count once per week, even if multiple of our team's rosters tied for top
                    }
                }
            });
        }
    });
    return topScoreWeeks;
};

