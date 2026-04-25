import React, { useState, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';

const PlayerRecords = () => {
    const { historicalData, nflPlayers, getTeamName, loading, error } = useSleeperData();
    const [activeView, setActiveView] = useState('weekly');

    // ── All logic untouched ───────────────────────────────────────────────────
    const playerRecords = useMemo(() => {
        if (!historicalData?.matchupsBySeason || !nflPlayers) {
            logger.debug('Missing data for player records:', {
                hasMatchups: !!historicalData?.matchupsBySeason,
                hasNflPlayers: !!nflPlayers
            });
            return null;
        }
        logger.debug('Available seasons:', Object.keys(historicalData.matchupsBySeason));

        const weeklyRecords  = { QB: [], RB: [], WR: [], TE: [], K: [], 'D/ST': [] };
        const seasonalRecords = { QB: [], RB: [], WR: [], TE: [], K: [], 'D/ST': [] };
        const seasonalTotals = {};

        for (const [season, matchups] of Object.entries(historicalData.matchupsBySeason)) {
            matchups.forEach(matchup => {
                [
                    { rosterInfo: matchup.team1_details, players: matchup.team1_players, rosterId: matchup.team1_roster_id },
                    { rosterInfo: matchup.team2_details, players: matchup.team2_players, rosterId: matchup.team2_roster_id }
                ].forEach(({ rosterInfo, players, rosterId }) => {
                    if (!players || !players.starters || !players.players_points || !rosterInfo) return;
                    const teamName = getTeamName(rosterInfo.owner_id, parseInt(season));
                    players.starters.forEach(playerId => {
                        if (!playerId || !players.players_points[playerId]) return;
                        const nflPlayer = nflPlayers[playerId];
                        if (!nflPlayer) return;
                        let position = nflPlayer.position;
                        if (position === 'DEF') position = 'D/ST';
                        const playerName = `${nflPlayer.first_name} ${nflPlayer.last_name}`;
                        const points = players.players_points[playerId] || 0;
                        if (!weeklyRecords[position]) return;
                        weeklyRecords[position].push({ playerName, points, week: matchup.week, season, teamName, playerId });
                        const seasonKey = `${playerId}-${season}`;
                        if (!seasonalTotals[seasonKey])
                            seasonalTotals[seasonKey] = { playerName, position, points: 0, games: 0, season, teamName, playerId };
                        seasonalTotals[seasonKey].points += points;
                        seasonalTotals[seasonKey].games += 1;
                    });
                });
            });
        }
        Object.values(seasonalTotals).forEach(ps => {
            if (seasonalRecords[ps.position]) seasonalRecords[ps.position].push(ps);
        });
        const getTopRecords = (records, limit = 5) =>
            records.sort((a, b) => b.points - a.points).slice(0, limit);
        const result = { weekly: {}, seasonal: {} };
        Object.keys(weeklyRecords).forEach(pos => {
            result.weekly[pos]   = getTopRecords(weeklyRecords[pos]);
            result.seasonal[pos] = getTopRecords(seasonalRecords[pos]);
        });
        logger.debug('Generated player records:', result);
        return result;
    }, [historicalData, nflPlayers, getTeamName]);

    // ── Loading / error ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading player records…</p>
                </div>
            </div>
        );
    }

    if (error || !playerRecords) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-sm text-red-400 font-medium">Unable to load player records</p>
                <p className="text-xs text-gray-600 mt-1">Please try refreshing the page or check back later.</p>
                {error && <p className="text-[10px] text-gray-700 mt-3">Error: {error.message}</p>}
            </div>
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];

    const positionColors = {
        QB:   { accent: 'text-red-400',    badge: 'bg-red-500/15 border-red-500/25 text-red-300' },
        RB:   { accent: 'text-emerald-400',badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' },
        WR:   { accent: 'text-blue-400',   badge: 'bg-blue-500/15 border-blue-500/25 text-blue-300' },
        TE:   { accent: 'text-orange-400', badge: 'bg-orange-500/15 border-orange-500/25 text-orange-300' },
        K:    { accent: 'text-purple-400', badge: 'bg-purple-500/15 border-purple-500/25 text-purple-300' },
        'D/ST':{ accent: 'text-teal-400',  badge: 'bg-teal-500/15 border-teal-500/25 text-teal-300' },
    };

    const positionIcons = {
        QB:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        RB:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
        WR:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />,
        TE:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
        K:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
        'D/ST':<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    };

    const rankBadgeClass = (idx) => {
        if (idx === 0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        if (idx === 1) return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
        if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/40';
        return 'bg-white/5 text-gray-500 border-white/10';
    };

    const renderPlayerTable = (records, isWeekly, position) => {
        const colors = positionColors[position] || positionColors.QB;
        if (!records || records.length === 0) {
            return (
                <div className="text-center py-6 text-gray-600 text-xs">No records available for this position</div>
            );
        }
        return (
            <div className="space-y-1.5">
                {records.map((record, idx) => (
                    <div key={`${record.playerId}-${record.season}-${record.week || 'season'}`}
                         className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.05] border border-white/8 rounded-lg px-3 py-2.5 transition-colors">
                        {/* Rank badge */}
                        <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border ${rankBadgeClass(idx)}`}>
                            {idx + 1}
                        </span>

                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-200 truncate">{record.playerName}</div>
                            <div className={`text-[10px] font-medium truncate ${colors.accent}`}>{record.teamName}</div>
                        </div>

                        {/* Score + context */}
                        <div className="text-right flex-shrink-0">
                            <div className={`text-sm font-bold tabular-nums ${colors.accent}`}>
                                {record.points.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-gray-600 tabular-nums">
                                {isWeekly ? `Wk ${record.week} ` : `${record.games ?? '?'}g `}
                                {record.season}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-4">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Player Records</span>
                <span className="text-[10px] text-gray-600 ml-1">— starters only</span>
            </div>

            {/* Weekly / Seasonal toggle */}
            <div className="flex justify-center">
                <div className="flex gap-1 bg-gray-900/60 border border-white/10 rounded-lg p-1">
                    {['weekly', 'seasonal'].map(view => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            className={`px-5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 capitalize ${
                                activeView === view
                                    ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {view}
                        </button>
                    ))}
                </div>
            </div>

            {/* Position cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {positions.map(position => {
                    const records = playerRecords[activeView][position] || [];
                    const colors  = positionColors[position] || positionColors.QB;
                    const icon    = positionIcons[position];

                    return (
                        <div key={position} className="bg-gray-800/60 border border-white/10 rounded-xl overflow-hidden">
                            {/* Position header */}
                            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/8">
                                <div className={`w-6 h-6 flex items-center justify-center rounded-md ${colors.badge} border flex-shrink-0`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {icon}
                                    </svg>
                                </div>
                                <div>
                                    <span className={`text-xs font-bold ${colors.accent}`}>{position}</span>
                                    <span className="text-[10px] text-gray-600 ml-1.5">
                                        {activeView === 'weekly' ? 'Best Weekly' : 'Best Season'}
                                    </span>
                                </div>
                            </div>

                            {/* Records list */}
                            <div className="p-2.5">
                                {renderPlayerTable(records, activeView === 'weekly', position)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PlayerRecords;