// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacements for the draft board rendering in DraftAnalysis.jsx
// and a restyled OverallDraftPositionChart.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useEffect } from 'react';
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRepeat } from '@fortawesome/free-solid-svg-icons';

// ─── CSS injected once ───────────────────────────────────────────────────────
const BOARD_CSS = `
/* Draft board ─ design tokens */
:root {
  --db-bg:          #0d1117;
  --db-surface:     #161b22;
  --db-border:      rgba(255,255,255,0.07);
  --db-round-col:   #1c2333;
  --db-header-bg:   #1c2333;
  --db-text-dim:    rgba(255,255,255,0.45);
  --db-text-mid:    rgba(255,255,255,0.75);
  --db-text-full:   #ffffff;
  --db-accent:      #58a6ff;

  /* position palette */
  --pos-QB: #f85149;
  --pos-RB: #3fb950;
  --pos-WR: #388bfd;
  --pos-TE: #d29922;
  --pos-K:  #8957e5;
  --pos-DEF:#e3b341;
  --pos-default: #484f58;
}

/* ── Grid wrapper ── */
.db-grid {
  display: grid;
  gap: 3px;
  font-family: 'DM Mono', 'Fira Code', ui-monospace, monospace;
}

/* ── Header cell (team name) ── */
.db-header {
  background: var(--db-header-bg);
  border: 1px solid var(--db-border);
  border-radius: 6px 6px 0 0;
  padding: 8px 6px;
  text-align: center;
  color: var(--db-accent);
  font-family: 'Inter', 'DM Sans', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.3;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Round label ── */
.db-round-label {
  background: var(--db-round-col);
  border: 1px solid var(--db-border);
  border-radius: 4px;
  color: var(--db-text-dim);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
}

/* ── Pick card ── */
.db-card {
  position: relative;
  border-radius: 5px;
  border: 1px solid var(--db-border);
  min-height: 88px;
  display: flex;
  flex-direction: column;
  padding: 6px 7px 5px;
  gap: 2px;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  cursor: default;
}
.db-card:hover {
  border-color: rgba(255,255,255,0.22);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.45);
  z-index: 10;
}

/* position-tinted left accent bar */
.db-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--pos-color, var(--pos-default));
  border-radius: 5px 0 0 5px;
}

/* ── Card internals ── */
.db-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: 6px;
}
.db-pos-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--pos-color, var(--pos-default));
  text-transform: uppercase;
}
.db-nfl-team {
  font-size: 9px;
  color: var(--db-text-dim);
  letter-spacing: 0.04em;
  font-weight: 600;
}

.db-card-name {
  margin-left: 6px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-height: 0;
}
.db-first-name {
  font-size: 9.5px;
  color: var(--db-text-mid);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Inter', system-ui, sans-serif;
}
.db-last-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--db-text-full);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Inter', system-ui, sans-serif;
  letter-spacing: -0.01em;
}

.db-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-left: 6px;
  margin-top: auto;
}

/* VORP value chip */
.db-vorp {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.03em;
  line-height: 1.6;
  min-width: 32px;
  text-align: center;
  font-family: 'DM Mono', monospace;
}
.db-vorp.pos  { background: rgba(63,185,80,0.18); color: #3fb950; }
.db-vorp.neg  { background: rgba(248,81,73,0.18);  color: #f85149; }

/* traded icon */
.db-traded-icon {
  color: #d29922;
  font-size: 10px;
}

/* keeper cell */
.db-keeper {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(63,185,80,0.12), rgba(63,185,80,0.04));
  border-color: rgba(63,185,80,0.25) !important;
  min-height: 88px;
}
.db-keeper-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #3fb950;
  text-transform: uppercase;
}

/* empty cell */
.db-empty {
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.06);
  border-radius: 5px;
  min-height: 88px;
}
`;

// ── Position colour map ──────────────────────────────────────────────────────
const POS_CSS_VAR = {
    QB: 'var(--pos-QB)', RB: 'var(--pos-RB)',
    WR: 'var(--pos-WR)', TE: 'var(--pos-TE)',
    K:  'var(--pos-K)',  DEF:'var(--pos-DEF)',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function splitName(fullName = '', position = '') {
    if (position === 'DEF') return { first: '', last: fullName || 'DEF' };
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { first: '', last: parts[0] };
    return { first: parts[0], last: parts.slice(1).join(' ') };
}

function fmtVorp(v) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return (v >= 0 ? '+' : '') + v.toFixed(1);
}

