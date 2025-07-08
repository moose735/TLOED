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
        // console.log(`Cache hit for ${cacheKey}`);
        return cachedEntry.data;
    }

    // console.log(`Cache miss or expired for ${cacheKey}, fetching from API: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`404 Not Found for ${url}. This might be expected for future weeks or missing data.`);
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
    let leagueId = currentLeagueId;

    // Cache the entire chain of leagues for longer
    const CACHE_KEY = `league_chain_${currentLeagueId}`;
    const cachedEntry = inMemoryCache.get(CACHE_KEY);
    const now = Date.now();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours for league chain

    if (cachedEntry && (now - cachedEntry.timestamp < expiryMs)) {
        return cachedEntry.data;
    }

    try {
        while (leagueId) {
            const league = await fetchLeagueDetails(leagueId);
            if (league) {
                leagues.push(league);
                leagueId = league.previous_league_id; // Move to the previous season's league ID
            } else {
                break; // No more previous leagues or error fetching
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
            ownerTeamName: roster.metadata?.team_name || (user ? user.display_name : 'Unknown Team'),
            ownerAvatar: user ? user.avatar : null // Add avatar for convenience
        };
    });
}

/**
 * Processes raw matchup data to combine team 1 and team 2 into single matchup objects.
 * @param {Array<Object>} rawMatchups An array of raw matchup objects from the Sleeper API.
 * @param {Map<string, Object>} rosterIdToDetailsMap A map for roster_id to enriched roster details.
 * @returns {Array<Object>} An array of processed matchup objects.
 */
function processRawMatchups(rawMatchups, rosterIdToDetailsMap) {
    const matchupsMap = new Map();

    if (!rawMatchups) {
        return [];
    }

    rawMatchups.forEach(teamMatchup => {
        const matchupId = teamMatchup.matchup_id;
        if (!matchupsMap.has(matchupId)) {
            matchupsMap.set(matchupId, {
                matchup_id: matchupId,
                roster_id: teamMatchup.roster_id, // Store for lookup in case of bye weeks
                starters: teamMatchup.starters,
                players: teamMatchup.players,
                points: teamMatchup.points,
                starters_points: teamMatchup.starters_points,
                matchup_week: teamMatchup.week // Keep track of the week
            });
        } else {
            // This assumes the API always returns two entries for each matchup_id
            // One for team1 and one for team2
            const existingMatchup = matchupsMap.get(matchupId);

            // Determine which one is team1 and team2 based on roster_id
            // This is a common pattern where the API gives one entry per roster per matchup,
            // we need to combine them. A simpler approach is to ensure team1 is always
            // the roster with the lower ID, or just consistent assignment.

            let team1_roster_id, team1_score, team2_roster_id, team2_score;

            if (existingMatchup.roster_id === teamMatchup.roster_id) {
                // This scenario shouldn't happen if each matchup_id has exactly two unique roster_ids.
                // It means we have a duplicate or odd data. Skip for safety or log.
                console.warn(`Duplicate roster_id ${teamMatchup.roster_id} for matchup_id ${matchupId}. Skipping.`);
                return;
            }

            // Assign team1 and team2 consistently for easier access
            // Let's just assign based on current existingMatchup and new teamMatchup
            // We'll call existingMatchup as Team A and teamMatchup as Team B
            const teamA_roster_id = existingMatchup.roster_id;
            const teamA_score = existingMatchup.points;
            const teamB_roster_id = teamMatchup.roster_id;
            const teamB_score = teamMatchup.points;

            // Ensure consistent ordering, e.g., by roster ID, or by which one was seen first
            // For now, we'll just put them in the order they were encountered
            // This might need refinement if specific team1/team2 display order is critical without relying on `w`/`l` from brackets.
            matchupsMap.set(matchupId, {
                matchup_id: matchupId,
                week: teamMatchup.week, // Store the week number
                team1_roster_id: teamA_roster_id,
                team1_score: teamA_score,
                team2_roster_id: teamB_roster_id,
                team2_score: teamB_score,
                // Add roster details for easy display
                team1_details: rosterIdToDetailsMap.get(teamA_roster_id),
                team2_details: rosterIdToDetailsMap.get(teamB_roster_id)
            });
        }
    });

    return Array.from(matchupsMap.values());
}

