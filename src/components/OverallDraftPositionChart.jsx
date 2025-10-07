import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';

// A small, self-contained component that builds a round-by-round stacked percent
// chart of positions taken across all drafts (not per-team). It mirrors the
// logic from TeamDraftStats but uses the provided allDraftHistory input.

const OverallDraftPositionChart = ({ allDraftHistory = [], totalRounds = 12, totalTeams = 12, compact = false }) => {
    const POSITIONS = ['QB','RB','WR','TE','K','DEF'];
    const POSITION_COLORS = {
        QB: '#ef4444', // red
        RB: '#f59e0b', // amber
        WR: '#34d399', // green
        TE: '#60a5fa', // blue
        K: '#a78bfa', // purple
        DEF: '#f97316' // orange
    };

    const picks = useMemo(() => Array.isArray(allDraftHistory) ? allDraftHistory.filter(Boolean) : [], [allDraftHistory]);

    const positionByRoundData = useMemo(() => {
        // Determine maximum round from data
        const maxRoundSeen = picks.reduce((acc, p) => {
            const rnd = Number(p.round) || Number(p.draft_round) || 0;
            return Math.max(acc, isFinite(rnd) ? rnd : 0);
        }, 0);

        const effectiveRounds = Math.max(totalRounds || 0, maxRoundSeen || 0) || 0;
        const rounds = Array.from({ length: effectiveRounds }, (_, i) => ({ round: i + 1 }));

        picks.forEach(p => {
            const rnd = Number(p.round) || Number(p.draft_round) || null;
            let posRaw = (p.position || p.player_position || p.metadata?.position) || null;
            if (typeof posRaw === 'string') posRaw = posRaw.toUpperCase(); else posRaw = 'OTHER';
            const pos = POSITIONS.includes(posRaw) ? posRaw : null;
            if (!rnd || rnd < 1 || rnd > effectiveRounds) return;
            const idx = rnd - 1;
            if (pos) {
                rounds[idx][pos] = (rounds[idx][pos] || 0) + 1;
                rounds[idx].__total = (rounds[idx].__total || 0) + 1;
            } else {
                rounds[idx].__unknown = (rounds[idx].__unknown || 0) + 1;
            }
        });

        return rounds.map(r => {
            const totalKnown = r.__total || 0;
            const out = { round: r.round };

            // Build raw percentages (not yet rounded) from counts
            const rawPerc = {};
            POSITIONS.forEach(p => {
                rawPerc[p] = totalKnown > 0 ? ((r[p] || 0) / totalKnown * 100) : 0;
            });

            // Sum and normalize tiny floating point error: if the sum exceeds 100 by a tiny amount,
            // subtract the excess from the largest bucket so the stacked bars never exceed 100%.
            let sum = POSITIONS.reduce((s, p) => s + (Number.isFinite(rawPerc[p]) ? rawPerc[p] : 0), 0);
            if (sum > 100) {
                const excess = sum - 100;
                // find position with largest value
                let largestPos = POSITIONS[0];
                for (const p of POSITIONS) {
                    if ((rawPerc[p] || 0) > (rawPerc[largestPos] || 0)) largestPos = p;
                }
                rawPerc[largestPos] = Math.max(0, (rawPerc[largestPos] || 0) - excess);
                // recompute sum for safety
                sum = POSITIONS.reduce((s, p) => s + (Number.isFinite(rawPerc[p]) ? rawPerc[p] : 0), 0);
            }

            // Store rounded values (3 decimals) as numbers for charting
            POSITIONS.forEach(p => {
                const raw = Number.isFinite(rawPerc[p]) ? rawPerc[p] : 0;
                out[p] = Number(Math.max(0, Math.min(100, raw)).toFixed(3));
            });

            out.__unknown = r.__unknown || 0;
            return out;
        });
    }, [picks, totalRounds]);

    const containerHeight = compact ? 180 : 260;

    return (
        <section className={compact ? 'mb-2 sm:mb-4' : 'mb-4 sm:mb-6'}>
            <div className="w-full">
                <div className={`w-full ${compact ? 'h-48' : 'h-72'} mt-0`} style={{ minHeight: containerHeight }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={containerHeight}>
                        <BarChart data={positionByRoundData} margin={{ top: 6, right: 4, left: 4, bottom: compact ? 12 : 18 }}>
                            <XAxis dataKey="round" tick={{ fontSize: compact ? 9 : 10, fill: '#ffffff' }} interval={0} angle={compact ? -25 : -30} textAnchor="end" height={compact ? 30 : 36} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                            <YAxis domain={[0, 100]} ticks={[0,25,50,75,100]} tick={{ fontSize: compact ? 9 : 10, fill: '#ffffff' }} width={compact ? 30 : 36} tickFormatter={(v) => `${Math.round(Number(v) || 0)}%`} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                            <Tooltip formatter={(value, name) => {
                                const num = Number(value) || 0;
                                const safe = Math.max(0, Math.min(100, num));
                                const display = (100 - safe) < 0.01 ? 100 : Number(safe.toFixed(1));
                                return [`${display}%`, name];
                            }} wrapperStyle={{ fontSize: 11 }} />
                            {/* legend text color white */}
                            {!compact && <Legend wrapperStyle={{ fontSize: 12, color: '#ffffff' }} iconSize={10} layout="horizontal" verticalAlign="top" align="right" />}
                            {POSITIONS.map(pos => (
                                <Bar key={pos} dataKey={pos} stackId="a" fill={POSITION_COLORS[pos]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};

export default OverallDraftPositionChart;
