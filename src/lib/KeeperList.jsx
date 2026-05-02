import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import resolveKeeperPick from '../utils/keeperSlotResolver';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_KEEPER_YEARS = 2; // year drafted/acquired = year 1; kept at most 2 more times
const FA_ROUND = 10;        // waiver / free-agent pickups cost Round 10
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

// ---------------------------------------------------------------------------
// Pure helpers — defined outside the component for stable references
// ---------------------------------------------------------------------------

/**
 * Last season a player may appear on a roster.
 *
 *   • Drafted OR waiver pickup year = year 1 (no distinction).
 *   • Max 2 additional keeper seasons → 3 total seasons on roster.
 *   • expirationYear = acquisitionSeason + MAX_KEEPER_YEARS (= +2)
 *
 * If the player has already been kept ≥1 time:
 *   expirationYear = lastKeeperSeason + max(0, MAX_KEEPER_YEARS − yearsKept)
 */
function computeExpiration(r, currentSeasonNum, lastCompletedDraftSeason) {
    const lastKeeper        = r.lastKeeperSeason ? Number(r.lastKeeperSeason) : null;
    const keptYears         = r.yearsKept || 0;
    const acquisitionSeason = r.firstSeasonSeen ? Number(r.firstSeasonSeen) : (lastCompletedDraftSeason ?? currentSeasonNum);

    if (lastKeeper !== null) {
        return lastKeeper + Math.max(0, MAX_KEEPER_YEARS - keptYears);
    }
    return acquisitionSeason != null ? acquisitionSeason + MAX_KEEPER_YEARS : null;
}

/**
 * Round cost for keeping a player.
 * F Jon Rule: assignedRound = originalRound − leagueWideKeeperCount  (min 1)
 * Players with no recorded draft round (waiver pickups) use FA_ROUND as base.
 */