// ── DraftPickCard ─────────────────────────────────────────────────────────────
function DraftPickCard({ pick, isTradedPickForPlayer }) {
    if (!pick) return <div className="db-empty" />;

    if (pick.is_keeper) {
        return (
            <div className="db-card db-keeper">
                <span className="db-keeper-label">Keeper</span>
            </div>
        );
    }

    const pos = (pick.player_position || '').toUpperCase();
    const posColor = POS_CSS_VAR[pos] || 'var(--pos-default)';
    const { first, last } = splitName(pick.player_name, pos);
    const vorpVal = pick.scaled_vorp_delta;
    const vorpStr = fmtVorp(vorpVal);
    const vorpClass = typeof vorpVal === 'number' ? (vorpVal >= 0 ? 'pos' : 'neg') : '';

    return (
        <div className="db-card" style={{ '--pos-color': posColor, background: '#161b22' }}>
            {/* top row: position badge + NFL team */}
            <div className="db-card-meta">
                <span className="db-pos-badge">{pos}</span>
                <span className="db-nfl-team">{pick.player_team || ''}</span>
            </div>

            {/* name block */}
            <div className="db-card-name">
                {first && <span className="db-first-name">{first}</span>}
                <span className="db-last-name">{last}</span>
            </div>

            {/* footer: vorp + traded icon */}
            <div className="db-card-footer">
                {vorpStr ? (
                    <span className={`db-vorp ${vorpClass}`}>{vorpStr}</span>
                ) : (
                    <span />
                )}
                {isTradedPickForPlayer && (
                    <FontAwesomeIcon
                        icon={faRepeat}
                        className="db-traded-icon"
                        title={`Pick acquired by: ${pick.picked_by_team_name || ''}`}
                    />
                )}
            </div>
        </div>
    );
}

