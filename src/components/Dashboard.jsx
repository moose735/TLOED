
import React, { useCallback, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import PowerRankings from '../lib/PowerRankings';
import ProjectedPlayoffBracket from './ProjectedPlayoffBracket';

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
        <>
            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-100%); }
                }
                .animate-scroll {
                    animation: scroll 90s linear infinite;
                }
            `}</style>
            <div className="w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-8 font-inter space-y-4 sm:space-y-6 md:space-y-8">
            {/* Header */}
            <div className="text-center px-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-800 mb-2">TLOED Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">
                    {currentSeason ? `${currentSeason} Season` : 'Fantasy Football League'} 
                    {nflState?.week ? ` • Week ${nflState.week}` : ''}
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
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
                            <div className="absolute whitespace-nowrap flex items-center h-full animate-scroll">
                                {currentWeekMatchups.length > 0 ? (
                                    <>
                                        {/* First set of matchups */}
                                        {currentWeekMatchups.map((matchup, idx) => (
                                            <div key={`first-${idx}`} className="flex items-center space-x-4 mx-6 bg-gray-50 rounded-lg px-6 py-3 border border-gray-200 min-w-[280px]">
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    <img
                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team1.name}
                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[80px]">{matchup.team1.name}</span>
                                                </div>
                                                <div className="text-center px-2 flex-shrink-0">
                                                    {matchup.isCompleted ? (
                                                        <div className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                                            {matchup.team1.score.toFixed(1)} - {matchup.team2.score.toFixed(1)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">vs</div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-3 min-w-0 flex-1 justify-end">
                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[80px]">{matchup.team2.name}</span>
                                                    <img
                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team2.name}
                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {/* Duplicate set for seamless loop */}
                                        {currentWeekMatchups.map((matchup, idx) => (
                                            <div key={`second-${idx}`} className="flex items-center space-x-4 mx-6 bg-gray-50 rounded-lg px-6 py-3 border border-gray-200 min-w-[280px]">
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    <img
                                                        src={matchup.team1.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team1.name}
                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[80px]">{matchup.team1.name}</span>
                                                </div>
                                                <div className="text-center px-2 flex-shrink-0">
                                                    {matchup.isCompleted ? (
                                                        <div className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                                            {matchup.team1.score.toFixed(1)} - {matchup.team2.score.toFixed(1)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">vs</div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-3 min-w-0 flex-1 justify-end">
                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[80px]">{matchup.team2.name}</span>
                                                    <img
                                                        src={matchup.team2.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                        alt={matchup.team2.name}
                                                        className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0"
                                                        onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
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

            {/* Projected Playoff Bracket */}
            <ProjectedPlayoffBracket />

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
                        <div key={transaction.id} className="bg-gray-50 border rounded-lg p-4 hover:bg-gray-100 transition-colors">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2 sm:gap-0">
                                <div className="flex items-center space-x-2 flex-wrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                        {formatTransactionType(transaction.type)}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        transaction.status === 'complete' ? 'bg-green-100 text-green-800' : 
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {transaction.status}
                                    </span>
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-xs text-gray-600">
                                        {transaction.created.toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {transaction.created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Trade Layout */}
                            {transaction.type === 'trade' && transaction.tradeDetails ? (
                                <div className="space-y-3">
                                    {transaction.tradeDetails.map((team, teamIdx) => (
                                        <div key={teamIdx} className="bg-white rounded-lg p-3 border">
                                            {/* Team Header */}
                                            <div className="flex items-center space-x-3 mb-3 pb-2 border-b">
                                                <img
                                                    src={team.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                    alt={team.name}
                                                    className="w-8 h-8 rounded-full border border-gray-300"
                                                    onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                                />
                                                <div>
                                                    <h4 className="font-semibold text-gray-800">{team.name}</h4>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* Sends */}
                                                {team.sends && team.sends.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                            </svg>
                                                            <span className="font-medium text-red-700 text-sm">Sends</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {team.sends.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-2 bg-red-50 rounded p-2">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-8 h-8 rounded-full border object-cover"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 text-sm truncate">{player.name}</div>
                                                                        <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Receives */}
                                                {team.receives && team.receives.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                                                            </svg>
                                                            <span className="font-medium text-green-700 text-sm">Receives</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {team.receives.map((player, playerIdx) => (
                                                                <div key={playerIdx} className="flex items-center space-x-2 bg-green-50 rounded p-2">
                                                                    <img
                                                                        src={player.headshot}
                                                                        alt={player.name}
                                                                        className="w-8 h-8 rounded-full border object-cover"
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 text-sm truncate">{player.name}</div>
                                                                        <div className="text-xs text-gray-500">{player.position} • {player.team}</div>
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
                                <div className="space-y-3">
                                    {/* Team */}
                                    {transaction.teamDetails && transaction.teamDetails.length > 0 && (
                                        <div className="flex items-center space-x-3 mb-3">
                                            <img
                                                src={transaction.teamDetails[0].avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
                                                alt={transaction.teamDetails[0].name}
                                                className="w-10 h-10 rounded-full border border-gray-300"
                                                onError={(e) => { e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`; }}
                                            />
                                            <div>
                                                <h4 className="font-semibold text-gray-800">{transaction.teamDetails[0].name}</h4>
                                                <p className="text-sm text-gray-500">{formatTransactionDescription(transaction)}</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Added Players */}
                                        {transaction.addedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                    </svg>
                                                    <span className="font-medium text-green-700">Added</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {transaction.addedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-3 bg-green-50 rounded-lg p-3 border border-green-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-10 h-10 rounded-full border border-green-300 object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-semibold text-gray-800">{player.name}</div>
                                                                <div className="text-sm text-green-700">{player.position}</div>
                                                                <div className="text-xs text-gray-500">{player.team}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Dropped Players */}
                                        {transaction.droppedPlayers.length > 0 && (
                                            <div>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                                                    </svg>
                                                    <span className="font-medium text-red-700">Dropped</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {transaction.droppedPlayers.map((player, playerIdx) => (
                                                        <div key={playerIdx} className="flex items-center space-x-3 bg-red-50 rounded-lg p-3 border border-red-200">
                                                            <img
                                                                src={player.headshot}
                                                                alt={player.name}
                                                                className="w-10 h-10 rounded-full border border-red-300 object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-semibold text-gray-800">{player.name}</div>
                                                                <div className="text-sm text-red-700">{player.position}</div>
                                                                <div className="text-xs text-gray-500">{player.team}</div>
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
        </>
    );
};

export default Dashboard;