// teamKeeperCount = how many players THIS team is keeping this draft cycle.
// F Jon deduction: keeping N players costs originalRound − (N − 1).
// So deduction = max(0, N - 1).
// 1 keeper  → deduction 0 → originalRound
// 2 keepers → deduction 1 → originalRound − 1
// 3 keepers → deduction 2 → originalRound − 2
function computeAssignedRound(originalDraftRound, teamKeeperCount) {
    const base = originalDraftRound ? Number(originalDraftRound) : FA_ROUND;
    const deduction = Math.max(0, (teamKeeperCount || 0) - 1);
    return Math.max(1, base - deduction);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function KeeperList() {
    const {
        historicalData,
        usersData,
        currentSeason,
        nflPlayers,
        getTeamDetails,
        rostersWithDetails,
    } = useSleeperData();

    // -----------------------------------------------------------------------
    // 1. Build keeper history map
    //
    //  Data reality (confirmed from console):
    //    • currentSeason = "2026" (new season, draft hasn't happened yet)
    //    • draftPicksBySeason keys = "2022"–"2025" (historical only)
    //    • draftPicksBySeason["2026"] = [] (empty — no picks yet)
    //    • rostersWithDetails = live 2026 rosters with correct .players arrays
    //    • historicalData.rostersBySeason["2026"] = same rosters (enriched)
    //
    //  Strategy:
    //    Build currentRosterPlayerIds from live rostersWithDetails.
    //    Pull draft/keeper history from 2022–2025 pick data.
    //    Match via the ghost filter so only current-roster players appear.
    //    firstSeasonSeen = most recent non-keeper draft season → expiration = that + 2.
    // -----------------------------------------------------------------------
    const keeperMap = useMemo(() => {
        const map = {};
        if (!historicalData?.draftPicksBySeason) return map;

        const currentSeasonNum = currentSeason ? Number(currentSeason) : null;

        // Most recent season that has actual draft picks (may be currentSeason - 1 when
        // the new season has started but the draft hasn't happened yet).
        // Used so FA/waiver pickups acquired during the 2025 season get the same
        // expiration as players who were drafted in the 2025 draft.
        const allPickSeasons = Object.keys(historicalData?.draftPicksBySeason || {}).map(Number).sort((a, b) => b - a);
        const lastCompletedDraftSeason = allPickSeasons.find(s => (historicalData.draftPicksBySeason[s] || []).length > 0) ?? currentSeasonNum;

        // --- Current roster set from live rostersWithDetails ---
        const currentRosterPlayerIds = new Set();
        const liveRosters = Array.isArray(rostersWithDetails) ? rostersWithDetails : [];
        for (const roster of liveRosters) {
            const players = Array.isArray(roster.players) ? roster.players : [];
            for (const pid of players) currentRosterPlayerIds.add(String(pid));
        }
        const hasRosterData = currentRosterPlayerIds.size > 0;

        // --- Collect historical picks per player (ascending season order) ---
        const picksByPlayer = {};
        const seasons = Object.keys(historicalData.draftPicksBySeason)
            .map(Number)
            .sort((a, b) => a - b);

        for (const s of seasons) {
            const picks = (historicalData.draftPicksBySeason[s] || [])
                .slice()
                .sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0));

            for (const p of picks) {
                if (!p.player_id) continue;
                const pid = String(p.player_id);
                if (!picksByPlayer[pid]) picksByPlayer[pid] = [];
                picksByPlayer[pid].push({
                    season:        s,
                    is_keeper:     !!p.is_keeper,
                    picked_by:     p.picked_by,
                    roster_id:     p.roster_id,
                    player_name:   p.player_name
                        || `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim(),
                    round:         p.round         ?? null,
                    pick_in_round: p.pick_in_round ?? null,
                    pick_no:       p.pick_no       ?? null,
                });
            }
        }

        // --- Derive per-player keeper metadata ---
        for (const [pid, picks] of Object.entries(picksByPlayer)) {
            // Ghost filter: skip players not on any current roster.
            // Bypassed when roster data hasn't loaded yet.
            if (hasRosterData && !currentRosterPlayerIds.has(pid)) continue;

            let lastOwner           = null;
            let playerName          = null;
            let lastNonKeeperSeason = null;

            for (const pick of picks) {
                lastOwner  = pick.picked_by || lastOwner;
                playerName = playerName || pick.player_name;
                // Any non-keeper appearance (re-drafted or entered pool) resets window
                if (!pick.is_keeper) lastNonKeeperSeason = pick.season;
            }

            // currentDraftStart = most recent season the player entered the pool
            const currentDraftStart = lastNonKeeperSeason ?? picks[0].season;
            const picksAfterStart   = picks.filter(p => p.season >= currentDraftStart);
            const yearsKept         = picksAfterStart.filter(p => p.is_keeper).length;
            const lastKeeperAfter   = picksAfterStart.slice().reverse().find(p => p.is_keeper);
            const lastKeeperSeason  = lastKeeperAfter?.season ?? null;

            // originalDraftRound: null = undrafted/waiver → FA_ROUND used for cost
            const originalPick       = picksAfterStart[0] ?? picks[0] ?? null;
            const originalDraftRound = originalPick?.round ?? null;

            map[pid] = {
                player_name:         playerName || 'Unknown',
                lastOwner,
                yearsKept,
                lastSeasonSeen:      picks[picks.length - 1].season,
                firstSeasonSeen:     currentDraftStart, // acquisition season drives expiration
                originalDraftSeason: picks[0].season,
                originalDraftRound,
                originalPickInRound: originalPick?.pick_in_round ?? null,
                originalPickNo:      originalPick?.pick_no       ?? null,
                lastKeeperSeason,
                isKeeper:            !!picks[picks.length - 1]?.is_keeper,
            };
        }

        // --- Re-acquisition reset ---
        // Players with draft history from a prior season who sat off rosters for
        // one or more full seasons before being picked up off waivers in the most
        // recent season (e.g. Gainwell: drafted 2023, back on waiver in 2025;
        // Carter: drafted 2022, back on waiver in 2025).
        // Their old draft record gives an expired window. If the player IS on a
        // current roster but lastSeasonSeen < lastCompletedDraftSeason and they
        // have no active keeper history, reset their window to lastCompletedDraftSeason.
        for (const [pid, data] of Object.entries(map)) {
            if (!currentRosterPlayerIds.has(pid)) continue;   // not on any current roster
            if (data.yearsKept > 0) continue;                 // actively kept — leave alone
            if (data.lastKeeperSeason) continue;              // has keeper history — leave alone
            if (!lastCompletedDraftSeason) continue;
            const lastSeen = Number(data.lastSeasonSeen);
            if (lastSeen < lastCompletedDraftSeason) {
                // Was off rosters for at least one full season then re-acquired off waivers.
                // Reset eligibility window to the most recent completed draft season.
                map[pid] = {
                    ...data,
                    firstSeasonSeen:     lastCompletedDraftSeason,
                    lastSeasonSeen:      lastCompletedDraftSeason,
                    originalDraftRound:  null,   // no draft slot this cycle → FA cost
                    originalPickInRound: null,
                    originalPickNo:      null,
                    yearsKept:           0,
                    lastKeeperSeason:    null,
                    isKeeper:            false,
                };
            }
        }

        // --- Pure waiver pickups: on current roster but zero draft history at all ---
        for (const roster of liveRosters) {
            const players = Array.isArray(roster.players) ? roster.players : [];
            for (const playerId of players) {
                const pid = String(playerId);
                if (map[pid]) continue;
                const player     = nflPlayers?.[playerId];
                const playerName = player
                    ? `${player.first_name} ${player.last_name}`
                    : `Player ${playerId}`;
                map[pid] = {
                    player_name:         playerName,
                    lastOwner:           null,
                    yearsKept:           0,
                    lastSeasonSeen:      lastCompletedDraftSeason,
                    // Use lastCompletedDraftSeason so waiver pickups in the 2025
                    // season get expiration 2025+2=2027, same as 2025 draftees.
                    firstSeasonSeen:     lastCompletedDraftSeason,
                    originalDraftSeason: null,
                    originalDraftRound:  null,
                    originalPickInRound: null,
                    originalPickNo:      null,
                    lastKeeperSeason:    null,
                    isKeeper:            false,
                };
            }
        }

        // ── DEBUG LOGS ─────────────────────────────────────────────────────
        console.log('[KeeperMap] lastCompletedDraftSeason:', lastCompletedDraftSeason);
        console.log('[KeeperMap] currentSeasonNum:', currentSeasonNum);
        console.log('[KeeperMap] total players in map:', Object.keys(map).length);
        console.log('[KeeperMap] currentRosterPlayerIds size:', currentRosterPlayerIds.size);

        // Log any player with firstSeasonSeen >= currentSeasonNum (suspect 2026 entries)
        const suspects = Object.entries(map).filter(([, d]) => Number(d.firstSeasonSeen) >= currentSeasonNum);
        console.log('[KeeperMap] players with firstSeasonSeen >= currentSeason (should be none):', suspects.length);
        suspects.slice(0, 5).forEach(([pid, d]) => {
            console.log(`  [SUSPECT] pid=${pid} name="${d.player_name}" firstSeasonSeen=${d.firstSeasonSeen} lastSeasonSeen=${d.lastSeasonSeen} yearsKept=${d.yearsKept} lastKeeperSeason=${d.lastKeeperSeason} originalDraftRound=${d.originalDraftRound}`);
        });

        // Log players with expiration <= lastCompletedDraftSeason (already expired — should be filtered by ghost check)
        const expired = Object.entries(map).filter(([, d]) => {
            const exp = d.lastKeeperSeason
                ? d.lastKeeperSeason + Math.max(0, 2 - (d.yearsKept || 0))
                : (d.firstSeasonSeen ? Number(d.firstSeasonSeen) + 2 : null);
            return exp !== null && exp < currentSeasonNum;
        });
        console.log('[KeeperMap] players with expiration < currentSeason (ghost candidates):', expired.length);
        expired.slice(0, 5).forEach(([pid, d]) => {
            const exp = d.lastKeeperSeason
                ? d.lastKeeperSeason + Math.max(0, 2 - (d.yearsKept || 0))
                : (d.firstSeasonSeen ? Number(d.firstSeasonSeen) + 2 : null);
            console.log(`  [GHOST] pid=${pid} name="${d.player_name}" expiration=${exp} firstSeasonSeen=${d.firstSeasonSeen} lastKeeperSeason=${d.lastKeeperSeason} yearsKept=${d.yearsKept}`);
        });

        // Log a sample of 5 normal players to verify correct values
        const sample = Object.entries(map).filter(([, d]) => {
            const exp = d.lastKeeperSeason
                ? d.lastKeeperSeason + Math.max(0, 2 - (d.yearsKept || 0))
                : (d.firstSeasonSeen ? Number(d.firstSeasonSeen) + 2 : null);
            return exp >= currentSeasonNum;
        }).slice(0, 5);
        console.log('[KeeperMap] sample of valid players:');
        sample.forEach(([pid, d]) => {
            const exp = d.lastKeeperSeason
                ? d.lastKeeperSeason + Math.max(0, 2 - (d.yearsKept || 0))
                : (d.firstSeasonSeen ? Number(d.firstSeasonSeen) + 2 : null);
            console.log(`  pid=${pid} name="${d.player_name}" firstSeasonSeen=${d.firstSeasonSeen} yearsKept=${d.yearsKept} lastKeeperSeason=${d.lastKeeperSeason} expiration=${exp} originalDraftRound=${d.originalDraftRound}`);
        });
        // ── END DEBUG ───────────────────────────────────────────────────────

        return map;
    }, [historicalData, rostersWithDetails, nflPlayers, currentSeason]);

    // -----------------------------------------------------------------------
    // 2. Stable derived values — must be declared before any memo that uses them
    // -----------------------------------------------------------------------
    const currentSeasonNum = currentSeason ? Number(currentSeason) : null;

    // Most recent season that actually has draft picks.
    // When currentSeason="2026" but the draft hasn't happened yet, resolves to 2025
    // so waiver pickups and drafted players share the same expiration year.
    const lastCompletedDraftSeason = useMemo(() => {
        const allPickSeasons = Object.keys(historicalData?.draftPicksBySeason || {})
            .map(Number)
            .sort((a, b) => b - a);
        return allPickSeasons.find(s => (historicalData?.draftPicksBySeason[s] || []).length > 0)
            ?? currentSeasonNum;
    }, [historicalData, currentSeasonNum]);

    // Per-team keeper count from the last completed draft (for F Jon round cost).
    // F Jon Rule: keeping N players → deduction of (N-1) rounds each.
    //   1 keeper → originalRound, 2 keepers → originalRound−1, 3 → originalRound−2
    const keeperCountByRosterId = useMemo(() => {
        const counts = new Map();
        if (!historicalData?.draftPicksBySeason || !lastCompletedDraftSeason) return counts;
        const picks = historicalData.draftPicksBySeason[lastCompletedDraftSeason] || [];
        for (const p of picks) {
            if (!p.is_keeper) continue;
            const rid = String(p.picked_by ?? p.roster_id ?? '');
            if (!rid) continue;
            counts.set(rid, (counts.get(rid) || 0) + 1);
        }
        return counts;
    }, [historicalData, lastCompletedDraftSeason]);

    // -----------------------------------------------------------------------
    // 3. Current-season player→roster map and roster column headers
    // -----------------------------------------------------------------------

    const { currentPlayersMap, rosterOptions, positionOptions } = useMemo(() => {
        const map    = new Map();
        const rosters = {};
        const posSet  = new Set();

        const liveRosters = Array.isArray(rostersWithDetails) ? rostersWithDetails : [];
        for (const roster of liveRosters) {
            const players = Array.isArray(roster.players) ? roster.players : [];
            for (const playerId of players) {
                const pid      = String(playerId);
                const player   = nflPlayers?.[playerId];
                const position = player?.position ?? null;
                map.set(pid, { roster_id: String(roster.roster_id), position });
                if (position) posSet.add(position);
            }
        }

        // Roster display names — historicalData.rostersBySeason[2026] is enriched
        // by the context with ownerTeamName / ownerDisplayName
        const seasonRosters = historicalData?.rostersBySeason?.[currentSeasonNum]
            || historicalData?.rostersBySeason?.[String(currentSeasonNum)]
            || [];

        for (const r of seasonRosters) {
            const id = String(r.roster_id);
            const displayName = r.ownerTeamName
                || r.metadata?.team_name
                || usersData?.find(u => String(u.user_id) === String(r.owner_id))?.metadata?.team_name
                || usersData?.find(u => String(u.user_id) === String(r.owner_id))?.display_name
                || r.owner_id
                || id;
            rosters[id] = displayName;
        }

        const rosterOpts = Object.entries(rosters).map(([id, name]) => {
            const raw     = seasonRosters.find(r => String(r.roster_id) === id);
            const ownerId = raw?.owner_id ?? null;
            return { id, name, ownerId };
        });

        const ordered   = POS_ORDER.filter(p => posSet.has(p));
        const leftovers = [...posSet].filter(p => !POS_ORDER.includes(p)).sort();

        return {
            currentPlayersMap: map,
            rosterOptions:     rosterOpts,
            positionOptions:   [...ordered, ...leftovers],
        };
    }, [historicalData, currentSeasonNum, rostersWithDetails, nflPlayers, usersData]);

    // -----------------------------------------------------------------------
    // 4. Expiration year filter options
    // -----------------------------------------------------------------------
    const yearOptions = useMemo(() => {
        const years = new Set();
        for (const [pid, data] of Object.entries(keeperMap)) {
            if (!currentPlayersMap.has(String(pid))) continue;
            const exp = computeExpiration(data, currentSeasonNum, lastCompletedDraftSeason);
            if (exp) years.add(exp);
        }
        return [...years].sort((a, b) => a - b);
    }, [keeperMap, currentPlayersMap, currentSeasonNum, lastCompletedDraftSeason]);

    // -----------------------------------------------------------------------
    // 5. Filter / sort state
    // -----------------------------------------------------------------------
    const [selectedRosterId, setSelectedRosterId] = useState('all');
    const [selectedPosition, setSelectedPosition] = useState('all');
    const [sortMode,         setSortMode]         = useState('position');
    const [selectedYear,     setSelectedYear]     = useState('all');
    const [playerQuery,      setPlayerQuery]      = useState('');

    useEffect(() => {
        if (selectedRosterId !== 'all' && !rosterOptions.find(r => r.id === selectedRosterId))
            setSelectedRosterId('all');
    }, [rosterOptions, selectedRosterId]);

    useEffect(() => {
        if (selectedPosition !== 'all' && !positionOptions.includes(selectedPosition))
            setSelectedPosition('all');
    }, [positionOptions, selectedPosition]);

    useEffect(() => {
        if (selectedYear !== 'all' && !yearOptions.find(y => String(y) === selectedYear))
            setSelectedYear('all');
    }, [yearOptions, selectedYear]);

    // -----------------------------------------------------------------------
    // 6. Filtered rows
    // -----------------------------------------------------------------------
    const rows = useMemo(() => {
        return Object.entries(keeperMap)
            .map(([player_id, data]) => ({ player_id, ...data }))
            .filter(r => {
                const cp = currentPlayersMap.get(String(r.player_id));
                if (!cp) return false;
                if (selectedRosterId !== 'all' && cp.roster_id !== selectedRosterId) return false;
                if (selectedPosition !== 'all') {
                    if ((cp.position || '').toUpperCase() !== selectedPosition.toUpperCase()) return false;
                }
                if (selectedYear !== 'all') {
                    const exp = computeExpiration(r, currentSeasonNum, lastCompletedDraftSeason);
                    if (!exp || String(exp) !== selectedYear) return false;
                }
                return true;
            });
    }, [keeperMap, currentPlayersMap, selectedRosterId, selectedPosition, selectedYear, currentSeasonNum, lastCompletedDraftSeason]);

    // -----------------------------------------------------------------------
    // 7. Sort helper
    // -----------------------------------------------------------------------
    const sortPlayers = useCallback((players) => {
        return players.slice().sort((a, b) => {
            if (sortMode === 'draftYear') {
                const aE = computeExpiration(a, currentSeasonNum, lastCompletedDraftSeason) ?? 9999;
                const bE = computeExpiration(b, currentSeasonNum, lastCompletedDraftSeason) ?? 9999;
                if (aE !== bE) return aE - bE;
            }
            if (sortMode === 'round') {
                // Sort by base original round (no per-team deduction applied in sort)
                const aR = computeAssignedRound(a.originalDraftRound, 0);
                const bR = computeAssignedRound(b.originalDraftRound, 0);
                if (aR !== bR) return aR - bR;
            }
            const aPos = (currentPlayersMap.get(String(a.player_id))?.position || nflPlayers?.[a.player_id]?.position || '').toUpperCase();
            const bPos = (currentPlayersMap.get(String(b.player_id))?.position || nflPlayers?.[b.player_id]?.position || '').toUpperCase();
            const ai   = POS_ORDER.indexOf(aPos) === -1 ? 999 : POS_ORDER.indexOf(aPos);
            const bi   = POS_ORDER.indexOf(bPos) === -1 ? 999 : POS_ORDER.indexOf(bPos);
            if (ai !== bi) return ai - bi;
            return (a.player_name || '').localeCompare(b.player_name || '');
        });
    }, [sortMode, currentSeasonNum, lastCompletedDraftSeason, currentPlayersMap, nflPlayers]);

    // -----------------------------------------------------------------------
    // 8. Player card renderer
    // -----------------------------------------------------------------------
    const renderPlayerCard = useCallback((r, team) => {
        const cp        = currentPlayersMap.get(String(r.player_id));
        const nfl       = nflPlayers?.[r.player_id];
        const pos       = (cp?.position || nfl?.position || '').toUpperCase();
        const teamAbbr  = nfl?.team || '';
        const keptYears = r.yearsKept || 0;

        // DEF display name fallback
        let displayName = r.player_name || '';
        if ((!displayName || displayName.toLowerCase().includes('unknown')) && pos === 'DEF') {
            if (teamAbbr) {
                displayName = `${teamAbbr} DEF`;
            } else {
                let foundTeam = null;
                for (const s of Object.keys(historicalData?.draftPicksBySeason || {}).sort()) {
                    const pick = (historicalData.draftPicksBySeason[s] || [])
                        .find(p => String(p.player_id) === String(r.player_id));
                    if (pick) { foundTeam = pick.metadata?.team || pick.player_team || null; if (foundTeam) break; }
                }
                displayName = foundTeam ? `${foundTeam} DEF` : 'Unknown Defense';
            }
        }

        const expirationYear = computeExpiration(r, currentSeasonNum, lastCompletedDraftSeason);
        // Keeper count for THIS team in the last completed draft (drives F Jon deduction)
        const teamKeeperCount = keeperCountByRosterId.get(String(team.id)) || 0;
        const assignedRound  = computeAssignedRound(r.originalDraftRound, teamKeeperCount);

        // ── DEBUG: log genuinely wrong expirations only ──────────────────
        // Valid range: currentSeason (2026) through currentSeason+2 (2028).
        // 2026 is correct for players drafted 2024 and kept once in 2025.
        // Only flag: expired (< currentSeason) or impossible future (> currentSeason+2).
        if (expirationYear < (currentSeasonNum ?? 0) || expirationYear > (currentSeasonNum ?? 0) + 2) {
            console.log(`[CardDebug] SUSPECT EXPIRATION — "${r.player_name}" (pid=${r.player_id})`
                + ` exp=${expirationYear} firstSeasonSeen=${r.firstSeasonSeen}`
                + ` lastKeeperSeason=${r.lastKeeperSeason} yearsKept=${r.yearsKept}`
                + ` originalDraftRound=${r.originalDraftRound} lastSeasonSeen=${r.lastSeasonSeen}`
                + ` team.id=${team.id} teamKeeperCount=${teamKeeperCount} assignedRound=${assignedRound}`
            );
        }
        // ── END DEBUG ─────────────────────────────────────────────────────

        // Colour coding: 0 keeps = neutral, 1 = yellow warning, 2 = red (final year)
        let containerClass  = 'bg-gray-900 border-gray-800';
        let nameClass       = 'text-gray-100';
        let expirationClass = 'text-gray-200';
        if (keptYears >= 2) {
            containerClass  = 'bg-red-900/10 border-red-500';
            nameClass       = 'text-red-200 font-medium';
            expirationClass = 'text-red-300';
        } else if (keptYears === 1) {
            containerClass  = 'bg-yellow-900/10 border-yellow-500';
            nameClass       = 'text-yellow-200 font-medium';
            expirationClass = 'text-yellow-300';
        }

        // resolveKeeperPick handles future seasons correctly:
        // if expirationYear has no picks yet it returns "Round Cost: Rn"
        let pickLabel = `Round Cost: R${assignedRound}`;
        if (expirationYear && assignedRound) {
            // Pass team.id (roster_id) because Sleeper draft picks store picked_by as roster_id.
            // The resolver will also try owner_id matching via rostersBySeason mapping.
            const res = resolveKeeperPick(
                historicalData,
                team.id,
                expirationYear,
                assignedRound
            );
            pickLabel = res.label;
        }

        return (
            <div key={r.player_id} className={`flex justify-between items-center p-1 rounded border ${containerClass}`}>
                <div className={`min-w-0 flex-1 text-sm text-left ${nameClass}`}>
                    <div className="break-words sm:truncate">
                        <span className="block">{displayName}</span>
                        {(pos || teamAbbr) && (
                            <span className="block mt-1 text-[10px] text-gray-400">
                                {pos}{pos && teamAbbr ? ` • ${teamAbbr}` : teamAbbr}
                            </span>
                        )}
                    </div>
                </div>
                <div className="ml-3 flex-shrink-0 w-16 text-xs text-right">
                    <div className={`font-semibold ${expirationClass}`}>{expirationYear ?? '—'}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{pickLabel}</div>
                </div>
            </div>
        );
    }, [currentPlayersMap, nflPlayers, historicalData, currentSeasonNum, lastCompletedDraftSeason, keeperCountByRosterId]);

    // -----------------------------------------------------------------------
    // 9. Render
    // -----------------------------------------------------------------------
    const fjonYear    = currentSeasonNum ? currentSeasonNum + 3 : 2029;
    const tooltipText = [
        `1 player kept league-wide = each at original round value`,
        `2 players kept league-wide = each at originalRound − 1`,
        `3 players kept league-wide = each at originalRound − 2`,
        `If you do not own the assigned round pick, cost is −1 round.`,
        `Free agent keepers are assigned Round ${FA_ROUND}.`,
    ].join('\n');

    return (
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">Keepers</h2>
            <p className="text-sm text-gray-200 mb-4">
                Rules: 3 players kept from 3 different positions. Draft year + 2 keeper years = 3 seasons max.{' '}
                Starting in {fjonYear},{' '}
                <span className="underline decoration-dotted decoration-gray-400 cursor-help" title={tooltipText}>
                    F Jon
                </span>{' '}
                Rule will be fully implemented with draft pick values assigned to players.
            </p>

            {/* Filters */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-4 flex-wrap">
                <div>
                    <label className="text-sm text-gray-100 mr-2">Roster:</label>
                    <select value={selectedRosterId} onChange={e => setSelectedRosterId(e.target.value)}
                        className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {rosterOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-100 mr-2">Position:</label>
                    <select value={selectedPosition} onChange={e => setSelectedPosition(e.target.value)}
                        className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-100 mr-2">Sort by:</label>
                    <select value={sortMode} onChange={e => setSortMode(e.target.value)}
                        className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="position">Position order</option>
                        <option value="draftYear">Draft-eligible year</option>
                        <option value="round">Round cost</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-100 mr-2">Year:</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                        className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                </div>
                <div className="mt-2 sm:mt-0">
                    <label className="text-sm text-gray-100 mr-2">Search:</label>
                    <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)}
                        placeholder="Player name"
                        className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto bg-gray-800 rounded-lg p-3">
                {rows.length === 0 ? (
                    <div className="py-8 text-center text-gray-300">
                        No keeper data available for current season.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {rosterOptions
                            .filter(team => selectedRosterId === 'all' || team.id === selectedRosterId)
                            .map(team => {
                                const teamPlayers = rows.filter(r => {
                                    const cp = currentPlayersMap.get(String(r.player_id));
                                    if (!cp || cp.roster_id !== team.id) return false;
                                    if (playerQuery.trim()) {
                                        return (r.player_name || '').toLowerCase()
                                            .includes(playerQuery.trim().toLowerCase());
                                    }
                                    return true;
                                });

                                const td  = team.ownerId && getTeamDetails
                                    ? getTeamDetails(team.ownerId, currentSeason)
                                    : null;
                                const src = td?.avatar || '/LeagueLogo.PNG';

                                return (
                                    <div key={team.id} className="bg-white/5 border border-gray-700 rounded p-2">
                                        <div className="flex items-center justify-center mb-2">
                                            <img
                                                src={src}
                                                alt={`${td?.name || team.name} logo`}
                                                className="w-6 h-6 mr-2 object-contain"
                                                onError={e => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }}
                                            />
                                            <div className="font-semibold text-yellow-300 text-center text-sm">
                                                {team.name}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            {teamPlayers.length === 0 ? (
                                                <div className="text-sm text-gray-400">No players</div>
                                            ) : (
                                                sortPlayers(teamPlayers).map(r => renderPlayerCard(r, team))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </div>
    );
}