// ── DraftBoardGrid ────────────────────────────────────────────────────────────
export function DraftBoardGrid({
    orderedTeamColumns,
    roundsArray,
    picksGroupedByRound,
    draftSummary,
    historicalData,
    selectedSeason,
    tradedPicksLookup,
    getTeamName,
    getUserIdFromRosterId,
}) {
    // inject CSS once
    useEffect(() => {
        if (document.getElementById('db-styles')) return;
        const el = document.createElement('style');
        el.id = 'db-styles';
        el.textContent = BOARD_CSS;
        document.head.appendChild(el);
        return () => el.remove();
    }, []);

    const totalTeams = draftSummary?.settings?.teams || 12;
    const cols = orderedTeamColumns.length;

    return (
        <div className="w-full overflow-x-auto pb-4">
            <div
                className="db-grid"
                style={{
                    gridTemplateColumns: `48px repeat(${cols}, minmax(108px, 1fr))`,
                    minWidth: `${48 + cols * 110}px`,
                }}
            >
                {/* ── Header row ── */}
                <div className="db-header" style={{ background: 'transparent', border: 'none', color: 'var(--db-text-dim)', fontSize: 10, letterSpacing: '0.1em' }}>
                    RND
                </div>
                {orderedTeamColumns.map(team => (
                    <div key={team.userId} className="db-header">
                        {team.teamName}
                    </div>
                ))}

                {/* ── Data rows ── */}
                {roundsArray.map(round => (
                    <React.Fragment key={round}>
                        {/* round label */}
                        <div className="db-round-label">{round}</div>

                        {/* pick cards */}
                        {orderedTeamColumns.map((_, colIndex) => {
                            const pick = picksGroupedByRound[round]?.[colIndex];

                            // traded-pick detection (same logic as original)
                            const origSlot = round % 2 !== 0 ? colIndex + 1 : totalTeams - colIndex;
                            let origOwnerUserId = null;
                            for (const uid in draftSummary.draft_order) {
                                if (draftSummary.draft_order[uid] === origSlot) { origOwnerUserId = uid; break; }
                            }
                            let tradedPickInfo = null;
                            if (origOwnerUserId && pick && pick.picked_by !== origOwnerUserId) {
                                const origRoster = historicalData.rostersBySeason?.[selectedSeason]?.find(
                                    r => String(r.owner_id) === String(origOwnerUserId)
                                );
                                const origRosterId = origRoster ? String(origRoster.roster_id) : null;
                                if (origRosterId) tradedPickInfo = tradedPicksLookup.get(round)?.get(origRosterId);
                            }
                            const isTradedPickForPlayer = !!(pick && origOwnerUserId && pick.picked_by !== origOwnerUserId && tradedPickInfo);

                            return (
                                <DraftPickCard
                                    key={`${round}-${colIndex}`}
                                    pick={pick}
                                    isTradedPickForPlayer={isTradedPickForPlayer}
                                />
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

// ── OverallDraftPositionChart (restyled) ─────────────────────────────────────
const POSITIONS = ['QB','RB','WR','TE','K','DEF'];
const POS_COLORS = {
    QB: '#f85149', RB: '#3fb950', WR: '#388bfd',
    TE: '#d29922', K: '#8957e5', DEF: '#e3b341',
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#1c2333',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            fontFamily: 'DM Mono, monospace',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em' }}>
                ROUND {label}
            </div>
            {payload.slice().reverse().map(entry => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.fill, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', minWidth: 28 }}>{entry.name}</span>
                    <span style={{ color: '#fff', fontWeight: 700, marginLeft: 'auto', paddingLeft: 16 }}>
                        {Number(entry.value || 0).toFixed(1)}%
                    </span>
                </div>
            ))}
        </div>
    );
};

export const OverallDraftPositionChart = ({ allDraftHistory = [], totalRounds = 12, compact = false }) => {
    const picks = useMemo(() => Array.isArray(allDraftHistory) ? allDraftHistory.filter(Boolean) : [], [allDraftHistory]);

    const chartData = useMemo(() => {
        const maxRound = picks.reduce((acc, p) => Math.max(acc, Number(p.round) || 0), 0);
        const effectiveRounds = Math.max(totalRounds, maxRound) || 12;
        const rounds = Array.from({ length: effectiveRounds }, (_, i) => ({ round: i + 1, __total: 0 }));

        picks.forEach(p => {
            const rnd = Number(p.round) || null;
            if (!rnd || rnd < 1 || rnd > effectiveRounds) return;
            const posRaw = (p.position || p.player_position || p.metadata?.position || '').toString().toUpperCase();
            const pos = POSITIONS.includes(posRaw) ? posRaw : null;
            if (!pos) return;
            const idx = rnd - 1;
            rounds[idx][pos] = (rounds[idx][pos] || 0) + 1;
            rounds[idx].__total += 1;
        });

        return rounds.map(r => {
            const total = r.__total || 0;
            const out = { round: r.round };
            let sum = 0;
            POSITIONS.forEach(p => {
                const pct = total > 0 ? (r[p] || 0) / total * 100 : 0;
                out[p] = Number(pct.toFixed(2));
                sum += out[p];
            });
            if (sum > 100) {
                const biggest = POSITIONS.reduce((a, b) => (out[a] > out[b] ? a : b));
                out[biggest] = Math.max(0, out[biggest] - (sum - 100));
            }
            return out;
        });
    }, [picks, totalRounds]);

    const h = compact ? 200 : 280;

    return (
        <div style={{ width: '100%', height: h, fontFamily: 'DM Mono, monospace' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: compact ? 18 : 24 }}
                    barCategoryGap="18%"
                >
                    <XAxis
                        dataKey="round"
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                        interval={0}
                        label={compact ? undefined : {
                            value: 'Round', position: 'insideBottom', offset: -10,
                            fill: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.1em',
                        }}
                    />
                    <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tickFormatter={v => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    {!compact && (
                        <Legend
                            iconType="square"
                            iconSize={8}
                            wrapperStyle={{
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.6)',
                                fontFamily: 'DM Mono, monospace',
                                paddingBottom: 4,
                            }}
                        />
                    )}
                    {POSITIONS.map(pos => (
                        <Bar
                            key={pos}
                            dataKey={pos}
                            stackId="a"
                            fill={POS_COLORS[pos]}
                            radius={pos === 'DEF' ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>

            {/* compact legend inline */}
            {compact && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    {POSITIONS.map(pos => (
                        <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'DM Mono, monospace' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: POS_COLORS[pos], display: 'inline-block' }} />
                            {pos}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OverallDraftPositionChart;