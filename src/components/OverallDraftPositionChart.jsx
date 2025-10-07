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

const OverallDraftPositionChart = ({ allDraftHistory = [], totalRounds = 12, totalTeams = 12 }) => {
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
            POSITIONS.forEach(p => {
                out[p] = totalKnown > 0 ? ((r[p] || 0) / totalKnown * 100) : 0;
            });
            out.__unknown = r.__unknown || 0;
            return out;
        });
    }, [picks, totalRounds]);

    return (
        <section className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 border-b pb-2">Draft Position Mix (All-Time)</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">Percent of picks by position per round (all seasons)</p>

                <div className="w-full h-72 mt-2" style={{ minHeight: 288 }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                        <BarChart data={positionByRoundData} margin={{ top: 8, right: 16, left: 8, bottom: 35 }}>
                            <XAxis dataKey="round" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={50} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={40} />
                            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} wrapperStyle={{ fontSize: 11 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
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
