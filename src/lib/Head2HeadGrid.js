// src/lib/Head2HeadGrid.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Area, ResponsiveContainer, Customized, ComposedChart, BarChart, Bar, Cell } from 'recharts';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { formatScore } from '../utils/formatUtils';

// ── Helpers (untouched) ───────────────────────────────────────────────────────

const renderRecord = (record) => {
    if (!record) return '0-0-0';
    return `${record.wins || 0}-${record.losses || 0}-${record.ties || 0}`;
};

const getOrdinalSuffix = (i) => {
    const j = i % 10, k = i % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
};

const calculateRank = (value, allValues, isHigherBetter = true) => {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return 'N/A';
    const sortedValues = [...new Set(allValues.filter(v => v !== null && typeof v !== 'undefined' && !isNaN(v)))].sort((a, b) => isHigherBetter ? b - a : a - b);
    const rank = sortedValues.indexOf(value) + 1;
    return rank > 0 ? `${rank}${getOrdinalSuffix(rank)}` : 'N/A';
};

const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

const rgbToHex = (r, g, b) => {
    const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const lerp = (a, b, t) => a + (b - a) * t;

const interpolateColor = (c1, c2, t) => [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
];

const rgbLuminance = (r, g, b) => {
    const srgb = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const computeCellColors = (wins = 0, losses = 0) => {
    const total = wins + losses;
    if (!total) return { background: 'rgba(245,245,245,0.9)', color: '#6b7280', fontWeight: '700' };
    const ratio = wins / total;
    let hex;
    if (ratio === 0.5)       hex = '#ffde57';
    else if (ratio < 0.25)  hex = '#f87171';
    else if (ratio < 0.5)   hex = '#fecaca';
    else if (ratio <= 0.75) hex = '#bbf7d0';
    else                    hex = '#4ade80';
    const [r, g, b] = hexToRgb(hex);
    const bg = `rgb(${r}, ${g}, ${b})`;
    const lum = rgbLuminance(r, g, b);
    let text = lum < 0.5 ? '#FFFFFF' : '#0F172A';
    const lowHex = hex.toLowerCase();
    if (lowHex === '#f87171') text = '#992f2f';
    else if (lowHex === '#fecaca') text = '#b84b4b';
    else if (lowHex === '#ffde57') text = '#8A6F1A';
    else if (lowHex === '#bbf7d0') text = '#22804a';
    else if (lowHex === '#4ade80') text = '#1f6b46';
    return { background: bg, color: text, fontWeight: '700' };
};

// ── Shared style constants ────────────────────────────────────────────────────
const card = "bg-gray-800 border border-white/10 rounded-xl";
const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";
const sectionTitle = "text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 pb-2 border-b border-white/10";

// Dark comparison class mapper — replaces the light bg-green/red/yellow bubbles
const darkComparisonClass = (teamValue, opponentValue, isHigherBetter = true) => {
    if (teamValue === null || opponentValue === null ||
        typeof teamValue === 'undefined' || typeof opponentValue === 'undefined' ||
        isNaN(teamValue) || isNaN(opponentValue)) {
        return 'bg-white/5 text-gray-400';
    }
    if (teamValue === opponentValue) return 'bg-yellow-900/40 text-yellow-300';
    if (isHigherBetter) {
        return teamValue > opponentValue ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300';
    } else {
        return teamValue < opponentValue ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300';
    }
};

// ── Notable Rivalry Card ──────────────────────────────────────────────────────

const RivalryBarCompare = ({ leftVal, rightVal, leftColor = '#10b981', rightColor = '#ef4444' }) => {
    const total = (leftVal || 0) + (rightVal || 0);
    if (!total) return null;
    const leftPct = (leftVal / total) * 100;
    return (
        <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-1">
            <div style={{ width: `${leftPct}%`, background: leftColor, transition: 'width 0.4s ease' }} />
            <div style={{ width: `${100 - leftPct}%`, background: rightColor }} />
        </div>
    );
};

const NotableRivalryCard = ({ title, subtitle, accentColor, statLabel, statValue, teamA, teamB, onSelect }) => {
    const accentBorder = {
        blue:   'border-blue-500/60',
        purple: 'border-purple-500/60',
        amber:  'border-amber-500/60',
        teal:   'border-teal-500/60',
        rose:   'border-rose-500/60',
        indigo: 'border-indigo-500/60',
    }[accentColor] || 'border-blue-500/60';

    const accentText = {
        blue:   'text-blue-400',
        purple: 'text-purple-400',
        amber:  'text-amber-400',
        teal:   'text-teal-400',
        rose:   'text-rose-400',
        indigo: 'text-indigo-400',
    }[accentColor] || 'text-blue-400';

    const accentBg = {
        blue:   'bg-blue-500/10',
        purple: 'bg-purple-500/10',
        amber:  'bg-amber-500/10',
        teal:   'bg-teal-500/10',
        rose:   'bg-rose-500/10',
        indigo: 'bg-indigo-500/10',
    }[accentColor] || 'bg-blue-500/10';

    const totalGamesA = (teamA?.wins || 0) + (teamA?.losses || 0) + (teamA?.ties || 0);
    const totalGamesB = (teamB?.wins || 0) + (teamB?.losses || 0) + (teamB?.ties || 0);

    return (
        <div
            onClick={onSelect}
            className={`${card} border-l-2 ${accentBorder} flex flex-col gap-0 cursor-pointer hover:bg-white/[0.04] transition-all duration-150 overflow-hidden`}
        >
            {/* Title row */}
            <div className="px-4 pt-4 pb-2">
                <div className={`text-sm font-bold text-white leading-tight`}>{title}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{subtitle}</div>
            </div>

            {/* Stat highlight */}
            <div className={`mx-4 mb-3 ${accentBg} border border-white/5 rounded-lg px-3 py-2.5 text-center`}>
                <div className={`text-[10px] font-semibold ${accentText} uppercase tracking-widest mb-0.5`}>{statLabel}</div>
                <div className="text-2xl font-black text-white tracking-tight leading-none">{statValue}</div>
            </div>

            {/* Team A */}
            <div className="px-4 pb-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-200 truncate max-w-[45%]">{teamA?.name}</span>
                    <span className="text-xs font-semibold text-gray-200 truncate max-w-[45%] text-right">{teamB?.name}</span>
                </div>
                {/* Record row */}
                <div className="flex justify-between items-center text-[10px] text-gray-400 mb-0.5">
                    <span className="font-medium">
                        {teamA?.wins || 0}-{teamA?.losses || 0}{teamA?.ties ? `-${teamA.ties}` : ''}{' '}
                        <span className="text-gray-600">({totalGamesA ? Math.round(((teamA?.wins || 0) / totalGamesA) * 100) : 0}%)</span>
                    </span>
                    <span className="text-gray-600 text-[9px] uppercase tracking-wider">Record</span>
                    <span className="font-medium text-right">
                        <span className="text-gray-600">({totalGamesB ? Math.round(((teamB?.wins || 0) / totalGamesB) * 100) : 0}%) </span>
                        {teamB?.wins || 0}-{teamB?.losses || 0}{teamB?.ties ? `-${teamB.ties}` : ''}
                    </span>
                </div>
                <RivalryBarCompare leftVal={teamA?.wins || 0} rightVal={teamB?.wins || 0} />

                {/* Points row */}
                <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2 mb-0.5">
                    <span className="font-medium">
                        {teamA?.ptsFor != null ? formatScore(teamA.ptsFor, 2) : '—'}
                        {teamA?.ppg != null ? <span className="text-gray-600"> ({formatScore(teamA.ppg, 1)})</span> : ''}
                    </span>
                    <span className="text-gray-600 text-[9px] uppercase tracking-wider">Total Pts (PPG)</span>
                    <span className="font-medium text-right">
                        {teamB?.ptsFor != null ? formatScore(teamB.ptsFor, 2) : '—'}
                        {teamB?.ppg != null ? <span className="text-gray-600"> ({formatScore(teamB.ppg, 1)})</span> : ''}
                    </span>
                </div>
                <RivalryBarCompare leftVal={teamA?.ptsFor || 0} rightVal={teamB?.ptsFor || 0} leftColor="#3b82f6" rightColor="#6366f1" />
            </div>

            {/* Footer */}
            <div className="mt-auto px-4 py-2.5 border-t border-white/5 text-center">
                <span className="text-[10px] text-gray-600 font-medium">{teamA?.matchups || 0} Matchups</span>
            </div>
        </div>
    );
};

// ── Team Rivalries Table ──────────────────────────────────────────────────────

const heatCell = (value, min, max, isGood = true) => {
    if (value == null || isNaN(value) || max === min) return { background: 'transparent', color: '#9ca3af' };
    const t = (value - min) / (max - min);
    const clampedT = Math.max(0, Math.min(1, t));
    let r, g, b;
    if (isGood) {
        // red → yellow → green
        if (clampedT < 0.5) {
            r = 239; g = Math.round(lerp(68, 222, clampedT * 2)); b = 68;
        } else {
            r = Math.round(lerp(239, 34, (clampedT - 0.5) * 2)); g = Math.round(lerp(222, 197, (clampedT - 0.5) * 2)); b = Math.round(lerp(68, 94, (clampedT - 0.5) * 2));
        }
    } else {
        if (clampedT < 0.5) {
            r = 34; g = Math.round(lerp(197, 222, clampedT * 2)); b = 94;
        } else {
            r = Math.round(lerp(34, 239, (clampedT - 0.5) * 2)); g = Math.round(lerp(222, 68, (clampedT - 0.5) * 2)); b = Math.round(lerp(94, 68, (clampedT - 0.5) * 2));
        }
    }
    const lum = rgbLuminance(r, g, b);
    const color = lum < 0.4 ? '#fff' : '#0f172a';
    return { background: `rgba(${r},${g},${b},0.85)`, color };
};

const TeamRivalriesTable = ({ selectedOwnerId, headToHeadRecords, getTeamName, sortedDisplayNamesAndOwners, onChangeTeam, onSelectRivalry }) => {
    const [sortCol, setSortCol] = useState('opponent');
    const [sortDir, setSortDir] = useState('asc');

    const rows = useMemo(() => {
        const result = [];
        Object.entries(headToHeadRecords).forEach(([key, rivalry]) => {
            const owners = rivalry.owners || [];
            if (!owners.includes(selectedOwnerId)) return;
            const opponentId = owners.find(o => o !== selectedOwnerId);
            if (!opponentId) return;
            const myRecord = rivalry[selectedOwnerId] || { wins: 0, losses: 0, ties: 0 };
            const totalGames = (myRecord.wins || 0) + (myRecord.losses || 0) + (myRecord.ties || 0);
            if (totalGames === 0) return;

            let myPtsFor = 0, oppPtsFor = 0;
            let matchCount = 0;
            rivalry.allMatches.forEach(m => {
                const isTeam1 = m.team1OwnerId === selectedOwnerId;
                const myScore = isTeam1 ? m.team1Score : m.team2Score;
                const oppScore = isTeam1 ? m.team2Score : m.team1Score;
                if (isNaN(myScore) || isNaN(oppScore) || (myScore === 0 && oppScore === 0)) return;
                myPtsFor += myScore;
                oppPtsFor += oppScore;
                matchCount++;
            });

            const myAvg = matchCount > 0 ? myPtsFor / matchCount : 0;
            const oppAvg = matchCount > 0 ? oppPtsFor / matchCount : 0;
            const ptsMargin = myPtsFor - oppPtsFor;
            const winPct = totalGames > 0 ? ((myRecord.wins || 0) / totalGames) * 100 : 0;
            const avgDiff = matchCount > 0 ? (myPtsFor - oppPtsFor) / matchCount : 0;

            result.push({
                key, opponentId,
                opponentName: getTeamName(opponentId, null),
                ptsForAvg: myAvg,
                ptsAgainstAvg: oppAvg,
                wins: myRecord.wins || 0,
                losses: myRecord.losses || 0,
                ties: myRecord.ties || 0,
                totalPts: myPtsFor,
                ptsMargin,
                winPct,
                avgDiff,
                totalGames,
            });
        });
        return result;
    }, [selectedOwnerId, headToHeadRecords, getTeamName]);

    const sorted = useMemo(() => {
        return [...rows].sort((a, b) => {
            let valA = a[sortCol], valB = b[sortCol];
            if (sortCol === 'opponent') { valA = a.opponentName; valB = b.opponentName; }
            if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return sortDir === 'asc' ? valA - valB : valB - valA;
        });
    }, [rows, sortCol, sortDir]);

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir(col === 'opponent' ? 'asc' : 'desc'); }
    };

    // Range helpers for heat coloring
    const range = (key) => {
        const vals = rows.map(r => r[key]).filter(v => typeof v === 'number' && !isNaN(v));
        return { min: Math.min(...vals), max: Math.max(...vals) };
    };
    const rPtsFAvg = range('ptsForAvg');
    const rPtsAAvg = range('ptsAgainstAvg');
    const rWins = range('wins');
    const rLosses = range('losses');
    const rTotalPts = range('totalPts');
    const rPtsMargin = range('ptsMargin');
    const rWinPct = range('winPct');
    const rAvgDiff = range('avgDiff');

    const SortIcon = ({ col }) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    const colClass = "py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors whitespace-nowrap select-none";

    if (rows.length === 0) {
        return <div className="text-center text-gray-500 text-sm py-6">No rivalry data for this team.</div>;
    }

    return (
        <div className={card}>
            <div className={cardHeader}>
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                </svg>
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Rivalries for <span className="text-white">{getTeamName(selectedOwnerId, null)}</span>
                    </span>
                    <div className="text-[10px] text-gray-600 mt-0.5">Use the button to the right to change the team you want to view the rivalries for.</div>
                </div>
                <button
                    onClick={onChangeTeam}
                    className="flex-shrink-0 px-3 py-1.5 bg-gray-700 border border-white/15 text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-600 hover:text-white transition-colors whitespace-nowrap"
                >
                    Change Team
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10 bg-gray-900/30">
                            <th className={`${colClass} text-left sticky left-0 bg-gray-900/80 z-10`} onClick={() => handleSort('opponent')}>Opponent<SortIcon col="opponent" /></th>
                            <th className={colClass} onClick={() => handleSort('ptsForAvg')}>Pts For Avg<SortIcon col="ptsForAvg" /></th>
                            <th className={colClass} onClick={() => handleSort('ptsAgainstAvg')}>Pts Against Avg<SortIcon col="ptsAgainstAvg" /></th>
                            <th className={colClass} onClick={() => handleSort('wins')}>Wins<SortIcon col="wins" /></th>
                            <th className={colClass} onClick={() => handleSort('losses')}>Losses<SortIcon col="losses" /></th>
                            <th className={colClass} onClick={() => handleSort('totalPts')}>Total Pts<SortIcon col="totalPts" /></th>
                            <th className={colClass} onClick={() => handleSort('ptsMargin')}>Pts Margin<SortIcon col="ptsMargin" /></th>
                            <th className={colClass} onClick={() => handleSort('winPct')}>Win %<SortIcon col="winPct" /></th>
                            <th className={colClass} onClick={() => handleSort('avgDiff')}>Avg Diff<SortIcon col="avgDiff" /></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sorted.map((row) => {
                            const pfStyle = heatCell(row.ptsForAvg, rPtsFAvg.min, rPtsFAvg.max, true);
                            const paStyle = heatCell(row.ptsAgainstAvg, rPtsAAvg.min, rPtsAAvg.max, false);
                            const wStyle = heatCell(row.wins, rWins.min, rWins.max, true);
                            const lStyle = heatCell(row.losses, rLosses.min, rLosses.max, false);
                            const tpStyle = heatCell(row.totalPts, rTotalPts.min, rTotalPts.max, true);
                            const pmStyle = heatCell(row.ptsMargin, rPtsMargin.min, rPtsMargin.max, true);
                            const wpStyle = heatCell(row.winPct, rWinPct.min, rWinPct.max, true);
                            const adStyle = heatCell(row.avgDiff, rAvgDiff.min, rAvgDiff.max, true);
                            return (
                                <tr
                                    key={row.key}
                                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                                    onClick={() => onSelectRivalry(row.key, [selectedOwnerId, row.opponentId])}
                                >
                                    <td className="py-2 px-3 font-semibold text-gray-200 whitespace-nowrap sticky left-0 bg-gray-800 z-10 border-r border-white/5">
                                        {row.opponentName}
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={pfStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {formatScore(row.ptsForAvg, 1)}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={paStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {formatScore(row.ptsAgainstAvg, 1)}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={wStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {row.wins}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={lStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {row.losses}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={tpStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {formatScore(row.totalPts, 0)}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={pmStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {formatScore(row.ptsMargin, 1)}
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={wpStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {Math.round(row.winPct)}%
                                        </div>
                                    </td>
                                    <td className="py-1 px-1">
                                        <div style={adStyle} className="rounded px-2 py-1 text-center tabular-nums font-semibold">
                                            {formatScore(row.avgDiff, 1)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Team picker modal ─────────────────────────────────────────────────────────

const TeamPickerModal = ({ teams, onSelect, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
            className="relative bg-gray-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select a Team</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {teams.map(t => (
                    <button
                        key={t.ownerId}
                        onClick={() => { onSelect(t.ownerId); onClose(); }}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors font-medium"
                    >
                        {t.displayName}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const Head2HeadGrid = () => {
    const {
        loading: contextLoading,
        error: contextError,
        historicalData,
        getTeamName,
        getTeamDetails,
        careerDPRData,
        nflState
    } = useSleeperData();

    const [headToHeadRecords, setHeadToHeadRecords] = useState({});
    const [selectedRivalryKey, setSelectedRivalryKey] = useState(null);
    const [selectedRivalryOwners, setSelectedRivalryOwners] = useState(null);
    const [loading, setLoading] = useState(true);
    const [weeklyHighScoreCounts, setWeeklyHighScoreCounts] = useState({});
    const [teamRivalriesOwnerId, setTeamRivalriesOwnerId] = useState(null);
    const [showTeamPicker, setShowTeamPicker] = useState(false);

    // ── Data processing (untouched) ───────────────────────────────────────────
    useEffect(() => {
        if (contextLoading || contextError) { setLoading(true); return; }
        if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
            setHeadToHeadRecords({});
            setWeeklyHighScoreCounts({});
            setLoading(false);
            return;
        }

        setLoading(true);
        const newHeadToHeadRecords = {};
        const highScoreCounts = {};

        const currentSeason = nflState?.season ? parseInt(nflState.season) : null;
        const currentWeek = nflState?.week ? parseInt(nflState.week) : null;

        Object.entries(historicalData.matchupsBySeason).forEach(([year, matchupsArray]) => {
            const matchupsByWeek = {};
            matchupsArray.forEach(matchup => {
                const matchupWeek = parseInt(matchup.week);
                const matchYear = parseInt(year);
                if (currentSeason) {
                    if (matchYear > currentSeason) return;
                    if (matchYear === currentSeason && currentWeek && matchupWeek >= currentWeek) return;
                }
                if (!matchup.week) return;
                if (!matchupsByWeek[matchup.week]) matchupsByWeek[matchup.week] = [];
                matchupsByWeek[matchup.week].push(matchup);
            });

            Object.entries(matchupsByWeek).forEach(([week, weekMatchups]) => {
                const rostersForYear = historicalData.rostersBySeason?.[year] || [];
                const scores = [];
                weekMatchups.forEach(matchup => {
                    const team1Roster = rostersForYear.find(r => String(r.roster_id) === String(matchup.team1_roster_id));
                    const team2Roster = rostersForYear.find(r => String(r.roster_id) === String(matchup.team2_roster_id));
                    const team1OwnerId = team1Roster?.owner_id;
                    const team2OwnerId = team2Roster?.owner_id;
                    const team1Score = parseFloat(matchup.team1_score);
                    const team2Score = parseFloat(matchup.team2_score);
                    if (team1OwnerId && !isNaN(team1Score)) scores.push({ ownerId: team1OwnerId, score: team1Score });
                    if (team2OwnerId && !isNaN(team2Score)) scores.push({ ownerId: team2OwnerId, score: team2Score });
                });
                if (scores.length === 0) return;
                const maxScore = Math.max(...scores.map(s => s.score));
                const highScorers = scores.filter(s => s.score === maxScore).map(s => s.ownerId);
                highScorers.forEach(ownerId => { highScoreCounts[ownerId] = (highScoreCounts[ownerId] || 0) + 1; });
            });
        });

        Object.entries(historicalData.matchupsBySeason).forEach(([year, matchupsArray]) => {
            const leagueMetadataForYear = historicalData.leaguesMetadataBySeason[year];
            const championshipWeek = leagueMetadataForYear?.settings?.championship_week ? parseInt(leagueMetadataForYear.settings.championship_week) : null;
            const rostersForYear = historicalData.rostersBySeason?.[year] || [];
            const winnersBracketForYear = historicalData.winnersBracketBySeason?.[year] || [];
            const losersBracketForYear = historicalData.losersBracketBySeason?.[year] || [];

            matchupsArray.forEach(matchup => {
                const matchupWeek = parseInt(matchup.week);
                const matchYear = parseInt(year);
                if (currentSeason) {
                    if (matchYear > currentSeason) return;
                    if (matchYear === currentSeason && currentWeek && matchupWeek >= currentWeek) return;
                }

                const team1RosterId = String(matchup.team1_roster_id);
                const team2RosterId = String(matchup.team2_roster_id);
                const team1Score = parseFloat(matchup.team1_score);
                const team2Score = parseFloat(matchup.team2_score);

                if (!team1RosterId || !team2RosterId || team1RosterId === team2RosterId || isNaN(team1Score) || isNaN(team2Score)) return;

                const team1Roster = rostersForYear.find(r => String(r.roster_id) === team1RosterId);
                const team2Roster = rostersForYear.find(r => String(r.roster_id) === team2RosterId);
                const team1OwnerId = team1Roster?.owner_id;
                const team2OwnerId = team2Roster?.owner_id;
                if (!team1OwnerId || !team2OwnerId) return;

                const team1DisplayName = getTeamName(team1OwnerId, year);
                const team2DisplayName = getTeamName(team2OwnerId, year);
                if (team1DisplayName.startsWith('Unknown Team') || team2DisplayName.startsWith('Unknown Team')) return;

                const isTie = team1Score === team2Score;
                const team1Won = team1Score > team2Score;

                let matchType = 'Reg. Season';
                const team1RosterIdStr = String(matchup.team1_roster_id);
                const team2RosterIdStr = String(matchup.team2_roster_id);

                const findBracketMatch = (bracket) => bracket.find(bracketMatch => {
                    const bracketTeams = [String(bracketMatch.t1), String(bracketMatch.t2)].filter(Boolean);
                    const bracketWeek = parseInt(bracketMatch.week);
                    return bracketWeek === matchupWeek && bracketTeams.includes(team1RosterIdStr) && bracketTeams.includes(team2RosterIdStr);
                });

                const winnersMatch = findBracketMatch(winnersBracketForYear);
                const losersMatch = findBracketMatch(losersBracketForYear);

                if (winnersMatch) {
                    if (winnersMatch.p) {
                        const place = winnersMatch.p;
                        if (place === 1) matchType = 'Championship Game';
                        else if (place === 3) matchType = '3rd Place Game';
                        else if (place === 5) matchType = '5th Place Game';
                        else if (place === 7) matchType = '7th Place Game';
                        else if (place === 9) matchType = '9th Place Game';
                        else if (place === 11) matchType = '11th Place Game';
                        else matchType = `${place}th Place Game`;
                    } else if (championshipWeek && matchupWeek === championshipWeek) {
                        matchType = 'Championship Game';
                    } else {
                        matchType = 'Playoffs';
                    }
                } else if (losersMatch) {
                    if (losersMatch.p) {
                        const place = losersMatch.p;
                        if (place === 1) matchType = '7th Place Game';
                        else if (place === 3) matchType = '9th Place Game';
                        else if (place === 5) matchType = '11th Place Game';
                        else matchType = 'Placement Game';
                    } else {
                        matchType = 'Consolation';
                    }
                } else if (matchup.playoff) {
                    matchType = 'Playoffs (Uncategorized)';
                }

                const sortedOwners = [team1OwnerId, team2OwnerId].sort();
                const h2hKey = `${sortedOwners[0]} vs ${sortedOwners[1]}`;

                if (!newHeadToHeadRecords[h2hKey]) {
                    newHeadToHeadRecords[h2hKey] = {
                        owners: sortedOwners,
                        [sortedOwners[0]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                        [sortedOwners[1]]: { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, playoffTies: 0 },
                        allMatches: []
                    };
                }

                const h2hRecord = newHeadToHeadRecords[h2hKey];
                let winnerOwnerId = 'Tie', loserOwnerId = 'Tie';
                if (team1Won) { winnerOwnerId = team1OwnerId; loserOwnerId = team2OwnerId; }
                else if (team2Score > team1Score) { winnerOwnerId = team2OwnerId; loserOwnerId = team1OwnerId; }

                const recordForOwner1 = (team1OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];
                const recordForOwner2 = (team2OwnerId === sortedOwners[0]) ? h2hRecord[sortedOwners[0]] : h2hRecord[sortedOwners[1]];

                const isActualPlayoffGame = matchType.includes('Playoff') || matchType.includes('Championship') || matchType.includes('Consolation');

                if (isTie) {
                    recordForOwner1.ties++; recordForOwner2.ties++;
                    if (isActualPlayoffGame) { recordForOwner1.playoffTies++; recordForOwner2.playoffTies++; }
                } else if (team1Won) {
                    recordForOwner1.wins++; recordForOwner2.losses++;
                    if (isActualPlayoffGame) { recordForOwner1.playoffWins++; recordForOwner2.playoffLosses++; }
                } else {
                    recordForOwner2.wins++; recordForOwner1.losses++;
                    if (isActualPlayoffGame) { recordForOwner2.playoffWins++; recordForOwner1.playoffLosses++; }
                }

                h2hRecord.allMatches.push({
                    year: parseInt(year), week: matchup.week, matchupId: matchup.match_id,
                    team1RosterId, team2RosterId, team1OwnerId, team2OwnerId,
                    team1Score, team2Score, winnerOwnerId, loserOwnerId,
                    winnerDisplayName: winnerOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                    loserDisplayName: loserOwnerId === team1OwnerId ? team1DisplayName : team2DisplayName,
                    winnerScore: winnerOwnerId === team1OwnerId ? team1Score : team2Score,
                    loserScore: loserOwnerId === team1OwnerId ? team1Score : team2Score,
                    isTie, matchType,
                });
            });
        });

        setHeadToHeadRecords(newHeadToHeadRecords);
        setWeeklyHighScoreCounts(highScoreCounts);
        setLoading(false);
    }, [historicalData, getTeamName, contextLoading, contextError]);

    // ── Memos (untouched logic) ───────────────────────────────────────────────
    const sortedDisplayNamesAndOwners = useMemo(() => {
        const uniqueOwnerIds = new Set();
        Object.values(headToHeadRecords).forEach(rivalry => rivalry.owners.forEach(ownerId => uniqueOwnerIds.add(ownerId)));
        return Array.from(uniqueOwnerIds)
            .map(ownerId => ({ ownerId, displayName: getTeamName(ownerId, null) }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [headToHeadRecords, getTeamName]);

    // Set default team for rivalries table
    useEffect(() => {
        if (!teamRivalriesOwnerId && sortedDisplayNamesAndOwners.length > 0) {
            setTeamRivalriesOwnerId(sortedDisplayNamesAndOwners[0].ownerId);
        }
    }, [sortedDisplayNamesAndOwners, teamRivalriesOwnerId]);

    const bestRecordsByOwner = useMemo(() => {
        const result = {};
        Object.values(headToHeadRecords).forEach(r => {
            const owners = r.owners || [];
            if (owners.length < 2) return;
            const ownerA = owners[0], ownerB = owners[1];
            const recA = r[ownerA] || { wins: 0, losses: 0, ties: 0 };
            const recB = r[ownerB] || { wins: 0, losses: 0, ties: 0 };
            const totalA = (recA.wins || 0) + (recA.losses || 0) + (recA.ties || 0);
            const totalB = (recB.wins || 0) + (recB.losses || 0) + (recB.ties || 0);
            if (totalA > 0) {
                const winPctA = (recA.wins + 0.5 * (recA.ties || 0)) / totalA;
                if (!result[ownerA] || winPctA > result[ownerA].winPct)
                    result[ownerA] = { opponent: ownerB, wins: recA.wins || 0, losses: recA.losses || 0, ties: recA.ties || 0, winPct: winPctA, totalGames: totalA };
            }
            if (totalB > 0) {
                const winPctB = (recB.wins + 0.5 * (recB.ties || 0)) / totalB;
                if (!result[ownerB] || winPctB > result[ownerB].winPct)
                    result[ownerB] = { opponent: ownerA, wins: recB.wins || 0, losses: recB.losses || 0, ties: recB.ties || 0, winPct: winPctB, totalGames: totalB };
            }
        });
        return result;
    }, [headToHeadRecords]);

    const bestRecordsRows = useMemo(() => {
        const rows = Object.keys(bestRecordsByOwner).map(ownerId => {
            const r = bestRecordsByOwner[ownerId];
            const wins = r.wins || 0, losses = r.losses || 0, ties = r.ties || 0;
            const totalGames = wins + losses + ties;
            const winPctNum = typeof r.winPct === 'number' ? r.winPct : -1;
            return {
                ownerId, ownerName: getTeamName(ownerId, null),
                opponentId: r.opponent, opponentName: getTeamName(r.opponent, null),
                record: `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`,
                winPct: winPctNum >= 0 ? winPctNum.toFixed(3) : 'N/A',
                winPctNum, totalGames, wins
            };
        });
        rows.sort((a, b) => {
            if (b.winPctNum !== a.winPctNum) return (b.winPctNum || -1) - (a.winPctNum || -1);
            if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.ownerName.localeCompare(b.ownerName);
        });
        return rows;
    }, [bestRecordsByOwner, getTeamName]);

    // ── Notable Rivalries computation ─────────────────────────────────────────
    const notableRivalries = useMemo(() => {
        if (!Object.keys(headToHeadRecords).length) return null;

        // Build enriched rivalry stats for each key
        const enriched = Object.entries(headToHeadRecords).map(([key, rivalry]) => {
            const owners = rivalry.owners || [];
            if (owners.length < 2) return null;
            const [ownerA, ownerB] = owners;
            const recA = rivalry[ownerA] || { wins: 0, losses: 0, ties: 0 };
            const recB = rivalry[ownerB] || { wins: 0, losses: 0, ties: 0 };
            const totalGames = (recA.wins + recA.losses + recA.ties);

            let ptsA = 0, ptsB = 0, playedCount = 0;
            let margins = [];
            rivalry.allMatches.forEach(m => {
                const isA1 = m.team1OwnerId === ownerA;
                const scoreA = isA1 ? m.team1Score : m.team2Score;
                const scoreB = isA1 ? m.team2Score : m.team1Score;
                if (isNaN(scoreA) || isNaN(scoreB) || (scoreA === 0 && scoreB === 0)) return;
                ptsA += scoreA; ptsB += scoreB; playedCount++;
                if (!m.isTie) margins.push(Math.abs(scoreA - scoreB));
            });

            const ppgA = playedCount > 0 ? ptsA / playedCount : 0;
            const ppgB = playedCount > 0 ? ptsB / playedCount : 0;
            const totalPts = ptsA + ptsB;
            const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : Infinity;
            const winPctA = totalGames > 0 ? recA.wins / totalGames : 0;
            const winPctB = totalGames > 0 ? recB.wins / totalGames : 0;
            const maxWinPct = Math.max(winPctA, winPctB);
            const minOppPpg = Math.min(ppgA, ppgB);
            const maxPpg = Math.max(ppgA, ppgB);

            return { key, ownerA, ownerB, recA, recB, ptsA, ptsB, ppgA, ppgB, totalPts, totalGames, avgMargin, winPctA, winPctB, maxWinPct, minOppPpg, maxPpg, playedCount };
        }).filter(Boolean);

        if (!enriched.length) return null;

        // Helper to build team side object
        const teamSide = (ownerId, ptsFor, ppg, rec, matchups) => ({
            name: getTeamName(ownerId, null),
            wins: rec.wins, losses: rec.losses, ties: rec.ties,
            ptsFor, ppg, matchups,
        });

        // 1. Little Bro — most lopsided win % (higher winner win%)
        const littleBro = enriched.reduce((best, r) => {
            if (!best || r.maxWinPct > best.maxWinPct) return r;
            return best;
        }, null);

        // 2. Power Couple — most total pts combined
        const powerCouple = enriched.reduce((best, r) => {
            if (!best || r.totalPts > best.totalPts) return r;
            return best;
        }, null);

        // 3. Wrecking Ball — best individual PPG in any rivalry
        const wreckingBall = enriched.reduce((best, r) => {
            if (!best || r.maxPpg > best.maxPpg) return r;
            return best;
        }, null);

        // 4. '85 Bears — lowest opponent PPG (best defense / worst offense faced)
        const bears85 = enriched.filter(r => r.playedCount >= 2).reduce((best, r) => {
            if (!best || r.minOppPpg < best.minOppPpg) return r;
            return best;
        }, null) || enriched.reduce((best, r) => {
            if (!best || r.minOppPpg < best.minOppPpg) return r;
            return best;
        }, null);

        // 5. Mirror, Mirror — closest average margin
        const mirror = enriched.filter(r => r.playedCount >= 2).reduce((best, r) => {
            if (!best || r.avgMargin < best.avgMargin) return r;
            return best;
        }, null) || enriched.reduce((best, r) => {
            if (!best || r.avgMargin < best.avgMargin) return r;
            return best;
        }, null);

        // 6. Elder Statesmen — most matchups
        const elderStates = enriched.reduce((best, r) => {
            if (!best || r.totalGames > best.totalGames) return r;
            return best;
        }, null);

        const build = (r, winnerSide) => {
            // winnerSide: 'A' = ownerA is the "better" team for this category, 'B' = ownerB
            const dominantOwner = winnerSide === 'A' ? r.ownerA : r.ownerB;
            const otherOwner = winnerSide === 'A' ? r.ownerB : r.ownerA;
            const domPts = winnerSide === 'A' ? r.ptsA : r.ptsB;
            const othPts = winnerSide === 'A' ? r.ptsB : r.ptsA;
            const domPpg = winnerSide === 'A' ? r.ppgA : r.ppgB;
            const othPpg = winnerSide === 'A' ? r.ppgB : r.ppgA;
            const domRec = winnerSide === 'A' ? r.recA : r.recB;
            const othRec = winnerSide === 'A' ? r.recB : r.recA;
            return {
                teamA: teamSide(dominantOwner, domPts, domPpg, domRec, r.totalGames),
                teamB: teamSide(otherOwner, othPts, othPpg, othRec, r.totalGames),
                key: r.key,
                owners: [dominantOwner, otherOwner],
            };
        };

        const whichSideDominates = (r) => r.winPctA >= r.winPctB ? 'A' : 'B';
        const whichSideMorePts = (r) => r.ptsA >= r.ptsB ? 'A' : 'B';
        const whichSideBetterPpg = (r) => r.ppgA >= r.ppgB ? 'A' : 'B';
        const whichSideWorseOppPpg = (r) => r.ppgA <= r.ppgB ? 'A' : 'B'; // the team that scored LESS against the weaker scorer

        return {
            total: enriched.length,
            littleBro: littleBro ? {
                ...build(littleBro, whichSideDominates(littleBro)),
                statLabel: 'Win %',
                statValue: `${Math.round(littleBro.maxWinPct * 100)}%`,
            } : null,
            powerCouple: powerCouple ? {
                ...build(powerCouple, whichSideMorePts(powerCouple)),
                statLabel: 'Fantasy Points',
                statValue: formatScore(powerCouple.totalPts, 2),
            } : null,
            wreckingBall: wreckingBall ? {
                ...build(wreckingBall, whichSideBetterPpg(wreckingBall)),
                statLabel: 'PPG',
                statValue: formatScore(wreckingBall.maxPpg, 2),
            } : null,
            bears85: bears85 ? {
                ...build(bears85, whichSideWorseOppPpg(bears85)),
                statLabel: 'Opponent PPG',
                statValue: formatScore(bears85.minOppPpg, 2),
            } : null,
            mirror: mirror ? {
                ...build(mirror, 'A'),
                statLabel: 'Avg Margin',
                statValue: formatScore(mirror.avgMargin, 2),
            } : null,
            elderStates: elderStates ? {
                ...build(elderStates, whichSideDominates(elderStates)),
                statLabel: 'Matchups',
                statValue: String(elderStates.totalGames),
            } : null,
        };
    }, [headToHeadRecords, getTeamName]);

    // ── Rivalry detail renderer ───────────────────────────────────────────────
    const renderSelectedRivalryDetails = useCallback(() => {
        const rivalry = headToHeadRecords[selectedRivalryKey];
        if (!rivalry) return null;

        const ownerA = selectedRivalryOwners ? selectedRivalryOwners[0] : rivalry.owners[0];
        const ownerB = selectedRivalryOwners ? selectedRivalryOwners[1] : rivalry.owners[1];
        const teamADisplayName = getTeamName(ownerA, null);
        const teamBDisplayName = getTeamName(ownerB, null);
        const ownerARecord = rivalry[ownerA];
        const ownerBRecord = rivalry[ownerB];

        let overallHighestScore = { value: null, year: null, week: null, ownerId: null };
        let overallBiggestWinMargin = { value: null, year: null, week: null, winningOwnerId: null };
        let overallSlimmestWinMargin = { value: Infinity, year: null, week: null, winningOwnerId: null };
        let teamATotalPointsScored = 0, teamBTotalPointsScored = 0;
        let currentStreakTeam = null, currentStreakCount = 0;

        const sortedMatches = [...rivalry.allMatches].sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week);
        const currentSeason = nflState?.season ? parseInt(nflState.season) : null;
        const currentWeek = nflState?.week ? parseInt(nflState.week) : null;

        let cumulativeNetPoints = 0;
        const playedMatches = sortedMatches.filter(match => {
            const matchYear = parseInt(match.year), matchWeek = parseInt(match.week);
            if (currentSeason && matchYear > currentSeason) return false;
            if (currentSeason && matchYear === currentSeason && currentWeek && matchWeek >= currentWeek) return false;
            if (match.team1Score === 0 && match.team2Score === 0) return false;
            return typeof match.team1Score === 'number' && !isNaN(match.team1Score) &&
                   typeof match.team2Score === 'number' && !isNaN(match.team2Score);
        });

        const netPointsData = playedMatches
            .filter(match => {
                const matchYear = parseInt(match.year), matchWeek = parseInt(match.week);
                const isPlayed = typeof match.team1Score === 'number' && !isNaN(match.team1Score) &&
                                 typeof match.team2Score === 'number' && !isNaN(match.team2Score);
                if (currentSeason && matchYear > currentSeason) return false;
                if (currentSeason && matchYear === currentSeason && currentWeek && matchWeek >= currentWeek) return false;
                if (match.team1Score === 0 && match.team2Score === 0) return false;
                return isPlayed;
            })
            .map(match => {
                let mainTeamScore, oppTeamScore;
                if (match.team1OwnerId === ownerA) { mainTeamScore = match.team1Score; oppTeamScore = match.team2Score; }
                else { mainTeamScore = match.team2Score; oppTeamScore = match.team1Score; }
                const currentMatchNetPoints = mainTeamScore - oppTeamScore;
                cumulativeNetPoints += currentMatchNetPoints;
                return {
                    name: `${match.year} W${match.week}`, netPoints: currentMatchNetPoints,
                    cumulativeNetPoints, positiveCumulativeNetPoints: cumulativeNetPoints >= 0 ? cumulativeNetPoints : 0,
                    negativeCumulativeNetPoints: cumulativeNetPoints < 0 ? cumulativeNetPoints : 0,
                    mainTeamScore, oppTeamScore, week: match.week, year: match.year,
                };
            });

        logger.debug('Net Points Data for chart:', netPointsData);

        playedMatches.forEach(match => {
            let scoreAValue, scoreBValue;
            if (match.team1OwnerId === ownerA) { scoreAValue = match.team1Score; scoreBValue = match.team2Score; }
            else if (match.team1OwnerId === ownerB) { scoreAValue = match.team2Score; scoreBValue = match.team1Score; }
            else return;
            if (isNaN(scoreAValue) || isNaN(scoreBValue)) return;

            teamATotalPointsScored += scoreAValue;
            teamBTotalPointsScored += scoreBValue;

            if (scoreAValue > (overallHighestScore.value || 0))
                overallHighestScore = { value: scoreAValue, year: match.year, week: match.week, ownerId: match.team1OwnerId };
            if (scoreBValue > (overallHighestScore.value || 0))
                overallHighestScore = { value: scoreBValue, year: match.year, week: match.week, ownerId: match.team2OwnerId };

            if (!match.isTie) {
                const margin = Math.abs(scoreAValue - scoreBValue);
                if (margin > (overallBiggestWinMargin.value || 0))
                    overallBiggestWinMargin = { value: margin, year: match.year, week: match.week, winningOwnerId: scoreAValue > scoreBValue ? ownerA : ownerB };
                if (margin < overallSlimmestWinMargin.value)
                    overallSlimmestWinMargin = { value: margin, year: match.year, week: match.week, winningOwnerId: scoreAValue > scoreBValue ? ownerA : ownerB };
            }

            if (!match.isTie) {
                const matchWinnerOwnerId = scoreAValue > scoreBValue ? ownerA : ownerB;
                if (currentStreakTeam === matchWinnerOwnerId) { currentStreakCount++; }
                else { currentStreakTeam = matchWinnerOwnerId; currentStreakCount = 1; }
            } else { currentStreakTeam = null; currentStreakCount = 0; }
        });

        const currentStreak = currentStreakTeam
            ? `${getTeamName(currentStreakTeam, null)} ${currentStreakCount}-game W streak`
            : 'No current streak';

        const allTotalWins = careerDPRData ? careerDPRData.map(d => d.wins) : [];
        const allWinPercentages = careerDPRData ? careerDPRData.map(d => d.winPercentage) : [];
        const allCareerDPRs = careerDPRData ? careerDPRData.map(d => d.dpr) : [];
        const allTotalPointsScored = careerDPRData ? careerDPRData.map(d => d.pointsFor) : [];
        const allHighestSingleGameScores = careerDPRData ? careerDPRData.map(d => d.highScore) : [];

        // Stat bubble — dark themed
        const statBubble = (rank, label, value, className) => (
            <div className={`${className} flex flex-col items-center justify-center aspect-[5/3] w-full h-full rounded-lg`}>
                <span className="block text-sm font-bold mb-0.5">{rank}</span>
                <span className="block text-[10px] font-semibold text-center leading-tight">{label}</span>
                <span className="block text-[10px] opacity-75 text-center">{value}</span>
            </div>
        );

        // Reusable team card renderer
        const renderTeamCard = (currentOwnerId, opponentOwnerId) => {
            const currentTeamDisplayName = getTeamName(currentOwnerId, null);
            const overallTeamStats = careerDPRData?.find(d => d.ownerId === currentOwnerId);
            const opponentTeamStats = careerDPRData?.find(d => d.ownerId === opponentOwnerId);

            const totalWins = overallTeamStats?.wins ?? null;
            const winPercentage = overallTeamStats && typeof overallTeamStats.winPercentage === 'number' ? overallTeamStats.winPercentage : null;
            const careerDPR = overallTeamStats?.dpr ?? null;
            const weeklyHighScoreCount = weeklyHighScoreCounts[currentOwnerId] || 0;
            const weeklyHighScore = overallTeamStats?.highScore ?? null;
            const totalPointsScored = overallTeamStats?.pointsFor ?? null;

            let medalScore = 0;
            if (overallTeamStats) {
                medalScore += (overallTeamStats.championships || 0) * 10;
                medalScore += (overallTeamStats.runnerUps || 0) * 6;
                medalScore += (overallTeamStats.thirdPlaces || 0) * 4;
                medalScore += (overallTeamStats.pointsChampionships || 0) * 8;
                medalScore += (overallTeamStats.pointsRunnerUps || 0) * 5;
                medalScore += (overallTeamStats.thirdPlacePoints || 0) * 3;
            }
            const allMedalScores = careerDPRData ? careerDPRData.map(d => {
                let ms = 0;
                ms += (d.championships || 0) * 10; ms += (d.runnerUps || 0) * 6;
                ms += (d.thirdPlaces || 0) * 4; ms += (d.pointsChampionships || 0) * 8;
                ms += (d.pointsRunnerUps || 0) * 5; ms += (d.thirdPlacePoints || 0) * 3;
                return ms;
            }) : [];
            const medalScoreRank = calculateRank(medalScore, allMedalScores, true);
            const oppMedalScore = (() => {
                if (!opponentTeamStats) return 0;
                let ms = 0;
                ms += (opponentTeamStats.championships || 0) * 10; ms += (opponentTeamStats.runnerUps || 0) * 6;
                ms += (opponentTeamStats.thirdPlaces || 0) * 4; ms += (opponentTeamStats.pointsChampionships || 0) * 8;
                ms += (opponentTeamStats.pointsRunnerUps || 0) * 5; ms += (opponentTeamStats.thirdPlacePoints || 0) * 3;
                return ms;
            })();

            const oppTotalWins = opponentTeamStats?.wins ?? null;
            const oppWinPercentage = opponentTeamStats?.winPercentage ?? null;
            const oppCareerDPR = opponentTeamStats?.dpr ?? null;
            const oppTotalPointsScored = opponentTeamStats?.pointsFor ?? null;
            const oppWeeklyHighScoreCount = weeklyHighScoreCounts[opponentOwnerId] || 0;

            const whscClass = (() => {
                if (weeklyHighScoreCount > oppWeeklyHighScoreCount) return 'bg-emerald-900/40 text-emerald-300';
                if (weeklyHighScoreCount < oppWeeklyHighScoreCount) return 'bg-red-900/40 text-red-300';
                return 'bg-yellow-900/40 text-yellow-300';
            })();
            const medalClass = (() => {
                if (medalScore > oppMedalScore) return 'bg-emerald-900/40 text-emerald-300';
                if (medalScore < oppMedalScore) return 'bg-red-900/40 text-red-300';
                if (medalScore === oppMedalScore && medalScore !== 0) return 'bg-yellow-900/40 text-yellow-300';
                return 'bg-white/5 text-gray-400';
            })();

            return (
                <div className="bg-gray-750 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center text-center">
                    <img
                        src={getTeamDetails ? (getTeamDetails(currentOwnerId, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                        alt={`${currentTeamDisplayName} logo`}
                        className="w-14 h-14 object-contain rounded-full mb-3 border border-white/20"
                        onError={(e) => { e.target.onerror = null; e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                    />
                    <h4 className="text-base font-bold text-white mb-3">{currentTeamDisplayName}</h4>
                    <div className="grid grid-cols-3 gap-2 w-full text-xs font-medium text-gray-300">
                        {statBubble(calculateRank(totalWins, allTotalWins, true), 'Total Wins', totalWins ?? 'N/A', darkComparisonClass(totalWins, oppTotalWins))}
                        {statBubble(calculateRank(winPercentage, allWinPercentages, true), 'Win %', winPercentage !== null ? winPercentage.toFixed(3) + '%' : 'N/A', darkComparisonClass(winPercentage, oppWinPercentage))}
                        {statBubble(calculateRank(careerDPR, allCareerDPRs, true), 'Career DPR', careerDPR !== null ? formatScore(careerDPR, 3) : 'N/A', darkComparisonClass(careerDPR, oppCareerDPR))}
                        {statBubble(calculateRank(weeklyHighScoreCount, Object.values(weeklyHighScoreCounts), true), 'Weekly High', weeklyHighScoreCount, whscClass)}
                        {statBubble(calculateRank(totalPointsScored, allTotalPointsScored, true), 'Total Pts', totalPointsScored !== null ? formatScore(totalPointsScored, 2) : 'N/A', darkComparisonClass(totalPointsScored, oppTotalPointsScored))}
                        {statBubble(medalScoreRank, 'Medal Score', medalScore, medalClass)}
                    </div>
                </div>
            );
        };

        return (
            <div className="space-y-6">
                {/* Back button */}
                <button
                    onClick={() => { setSelectedRivalryKey(null); setSelectedRivalryOwners(null); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/10 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to All Rivalries
                </button>

                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <img
                            src={getTeamDetails ? (getTeamDetails(ownerA, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                            alt={teamADisplayName}
                            className="w-10 h-10 rounded-full border border-white/20 object-cover"
                            onError={(e) => { e.target.onerror = null; e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                        />
                        <h3 className="text-xl font-bold text-white">
                            {teamADisplayName} <span className="text-sm font-normal text-gray-500">vs</span> {teamBDisplayName}
                        </h3>
                        <img
                            src={getTeamDetails ? (getTeamDetails(ownerB, null)?.avatar || `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`) : `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`}
                            alt={teamBDisplayName}
                            className="w-10 h-10 rounded-full border border-white/20 object-cover"
                            onError={(e) => { e.target.onerror = null; e.target.src = `${process.env.PUBLIC_URL}/LeagueLogoNoBack.PNG`; }}
                        />
                    </div>
                    <p className="text-xs text-gray-500">Performance, stats, and records</p>
                </div>

                {/* Team cards + versus */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    {renderTeamCard(ownerA, ownerB)}

                    {/* Versus center card */}
                    <div className="flex flex-col items-center justify-center">
                        <div className="bg-blue-900/40 border border-blue-500/30 rounded-xl p-5 text-center w-full max-w-xs mx-auto">
                            <div className="text-lg font-extrabold text-white mb-3 tracking-widest">★ VS ★</div>
                            <div className="text-sm text-gray-400 mb-1">Record</div>
                            <div className="text-2xl font-bold text-white mb-3">
                                {ownerARecord.ties && ownerARecord.ties > 0 ? renderRecord(ownerARecord) : `${ownerARecord.wins || 0}-${ownerARecord.losses || 0}`}
                            </div>
                            {currentStreakTeam && (
                                <div className="text-xs text-gray-300 mb-2">
                                    Streak: <span className="font-semibold text-white">{currentStreakTeam === ownerA ? `W-${currentStreakCount}` : `L-${currentStreakCount}`}</span>
                                </div>
                            )}
                            <div className="text-xs text-gray-400">
                                Playoff Record: <span className="font-semibold text-white">
                                    {(() => {
                                        const pw = playedMatches.filter(m => (m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.winnerOwnerId === ownerA).length;
                                        const pl = playedMatches.filter(m => (m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.loserOwnerId === ownerA).length;
                                        const pt = playedMatches.filter(m => (m.matchType === 'Playoffs' || m.matchType === 'Championship Game') && m.isTie).length;
                                        return pt > 0 ? `${pw}-${pl}-${pt}` : `${pw}-${pl}`;
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {renderTeamCard(ownerB, ownerA)}
                </div>

                {/* Net Points Chart */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Net Points Over Time</span>
                    </div>
                    <div className="p-4">
                        <div className="w-full h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={netPointsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" fontSize={10} angle={-30} textAnchor="end" height={50} interval={0} tick={{ fill: '#6b7280' }} ticks={netPointsData.map(d => d.name)} />
                                    <YAxis domain={['auto', 'auto']} fontSize={10} tick={{ fill: '#6b7280' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e5e7eb' }}
                                        formatter={(value) => [typeof value === 'number' ? formatScore(value, 2) : value, 'Cumulative Net Points']}
                                    />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                                    <Bar dataKey="cumulativeNetPoints">
                                        {netPointsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.cumulativeNetPoints >= 0 ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-center text-gray-600 mt-2">
                            Green: {teamADisplayName} ahead · Red: {teamBDisplayName} ahead
                        </p>
                    </div>
                </div>

                {/* Matchup Highlights */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Matchup Highlights</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Highest Score', value: overallHighestScore.value !== null ? formatScore(overallHighestScore.value, 2) : 'N/A', sub: overallHighestScore.value !== null && overallHighestScore.ownerId ? `${getTeamName(overallHighestScore.ownerId, null)} (${overallHighestScore.year} Wk ${overallHighestScore.week})` : '' },
                            { label: 'Biggest Margin', value: overallBiggestWinMargin.value !== null ? formatScore(overallBiggestWinMargin.value, 2) : 'N/A', sub: overallBiggestWinMargin.value !== null && overallBiggestWinMargin.winningOwnerId ? `${getTeamName(overallBiggestWinMargin.winningOwnerId, null)} (${overallBiggestWinMargin.year} Wk ${overallBiggestWinMargin.week})` : '' },
                            { label: 'Slimmest Margin', value: overallSlimmestWinMargin.value !== Infinity ? formatScore(overallSlimmestWinMargin.value, 2) : 'N/A', sub: overallSlimmestWinMargin.value !== Infinity && overallSlimmestWinMargin.winningOwnerId ? `${getTeamName(overallSlimmestWinMargin.winningOwnerId, null)} (${overallSlimmestWinMargin.year} Wk ${overallSlimmestWinMargin.week})` : '' },
                        ].map(({ label, value, sub }) => (
                            <div key={label} className="bg-white/5 border border-white/8 rounded-lg p-3 text-center">
                                <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">{label}</div>
                                <div className="text-xl font-bold text-white">{value}</div>
                                {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Match History */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Match History</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {['Year', 'Week', `${teamADisplayName}`, `${teamBDisplayName}`, 'Winner', 'Type'].map(h => (
                                        <th key={h} className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rivalry.allMatches
                                    .filter(match => {
                                        const matchYear = parseInt(match.year), matchWeek = parseInt(match.week);
                                        if (currentSeason && matchYear > currentSeason) return false;
                                        if (currentSeason && matchYear === currentSeason && currentWeek && matchWeek >= currentWeek) return false;
                                        if (match.team1Score === 0 && match.team2Score === 0) return false;
                                        return true;
                                    })
                                    .sort((a, b) => b.year - a.year || b.week - a.week)
                                    .map((match, idx) => {
                                        const teamAScore = match.team1OwnerId === ownerA ? match.team1Score : match.team2Score;
                                        const teamBScore = match.team1OwnerId === ownerB ? match.team1Score : match.team2Score;
                                        const aWon = teamAScore > teamBScore;
                                        const bWon = teamBScore > teamAScore;
                                        return (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2 px-3 text-gray-400 tabular-nums">{match.year}</td>
                                                <td className="py-2 px-3 text-gray-400 tabular-nums">{match.week}</td>
                                                <td className={`py-2 px-3 font-semibold tabular-nums ${aWon ? 'text-emerald-400' : bWon ? 'text-red-400' : 'text-gray-400'}`}>{formatScore(teamAScore, 2)}</td>
                                                <td className={`py-2 px-3 font-semibold tabular-nums ${bWon ? 'text-emerald-400' : aWon ? 'text-red-400' : 'text-gray-400'}`}>{formatScore(teamBScore, 2)}</td>
                                                <td className="py-2 px-3 text-gray-200">{match.winnerDisplayName === 'Tie' ? 'Tie' : match.winnerDisplayName}</td>
                                                <td className="py-2 px-3 text-[10px] text-gray-600">{match.matchType}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }, [selectedRivalryKey, headToHeadRecords, careerDPRData, getTeamName, getTeamDetails, historicalData, nflState, weeklyHighScoreCounts, selectedRivalryOwners]);

    // ── Loading / error states ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-400 animate-pulse">Loading Head-to-Head data…</p>
            </div>
        );
    }

    if (contextError) {
        return (
            <div className="text-center text-red-400 text-sm p-4">
                <p>Error loading historical data: {contextError.message || String(contextError)}</p>
            </div>
        );
    }

    if (!historicalData || Object.keys(historicalData.matchupsBySeason || {}).length === 0) {
        return (
            <div className="text-center text-gray-500 text-sm p-4">
                No historical matchup data available to build Head-to-Head grid.
            </div>
        );
    }

    // ── Main grid view ────────────────────────────────────────────────────────

    const NOTABLE_CARDS = notableRivalries ? [
        { key: 'littleBro',    title: "Little Bro",       subtitle: "Most lopsided win % in any rivalry.",        accent: 'rose',   data: notableRivalries.littleBro },
        { key: 'powerCouple',  title: "Power Couple",     subtitle: "Rivalry with the most points scored all time.", accent: 'purple', data: notableRivalries.powerCouple },
        { key: 'wreckingBall', title: "Wrecking Ball",    subtitle: "Best individual PPG in any rivalry.",         accent: 'amber',  data: notableRivalries.wreckingBall },
        { key: 'bears85',      title: "'85 Bears",        subtitle: "Dominant defense? Or inept offense?",        accent: 'teal',   data: notableRivalries.bears85 },
        { key: 'mirror',       title: "Mirror, Mirror",   subtitle: "Closest average margin of victory.",         accent: 'indigo', data: notableRivalries.mirror },
        { key: 'elderStates',  title: "Elder Statesmen",  subtitle: "Most matchups played.",                      accent: 'blue',   data: notableRivalries.elderStates },
    ].filter(c => c.data) : [];

    return (
        <div className="w-full space-y-6">
            {selectedRivalryKey ? renderSelectedRivalryDetails() : (
                <>
                    {/* ── Notable Rivalries ── */}
                    {NOTABLE_CARDS.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-base font-bold text-white">Notable Rivalries</h2>
                                </div>
                                <span className="text-[10px] font-semibold text-gray-500 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                                    {notableRivalries.total} Total
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {NOTABLE_CARDS.map(({ key, title, subtitle, accent, data }) => (
                                    <NotableRivalryCard
                                        key={key}
                                        title={title}
                                        subtitle={subtitle}
                                        accentColor={accent}
                                        statLabel={data.statLabel}
                                        statValue={data.statValue}
                                        teamA={data.teamA}
                                        teamB={data.teamB}
                                        onSelect={() => {
                                            setSelectedRivalryOwners(data.owners);
                                            setSelectedRivalryKey(data.key);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Team Rivalries Table ── */}
                    {teamRivalriesOwnerId && (
                        <TeamRivalriesTable
                            selectedOwnerId={teamRivalriesOwnerId}
                            headToHeadRecords={headToHeadRecords}
                            getTeamName={getTeamName}
                            sortedDisplayNamesAndOwners={sortedDisplayNamesAndOwners}
                            onChangeTeam={() => setShowTeamPicker(true)}
                            onSelectRivalry={(key, owners) => {
                                setSelectedRivalryOwners(owners);
                                setSelectedRivalryKey(key);
                            }}
                        />
                    )}

                    {/* ── H2H Grid ── */}
                    <div className={card}>
                        <div className={cardHeader}>
                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Head-to-Head Rivalries</span>
                        </div>
                        {/* Axis legend */}
                        <div className="px-4 pt-3 pb-1 flex items-center gap-4 text-[10px] text-gray-600">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500/40 border border-blue-400/40" />
                                <span>Row = team whose record is shown</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-white/10 border border-white/10" />
                                <span>Column = their opponent</span>
                            </span>
                        </div>
                        <style>{`
                            .h2h-scroll-container {
                                overflow-x: auto;
                                overflow-y: visible;
                                padding: 1rem;
                                position: relative;
                                isolation: isolate;
                                -webkit-overflow-scrolling: touch;
                            }
                            .h2h-table {
                                border-collapse: separate;
                                border-spacing: 2px;
                                width: max-content;
                                min-width: 100%;
                                table-layout: auto;
                            }
                            .h2h-sticky,
                            .h2h-corner {
                                position: -webkit-sticky;
                                position: sticky;
                                left: 0;
                                background: #1e293b !important;
                                -webkit-background-clip: padding-box;
                                background-clip: padding-box;
                                box-shadow: 3px 0 0 0 rgba(255,255,255,0.06), 6px 0 16px 0 rgba(0,0,0,0.9);
                            }
                            .h2h-sticky { z-index: 30; }
                            .h2h-corner { z-index: 40; }
                            .h2h-sticky::before,
                            .h2h-corner::before {
                                content: '';
                                position: absolute;
                                inset: 0;
                                background: #1e293b;
                                z-index: -1;
                            }
                            .h2h-cell {
                                font-size: 11px;
                                font-weight: 700;
                                text-align: center;
                                padding: 6px 4px;
                                min-width: 60px;
                                border: 1px solid rgba(0,0,0,0.2);
                                cursor: pointer;
                                transition: filter 0.1s ease;
                            }
                            .h2h-cell:hover {
                                filter: brightness(1.15);
                                outline: 2px solid rgba(255,255,255,0.4);
                                outline-offset: -2px;
                            }
                            .h2h-th {
                                font-size: 10px;
                                font-weight: 600;
                                color: #6b7280;
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                                text-align: center;
                                padding: 6px 4px;
                                min-width: 60px;
                                white-space: normal;
                                word-break: break-word;
                                max-width: 72px;
                                vertical-align: bottom;
                                border-bottom: 1px solid rgba(255,255,255,0.08);
                            }
                            @media (max-width: 640px) {
                                .h2h-cell { font-size: 10px; padding: 5px 2px; min-width: 48px; }
                                .h2h-th   { font-size: 9px;  padding: 5px 2px; min-width: 48px; max-width: 56px; }
                            }
                        `}</style>
                        <div className="h2h-scroll-container">
                            <table className="h2h-table">
                                <thead>
                                    <tr>
                                        <th className="h2h-corner py-2 px-3 text-left text-[10px] font-semibold text-blue-400 uppercase tracking-wider"
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', minWidth: 140 }}>
                                            Team ↓
                                        </th>
                                        {sortedDisplayNamesAndOwners.map(team => (
                                            <th key={team.ownerId} className="h2h-th">
                                                {team.displayName}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDisplayNamesAndOwners.map(rowTeam => (
                                        <tr key={rowTeam.ownerId}>
                                            <td className="h2h-sticky py-2 px-3 text-left text-xs text-blue-300 font-semibold whitespace-nowrap"
                                                style={{ borderRight: '1px solid rgba(255,255,255,0.08)', borderLeft: '2px solid rgba(99,102,241,0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                {rowTeam.displayName}
                                            </td>
                                            {sortedDisplayNamesAndOwners.map(colTeam => {
                                                if (rowTeam.ownerId === colTeam.ownerId) {
                                                    return (
                                                        <td key={`${rowTeam.ownerId}-${colTeam.ownerId}`}
                                                            style={{ backgroundColor: '#0f172a', color: '#374151', textAlign: 'center', fontSize: 11, padding: '6px 4px', border: '1px solid rgba(0,0,0,0.3)' }}>
                                                            —
                                                        </td>
                                                    );
                                                }
                                                const rivalryKey = [rowTeam.ownerId, colTeam.ownerId].sort().join(' vs ');
                                                const rivalry = headToHeadRecords[rivalryKey];
                                                let recordForDisplay = '—';
                                                let cellStyle = { backgroundColor: '#1e293b', color: '#4b5563', textAlign: 'center', fontSize: 11, padding: '6px 4px', border: '1px solid rgba(0,0,0,0.2)' };

                                                if (rivalry) {
                                                    const rowOwnerRecord = rivalry[rowTeam.ownerId];
                                                    const totalGames = rowOwnerRecord.wins + rowOwnerRecord.losses + rowOwnerRecord.ties;
                                                    if (totalGames > 0) {
                                                        recordForDisplay = `${rowOwnerRecord.wins}-${rowOwnerRecord.losses}`;
                                                        const { background, color, fontWeight } = computeCellColors(rowOwnerRecord.wins, rowOwnerRecord.losses);
                                                        cellStyle = { backgroundColor: background, color, fontWeight, textAlign: 'center', fontSize: 11, padding: '6px 4px', border: '1px solid rgba(0,0,0,0.25)', cursor: 'pointer' };
                                                    }
                                                }

                                                return (
                                                    <td
                                                        key={`${rowTeam.ownerId}-${colTeam.ownerId}`}
                                                        className="h2h-cell"
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => {
                                                            if (!rivalry) return;
                                                            setSelectedRivalryOwners([rowTeam.ownerId, colTeam.ownerId]);
                                                            setSelectedRivalryKey(rivalryKey);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (!rivalry) return;
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setSelectedRivalryOwners([rowTeam.ownerId, colTeam.ownerId]);
                                                                setSelectedRivalryKey(rivalryKey);
                                                            }
                                                        }}
                                                        style={cellStyle}
                                                    >
                                                        {recordForDisplay}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 pb-3 border-t border-white/5 pt-2">
                            <p className="text-[10px] text-gray-600 text-center">Click any cell for detailed head-to-head stats</p>
                        </div>
                    </div>

                    {/* Best Records table */}
                    {bestRecordsRows && bestRecordsRows.length > 0 && (
                        <div className={card}>
                            <div className={cardHeader}>
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Best Records vs Opponent</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            {['Team', 'Opponent', 'Record', 'Win %'].map(h => (
                                                <th key={h} className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {bestRecordsRows.map((r, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2.5 px-3 font-medium text-gray-200">{r.ownerName}</td>
                                                <td className="py-2.5 px-3 text-gray-400">{r.opponentName}</td>
                                                <td className="py-2.5 px-3 text-gray-300 tabular-nums">{r.record}</td>
                                                <td className="py-2.5 px-3 text-gray-300 tabular-nums">{r.winPct}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Team picker modal */}
            {showTeamPicker && (
                <TeamPickerModal
                    teams={sortedDisplayNamesAndOwners}
                    onSelect={setTeamRivalriesOwnerId}
                    onClose={() => setShowTeamPicker(false)}
                />
            )}
        </div>
    );
};

export default Head2HeadGrid;