import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { fetchTransactionsForWeek } from '../utils/sleeperApi';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const POPULAR_PLAYER_IDS = [
    '7564','4866','6794','4984','7588','3164','7547','4972','7523','4035',
    '8155','3972','7652','4029','6904','2371','1374','3163','7986','4034',
];

const POSITION_COLORS = {
    QB:  { bg: 'bg-red-500/20',    text: 'text-red-300',    border: 'border-red-500/30',    dot: '#ef4444' },
    RB:  { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/30',   dot: '#3b82f6' },
    WR:  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/30',  dot: '#22c55e' },
    TE:  { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: '#eab308' },
    K:   { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', dot: '#a855f7' },
    DEF: { bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/30',   dot: '#6b7280' },
};
const posStyle = (pos) => POSITION_COLORS[pos] || POSITION_COLORS.DEF;

// ─────────────────────────────────────────────────────────────────────────────
// Determine how a player arrived on a roster for a given stint
// Returns: { method: 'draft'|'trade'|'waiver'|'fa', label, detail }
// ─────────────────────────────────────────────────────────────────────────────
const computeAcquisitionMethod = (playerId, stint, historicalData, playerTrades, getTeamName, allTransactions) => {
    const { season, rosterId, startWeek } = stint;

    // ── 1. Check if player was DRAFTED onto this roster this season ───────────
    const seasonDraftPicks = historicalData?.draftPicksBySeason?.[season] || [];
    const draftPick = seasonDraftPicks.find(p =>
        String(p.player_id) === String(playerId) && !p.is_keeper
    );
    if (draftPick) {
        // Verify this draft pick was made by the same roster
        const draftRoster = historicalData?.rostersBySeason?.[season]?.find(r =>
            String(r.owner_id) === String(draftPick.picked_by)
        );
        if (draftRoster && String(draftRoster.roster_id) === String(rosterId)) {
            const round = draftPick.round || Math.ceil((draftPick.pick_no || 1) / 12);
            const pickInRound = draftPick.draft_slot || (((draftPick.pick_no || 1) - 1) % 12) + 1;
            return {
                method: 'draft',
                label: 'Drafted',
                detail: `Round ${round}, Pick ${pickInRound} (Pick #${draftPick.pick_no || '?'})`,
                icon: '🎯',
            };
        }
    }

    // ── 2. Check if a KEEPER pick landed them on this roster ─────────────────
    const keeperPick = seasonDraftPicks.find(p =>
        String(p.player_id) === String(playerId) && p.is_keeper
    );
    if (keeperPick) {
        const keeperRoster = historicalData?.rostersBySeason?.[season]?.find(r =>
            String(r.owner_id) === String(keeperPick.picked_by)
        );
        if (keeperRoster && String(keeperRoster.roster_id) === String(rosterId)) {
            const round = keeperPick.round || Math.ceil((keeperPick.pick_no || 1) / 12);
            return {
                method: 'keeper',
                label: 'Kept',
                detail: `Round ${round} keeper`,
                icon: '🔒',
            };
        }
    }

    // ── 3. Check TRADE — find a trade that delivered this player to this roster ─
    // A qualifying trade: same season, week <= startWeek, toRosterId matches this stint's rosterId
    const inboundTrade = (playerTrades || [])
        .filter(tr =>
            String(tr.season) === String(season) &&
            Number(tr.week) <= startWeek + 1 &&
            tr.type === 'received'
        )
        .sort((a, b) => Number(b.week) - Number(a.week)) // most recent first
        .find(tr => {
            // Verify the "to" side of the trade resolves to this roster
            // tr.toTeam is the team name; cross-check via toRosterId if available
            if (tr.toRosterId) {
                const toRoster = historicalData?.rostersBySeason?.[season]?.find(r =>
                    String(r.roster_id) === String(tr.toRosterId)
                );
                if (toRoster && String(toRoster.roster_id) === String(rosterId)) return true;
            }
            // Fallback: match by ownerId
            const stintOwnerRoster = historicalData?.rostersBySeason?.[season]?.find(r =>
                String(r.roster_id) === String(rosterId)
            );
            if (stintOwnerRoster && tr.toTeam) {
                const resolvedName = getTeamName(String(stintOwnerRoster.owner_id), season);
                return resolvedName === tr.toTeam;
            }
            return false;
        });

    if (inboundTrade) {
        return {
            method: 'trade',
            label: 'Via Trade',
            detail: null, // AcquisitionTradeItem below already shows from/week
            icon: '🔄',
        };
    }

    // ── 4. FA / Waivers — try to detect the drop week from transactions ─────────
    // Look for a waiver/free_agent transaction that dropped this player from this roster
    // at or after the stint's last week (indicating a mid-season release)
    let dropDetail = null;
    if (allTransactions && stint.endWeek) {
        const dropTx = (allTransactions || [])
            .filter(tx =>
                (tx.type === 'waiver' || tx.type === 'free_agent') &&
                String(tx.season) === String(season) &&
                tx.drops && String(playerId) in tx.drops
            )
            .map(tx => {
                const dropRosterId = tx.drops?.[String(playerId)];
                const rId = dropRosterId && typeof dropRosterId === 'object' ? dropRosterId.roster_id : dropRosterId;
                return { ...tx, resolvedRosterId: String(rId) };
            })
            .filter(tx => tx.resolvedRosterId === String(rosterId))
            .sort((a, b) => Number(b.leg || b.week || 0) - Number(a.leg || a.week || 0))[0];

        if (dropTx) {
            const dropWeek = dropTx.leg || dropTx.week;
            const dropDate = dropTx.created
                ? new Date(dropTx.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : null;
            dropDetail = dropWeek ? `Released Wk ${dropWeek}${dropDate ? ` · ${dropDate}` : ''}` : null;
        }
    }

    return {
        method: 'fa',
        label: dropDetail ? 'Waiver Claim / FA' : 'FA / Waivers',
        detail: dropDetail,
        icon: '📋',
    };
};

const STATIC_LEADERBOARD_STATS = [
    { key: 'teamCount',   label: 'Most Teams',        format: v => v,  accent: 'text-orange-300',  suffix: 'teams'  },
    { key: 'stintCount',  label: 'Most Stints',       format: v => v,  accent: 'text-pink-300',    suffix: 'stints' },
    { key: 'totalTrades', label: 'Most Times Traded', format: v => v,  accent: 'text-violet-300',  suffix: 'trades' },
];

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
// Compute stints (week-by-week tracking)
// ─────────────────────────────────────────────────────────────────────────────
const computePlayerStints = (playerId, historicalData, leagueData, nflPlayers) => {
    if (!historicalData?.matchupsBySeason) return [];
    const playerInfo = nflPlayers?.[playerId];
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    if (!playerInfo || !validPositions.includes(playerInfo.position)) return [];

    const seasons = Object.keys(historicalData.matchupsBySeason).sort((a, b) => Number(a) - Number(b));
    const stints = [];

    seasons.forEach(season => {
        const matchups = historicalData.matchupsBySeason[season] || [];
        const weekOwnershipMap = new Map();

        matchups.forEach(matchup => {
            const week = Number(matchup.week);
            if (matchup.team1_players?.players_points && playerId in matchup.team1_players.players_points) {
                weekOwnershipMap.set(week, { rosterId: String(matchup.team1_roster_id), teamPlayers: matchup.team1_players });
            } else if (matchup.team2_players?.players_points && playerId in matchup.team2_players.players_points) {
                weekOwnershipMap.set(week, { rosterId: String(matchup.team2_roster_id), teamPlayers: matchup.team2_players });
            }
        });

        if (weekOwnershipMap.size === 0) return;
        const sortedWeeks = Array.from(weekOwnershipMap.keys()).sort((a, b) => a - b);
        let currentStintRosterId = null;
        let currentStintStart = null;

        sortedWeeks.forEach((week, idx) => {
            const ownership = weekOwnershipMap.get(week);
            const rosterId = ownership.rosterId;
            if (currentStintRosterId !== rosterId) {
                if (currentStintRosterId !== null) {
                    const prevWeek = sortedWeeks[idx - 1];
                    stints.push({
                        season, rosterId: currentStintRosterId, startWeek: currentStintStart, endWeek: prevWeek,
                        weeks: sortedWeeks.filter(w => weekOwnershipMap.get(w)?.rosterId === currentStintRosterId && w >= currentStintStart && w <= prevWeek),
                    });
                }
                currentStintRosterId = rosterId;
                currentStintStart = week;
            }
        });

        if (currentStintRosterId !== null) {
            const finalWeek = sortedWeeks[sortedWeeks.length - 1];
            stints.push({
                season, rosterId: currentStintRosterId, startWeek: currentStintStart, endWeek: finalWeek,
                weeks: sortedWeeks.filter(w => weekOwnershipMap.get(w)?.rosterId === currentStintRosterId && w >= currentStintStart && w <= finalWeek),
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
        <img src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`} alt=""
            className={`${sz} rounded-full object-cover bg-gray-700 flex-shrink-0`}
            onError={e => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }} />
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
// Compact acquisition receipt — shown on the receiving team's row in Chain of Custody
// Only shows "Acquired from X", date, and other players. No "To" since that's obvious.
// ─────────────────────────────────────────────────────────────────────────────
const AcquisitionTradeItem = ({ trade, playerId, nflPlayers, onSelectPlayer }) => {
    const date = trade.created
        ? new Date(trade.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    // Deduplicate other players — seenIds excludes the subject player
    const seenIds = new Set([String(playerId)]);
    const otherPlayers = [...(trade.adds || []), ...(trade.drops || [])].filter(p => {
        const id = String(p.playerId);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        const pInfo = nflPlayers?.[id] || p;
        return pInfo.full_name || pInfo.first_name || pInfo.last_name;
    });

    return (
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Acquired from</span>
                    <span className="text-white font-semibold">{trade.fromTeam || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    {trade.week && <span>Wk {trade.week}</span>}
                    {date && <span>{date}</span>}
                </div>
            </div>
            {otherPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Also in trade:</span>
                    {otherPlayers.map((p, i) => {
                        const pInfo = nflPlayers?.[p.playerId] || p;
                        const name = pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim();
                        const pos = pInfo.position;
                        const ps = posStyle(pos);
                        if (!name) return null;
                        return (
                            <button key={i}
                                onClick={() => onSelectPlayer?.({ id: p.playerId, name, position: pos, team: pInfo.team || 'FA' })}
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${ps.bg} ${ps.text} ${ps.border} hover:brightness-125 transition-all`}>
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Trade timeline item
// ─────────────────────────────────────────────────────────────────────────────
const TradeItem = ({ trade, playerId, nflPlayers, onSelectPlayer }) => {
    const date = trade.created ? new Date(trade.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

    // Deduplicate other players: combine adds+drops, exclude the subject player,
    // unique by playerId (keeps first occurrence = the adds side wins over drops)
    const seenIds = new Set([String(playerId)]);
    const otherPlayers = [
        ...(trade.adds || []),
        ...(trade.drops || []),
    ].filter(p => {
        const pid = String(p.playerId);
        if (seenIds.has(pid)) return false;
        seenIds.add(pid);
        return p.first_name || p.last_name || p.full_name || nflPlayers?.[pid]?.full_name;
    });

    return (
        <div className="bg-white/5 border border-white/8 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs">
                    {trade.fromTeam && (
                        <span className="text-gray-400"><span className="text-gray-500">From</span> <span className="text-white font-semibold">{trade.fromTeam}</span></span>
                    )}
                    {trade.fromTeam && trade.toTeam && <span className="text-gray-600 font-bold">→</span>}
                    {trade.toTeam && (
                        <span className="text-gray-400"><span className="text-gray-500">To</span> <span className="text-white font-semibold">{trade.toTeam}</span></span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    {trade.season && <span>S{trade.season}</span>}
                    {trade.week && <span>Wk {trade.week}</span>}
                    {date && <span className="text-gray-600">{date}</span>}
                </div>
            </div>
            {otherPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Also:</span>
                    {otherPlayers.map((p, i) => {
                        const pInfo = nflPlayers?.[p.playerId] || p;
                        const name = pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim();
                        const pos = pInfo.position;
                        const ps = posStyle(pos);
                        if (!name) return null;
                        return (
                            <button key={i}
                                onClick={() => onSelectPlayer?.({ id: p.playerId, name, position: pos, team: pInfo.team || 'FA' })}
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${ps.bg} ${ps.text} ${ps.border} hover:brightness-125 transition-all`}>
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// All-League View
// ─────────────────────────────────────────────────────────────────────────────
const ALL_LEAGUE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const TEAM_STYLES = [
    {
        tier: 1, label: 'First Team',
        headerBg: 'bg-yellow-500/15', headerText: 'text-yellow-300', headerBorder: 'border-yellow-500/30',
        cardBg: 'bg-yellow-500/8',    cardBorder: 'border-yellow-500/20',
        badge: 'bg-yellow-500 text-black', badgeLabel: '1ST',
        trophy: '🥇',
    },
    {
        tier: 2, label: 'Second Team',
        headerBg: 'bg-gray-400/15',   headerText: 'text-gray-300',   headerBorder: 'border-gray-400/30',
        cardBg: 'bg-gray-400/8',      cardBorder: 'border-gray-400/20',
        badge: 'bg-gray-300 text-black', badgeLabel: '2ND',
        trophy: '🥈',
    },
    {
        tier: 3, label: 'Third Team',
        headerBg: 'bg-orange-500/15', headerText: 'text-orange-300', headerBorder: 'border-orange-500/30',
        cardBg: 'bg-orange-500/8',    cardBorder: 'border-orange-500/20',
        badge: 'bg-orange-500 text-white', badgeLabel: '3RD',
        trophy: '🥉',
    },
];

const AllLeaguePlayerCard = ({ player, tier, onSelectPlayer }) => {
    const ps = posStyle(player.position);
    const ts = TEAM_STYLES[tier - 1];
    return (
        <button
            onClick={() => onSelectPlayer({ id: player.pid, name: player.name, position: player.position, team: 'FA' })}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border ${ts.cardBg} ${ts.cardBorder} hover:brightness-110 transition-all text-left group`}
        >
            <div className="relative shrink-0">
                <img
                    src={`https://sleepercdn.com/content/nfl/players/thumb/${player.pid}.jpg`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover bg-gray-700"
                    onError={e => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                />
                <span className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1 py-px rounded-full leading-none ${ts.badge}`}>
                    {ts.badgeLabel}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors">{player.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-px rounded ${ps.bg} ${ps.text} border ${ps.border}`}>{player.position}</span>
                    <span className="text-[10px] text-gray-500">{player.starts} starts</span>
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div className="text-base font-bold text-white">{player.avgPPG.toFixed(1)}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest">Avg PPG</div>
            </div>
        </button>
    );
};

const AllLeagueView = ({ allLeagueData, nflPlayers, onSelectPlayer }) => {
    const seasons = Object.keys(allLeagueData).sort((a, b) => Number(b) - Number(a));
    const [selectedSeason, setSelectedSeason] = useState(seasons[0] || null);

    if (!seasons.length) {
        return <div className="text-center py-12 text-gray-500 text-sm">No season data available yet.</div>;
    }

    const seasonData = allLeagueData[selectedSeason] || {};

    // Build the three teams + honorable mention per position
    const buildTeams = (pos) => {
        const players = seasonData[pos] || [];
        return {
            first:  players[0] || null,
            second: players[1] || null,
            third:  players[2] || null,
            honorable: players.slice(3, 5),
        };
    };

    return (
        <div className="space-y-6">
            {/* Season selector */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Season</span>
                <div className="flex gap-2 flex-wrap">
                    {seasons.map(s => (
                        <button key={s} onClick={() => setSelectedSeason(s)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                selectedSeason === s
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white/8 text-gray-400 hover:bg-white/12 hover:text-white border border-white/8'
                            }`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Explanation */}
            <p className="text-xs text-gray-500">
                Minimum 10 starts required · Ranked by Avg PPG (started weeks only)
            </p>

            {/* All-League Teams — one section per tier */}
            {TEAM_STYLES.map(ts => (
                <div key={ts.tier} className="rounded-2xl border border-white/10 overflow-hidden">
                    {/* Team header */}
                    <div className={`px-5 py-3 border-b border-white/10 ${ts.headerBg} flex items-center gap-2`}>
                        <span className="text-lg">{ts.trophy}</span>
                        <h2 className={`text-sm font-black uppercase tracking-widest ${ts.headerText}`}>
                            {selectedSeason} All-League {ts.label}
                        </h2>
                    </div>

                    {/* Position columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        {ALL_LEAGUE_POSITIONS.map(pos => {
                            const teams = buildTeams(pos);
                            const player = ts.tier === 1 ? teams.first : ts.tier === 2 ? teams.second : teams.third;
                            const ps = posStyle(pos);
                            return (
                                <div key={pos} className="space-y-1">
                                    <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block ${ps.bg} ${ps.text} border ${ps.border} mb-1`}>
                                        {pos}
                                    </div>
                                    {player ? (
                                        <AllLeaguePlayerCard player={player} tier={ts.tier} onSelectPlayer={onSelectPlayer} />
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 rounded-xl border border-white/5 bg-white/3">
                                            <span className="text-xs text-gray-600 italic">No qualifier (min. 12 starts)</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Honorable Mention */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 bg-white/3 flex items-center gap-2">
                    <span className="text-lg">🎖️</span>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">
                        {selectedSeason} Honorable Mention
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {ALL_LEAGUE_POSITIONS.map(pos => {
                        const { honorable } = buildTeams(pos);
                        const ps = posStyle(pos);
                        if (!honorable.length) return null;
                        return (
                            <div key={pos} className="space-y-1">
                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block ${ps.bg} ${ps.text} border ${ps.border} mb-1`}>
                                    {pos}
                                </div>
                                {honorable.map((player, i) => (
                                    <button key={i}
                                        onClick={() => onSelectPlayer({ id: player.pid, name: player.name, position: player.position, team: 'FA' })}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-all text-left group">
                                        <img
                                            src={`https://sleepercdn.com/content/nfl/players/thumb/${player.pid}.jpg`}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover bg-gray-700 shrink-0"
                                            onError={e => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{player.name}</div>
                                            <div className="text-[10px] text-gray-500">{player.starts} starts</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-bold text-gray-300">{player.avgPPG.toFixed(1)}</div>
                                            <div className="text-[9px] text-gray-500">PPG</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Static Leaderboard — top 10 per stat, no API needed
// ─────────────────────────────────────────────────────────────────────────────
const StaticLeaderboard = ({ leaderboardData, nflPlayers, onSelectPlayer }) => {
    if (!leaderboardData || leaderboardData.length === 0) {
        return <div className="text-center py-12 text-gray-500 text-sm">Loading leaderboard…</div>;
    }

    return (
        <div className="space-y-8">
            {STATIC_LEADERBOARD_STATS.map(stat => {
                const top10 = [...leaderboardData]
                    .filter(p => p[stat.key] >= 1)
                    .sort((a, b) => (b[stat.key] || 0) - (a[stat.key] || 0))
                    .slice(0, 10);
                const maxVal = top10[0]?.[stat.key] || 1;

                return (
                    <div key={stat.key}>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{stat.label}</h2>
                        <div className="bg-gray-800/60 border border-white/10 rounded-2xl overflow-hidden">
                            {top10.length === 0 ? (
                                <div className="px-6 py-6 text-center text-gray-500 text-sm">No data yet</div>
                            ) : top10.map((entry, idx) => {
                                const pos = entry.position || '?';
                                const ps = posStyle(pos);
                                const barPct = maxVal > 0 ? (entry[stat.key] / maxVal) * 100 : 0;
                                const rankColor = idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-600';
                                return (
                                    <button key={entry.id}
                                        onClick={() => onSelectPlayer({ id: entry.id, name: entry.name, position: pos, team: entry.nflTeam || 'FA' })}
                                        className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors text-left group">
                                        <span className={`w-6 shrink-0 text-sm font-bold text-center ${rankColor}`}>{idx + 1}</span>
                                        <PlayerAvatar playerId={entry.id} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">{entry.name}</span>
                                                <PosBadge pos={pos} />
                                            </div>
                                            <div className="w-full bg-gray-700/40 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${barPct}%`, backgroundColor: ps.dot }} />
                                            </div>
                                        </div>
                                        <div className={`shrink-0 text-right`}>
                                            <span className={`text-base font-bold tabular-nums ${stat.accent}`}>{stat.format(entry[stat.key])}</span>
                                            <span className="text-[10px] text-gray-500 ml-1">{stat.suffix}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const PlayerHistory = () => {
    const { historicalData, nflPlayers, getTeamName, getTeamDetails, leagueData, transactions = [] } = useSleeperData();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerDetail, setPlayerDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [journeymen, setJourneymen] = useState([]);
    const [activeTab, setActiveTab] = useState('search'); // 'search' | 'leaderboard'
    const [allTransactions, setAllTransactions] = useState([]);
    const [detailTab, setDetailTab] = useState('history');
    const inputRef = useRef(null);
    const leagueTxCache = useRef(new Map());

    // ── Load all historical transactions (from MostTradedPlayers logic) ──────
    useEffect(() => {
        (async () => {
            try {
                if (!historicalData?.rostersBySeason) {
                    setAllTransactions(Array.isArray(transactions) ? transactions : []);
                    return;
                }

                const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000;
                let leagueFetchedTransactions = [];

                const seasonsToFetch = Object.keys(historicalData.leaguesMetadataBySeason || {});
                for (const season of seasonsToFetch) {
                    const leagueMeta = historicalData.leaguesMetadataBySeason?.[String(season)];
                    const leagueId = leagueMeta?.league_id || leagueMeta?.leagueId || leagueMeta?.id || null;
                    if (!leagueId) continue;

                    const cached = leagueTxCache.current.get(leagueId);
                    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY_MS)) {
                        leagueFetchedTransactions.push(...cached.transactions);
                        continue;
                    }

                    const weekPromises = [];
                    for (let w = 1; w <= 18; w++) {
                        weekPromises.push(
                            fetchTransactionsForWeek(leagueId, w).catch(() => [])
                        );
                    }
                    const results = await Promise.all(weekPromises);
                    const seasonTx = results.flat()
                        .map(tx => { if (tx && !tx.season) tx.season = season; return tx; })
                        .filter(Boolean);
                    leagueTxCache.current.set(leagueId, { timestamp: Date.now(), transactions: seasonTx });
                    leagueFetchedTransactions.push(...seasonTx);
                }

                const contextTx = Array.isArray(transactions) ? transactions : [];
                const allTx = [...leagueFetchedTransactions, ...contextTx];
                const txMap = new Map();
                allTx.forEach(tx => {
                    const key = tx.transaction_id || JSON.stringify(tx);
                    if (!txMap.has(key)) txMap.set(key, tx);
                });
                setAllTransactions(Array.from(txMap.values()));
            } catch {
                setAllTransactions(Array.isArray(transactions) ? transactions : []);
            }
        })();
    }, [historicalData, transactions]);

    // ── Build player trade map (playerId -> trade array) ─────────────────────
    const playerTradeMap = useMemo(() => {
        const map = new Map();
        const playerSeenTxIds = {};

        const getOwnerIdForRoster = (rosterId, year) => {
            if (!historicalData?.rostersBySeason) return null;
            const tryYears = year ? [String(year), ...Object.keys(historicalData.rostersBySeason)] : Object.keys(historicalData.rostersBySeason);
            for (const y of tryYears) {
                const found = (historicalData.rostersBySeason[y] || []).find(r => String(r.roster_id) === String(rosterId));
                if (found) return String(found.owner_id);
            }
            return null;
        };

        allTransactions.forEach(tx => {
            if (tx.type !== 'trade') return;
            if (tx.status && String(tx.status).toLowerCase() === 'failed') return;

            const adds = tx.adds || {};
            const drops = tx.drops || {};
            const allPlayersInTrade = new Set([...Object.keys(adds), ...Object.keys(drops)]);

            allPlayersInTrade.forEach(playerId => {
                const pidStr = String(playerId);
                const txKey = tx.transaction_id
                    ? `${tx.transaction_id}-${pidStr}`
                    : `${tx.created}-${JSON.stringify(tx.roster_ids)}-${pidStr}`;
                if (!playerSeenTxIds[pidStr]) playerSeenTxIds[pidStr] = new Set();
                if (playerSeenTxIds[pidStr].has(txKey)) return;
                playerSeenTxIds[pidStr].add(txKey);

                const addEntry = adds[pidStr];
                const dropEntry = drops[pidStr];
                const addRosterId = addEntry && typeof addEntry === 'object' ? addEntry.roster_id : addEntry;
                const dropRosterId = dropEntry && typeof dropEntry === 'object' ? dropEntry.roster_id : dropEntry;

                const fromRosterId = dropRosterId || Object.keys(drops)
                    .map(id => { const d = drops[id]; return d && typeof d === 'object' ? d.roster_id : d; })
                    .find(id => id != null && String(id) !== String(addRosterId));
                const toRosterId = addRosterId || Object.keys(adds)
                    .map(id => { const d = adds[id]; return d && typeof d === 'object' ? d.roster_id : d; })
                    .find(id => id != null && String(id) !== String(dropRosterId));

                const fromOwnerId = fromRosterId ? getOwnerIdForRoster(fromRosterId, tx.season) : null;
                const toOwnerId = toRosterId ? getOwnerIdForRoster(toRosterId, tx.season) : null;

                const addsArray = Object.keys(adds)
                    .map(id => { const d = adds[id]; return { playerId: id, rosterId: d && typeof d === 'object' ? d.roster_id : d, ...(nflPlayers?.[id] || {}) }; })
                    .filter(p => p.first_name || p.last_name);
                const dropsArray = Object.keys(drops)
                    .map(id => { const d = drops[id]; return { playerId: id, rosterId: d && typeof d === 'object' ? d.roster_id : d, ...(nflPlayers?.[id] || {}) }; })
                    .filter(p => p.first_name || p.last_name);

                if (!map.has(pidStr)) map.set(pidStr, []);
                map.get(pidStr).push({
                    transactionId: tx.transaction_id,
                    type: addEntry ? 'received' : 'sent',
                    week: tx.leg,
                    created: tx.created,
                    season: tx.season,
                    adds: addsArray,
                    drops: dropsArray,
                    fromRosterId, toRosterId,
                    fromTeam: fromOwnerId ? getTeamName(fromOwnerId, tx.season) : null,
                    toTeam: toOwnerId ? getTeamName(toOwnerId, tx.season) : null,
                    rosterIds: tx.roster_ids || [],
                });
            });
        });

        return map;
    }, [allTransactions, nflPlayers, historicalData, getTeamName]);

    // ── Build search index ────────────────────────────────────────────────────
    const playerIndex = useMemo(() => {
        if (!nflPlayers) return [];
        return Object.entries(nflPlayers)
            .filter(([, p]) => p && p.position && ['QB','RB','WR','TE','K','DEF'].includes(p.position))
            .map(([id, p]) => ({
                id, name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                position: p.position, team: p.team || 'FA',
                college: p.college, age: p.age, height: p.height, weight: p.weight,
                years_exp: p.years_exp, number: p.number,
            }));
    }, [nflPlayers]);

    // ── League players set ────────────────────────────────────────────────────
    const leaguePlayers = useMemo(() => {
        const ids = new Set();
        if (!historicalData?.rostersBySeason) return ids;
        Object.values(historicalData.rostersBySeason).forEach(rosters => {
            rosters.forEach(r => { if (Array.isArray(r.players)) r.players.forEach(id => ids.add(String(id))); });
        });
        if (historicalData?.draftPicksBySeason) {
            Object.values(historicalData.draftPicksBySeason).forEach(picks => {
                picks.forEach(p => { const id = p?.player_id || p?.playerId; if (id) ids.add(String(id)); });
            });
        }
        return ids;
    }, [historicalData]);

    // ── Stint/team counts per player ─────────────────────────────────────────
    const getPlayerStintAndTeamCounts = useCallback((playerId, nflPlayer) => {
        if (!historicalData?.matchupsBySeason || !nflPlayer) return null;
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        if (!validPositions.includes(nflPlayer.position)) return null;

        const seasons = Object.keys(historicalData.matchupsBySeason).sort((a, b) => Number(a) - Number(b));
        const uniqueTeams = new Set();
        const stintCombos = new Set();
        let lastOwner = null, lastSeason = null;

        seasons.forEach(season => {
            const matchups = historicalData.matchupsBySeason[season] || [];
            const weekOwnershipMap = new Map();
            matchups.forEach(matchup => {
                const week = Number(matchup.week);
                if (matchup.team1_players?.players_points && playerId in matchup.team1_players.players_points) {
                    weekOwnershipMap.set(week, String(matchup.team1_roster_id));
                } else if (matchup.team2_players?.players_points && playerId in matchup.team2_players.players_points) {
                    weekOwnershipMap.set(week, String(matchup.team2_roster_id));
                }
            });
            if (weekOwnershipMap.size > 0) {
                const rosterIds = new Set(weekOwnershipMap.values());
                rosterIds.forEach(rosterId => {
                    stintCombos.add(`${season}-${rosterId}`);
                    const rosterData = historicalData.rostersBySeason?.[season]?.find(r => String(r.roster_id) === rosterId);
                    if (rosterData) {
                        uniqueTeams.add(String(rosterData.owner_id));
                        lastOwner = String(rosterData.owner_id);
                        lastSeason = season;
                    }
                });
            }
        });
        if (uniqueTeams.size === 0) return null;
        return { teamCount: uniqueTeams.size, stintCount: stintCombos.size, lastOwner, lastSeason };
    }, [historicalData]);

    // ── Journeymen ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!historicalData?.matchupsBySeason || !nflPlayers) return;
        const results = [];
        Object.entries(nflPlayers).forEach(([pid, playerInfo]) => {
            if (!playerInfo?.full_name) return;
            const counts = getPlayerStintAndTeamCounts(pid, playerInfo);
            if (!counts || counts.teamCount < 3) return;
            results.push({
                id: pid, name: playerInfo.full_name, position: playerInfo.position,
                team: playerInfo.team || 'FA', ...counts,
            });
        });
        results.sort((a, b) => b.stintCount - a.stintCount || b.teamCount - a.teamCount);
        setJourneymen(results.slice(0, 12));
    }, [historicalData, nflPlayers, getPlayerStintAndTeamCounts]);

    // ── Static leaderboard data (teams, stints, trades — no API needed) ────────
    const leaderboardData = useMemo(() => {
        if (!nflPlayers || !leaguePlayers.size) return [];
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        return Object.entries(nflPlayers)
            .filter(([pid, pInfo]) => pInfo?.full_name && validPositions.includes(pInfo.position) && leaguePlayers.has(pid))
            .map(([pid, pInfo]) => {
                const counts = getPlayerStintAndTeamCounts(pid, pInfo);
                const tradeArr = playerTradeMap.get(pid) || [];
                return {
                    id: pid,
                    name: pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim(),
                    position: pInfo.position,
                    nflTeam: pInfo.team || 'FA',
                    teamCount: counts?.teamCount || 0,
                    stintCount: counts?.stintCount || 0,
                    totalTrades: tradeArr.length,
                };
            });
    }, [nflPlayers, leaguePlayers, getPlayerStintAndTeamCounts, playerTradeMap]);

    // ── All-League data — computed from matchupsBySeason (no API needed) ────────
    // For each season: scan every matchup, accumulate per-player starts + totalPoints
    // Then rank by avgPPG (totalStartingPoints / starts) with minimum 12 starts
    const allLeagueData = useMemo(() => {
        if (!historicalData?.matchupsBySeason || !nflPlayers) return {};
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const result = {};
        const currentYear = new Date().getFullYear();

        Object.entries(historicalData.matchupsBySeason).forEach(([season, matchups]) => {
            const seasonNum = Number(season);
            // Skip 2021 (no data) and current/future seasons (not yet concluded)
            if (seasonNum <= 2021 || seasonNum >= currentYear) return;

            const playerData = {};
            matchups.forEach(matchup => {
                [
                    { rosterId: matchup.team1_roster_id, players: matchup.team1_players },
                    { rosterId: matchup.team2_roster_id, players: matchup.team2_players },
                ].forEach(({ rosterId, players }) => {
                    if (!players?.players_points) return;
                    const starters = new Set(players.starters || []);
                    Object.entries(players.players_points).forEach(([pid, pts]) => {
                        if (!starters.has(pid)) return;
                        const pInfo = nflPlayers[pid];
                        if (!pInfo || !validPositions.includes(pInfo.position)) return;
                        if (!playerData[pid]) {
                            playerData[pid] = {
                                pid,
                                name: pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim(),
                                position: pInfo.position,
                                starts: 0,
                                totalPts: 0,
                            };
                        }
                        playerData[pid].starts += 1;
                        playerData[pid].totalPts += Number(pts) || 0;
                    });
                });
            });

            // Min 10 starts, sort by avgPPG desc
            const byPos = {};
            Object.values(playerData).forEach(p => {
                if (p.starts < 10) return;
                p.avgPPG = p.totalPts / p.starts;
                if (!byPos[p.position]) byPos[p.position] = [];
                byPos[p.position].push(p);
            });
            Object.keys(byPos).forEach(pos => {
                byPos[pos].sort((a, b) => b.avgPPG - a.avgPPG);
            });
            result[season] = byPos;
        });

        return result;
    }, [historicalData, nflPlayers]);

    // ── All-League honors lookup: pid -> [{ season, tier, tierLabel, position }] ─
    const playerAllLeagueHonors = useMemo(() => {
        const honors = {}; // pid -> array of honor objects
        const tierLabels = { 1: 'First Team', 2: 'Second Team', 3: 'Third Team', 4: 'Honorable Mention', 5: 'Honorable Mention' };
        Object.entries(allLeagueData).forEach(([season, byPos]) => {
            Object.entries(byPos).forEach(([pos, players]) => {
                players.forEach((player, idx) => {
                    const tier = idx + 1; // 1=first, 2=second, 3=third, 4-5=HM
                    if (tier > 5) return;
                    if (!honors[player.pid]) honors[player.pid] = [];
                    honors[player.pid].push({
                        season,
                        tier,
                        tierLabel: tierLabels[tier] || 'Honorable Mention',
                        isHM: tier > 3,
                        position: pos,
                    });
                });
            });
        });
        return honors;
    }, [allLeagueData]);

    // ── Championship roster lookup: pid -> [{ season, teamName }] ─────────────
    const playerChampionshipHonors = useMemo(() => {
        const honors = {}; // pid -> array
        if (!historicalData?.winnersBracketBySeason || !historicalData?.rostersBySeason) return honors;

        Object.entries(historicalData.winnersBracketBySeason).forEach(([year, bracket]) => {
            const yearNum = Number(year);
            if (yearNum <= 2021) return; // skip 2021
            const champGame = Array.isArray(bracket) ? bracket.find(g => g.p === 1 && g.w) : null;
            if (!champGame) return;
            const champRosterId = String(champGame.w);
            const rosters = historicalData.rostersBySeason?.[yearNum] || [];
            const champRoster = rosters.find(r => String(r.roster_id) === champRosterId);
            if (!champRoster) return;

            // Get players from roster snapshot
            const players = Array.isArray(champRoster.players) ? champRoster.players : [];

            // Also try to get players from the championship matchup week
            const matchups = historicalData.matchupsBySeason?.[yearNum] || [];
            const champWeek = champGame.week || champGame.weekNumber;
            let extraPlayers = [];
            if (champWeek) {
                const weekMatchups = matchups.filter(m => String(m.week) === String(champWeek) || String(m.weekNumber) === String(champWeek));
                const champMatch = weekMatchups.find(m => String(m.team1_roster_id) === champRosterId || String(m.team2_roster_id) === champRosterId);
                if (champMatch) {
                    const isTeam1 = String(champMatch.team1_roster_id) === champRosterId;
                    const tp = isTeam1 ? champMatch.team1_players : champMatch.team2_players;
                    if (tp?.players_points) extraPlayers = Object.keys(tp.players_points);
                    if (tp?.starters) extraPlayers = [...new Set([...extraPlayers, ...tp.starters])];
                }
            }

            const allPids = [...new Set([...players.map(String), ...extraPlayers.map(String)])];
            allPids.forEach(pid => {
                if (!honors[pid]) honors[pid] = [];
                honors[pid].push({ season: yearNum, ownerId: String(champRoster.owner_id) });
            });
        });
        return honors;
    }, [historicalData]);

    // ── Search ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!query.trim()) { setSearchResults([]); return; }
        const q = query.toLowerCase();
        const results = playerIndex
            .filter(p => p.name.toLowerCase().includes(q))
            .sort((a, b) => {
                const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                const aLeague = leaguePlayers.has(a.id) ? 0 : 1;
                const bLeague = leaguePlayers.has(b.id) ? 0 : 1;
                return (aStart + aLeague) - (bStart + bLeague);
            }).slice(0, 8);
        setSearchResults(results);
    }, [query, playerIndex, leaguePlayers]);

    // ── Resolve leagueId for season ───────────────────────────────────────────
    const getLeagueIdForSeason = useCallback((season) => {
        const curSeason = Array.isArray(leagueData) ? leagueData[0]?.season : leagueData?.season;
        if (String(season) === String(curSeason)) {
            return Array.isArray(leagueData) ? leagueData[0]?.league_id : leagueData?.league_id;
        }
        return historicalData?.leaguesMetadataBySeason?.[season]?.league_id ?? null;
    }, [leagueData, historicalData]);

    // ── Load player detail ────────────────────────────────────────────────────
    const loadPlayerDetail = useCallback(async (player) => {
        setDetailLoading(true);
        setPlayerDetail(null);
        setSelectedPlayer(player);

        const pid = String(player.id);
        const rawStints = computePlayerStints(pid, historicalData, leagueData, nflPlayers);
        const playerTrades = (playerTradeMap.get(pid) || []).sort((a, b) => {
            if (a.season !== b.season) return Number(b.season) - Number(a.season);
            return (b.week || 0) - (a.week || 0);
        });

        if (rawStints.length === 0) {
            setPlayerDetail({
                stints: [], totalPoints: 0, totalStarts: 0, totalGames: 0,
                avgPPG: 0, cdr: 0, winRate: 0, totalWins: 0, totalLosses: 0,
                trades: playerTrades, totalTrades: playerTrades.length,
            });
            setDetailLoading(false);
            return;
        }

        for (const stint of rawStints) {
            const leagueId = getLeagueIdForSeason(stint.season);
            if (!leagueId) {
                Object.assign(stint, { points: 0, startingPoints: 0, starts: 0, wins: 0, losses: 0, gamesOnRoster: 0, weeklyPoints: [] });
                continue;
            }

            let totalPoints = 0, startingPoints = 0, totalStarts = 0, wins = 0, losses = 0, gamesOnRoster = 0;
            const weeklyPoints = [];

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
                    const inPointsMap = pid in ppMap;
                    // A player is "active" only if they actually scored > 0, OR were
                    // explicitly started (a 0-pt start is still a real game — e.g. DEF).
                    // A 0-pt non-started entry = injured/inactive on bench; skip it.
                    const playerWasActive = isStarter || (inPointsMap && pts > 0);
                    if (playerWasActive) {
                        gamesOnRoster++;
                        totalPoints += pts;
                        if (isStarter) { totalStarts++; startingPoints += pts; }
                    }
                    const matchupId = rosterEntry.matchup_id;
                    const opponent = weekData.find(r => r.matchup_id === matchupId && String(r.roster_id) !== stint.rosterId);
                    if (opponent && playerWasActive) {
                        if (rosterEntry.points > opponent.points) wins++;
                        else if (rosterEntry.points < opponent.points) losses++;
                    }
                    weeklyPoints.push({ week, points: playerWasActive ? pts : null, isStarter, wasActive: playerWasActive });
                } catch { continue; }
            }

            const rosterData = historicalData.rostersBySeason?.[stint.season]?.find(r => String(r.roster_id) === stint.rosterId);
            const resolvedOwnerId = rosterData?.owner_id ? String(rosterData.owner_id) : '?';
            const acquisition = computeAcquisitionMethod(pid, { ...stint, rosterId: stint.rosterId }, historicalData, playerTrades, getTeamName, allTransactions);
            Object.assign(stint, {
                points: totalPoints, startingPoints, starts: totalStarts,
                wins, losses, gamesOnRoster,
                ownerId: resolvedOwnerId,
                weeklyPoints,
                acquisition,
            });
        }

        const totalPoints = rawStints.reduce((s, st) => s + (st.points || 0), 0);
        const totalStartingPoints = rawStints.reduce((s, st) => s + (st.startingPoints || 0), 0);
        const totalStarts = rawStints.reduce((s, st) => s + (st.starts || 0), 0);
        const totalGames = rawStints.reduce((s, st) => s + (st.gamesOnRoster || 0), 0);
        const totalWins = rawStints.reduce((s, st) => s + (st.wins || 0), 0);
        const totalLosses = rawStints.reduce((s, st) => s + (st.losses || 0), 0);
        const avgPPG = totalStarts > 0 ? totalStartingPoints / totalStarts : 0;
        const cdr = totalGames > 0 ? (totalStarts / totalGames) * 100 : 0;
        const winRate = (totalWins + totalLosses) > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;

        const detail = {
            stints: rawStints, totalPoints, totalStarts, totalGames, avgPPG, cdr, winRate, totalWins, totalLosses,
            trades: playerTrades, totalTrades: playerTrades.length,
        };
        setPlayerDetail(detail);

        setDetailLoading(false);
    }, [historicalData, getLeagueIdForSeason, playerTradeMap, nflPlayers, getTeamName, allTransactions]);

    const handleSelectPlayer = (player) => {
        setQuery('');
        setSearchResults([]);
        setDetailTab('history');
        loadPlayerDetail(player);
    };

    const handleBack = () => {
        setSelectedPlayer(null);
        setPlayerDetail(null);
    };

    const getTeamInfo = useCallback((ownerId, season) => ({ name: getTeamName(ownerId, season) }), [getTeamName]);
    const fullPlayerInfo = selectedPlayer && nflPlayers ? nflPlayers[selectedPlayer.id] : null;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Player Detail View
    // ─────────────────────────────────────────────────────────────────────────
    if (selectedPlayer) {
        const pos = fullPlayerInfo?.position || selectedPlayer.position || '?';
        const ps = posStyle(pos);
        const nflTeam = fullPlayerInfo?.team || selectedPlayer.team || 'FA';
        const pid = String(selectedPlayer.id);
        const tradeCount = playerTradeMap.get(pid)?.length || 0;

        return (
            <div className="max-w-5xl mx-auto space-y-6 pb-12">
                {/* Back + search bar */}
                <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleBack}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2">
                        ← Back
                    </button>
                    <div className="flex-1 relative">
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players…"
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60" />
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
                    {nflTeam && nflTeam !== 'FA' && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
                            <img src={`https://sleepercdn.com/images/team_logos/nfl/${nflTeam?.toLowerCase()}.jpg`}
                                alt="" className="w-32 h-32 object-contain" onError={e => { e.target.style.display = 'none'; }} />
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
                                {fullPlayerInfo?.college && <span><span className="text-gray-600">⌂</span> {fullPlayerInfo.college}</span>}
                            </div>
                            <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                                {fullPlayerInfo?.age && <span>AGE: <span className="text-gray-200 font-semibold">{fullPlayerInfo.age} yrs</span></span>}
                                {fullPlayerInfo?.height && <span>HT: <span className="text-gray-200 font-semibold">{Math.floor(fullPlayerInfo.height / 12)}'{fullPlayerInfo.height % 12}"</span></span>}
                                {fullPlayerInfo?.weight && <span>WT: <span className="text-gray-200 font-semibold">{fullPlayerInfo.weight} lbs</span></span>}
                                {fullPlayerInfo?.years_exp != null && <span>EXP: <span className="text-gray-200 font-semibold">{fullPlayerInfo.years_exp} yrs</span></span>}
                            </div>

                            {/* All-League & Championship honors */}
                            {(() => {
                                const allLeague = playerAllLeagueHonors[pid] || [];
                                const champs = playerChampionshipHonors[pid] || [];
                                if (!allLeague.length && !champs.length) return null;
                                return (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {/* Championship rings */}
                                        {champs.map((c, i) => {
                                            const champTeamName = c.ownerId ? getTeamName(c.ownerId, c.season) : null;
                                            return (
                                                <span key={`champ-${i}`}
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30"
                                                    title={champTeamName ? `${champTeamName} · ${c.season}` : undefined}>
                                                    🏆 {c.season} Champion{champTeamName ? ` · ${champTeamName}` : ''}
                                                </span>
                                            );
                                        })}
                                        {/* All-League honors — group by season for compactness */}
                                        {allLeague.map((h, i) => {
                                            const tierStyle =
                                                h.tier === 1 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' :
                                                h.tier === 2 ? 'bg-gray-400/15 text-gray-300 border-gray-400/30' :
                                                h.tier === 3 ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' :
                                                'bg-white/8 text-gray-400 border-white/15';
                                            const icon = h.tier === 1 ? '⭐' : h.tier === 2 ? '🌟' : h.tier === 3 ? '✨' : '🎖️';
                                            return (
                                                <span key={`al-${i}`}
                                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierStyle}`}>
                                                    {icon} {h.season} {h.tierLabel}
                                                </span>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
                    {[
                        { key: 'history', label: 'League History' },
                        { key: 'trades',  label: `Trades${tradeCount > 0 ? ` (${tradeCount})` : ''}` },
                    ].map(t => (
                        <button key={t.key} onClick={() => setDetailTab(t.key)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                                detailTab === t.key
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Loading state */}
                {detailLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/10 border-t-blue-400" />
                        <p className="text-sm text-gray-400">Building league history…</p>
                        <p className="text-xs text-gray-600">Fetching weekly lineup data across all seasons</p>
                    </div>
                ) : playerDetail ? (
                    <>
                        {/* ── History Tab ── */}
                        {detailTab === 'history' && (
                            <>
                                {/* Stat boxes — 3 cols on mobile, 6 on desktop, +teams +stints +trades */}
                                <div className="grid grid-cols-3 sm:grid-cols-9 gap-3">
                                    <StatBox label="Total Points"   value={playerDetail.totalPoints.toFixed(1)} accent="text-blue-300" />
                                    <StatBox label="Avg PPG"        value={playerDetail.avgPPG.toFixed(1)}      accent="text-emerald-300" />
                                    <StatBox label="Games Started"  value={playerDetail.totalStarts} />
                                    <StatBox label="Games Benched"  value={playerDetail.totalGames - playerDetail.totalStarts} />
                                    <StatBox label="Start Rate"            value={`${playerDetail.cdr.toFixed(1)}%`}   accent="text-yellow-300" />
                                    <StatBox label="Team Win Rate"  value={`${playerDetail.winRate.toFixed(1)}%`}
                                        accent={playerDetail.winRate >= 50 ? 'text-green-300' : 'text-red-300'} />
                                    <StatBox label="Teams"          value={new Set(playerDetail.stints.map(s => s.ownerId)).size} accent="text-orange-300" />
                                    <StatBox label="Stints"         value={playerDetail.stints.length}          accent="text-pink-300" />
                                    <StatBox label="Times Traded"   value={playerDetail.totalTrades}            accent="text-violet-300" />
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
                                            const isLast = idx === playerDetail.stints.length - 1;
                                            // Show the INCOMING trade on the team that received the player
                                            const currentTeamName = getTeamInfo(stint.ownerId, stint.season).name;
                                            const incomingTrade = (playerDetail.trades || [])
                                                .filter(tr =>
                                                    String(tr.season) === String(stint.season) &&
                                                    Number(tr.week) <= stint.startWeek + 1 &&
                                                    Number(tr.week) >= stint.startWeek - 1 &&
                                                    tr.toTeam === currentTeamName
                                                )
                                                .sort((a, b) => Number(b.week) - Number(a.week))[0] || null;
                                            return (
                                                <div key={`${stint.season}-${stint.rosterId}`}>
                                                    <div className={`flex items-center gap-4 px-6 py-4 ${isLast ? 'bg-white/3' : ''} hover:bg-white/3 transition-colors`}>
                                                        <div className="flex flex-col items-center self-stretch shrink-0">
                                                            <div className={`w-3 h-3 rounded-full border-2 mt-1 ${isLast ? 'border-blue-400 bg-blue-400/30' : 'border-gray-500 bg-gray-700'}`} />
                                                            {!isLast && <div className="w-0.5 flex-1 bg-gray-700/60 mt-1" />}
                                                        </div>
                                                        <TeamAvatar ownerId={stint.ownerId} year={stint.season} getTeamDetails={getTeamDetails} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className={`font-semibold text-sm ${isLast ? 'text-blue-300' : 'text-white'}`}>{teamInfo.name}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {stint.season} Wk {stint.startWeek}{stint.startWeek !== stint.endWeek ? `–${stint.endWeek}` : ''}
                                                                </span>
                                                            </div>
                                                            {/* Acquisition method badge */}
                                                            {stint.acquisition && (() => {
                                                                const acq = stint.acquisition;
                                                                const badgeStyle =
                                                                    acq.method === 'draft'  ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                                                                    acq.method === 'keeper' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                                                                    acq.method === 'trade'  ? 'bg-violet-500/15 text-violet-300 border-violet-500/25' :
                                                                    'bg-gray-500/15 text-gray-400 border-gray-500/25';
                                                                return (
                                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                                                                            <span>{acq.icon}</span>
                                                                            <span>{acq.label}</span>
                                                                        </span>
                                                                        {acq.detail && (
                                                                            <span className="text-[10px] text-gray-500">{acq.detail}</span>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                                                            {[
                                                                { label: 'G',      value: stint.gamesOnRoster },
                                                                { label: 'PPG',    value: ppg },
                                                                { label: 'STARTS', value: stint.starts },
                                                                { label: 'START RATE', value: `${cdr}%` },
                                                                { label: 'W-L',    value: `${stint.wins}-${stint.losses}` },
                                                            ].map(({ label, value }) => (
                                                                <div key={label} className="text-center">
                                                                    <div className="text-xs font-bold text-white">{value}</div>
                                                                    <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="sm:hidden flex items-center gap-3 shrink-0 text-xs">
                                                            <div className="text-right">
                                                                <div className="font-bold text-white">{stint.points?.toFixed(1)}</div>
                                                                <div className="text-[9px] text-gray-500">PTS</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-white">{stint.gamesOnRoster}</div>
                                                                <div className="text-[9px] text-gray-500">G</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Incoming trade receipt — shown on the team that acquired the player */}
                                                    {incomingTrade && (
                                                        <div className="px-10 pb-3">
                                                            <AcquisitionTradeItem trade={incomingTrade} playerId={pid} nflPlayers={nflPlayers} onSelectPlayer={handleSelectPlayer} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Points by stint bar chart */}
                                {playerDetail.stints.some(s => s.points > 0) && (
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
                                                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${barWidth}%` }} />
                                                        </div>
                                                        <div className="w-16 text-right text-xs font-mono text-gray-300">{stint.points.toFixed(1)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Trades Tab ── */}
                        {detailTab === 'trades' && (
                            <div className="space-y-4">
                                {playerDetail.trades.length === 0 ? (
                                    <div className="bg-gray-800/60 border border-white/10 rounded-2xl px-6 py-12 text-center text-gray-500 text-sm">
                                        No trade records found for this player.
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-500">{playerDetail.trades.length} total trade{playerDetail.trades.length !== 1 ? 's' : ''} involving {selectedPlayer.name}</p>
                                        <div className="space-y-3">
                                            {playerDetail.trades.map((trade, i) => (
                                                <div key={i} className="bg-gray-800/60 border border-white/10 rounded-2xl p-5 space-y-3">
                                                    {/* Header row */}
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 px-2 py-1 rounded-lg border border-violet-500/20">
                                                                Trade
                                                            </span>
                                                            {trade.season && <span className="text-xs text-gray-400">Season {trade.season}</span>}
                                                            {trade.week && <span className="text-xs text-gray-500">Week {trade.week}</span>}
                                                        </div>
                                                        {trade.created && (
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(trade.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* From → To */}
                                                    {(trade.fromTeam || trade.toTeam) && (
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            {trade.fromTeam && (
                                                                <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 min-w-0">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">From</div>
                                                                    <div className="text-sm font-bold text-white truncate">{trade.fromTeam}</div>
                                                                </div>
                                                            )}
                                                            <div className="text-gray-500 font-bold text-lg shrink-0">→</div>
                                                            {trade.toTeam && (
                                                                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 min-w-0">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">To</div>
                                                                    <div className="text-sm font-bold text-white truncate">{trade.toTeam}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Other players in trade */}
                                                    {(() => {
                                                        const seenIds = new Set([pid]);
                                                        const others = [...(trade.adds || []), ...(trade.drops || [])].filter(p => {
                                                            const id = String(p.playerId);
                                                            if (seenIds.has(id)) return false;
                                                            seenIds.add(id);
                                                            const pInfo = nflPlayers?.[id] || p;
                                                            return pInfo.full_name || pInfo.first_name || pInfo.last_name;
                                                        });
                                                        if (!others.length) return null;
                                                        return (
                                                            <div>
                                                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Also in this trade</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {others.map((p, pi) => {
                                                                        const pInfo = nflPlayers?.[p.playerId] || p;
                                                                        const name = pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim();
                                                                        const ps2 = posStyle(pInfo.position);
                                                                        return name ? (
                                                                            <button key={pi}
                                                                                onClick={() => handleSelectPlayer({ id: p.playerId, name, position: pInfo.position, team: pInfo.team || 'FA' })}
                                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${ps2.border} ${ps2.bg} hover:brightness-125 transition-all`}>
                                                                                <PlayerAvatar playerId={p.playerId} size="sm" />
                                                                                <span className={`text-xs font-semibold ${ps2.text}`}>{name}</span>
                                                                            </button>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        {leaguePlayers.has(selectedPlayer.id) ? 'Loading league history…' : 'This player has not appeared in any roster in our league history.'}
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Landing View
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl font-bold text-white mb-1">Player History</h1>
                <p className="text-sm text-gray-400">Search for any player to view their history in this league</p>
            </div>

            {/* Top-level tabs */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
                {[
                    { key: 'search',      label: 'Search & Browse' },
                    { key: 'leaderboard', label: '🏆 Leaderboard' },
                    { key: 'allleague',   label: '⭐ All-League' },
                ].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === t.key
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'leaderboard' ? (
                <StaticLeaderboard
                    leaderboardData={leaderboardData}
                    nflPlayers={nflPlayers}
                    onSelectPlayer={handleSelectPlayer}
                />
            ) : activeTab === 'allleague' ? (
                <AllLeagueView
                    allLeagueData={allLeagueData}
                    nflPlayers={nflPlayers}
                    onSelectPlayer={handleSelectPlayer}
                />
            ) : (
                <>
                    {/* Search */}
                    <div className="relative">
                        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                            placeholder="Search for a player…"
                            className="w-full bg-gray-800/80 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60 text-base" />
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
                                    const lastTeamName = p.lastOwner ? getTeamName(p.lastOwner, p.lastSeason) : '—';
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
                </>
            )}
        </div>
    );
};

export default PlayerHistory;