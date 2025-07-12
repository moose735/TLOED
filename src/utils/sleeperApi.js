// src/utils/sleeperApi.js
import { CURRENT_LEAGUE_ID } from '../config'; // Ensure this path is correct

const BASE_URL = 'https://api.sleeper.app/v1';

// In-memory cache for API responses
const inMemoryCache = new Map();

/**
 * Fetches data from a given URL and caches it.
 * @param {string} url The API endpoint URL.
 * @param {string} cacheKey The key to use for caching this data.
 * @param {number} expirationHours How long the data should be cached, in hours.
 * @returns {Promise<Object>} The fetched data.
 */
async function fetchDataWithCache(url, cacheKey, expirationHours = 1) {
    const cachedEntry = inMemoryCache.get(cacheKey);
    const now = Date.now();
    const expiryMs = expirationHours * 60 * 60 * 1000;

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        return cachedEntry.data;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return null; // Return null or empty array depending on expected data type for 404
            }
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const data = await response.json();
        inMemoryCache.set(cacheKey, { data, timestamp: now, expirationHours });
        return data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error; // Re-throw to be handled by the calling function
    }
}

/**
 * Gets a Sleeper CDN avatar URL.
 * @param {string} avatarId The avatar ID.
 * @returns {string} The full avatar URL.
 */
export function getSleeperAvatarUrl(avatarId) {
    if (!avatarId) return 'https://sleeper.app/_next/static/images/default_avatar-e314631317c0a0c20a46960d705a2046.png'; // Default Sleeper avatar
    return `https://sleepercdn.com/avatars/thumb/${avatarId}`;
}

/**
 * Gets a Sleeper CDN player headshot URL.
 * @param {string} playerId The player ID.
 * @returns {string} The full player headshot URL.
 */
export function getSleeperPlayerHeadshotUrl(playerId) {
    if (!playerId) return null;
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

/**
 * Fetches details for a specific league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Object>} A promise that resolves to the league details object.
 */
export async function fetchLeagueDetails(leagueId) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}`, `league_details_${leagueId}`, 1); // Cache for 1 hour
}

/**
 * Fetches league data (including previous league IDs) for the specified league.
 * This is crucial for navigating historical seasons.
 * @param {string} currentLeagueId The ID of the current Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of league objects (current and historical).
 */
export async function fetchLeagueData(currentLeagueId) {
    let leagues = [];
    let leagueIdToFetch = currentLeagueId; // Use a distinct variable name for clarity in the loop

    // --- Added check for valid CURRENT_LEAGUE_ID ---
    if (!currentLeagueId || currentLeagueId === '0' || currentLeagueId === '') {
        console.error("CURRENT_LEAGUE_ID is invalid. Please ensure it's set correctly in config.js.");
        return [];
    }
    // --- End Added check ---

    // Cache the entire chain of leagues for longer
    const CACHE_KEY = `league_chain_${currentLeagueId}`;
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours for league chain

    const cachedEntry = inMemoryCache.get(CACHE_KEY);
    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        return cachedEntry.data;
    }

    try {
        while (leagueIdToFetch) { // Loop as long as leagueIdToFetch is a truthy value
            const league = await fetchLeagueDetails(leagueIdToFetch);
            if (league) {
                leagues.push(league);
                // Crucial change: Ensure previous_league_id is not '0' or an empty string,
                // otherwise set it to null to terminate the loop.
                if (league.previous_league_id && league.previous_league_id !== '0' && league.previous_league_id !== '') {
                    leagueIdToFetch = league.previous_league_id;
                } else {
                    leagueIdToFetch = null; // Terminate the loop
                }
            } else {
                // If fetchLeagueDetails returns null (e.g., 404 for a non-existent league),
                // or any other error, break the loop.
                console.warn(`Could not fetch details for league ID ${leagueIdToFetch}. Terminating historical league chain fetch.`);
                leagueIdToFetch = null; // Terminate the loop
            }
        }
    } catch (error) {
        console.error("Error fetching historical league chain:", error);
        // Continue with whatever was fetched or return empty if nothing
    }

    inMemoryCache.set(CACHE_KEY, { data: leagues, timestamp: now, expirationHours: 24 });
    return leagues;
}


/**
 * Fetches user data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user objects.
 */
export async function fetchUsersData(leagueId) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}/users`, `users_${leagueId}`, 24); // Cache for 24 hours as user data changes less frequently
}

