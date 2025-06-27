import { CURRENT_LEAGUE_ID } from '../config';

const historicalMatchupsCache = new Map();
const rosterDataCache = new Map();
const leagueDataCache = new Map();
const userDataCache = new Map();
const draftDataCache = new Map();
const draftPicksCache = new Map();
const tradedPicksCache = new Map();
const transactionsCache = new Map();
const winnersBracketCache = new Map();
const losersBracketCache = new Map();
let nflPlayersCache = null;
let nflPlayersCacheTimestamp = null;
const NFL_PLAYERS_CACHE_DURATION = 24 * 60 * 60 * 1000;
let nflStateCache = null;
let nflStateCacheTimestamp = null;
const NFL_STATE_CACHE_DURATION = 60 * 60 * 1000;

export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
'Ainsworth': '783790952367169536', 'Bjarnar': '783761299275382784', 'Blumbergs': '783789717920534528', 'Boilard': '783789669597999104', 'Dembski': '783767734491127808', 'Irwin': '467074573125283840', 'Meer': '783778036578418688', 'Neufeglise': '783763304463147008', 'O\'Donoghue': '783758716272009216',  'ODonoghue': '783758716272009216',  'Randall': '783754997035876352', 'Schmitt': '783761892693905408', 'Tomczak': '787044291066380288',
};

export const RETIRED_MANAGERS = new Set([]);

export const getSleeperAvatarUrl = (avatarId) => {
  return avatarId
    ? `https://sleepercdn.com/avatars/${avatarId}`
    : 'https://sleepercdn.com/avatars/default';
};

export const getSleeperPlayerHeadshotUrl = (playerId) => {
  return playerId
    ? `https://sleepercdn.com/headshots/${playerId}.jpg`
    : 'https://sleepercdn.com/headshots/default.jpg';
};

export const getTeamNameFromSleeperId = (rosterId) => {
  const teamName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(
    (teamName) => TEAM_NAME_TO_SLEEPER_ID_MAP[teamName] === rosterId
  );
  if (!teamName) {
    console.warn(`No team name found for roster_id: ${rosterId}`);
    return 'Unknown Team';
  }
  return teamName;
};

export async function fetchLeagueDetails(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return null;
  }
  if (leagueDataCache.has(leagueId)) {
    console.log(`Returning cached league data for league ${leagueId}`);
    return leagueDataCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    if (!response.ok) {
      console.error(`HTTP error fetching league details for ID ${leagueId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    leagueDataCache.set(leagueId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch league details for ID ${leagueId}:`, error);
    return null;
  }
}

export async function fetchUsersData(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return [];
  }
  if (userDataCache.has(leagueId)) {
    console.log(`Returning cached user data for league ${leagueId}`);
    return userDataCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    if (!response.ok) {
      console.error(`HTTP error fetching users for league ${leagueId}: ${response.status}`);
      return [];
    }
    const users = await response.json();
    const formattedUsers = users.map(user => ({
      userId: user.user_id,
      username: user.display_name,
      teamName: user.metadata?.team_name || user.display_name,
      avatar: user.avatar ? getSleeperAvatarUrl(user.avatar) : getSleeperAvatarUrl(''),
    }));
    userDataCache.set(leagueId, formattedUsers);
    return formattedUsers;
  } catch (error) {
    console.error(`Failed to fetch users for league ${leagueId}:`, error);
    return [];
  }
}

export async function fetchNFLPlayers() {
  const now = Date.now();
  if (nflPlayersCache && nflPlayersCacheTimestamp && (now - nflPlayersCacheTimestamp < NFL_PLAYERS_CACHE_DURATION)) {
    console.log('Returning cached NFL players');
    return nflPlayersCache;
  }
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!response.ok) {
      console.error(`HTTP error fetching NFL players: ${response.status}`);
      return {};
    }
    const data = await response.json();
    nflPlayersCache = data;
    nflPlayersCacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Failed to fetch NFL players:', error);
    return {};
  }
}

export async function fetchNFLState() {
  const now = Date.now();
  if (nflStateCache && nflStateCacheTimestamp && (now - nflStateCacheTimestamp < NFL_STATE_CACHE_DURATION)) {
    console.log('Returning cached NFL state');
    return nflStateCache;
  }
  try {
    const response = await fetch('https://api.sleeper.app/v1/state/nfl');
    if (!response.ok) {
      console.error(`HTTP error fetching NFL state: ${response.status}`);
      return null;
    }
    const data = await response.json();
    nflStateCache = data;
    nflStateCacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Failed to fetch NFL state:', error);
    return null;
  }
}

