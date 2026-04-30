import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const POPULAR_PLAYER_IDS = [
    '7564',   // Ja'Marr Chase
    '4866',   // Saquon Barkley
    '6794',   // Justin Jefferson
    '4984',   // Josh Allen
    '7588',   // CeeDee Lamb
    '3164',   // Christian McCaffrey
    '7547',   // Amon-Ra St. Brown
    '4972',   // Lamar Jackson
    '7523',   // Derrick Henry
    '4035',   // Josh Jacobs
    '8155',   // Nico Collins
    '3972',   // Joe Burrow
    '7652',   // Jalen Hurts
    '4029',   // Jonathan Taylor
    '6904',   // A.J. Brown
    '2371',   // Tyreek Hill
    '1374',   // Todd Gurley
    '3163',   // Patrick Mahomes
    '7986',   // Tee Higgins
    '4034',   // Alvin Kamara
];

const POSITION_COLORS = {
    QB: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: '#ef4444' },
    RB: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', dot: '#3b82f6' },
    WR: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', dot: '#22c55e' },
    TE: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: '#eab308' },
    K:  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', dot: '#a855f7' },
    DEF:{ bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/30',   dot: '#6b7280' },
};
const posStyle = (pos) => POSITION_COLORS[pos] || POSITION_COLORS.DEF;

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────
const fetchLeagueMatchupsForWeek = async (leagueId, week) => {
    try {
        const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
        if (!res.ok) return [];
        return await res.json();
    } catch { return []; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Data builder — scans all historical draft picks + rosters to find every
// season/week a player appeared on each team
// ─────────────────────────────────────────────────────────────────────────────
const buildPlayerLeagueHistory = (historicalData, nflPlayers, leagueData) => {
    // Returns: Map<playerId, { stints: [...], totalGames, totalPoints, ... }>
    // A "stint" = contiguous block with the same team in the same season

    if (!historicalData?.rostersBySeason || !historicalData?.matchupsBySeason) return new Map();

    const seasons = Object.keys(historicalData.matchupsBySeason).sort((a, b) => Number(a) - Number(b));

    // Build: playerId → [ { season, week, rosterId, ownerId, points, isStarter } ]
    const playerWeeklyAppearances = new Map();

    const getLeagueIdForSeason = (season) => {
        const curSeason = Array.isArray(leagueData) ? leagueData[0]?.season : leagueData?.season;
        if (String(season) === String(curSeason)) {
            return Array.isArray(leagueData) ? leagueData[0]?.league_id : leagueData?.league_id;
        }
        return historicalData?.leaguesMetadataBySeason?.[season]?.league_id ?? null;
    };

    seasons.forEach(season => {
        const rosters = historicalData.rostersBySeason[season] || [];
        // For each roster, look at their players list from the matchup/roster data
        // We use draftPicksBySeason to seed player→team mappings, then supplement with roster snapshots
        rosters.forEach(roster => {
            const ownerId = roster.owner_id;
            const rosterId = roster.roster_id;
            // roster.players is the current roster snapshot (end of season)
            if (Array.isArray(roster.players)) {
                roster.players.forEach(playerId => {
                    if (!playerWeeklyAppearances.has(playerId)) playerWeeklyAppearances.set(playerId, []);
                    playerWeeklyAppearances.get(playerId).push({
                        season: String(season),
                        rosterId: String(rosterId),
                        ownerId: String(ownerId),
                        isRosterSnapshot: true,
                    });
                });
            }
        });
    });

    return { playerWeeklyAppearances, getLeagueIdForSeason, seasons };
};

// Build player journey by scanning matchup data week-by-week
// This accurately tracks mid-season trades and ownership changes
// Returns array of stints per player, where each stint is a contiguous block on one roster
// Only tracks QB, RB, WR, TE, K, DEF positions
const computePlayerStints = (playerId, historicalData, leagueData, nflPlayers) => {
    if (!historicalData?.matchupsBySeason) return [];

    // Only track valid positions
    const playerInfo = nflPlayers?.[playerId];
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    if (!playerInfo || !validPositions.includes(playerInfo.position)) return [];

    const seasons = Object.keys(historicalData.matchupsBySeason).sort((a, b) => Number(a) - Number(b));
    const stints = [];

    seasons.forEach(season => {
        const matchups = historicalData.matchupsBySeason[season] || [];
        
        // Build week-by-week ownership map
        // For each week, find which roster has this player (by checking both team1 and team2 players)
        const weekOwnershipMap = new Map(); // week -> { rosterId, teamPlayers }
        
        matchups.forEach(matchup => {
            const week = Number(matchup.week);
            
            // Check team1
            if (matchup.team1_players?.players_points && playerId in matchup.team1_players.players_points) {
                weekOwnershipMap.set(week, {
                    rosterId: String(matchup.team1_roster_id),
                    teamPlayers: matchup.team1_players,
                });
            }
            // Check team2
            else if (matchup.team2_players?.players_points && playerId in matchup.team2_players.players_points) {
                weekOwnershipMap.set(week, {
                    rosterId: String(matchup.team2_roster_id),
                    teamPlayers: matchup.team2_players,
                });
            }
        });
        
        if (weekOwnershipMap.size === 0) return; // Player didn't play this season
        
        // Group weeks into contiguous stints on the same roster
        const sortedWeeks = Array.from(weekOwnershipMap.keys()).sort((a, b) => a - b);
        let currentStintRosterId = null;
        let currentStintStart = null;
        
        sortedWeeks.forEach((week, idx) => {
            const ownership = weekOwnershipMap.get(week);
            const rosterId = ownership.rosterId;
            
            // Check if we need to start a new stint (different roster than previous)
            if (currentStintRosterId !== rosterId) {
                // Save previous stint if exists
                if (currentStintRosterId !== null) {
                    const prevWeek = sortedWeeks[idx - 1];
                    stints.push({
                        season,
                        rosterId: currentStintRosterId,
                        startWeek: currentStintStart,
                        endWeek: prevWeek,
                        weeks: sortedWeeks.filter(w => {
                            const own = weekOwnershipMap.get(w);
                            return own?.rosterId === currentStintRosterId && w >= currentStintStart && w <= prevWeek;
                        }),
                    });
                }
                
                // Start new stint
                currentStintRosterId = rosterId;
                currentStintStart = week;
            }
        });
        
        // Save final stint
        if (currentStintRosterId !== null) {
            const finalWeek = sortedWeeks[sortedWeeks.length - 1];
            stints.push({
                season,
                rosterId: currentStintRosterId,
                startWeek: currentStintStart,
                endWeek: finalWeek,
                weeks: sortedWeeks.filter(w => {
                    const own = weekOwnershipMap.get(w);
                    return own?.rosterId === currentStintRosterId && w >= currentStintStart && w <= finalWeek;
                }),
            });
        }
    });

    return stints;
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility components
// ─────────────────────────────────────────────────────────────────────────────
const PlayerAvatar = ({ playerId, size = 'md' }) => {
    const sz = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : size === 'xl' ? 'w-24 h-24' : 'w-10 h-10';
    return (
        <img
            src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
            alt=""
            className={`${sz} rounded-full object-cover bg-gray-700 flex-shrink-0`}
            onError={e => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
        />
    );
};

const TeamAvatar = ({ ownerId, year, getTeamDetails, size = 'sm' }) => {
    const sz = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
    const details = getTeamDetails?.(ownerId, year);
    const url = details?.avatar || 'https://sleepercdn.com/avatars/default_avatar.png';
    return (
        <img src={url} alt="" className={`${sz} rounded-full object-cover bg-gray-700 flex-shrink-0 border border-white/15`}
            onError={e => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }} />
    );
};

const PosBadge = ({ pos }) => {
    const s = posStyle(pos);
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text} border ${s.border}`}>{pos}</span>;
};

const StatBox = ({ label, value, accent }) => (
    <div className="bg-white/5 border border-white/8 rounded-xl p-4 text-center">
        <div className={`text-2xl font-bold ${accent || 'text-white'}`}>{value}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{label}</div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const PlayerHistory = () => {
    const { historicalData, nflPlayers, getTeamName, getTeamDetails, leagueData } = useSleeperData();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerDetail, setPlayerDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [journeymen, setJourneymen] = useState([]);
    const inputRef = useRef(null);

    // ── Build search index from nflPlayers ──────────────────────────────────
    const playerIndex = useMemo(() => {
        if (!nflPlayers) return [];
        return Object.entries(nflPlayers)
            .filter(([, p]) => p && p.position && ['QB','RB','WR','TE','K','DEF'].includes(p.position))
            .map(([id, p]) => ({
                id,
                name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                position: p.position,
                team: p.team || 'FA',
                college: p.college,
                age: p.age,
                height: p.height,
                weight: p.weight,
                years_exp: p.years_exp,
                number: p.number,
            }));
    }, [nflPlayers]);

    // ── Which players have appeared in our league? ────────────────────────────
    const leaguePlayers = useMemo(() => {
        const ids = new Set();
        if (!historicalData?.rostersBySeason) return ids;
        Object.values(historicalData.rostersBySeason).forEach(rosters => {
            rosters.forEach(r => {
                if (Array.isArray(r.players)) r.players.forEach(id => ids.add(String(id)));
            });
        });
        // Also from draftPicksBySeason
        if (historicalData?.draftPicksBySeason) {
            Object.values(historicalData.draftPicksBySeason).forEach(picks => {
                picks.forEach(p => {
                    const id = p?.player_id || p?.playerId;
                    if (id) ids.add(String(id));
                });
            });
        }
        return ids;
    }, [historicalData]);

    // ── Helper: Count stints and teams for a player (for journeymen ranking) ───
    const getPlayerStintAndTeamCounts = useCallback((playerId, nflPlayer) => {
        if (!historicalData?.matchupsBySeason || !nflPlayer) return null;
        
        // Only track valid positions
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        if (!validPositions.includes(nflPlayer.position)) return null;

        const seasons = Object.keys(historicalData.matchupsBySeason).sort((a, b) => Number(a) - Number(b));
        const uniqueTeams = new Set();
        const stintCombos = new Set(); // (season, rosterId) pairs
        let lastOwner = null;
        let lastSeason = null;

        seasons.forEach(season => {
            const matchups = historicalData.matchupsBySeason[season] || [];
            const weekOwnershipMap = new Map(); // week -> rosterId

            matchups.forEach(matchup => {
                const week = Number(matchup.week);
                
                // Check team1
                if (matchup.team1_players?.players_points && playerId in matchup.team1_players.players_points) {
                    weekOwnershipMap.set(week, String(matchup.team1_roster_id));
                }
                // Check team2
                else if (matchup.team2_players?.players_points && playerId in matchup.team2_players.players_points) {
                    weekOwnershipMap.set(week, String(matchup.team2_roster_id));
                }
            });

            // If player appeared this season, count unique rosters and register teams
            if (weekOwnershipMap.size > 0) {
                const rosterIds = new Set(weekOwnershipMap.values());
                rosterIds.forEach(rosterId => {
                    stintCombos.add(`${season}-${rosterId}`);
                    
                    // Find owner for this roster
                    const rosterData = historicalData.rostersBySeason?.[season]?.find(
                        r => String(r.roster_id) === rosterId
                    );
                    if (rosterData) {
                        uniqueTeams.add(String(rosterData.owner_id));
                        lastOwner = String(rosterData.owner_id);
                        lastSeason = season;
                    }
                });
            }
        });

        if (uniqueTeams.size === 0) return null;

        return {
            teamCount: uniqueTeams.size,
            stintCount: stintCombos.size,
            lastOwner,
            lastSeason,
        };
    }, [historicalData]);

    // ── Compute league journeymen ─────────────────────────────────────────────
    useEffect(() => {
        if (!historicalData?.matchupsBySeason || !nflPlayers) return;

        const results = [];
        
        Object.entries(nflPlayers).forEach(([pid, playerInfo]) => {
            if (!playerInfo || !playerInfo.full_name) return;
            
            const counts = getPlayerStintAndTeamCounts(pid, playerInfo);
            if (!counts) return;
            
            // Only include players with 3+ teams (journeymen threshold)
            if (counts.teamCount < 3) return;
            
            results.push({
                id: pid,
                name: playerInfo.full_name,
                position: playerInfo.position,
                team: playerInfo.team || 'FA',
                teamCount: counts.teamCount,
                stintCount: counts.stintCount,
                lastOwner: counts.lastOwner,
                lastSeason: counts.lastSeason,
            });
        });

        results.sort((a, b) => b.stintCount - a.stintCount || b.teamCount - a.teamCount);
        setJourneymen(results.slice(0, 12));
    }, [historicalData, nflPlayers, getPlayerStintAndTeamCounts]);

    // ── Search ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!query.trim()) { setSearchResults([]); return; }
        const q = query.toLowerCase();
        const results = playerIndex
            .filter(p => p.name.toLowerCase().includes(q))
            .sort((a, b) => {
                // Prioritize exact starts, then league players
                const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                const aLeague = leaguePlayers.has(a.id) ? 0 : 1;
                const bLeague = leaguePlayers.has(b.id) ? 0 : 1;
                return (aStart + aLeague) - (bStart + bLeague);
            })
            .slice(0, 8);
        setSearchResults(results);
    }, [query, playerIndex, leaguePlayers]);

    // ── Resolve leagueId for a given season ────────────────────────────────────
    const getLeagueIdForSeason = useCallback((season) => {
        const curSeason = Array.isArray(leagueData) ? leagueData[0]?.season : leagueData?.season;
        if (String(season) === String(curSeason)) {
            return Array.isArray(leagueData) ? leagueData[0]?.league_id : leagueData?.league_id;
        }
        return historicalData?.leaguesMetadataBySeason?.[season]?.league_id ?? null;
    }, [leagueData, historicalData]);

    // ── Load player detail — stints + per-week stats via API ─────────────────
    const loadPlayerDetail = useCallback(async (player) => {
        setDetailLoading(true);
        setPlayerDetail(null);
        setSelectedPlayer(player);

        const pid = String(player.id);

        // Get stints using the new week-by-week tracking function
        const rawStints = computePlayerStints(pid, historicalData, leagueData, nflPlayers);

        if (rawStints.length === 0) {
            setPlayerDetail({
                stints: [],
                totalPoints: 0,
                totalStarts: 0,
                totalGames: 0,
                avgPPG: 0,
                cdr: 0,
                winRate: 0,
                totalWins: 0,
                totalLosses: 0,
            });
            setDetailLoading(false);
            return;
        }

        // For each stint, fetch raw API matchup data to get players_points + starters
        // Also identify weeks where player was unavailable (injured, not on any roster)
        for (const stint of rawStints) {
            const leagueId = getLeagueIdForSeason(stint.season);
            if (!leagueId) {
                stint.points = 0;
                stint.starts = 0;
                stint.wins = 0;
                stint.losses = 0;
                stint.gamesOnRoster = 0;
                stint.weeklyPoints = [];
                continue;
            }

            let totalPoints = 0, totalStarts = 0, wins = 0, losses = 0;
            let startingPoints = 0;  // Points only from starts (for PPG calculation)
            const weeklyPoints = [];
            let gamesOnRoster = 0;

            // Build a map of all weeks in season to check for unavailable games
            const seasonMatchups = historicalData.matchupsBySeason?.[stint.season] || [];
            const allSeasonWeeks = new Set();
            seasonMatchups.forEach(m => allSeasonWeeks.add(Number(m.week)));

            for (const week of stint.weeks) {
                try {
                    const weekData = await fetchLeagueMatchupsForWeek(leagueId, week);
                    if (!Array.isArray(weekData)) continue;

                    const rosterEntry = weekData.find(r => String(r.roster_id) === stint.rosterId);
                    if (!rosterEntry) continue;

                    const ppMap = rosterEntry.players_points || {};
                    const starters = rosterEntry.starters || [];
                    const pts = Number(ppMap[pid] ?? 0);
                    const isStarter = starters.includes(pid);
                    const playerWasActive = pid in ppMap || starters.includes(pid);

                    // Count game on roster only if player appears (started or had any point value)
                    if (playerWasActive) {
                        gamesOnRoster++;
                    }

                    // Only count points if player was active
                    if (playerWasActive) {
                        totalPoints += pts;
                        if (isStarter) {
                            totalStarts++;
                            startingPoints += pts;  // Only add to startingPoints if starter
                        }
                    }

                    // Get opponent score for W/L
                    const matchupId = rosterEntry.matchup_id;
                    const opponent = weekData.find(r => r.matchup_id === matchupId && String(r.roster_id) !== stint.rosterId);

                    if (opponent && playerWasActive) {
                        if (rosterEntry.points > opponent.points) wins++;
                        else if (rosterEntry.points < opponent.points) losses++;
                    }

                    weeklyPoints.push({
                        week,
                        points: playerWasActive ? pts : null,  // null = unavailable
                        isStarter,
                        wasActive: playerWasActive,
                    });
                } catch {
                    continue;
                }
            }

            // Get roster/owner info from historical data
            const rosterData = historicalData.rostersBySeason?.[stint.season]?.find(
                r => String(r.roster_id) === stint.rosterId
            );

            stint.points = totalPoints;
            stint.startingPoints = startingPoints;  // Track starting points separately
            stint.starts = totalStarts;
            stint.wins = wins;
            stint.losses = losses;
            stint.gamesOnRoster = gamesOnRoster;
            stint.ownerId = rosterData?.owner_id ? String(rosterData.owner_id) : '?';
            stint.weeklyPoints = weeklyPoints;
        }

        // Aggregate totals
        const totalPoints = rawStints.reduce((s, st) => s + (st.points || 0), 0);
        const totalStartingPoints = rawStints.reduce((s, st) => s + (st.startingPoints || 0), 0);
        const totalStarts = rawStints.reduce((s, st) => s + (st.starts || 0), 0);
        const totalGames = rawStints.reduce((s, st) => s + (st.gamesOnRoster || 0), 0);
        const totalWins = rawStints.reduce((s, st) => s + (st.wins || 0), 0);
        const totalLosses = rawStints.reduce((s, st) => s + (st.losses || 0), 0);
        const avgPPG = totalStarts > 0 ? (totalStartingPoints / totalStarts) : 0;  // PPG based on starting points only
        const cdr = totalGames > 0 ? (totalStarts / totalGames) * 100 : 0;
        const winRate = (totalWins + totalLosses) > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;

        setPlayerDetail({
            stints: rawStints,
            totalPoints,
            totalStarts,
            totalGames,
            avgPPG,
            cdr,
            winRate,
            totalWins,
            totalLosses,
        });
        setDetailLoading(false);
    }, [historicalData, getLeagueIdForSeason]);

    const handleSelectPlayer = (player) => {
        setQuery('');
        setSearchResults([]);
        loadPlayerDetail(player);
    };

    const handleBack = () => {
        setSelectedPlayer(null);
        setPlayerDetail(null);
    };

    const fullPlayerInfo = selectedPlayer && nflPlayers ? nflPlayers[selectedPlayer.id] : null;

    // ── Team name & owner resolution helpers ────────────────────────────────
    const getTeamInfo = useCallback((ownerId, season) => {
        const name = getTeamName(ownerId, season);
        return { name };
    }, [getTeamName]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Player Detail View
    // ─────────────────────────────────────────────────────────────────────────
    if (selectedPlayer) {
        const pos = fullPlayerInfo?.position || selectedPlayer.position || '?';
        const ps = posStyle(pos);
        const nflTeam = fullPlayerInfo?.team || selectedPlayer.team || 'FA';

        return (
            <div className="max-w-5xl mx-auto space-y-6 pb-12">
                {/* Back + search bar */}
                <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2">
                        ← Back
                    </button>
                    <div className="flex-1 relative">
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search players…"
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                {searchResults.map(p => (
                                    <button key={p.id} onClick={() => handleSelectPlayer(p)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                                        <PlayerAvatar playerId={p.id} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.team} · {p.position}</div>
                                        </div>
                                        {leaguePlayers.has(p.id) && <span className="text-[10px] text-blue-400 font-semibold">IN LEAGUE</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Header card */}
                <div className="relative bg-gradient-to-r from-gray-800 to-gray-800/50 border border-white/10 rounded-2xl overflow-hidden">
                    {/* Team logo watermark */}
                    {nflTeam && nflTeam !== 'FA' && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
                            <img src={`https://sleepercdn.com/images/team_logos/nfl/${nflTeam?.toLowerCase()}.jpg`}
                                alt="" className="w-32 h-32 object-contain"
                                onError={e => { e.target.style.display='none'; }} />
                        </div>
                    )}
                    <div className="relative flex items-center gap-5 p-6">
                        <PlayerAvatar playerId={selectedPlayer.id} size="xl" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-1">
                                <h1 className="text-3xl font-bold text-white">{selectedPlayer.name}</h1>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-400 mb-3">
                                <PosBadge pos={pos} />
                                <span className="text-gray-300 font-semibold">{nflTeam}</span>
                                {fullPlayerInfo?.number && <span>#{fullPlayerInfo.number}</span>}
                                {fullPlayerInfo?.college && (
                                    <span className="flex items-center gap-1">
                                        <span className="text-gray-600">⌂</span> {fullPlayerInfo.college}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                                {fullPlayerInfo?.age && <span># AGE: <span className="text-gray-200 font-semibold">{fullPlayerInfo.age} yrs</span></span>}
                                {fullPlayerInfo?.height && <span>↕ HT: <span className="text-gray-200 font-semibold">{Math.floor(fullPlayerInfo.height/12)}'{fullPlayerInfo.height%12}"</span></span>}
                                {fullPlayerInfo?.weight && <span>⊕ WT: <span className="text-gray-200 font-semibold">{fullPlayerInfo.weight} lbs</span></span>}
                                {fullPlayerInfo?.years_exp != null && <span>⏱ EXP: <span className="text-gray-200 font-semibold">{fullPlayerInfo.years_exp} yrs</span></span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stat boxes */}
                {detailLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/10 border-t-blue-400" />
                        <p className="text-sm text-gray-400">Building league history…</p>
                        <p className="text-xs text-gray-600">Fetching weekly lineup data across all seasons</p>
                    </div>
                ) : playerDetail ? (
                    <>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            <StatBox label="Total Points" value={playerDetail.totalPoints.toFixed(1)} accent="text-blue-300" />
                            <StatBox label="Avg PPG" value={playerDetail.avgPPG.toFixed(1)} accent="text-emerald-300" />
                            <StatBox label="Games Started" value={playerDetail.totalStarts} />
                            <StatBox label="Games Benched" value={playerDetail.totalGames - playerDetail.totalStarts} />
                            <StatBox label="CDR" value={`${playerDetail.cdr.toFixed(1)}%`} accent="text-yellow-300" />
                            <StatBox label="Team Win Rate" value={`${playerDetail.winRate.toFixed(1)}%`} accent={playerDetail.winRate >= 50 ? 'text-green-300' : 'text-red-300'} />
                        </div>

                        {/* Chain of Custody */}
                        <div className="bg-gray-800/60 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10">
                                <h2 className="text-base font-bold text-white">Chain of Custody</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Every team this player has been on in the league</p>
                            </div>
                            <div className="divide-y divide-white/5">
                                {playerDetail.stints.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-gray-500 text-sm">
                                        No league history found — this player may not have been on a roster in our historical data.
                                    </div>
                                ) : playerDetail.stints.map((stint, idx) => {
                                    const teamInfo = getTeamInfo(stint.ownerId, stint.season);
                                    const ppg = stint.starts > 0 ? (stint.startingPoints / stint.starts).toFixed(1) : '—';
                                    const cdr = stint.gamesOnRoster > 0 ? Math.round((stint.starts / stint.gamesOnRoster) * 100) : 0;
                                    const isFirst = idx === 0;
                                    const isLast = idx === playerDetail.stints.length - 1;

                                    return (
                                        <div key={`${stint.season}-${stint.rosterId}`}
                                            className={`flex items-center gap-4 px-6 py-4 ${isLast ? 'bg-white/3' : ''} hover:bg-white/3 transition-colors`}>
                                            {/* Timeline dot */}
                                            <div className="flex flex-col items-center self-stretch shrink-0">
                                                <div className={`w-3 h-3 rounded-full border-2 mt-1 ${isLast ? 'border-blue-400 bg-blue-400/30' : 'border-gray-500 bg-gray-700'}`} />
                                                {!isLast && <div className="w-0.5 flex-1 bg-gray-700/60 mt-1" />}
                                            </div>

                                            {/* Team info */}
                                            <TeamAvatar ownerId={stint.ownerId} year={stint.season} getTeamDetails={getTeamDetails} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 flex-wrap">
                                                    <span className={`font-semibold text-sm ${isLast ? 'text-blue-300' : 'text-white'}`}>{teamInfo.name}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {stint.season} Wk {stint.startWeek}{stint.startWeek !== stint.endWeek ? `–${stint.endWeek}` : ''}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="hidden sm:flex items-center gap-6 shrink-0">
                                                {[
                                                    { label: 'G', value: stint.gamesOnRoster },
                                                    { label: 'PPG', value: ppg },
                                                    { label: 'STARTS', value: stint.starts },
                                                    { label: 'CDR', value: `${cdr}%` },
                                                    { label: 'W-L', value: `${stint.wins}-${stint.losses}` },
                                                ].map(({ label, value }) => (
                                                    <div key={label} className="text-center">
                                                        <div className="text-xs font-bold text-white">{value}</div>
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Mobile stats */}
                                            <div className="sm:hidden flex items-center gap-3 shrink-0 text-xs">
                                                <div className="text-right">
                                                    <div className="font-bold text-white">{stint.points.toFixed(1)}</div>
                                                    <div className="text-[9px] text-gray-500">PTS</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-white">{stint.gamesOnRoster}</div>
                                                    <div className="text-[9px] text-gray-500">G</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Season-by-season points chart (simple bar visualization) */}
                        {playerDetail.stints.some(s => s.weeklyPoints.length > 0) && (
                            <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-6">
                                <h2 className="text-sm font-bold text-white mb-4">Points by Stint</h2>
                                <div className="space-y-3">
                                    {playerDetail.stints.filter(s => s.points > 0).map(stint => {
                                        const teamInfo = getTeamInfo(stint.ownerId, stint.season);
                                        const maxPoints = Math.max(...playerDetail.stints.filter(s => s.points > 0).map(s => s.points));
                                        const barWidth = maxPoints > 0 ? (stint.points / maxPoints) * 100 : 0;
                                        return (
                                            <div key={`bar-${stint.season}-${stint.rosterId}`} className="flex items-center gap-3">
                                                <div className="w-32 shrink-0">
                                                    <div className="text-xs font-semibold text-white truncate">{teamInfo.name}</div>
                                                    <div className="text-[10px] text-gray-500">{stint.season}</div>
                                                </div>
                                                <div className="flex-1 bg-gray-700/40 rounded-full h-2 overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
                                                        style={{ width: `${barWidth}%` }} />
                                                </div>
                                                <div className="w-16 text-right text-xs font-mono text-gray-300">{stint.points.toFixed(1)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        {leaguePlayers.has(selectedPlayer.id)
                            ? 'Loading league history…'
                            : 'This player has not appeared in any roster in our league history.'}
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Landing / Search View
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl font-bold text-white mb-1">Player History</h1>
                <p className="text-sm text-gray-400">Search for any player to view their history in this league</p>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search for a player…"
                    className="w-full bg-gray-800/80 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60 text-base"
                />
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {searchResults.map(p => (
                            <button key={p.id} onClick={() => handleSelectPlayer(p)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0">
                                <PlayerAvatar playerId={p.id} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white">{p.name}</div>
                                    <div className="text-xs text-gray-500">{p.team} · {p.position}</div>
                                </div>
                                {leaguePlayers.has(p.id) && (
                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">IN LEAGUE</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Popular players */}
            <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Popular Players</h2>
                <div className="flex flex-wrap gap-2">
                    {POPULAR_PLAYER_IDS.map(pid => {
                        const p = nflPlayers?.[pid];
                        if (!p) return null;
                        // Only show valid positions
                        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
                        if (!validPositions.includes(p.position)) return null;
                        const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
                        const ps = posStyle(p.position);
                        return (
                            <button key={pid}
                                onClick={() => handleSelectPlayer({ id: pid, name, position: p.position, team: p.team || 'FA' })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full border ${ps.border} ${ps.bg} hover:brightness-125 transition-all`}>
                                <PlayerAvatar playerId={pid} size="sm" />
                                <span className="text-sm font-semibold text-white whitespace-nowrap">{name}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* League Journeymen */}
            {journeymen.length > 0 && (
                <section>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">League Journeymen</h2>
                    <p className="text-xs text-gray-500 mb-4">Players who have traveled around the league the most</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {journeymen.map(p => {
                            const ps = posStyle(p.position);
                            const lastTeamName = p.lastOwner ? getTeamName(p.lastOwner, p.lastSeason) : '—';
                            const lastTeamStart = historicalData?.rostersBySeason?.[p.lastSeason]?.[0]?.season || p.lastSeason;

                            // Find earliest season for this player
                            let earliestSeason = p.lastSeason;
                            Object.keys(historicalData?.rostersBySeason || {}).forEach(season => {
                                const found = (historicalData.rostersBySeason[season] || []).some(r =>
                                    r.owner_id === p.lastOwner && Array.isArray(r.players) && r.players.includes(p.id)
                                );
                                if (found && Number(season) < Number(earliestSeason)) earliestSeason = season;
                            });

                            return (
                                <button key={p.id}
                                    onClick={() => handleSelectPlayer({ id: p.id, name: p.name, position: p.position, team: p.team })}
                                    className="bg-gray-800/60 border border-white/8 rounded-xl p-4 text-left hover:bg-gray-700/50 hover:border-white/15 transition-all group">
                                    <div className="flex items-start gap-3">
                                        <PlayerAvatar playerId={p.id} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">{p.name}</span>
                                                <PosBadge pos={p.position} />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <TeamAvatar ownerId={p.lastOwner} year={p.lastSeason} getTeamDetails={getTeamDetails} />
                                                <span>LAST ON: <span className="text-gray-200 font-medium">{lastTeamName}</span></span>
                                                <span className="text-gray-600">({earliestSeason}–{p.lastSeason})</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 shrink-0 text-right">
                                            <div>
                                                <div className="text-xl font-bold text-white">{p.teamCount}</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-widest">Teams</div>
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-white">{p.stintCount}</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-widest">Stints</div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};

export default PlayerHistory;