/**
 * Fetches NFL player data.
 * @returns {Promise<Object>} A promise that resolves to an object of NFL player data.
 */
export async function fetchNFLPlayers() {
    // Player data is large and rarely changes within a day, cache for longer
    return fetchDataWithCache('https://api.sleeper.app/v1/players/nfl', 'nfl_players', 24); // Cache for 24 hours
}

/**
 * Fetches current NFL state (e.g., current week, season).
 * @returns {Promise<Object>} A promise that resolves to the NFL state object.
 */
export async function fetchNFLState() {
    return fetchDataWithCache(`${BASE_URL}/state/nfl`, 'nfl_state', 0.5); // Cache for 30 minutes, as it updates often
}

/**
 * Fetches roster data for a given league ID.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of roster objects.
 */
export async function fetchRosterData(leagueId) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}/rosters`, `rosters_${leagueId}`, 1); // Cache for 1 hour
}

/**
 * Fetches rosters and enriches them with user display names and team names.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of enriched roster objects.
 */
export async function fetchRostersWithDetails(leagueId) {
    const [rosters, users] = await Promise.all([
        fetchRosterData(leagueId),
        fetchUsersData(leagueId)
    ]);

    if (!rosters || !users) {
        console.warn(`Could not fetch rosters or users for league ${leagueId}.`);
        return [];
    }

    // Create a map from user_id to user details for efficient lookup
    const userMap = new Map(users.map(user => [user.user_id, user]));

    // Enrich rosters with user display names and team names
    return rosters.map(roster => {
        const user = userMap.get(roster.owner_id);
        return {
            ...roster,
            ownerDisplayName: user ? (user.display_name || 'Unknown User') : 'Unknown User',
            // CORRECTED LINE: Access team_name from the user object's metadata
            ownerTeamName: user ? (user.metadata?.team_name || user.display_name) : 'Unknown Team',
            ownerAvatar: user ? user.avatar : null
        };
    });
}

/**
 * Processes raw matchup data to combine team 1 and team 2 into single matchup objects,
 * and attaches season and week information.
 * @param {Array<Object>} rawMatchups An array of raw matchup objects from the Sleeper API.
 * @param {Map<string, Object>} rosterIdToDetailsMap A map for roster_id to enriched roster details.
 * @param {string} season The season (year) for these matchups.
 * @param {number} week The week number for these matchups.
 * @returns {Array<Object>} An array of processed matchup objects.
 */
function processRawMatchups(rawMatchups, rosterIdToDetailsMap, season, week) {
    const processedMatchups = [];
    const processedMatchupKeys = new Set(); // To track unique matchups (matchup_id or roster_id for byes)

    if (!rawMatchups) {
        return [];
    }

    rawMatchups.forEach(teamMatchup => {
        const rosterId = String(teamMatchup.roster_id);
        const points = parseFloat(teamMatchup.points);
        const matchupId = teamMatchup.matchup_id;

        if (isNaN(points)) {
            console.warn(`[processRawMatchups] Skipping raw matchup entry for roster ${rosterId} in week ${week} due to invalid points: ${teamMatchup.points}`);
            return;
        }

        if (matchupId !== null) {
            // This is a head-to-head matchup. We need to find its pair.
            // Use a unique key for the pair to avoid processing it twice.
            const uniqueMatchupKey = `${matchupId}_${week}`;

            if (!processedMatchupKeys.has(uniqueMatchupKey)) {
                const opponentEntry = rawMatchups.find(
                    (otherTeamMatchup) =>
                        otherTeamMatchup.matchup_id === matchupId &&
                        String(otherTeamMatchup.roster_id) !== rosterId
                );

                if (opponentEntry) {
                    const opponentRosterId = String(opponentEntry.roster_id);
                    const opponentPoints = parseFloat(opponentEntry.points);

                    if (isNaN(opponentPoints)) {
                        console.warn(`[processRawMatchups] Skipping paired matchup for roster ${rosterId} in week ${week} due to invalid opponent points: ${opponentEntry.points}`);
                        return;
                    }

                    const team1Score = points;
                    const team2Score = opponentPoints;

                    const newMatchup = {
                        matchup_id: matchupId,
                        season: season,
                        week: week,
                        team1_roster_id: rosterId,
                        team1_score: team1Score,
                        team1_details: rosterIdToDetailsMap.get(rosterId),
                        team2_roster_id: opponentRosterId,
                        team2_score: team2Score,
                        team2_details: rosterIdToDetailsMap.get(opponentRosterId),
                    };

                    if (team1Score > team2Score) {
                        newMatchup.winner_roster_id = rosterId;
                        newMatchup.loser_roster_id = opponentRosterId;
                    } else if (team2Score > team1Score) {
                        newMatchup.winner_roster_id = opponentRosterId;
                        newMatchup.loser_roster_id = rosterId;
                    } else {
                        newMatchup.winner_roster_id = null; // It's a tie
                        newMatchup.loser_roster_id = null;
                    }
                    processedMatchups.push(newMatchup);
                    processedMatchupKeys.add(uniqueMatchupKey); // Mark this matchup as processed
                } else {
                    // This case means a matchup_id was present, but no opponent was found.
                    // This could be an an incomplete matchup or an edge case where a team is effectively on a bye
                    // but still assigned a matchup_id. Treat it as a bye to ensure score is counted.
                    console.warn(`[processRawMatchups] Matchup ID ${matchupId} for roster ${rosterId} in week ${week} has no apparent opponent. Treating as a bye.`);
                    processedMatchups.push({
                        matchup_id: null, // Set to null as it's not a paired matchup
                        season: season,
                        week: week,
                        team1_roster_id: rosterId,
                        team1_score: points,
                        team1_details: rosterIdToDetailsMap.get(rosterId),
                        team2_roster_id: null, // Explicitly null for bye
                        team2_score: 0, // Bye opponent score is 0
                        team2_details: null,
                        winner_roster_id: points > 0 ? rosterId : null, // If score > 0, they "win" the bye
                        loser_roster_id: points <= 0 ? rosterId : null, // If score <= 0, they "lose" the bye (or tie)
                    });
                    processedMatchupKeys.add(`${rosterId}_${week}_bye`); // Ensure unique key for this bye
                }
            }
        } else {
            // matchup_id is null. This is a bye week or a single entry playoff game.
            // Ensure its score is recorded.
            const uniqueByeKey = `${rosterId}_${week}_bye`;
            if (!processedMatchupKeys.has(uniqueByeKey)) {
                processedMatchups.push({
                    matchup_id: null, // Explicitly null for bye
                    season: season,
                    week: week,
                    team1_roster_id: rosterId,
                    team1_score: points,
                    team1_details: rosterIdToDetailsMap.get(rosterId),
                    team2_roster_id: null, // Explicitly null for bye
                    team2_score: 0, // Bye opponent score is 0
                    team2_details: null,
                    winner_roster_id: points > 0 ? rosterId : null, // If score > 0, they "win" the bye
                    loser_roster_id: points <= 0 ? rosterId : null, // If score <= 0, they "lose" the bye (or tie)
                });
                processedMatchupKeys.add(uniqueByeKey); // Mark this bye as processed
            }
        }
    });

    return processedMatchups;
}

/**
 * Fetches and processes matchups for a specific league and range of weeks.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number | number[]} weeks The week number(s) to fetch matchups for. Can be a single number or an array.
 * @param {string} season The season (year) for these matchups. // ADDED season parameter
 * @returns {Promise<Object>} A promise that resolves to an object where keys are week numbers and values are arrays of processed matchup data.
 */
export async function fetchMatchupsForLeague(leagueId, weeks, season) { // ADDED season parameter
    let weeksToFetch = [];
    if (typeof weeks === 'number') {
        weeksToFetch = [weeks];
    } else if (Array.isArray(weeks)) {
        weeksToFetch = weeks;
    } else {
        console.error("Invalid 'weeks' argument for fetchMatchupsForLeague. Must be a number or array of numbers.");
        return {};
    }

    const allMatchupsByWeek = {};
    const rosters = await fetchRostersWithDetails(leagueId); // Fetch once
    const rosterIdToDetailsMap = new Map(rosters.map(r => [String(r.roster_id), r])); // Ensure key is string here

    const fetchPromises = weeksToFetch.map(async (week) => {
        try {
            const rawMatchups = await fetchDataWithCache(
                `${BASE_URL}/league/${leagueId}/matchups/${week}`,
                `matchups_${leagueId}_${week}`,
                0.5 // Cache matchups for 30 mins, as scores update frequently during game days
            );

            if (rawMatchups) {
                allMatchupsByWeek[week] = processRawMatchups(rawMatchups, rosterIdToDetailsMap, season, week);
            }
        } catch (error) {
            console.error(`Error fetching matchups for league ${leagueId}, week ${week}:`, error);
            // Don't re-throw, just log and continue for other weeks
        }
    });

    await Promise.all(fetchPromises);
    return allMatchupsByWeek;
}

/**
 * Fetches the winners bracket data for a given league ID.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchWinnersBracket(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/winners_bracket`, `winners_bracket_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch winners bracket for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Fetches the losers bracket data for a given league ID.
 * Uses the centralized caching.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of bracket matchup objects, or an empty array if an error occurs.
 */
export async function fetchLosersBracket(leagueId) {
    try {
        return await fetchDataWithCache(`${BASE_URL}/league/${leagueId}/losers_bracket`, `losers_bracket_${leagueId}`, 24);
    } catch (error) {
        console.error(`Failed to fetch losers bracket for league ID ${leagueId}:`, error);
        return [];
    }
}

/**
 * Enriches bracket matchups with scores from the corresponding weekly matchup data and identifies bye weeks.
 * @param {Array<Object>} rawBracketData The raw bracket array (winners_bracket or losers_bracket).
 * @param {Object} allWeeklyScoresForSeason An object where keys are week numbers and values are arrays of processed matchup data.
 * @param {Map<string, Object>} rosterIdToDetailsMap A map for roster_id to enriched roster details.
 * @param {number} playoffStartWeek The week number when playoffs begin for this league.
 * @param {string} bracketType - 'winners' or 'losers' for logging clarity.
 * @param {string} season - The current season being processed. // NEW: Added season parameter
 * @returns {Array<Object>} The bracket data with added score information and bye teams.
 */
function enrichBracketWithScores(rawBracketData, allWeeklyScoresForSeason, rosterIdToDetailsMap, playoffStartWeek, bracketType, season) { // NEW: Added season parameter
    console.log(`[enrichBracketWithScores] Starting for ${bracketType} bracket, season: ${season}, raw data count: ${rawBracketData.length}`);
    if (!rawBracketData || rawBracketData.length === 0 || !allWeeklyScoresForSeason || !rosterIdToDetailsMap) {
        console.warn(`[enrichBracketWithScores] Returning empty array due to missing input data for ${bracketType} bracket, season ${season}.`);
        return []; // Return empty array if no data
    }

    // Sort raw bracket data by round and then match_id to ensure dependencies are processed first
    const sortedRawBracketData = [...rawBracketData].sort((a, b) => {
        // Process lower rounds first (e.g., Round 1 before Round 2)
        if (a.r !== b.r) return a.r - b.r;
        return a.m - b.m; // Then by match ID
    });

    const processedMatchesMap = new Map(); // Stores enriched matches keyed by their match_id (m)

    // Helper to resolve t1/t2 references (e.g., {w: 1} to a roster_id)
    const resolveTeamFromRef = (ref) => {
        if (typeof ref === 'number' || typeof ref === 'string') {
            return String(ref); // Direct roster ID
        }
        if (typeof ref === 'object' && ref !== null) {
            if (ref.w) {
                const prevMatch = processedMatchesMap.get(String(ref.w));
                return prevMatch ? (String(prevMatch.w) || null) : null;
            }
            if (ref.l) {
                const prevMatch = processedMatchesMap.get(String(ref.l));
                return prevMatch ? (String(prevMatch.l) || null) : null;
            }
        }
        return null; // Could not resolve
    };

    sortedRawBracketData.forEach(bracketMatch => {
        const matchId = String(bracketMatch.m);
        console.log(`[enrichBracketWithScores] Processing ${bracketType} match M${matchId} R${bracketMatch.r}, Season ${season}:`, bracketMatch);

        const enrichedMatch = { ...bracketMatch };
        const correspondingPlayoffWeek = playoffStartWeek + (bracketMatch.r - 1);

        enrichedMatch.week = correspondingPlayoffWeek;
        enrichedMatch.playoffs = true; // Mark as playoff match

        // Resolve t1 and t2 to actual roster IDs using the helper
        const resolvedT1 = resolveTeamFromRef(bracketMatch.t1 || bracketMatch.t1_from);
        const resolvedT2 = resolveTeamFromRef(bracketMatch.t2 || bracketMatch.t2_from);

        enrichedMatch.team1_roster_id = resolvedT1;
        enrichedMatch.team2_roster_id = resolvedT2;
        enrichedMatch.team1_details = rosterIdToDetailsMap.get(resolvedT1);
        enrichedMatch.team2_details = rosterIdToDetailsMap.get(resolvedT2);

        // Add finalSeedingGame for championship and 3rd place matches
        if (bracketMatch.p === 1) { // Championship match
            enrichedMatch.finalSeedingGame = 1;
        } else if (bracketMatch.p === 3) { // 3rd place match
            enrichedMatch.finalSeedingGame = 3;
        }

        // Initialize w and l from bracketMatch's own w and l (if provided by Sleeper API directly)
        enrichedMatch.w = bracketMatch.w ? String(bracketMatch.w) : null;
        enrichedMatch.l = bracketMatch.l ? String(bracketMatch.l) : null;

        let matchupFound = null;
        const weekMatchups = allWeeklyScoresForSeason[correspondingPlayoffWeek];
        console.log(`[enrichBracketWithScores] Looking for matchups in week ${correspondingPlayoffWeek} for season ${season}. Found ${weekMatchups ? weekMatchups.length : 0} matchups.`);


        if (weekMatchups && weekMatchups.length > 0) {
            // Try to find by both resolved roster IDs
            if (resolvedT1 && resolvedT2) {
                matchupFound = weekMatchups.find(m =>
                    (String(m.team1_roster_id) === resolvedT1 && String(m.team2_roster_id) === resolvedT2) ||
                    (String(m.team1_roster_id) === resolvedT2 && String(m.team2_roster_id) === resolvedT1)
                );
                if (matchupFound) {
                    console.log(`[enrichBracketWithScores] Found matchup by resolved T1/T2 for M${matchId} R${bracketMatch.r}.`);
                }
            }

            // If not found by both, and one of the teams is null (indicating a bye in the bracket structure)
            if (!matchupFound && (resolvedT1 === null || resolvedT2 === null)) {
                const nonNullRosterId = resolvedT1 || resolvedT2;
                if (nonNullRosterId) {
                    matchupFound = weekMatchups.find(m =>
                        String(m.team1_roster_id) === nonNullRosterId && m.team2_roster_id === null
                    );
                    if (matchupFound) {
                        console.log(`[enrichBracketWithScores] Found bye matchup for ${nonNullRosterId} for M${matchId} R${bracketMatch.r}.`);
                    }
                }
            }

            // Fallback: Try to find by matchup_id if it's explicitly provided in the bracketMatch
            // This is less reliable if matchup_id is not consistent across regular and playoff matchups.
            if (!matchupFound && bracketMatch.m) {
                matchupFound = weekMatchups.find(m => String(m.matchup_id) === String(bracketMatch.m));
                if (matchupFound) {
                    console.log(`[enrichBracketWithScores] Found matchup by matchup_id for M${matchId} R${bracketMatch.r}.`);
                }
            }
        } else {
            console.warn(`[enrichBracketWithScores] No weekly scores data found for playoff week ${correspondingPlayoffWeek} in season ${season}.`);
        }


        if (matchupFound) {
            // Assign scores and winner/loser based on the found weekly matchup
            // Ensure scores are assigned to t1/t2 based on their resolved positions
            if (String(matchupFound.team1_roster_id) === resolvedT1) {
                enrichedMatch.t1_score = matchupFound.team1_score;
                enrichedMatch.t2_score = matchupFound.team2_score;
            } else if (String(matchupFound.team2_roster_id) === resolvedT1) {
                enrichedMatch.t1_score = matchupFound.team2_score;
                enrichedMatch.t2_score = matchupFound.team1_score;
            } else {
                // This case should ideally not happen if matchupFound was based on resolvedT1/T2,
                // but as a fallback, assign directly. This might occur if one of the resolved
                // IDs was null (a bye), and we're just assigning the single available score.
                enrichedMatch.t1_score = matchupFound.team1_score;
                enrichedMatch.t2_score = matchupFound.team2_score;
            }

            // Only override w/l if matchupFound has valid winner/loser IDs
            if (matchupFound.winner_roster_id) {
                enrichedMatch.w = String(matchupFound.winner_roster_id);
            }
            if (matchupFound.loser_roster_id) {
                enrichedMatch.l = String(matchupFound.loser_roster_id);
            }
            console.log(`[enrichBracketWithScores] Scores and W/L assigned for M${matchId} R${bracketMatch.r}, Season ${season}. Winner: ${enrichedMatch.w}, Loser: ${enrichedMatch.l}, T1 Score: ${enrichedMatch.t1_score}, T2 Score: ${enrichedMatch.t2_score}`);

        } else {
            // If no matchup found, scores remain null, but w/l from bracketMatch are preserved
            enrichedMatch.t1_score = null;
            enrichedMatch.t2_score = null;
            console.warn(`[enrichBracketWithScores] WARNING: No weekly matchup found for bracket match M${matchId} (R${bracketMatch.r}), Season ${season} with resolved teams T1:${resolvedT1}, T2:${resolvedT2}. Scores will be null.`);
        }

        processedMatchesMap.set(matchId, enrichedMatch); // Store the processed match
    });

    // Return the array of enriched matches, sorted by round and match ID
    return Array.from(processedMatchesMap.values()).sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        return a.m - b.m;
    });
}

/**
 * Fetches all historical matchup data for the current league and all its previous seasons.
 * Data is fetched once and then cached in memory for subsequent calls within the same session.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing all historical matchups,
 * structured as {
 * matchupsBySeason: { "season_year": { "week_number": [processed_matchup_data], ... }, ... },
 * rostersBySeason: { "season_year": [enriched_roster_data], ... },
 * leaguesMetadataBySeason: { "season_year": { league_details_object }, ... },
 * winnersBracketBySeason: { "season_year": [bracket_matchup_data], ... },
 * losersBracketBySeason: { "season_year": [bracket_matchup_data], ... }
 * }.
 * Returns the cached data if already fetched.
 */
export async function fetchAllHistoricalMatchups() {
    const CACHE_KEY = 'all_historical_matchups_details';
    const cachedEntry = inMemoryCache.get(CACHE_KEY);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours for full historical data

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        return cachedEntry.data;
    }

    const allHistoricalData = {
        matchupsBySeason: {},
        rostersBySeason: {},
        leaguesMetadataBySeason: {},
        winnersBracketBySeason: {}, // New property for winners bracket data
        losersBracketBySeason: {},    // New property for losers bracket data
        usersBySeason: {}, // NEW: Add a property to store users per season
    };

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);

        if (!leagues || leagues.length === 0) {
            console.error('No league data found for historical matchup fetching. Check CURRENT_LEAGUE_ID in config.js.');
            return allHistoricalData;
        }

        const nflState = await fetchNFLState();
        const currentNFLSeason = nflState?.season || new Date().getFullYear().toString(); // Ensure it's a string for comparison

        for (const league of leagues) {
            const leagueId = league.league_id;
            const season = league.season;
            console.log(`[fetchAllHistoricalMatchups] Processing league ${leagueId} for season ${season}.`);


            allHistoricalData.leaguesMetadataBySeason[season] = league;

            // NEW: Fetch users for this specific historical league
            const users = await fetchUsersData(leagueId);
            allHistoricalData.usersBySeason[season] = users; // Store users for this season

            const rosters = await fetchRosterData(leagueId); // Fetch raw rosters first
            // Manually enrich rosters with user data for this specific season
            const userMapForSeason = new Map(users.map(user => [user.user_id, user]));
            const enrichedRostersForSeason = rosters.map(roster => {
                const user = userMapForSeason.get(roster.owner_id);
                return {
                    ...roster,
                    ownerDisplayName: user ? (user.display_name || 'Unknown User') : 'Unknown User',
                    ownerTeamName: user ? (user.metadata?.team_name || user.display_name) : 'Unknown Team',
                    ownerAvatar: user ? user.avatar : null
                };
            });
            allHistoricalData.rostersBySeason[season] = enrichedRostersForSeason;
            const rosterIdToDetailsMap = new Map(enrichedRostersForSeason.map(r => [String(r.roster_id), r])); // Ensure key is string here


            // Determine regular season weeks and playoff start week
            let playoffStartWeek = league.settings?.playoff_start_week;
            if (!playoffStartWeek) {
                playoffStartWeek = 15; // Common default if not explicitly set
            }
            playoffStartWeek = Math.max(1, playoffStartWeek); // Ensure it's at least week 1

            let regularSeasonWeeksEnd = playoffStartWeek - 1;

            let seasonMatchupsData = {}; // Temp storage for all matchups of this season

            // Fetch regular season matchups only for past/current seasons
            if (parseInt(season) <= parseInt(currentNFLSeason)) {
                const weeksToFetchRegular = Array.from({ length: regularSeasonWeeksEnd }, (_, i) => i + 1); // Weeks 1 to regularSeasonWeeksEnd
                console.log(`[fetchAllHistoricalMatchups] Fetching regular season matchups for ${season}, weeks: ${weeksToFetchRegular.join(', ')}`);
                const regularMatchupsByWeek = await fetchMatchupsForLeague(leagueId, weeksToFetchRegular, season);
                Object.assign(seasonMatchupsData, regularMatchupsByWeek); // Merge into seasonMatchupsData

                if (Object.keys(regularMatchupsByWeek).length === 0 && parseInt(season) === parseInt(currentNFLSeason)) {
                    console.warn(`[fetchAllHistoricalMatchups] No regular season matchups found for current season ${season}.`);
                }
            } else {
                console.log(`[fetchAllHistoricalMatchups] Skipping regular season matchup fetch for future season ${season}.`);
            }

            // Fetch playoff bracket data
            let winnersBracketRaw = [];
            let losersBracketRaw = [];
            if (parseInt(season) <= parseInt(currentNFLSeason)) {
                [winnersBracketRaw, losersBracketRaw] = await Promise.all([
                    fetchWinnersBracket(leagueId),
                    fetchLosersBracket(leagueId)
                ]);

                // Determine maximum playoff round to fetch all playoff matchup weeks
                const maxWinnersRound = winnersBracketRaw.reduce((max, match) => Math.max(max, match.r || 0), 0);
                const maxLosersRound = losersBracketRaw.reduce((max, match) => Math.max(max, match.r || 0), 0);
                const maxPlayoffRound = Math.max(maxWinnersRound, maxLosersRound);
                console.log(`[fetchAllHistoricalMatchups] Season ${season}: Max playoff round: ${maxPlayoffRound}, Playoff start week: ${playoffStartWeek}`);


                if (maxPlayoffRound > 0) {
                    const playoffWeeksToFetch = Array.from({ length: maxPlayoffRound}, (_, i) => playoffStartWeek + i);
                    console.log(`[fetchAllHistoricalMatchups] Fetching playoff matchups for ${season}, weeks: ${playoffWeeksToFetch.join(', ')}`);
                    const playoffMatchupsByWeek = await fetchMatchupsForLeague(leagueId, playoffWeeksToFetch, season);
                    Object.assign(seasonMatchupsData, playoffMatchupsByWeek); // Merge playoff week data
                    console.log(`[fetchAllHistoricalMatchups] Season ${season}: Playoff matchups fetched. Total weeks in seasonMatchupsData: ${Object.keys(seasonMatchupsData).length}`);
                } else {
                    console.log(`[fetchAllHistoricalMatchups] No playoff rounds found for season ${season}.`);
                }

                // Now, enrich the bracket data with scores from `seasonMatchupsData`
                // Pass rosterIdToDetailsMap for bye week detection and to ensure team details are present
                // NEW: Pass season to enrichBracketWithScores
                allHistoricalData.winnersBracketBySeason[season] = enrichBracketWithScores(winnersBracketRaw, seasonMatchupsData, rosterIdToDetailsMap, playoffStartWeek, 'winners', season);
                allHistoricalData.losersBracketBySeason[season] = enrichBracketWithScores(losersBracketRaw, seasonMatchupsData, rosterIdToDetailsMap, playoffStartWeek, 'losers', season);

            } else {
                console.log(`[fetchAllHistoricalMatchups] Skipping playoff bracket fetch for future season ${season}.`);
                allHistoricalData.winnersBracketBySeason[season] = [];
                allHistoricalData.losersBracketBySeason[season] = [];
            }
            allHistoricalData.matchupsBySeason[season] = seasonMatchupsData; // Store all matchups for the season
            console.log(`[fetchAllHistoricalMatchups] Final seasonMatchupsData for season ${season}:`, seasonMatchupsData);
        }

        inMemoryCache.set(CACHE_KEY, { data: allHistoricalData, timestamp: now, expirationHours: 24 });
        return allHistoricalData;

    } catch (error) {
        console.error('Critical error in fetchAllHistoricalMatchups:', error);
        inMemoryCache.delete(CACHE_KEY); // Clear cache on critical error to force refetch next time
        return { matchupsBySeason: {}, rostersBySeason: {}, leaguesMetadataBySeason: {}, winnersBracketBySeason: {}, losersBracketBySeason: {}, usersBySeason: {} }; // Include usersBySeason in error return
    }
}


/**
 * Fetches transactions for a specific week in a league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number} week The week number for which to fetch transactions.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction objects.
 */
export async function fetchTransactionsForWeek(leagueId, week) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}/transactions/${week}`, `transactions_${leagueId}_${week}`, 1);
}