export async function fetchMatchupsForLeague(leagueId, week, season) {
  if (!leagueId || !week || !season) {
    console.warn(`Invalid parameters for fetchMatchupsForLeague: leagueId=${leagueId}, week=${week}, season=${season}`);
    return [];
  }
  const cacheKey = `${leagueId}_${season}_${week}`;
  if (historicalMatchupsCache.has(cacheKey)) {
    console.log(`Returning cached matchups for league ${leagueId}, season ${season}, week ${week}`);
    return historicalMatchupsCache.get(cacheKey);
  }
  try {
    console.log(`Fetching matchups for league ${leagueId}, season ${season}, week ${week}...`);
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
    if (!response.ok) {
      console.error(`HTTP error fetching matchups for league ${leagueId}, week ${week}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    const matchupsWithSeason = data.map(matchup => ({
      ...matchup,
      season,
    }));
    historicalMatchupsCache.set(cacheKey, matchupsWithSeason);
    return matchupsWithSeason;
  } catch (error) {
    console.error(`Failed to fetch matchups for league ${leagueId}, week ${week}:`, error);
    return [];
  }
}

export async function fetchAllHistoricalMatchups() {
  const allMatchups = {};
  let currentLeagueId = CURRENT_LEAGUE_ID;
  let leagueDetails = await fetchLeagueDetails(currentLeagueId);
  if (!leagueDetails) {
    console.error(`No league details found for league ${currentLeagueId}`);
    return {};
  }

  while (leagueDetails) {
    const season = leagueDetails.season;
    allMatchups[season] = {};
    const totalWeeks = leagueDetails.total_weeks || 18;
    for (let week = 1; week <= totalWeeks; week++) {
      const matchups = await fetchMatchupsForLeague(currentLeagueId, week, season);
      if (matchups.length > 0) {
        allMatchups[season][week] = matchups;
      }
    }
    const previousLeagueId = leagueDetails.previous_league_id;
    if (!previousLeagueId || previousLeagueId === '0') {
      break;
    }
    currentLeagueId = previousLeagueId;
    leagueDetails = await fetchLeagueDetails(currentLeagueId);
  }
  return allMatchups;
}

export async function fetchRosterData(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return [];
  }
  if (rosterDataCache.has(leagueId)) {
    console.log(`Returning cached roster data for league ${leagueId}`);
    return rosterDataCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
    if (!response.ok) {
      console.error(`HTTP error fetching rosters for league ${leagueId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    rosterDataCache.set(leagueId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch rosters for league ${leagueId}:`, error);
    return [];
  }
}

export async function fetchRostersWithDetails(leagueId) {
  const rosters = await fetchRosterData(leagueId);
  const players = await fetchNFLPlayers();
  return rosters.map(roster => ({
    ...roster,
    players: roster.players.map(playerId => ({
      id: playerId,
      details: players[playerId] || { name: 'Unknown Player' },
    })),
  }));
}

export async function fetchTransactionsForWeek(leagueId, week) {
  if (!leagueId || !week) {
    console.warn(`Invalid parameters for fetchTransactionsForWeek: leagueId=${leagueId}, week=${week}`);
    return [];
  }
  const cacheKey = `${leagueId}_${week}`;
  if (transactionsCache.has(cacheKey)) {
    console.log(`Returning cached transactions for league ${leagueId}, week ${week}`);
    return transactionsCache.get(cacheKey);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
    if (!response.ok) {
      console.error(`HTTP error fetching transactions for league ${leagueId}, week ${week}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    transactionsCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch transactions for league ${leagueId}, week ${week}:`, error);
    return [];
  }
}

export async function fetchLeagueDrafts(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return [];
  }
  if (draftDataCache.has(leagueId)) {
    console.log(`Returning cached draft data for league ${leagueId}`);
    return draftDataCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
    if (!response.ok) {
      console.error(`HTTP error fetching drafts for league ${leagueId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    draftDataCache.set(leagueId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch drafts for league ${leagueId}:`, error);
    return [];
  }
}

export async function fetchDraftDetails(draftId) {
  if (!draftId) {
    console.warn(`Invalid draft ID: ${draftId}`);
    return null;
  }
  if (draftDataCache.has(draftId)) {
    console.log(`Returning cached draft details for draft ${draftId}`);
    return draftDataCache.get(draftId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}`);
    if (!response.ok) {
      console.error(`HTTP error fetching draft details for ID ${draftId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    draftDataCache.set(draftId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch draft details for ID ${draftId}:`, error);
    return null;
  }
}

export async function fetchDraftPicks(draftId) {
  if (!draftId) {
    console.warn(`Invalid draft ID: ${draftId}`);
    return [];
  }
  if (draftPicksCache.has(draftId)) {
    console.log(`Returning cached draft picks for draft ${draftId}`);
    return draftPicksCache.get(draftId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
    if (!response.ok) {
      console.error(`HTTP error fetching draft picks for draft ${draftId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    draftPicksCache.set(draftId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch draft picks for draft ${draftId}:`, error);
    return [];
  }
}

export async function fetchTradedPicks(draftId) {
  if (!draftId) {
    console.warn(`Invalid draft ID: ${draftId}`);
    return [];
  }
  if (tradedPicksCache.has(draftId)) {
    console.log(`Returning cached traded picks for draft ${draftId}`);
    return tradedPicksCache.get(draftId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/traded_picks`);
    if (!response.ok) {
      console.error(`HTTP error fetching traded picks for draft ${draftId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    tradedPicksCache.set(draftId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch traded picks for draft ${draftId}:`, error);
    return [];
  }
}

export async function fetchAllDraftHistory() {
  const allDrafts = {};
  let currentLeagueId = CURRENT_LEAGUE_ID;
  let leagueDetails = await fetchLeagueDetails(currentLeagueId);
  if (!leagueDetails) {
    console.error(`No league details found for league ${currentLeagueId}`);
    return {};
  }

  while (leagueDetails) {
    const season = leagueDetails.season;
    const drafts = await fetchLeagueDrafts(currentLeagueId);
    allDrafts[season] = [];
    for (const draft of drafts) {
      const draftDetails = await fetchDraftDetails(draft.draft_id);
      const draftPicks = await fetchDraftPicks(draft.draft_id);
      const tradedPicks = await fetchTradedPicks(draft.draft_id);
      allDrafts[season].push({
        draftDetails,
        draftPicks,
        tradedPicks,
      });
    }
    const previousLeagueId = leagueDetails.previous_league_id;
    if (!previousLeagueId || previousLeagueId === '0') {
      break;
    }
    currentLeagueId = previousLeagueId;
    leagueDetails = await fetchLeagueDetails(currentLeagueId);
  }
  return allDrafts;
}

export async function fetchWinnersBracket(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return [];
  }
  if (winnersBracketCache.has(leagueId)) {
    console.log(`Returning cached winners bracket for league ${leagueId}`);
    return winnersBracketCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`);
    if (!response.ok) {
      console.error(`HTTP error fetching winners bracket for league ${leagueId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    winnersBracketCache.set(leagueId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch winners bracket for league ${leagueId}:`, error);
    return [];
  }
}

export async function fetchLosersBracket(leagueId) {
  if (!leagueId || typeof leagueId !== 'string' || leagueId === '0') {
    console.warn(`Invalid league ID: ${leagueId}`);
    return [];
  }
  if (losersBracketCache.has(leagueId)) {
    console.log(`Returning cached losers bracket for league ${leagueId}`);
    return losersBracketCache.get(leagueId);
  }
  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/losers_bracket`);
    if (!response.ok) {
      console.error(`HTTP error fetching losers bracket for league ${leagueId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    losersBracketCache.set(leagueId, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch losers bracket for league ${leagueId}:`, error);
    return [];
  }
}

// New helper function to determine regular season weeks
export async function getRegularSeasonWeeks(leagueId) {
  const leagueDetails = await fetchLeagueDetails(leagueId);
  if (!leagueDetails) return 14; // Default to 14 weeks if no details
  return leagueDetails.settings?.playoff_week_start
    ? leagueDetails.settings.playoff_week_start - 1
    : 14;
}

// New helper function to infer matchup metadata
export async function inferMatchupMetadata(matchups, leagueId, season, week) {
  const regularSeasonWeeks = await getRegularSeasonWeeks(leagueId);
  const winnersBracket = await fetchWinnersBracket(leagueId);
  const losersBracket = await fetchLosersBracket(leagueId);
  const playoffMatchupIds = new Set([
    ...winnersBracket.map(m => m.m),
    ...losersBracket.map(m => m.m),
  ]);

  return matchups.map(matchup => {
    const isRegularSeason = parseInt(week) <= regularSeasonWeeks;
    const isPlayoff = playoffMatchupIds.has(matchup.matchup_id);
    const isBye = !matchup.opponent || matchup.points === 0;
    let finalSeedingGame = null;

    if (isPlayoff && winnersBracket.some(m => m.m === matchup.matchup_id)) {
      const bracketMatch = winnersBracket.find(m => m.m === matchup.matchup_id);
      if (bracketMatch.r === 1) finalSeedingGame = 1; // Championship
      else if (bracketMatch.r === 2) finalSeedingGame = 3; // Semifinals
      else if (bracketMatch.r === 3) finalSeedingGame = 5; // Quarterfinals
    }

    return {
      ...matchup,
      regSeason: isRegularSeason && !isPlayoff,
      pointsOnlyBye: isBye,
      playoffs: isPlayoff,
      finalSeedingGame,
    };
  });
}
