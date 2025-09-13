
import React, { useCallback, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

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
        nflState
    } = useSleeperData();

    // Calculate current standings
    const currentStandings = useMemo(() => {
        if (!historicalData || !currentSeason || !nflState) return [];
        
        try {
            const metricsResult = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
            const seasonalMetrics = metricsResult?.seasonalMetrics || {};
            
            // Determine the current season, same logic as PowerRankings
            let season = currentSeason;
            if (!season) {
                const years = Object.keys(historicalData.matchupsBySeason || {});
                if (years.length > 0) {
                    season = Math.max(...years.map(Number)).toString();
                }
            }
            
            const seasonMetrics = seasonalMetrics[season] || {};
            
            if (!seasonMetrics || Object.keys(seasonMetrics).length === 0) {
                // Fallback: try to get roster data directly and create basic standings
                const rosters = historicalData.rostersBySeason?.[season] || [];
                if (rosters.length > 0) {
                    return rosters.map((roster, idx) => ({
                        ownerId: roster.owner_id,
                        teamName: getTeamName(roster.owner_id, season),
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        pointsFor: 0,
                        pointsAgainst: 0,
                        dpr: 0
                    }));
                }
                return [];
            }
            
            return Object.keys(seasonMetrics)
                .map(rosterId => {
                    const team = seasonMetrics[rosterId];
                    return {
                        ownerId: team.ownerId,
                        teamName: getTeamName(team.ownerId, season),
                        wins: team.wins,
                        losses: team.losses,
                        ties: team.ties,
                        pointsFor: team.pointsFor,
                        pointsAgainst: team.pointsAgainst,
                        dpr: team.adjustedDPR
                    };
                })
                .sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return b.pointsFor - a.pointsFor;
                });
        } catch (err) {
            console.error("Error calculating standings:", err);
            return [];
        }
    }, [historicalData, currentSeason, nflState, getTeamName]);

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
                week: m.week,
                isCompleted: (m.team1_score || 0) > 0 || (m.team2_score || 0) > 0
            };
        });
    }, [historicalData, currentSeason, nflState, getTeamName, getTeamDetails]);

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
                        
                        return {
                            ...team,
                            receives: teamAdds,
                            sends: teamDrops
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

    return (
        <div className="w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-8 font-inter space-y-4 sm:space-y-6 md:space-y-8">
            {/* Header */}
            <div className="text-center px-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-800 mb-2">TLOED Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">
                    {currentSeason ? `${currentSeason} Season` : 'Fantasy Football League'} 
                    {nflState?.week ? ` • Week ${nflState.week}` : ''}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {/* Current Week Matchups */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="mobile-text-lg">Week {nflState?.week || 1} Matchups</span>
                        </h2>
                        <div className="space-y-3 sm:space-y-4">
                            {currentWeekMatchups.length > 0 ? currentWeekMatchups.map((matchup, idx) => (
                                <div key={idx} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors touch-friendly">
                                    <div className="flex items-center justify-between">
                                        {/* Mobile Layout - Stacked */}
                                        <div className="sm:hidden w-full">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <img
                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team1.name}
                                                        className="w-8 h-8 rounded-full border-2 border-blue-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                    <span className="font-semibold text-gray-800 text-sm truncate">{matchup.team1.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    {matchup.isCompleted && (
                                                        <div className={`text-lg font-bold ${matchup.team1.score > matchup.team2.score ? 'text-green-600' : 'text-gray-600'}`}>
                                                            {matchup.team1.score.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <img
                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team2.name}
                                                        className="w-8 h-8 rounded-full border-2 border-blue-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                    <span className="font-semibold text-gray-800 text-sm truncate">{matchup.team2.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    {matchup.isCompleted && (
                                                        <div className={`text-lg font-bold ${matchup.team2.score > matchup.team1.score ? 'text-green-600' : 'text-gray-600'}`}>
                                                            {matchup.team2.score.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop Layout - Side by Side */}
                                        <div className="hidden sm:flex items-center justify-between w-full">
                                            <div className="flex items-center space-x-4 flex-1">
                                                <div className="flex items-center space-x-2 flex-1">
                                                    <img
                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team1.name}
                                                        className="w-10 h-10 rounded-full border-2 border-blue-300"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                    <span className="font-semibold text-gray-800 truncate">{matchup.team1.name}</span>
                                                </div>
                                                <div className="text-center px-4">
                                                    <div className="text-sm text-gray-500">vs</div>
                                                    {matchup.isCompleted && (
                                                        <div className="text-lg font-bold text-blue-600">
                                                            {matchup.team1.score.toFixed(1)} - {matchup.team2.score.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2 flex-1 justify-end">
                                                    <span className="font-semibold text-gray-800 truncate">{matchup.team2.name}</span>
                                                    <img
                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team2.name}
                                                        className="w-10 h-10 rounded-full border-2 border-blue-300"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {!matchup.isCompleted && (
                                        <div className="text-center text-xs sm:text-sm text-gray-500 mt-2">Game in progress</div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 py-6 sm:py-8 text-sm sm:text-base">No matchups available for this week</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Current Standings */}
                <div>
                    <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="mobile-text-lg">Standings</span>
                        </h2>
                        <div className="space-y-2 sm:space-y-3">
                            {currentStandings.map((team, idx) => (
                                <div key={team.ownerId} className="flex items-center justify-between p-2 sm:p-3 rounded hover:bg-gray-50 touch-friendly">
                                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <img
                                            src={getTeamDetails(team.ownerId, currentSeason)?.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                            alt={team.teamName}
                                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0"
                                            onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-xs sm:text-sm text-gray-800 truncate">{team.teamName}</div>
                                            <div className="text-xs text-gray-500">{team.wins}-{team.losses}-{team.ties}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm sm:text-base font-semibold text-blue-600">{team.pointsFor.toFixed(0)}</div>
                                        <div className="text-xs text-gray-500">PF</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-lg mobile-card p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="mobile-text-lg">Recent Transactions</span>
                </h2>
                <div className="space-y-4">
                    {recentTransactions.length > 0 ? recentTransactions.map((transaction, idx) => (
                        <div key={transaction.id} className="bg-gray-50 border rounded-lg p-4 sm:p-6 hover:bg-gray-100 transition-colors">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-2 sm:gap-0">
                                <div className="flex items-center space-x-2 flex-wrap">
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                                        {formatTransactionType(transaction.type)}
                                    </span>
                                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                                        transaction.status === 'complete' ? 'bg-green-100 text-green-800' : 
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {transaction.status}
                                    </span>
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-sm text-gray-600">
                                        {transaction.created.toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {transaction.created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Trade Layout */}
                            {transaction.type === 'trade' && transaction.tradeDetails ? (
                                <div className="space-y-4">
                                    {transaction.tradeDetails.map((team, teamIdx) => (
                                        <div key={teamIdx} className="bg-white rounded-lg p-4 border">
                                            {/* Team Header */}
                                            <div className="flex items-center space-x-3 mb-4 pb-3 border-b">
                                                <img
                                                    src={team.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                    alt={team.name}
                                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-blue-300"
                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                />
                                                <div>
                                                    <h4 className="font-bold text-lg text-gray-800">{team.name}</h4>
                                                    <p className="text-sm text-gray-500">Team {teamIdx === 0 ? 'A' : 'B'}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Sends */}
                                                {team.sends && team.sends.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-3">
                                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                            </svg>
                                                            <span className="font-semibold text-red-700">Sends</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {team.sends.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-3 bg-red-50 rounded-lg p-3">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-10 h-10 rounded-full border"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-gray-800">{player.name}</div>
                                                                        <div className="text-sm text-gray-500">{player.position} • {player.team}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Receives */}
                                                {team.receives && team.receives.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-3">
                                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                                            </svg>
                                                            <span className="font-semibold text-green-700">Receives</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {team.receives.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-3 bg-green-50 rounded-lg p-3">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-10 h-10 rounded-full border"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-gray-800">{player.name}</div>
                                                                        <div className="text-sm text-gray-500">{player.position} • {player.team}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Non-Trade Layout (Waiver/Free Agent) */
                                <div className="space-y-4">
                                    {/* Team */}
                                    {transaction.teamDetails && transaction.teamDetails.length > 0 && (
                                        <div className="flex items-center space-x-3 mb-4">
                                            <img
                                                src={transaction.teamDetails[0].avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                alt={transaction.teamDetails[0].name}
                                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-blue-300"
                                                onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                            />
                                            <div>
                                                <h4 className="font-bold text-xl text-gray-800">{transaction.teamDetails[0].name}</h4>
                                                <p className="text-sm text-gray-500">{formatTransactionDescription(transaction)}</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Added Players */}
                                        {transaction.addedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-2 mb-4">
                                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                    </svg>
                                                    <span className="font-bold text-lg text-green-700">Added</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {transaction.addedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-4 bg-green-50 rounded-xl p-4 border border-green-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-green-300"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1">
                                                                <div className="font-bold text-lg text-gray-800">{player.name}</div>
                                                                <div className="text-sm font-medium text-green-700">{player.position}</div>
                                                                <div className="text-sm text-gray-500">{player.team}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Dropped Players */}
                                        {transaction.droppedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-2 mb-4">
                                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                                                    </svg>
                                                    <span className="font-bold text-lg text-red-700">Dropped</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {transaction.droppedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-4 bg-red-50 rounded-xl p-4 border border-red-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-red-300"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1">
                                                                <div className="font-bold text-lg text-gray-800">{player.name}</div>
                                                                <div className="text-sm font-medium text-red-700">{player.position}</div>
                                                                <div className="text-sm text-gray-500">{player.team}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )) : (
                        <div className="text-center text-gray-500 py-8 text-base">No recent transactions</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