/**
 * Fetches all drafts for a given league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft objects.
 */
export async function fetchLeagueDrafts(leagueId) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}/drafts`, `drafts_${leagueId}`, 24); // Drafts change rarely, cache for 24h
}

/**
 * Fetches details for a specific draft.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Object>} A promise that resolves to the draft details object.
 */
export async function fetchDraftDetails(draftId) {
    return fetchDataWithCache(`${BASE_URL}/draft/${draftId}`, `draft_details_${draftId}`, 24);
}

/**
 * Fetches all picks for a specific draft.
 * @param {string} draftId The ID of the draft.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of draft pick objects.
 */
export async function fetchDraftPicks(draftId) {
    return fetchDataWithCache(`${BASE_URL}/draft/${draftId}/picks`, `draft_picks_${draftId}`, 24);
}

/**
 * Fetches all traded picks for a specific league.
 * @param {string} leagueId The ID of the Sleeper league.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of traded pick objects.
 */
export async function fetchTradedPicks(leagueId) {
    return fetchDataWithCache(`${BASE_URL}/league/${leagueId}/traded_picks`, `traded_picks_${leagueId}`, 24);
}

/**
 * Fetches all draft history for a given league ID across all its past seasons.
 * This includes draft details, picks, and traded picks.
 * @returns {Promise<Object>} A promise that resolves to an object structured by season.
 */
export async function fetchAllDraftHistory() {
    const CACHE_KEY = 'all_draft_history';
    const cachedEntry = inMemoryCache.get(CACHE_KEY);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours for full draft history

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        return cachedEntry.data;
    }

    const allDraftHistory = {};

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
        const nflPlayers = await fetchNFLPlayers(); // Fetch once for all seasons

        for (const league of leagues) {
            const season = league.season;
            const leagueId = league.league_id;


            const drafts = await fetchLeagueDrafts(leagueId);
            const tradedPicks = await fetchTradedPicks(leagueId);

            const seasonDraftsData = [];
            for (const draft of drafts) {
                const picks = await fetchDraftPicks(draft.draft_id);
                // Enrich picks with player names
                const enrichedPicks = picks.map(pick => ({
                    ...pick,
                    player_name: nflPlayers[pick.player_id]?.full_name || 'Unknown Player',
                    player_position: nflPlayers[pick.player_id]?.position || '',
                    player_team: nflPlayers[pick.player_id]?.team || ''
                }));

                seasonDraftsData.push({
                    ...draft,
                    picks: enrichedPicks
                });
            }

            allDraftHistory[season] = {
                drafts: seasonDraftsData,
                tradedPicks: tradedPicks
            };
        }

        inMemoryCache.set(CACHE_KEY, { data: allDraftHistory, timestamp: now, expirationHours: 24 });
        return allDraftHistory;

    } catch (error) {
        console.error('Critical error in fetchAllDraftHistory:', error);
        inMemoryCache.delete(CACHE_KEY); // Clear cache on critical error to force refetch next time
        return {};
    }
}
