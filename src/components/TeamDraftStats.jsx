import React, { useMemo } from 'react';
import { buildHeatmap, computeOwnerPickSummaries } from '../utils/analytics';
import { useSleeperData } from '../contexts/SleeperDataContext';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Cell
} from 'recharts';

const TeamDraftStats = ({ ownerId, allDraftHistory = [], totalRounds = 12, totalTeams = 12 }) => {
    // Access context to resolve roster -> owner mapping and player positions when needed
    const { historicalData, nflPlayers } = useSleeperData();

    // Helper: map roster_id -> owner_id per season for quick lookup
    const rosterToOwnerBySeason = useMemo(() => {
        const map = {};
        if (historicalData && historicalData.rostersBySeason) {
            Object.keys(historicalData.rostersBySeason).forEach(season => {
                const rosters = historicalData.rostersBySeason[season] || [];
                map[season] = {};
                rosters.forEach(r => { if (r && r.roster_id) map[season][String(r.roster_id)] = String(r.owner_id); });
            });
        }
        return map;
    }, [historicalData]);

    // Filter picks for this owner across seasons (robust to different pick shapes)
    const myPicks = useMemo(() => {
        if (!Array.isArray(allDraftHistory)) return [];
        return allDraftHistory.filter(p => {
            if (!p) return false;
            // direct owner field
            if (p.picked_by && String(p.picked_by) === String(ownerId)) return true;
            if (p.owner_id && String(p.owner_id) === String(ownerId)) return true;
            // roster_id with season mapping
            const seasonKey = p.season || p.year || p.draft_season || (p.draft && p.draft.season) || null;
            const rosterId = p.roster_id || p.rosterId || p.picked_from_roster_id || null;
            if (rosterId && seasonKey && rosterToOwnerBySeason[seasonKey]) {
                const mappedOwner = rosterToOwnerBySeason[seasonKey][String(rosterId)];
                if (mappedOwner && String(mappedOwner) === String(ownerId)) return true;
            }
            return false;
        });
    }, [allDraftHistory, ownerId, rosterToOwnerBySeason]);

    // No debug logs in production; keep component quiet unless a consumer explicitly wraps it for debugging.

    const ownerSummary = useMemo(() => computeOwnerPickSummaries(myPicks), [myPicks]);
    const heatmap = useMemo(() => buildHeatmap(myPicks, totalRounds, totalTeams), [myPicks, totalRounds, totalTeams]);

    const favoriteRounds = Object.entries(ownerSummary.roundCounts || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([round, count]) => `${round} (${count})`)
        .join(', ');

    // Positions we'll display (order matters for stack order)
    // Only include core positions in the chart (drop OTHER)
    const POSITIONS = ['QB','RB','WR','TE','K','DEF'];
    const POSITION_COLORS = {
        QB: '#ef4444', // red
        RB: '#f59e0b', // amber
        WR: '#34d399', // green
        TE: '#60a5fa', // blue
        K: '#a78bfa', // purple
        DEF: '#f97316' // orange
    };

    // Build per-round position percentages for the stacked bar chart using all-time picks
    const positionByRoundData = useMemo(() => {
        // Determine the maximum round seen in the data so we show all historical rounds
        const maxRoundSeen = myPicks.reduce((acc, p) => {
            const rnd = Number(p.round) || Number(p.draft_round) || 0;
            return Math.max(acc, isFinite(rnd) ? rnd : 0);
        }, 0);

        const effectiveRounds = Math.max(totalRounds || 0, maxRoundSeen || 0) || 0;

        // Initialize rounds
        const rounds = Array.from({ length: effectiveRounds }, (_, i) => ({ round: i + 1 }));

        // Aggregate counts per round across all-time picks
        myPicks.forEach(p => {
            const rnd = Number(p.round) || Number(p.draft_round) || null;
            // Resolve position robustly: pick fields first, then nflPlayers lookup by player_id
            let posRaw = (p.position || p.player_position || p.metadata?.position) || null;
            if (!posRaw && p.player_id && nflPlayers && nflPlayers[p.player_id]) {
                // read values into a temporary variable instead of reassigning constants
                const playerInfo = nflPlayers[p.player_id] || {};
                posRaw = playerInfo.position || playerInfo.primary_position || null;
            }
            posRaw = (posRaw || 'OTHER');
            // ensure toUpperCase exists before calling
            if (typeof posRaw === 'string') posRaw = posRaw.toUpperCase(); else posRaw = 'OTHER';
            const pos = POSITIONS.includes(posRaw) ? posRaw : null; // ignore unknown positions for chart
            if (!rnd || rnd < 1 || rnd > effectiveRounds) return;
            const idx = rnd - 1;
            if (pos) {
                rounds[idx][pos] = (rounds[idx][pos] || 0) + 1;
                rounds[idx].__total = (rounds[idx].__total || 0) + 1; // total of known positions
            } else {
                // track unknown picks separately if needed (not used for chart)
                rounds[idx].__unknown = (rounds[idx].__unknown || 0) + 1;
            }
        });

        // Convert counts to percentages relative to known-position totals
        return rounds.map(r => {
            const totalKnown = r.__total || 0;
            const out = { round: r.round };
            POSITIONS.forEach(p => {
                out[p] = totalKnown > 0 ? ((r[p] || 0) / totalKnown * 100) : 0;
            });
            // expose unknown count for debugging/tooltip if needed
            out.__unknown = r.__unknown || 0;
            return out;
        });
    }, [myPicks, totalRounds]);

    return (
        <section className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Draft Habits</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">Round-by-Round Position Mix (percent)</p>
                
                {/* Mobile: Optimized chart layout */}
                <div className="sm:hidden w-full h-72 mt-2" style={{ minHeight: '288px' }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                        <BarChart 
                            data={positionByRoundData} 
                            margin={{ top: 8, right: 8, left: 8, bottom: 35 }}
                        >
                            <XAxis 
                                dataKey="round" 
                                tick={{ fontSize: 10 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={50}
                            />
                            <YAxis 
                                domain={[0, 100]} 
                                tick={{ fontSize: 10 }} 
                                unit="%" 
                                width={35}
                            />
                            <Tooltip 
                                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                                wrapperStyle={{ fontSize: 11 }}
                            />
                            <Legend 
                                wrapperStyle={{ fontSize: 10 }}
                                iconSize={8}
                                layout="horizontal"
                                align="center"
                                verticalAlign="bottom"
                                height={30}
                            />
                            {POSITIONS.map(pos => (
                                <Bar key={pos} dataKey={pos} stackId="a" fill={POSITION_COLORS[pos]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Desktop: Original layout */}
                <div className="hidden sm:block w-full h-64 mt-2" style={{ minHeight: '256px' }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                        <BarChart data={positionByRoundData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                            <XAxis dataKey="round" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} />
                            <Legend />
                            {POSITIONS.map(pos => (
                                <Bar key={pos} dataKey={pos} stackId="a" fill={POSITION_COLORS[pos]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="mt-3" />
            </div>
        </section>
    );
};

export default TeamDraftStats;
