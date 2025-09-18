import React, { useMemo, useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import resolveKeeperPick from '../utils/keeperSlotResolver';

// KeeperList: independent page under League tab to show current keepers and keeper metadata
export default function KeeperList() {
    const { historicalData, usersData, currentSeason, nflPlayers, getTeamDetails } = useSleeperData();

    // ...existing code... (no centralized helper; expiration calculation inlined where needed)

    // Build keeper history across seasons (old -> new)
    const keeperMap = useMemo(() => {
        const map = {}; // player_id -> { player_name, lastOwner, yearsKept, lastSeasonSeen, firstSeasonSeen, isKeeper }
        if (!historicalData || !historicalData.draftPicksBySeason) return map;

        // Collect all picks per player across seasons
        const picksByPlayer = {};
        const seasons = Object.keys(historicalData.draftPicksBySeason).map(s => Number(s)).sort((a, b) => a - b);
        for (const s of seasons) {
            const picks = (historicalData.draftPicksBySeason[s] || []).slice().sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0));
            for (const p of picks) {
                if (!p.player_id) continue;
                const pid = String(p.player_id);
                if (!picksByPlayer[pid]) picksByPlayer[pid] = [];
                // preserve round/pick info if present (processed draft data includes round/pick_in_round/pick_no)
                picksByPlayer[pid].push({
                    season: s,
                    is_keeper: !!p.is_keeper,
                    picked_by: p.picked_by,
                    roster_id: p.roster_id,
                    player_name: p.player_name || `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim(),
                    round: p.round || null,
                    pick_in_round: p.pick_in_round || null,
                    pick_no: p.pick_no || null,
                });
            }
        }

        // For each player, compute original draft season and determine if a later non-keeper pick resets the draft start.
        for (const [pid, picks] of Object.entries(picksByPlayer)) {
            // picks already in ascending season order
            const originalDraftSeason = picks.length ? picks[0].season : null;
            let lastSeasonSeen = null;
            let lastOwner = null;
            let playerName = null;
            let lastNonKeeperSeason = null;
            let lastKeeperSeason = null;

            for (const pick of picks) {
                lastSeasonSeen = pick.season;
                lastOwner = pick.picked_by || lastOwner;
                playerName = playerName || pick.player_name;
                if (!pick.is_keeper) lastNonKeeperSeason = pick.season;
                if (pick.is_keeper) lastKeeperSeason = pick.season;
            }

            // If there was a non-keeper appearance after the original draft, the current draft start is that season; otherwise use originalDraftSeason
            const currentDraftStart = lastNonKeeperSeason !== null ? lastNonKeeperSeason : originalDraftSeason;

            // Consider only picks at or after the current draft start when computing keeper streaks
            const picksAfterStart = currentDraftStart === null ? [] : picks.filter(p => p.season >= currentDraftStart);
            const yearsKept = picksAfterStart.filter(p => p.is_keeper).length;
            // lastKeeperSeason should reflect the most recent keeper season after the current draft start (or null)
            const lastKeeperAfter = picksAfterStart.slice().reverse().find(p => p.is_keeper);
            const lastKeeperSeasonAfterStart = lastKeeperAfter ? lastKeeperAfter.season : null;
            // isKeeper: true only if the very last pick overall is a keeper (i.e., currently on keeper status)
            const isKeeper = picks[picks.length - 1]?.is_keeper ? true : false;

            // capture original draft round/pick info from the pick at the current draft start (in case the player was re-drafted after being returned to the draft)
            const originalPick = (picksAfterStart && picksAfterStart.length) ? picksAfterStart[0] : (picks.length ? picks[0] : null);
            const originalDraftRound = originalPick ? (originalPick.round || null) : null;
            const originalPickInRound = originalPick ? (originalPick.pick_in_round || null) : null;
            const originalPickNo = originalPick ? (originalPick.pick_no || null) : null;

            map[pid] = {
                player_name: playerName || 'Unknown',
                lastOwner,
                yearsKept,
                lastSeasonSeen,
                firstSeasonSeen: currentDraftStart,
                originalDraftSeason,
                originalDraftRound,
                originalPickInRound,
                originalPickNo,
                // expose lastKeeperSeason relative to current draft start for expiration calculations
                lastKeeperSeason: lastKeeperSeasonAfterStart,
                isKeeper
            };
        }

        return map;
    }, [historicalData]);

    // Selection state for filtering
    const [selectedRosterId, setSelectedRosterId] = useState('all');
    const [selectedPosition, setSelectedPosition] = useState('all');
    // sort mode: 'position' uses preferred position order; 'draftYear' sorts by draft-eligible year ascending
    const [sortMode, setSortMode] = useState('position');

    // Build current season player -> roster and position map, and roster display names
    const { currentPlayersMap, rosterOptions, positionOptions, rosterLookup } = useMemo(() => {
        const map = new Map(); // player_id -> { roster_id, position }
        const rosters = {};
        const positionsSet = new Set();

        if (currentSeason && historicalData?.draftPicksBySeason?.[currentSeason]) {
            for (const p of historicalData.draftPicksBySeason[currentSeason]) {
                if (!p.player_id) continue;
                const pid = String(p.player_id);
                // prefer p.roster_id if available
                if (p.roster_id) map.set(pid, { roster_id: String(p.roster_id), position: p.player_position || p.metadata?.position || null });
                else map.set(pid, { roster_id: null, position: p.player_position || p.metadata?.position || null });
                const pos = p.player_position || p.metadata?.position;
                if (pos) positionsSet.add(pos);
            }
        }

        if (currentSeason && historicalData?.rostersBySeason?.[currentSeason]) {
            for (const r of historicalData.rostersBySeason[currentSeason]) {
                const id = String(r.roster_id);
                // Prefer explicit team_name, otherwise resolve owner_id to usersData display/team name
                let displayName = r.metadata?.team_name;
                if (!displayName && r.owner_id && usersData) {
                    const user = usersData.find(u => String(u.user_id) === String(r.owner_id));
                    if (user) {
                        displayName = user.metadata?.team_name || user.display_name || String(r.owner_id);
                    }
                }
                rosters[id] = displayName || r.owner_id || id;
            }
        }

        const rosterOpts = Object.entries(rosters).map(([id, name]) => {
            // try to find owner_id from raw rosters data to pass into header for logo lookup
            let ownerId = null;
            if (currentSeason && historicalData?.rostersBySeason?.[currentSeason]) {
                const raw = historicalData.rostersBySeason[currentSeason].find(r => String(r.roster_id) === String(id));
                if (raw) ownerId = raw.owner_id || null;
            }
            return { id, name, ownerId };
        });
    // Preferred static ordering for positions
    const preferredOrder = ['QB','RB','WR','TE','K','DEF'];
    const detected = Array.from(positionsSet).map(p => (p || '').toUpperCase());
    // Build ordered list: include preferred positions in order if present, then any leftovers alphabetically
    const orderedPreferred = preferredOrder.filter(p => detected.includes(p));
    const leftovers = detected.filter(p => !preferredOrder.includes(p)).sort();
    const positionOpts = [...orderedPreferred, ...leftovers];

        return { currentPlayersMap: map, rosterOptions: rosterOpts, positionOptions: positionOpts, rosterLookup: rosters };
    }, [historicalData, currentSeason]);

    // derive expiration years present in keeperMap for the current season players
    const yearOptions = useMemo(() => {
        const years = new Set();
        for (const [pid, data] of Object.entries(keeperMap)) {
            // only include players on current rosters
            const cp = currentPlayersMap.get(String(pid));
            if (!cp) continue;
            const firstSeason = data.firstSeasonSeen ? Number(data.firstSeasonSeen) : (data.lastSeasonSeen ? Number(data.lastSeasonSeen) : null);
            const lastKeeper = data.lastKeeperSeason ? Number(data.lastKeeperSeason) : null;
            const keptYears = data.yearsKept || 0;
            let expirationYear = null;
            if (lastKeeper) {
                const remaining = Math.max(0, 3 - keptYears);
                expirationYear = lastKeeper + remaining;
            } else if (firstSeason) {
                expirationYear = firstSeason + 3;
            }
            if (expirationYear) years.add(expirationYear);
        }
        return Array.from(years).sort((a,b)=>a-b);
    }, [keeperMap, currentPlayersMap]);

    // Year filter state
    const [selectedYear, setSelectedYear] = useState('all');

    // Filter keeperMap to players currently on a roster this season and by selected filters
    const rows = useMemo(() => {
        const entries = Object.entries(keeperMap).map(([player_id, data]) => ({ player_id, ...data }));

        return entries.filter(r => {
            // Filter by current roster membership
            const cp = currentPlayersMap.get(String(r.player_id));
            if (!cp) return false; // skip players not on current roster

            if (selectedRosterId && selectedRosterId !== 'all') {
                if (!cp.roster_id || String(cp.roster_id) !== String(selectedRosterId)) return false;
            }

            if (selectedPosition && selectedPosition !== 'all') {
                const pos = cp.position || r.position || null;
                if (!pos || String(pos).toUpperCase() !== String(selectedPosition).toUpperCase()) return false;
            }

            // Compute expiration year for filtering
            const firstSeason = r.firstSeasonSeen ? Number(r.firstSeasonSeen) : (r.lastSeasonSeen ? Number(r.lastSeasonSeen) : null);
            const lastKeeper = r.lastKeeperSeason ? Number(r.lastKeeperSeason) : null;
            const keptYears = r.yearsKept || 0;
            let expirationYear = null;
            if (lastKeeper) {
                const remaining = Math.max(0, 3 - keptYears);
                expirationYear = lastKeeper + remaining;
            } else if (firstSeason) {
                expirationYear = firstSeason + 3;
            }

            if (selectedYear && selectedYear !== 'all') {
                if (!expirationYear) return false;
                if (String(expirationYear) !== String(selectedYear)) return false;
            }

            return true;
        });
    }, [keeperMap, currentPlayersMap, selectedRosterId, selectedPosition, selectedYear]);

    // Keep selected filters valid if available options change
    useEffect(() => {
        // if roster selection no longer exists, reset to 'all'
        if (selectedRosterId !== 'all') {
            const exists = rosterOptions.find(r => String(r.id) === String(selectedRosterId));
            if (!exists) setSelectedRosterId('all');
        }
    }, [rosterOptions, selectedRosterId]);

    useEffect(() => {
        // if position selection no longer exists, reset to 'all'
        if (selectedPosition !== 'all') {
            const exists = positionOptions.find(p => String(p).toUpperCase() === String(selectedPosition).toUpperCase());
            if (!exists) setSelectedPosition('all');
        }
    }, [positionOptions, selectedPosition]);

    useEffect(() => {
        // if selected year is gone from the options, reset
        if (selectedYear !== 'all') {
            const exists = yearOptions.find(y => String(y) === String(selectedYear));
            if (!exists) setSelectedYear('all');
        }
    }, [yearOptions, selectedYear]);

    const [playerQuery, setPlayerQuery] = useState('');

    return (
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">Keepers</h2>
            <p className="text-sm text-gray-200 mb-4">Rules: 3 players are to be kept from 3 different positions. Draft year + 2 keeper years for a total of 3 years max. Starting in 2028, <span className="underline decoration-dotted decoration-gray-400 cursor-help" title={"2026 = 1 player kept at round value\n2027 = 2 players kept at round value\n2028 = 3 players kept at round value\nIf you do not have a pick in the assigned round, it will cost -1 round.\nFree Agent keepers are assigned the 10th round."}>F Jon</span> Rule will be completely implemented with draft pick values assigned to players.</p>

            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <div>
                    <label className="text-sm text-gray-100 mr-2">Roster:</label>
                    <select value={selectedRosterId} onChange={e => setSelectedRosterId(e.target.value)} className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {rosterOptions.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-sm text-gray-100 mr-2">Position:</label>
                    <select value={selectedPosition} onChange={e => setSelectedPosition(e.target.value)} className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {positionOptions.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-100 mr-2">Sort by:</label>
                    <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="position">Position order</option>
                        <option value="draftYear">Draft-eligible year</option>
                        <option value="round">Round cost</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-100 mr-2">Year:</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option value="all">All</option>
                        {yearOptions.map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-2 sm:mt-0">
                    <label className="text-sm text-gray-100 mr-2">Search:</label>
                    <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder="Player name" className="bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
            </div>

            <div className="overflow-x-auto bg-gray-800 rounded-lg p-3">
                {rows.length === 0 ? (
                    <div className="py-8 text-center text-gray-300">No keeper data available for current season.</div>
                ) : (
                    <div className="w-full">
                        {/* Determine which teams to show as columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {rosterOptions
                                .filter(r => selectedRosterId === 'all' ? true : String(r.id) === String(selectedRosterId))
                                .map(team => {
                                    const teamPlayers = rows.filter(r => {
                                        const cp = currentPlayersMap.get(String(r.player_id));
                                        if (!cp || String(cp.roster_id) !== String(team.id)) return false;
                                        if (playerQuery && playerQuery.trim()) {
                                            const q = playerQuery.trim().toLowerCase();
                                            const name = (r.player_name || '').toLowerCase();
                                            return name.includes(q);
                                        }
                                        return true;
                                    });
                                    return (
                                        <div key={team.id} className="bg-white/5 border border-gray-700 rounded p-2">
                                            <div className="flex items-center justify-center mb-2">
                                                {team.ownerId && getTeamDetails ? (
                                                    (() => {
                                                        const td = getTeamDetails(team.ownerId, currentSeason);
                                                        const src = td?.avatar || '/LeagueLogo.PNG';
                                                        return (
                                                            <img src={src} alt={`${td?.name || team.name} logo`} className="w-6 h-6 mr-2 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = '/LeagueLogo.PNG'; }} />
                                                        );
                                                    })()
                                                ) : (
                                                    <img src={'/LeagueLogo.PNG'} alt="league logo" className="w-6 h-6 mr-2 object-contain" />
                                                )}
                                                <div className="font-semibold text-yellow-300 text-center text-gray-100 text-sm">{team.name}</div>
                                            </div>
                                            <div className="space-y-1">
                                                {teamPlayers.length === 0 ? (
                                                    <div className="text-sm text-gray-400">No players</div>
                                                ) : (
                                                    (() => {
                                                        const posOrder = ['QB','RB','WR','TE','K','DEF'];
                                                        const sorted = teamPlayers.slice().sort((a,b) => {
                                                            if (sortMode === 'draftYear') {
                                                                // compute expiration year: prefer lastKeeperSeason (plus remaining) else firstSeason+3
                                                                const computeExpiration = (r) => {
                                                                    const firstSeason = r.firstSeasonSeen ? Number(r.firstSeasonSeen) : (r.lastSeasonSeen ? Number(r.lastSeasonSeen) : null);
                                                                    const lastKeeper = r.lastKeeperSeason ? Number(r.lastKeeperSeason) : null;
                                                                    const keptYears = r.yearsKept || 0;
                                                                    let expirationYear = null;
                                                                    if (lastKeeper) {
                                                                        const remaining = Math.max(0, 3 - keptYears);
                                                                        expirationYear = lastKeeper + remaining;
                                                                    } else if (firstSeason) {
                                                                        expirationYear = firstSeason + 3;
                                                                    }
                                                                    return expirationYear === null ? 9999 : Number(expirationYear);
                                                                };

                                                                const aYear = computeExpiration(a);
                                                                const bYear = computeExpiration(b);
                                                                if (aYear !== bYear) return aYear - bYear;
                                                                // fallback to position order and name
                                                            }
                                                            if (sortMode === 'round') {
                                                                // compute assigned round for each (originalRound - yearsKept, min 1). Missing original round goes last.
                                                                const aOrig = a.originalDraftRound ? Number(a.originalDraftRound) : null;
                                                                const bOrig = b.originalDraftRound ? Number(b.originalDraftRound) : null;
                                                                const aAssigned = aOrig ? Math.max(1, aOrig - (a.yearsKept || 0)) : 9999;
                                                                const bAssigned = bOrig ? Math.max(1, bOrig - (b.yearsKept || 0)) : 9999;
                                                                if (aAssigned !== bAssigned) return aAssigned - bAssigned;
                                                                // fallback to position and name
                                                            }
                                                            const aPos = (currentPlayersMap.get(String(a.player_id))?.position || (nflPlayers && nflPlayers[a.player_id]?.position) || '').toUpperCase();
                                                            const bPos = (currentPlayersMap.get(String(b.player_id))?.position || (nflPlayers && nflPlayers[b.player_id]?.position) || '').toUpperCase();
                                                            const ai = posOrder.indexOf(aPos) === -1 ? 999 : posOrder.indexOf(aPos);
                                                            const bi = posOrder.indexOf(bPos) === -1 ? 999 : posOrder.indexOf(bPos);
                                                            if (ai !== bi) return ai - bi;
                                                            return (a.player_name || '').localeCompare(b.player_name || '');
                                                        });

                                                        return sorted.map(r => {
                                                            const cp = currentPlayersMap.get(String(r.player_id));
                                                            const pos = (cp?.position || (nflPlayers && nflPlayers[r.player_id]?.position) || '').toUpperCase();
                                                            const teamAbbr = nflPlayers && nflPlayers[r.player_id] ? nflPlayers[r.player_id].team : '';

                                                            // Resolve display name for defenses that show up as Unknown
                                                            let displayName = r.player_name || '';
                                                            if ((!displayName || displayName.toLowerCase().includes('unknown')) && pos === 'DEF') {
                                                                if (teamAbbr) displayName = `${teamAbbr} DEF`;
                                                                else {
                                                                    let foundTeam = null;
                                                                    const seasons = Object.keys(historicalData?.draftPicksBySeason || {}).map(s => Number(s)).sort((a,b)=>a-b);
                                                                    for (const s of seasons) {
                                                                        const picks = historicalData.draftPicksBySeason[s] || [];
                                                                        const pick = picks.find(p => String(p.player_id) === String(r.player_id));
                                                                        if (pick) {
                                                                            foundTeam = pick.metadata?.team || pick.player_team || null;
                                                                            if (foundTeam) break;
                                                                        }
                                                                    }
                                                                    if (foundTeam) displayName = `${foundTeam} DEF`;
                                                                    else displayName = 'Unknown Defense';
                                                                }
                                                            }

                                                            const firstSeason = r.firstSeasonSeen ? Number(r.firstSeasonSeen) : (r.lastSeasonSeen ? Number(r.lastSeasonSeen) : null);
                                                            const lastKeeper = r.lastKeeperSeason ? Number(r.lastKeeperSeason) : null;
                                                            const keptYears = r.yearsKept || 0;
                                                            let expirationYear = null;
                                                            if (lastKeeper) {
                                                                const remaining = Math.max(0, 3 - keptYears);
                                                                expirationYear = lastKeeper + remaining;
                                                            } else if (firstSeason) {
                                                                expirationYear = firstSeason + 3;
                                                            }

                                                            // Assigned round for the next keep (simple heuristic): originalRound - yearsKept (min 1).
                                                            const originalRound = r.originalDraftRound ? Number(r.originalDraftRound) : null;
                                                            const assignedRound = originalRound ? Math.max(1, originalRound - (r.yearsKept || 0)) : null;

                                                            let containerClass = 'bg-gray-900 border-gray-800';
                                                            let nameClass = 'text-gray-100';
                                                            let expirationClass = 'text-gray-200';

                                                            if (keptYears >= 2) {
                                                                containerClass = 'bg-red-900/10 border-red-500';
                                                                nameClass = 'text-red-200 font-medium';
                                                                expirationClass = 'text-red-300';
                                                            } else if (keptYears === 1) {
                                                                containerClass = 'bg-yellow-900/10 border-yellow-500';
                                                                nameClass = 'text-yellow-200 font-medium';
                                                                expirationClass = 'text-yellow-300';
                                                            }

                                                            const nfl = nflPlayers ? nflPlayers[r.player_id] : null;
                                                            const smallPos = nfl?.position || (cp?.position || '');
                                                            const smallTeam = teamAbbr || nfl?.team || '';

                                                            return (
                                                                <div key={r.player_id} className={`flex justify-between items-center p-1 rounded border ${containerClass}`}>
                                                                    {/* Left: flexible name block that can wrap or truncate */}
                                                                    <div className={`min-w-0 flex-1 text-sm text-left ${nameClass}`}>
                                                                        <div className="break-words sm:truncate">
                                                                            <span className="block">{displayName}</span>
                                                                            {(smallPos || smallTeam) && (
                                                                                <span className="block mt-1 text-[10px] text-gray-400 dark:text-gray-500">{smallPos ? `${smallPos}` : ''}{smallPos && smallTeam ? ` • ${smallTeam}` : smallTeam ? `${smallTeam}` : ''}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Right: fixed narrow column for year/pick info */}
                                                                    <div className="ml-3 flex-shrink-0 w-16 text-xs text-right">
                                                                        <div className={`font-semibold ${expirationClass}`}>{expirationYear || '—'}</div>
                                                                        {/* If we have draft picks for the expiration year, attempt to resolve exact pick; otherwise show Round Cost */}
                                                                        {expirationYear && assignedRound ? (
                                                                            (historicalData && historicalData.draftPicksBySeason && historicalData.draftPicksBySeason[expirationYear] && historicalData.draftPicksBySeason[expirationYear].length > 0) ? (() => {
                                                                                const seasonPicks = historicalData.draftPicksBySeason[expirationYear] || [];
                                                                                // Try to find a pick in the assigned round that belongs to this roster or owner
                                                                                const resolved = seasonPicks.find(p => Number(p.round) === Number(assignedRound) && (
                                                                                    String(p.roster_id) === String(team.id) ||
                                                                                    String(p.picked_by) === String(team.id) ||
                                                                                    String(p.picked_by) === String(team.ownerId) ||
                                                                                    String(p.roster_id) === String(team.ownerId)
                                                                                ));
                                                                                if (resolved) {
                                                                                    // Use the resolver to prefer traded/owned picks and fallback to earlier rounds
                                                                                    const res = resolveKeeperPick(historicalData, team.ownerId || team.id, expirationYear, assignedRound);
                                                                                    return <div className="text-[10px] text-gray-300 mt-1 break-words">{res.label}</div>;
                                                                                }
                                                                                // If we can't resolve a specific pick, show round cost until picks are finalized or fallback logic is implemented
                                                                                return <div className="text-[10px] text-gray-400 mt-1">{`Round Cost: R${assignedRound}`}</div>;
                                                                            })() : (
                                                                                <div className="text-[10px] text-gray-400 mt-1">{`Round Cost: R${assignedRound}`}</div>
                                                                            )
                                                                        ) : (
                                                                            <div className="text-[10px] text-gray-400 mt-1">Round Cost: —</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