/**
 * Fetches and processes matchups for a specific league and range of weeks.
 * @param {string} leagueId The ID of the Sleeper league.
 * @param {number | number[]} weeks The week number(s) to fetch matchups for. Can be a single number or an array.
 * @returns {Promise<Object>} A promise that resolves to an object where keys are week numbers and values are arrays of processed matchup data.
 */
export async function fetchMatchupsForLeague(leagueId, weeks) {
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
    const rosters = await fetchRostersWithDetails(leagueId);
    const rosterIdToDetailsMap = new Map(rosters.map(r => [r.roster_id, r]));

    const fetchPromises = weeksToFetch.map(async (week) => {
        try {
            const rawMatchups = await fetchDataWithCache(
                `${BASE_URL}/league/${leagueId}/matchups/${week}`,
                `matchups_${leagueId}_${week}`,
                0.5 // Cache matchups for 30 mins, as scores update frequently during game days
            );
            if (rawMatchups) {
                allMatchupsByWeek[week] = processRawMatchups(rawMatchups, rosterIdToDetailsMap);
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
 * Enriches bracket matchups with scores from the corresponding weekly matchup data.
 * @param {Array<Object>} bracketData The raw bracket array (winners_bracket or losers_bracket).
 * @param {Object} allMatchupsByWeek An object where keys are week numbers and values are arrays of processed matchup data for that week.
 * @param {number} playoffStartWeek The week number when playoffs begin for this league.
 * @returns {Array<Object>} The bracket data with added score information.
 */
function enrichBracketWithScores(bracketData, allMatchupsByWeek, playoffStartWeek) {
    if (!bracketData || bracketData.length === 0 || !allMatchupsByWeek) {
        return bracketData;
    }

    return bracketData.map(bracketMatch => {
        const enrichedMatch = { ...bracketMatch };

        // Playoff rounds typically start immediately after the regular season ends.
        // Round 'r' corresponds to week 'playoffStartWeek + r - 1'
        const correspondingPlayoffWeek = playoffStartWeek + (bracketMatch.r - 1);
        const weekMatchups = allMatchupsByWeek[correspondingPlayoffWeek];

        if (weekMatchups && weekMatchups.length > 0) {
            let matchupFound = null;

            // First, try to match by the known winner and loser roster IDs (if match completed)
            if (bracketMatch.w && bracketMatch.l) {
                matchupFound = weekMatchups.find(m =>
                    (m.team1_roster_id === bracketMatch.w && m.team2_roster_id === bracketMatch.l) ||
                    (m.team1_roster_id === bracketMatch.l && m.team2_roster_id === bracketMatch.w)
                );
            }

            // If not found, try to match by the initial t1 and t2 (roster_ids for round 1, or objects for later rounds)
            // For later rounds, t1/t2 can be objects like {w: M} or {l: M} meaning winner/loser of match M.
            // We can only match by actual roster_ids at this stage.
            if (!matchupFound && typeof bracketMatch.t1 === 'number' && typeof bracketMatch.t2 === 'number') {
                matchupFound = weekMatchups.find(m =>
                    (m.team1_roster_id === bracketMatch.t1 && m.team2_roster_id === bracketMatch.t2) ||
                    (m.team1_roster_id === bracketMatch.t2 && m.team2_roster_id === bracketMatch.t1)
                );
            }

            if (matchupFound) {
                // Assign scores, ensuring t1_score corresponds to bracketMatch.t1 (or its resolved winner/loser)
                // This logic might need to be robust if bracketMatch.t1 is not always the direct roster_id
                // but an object indicating a winner from a previous match.
                // For simplicity, we'll assign based on winner/loser if available, else direct t1/t2.

                // If `w` and `l` are set, they are the definitive roster IDs for that match.
                // We'll align `t1_score` to `t1` and `t2_score` to `t2`.
                // The `t1` and `t2` fields in the bracket sometimes hold objects {w: M} or {l: M}.
                // We need to determine the actual roster_id for t1 and t2 display purposes.
                // The `w` and `l` fields are the actual roster IDs that played if the match is complete.
                // Let's use `w` and `l` if they exist to assign scores based on the outcome,
                // otherwise use `t1` and `t2` if they are direct roster IDs.

                let actualT1RosterId = null;
                let actualT2RosterId = null;

                if (typeof bracketMatch.t1 === 'number') actualT1RosterId = bracketMatch.t1;
                if (typeof bracketMatch.t2 === 'number') actualT2RosterId = bracketMatch.t2;

                // If the match is complete (w and l are present), these are the final participants
                if (bracketMatch.w && bracketMatch.l) {
                    actualT1RosterId = bracketMatch.t1; // Use the original t1/t2 for score assignment *order*
                    actualT2RosterId = bracketMatch.t2;
                    // If t1/t2 were objects, we'd need to resolve them to roster IDs first.
                    // For now, assuming t1/t2 are either numbers or get overwritten by w/l for scoring.
                }

                // Matchup found, assign scores based on which team from `matchupFound` matches `actualT1RosterId`
                if (matchupFound.team1_roster_id === actualT1RosterId) {
                    enrichedMatch.t1_score = matchupFound.team1_score;
                    enrichedMatch.t2_score = matchupFound.team2_score;
                } else if (matchupFound.team2_roster_id === actualT1RosterId) {
                    enrichedMatch.t1_score = matchupFound.team2_score;
                    enrichedMatch.t2_score = matchupFound.team1_score;
                } else if (matchupFound.team1_roster_id === bracketMatch.w) { // Fallback: if t1 wasn't a direct ID but w is
                     enrichedMatch.t1_score = matchupFound.team1_score;
                     enrichedMatch.t2_score = matchupFound.team2_score;
                } else {
                    // This scenario means we found the matchup, but can't perfectly align t1/t2 from bracket with team1/team2 from matchup
                    // Assign based on matchupFound's internal order (team1/team2)
                    enrichedMatch.t1_score = matchupFound.team1_score;
                    enrichedMatch.t2_score = matchupFound.team2_score;
                    // console.warn(`Could not perfectly align scores for bracket match ${bracketMatch.m} in week ${correspondingPlayoffWeek}. Assigning based on matchup order.`);
                }

            } else {
                // console.warn(`No direct matchup found for bracket match ${bracketMatch.m} in week ${correspondingPlayoffWeek}.`);
            }
        }
        return enrichedMatch;
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
        console.log('Returning historical matchups, rosters, league metadata, and bracket data from cache.');
        return cachedEntry.data;
    }

    console.log('Fetching all historical matchup data for the first time...');
    const allHistoricalData = {
        matchupsBySeason: {},
        rostersBySeason: {},
        leaguesMetadataBySeason: {},
        winnersBracketBySeason: {}, // New property for winners bracket data
        losersBracketBySeason: {}   // New property for losers bracket data
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

            console.log(`Processing historical data for season: ${season} (League ID: ${leagueId})`);

            allHistoricalData.leaguesMetadataBySeason[season] = league;

            const rosters = await fetchRostersWithDetails(leagueId);
            allHistoricalData.rostersBySeason[season] = rosters;

            // Determine regular season weeks and playoff start week
            // Sleeper default playoff_start_week is often 15 for a 14-week regular season
            let playoffStartWeek = league.settings?.playoff_start_week;
            if (!playoffStartWeek) {
                // Attempt to infer a common playoff start week if not explicitly set (e.g., Week 15 for a 14-week season)
                // This is a fallback and might not be accurate for all league custom settings.
                playoffStartWeek = 15; // Common default
                console.warn(`playoff_start_week not found for league ${leagueId}. Assuming default playoff start week: ${playoffStartWeek}`);
            }
            // Ensure playoff_start_week is at least 1
            playoffStartWeek = Math.max(1, playoffStartWeek);

            let regularSeasonWeeksEnd = playoffStartWeek - 1; // Last week of regular season

            let seasonMatchupsData = {}; // Temp storage for all matchups of this season

            // Fetch regular season matchups only for past/current seasons
            if (parseInt(season) <= parseInt(currentNFLSeason)) {
                console.log(`Fetching regular season matchups for season ${season} (${leagueId}) up to week ${regularSeasonWeeksEnd}...`);
                const weeksToFetchRegular = Array.from({ length: regularSeasonWeeksEnd }, (_, i) => i + 1); // Weeks 1 to regularSeasonWeeksEnd
                const regularMatchupsByWeek = await fetchMatchupsForLeague(leagueId, weeksToFetchRegular);
                Object.assign(seasonMatchupsData, regularMatchupsByWeek); // Merge into seasonMatchupsData

                if (Object.keys(regularMatchupsByWeek).length === 0) {
                    console.warn(`No regular season matchups collected for active/past season ${season} (${leagueId}). This might be expected for early parts of a season.`);
                }
            } else {
                console.log(`Skipping regular season matchup data for future season: ${season} (League ID: ${leagueId}).`);
            }

            // Fetch playoff bracket data
            let winnersBracket = [];
            let losersBracket = [];
            if (parseInt(season) <= parseInt(currentNFLSeason)) {
                console.log(`Fetching playoff bracket structure for season ${season} (${leagueId})...`);
                [winnersBracket, losersBracket] = await Promise.all([
                    fetchWinnersBracket(leagueId),
                    fetchLosersBracket(leagueId)
                ]);

                // Determine maximum playoff round to fetch all playoff matchup weeks
                const maxWinnersRound = winnersBracket.reduce((max, match) => Math.max(max, match.r || 0), 0);
                const maxLosersRound = losersBracket.reduce((max, match) => Math.max(max, match.r || 0), 0);
                const maxPlayoffRound = Math.max(maxWinnersRound, maxLosersRound);

                if (maxPlayoffRound > 0) {
                    console.log(`Fetching playoff matchup scores for season ${season} (from week ${playoffStartWeek} to ${playoffStartWeek + maxPlayoffRound - 1})...`);
                    const playoffWeeksToFetch = Array.from({ length: maxPlayoffRound }, (_, i) => playoffStartWeek + i);
                    const playoffMatchupsByWeek = await fetchMatchupsForLeague(leagueId, playoffWeeksToFetch);
                    Object.assign(seasonMatchupsData, playoffMatchupsByWeek); // Merge playoff week data
                } else {
                    console.log(`No playoff bracket data (or max round 0) for season ${season} (${leagueId}).`);
                }

                // Now, enrich the bracket data with scores from `seasonMatchupsData`
                allHistoricalData.winnersBracketBySeason[season] = enrichBracketWithScores(winnersBracket, seasonMatchupsData, playoffStartWeek);
                allHistoricalData.losersBracketBySeason[season] = enrichBracketWithScores(losersBracket, seasonMatchupsData, playoffStartWeek);

            } else {
                console.log(`Skipping playoff bracket data for future season: ${season} (League ID: ${leagueId}).`);
                allHistoricalData.winnersBracketBySeason[season] = [];
                allHistoricalData.losersBracketBySeason[season] = [];
            }
            allHistoricalData.matchupsBySeason[season] = seasonMatchupsData; // Store all matchups for the season
        }

        inMemoryCache.set(CACHE_KEY, { data: allHistoricalData, timestamp: now, expirationHours: 24 });
        console.log('Successfully fetched and cached all historical data (matchups, rosters, league metadata, and brackets).');
        return allHistoricalData;

    } catch (error) {
        console.error('Critical error in fetchAllHistoricalMatchups:', error);
        inMemoryCache.delete(CACHE_KEY); // Clear cache on critical error to force refetch next time
        return { matchupsBySeason: {}, rostersBySeason: {}, leaguesMetadataBySeason: {}, winnersBracketBySeason: {}, losersBracketBySeason: {} };
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
 * @param {string} leagueId The ID of the league.
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
        console.log('Returning all draft history from cache.');
        return cachedEntry.data;
    }

    console.log('Fetching all draft history for the first time...');
    const allDraftHistory = {};

    try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
        const nflPlayers = await fetchNFLPlayers(); // Fetch once for all seasons

        for (const league of leagues) {
            const season = league.season;
            const leagueId = league.league_id;

            console.log(`Fetching draft data for season: ${season} (League ID: ${leagueId})`);

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
        console.log('Successfully fetched and cached all draft history.');
        return allDraftHistory;

    } catch (error) {
        console.error('Critical error in fetchAllDraftHistory:', error);
        inMemoryCache.delete(CACHE_KEY);
        return {};
    }
}
