import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import PowerRankings from '../lib/PowerRankings';
import ProjectedPlayoffBracket from './ProjectedPlayoffBracket';
import CurrentSeasonFinancials from './CurrentSeasonFinancials';
import { formatScore } from '../utils/formatUtils';
import DashboardContainer from './DashboardContainer';
import { TRADE_DEADLINE_ISO, DRAFT_DATE_ISO } from '../config';

const Dashboard = () => {
    const {
        historicalData,
        getTeamName,
        getTeamDetails,
        transactions,
        nflPlayers,
        loading: contextLoading,
        error: contextError,
        currentSeason,
        nflState,
        processedSeasonalRecords
    } = useSleeperData();

    const [trendingPlayers, setTrendingPlayers] = useState({ added: [], dropped: [], loading: true });

    const formatCount = (n) => {
        if (n === null || n === undefined) return '';
        const num = Number(n);
        if (Number.isNaN(num)) return String(n);
        const abs = Math.abs(num);
        if (abs >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
        if (abs >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
        return String(num);
    };

    const formatCurrency = (v) => {
        const num = Number(v || 0);
        if (Number.isNaN(num)) return '$0.00';
        return num.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    };

    const normalizeWaiverBudget = (wb) => {
        if (!wb) return [];
        try {
            if (!Array.isArray(wb)) return [];
            return wb.map(item => {
                if (item && typeof item === 'object') {
                    if ('sender' in item || 'receiver' in item) {
                        return {
                            sender: item.sender ?? item.from ?? item.roster_id ?? null,
                            receiver: item.receiver ?? item.to ?? item.roster_id ?? null,
                            amount: Number(item.amount ?? item.bid ?? item.faab ?? item.wbid ?? 0)
                        };
                    }
                    return {
                        roster_id: item.roster_id ?? item.rosterId ?? item.user_id ?? item.owner_id ?? item.ownerId ?? null,
                        amount: Number(item.amount ?? item.bid ?? item.faab ?? item.wbid ?? 0)
                    };
                }
                return { roster_id: null, amount: Number(item) || 0 };
            });
        } catch (e) {
            return [];
        }
    };

    const fetchTrending = async (lookbackHours = 24, limit = 40) => {
        try {
            const base = 'https://api.sleeper.app/v1/players/nfl/trending';
            const [addedRes, droppedRes] = await Promise.all([
                fetch(`${base}/add?lookback_hours=${lookbackHours}&limit=${limit}`),
                fetch(`${base}/drop?lookback_hours=${lookbackHours}&limit=${limit}`)
            ]);
            const addedJson = addedRes.ok ? await addedRes.json() : [];
            const droppedJson = droppedRes.ok ? await droppedRes.json() : [];
            const normalize = (arr) => (Array.isArray(arr) ? arr.map(item => {
                if (!item) return null;
                if (item.player_id) return { id: item.player_id, raw: item };
                if (item.player?.player_id) return { id: item.player.player_id, raw: item };
                return { id: item.player_id || item.player?.player_id || item?.id || null, raw: item };
            }).filter(x => x && x.id) : []);
            return { added: normalize(addedJson), dropped: normalize(droppedJson) };
        } catch (e) {
            console.warn('Failed to fetch trending players', e);
            return { added: [], dropped: [] };
        }
    };

    useEffect(() => {
        let mounted = true;
        setTrendingPlayers(prev => ({ ...prev, loading: true }));
        fetchTrending().then(res => { if (!mounted) return; setTrendingPlayers({ added: res.added, dropped: res.dropped, loading: false }); });
        const t = setInterval(async () => {
            const res = await fetchTrending();
            if (!mounted) return;
            setTrendingPlayers({ added: res.added, dropped: res.dropped, loading: false });
        }, 1000 * 60 * 10);
        return () => { mounted = false; clearInterval(t); };
    }, []);

    const currentWeekMatchups = useMemo(() => {
        if (!historicalData || !currentSeason || !nflState) return [];
        const currentWeek = nflState.week ? parseInt(nflState.week) : 1;
        let season = currentSeason;
        if (!season) {
            const years = Object.keys(historicalData.matchupsBySeason || {});
            if (years.length > 0) season = Math.max(...years.map(Number)).toString();
        }
        const matchups = historicalData.matchupsBySeason?.[season] || [];
        const rosters = historicalData.rostersBySeason?.[season] || [];
        const weekMatchups = matchups.filter(m => parseInt(m.week) === currentWeek);
        return weekMatchups.map(m => {
            const team1Roster = rosters.find(r => String(r.roster_id) === String(m.team1_roster_id));
            const team2Roster = rosters.find(r => String(r.roster_id) === String(m.team2_roster_id));
            const team1OwnerId = team1Roster?.owner_id;
            const team2OwnerId = team2Roster?.owner_id;
            return {
                team1: { ownerId: team1OwnerId, name: getTeamName(team1OwnerId, season), score: m.team1_score || 0, avatar: getTeamDetails(team1OwnerId, season)?.avatar },
                team2: { ownerId: team2OwnerId, name: getTeamName(team2OwnerId, season), score: m.team2_score || 0, avatar: getTeamDetails(team2OwnerId, season)?.avatar },
                team1RosterId: String(m.team1_roster_id),
                team2RosterId: String(m.team2_roster_id),
                matchupId: m.matchup_id,
                week: m.week,
                isCompleted: (m.team1_score || 0) > 0 || (m.team2_score || 0) > 0
            };
        });
    }, [historicalData, currentSeason, nflState, getTeamName, getTeamDetails]);

    const weeklyLuckData = useMemo(() => {
        if (!processedSeasonalRecords || !currentSeason || !processedSeasonalRecords[currentSeason]) return {};
        const luckDataForSeason = {};
        const teams = processedSeasonalRecords[currentSeason];
        Object.keys(teams).forEach(rosterId => {
            const team = teams[rosterId];
            if (team.weeklyLuck) luckDataForSeason[rosterId] = team.weeklyLuck;
        });
        return luckDataForSeason;
    }, [processedSeasonalRecords, currentSeason]);

    const getFriskyGameId = useCallback((matchups, gameOfWeekId) => {
        if (!matchups || matchups.length === 0 || !weeklyLuckData || !nflState) return null;
        const anyTeam = Object.keys(weeklyLuckData)[0];
        const weeksAvailable = anyTeam ? (weeklyLuckData[anyTeam] || []).length : 0;
        const weekToUseForLuck = weeksAvailable;
        if (weekToUseForLuck <= 0) return null;
        const matchupLuckData = matchups.map(m => {
            const team1RosterId = String(m.team1RosterId);
            const team2RosterId = String(m.team2RosterId);
            const team1Luck = weeklyLuckData[team1RosterId]?.[weekToUseForLuck - 1] ?? 0;
            const team2Luck = weeklyLuckData[team2RosterId]?.[weekToUseForLuck - 1] ?? 0;
            return { matchupId: m.matchupId, luckDifference: Math.abs(team1Luck - team2Luck), team1Luck, team2Luck };
        });
        matchupLuckData.sort((a, b) => b.luckDifference - a.luckDifference);
        if (matchupLuckData.length === 0 || matchupLuckData[0].luckDifference === 0) return null;
        if (matchupLuckData.length > 1 && String(matchupLuckData[0].matchupId) === String(gameOfWeekId)) return matchupLuckData[1].matchupId;
        return matchupLuckData[0].matchupId;
    }, [weeklyLuckData, nflState]);

    const recentTransactions = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];
        return [...transactions]
            .filter(transaction => transaction.status !== 'failed' && transaction.creator !== 'commissioner' && transaction.type !== 'commissioner')
            .sort((a, b) => b.created - a.created)
            .slice(0, 10)
            .map(transaction => {
                let season = currentSeason;
                if (!season) {
                    const years = Object.keys(historicalData?.rostersBySeason || {});
                    if (years.length > 0) season = Math.max(...years.map(Number)).toString();
                }
                const rosters = historicalData?.rostersBySeason?.[season] || [];
                const teamDetails = [];
                if (transaction.roster_ids && transaction.roster_ids.length > 0) {
                    transaction.roster_ids.forEach(rosterId => {
                        const roster = rosters.find(r => String(r.roster_id) === String(rosterId));
                        if (roster) teamDetails.push({ ownerId: roster.owner_id, name: getTeamName(roster.owner_id, season), avatar: getTeamDetails(roster.owner_id, season)?.avatar });
                    });
                }
                let tradeDetails = null;
                if (transaction.type === 'trade') {
                    tradeDetails = teamDetails.map(team => {
                        const teamRosterId = transaction.roster_ids.find(rosterId => {
                            const roster = rosters.find(r => String(r.roster_id) === String(rosterId));
                            return roster?.owner_id === team.ownerId;
                        });
                        const teamAdds = [];
                        const teamDrops = [];
                        if (transaction.adds) {
                            Object.keys(transaction.adds).forEach(playerId => {
                                if (String(transaction.adds[playerId]) === String(teamRosterId)) {
                                    const player = nflPlayers?.[playerId];
                                    teamAdds.push({ id: playerId, name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`, position: player?.position || 'N/A', team: player?.team || 'FA', headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null });
                                }
                            });
                        }
                        if (transaction.drops) {
                            Object.keys(transaction.drops).forEach(playerId => {
                                if (String(transaction.drops[playerId]) === String(teamRosterId)) {
                                    const player = nflPlayers?.[playerId];
                                    teamDrops.push({ id: playerId, name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`, position: player?.position || 'N/A', team: player?.team || 'FA', headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null });
                                }
                            });
                        }
                        const teamDraftPicksReceived = [];
                        const teamDraftPicksSent = [];
                        if (transaction.draft_picks && Array.isArray(transaction.draft_picks)) {
                            transaction.draft_picks.forEach(pick => {
                                if (String(pick.owner_id) === String(teamRosterId)) teamDraftPicksReceived.push({ season: pick.season, round: pick.round, fromRoster: pick.previous_owner_id });
                                if (String(pick.previous_owner_id) === String(teamRosterId)) teamDraftPicksSent.push({ season: pick.season, round: pick.round, toRoster: pick.owner_id });
                            });
                        }
                        return { ...team, receives: teamAdds, sends: teamDrops, receivedPicks: teamDraftPicksReceived, sentPicks: teamDraftPicksSent };
                    });
                }
                const addedPlayers = Object.keys(transaction.adds || {}).map(playerId => {
                    const player = nflPlayers?.[playerId];
                    return { id: playerId, name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`, position: player?.position || 'N/A', team: player?.team || 'FA', headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null };
                });
                const droppedPlayers = Object.keys(transaction.drops || {}).map(playerId => {
                    const player = nflPlayers?.[playerId];
                    return { id: playerId, name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`, position: player?.position || 'N/A', team: player?.team || 'FA', headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null };
                });
                return { id: transaction.transaction_id, type: transaction.type, status: transaction.status, created: new Date(transaction.created), teamDetails, addedPlayers, droppedPlayers, tradeDetails, draftPicks: transaction.draft_picks || [], waiver_budget: transaction.waiver_budget || [] };
            });
    }, [transactions, historicalData, currentSeason, getTeamName]);

    const formatTransactionType = (type) => {
        switch (type) {
            case 'waiver': return 'Waiver';
            case 'free_agent': return 'Free Agent';
            case 'trade': return 'Trade';
            default: return type;
        }
    };

    const formatTransactionDescription = (transaction) => {
        const { addedPlayers, droppedPlayers } = transaction;
        if (transaction.type === 'trade') {
            const playerCount = addedPlayers.length + droppedPlayers.length;
            return `Trade involving ${playerCount} player${playerCount !== 1 ? 's' : ''}`;
        }
        if (addedPlayers.length > 0 && droppedPlayers.length > 0) return `Added ${addedPlayers[0].name}, dropped ${droppedPlayers[0].name}`;
        else if (addedPlayers.length > 0) return `Added ${addedPlayers[0].name}`;
        else if (droppedPlayers.length > 0) return `Dropped ${droppedPlayers[0].name}`;
        return 'Transaction processed';
    };

    if (contextLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[200px] py-8">
                <div className="text-base text-gray-400 animate-pulse">Loading dashboard...</div>
            </div>
        );
    }

    if (contextError) {
        return (
            <div className="w-full flex items-center justify-center min-h-[200px] py-8">
                <div className="text-base text-red-400">Error: {contextError}</div>
            </div>
        );
    }

    // ── Countdown ─────────────────────────────────────────────────────────────
    const Countdown = ({ targetDate, label }) => {
        const [now, setNow] = useState(() => new Date());
        useEffect(() => {
            const t = setInterval(() => setNow(new Date()), 1000);
            return () => clearInterval(t);
        }, []);

        const diff = targetDate ? targetDate.getTime() - now.getTime() : 0;
        const isPassed = diff <= 0;
        const isSoon = diff > 0 && diff < (1000 * 60 * 60 * 24);

        const baseClass = "flex flex-col items-center justify-center rounded-xl px-4 py-3 min-w-[120px] border border-white/10 bg-gray-800";

        if (!targetDate) return (
            <div className={baseClass}>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">{label}</span>
                <span className="text-sm font-bold text-gray-500">N/A</span>
            </div>
        );

        if (isPassed) return (
            <div className={baseClass}>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">{label}</span>
                <span className="text-sm font-bold text-gray-500">Passed</span>
            </div>
        );

        const seconds = Math.floor(diff / 1000) % 60;
        const minutes = Math.floor(diff / (1000 * 60)) % 60;
        const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0 || days > 0) parts.push(`${hours}h`);
        parts.push(`${String(minutes).padStart(2, '0')}m`);
        parts.push(`${String(seconds).padStart(2, '0')}s`);

        return (
            <div className={`${baseClass} ${isSoon ? 'border-yellow-500/40 bg-yellow-900/20' : ''}`}>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{label}</span>
                <span className={`text-sm font-bold tabular-nums ${isSoon ? 'text-yellow-400' : 'text-white'}`}>{parts.join(' ')}</span>
            </div>
        );
    };

    const TRADE_DEADLINE = useMemo(() => (TRADE_DEADLINE_ISO ? new Date(TRADE_DEADLINE_ISO) : null), [TRADE_DEADLINE_ISO]);
    const DRAFT_DATE = useMemo(() => (DRAFT_DATE_ISO ? new Date(DRAFT_DATE_ISO) : null), [DRAFT_DATE_ISO]);

    // ── Shared card class ─────────────────────────────────────────────────────
    const card = "bg-gray-800 border border-white/10 rounded-xl";
    const cardHeader = "flex items-center gap-2 px-4 py-3 border-b border-white/10";

    // ── Matchup card renderer (used twice for seamless loop) ──────────────────
    const renderMatchupCard = (matchup, keyPrefix, idx) => {
        const t1Score = Number(matchup.team1.score || 0);
        const t2Score = Number(matchup.team2.score || 0);
        const bothZero = t1Score === 0 && t2Score === 0;

        const isGameOfWeek = ((localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
            (String(nflState?.week) === String(matchup.week) && (() => {
                try {
                    if (!processedSeasonalRecords) return false;
                    const seasonData = processedSeasonalRecords?.[currentSeason] || {};
                    const dprVals = Object.values(seasonData).map(t => Number(t?.dpr ?? 0)).filter(v => !isNaN(v));
                    const avgVals = Object.values(seasonData).map(t => Number(t?.averageScore ?? t?.avgPerGame ?? 0)).filter(v => !isNaN(v));
                    const dprMin = dprVals.length ? Math.min(...dprVals) : 0; const dprMax = dprVals.length ? Math.max(...dprVals) : 1;
                    const avgMin = avgVals.length ? Math.min(...avgVals) : 0; const avgMax = avgVals.length ? Math.max(...avgVals) : 1;
                    const normalize = (v, min, max) => (max === min ? 0.5 : (v - min) / (max - min));
                    let bestId = null; let bestScore = -Infinity;
                    currentWeekMatchups.forEach(mm => {
                        const r1 = String(mm.team1RosterId); const r2 = String(mm.team2RosterId);
                        const t1 = seasonData[r1] || {}; const t2 = seasonData[r2] || {};
                        const dpr1 = Number(t1.dpr ?? 0); const dpr2 = Number(t2.dpr ?? 0);
                        const avg1 = Number(t1.averageScore ?? t1.avgPerGame ?? 0); const avg2 = Number(t2.averageScore ?? t2.avgPerGame ?? 0);
                        const q1 = normalize(dpr1, dprMin, dprMax) * 0.6 + normalize(avg1, avgMin, avgMax) * 0.4;
                        const q2 = normalize(dpr2, dprMin, dprMax) * 0.6 + normalize(avg2, avgMin, avgMax) * 0.4;
                        const harmonicQuality = (q1 + q2) > 0 ? (2 * q1 * q2) / (q1 + q2) : 0;
                        const dprDiff = Math.abs(dpr1 - dpr2); const dprCloseness = 1 / (1 + dprDiff);
                        const avgDiff = Math.abs(avg1 - avg2); const avgCloseness = 1 / (1 + (avgDiff / 10));
                        const minQuality = Math.min(q1, q2);
                        const rawScore = (0.55 * harmonicQuality) + (0.30 * dprCloseness) + (0.15 * avgCloseness);
                        const score = rawScore * (0.6 + 0.4 * minQuality);
                        if (score > bestScore) { bestScore = score; bestId = mm.matchupId; }
                    });
                    return String(bestId) === String(matchup.matchupId);
                } catch (e) { return false; }
            })());

        const isFriskyGame = ((localStorage.getItem('friskyGame:v1') && JSON.parse(localStorage.getItem('friskyGame:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
            (String(nflState?.week) === String(matchup.week) && (() => {
                try {
                    const currentGameOfWeekId = isGameOfWeek ? matchup.matchupId : currentWeekMatchups.find(m => {
                        const storedId = (localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]);
                        if (storedId) return String(storedId) === String(m.matchupId);
                        return false;
                    })?.matchupId;
                    const friskyId = getFriskyGameId(currentWeekMatchups, currentGameOfWeekId);
                    return String(friskyId) === String(matchup.matchupId);
                } catch (e) { return false; }
            })());

        const cardBg = isGameOfWeek
            ? 'bg-yellow-900/30 border border-yellow-500/40 ring-1 ring-yellow-500/30'
            : isFriskyGame
            ? 'bg-purple-900/30 border border-purple-500/40 ring-1 ring-purple-500/30'
            : 'bg-gray-750 border border-white/8';

        const Avatar = ({ src, name, size = 7 }) => (
            <img
                src={src || 'https://sleepercdn.com/avatars/default_avatar.png'}
                alt={name}
                className={`w-${size} h-${size} rounded-full border border-white/20 flex-shrink-0 object-cover`}
                onError={(e) => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }}
            />
        );

        return (
            <div key={`${keyPrefix}-${idx}`} className={`mx-3 rounded-lg px-3 py-2.5 min-w-[240px] ${cardBg}`}>
                {bothZero ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                        <div className="flex items-center gap-2">
                            <Avatar src={matchup.team1.avatar} name={matchup.team1.name} size={6} />
                            <span className="text-xs font-medium text-gray-200 truncate max-w-[150px]">{matchup.team1.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">vs</span>
                        <div className="flex items-center gap-2">
                            <Avatar src={matchup.team2.avatar} name={matchup.team2.name} size={6} />
                            <span className="text-xs font-medium text-gray-200 truncate max-w-[150px]">{matchup.team2.name}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {[{ team: matchup.team1, score: t1Score }, { team: matchup.team2, score: t2Score }].map(({ team, score }, ti) => {
                            const isWinning = ti === 0 ? t1Score > t2Score : t2Score > t1Score;
                            return (
                                <div key={ti} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar src={team.avatar} name={team.name} />
                                        <span className={`text-xs font-medium truncate max-w-[130px] ${isWinning && !bothZero ? 'text-white' : 'text-gray-400'}`}>{team.name}</span>
                                    </div>
                                    <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${isWinning && !bothZero ? 'text-blue-400' : 'text-gray-500'}`}>
                                        {score > 0 ? formatScore(score) : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {isGameOfWeek && <div className="mt-1.5 text-center text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">⭐ Game of the Week</div>}
                {isFriskyGame && <div className="mt-1.5 text-center text-[10px] text-purple-400 font-semibold uppercase tracking-wider">🔥 Frisky Game</div>}
            </div>
        );
    };

    return (
        <>
            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-scroll         { animation: scroll 28s linear infinite; }
                .animate-scroll-reverse { animation: scroll 28s linear infinite reverse; }
                .animate-scroll-slow    { animation: scroll 90s linear infinite; }
                @media (max-width: 640px) {
                    .animate-scroll, .animate-scroll-reverse { animation-duration: 18s; }
                    .animate-scroll-slow { animation-duration: 40s; }
                }
            `}</style>

            <DashboardContainer className="max-w-full px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">

                {/* ── Page Header ──────────────────────────────────────────── */}
                <div className="text-center pt-2 pb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">TLOED Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {currentSeason ? `${currentSeason} Season` : 'Fantasy Football League'}
                        {nflState?.week ? ` · Week ${nflState.week}` : ''}
                    </p>
                </div>

                {/* ── Countdowns ───────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Countdown targetDate={TRADE_DEADLINE} label="Trade Deadline" />
                    <Countdown targetDate={DRAFT_DATE} label="Draft" />
                </div>

                {/* ── Matchups Ticker ──────────────────────────────────────── */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Week {nflState?.week || 1} Matchups
                        </span>
                    </div>
                    <div className="relative h-[72px] overflow-hidden">
                        <div className="absolute whitespace-nowrap flex items-center h-full animate-scroll-slow">
                            {currentWeekMatchups.length > 0 ? (
                                <>
                                    {currentWeekMatchups.map((matchup, idx) => renderMatchupCard(matchup, 'first', idx))}
                                    {currentWeekMatchups.map((matchup, idx) => renderMatchupCard(matchup, 'second', idx))}
                                </>
                            ) : (
                                <div className="text-sm text-gray-500 mx-6">No matchups available for this week</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Power Rankings ───────────────────────────────────────── */}
                <div className={`${card} -mx-4 sm:mx-0 rounded-none sm:rounded-xl overflow-hidden`}>
                    <PowerRankings />
                </div>

                {/* ── Financials ───────────────────────────────────────────── */}
                <CurrentSeasonFinancials />

                {/* ── Projected Playoff Bracket ────────────────────────────── */}
                <ProjectedPlayoffBracket />

                {/* ── Trending Players ─────────────────────────────────────── */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Trending · Last 24h</span>
                    </div>
                    <div className="py-3 space-y-2">
                        {/* Added - scroll left */}
                        <div className="relative overflow-hidden">
                            {trendingPlayers.loading ? (
                                <div className="px-4 text-xs text-gray-500">Loading adds…</div>
                            ) : trendingPlayers.added.length === 0 ? (
                                <div className="px-4 text-xs text-gray-500">No recent adds</div>
                            ) : (() => {
                                const nodes = trendingPlayers.added.map((p, idx) => {
                                    const player = nflPlayers?.[p.id];
                                    const name = player ? `${player.first_name} ${player.last_name}` : p.id;
                                    const count = p.raw?.count || null;
                                    const head = player ? `https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg` : null;
                                    return (
                                        <div key={`add-${p.id}-${idx}`} className="inline-flex items-center gap-2 bg-emerald-900/30 border border-emerald-500/25 rounded-full px-2.5 py-1" style={{ minWidth: 140 }}>
                                            {head ? (
                                                <img src={head} alt={name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-emerald-800 flex items-center justify-center text-[10px] font-semibold text-emerald-300 flex-shrink-0">
                                                    {player?.first_name?.[0] || '?'}
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs text-gray-200 font-medium truncate">{name}</span>
                                                {count && <span className="text-[10px] text-emerald-400 font-semibold">+{formatCount(count)}</span>}
                                            </div>
                                        </div>
                                    );
                                });
                                const doubled = [...nodes, ...nodes];
                                return <div className="whitespace-nowrap flex items-center gap-2.5 animate-scroll px-4">{doubled}</div>;
                            })()}
                        </div>

                        {/* Dropped - scroll right */}
                        <div className="relative overflow-hidden">
                            {trendingPlayers.loading ? (
                                <div className="px-4 text-xs text-gray-500">Loading drops…</div>
                            ) : trendingPlayers.dropped.length === 0 ? (
                                <div className="px-4 text-xs text-gray-500">No recent drops</div>
                            ) : (() => {
                                const nodes = trendingPlayers.dropped.slice().reverse().map((p, idx) => {
                                    const player = nflPlayers?.[p.id];
                                    const name = player ? `${player.first_name} ${player.last_name}` : p.id;
                                    const count = p.raw?.count || null;
                                    const head = player ? `https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg` : null;
                                    return (
                                        <div key={`drop-${p.id}-${idx}`} className="inline-flex items-center gap-2 bg-red-900/30 border border-red-500/25 rounded-full px-2.5 py-1" style={{ minWidth: 140 }}>
                                            {head ? (
                                                <img src={head} alt={name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-red-800 flex items-center justify-center text-[10px] font-semibold text-red-300 flex-shrink-0">
                                                    {player?.first_name?.[0] || '?'}
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs text-gray-200 font-medium truncate">{name}</span>
                                                {count && <span className="text-[10px] text-red-400 font-semibold">−{formatCount(count)}</span>}
                                            </div>
                                        </div>
                                    );
                                });
                                const doubled = [...nodes, ...nodes];
                                return <div className="whitespace-nowrap flex items-center gap-2.5 animate-scroll-reverse px-4">{doubled}</div>;
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── Recent Transactions ──────────────────────────────────── */}
                <div className={card}>
                    <div className={cardHeader}>
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Recent Transactions</span>
                    </div>

                    <div className="divide-y divide-white/5">
                        {recentTransactions.length > 0 ? recentTransactions.map((transaction) => (
                            <div key={transaction.id} className="hover:bg-white/[0.02] transition-colors">

                                {/* Transaction meta row */}
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${
                                            transaction.type === 'trade' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                            transaction.type === 'waiver' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                            'bg-gray-600/40 text-gray-300 border border-white/10'
                                        }`}>
                                            {formatTransactionType(transaction.type)}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${
                                            transaction.status === 'complete'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        }`}>
                                            {transaction.status}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-600 tabular-nums">
                                        {transaction.created.toLocaleDateString()} · {transaction.created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Trade layout */}
                                {transaction.type === 'trade' && transaction.tradeDetails ? (
                                    <div className="px-4 pb-3 space-y-3">
                                        {transaction.tradeDetails.map((team, teamIdx) => (
                                            <div key={teamIdx} className={teamIdx > 0 ? 'border-t border-white/5 pt-3' : ''}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <img src={team.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'} alt={team.name}
                                                        className="w-5 h-5 rounded-full border border-white/20 object-cover"
                                                        onError={(e) => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }} />
                                                    <span className="text-xs font-semibold text-gray-200">{team.name}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {/* Sends */}
                                                    {team.sends?.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">↑ Sends</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {team.sends.map((player, pi) => (
                                                                    <div key={pi} className="flex items-center gap-2 bg-red-900/20 border border-red-500/15 rounded-lg px-2 py-1.5">
                                                                        <img src={player.headshot} alt={player.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                        <div className="min-w-0">
                                                                            <div className="text-xs text-gray-200 font-medium truncate">{player.name}</div>
                                                                            <div className="text-[10px] text-gray-500">{player.position} · {player.team}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Receives */}
                                                    {team.receives?.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">↓ Receives</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {team.receives.map((player, pi) => (
                                                                    <div key={pi} className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-500/15 rounded-lg px-2 py-1.5">
                                                                        <img src={player.headshot} alt={player.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                        <div className="min-w-0">
                                                                            <div className="text-xs text-gray-200 font-medium truncate">{player.name}</div>
                                                                            <div className="text-[10px] text-gray-500">{player.position} · {player.team}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Picks sent */}
                                                    {team.sentPicks?.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">↑ Picks Sent</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {team.sentPicks.map((pick, pi) => (
                                                                    <span key={pi} className="bg-blue-900/30 border border-blue-500/25 rounded px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                                                                        {pick.season} R{pick.round}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Picks received */}
                                                    {team.receivedPicks?.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1">↓ Picks Received</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {team.receivedPicks.map((pick, pi) => (
                                                                    <span key={pi} className="bg-purple-900/30 border border-purple-500/25 rounded px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                                                                        {pick.season} R{pick.round}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* FAAB for trades */}
                                                {(() => {
                                                    const normalized = normalizeWaiverBudget(transaction.waiver_budget || transaction.metadata?.waiver_budget || []);
                                                    if (!normalized || normalized.length === 0) return null;
                                                    const hasTransfers = normalized.some(e => 'sender' in e || 'receiver' in e);
                                                    const total = normalized.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                                                    return (
                                                        <div className="mt-2 text-[10px] text-gray-500">
                                                            <span className="text-gray-400 font-semibold">FAAB Transferred: </span>
                                                            <span className="text-gray-300">{formatCurrency(total)}</span>
                                                            <div className="mt-0.5 space-y-0.5">
                                                                {hasTransfers ? normalized.map((n, i) => (
                                                                    <div key={i}>{n.sender ? `Roster ${n.sender}` : 'Sender'} → {n.receiver ? `Roster ${n.receiver}` : 'Receiver'}: {formatCurrency(n.amount)}</div>
                                                                )) : normalized.map((n, i) => (
                                                                    <div key={i}>{n.roster_id ? `Roster ${n.roster_id}` : 'Bid'}: {formatCurrency(n.amount)}</div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* Waiver / Free Agent layout */
                                    <div className="px-4 pb-3">
                                        {transaction.teamDetails?.[0] && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <img src={transaction.teamDetails[0].avatar || 'https://sleepercdn.com/avatars/default_avatar.png'} alt={transaction.teamDetails[0].name}
                                                    className="w-5 h-5 rounded-full border border-white/20 object-cover"
                                                    onError={(e) => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }} />
                                                <span className="text-xs font-semibold text-gray-200">{transaction.teamDetails[0].name}</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {transaction.addedPlayers.length > 0 && (
                                                <div>
                                                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">+ Added</div>
                                                    <div className="space-y-1">
                                                        {transaction.addedPlayers.map((player, pi) => (
                                                            <div key={pi} className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-500/15 rounded-lg px-2 py-1.5">
                                                                <img src={player.headshot} alt={player.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-200 font-medium truncate">{player.name}</div>
                                                                    <div className="text-[10px] text-gray-500">{player.position} · {player.team}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {transaction.droppedPlayers.length > 0 && (
                                                <div>
                                                    <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">− Dropped</div>
                                                    <div className="space-y-1">
                                                        {transaction.droppedPlayers.map((player, pi) => (
                                                            <div key={pi} className="flex items-center gap-2 bg-red-900/20 border border-red-500/15 rounded-lg px-2 py-1.5">
                                                                <img src={player.headshot} alt={player.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-gray-200 font-medium truncate">{player.name}</div>
                                                                    <div className="text-[10px] text-gray-500">{player.position} · {player.team}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* FAAB for waivers */}
                                        {(() => {
                                            const normalized = normalizeWaiverBudget(transaction.waiver_budget || transaction.metadata?.waiver_budget || []);
                                            if (!normalized || normalized.length === 0) return null;
                                            const total = normalized.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                                            return (
                                                <div className="mt-2 text-[10px] text-gray-500">
                                                    <span className="text-gray-400 font-semibold">FAAB Spent: </span>
                                                    <span className="text-gray-300">{formatCurrency(total)}</span>
                                                    <div className="mt-0.5 space-y-0.5">
                                                        {normalized.map((n, i) => (
                                                            <div key={i}>
                                                                {n.sender || n.receiver
                                                                    ? `${n.sender ? `Roster ${n.sender}` : 'Sender'} → ${n.receiver ? `Roster ${n.receiver}` : 'Receiver'}: ${formatCurrency(n.amount)}`
                                                                    : `${n.roster_id ? `Roster ${n.roster_id}` : 'Bid'}: ${formatCurrency(n.amount)}`}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="text-center text-gray-600 py-10 text-sm">No recent transactions</div>
                        )}
                    </div>
                </div>

            </DashboardContainer>
        </>
    );
};

export default Dashboard;