import React, { useState, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

const PlayerRecords = () => {
    const {
        historicalData,
        nflPlayers,
        getTeamName,
        loading,
        error
    } = useSleeperData();

    const [expandedSections, setExpandedSections] = useState({});
    const [activeView, setActiveView] = useState('weekly'); // 'weekly' or 'seasonal'

    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Calculate player records from available data
    const playerRecords = useMemo(() => {
        if (!historicalData?.matchupsBySeason || !nflPlayers) {
            console.log('Missing data for player records:', {
                hasMatchups: !!historicalData?.matchupsBySeason,
                hasNflPlayers: !!nflPlayers
            });
            return null;
        }

        console.log('Available seasons:', Object.keys(historicalData.matchupsBySeason));
        
        const weeklyRecords = {
            QB: [], RB: [], WR: [], TE: [], K: [], 'D/ST': []
        };
        
        const seasonalRecords = {
            QB: [], RB: [], WR: [], TE: [], K: [], 'D/ST': []
        };

        // Track seasonal totals for each player
        const seasonalTotals = {};

        // Process each season
        for (const [season, matchups] of Object.entries(historicalData.matchupsBySeason)) {
            // Process each matchup
            matchups.forEach(matchup => {
                // Process both teams in the matchup
                [
                    { rosterInfo: matchup.team1_details, players: matchup.team1_players, rosterId: matchup.team1_roster_id },
                    { rosterInfo: matchup.team2_details, players: matchup.team2_players, rosterId: matchup.team2_roster_id }
                ].forEach(({ rosterInfo, players, rosterId }) => {
                    if (!players || !players.starters || !players.players_points || !rosterInfo) return;

                    const teamName = getTeamName(rosterInfo.owner_id, parseInt(season));
                    
                    // Process each starter
                    players.starters.forEach(playerId => {
                        if (!playerId || !players.players_points[playerId]) return;
                        
                        const nflPlayer = nflPlayers[playerId];
                        if (!nflPlayer) return;

                        // Map position names correctly
                        let position = nflPlayer.position;
                        if (position === 'DEF') position = 'D/ST';
                        
                        const playerName = `${nflPlayer.first_name} ${nflPlayer.last_name}`;
                        const points = players.players_points[playerId] || 0;
                        
                        if (!weeklyRecords[position]) return; // Skip unknown positions

                        // Add to weekly records
                        weeklyRecords[position].push({
                            playerName,
                            points,
                            week: matchup.week,
                            season,
                            teamName,
                            playerId
                        });

                        // Add to seasonal totals
                        const seasonKey = `${playerId}-${season}`;
                        if (!seasonalTotals[seasonKey]) {
                            seasonalTotals[seasonKey] = {
                                playerName,
                                position,
                                points: 0,
                                games: 0,
                                season,
                                teamName,
                                playerId
                            };
                        }
                        seasonalTotals[seasonKey].points += points;
                        seasonalTotals[seasonKey].games += 1;
                    });
                });
            });
        }

        // Add seasonal totals to seasonal records
        Object.values(seasonalTotals).forEach(playerSeason => {
            if (seasonalRecords[playerSeason.position]) {
                seasonalRecords[playerSeason.position].push(playerSeason);
            }
        });

        // Sort and get top records
        const getTopRecords = (records, limit = 5) => {
            return records
                .sort((a, b) => b.points - a.points)
                .slice(0, limit);
        };

        const result = {
            weekly: {},
            seasonal: {}
        };

        Object.keys(weeklyRecords).forEach(position => {
            result.weekly[position] = getTopRecords(weeklyRecords[position]);
            result.seasonal[position] = getTopRecords(seasonalRecords[position]);
        });

        console.log('Generated player records:', result);

        return result;
    }, [historicalData, nflPlayers, getTeamName]);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="text-lg">Loading player records...</div>
            </div>
        );
    }

    if (error || !playerRecords) {
        return (
            <div className="p-8 text-center">
                <div className="text-lg text-red-600">Unable to load player records</div>
                <div className="text-sm text-gray-600 mt-2">
                    Please try refreshing the page or check back later.
                </div>
                {error && (
                    <div className="text-sm text-gray-500 mt-4">
                        Error: {error.message}
                    </div>
                )}
            </div>
        );
    }

    const renderPlayerTable = (records, isWeekly = true) => {
        if (!records || records.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    No records available for this position
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {records.map((record, index) => (
                    <div key={`${record.playerId}-${record.season}-${record.week || 'season'}`} 
                         className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                                    {index + 1}
                                </span>
                                <div>
                                    <div className="font-medium text-gray-900 text-sm sm:text-base">{record.playerName}</div>
                                    <div className="text-xs text-blue-600 font-medium">{record.teamName}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-blue-600 text-lg">{record.points.toFixed(1)}</div>
                                <div className="text-xs text-gray-500">
                                    {isWeekly ? `Week ${record.week} ` : `${record.games || 'N/A'} games `}
                                    {record.season}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];
    const positionEmojis = {
        'QB': '🏈',
        'RB': '🏃',
        'WR': '🙌',
        'TE': '💪',
        'K': '🦵',
        'D/ST': '🛡️'
    };

    return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">⭐ Player Records</h2>
                <p className="text-sm sm:text-base text-gray-600">Individual player achievements and performances</p>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center mb-6 sm:mb-8">
                <div className="bg-gray-100 rounded-lg p-1 flex w-full max-w-sm">
                    <button
                        onClick={() => setActiveView('weekly')}
                        className={`flex-1 px-3 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                            activeView === 'weekly'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => setActiveView('seasonal')}
                        className={`flex-1 px-3 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                            activeView === 'seasonal'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Seasonal
                    </button>
                </div>
            </div>

            {/* Position Records */}
            <div className="space-y-4 sm:space-y-6">
                {positions.map(position => {
                    const sectionKey = `${activeView}-${position}`;
                    const isExpanded = expandedSections[sectionKey];
                    const records = playerRecords[activeView][position] || [];
                    const topRecords = records.slice(0, 5);
                    
                    return (
                        <div key={position} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            {/* Header */}
                            <div 
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 cursor-pointer hover:bg-blue-100 transition-colors border-b border-gray-200"
                                onClick={() => toggleSection(sectionKey)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xl sm:text-2xl">{positionEmojis[position]}</span>
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-gray-900">
                                                {position} - {activeView === 'weekly' ? 'Best Weekly' : 'Best Seasonal'}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 sm:space-x-4">
                                        {topRecords.length > 0 && (
                                            <div className="text-right text-xs sm:text-sm text-gray-600 hidden sm:block">
                                                <div>Best: {topRecords[0].points.toFixed(1)} pts</div>
                                                <div className="truncate max-w-20">{topRecords[0].playerName}</div>
                                            </div>
                                        )}
                                        <svg 
                                            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Content */}
                            {isExpanded && (
                                <div className="p-3 sm:p-4">
                                    {renderPlayerTable(records, activeView === 'weekly')}
                                </div>
                            )}

                            {/* Top 5 Preview */}
                            {!isExpanded && topRecords.length > 0 && (
                                <div className="p-3 sm:p-4">
                                    <div className="text-xs sm:text-sm text-gray-600 mb-3">Top 5:</div>
                                    <div className="space-y-2">
                                        {topRecords.map((record, index) => (
                                            <div key={`${record.playerId}-${record.season}-${record.week || 'season'}`} 
                                                 className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-sm sm:text-base truncate">{record.playerName}</div>
                                                        <div className="text-xs text-blue-600 font-medium truncate">{record.teamName}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="font-bold text-blue-600 text-sm sm:text-base">{record.points.toFixed(1)} pts</div>
                                                    <div className="text-xs text-gray-500">
                                                        {activeView === 'weekly' ? `Week ${record.week} ` : ''}{record.season}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PlayerRecords;