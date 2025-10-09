
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

    // Trending players (added / dropped) from Sleeper API
    const [trendingPlayers, setTrendingPlayers] = useState({ added: [], dropped: [], loading: true });

    // Format large counts into compact form (e.g. 1200 -> 1.2K, 1500000 -> 1.5M)
    const formatCount = (n) => {
        if (n === null || n === undefined) return '';
        const num = Number(n);
        if (Number.isNaN(num)) return String(n);
        const abs = Math.abs(num);
        if (abs >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
        if (abs >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
        return String(num);
    };

    // Format currency for FAAB display
    const formatCurrency = (v) => {
        const num = Number(v || 0);
        if (Number.isNaN(num)) return '$0.00';
        return num.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    };

    // Normalize waiver_budget into a predictable array of entries:
    // Supports shapes like:
    //  - [{ sender: 2, receiver: 3, amount: 55 }, ...]
    //  - [{ roster_id: '3', amount: 10 }, ...]
    //  - [{ user_id: 'u', bid: 5 }, ...]
    //  - [55, ...]
    const normalizeWaiverBudget = (wb) => {
        if (!wb) return [];
        try {
            if (!Array.isArray(wb)) return [];
            return wb.map(item => {
                if (item && typeof item === 'object') {
                    // sender/receiver style
                    if ('sender' in item || 'receiver' in item) {
                        return {
                            sender: item.sender ?? item.from ?? item.roster_id ?? null,
                            receiver: item.receiver ?? item.to ?? item.roster_id ?? null,
                            amount: Number(item.amount ?? item.bid ?? item.faab ?? item.wbid ?? 0)
                        };
                    }

                    // roster_id / amount style
                    return {
                        roster_id: item.roster_id ?? item.rosterId ?? item.user_id ?? item.owner_id ?? item.ownerId ?? null,
                        amount: Number(item.amount ?? item.bid ?? item.faab ?? item.wbid ?? 0)
                    };
                }
                // primitive number case
                return { roster_id: null, amount: Number(item) || 0 };
            });
        } catch (e) {
            return [];
        }
    };

    // make fetch function reusable so we can refresh on demand
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

    // Get current week matchups
    const currentWeekMatchups = useMemo(() => {
        if (!historicalData || !currentSeason || !nflState) return [];
        
        const currentWeek = nflState.week ? parseInt(nflState.week) : 1;
        
        // Determine the current season, same logic as other components
        let season = currentSeason;
        if (!season) {
            const years = Object.keys(historicalData.matchupsBySeason || {});
            if (years.length > 0) {
                season = Math.max(...years.map(Number)).toString();
            }
        }
        
        const matchups = historicalData.matchupsBySeason?.[season] || [];
        
        // Get rosters for the same season
        const rosters = historicalData.rostersBySeason?.[season] || [];
        
        const weekMatchups = matchups.filter(m => parseInt(m.week) === currentWeek);
        
        return weekMatchups.map(m => {
            // Find rosters for team1 and team2
            const team1Roster = rosters.find(r => String(r.roster_id) === String(m.team1_roster_id));
            const team2Roster = rosters.find(r => String(r.roster_id) === String(m.team2_roster_id));
            
            const team1OwnerId = team1Roster?.owner_id;
            const team2OwnerId = team2Roster?.owner_id;
            
            return {
                team1: {
                    ownerId: team1OwnerId,
                    name: getTeamName(team1OwnerId, season),
                    score: m.team1_score || 0,
                    avatar: getTeamDetails(team1OwnerId, season)?.avatar
                },
                team2: {
                    ownerId: team2OwnerId,
                    name: getTeamName(team2OwnerId, season),
                    score: m.team2_score || 0,
                    avatar: getTeamDetails(team2OwnerId, season)?.avatar
                },
                team1RosterId: String(m.team1_roster_id),
                team2RosterId: String(m.team2_roster_id),
                matchupId: m.matchup_id,
                week: m.week,
                isCompleted: (m.team1_score || 0) > 0 || (m.team2_score || 0) > 0
            };
        });
    }, [historicalData, currentSeason, nflState, getTeamName, getTeamDetails]);

    // Weekly luck data for current season
    const weeklyLuckData = useMemo(() => {
        if (!processedSeasonalRecords || !currentSeason || !processedSeasonalRecords[currentSeason]) {
            return {};
        }

        const luckDataForSeason = {};
        const teams = processedSeasonalRecords[currentSeason];

        Object.keys(teams).forEach(rosterId => {
            const team = teams[rosterId];
            if (team.weeklyLuck) {
                luckDataForSeason[rosterId] = team.weeklyLuck;
            }
        });

        return luckDataForSeason;
    }, [processedSeasonalRecords, currentSeason]);

    // Helper function to determine Frisky Game of the Week
    const getFriskyGameId = useCallback((matchups, gameOfWeekId) => {
        if (!matchups || matchups.length === 0 || !weeklyLuckData || !nflState) return null;

        // Always use the latest completed week's luck scores to determine team spreads
        // This works for both current week (use latest completed) and dashboard display
        const anyTeam = Object.keys(weeklyLuckData)[0];
        const weeksAvailable = anyTeam ? (weeklyLuckData[anyTeam] || []).length : 0;
        const weekToUseForLuck = weeksAvailable; // Always use the latest available week
        
        if (weekToUseForLuck <= 0) return null;

        // Calculate luck differences for each matchup using latest completed week's luck
        const matchupLuckData = matchups.map(m => {
            const team1RosterId = String(m.team1RosterId);
            const team2RosterId = String(m.team2RosterId);

            const team1Luck = weeklyLuckData[team1RosterId]?.[weekToUseForLuck - 1] ?? 0;
            const team2Luck = weeklyLuckData[team2RosterId]?.[weekToUseForLuck - 1] ?? 0;

            const luckDifference = Math.abs(team1Luck - team2Luck);

            return {
                matchupId: m.matchupId,
                luckDifference,
                team1Luck,
                team2Luck
            };
        });

        // Sort by luck difference (descending)
        matchupLuckData.sort((a, b) => b.luckDifference - a.luckDifference);

        // If no matchups have luck differences, return null
        if (matchupLuckData.length === 0 || matchupLuckData[0].luckDifference === 0) return null;

        // If the largest luck difference matchup is the same as Game of the Week, use the second largest
        if (matchupLuckData.length > 1 && String(matchupLuckData[0].matchupId) === String(gameOfWeekId)) {
            return matchupLuckData[1].matchupId;
        }

        return matchupLuckData[0].matchupId;
    }, [weeklyLuckData, nflState]);

    // Get recent transactions (last 10)
    const recentTransactions = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];
        
        return [...transactions]
            .filter(transaction => {
                // Filter out failed transactions and commissioner moves
                return transaction.status !== 'failed' && 
                       transaction.creator !== 'commissioner' &&
                       transaction.type !== 'commissioner';
            })
            .sort((a, b) => b.created - a.created)
            .slice(0, 10)
            .map(transaction => {
                // Find rosters using the same season logic as other calculations
                let season = currentSeason;
                if (!season) {
                    const years = Object.keys(historicalData?.rostersBySeason || {});
                    if (years.length > 0) {
                        season = Math.max(...years.map(Number)).toString();
                    }
                }
                
                const rosters = historicalData?.rostersBySeason?.[season] || [];
                
                // Get team details for the transaction
                const teamDetails = [];
                if (transaction.roster_ids && transaction.roster_ids.length > 0) {
                    transaction.roster_ids.forEach(rosterId => {
                        const roster = rosters.find(r => String(r.roster_id) === String(rosterId));
                        if (roster) {
                            teamDetails.push({
                                ownerId: roster.owner_id,
                                name: getTeamName(roster.owner_id, season),
                                avatar: getTeamDetails(roster.owner_id, season)?.avatar
                            });
                        }
                    });
                }
                
                // Process trade data differently for proper team-by-team breakdown
                let tradeDetails = null;
                if (transaction.type === 'trade') {
                    tradeDetails = teamDetails.map(team => {
                        const teamRosterId = transaction.roster_ids.find(rosterId => {
                            const roster = rosters.find(r => String(r.roster_id) === String(rosterId));
                            return roster?.owner_id === team.ownerId;
                        });
                        
                        const teamAdds = [];
                        const teamDrops = [];
                        
                        // For trades, adds are what the team receives, drops are what they send
                        if (transaction.adds) {
                            Object.keys(transaction.adds).forEach(playerId => {
                                if (String(transaction.adds[playerId]) === String(teamRosterId)) {
                                    const player = nflPlayers?.[playerId];
                                    teamAdds.push({
                                        id: playerId,
                                        name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`,
                                        position: player?.position || 'N/A',
                                        team: player?.team || 'FA',
                                        headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null
                                    });
                                }
                            });
                        }
                        
                        if (transaction.drops) {
                            Object.keys(transaction.drops).forEach(playerId => {
                                if (String(transaction.drops[playerId]) === String(teamRosterId)) {
                                    const player = nflPlayers?.[playerId];
                                    teamDrops.push({
                                        id: playerId,
                                        name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`,
                                        position: player?.position || 'N/A',
                                        team: player?.team || 'FA',
                                        headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null
                                    });
                                }
                            });
                        }
                        
                        // Process draft picks for this team
                        const teamDraftPicksReceived = [];
                        const teamDraftPicksSent = [];
                        
                        if (transaction.draft_picks && Array.isArray(transaction.draft_picks)) {
                            transaction.draft_picks.forEach(pick => {
                                // Based on API data analysis:
                                // owner_id: who gets the pick after the trade
                                // previous_owner_id: who had the pick before the trade
                                
                                // If this team gets the pick (owner_id matches)
                                if (String(pick.owner_id) === String(teamRosterId)) {
                                    teamDraftPicksReceived.push({
                                        season: pick.season,
                                        round: pick.round,
                                        fromRoster: pick.previous_owner_id
                                    });
                                }
                                
                                // If this team originally had the pick (previous_owner_id matches)
                                if (String(pick.previous_owner_id) === String(teamRosterId)) {
                                    teamDraftPicksSent.push({
                                        season: pick.season,
                                        round: pick.round,
                                        toRoster: pick.owner_id
                                    });
                                }
                            });
                        }
                        
                        return {
                            ...team,
                            receives: teamAdds,
                            sends: teamDrops,
                            receivedPicks: teamDraftPicksReceived,
                            sentPicks: teamDraftPicksSent
                        };
                    });
                }
                
                // Get player details for adds and drops (for non-trade transactions)
                const addedPlayers = Object.keys(transaction.adds || {}).map(playerId => {
                    const player = nflPlayers?.[playerId];
                    return {
                        id: playerId,
                        name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`,
                        position: player?.position || 'N/A',
                        team: player?.team || 'FA',
                        headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null
                    };
                });
                
                const droppedPlayers = Object.keys(transaction.drops || {}).map(playerId => {
                    const player = nflPlayers?.[playerId];
                    return {
                        id: playerId,
                        name: player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`,
                        position: player?.position || 'N/A',
                        team: player?.team || 'FA',
                        headshot: player ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null
                    };
                });
                
                return {
                    id: transaction.transaction_id,
                    type: transaction.type,
                    status: transaction.status,
                    created: new Date(transaction.created),
                    teamDetails,
                    addedPlayers,
                    droppedPlayers,
                    tradeDetails,
                    draftPicks: transaction.draft_picks || [],
                    waiver_budget: transaction.waiver_budget || []
                };
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
        
        // For trades, show the teams involved
        if (transaction.type === 'trade') {
            const playerCount = addedPlayers.length + droppedPlayers.length;
            return `Trade involving ${playerCount} player${playerCount !== 1 ? 's' : ''}`;
        }
        
        // For waivers and free agents
        if (addedPlayers.length > 0 && droppedPlayers.length > 0) {
            return `Added ${addedPlayers[0].name}, dropped ${droppedPlayers[0].name}`;
        } else if (addedPlayers.length > 0) {
            return `Added ${addedPlayers[0].name}`;
        } else if (droppedPlayers.length > 0) {
            return `Dropped ${droppedPlayers[0].name}`;
        }
        return 'Transaction processed';
    };

    if (contextLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[200px] bg-gradient-to-r from-blue-50 to-gray-100 py-8">
                <div className="text-xl text-gray-500 animate-pulse">Loading dashboard...</div>
            </div>
        );
    }

    if (contextError) {
        return (
            <div className="w-full flex items-center justify-center min-h-[200px] bg-gradient-to-r from-red-50 to-gray-100 py-8">
                <div className="text-xl text-red-500">Error: {contextError}</div>
            </div>
        );
    }

    // Small reusable countdown component (styled to match dashboard cards)
    const Countdown = ({ targetDate, label }) => {
        const [now, setNow] = useState(() => new Date());

        useEffect(() => {
            const t = setInterval(() => setNow(new Date()), 1000);
            return () => clearInterval(t);
        }, []);

            const diff = targetDate ? targetDate.getTime() - now.getTime() : 0;
        const isPassed = diff <= 0;
        const isSoon = diff > 0 && diff < (1000 * 60 * 60 * 24); // <24h

        if (!targetDate) return (
            <div className="flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 w-full sm:w-40">
                <div className="flex flex-col items-center max-w-full">
                    <div className="text-xs text-blue-800 font-medium truncate">{label}</div>
                    <div className="text-sm font-semibold text-gray-700" style={{fontVariantNumeric: 'tabular-nums'}}>N/A</div>
                </div>
            </div>
        );

        if (isPassed) {
            return (
                <div className="flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 w-full sm:w-40">
                    <div className="flex flex-col items-center max-w-full">
                        <div className="text-xs text-blue-800 font-medium truncate">{label}</div>
                        <div className="text-sm font-semibold text-gray-500" style={{fontVariantNumeric: 'tabular-nums'}}>Passed</div>
                    </div>
                </div>
            );
        }

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
            <div className={`flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2 w-full sm:w-40 ${isSoon ? 'ring-1 ring-yellow-200' : ''}`}>
                <div className="flex flex-col items-center max-w-full">
                    <div className="text-xs text-blue-800 font-medium truncate">{label}</div>
                    <div className={`text-sm font-semibold ${isSoon ? 'text-yellow-700' : 'text-gray-800'}`} style={{fontVariantNumeric: 'tabular-nums'}}>{parts.join(' ')}</div>
                </div>
            </div>
        );
    };

    // Dates for trade deadline and draft are stored in config as explicit ISO timestamps
    // with an Eastern timezone offset (e.g. '2025-11-10T20:15:00-05:00'). This avoids
    // DST ambiguity; parse them directly into Date objects here.
    const TRADE_DEADLINE = useMemo(() => (TRADE_DEADLINE_ISO ? new Date(TRADE_DEADLINE_ISO) : null), [TRADE_DEADLINE_ISO]);
    const DRAFT_DATE = useMemo(() => (DRAFT_DATE_ISO ? new Date(DRAFT_DATE_ISO) : null), [DRAFT_DATE_ISO]);

    return (
        <>
            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                /* baseline speed: slightly faster */
                .animate-scroll {
                    animation: scroll 28s linear infinite;
                }
                /* reverse direction for the second row */
                .animate-scroll-reverse {
                    animation: scroll 28s linear infinite reverse;
                }
                /* slower animation for matchups ticker */
                .animate-scroll-slow {
                    animation: scroll 90s linear infinite;
                }

                /* Mobile: speed up trending tickers but keep matchups comfortable */
                @media (max-width: 640px) {
                    .animate-scroll, .animate-scroll-reverse {
                        animation-duration: 18s;
                    }
                    .animate-scroll-slow {
                        animation-duration: 40s;
                    }
                }
            `}</style>
            <DashboardContainer className="space-y-4 sm:space-y-6 md:space-y-8">

            {/* Header */}
            <div className="text-center px-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-800 mb-2">TLOED Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">
                    {currentSeason ? `${currentSeason} Season` : 'Fantasy Football League'} 
                    {nflState?.week ? ` • Week ${nflState.week}` : ''}
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {/* Small countdowns row: Trade deadline and Draft date */}
                <div className="xl:col-span-3">
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-2 px-2">
                        <Countdown targetDate={TRADE_DEADLINE} label="Trade Deadline" />
                        <Countdown targetDate={DRAFT_DATE} label="Draft" />
                    </div>
                </div>
                {/* Current Week Matchups - Ticker Style */}
                <div className="xl:col-span-3">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        <div className="flex items-center py-2 px-4 bg-gray-50 border-b border-gray-200">
                            <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700">Week {nflState?.week || 1} Matchups</span>
                        </div>
                        <div className="relative h-20 overflow-hidden">
                                    <div className="absolute whitespace-nowrap flex items-center h-full animate-scroll-slow">
                                {currentWeekMatchups.length > 0 ? (
                                    <>
                                        {/* First set of matchups */}
                                        {currentWeekMatchups.map((matchup, idx) => {
                                            const t1Score = Number(matchup.team1.score || 0);
                                            const t2Score = Number(matchup.team2.score || 0);
                                            const bothZero = t1Score === 0 && t2Score === 0;
                                            
                                            // Check if this is Game of the Week
                                            const isGameOfWeek = ((localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
                                                    (String(nflState?.week) === String(matchup.week) && (() => {
                                                        // compute live candidate if processedSeasonalRecords available
                                                        try {
                                                            if (!processedSeasonalRecords) return false;
                                                            const seasonData = processedSeasonalRecords?.[currentSeason] || {};
                                                            const dprVals = Object.values(seasonData).map(t => Number(t?.dpr ?? 0)).filter(v => !isNaN(v));
                                                            const avgVals = Object.values(seasonData).map(t => Number(t?.averageScore ?? t?.avgPerGame ?? 0)).filter(v => !isNaN(v));
                                                            const dprMin = dprVals.length ? Math.min(...dprVals) : 0;
                                                            const dprMax = dprVals.length ? Math.max(...dprVals) : 1;
                                                            const avgMin = avgVals.length ? Math.min(...avgVals) : 0;
                                                            const avgMax = avgVals.length ? Math.max(...avgVals) : 1;
                                                            const normalize = (v, min, max) => (max === min ? 0.5 : (v - min) / (max - min));

                                                            // compute best id
                                                            let bestId = null; let bestScore = -Infinity;
                                                            currentWeekMatchups.forEach(mm => {
                                                                const r1 = String(mm.team1RosterId);
                                                                const r2 = String(mm.team2RosterId);
                                                                const t1 = seasonData[r1] || {};
                                                                const t2 = seasonData[r2] || {};
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

                                            // Check for stored Frisky Game or compute it
                                            const gameOfWeekId = isGameOfWeek ? matchup.matchupId : null;
                                            const isFriskyGame = ((localStorage.getItem('friskyGame:v1') && JSON.parse(localStorage.getItem('friskyGame:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
                                                (String(nflState?.week) === String(matchup.week) && (() => {
                                                    try {
                                                        const currentGameOfWeekId = isGameOfWeek ? matchup.matchupId : 
                                                            currentWeekMatchups.find(m => {
                                                                const storedId = (localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]);
                                                                if (storedId) return String(storedId) === String(m.matchupId);
                                                                // Try to compute it...
                                                                return false; // Simplified for now
                                                            })?.matchupId;
                                                        const friskyId = getFriskyGameId(currentWeekMatchups, currentGameOfWeekId);
                                                        return String(friskyId) === String(matchup.matchupId);
                                                    } catch (e) { return false; }
                                                })());
                                            
                                            return (
                                                <div key={`first-${idx}`} className={`mx-6 rounded-lg px-4 py-3 min-w-[260px] ${
                                                    isGameOfWeek ? 'ring-4 ring-yellow-400 ring-opacity-60 bg-yellow-50 border-yellow-300' : 
                                                    isFriskyGame ? 'ring-4 ring-purple-400 ring-opacity-60 bg-purple-50 border-purple-300' : 
                                                    'bg-gray-50 border border-gray-200'
                                                }`}>
                                                    {bothZero ? (
                                                        // Vertical middle-aligned stack: Team1, 'vs', Team2
                                                        <div className="flex flex-col items-center justify-center text-center space-y-1">
                                                            <div className="flex items-center space-x-2">
                                                                <img
                                                                    src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                    alt={matchup.team1.name}
                                                                    className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                />
                                                                <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team1.name}</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-semibold">vs</div>
                                                            <div className="flex items-center space-x-2">
                                                                <img
                                                                    src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                    alt={matchup.team2.name}
                                                                    className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                />
                                                                <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team2.name}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Stacked layout with left-aligned names and right-aligned scores
                                                        <>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-3 min-w-0">
                                                                    <img
                                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                        alt={matchup.team1.name}
                                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team1.name}</span>
                                                                </div>
                                                                <div className="flex-shrink-0 text-right ml-4 w-20">
                                                                    {t1Score > 0 ? (
                                                                        <div className="text-sm font-bold text-gray-800">{formatScore(t1Score)}</div>
                                                                    ) : (
                                                                        <div className="text-xs text-gray-500">&nbsp;</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center space-x-3 min-w-0">
                                                                    <img
                                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                        alt={matchup.team2.name}
                                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team2.name}</span>
                                                                </div>
                                                                <div className="flex-shrink-0 text-right ml-4 w-20">
                                                                    {t2Score > 0 ? (
                                                                        <div className="text-sm font-bold text-gray-800">{formatScore(t2Score)}</div>
                                                                    ) : (
                                                                        <div className="text-xs text-gray-500">&nbsp;</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {/* Duplicate set for seamless loop */}
                                        {currentWeekMatchups.map((matchup, idx) => {
                                            const t1Score = Number(matchup.team1.score || 0);
                                            const t2Score = Number(matchup.team2.score || 0);
                                            const bothZero = t1Score === 0 && t2Score === 0;
                                            // Use same highlight logic as first ticker pass
                                            const isGameOfWeek = ((localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
                                                (String(nflState?.week) === String(matchup.week) && (() => {
                                                    try {
                                                        if (!processedSeasonalRecords) return false;
                                                        const seasonData = processedSeasonalRecords?.[currentSeason] || {};
                                                        const dprVals = Object.values(seasonData).map(t => Number(t?.dpr ?? 0)).filter(v => !isNaN(v));
                                                        const avgVals = Object.values(seasonData).map(t => Number(t?.averageScore ?? t?.avgPerGame ?? 0)).filter(v => !isNaN(v));
                                                        const dprMin = dprVals.length ? Math.min(...dprVals) : 0;
                                                        const dprMax = dprVals.length ? Math.max(...dprVals) : 1;
                                                        const avgMin = avgVals.length ? Math.min(...avgVals) : 0;
                                                        const avgMax = avgVals.length ? Math.max(...avgVals) : 1;
                                                        const normalize = (v, min, max) => (max === min ? 0.5 : (v - min) / (max - min));

                                                        let bestId = null; let bestScore = -Infinity;
                                                        currentWeekMatchups.forEach(mm => {
                                                            const r1 = String(mm.team1RosterId);
                                                            const r2 = String(mm.team2RosterId);
                                                            const t1 = seasonData[r1] || {};
                                                            const t2 = seasonData[r2] || {};
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

                                            // Check for Frisky Game
                                            const gameOfWeekId = isGameOfWeek ? matchup.matchupId : null;
                                            const isFriskyGame = ((localStorage.getItem('friskyGame:v1') && JSON.parse(localStorage.getItem('friskyGame:v1') || '{}')[currentSeason]?.[String(nflState?.week)]) === String(matchup.matchupId)) ||
                                                (String(nflState?.week) === String(matchup.week) && (() => {
                                                    try {
                                                        const currentGameOfWeekId = isGameOfWeek ? matchup.matchupId : 
                                                            currentWeekMatchups.find(m => {
                                                                const storedId = (localStorage.getItem('gameOfWeek:v1') && JSON.parse(localStorage.getItem('gameOfWeek:v1') || '{}')[currentSeason]?.[String(nflState?.week)]);
                                                                if (storedId) return String(storedId) === String(m.matchupId);                                                            
                                                                return false; // Simplified for now
                                                            })?.matchupId;
                                                        const friskyId = getFriskyGameId(currentWeekMatchups, currentGameOfWeekId);
                                                        return String(friskyId) === String(matchup.matchupId);
                                                    } catch (e) { return false; }
                                                })());

                                            return (
                                                <div key={`second-${idx}`} className={`mx-6 rounded-lg px-4 py-3 min-w-[260px] ${
                                                    isGameOfWeek ? 'ring-4 ring-yellow-400 ring-opacity-60 bg-yellow-50 border-yellow-300' : 
                                                    isFriskyGame ? 'ring-4 ring-purple-400 ring-opacity-60 bg-purple-50 border-purple-300' : 
                                                    'bg-gray-50 border border-gray-200'
                                                }`}>
                                                    {bothZero ? (
                                                        <div className="flex flex-col items-center justify-center text-center space-y-1">
                                                            <div className="flex items-center space-x-2">
                                                                <img
                                                                    src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                    alt={matchup.team1.name}
                                                                    className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                />
                                                                <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team1.name}</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-semibold">vs</div>
                                                            <div className="flex items-center space-x-2">
                                                                <img
                                                                    src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                    alt={matchup.team2.name}
                                                                    className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                />
                                                                <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{matchup.team2.name}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-3 min-w-0">
                                                                    <img
                                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                        alt={matchup.team1.name}
                                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{matchup.team1.name}</span>
                                                                </div>
                                                                <div className="flex-shrink-0 text-right ml-4 w-20">
                                                                    {t1Score > 0 ? (
                                                                        <div className="text-sm font-bold text-gray-800">{formatScore(t1Score)}</div>
                                                                    ) : (
                                                                        <div className="text-xs text-gray-500">&nbsp;</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between mt-2">
                                                                <div className="flex items-center space-x-3 min-w-0">
                                                                    <img
                                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                                        alt={matchup.team2.name}
                                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{matchup.team2.name}</span>
                                                                </div>
                                                                <div className="flex-shrink-0 text-right ml-4 w-20">
                                                                    {t2Score > 0 ? (
                                                                        <div className="text-sm font-bold text-gray-800">{formatScore(t2Score)}</div>
                                                                    ) : (
                                                                        <div className="text-xs text-gray-500">&nbsp;</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500 mx-4">No matchups available for this week</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Power Rankings Section */}
            <div className="bg-white rounded-lg shadow-lg mobile-card">
                <PowerRankings />
            </div>

            {/* Current Season Financials */}
            <CurrentSeasonFinancials />

            {/* Projected Playoff Bracket */}
            <ProjectedPlayoffBracket />

            {/* Recent Transactions */}
            {/* Trending players ticker (Added on top -> left, Dropped underneath -> right) */}
            <div className="bg-white rounded-lg shadow-lg mobile-card p-3 sm:p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Trending (last 24h)</h3>
                <div className="space-y-2">
                    {/* Added - scroll left */}
                    <div className="relative overflow-hidden">
                        {trendingPlayers.loading ? (
                            <div className="p-2 text-sm text-gray-500">Loading adds…</div>
                        ) : trendingPlayers.added.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No recent adds</div>
                        ) : (
                            (() => {
                                const nodes = trendingPlayers.added.map((p, idx) => {
                                    const player = nflPlayers?.[p.id];
                                    const name = player ? `${player.first_name} ${player.last_name}` : p.id;
                                    const count = p.raw?.count || null;
                                    const head = player ? `https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg` : null;
                                    return (
                                        <div key={`add-${p.id}-${idx}`} className="inline-flex items-center space-x-2 bg-green-50 border border-green-200 rounded-full px-2 py-1" style={{minWidth: head ? 160 : 120}}>
                                            {head ? (
                                                <img src={head} alt={name} className="w-6 h-6 rounded-full object-cover" onError={(e)=>{e.target.style.display='none'}} />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center text-xs font-medium text-green-800">{(player && player.first_name ? player.first_name[0] : '?')}</div>
                                            )}
                                            <div className="flex flex-col items-start min-w-0 max-w-[180px] whitespace-normal break-words">
                                                <div className="text-xs text-gray-800 font-medium">{name}</div>
                                                <div className="text-[11px] text-green-700 font-semibold mt-0.5">{count ? `+${formatCount(count)}` : ''}</div>
                                            </div>
                                        </div>
                                    );
                                });
                                const doubled = [...nodes, ...nodes];
                                return <div className="whitespace-nowrap flex items-center gap-3 animate-scroll" style={{padding: '6px 8px'}}>{doubled}</div>;
                            })()
                        )}
                    </div>

                    {/* Dropped - scroll right (reverse) */}
                    <div className="relative overflow-hidden">
                        {trendingPlayers.loading ? (
                            <div className="p-2 text-sm text-gray-500">Loading drops…</div>
                        ) : trendingPlayers.dropped.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No recent drops</div>
                        ) : (
                            (() => {
                                const nodes = trendingPlayers.dropped.slice().reverse().map((p, idx) => {
                                    const player = nflPlayers?.[p.id];
                                    const name = player ? `${player.first_name} ${player.last_name}` : p.id;
                                    const count = p.raw?.count || null;
                                    const head = player ? `https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg` : null;
                                    return (
                                        <div key={`drop-${p.id}-${idx}`} className="inline-flex items-center space-x-2 bg-red-50 border border-red-200 rounded-full px-2 py-1" style={{minWidth: head ? 160 : 120}}>
                                            {head ? (
                                                <img src={head} alt={name} className="w-6 h-6 rounded-full object-cover" onError={(e)=>{e.target.style.display='none'}} />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center text-xs font-medium text-red-800">{(player && player.first_name ? player.first_name[0] : '?')}</div>
                                            )}
                                            <div className="flex flex-col items-start min-w-0 max-w-[180px] whitespace-normal break-words">
                                                <div className="text-xs text-gray-800 font-medium">{name}</div>
                                                <div className="text-[11px] text-red-700 font-semibold mt-0.5">{count ? `-${formatCount(count)}` : ''}</div>
                                            </div>
                                        </div>
                                    );
                                });
                                const doubled = [...nodes, ...nodes];
                                return <div className="whitespace-nowrap flex items-center gap-3 animate-scroll-reverse" style={{padding: '6px 8px'}}>{doubled}</div>;
                            })()
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="mobile-text-lg">Recent Transactions</span>
                </h2>
                <div className="space-y-2">
                    {recentTransactions.length > 0 ? recentTransactions.map((transaction, idx) => (
                        <div key={transaction.id} className="bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors">
                            {/* Compact Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                                <div className="flex items-center space-x-2">
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                        {formatTransactionType(transaction.type)}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        transaction.status === 'complete' ? 'bg-green-100 text-green-800' : 
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {transaction.status}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {transaction.created.toLocaleDateString()} • {transaction.created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            
                            {/* Compact Trade Layout */}
                            {transaction.type === 'trade' && transaction.tradeDetails ? (
                                <div className="px-3 pb-3">
                                    {transaction.tradeDetails.map((team, teamIdx) => (
                                        <div key={teamIdx} className={`${teamIdx > 0 ? 'border-t border-gray-200 pt-3 mt-3' : ''}`}>
                                            {/* Compact Team Header */}
                                            <div className="flex items-center space-x-2 mb-2">
                                                <img
                                                    src={team.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                    alt={team.name}
                                                    className="w-6 h-6 rounded-full border border-gray-300"
                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                />
                                                <h4 className="font-medium text-gray-800 text-sm">{team.name}</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                {/* Compact Sends */}
                                                {team.sends && team.sends.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-1 mb-1">
                                                            <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                            </svg>
                                                            <span className="font-medium text-red-700 text-xs">Sends</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {team.sends.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-2 bg-red-50 rounded p-1.5">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-6 h-6 rounded-full border object-cover"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 text-xs truncate">{player.name}</div>
                                                                        <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Compact Receives */}
                                                {team.receives && team.receives.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-1 mb-1">
                                                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                                            </svg>
                                                            <span className="font-medium text-green-700 text-xs">Receives</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {team.receives.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-2 bg-green-50 rounded p-1.5">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-6 h-6 rounded-full border object-cover"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 text-xs truncate">{player.name}</div>
                                                                        <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Compact Draft Picks Sent */}
                                                {team.sentPicks && team.sentPicks.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-1 mb-1">
                                                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                            </svg>
                                                            <span className="font-medium text-blue-700 text-xs">Picks Sent</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {team.sentPicks.map((pick, pickIdx) => (
                                                                <div key={pickIdx} className="bg-blue-50 rounded px-2 py-1 text-xs">
                                                                    <span className="font-medium text-blue-800">
                                                                        {pick.season} R{pick.round}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Compact Draft Picks Received */}
                                                {team.receivedPicks && team.receivedPicks.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-1 mb-1">
                                                            <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                                            </svg>
                                                            <span className="font-medium text-purple-700 text-xs">Picks Received</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {team.receivedPicks.map((pick, pickIdx) => (
                                                                <div key={pickIdx} className="bg-purple-50 rounded px-2 py-1 text-xs">
                                                                    <span className="font-medium text-purple-800">
                                                                        {pick.season} R{pick.round}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {/* FAAB / Waiver budget for trades (if present) */}
                                    {(() => {
                                        const normalized = normalizeWaiverBudget(transaction.waiver_budget || transaction.metadata?.waiver_budget || []);
                                        if (!normalized || normalized.length === 0) return null;
                                        const hasTransfers = normalized.some(e => 'sender' in e || 'receiver' in e);
                                        const total = normalized.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                                        return (
                                            <div className="mt-3 text-xs text-gray-600">
                                                <div className="font-medium text-gray-800">FAAB Transferred: <span className="text-sm text-gray-700">{formatCurrency(total)}</span></div>
                                                <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-gray-600">
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
                            ) : (
                                /* Compact Non-Trade Layout (Waiver/Free Agent) */
                                <div className="px-3 pb-3">
                                    {/* Compact Team Header */}
                                    {transaction.teamDetails && transaction.teamDetails.length > 0 && (
                                        <div className="flex items-center space-x-2 mb-2">
                                            <img
                                                src={transaction.teamDetails[0].avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                alt={transaction.teamDetails[0].name}
                                                className="w-6 h-6 rounded-full border border-gray-300"
                                                onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                            />
                                            <h4 className="font-medium text-gray-800 text-sm">{transaction.teamDetails[0].name}</h4>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                        {/* Compact Added Players */}
                                        {transaction.addedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-1 mb-1">
                                                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                    </svg>
                                                    <span className="font-medium text-green-700 text-xs">Added</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {transaction.addedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-2 bg-green-50 rounded p-1.5 border border-green-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-6 h-6 rounded-full border border-green-300 object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-800 text-xs truncate">{player.name}</div>
                                                                <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Compact Dropped Players */}
                                        {transaction.droppedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-1 mb-1">
                                                    <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                                                    </svg>
                                                    <span className="font-medium text-red-700 text-xs">Dropped</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {transaction.droppedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-2 bg-red-50 rounded p-1.5 border border-red-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-6 h-6 rounded-full border border-red-300 object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-800 text-xs truncate">{player.name}</div>
                                                                <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* FAAB / Waiver bid details (if available) */}
                                    {(() => {
                                        const normalized = normalizeWaiverBudget(transaction.waiver_budget || transaction.metadata?.waiver_budget || []);
                                        if (!normalized || normalized.length === 0) return null;
                                        const total = normalized.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                                        return (
                                            <div className="mt-3 text-xs text-gray-600">
                                                <div className="font-medium text-gray-800">FAAB Spent: <span className="text-sm text-gray-700">{formatCurrency(total)}</span></div>
                                                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                    {normalized.map((n, i) => (
                                                        <div key={i} className="text-xs text-gray-600">
                                                            {n.sender || n.receiver ? (
                                                                `${n.sender ? `Roster ${n.sender}` : 'Sender'} → ${n.receiver ? `Roster ${n.receiver}` : 'Receiver'}: ${formatCurrency(n.amount)}`
                                                            ) : (
                                                                `${n.roster_id ? `Roster ${n.roster_id}` : 'Bid'}: ${formatCurrency(n.amount)}`
                                                            )}
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
                        <div className="text-center text-gray-500 py-8 text-base">No recent transactions</div>
                    )}
                </div>
            </div>
            </DashboardContainer>
        </>
    );
};

export default Dashboard;
