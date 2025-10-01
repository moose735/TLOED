import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import logger from '../utils/logger';
import { formatScore } from '../utils/formatUtils';

const Gamecenter = () => {
    const { historicalData, leagueData, getTeamDetails, processedSeasonalRecords, nflState, loading, nflPlayers } = useSleeperData();

    // State for the user's selections. Initialize to null.
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState(null);

    // State for data derived from selections
    const [seasonWeeks, setSeasonWeeks] = useState([]);
    const [weeklyMatchups, setWeeklyMatchups] = useState([]);
    const [selectedMatchup, setSelectedMatchup] = useState(null); // For the detailed modal
    const [matchupRosterData, setMatchupRosterData] = useState(null); // For storing detailed roster data

    // Effect 1: Initialize state when context data is ready and not loading.
    useEffect(() => {
        logger.debug('Gamecenter useEffect 1 - loading:', loading, 'leagueData:', leagueData, 'nflState:', nflState);
        if (!loading && leagueData && Array.isArray(leagueData) && leagueData[0]?.season && nflState?.week) {
            logger.debug('Setting selectedSeason to:', leagueData[0].season, 'and selectedWeek to:', nflState.week);
            setSelectedSeason(leagueData[0].season);
            setSelectedWeek(nflState.week);
        }
    }, [loading, leagueData, nflState]); // Runs when loading status or context data changes

    // Effect 2: Populate the week dropdown whenever the selected season changes.
    useEffect(() => {
        if (selectedSeason && historicalData?.matchupsBySeason?.[selectedSeason]) {
            const weeks = new Set(historicalData.matchupsBySeason[selectedSeason].map(m => m.week));
            setSeasonWeeks(Array.from(weeks).sort((a, b) => a - b));
        }
    }, [selectedSeason, historicalData]); // Runs only when the season changes

    // Effect 3: Fetch the matchups whenever the season or week changes.
    useEffect(() => {
        if (selectedSeason && selectedWeek && historicalData?.matchupsBySeason?.[selectedSeason]) {
            const filtered = historicalData.matchupsBySeason[selectedSeason].filter(m => m.week == selectedWeek);
            setWeeklyMatchups(filtered);
        }
    }, [selectedSeason, selectedWeek, historicalData]); // Runs only when season or week changes

    // Helper function to calculate correct average points excluding incomplete weeks
    const getCorrectAveragePoints = useMemo(() => {
        return (rosterId, season) => {
            if (!historicalData?.matchupsBySeason?.[season] || !nflState) {
                return processedSeasonalRecords?.[season]?.[rosterId]?.averageScore ?? 0;
            }

            const currentNFLSeason = parseInt(nflState.season);
            const currentNFLWeek = parseInt(nflState.week);
            const seasonInt = parseInt(season);

            // For historical seasons, use the processed average as-is
            if (seasonInt < currentNFLSeason) {
                return processedSeasonalRecords?.[season]?.[rosterId]?.averageScore ?? 0;
            }

            // For current season, recalculate excluding incomplete weeks
            const matchupsForTeam = historicalData.matchupsBySeason[season].filter(m => 
                String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)
            );

            let totalPoints = 0;
            let completedGames = 0;

            matchupsForTeam.forEach(matchup => {
                const week = parseInt(matchup.week);
                const isTeam1 = String(matchup.team1_roster_id) === String(rosterId);
                const teamScore = isTeam1 ? matchup.team1_score : matchup.team2_score;
                const opponentScore = isTeam1 ? matchup.team2_score : matchup.team1_score;

                // Only include completed weeks (either historical season or current season with week < current NFL week)
                const isWeekComplete = seasonInt < currentNFLSeason || (seasonInt === currentNFLSeason && week < currentNFLWeek);
                
                // Also check if the game actually has scores (completed)
                const isGameCompleted = (teamScore > 0 || opponentScore > 0);

                if (isWeekComplete && isGameCompleted) {
                    totalPoints += teamScore;
                    completedGames++;
                }
            });

            return completedGames > 0 ? totalPoints / completedGames : 0;
        };
    }, [historicalData, processedSeasonalRecords, nflState]);

    // --- Data Calculation (Memoized) ---
    const availableSeasons = useMemo(() => 
        historicalData?.matchupsBySeason ? Object.keys(historicalData.matchupsBySeason).sort((a, b) => b - a) : [],
        [historicalData]
    );

    const teamMatchupHistory = useMemo(() => {
        const history = {};
        if (!historicalData || !historicalData.matchupsBySeason || !historicalData.rostersBySeason) {
            return history;
        }
    
        Object.keys(historicalData.matchupsBySeason).forEach(season => {
            const seasonRosters = historicalData.rostersBySeason[season];
            if (!seasonRosters) return;
    
            const rosterIdToOwnerId = seasonRosters.reduce((acc, roster) => {
                acc[roster.roster_id] = roster.owner_id;
                return acc;
            }, {});
    
            historicalData.matchupsBySeason[season].forEach(matchup => {
                if (matchup.team1_score > 0 || matchup.team2_score > 0) { // Completed matchup
                    const owner1 = rosterIdToOwnerId[matchup.team1_roster_id];
                    const owner2 = rosterIdToOwnerId[matchup.team2_roster_id];
    
                    if (owner1 && owner2) {
                        if (!history[owner1]) history[owner1] = [];
                        if (!history[owner2]) history[owner2] = [];
    
                        let result1 = 'T';
                        if (matchup.team1_score > matchup.team2_score) result1 = 'W';
                        if (matchup.team1_score < matchup.team2_score) result1 = 'L';
    
                        let result2 = 'T';
                        if (matchup.team2_score > matchup.team1_score) result2 = 'W';
                        if (matchup.team2_score < matchup.team1_score) result2 = 'L';
    
                        history[owner1].push({ season, week: matchup.week, result: result1, opponent: owner2 });
                        history[owner2].push({ season, week: matchup.week, result: result2, opponent: owner1 });
                    }
                }
            });
        });
    
        // Sort history by season and week
        Object.keys(history).forEach(ownerId => {
            history[ownerId].sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.week - b.week;
            });
        });
    
        return history;
    }, [historicalData]);

    const weeklyLuckData = useMemo(() => {
        if (!processedSeasonalRecords || !selectedSeason || !processedSeasonalRecords[selectedSeason]) {
            return {};
        }
    
        const luckDataForSeason = {};
        const teams = processedSeasonalRecords[selectedSeason];
    
        Object.keys(teams).forEach(rosterId => {
            const team = teams[rosterId];
            if (team.weeklyLuck) {
                luckDataForSeason[rosterId] = team.weeklyLuck;
            }
        });
    
        return luckDataForSeason;
    }, [processedSeasonalRecords, selectedSeason]);

    // Function to fetch detailed roster data for a specific matchup
    const fetchMatchupRosterData = async (matchup, season, week) => {
        try {
            setMatchupRosterData(null); // Reset data
            
            // Get league ID for the season
            let leagueId = null;
            const currentSeason = leagueData && Array.isArray(leagueData) ? leagueData[0].season : leagueData?.season;
            
            if (season === currentSeason) {
                // Use current season's league ID
                leagueId = leagueData && Array.isArray(leagueData) ? leagueData[0].league_id : leagueData?.league_id;
            } else {
                // For historical seasons, get the league ID from historical metadata
                const historicalLeagueData = historicalData?.leaguesMetadataBySeason?.[season];
                leagueId = historicalLeagueData?.league_id;
            }

            if (!leagueId) {
                logger.warn(`No league ID available for season ${season}`);
                // Set a fallback message for years without detailed roster data (like Yahoo years)
                setMatchupRosterData({ 
                    error: true, 
                    message: `Detailed roster data is not available for the ${season} season. This may be from a previous platform or the data is no longer accessible.` 
                });
                return;
            }

            // Fetch detailed matchup data from Sleeper API for the specific season and week
            logger.debug(`Fetching roster data for season ${season}, week ${week}, league ${leagueId}`);
            const rosterResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
            
            if (!rosterResponse.ok) {
                throw new Error(`API request failed with status ${rosterResponse.status}`);
            }
            
            const rosterData = await rosterResponse.json();

            if (rosterData && Array.isArray(rosterData) && rosterData.length > 0) {
                // Find the specific matchups for our teams
                const team1Roster = rosterData.find(r => r.roster_id === parseInt(matchup.team1_roster_id));
                const team2Roster = rosterData.find(r => r.roster_id === parseInt(matchup.team2_roster_id));

                if (team1Roster && team2Roster) {
                    // Process the roster data to include player information
                    const processedData = {
                        team1: await processRosterLineup(team1Roster, matchup.team1_roster_id),
                        team2: await processRosterLineup(team2Roster, matchup.team2_roster_id)
                    };
                    setMatchupRosterData(processedData);
                } else {
                    logger.warn(`Could not find roster data for teams ${matchup.team1_roster_id} and ${matchup.team2_roster_id} in week ${week} of season ${season}`);
                    setMatchupRosterData({ 
                        error: true, 
                        message: `Roster details for this matchup are not available. The teams may not have been active in week ${week} of the ${season} season.` 
                    });
                }
            } else {
                logger.warn(`No roster data returned for season ${season}, week ${week}`);
                setMatchupRosterData({ 
                    error: true, 
                    message: `No roster data available for week ${week} of the ${season} season. The data may not be accessible or this week may not have occurred yet.` 
                });
            }
        } catch (error) {
            logger.error('Error fetching matchup roster data:', error);
            setMatchupRosterData({ 
                error: true, 
                message: `Failed to load detailed roster data: ${error.message}. This may be due to data not being available for historical seasons or network issues.` 
            });
        }
    };

    // Process individual roster lineup to get player details and points
    const processRosterLineup = async (rosterData, rosterId) => {
        const lineup = [];
        const bench = [];
        
        // Standard lineup positions
        const lineupPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
        
        // Process starters
        if (rosterData.starters && Array.isArray(rosterData.starters)) {
            for (let i = 0; i < rosterData.starters.length; i++) {
                const playerId = rosterData.starters[i];
                const player = nflPlayers?.[playerId];
                const points = rosterData.players_points?.[playerId] || 0;
                
                if (player) {
                    lineup.push({
                        playerId,
                        name: `${player.first_name} ${player.last_name}`,
                        position: player.position,
                        team: player.team,
                        points: points,
                        isStarter: true,
                        lineupPosition: lineupPositions[i] || 'FLEX'
                    });
                }
            }
        }

        // Process bench players
        if (rosterData.players && Array.isArray(rosterData.players)) {
            const starterIds = new Set(rosterData.starters || []);
            const benchPlayers = rosterData.players.filter(id => !starterIds.has(id));
            
            for (const playerId of benchPlayers) {
                const player = nflPlayers?.[playerId];
                const points = rosterData.players_points?.[playerId] || 0;
                
                if (player) {
                    bench.push({
                        playerId,
                        name: `${player.first_name} ${player.last_name}`,
                        position: player.position,
                        team: player.team,
                        points: points,
                        isStarter: false
                    });
                }
            }
        }

        return {
            lineup,
            bench,
            totalPoints: rosterData.points || 0
        };
    };


    // --- Event Handlers ---
    const handleSeasonChange = (e) => {
        const newSeason = e.target.value;
        setSelectedSeason(newSeason);
        // When season changes, reset the week. If it's the current season, use the current week.
        if (newSeason === (leagueData && Array.isArray(leagueData) ? leagueData[0].season : leagueData?.season)) {
            setSelectedWeek(nflState.week);
        } else {
            // For historical seasons, find the first available week and set it.
            if (historicalData?.matchupsBySeason?.[newSeason]) {
                const weeks = new Set(historicalData.matchupsBySeason[newSeason].map(m => m.week));
                const firstWeek = Array.from(weeks).sort((a, b) => a - b)[0];
                setSelectedWeek(firstWeek);
            }
        }
    };

    const handleWeekChange = (e) => {
        setSelectedWeek(parseInt(e.target.value));
    };

    const handleMatchupClick = (matchup) => {
        const isCompleted = matchup.team1_score > 0 || matchup.team2_score > 0;
        if (isCompleted) {
            setSelectedMatchup(matchup);
            // Fetch detailed roster data for this matchup
            fetchMatchupRosterData(matchup, selectedSeason, selectedWeek);
        }
    };

    const closeMatchupModal = () => {
        setSelectedMatchup(null);
        setMatchupRosterData(null);
    };

    // --- Helper Functions for Rendering ---
    const getWinLossStreak = (ownerId, season) => {
        const history = teamMatchupHistory[ownerId];
        if (!history) return "N/A";
    
        const seasonHistory = history.filter(m => m.season === season);
        if (seasonHistory.length === 0) return "N/A";
    
        let streak = 0;
        let streakType = '';
    
        for (let i = seasonHistory.length - 1; i >= 0; i--) {
            const game = seasonHistory[i];
            if (i === seasonHistory.length - 1) {
                streakType = game.result;
                streak = 1;
            } else {
                if (game.result === streakType) {
                    streak++;
                } else {
                    break;
                }
            }
        }
    
        return `${streak}${streakType}`;
    };

    const getHeadToHeadRecord = (ownerId1, ownerId2) => {
        const history1 = teamMatchupHistory[ownerId1];
        if (!history1 || !ownerId1 || !ownerId2) return "0-0";
    
        let wins = 0;
        let losses = 0;
        let ties = 0;
    
        history1.forEach(game => {
            if (game.opponent === ownerId2) {
                if (game.result === 'W') wins++;
                else if (game.result === 'L') losses++;
                else if (game.result === 'T') ties++;
            }
        });
    
    // Only show ties if there are any and ties > 0
    return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
    };

    // --- Render Logic ---
    if (loading) {
        return (
            <div className="p-4 bg-gray-50 min-h-screen flex justify-center items-center">
                <div className="text-xl font-semibold text-gray-500">Loading Gamecenter...</div>
            </div>
        );
    }

    // If data is loaded but season/week are not set yet, show empty state
    if (!selectedSeason || !selectedWeek) {
        return (
            <div className="p-4 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Gamecenter</h1>
                    <div className="text-center text-gray-500">
                        <p>Setting up Gamecenter...</p>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-2 sm:p-4 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 px-2">Gamecenter</h1>
                
                {/* Dropdowns for season and week selection - Mobile Optimized */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow mobile-card">
                    <div className="flex-1">
                        <label htmlFor="season-select" className="block text-sm font-medium text-gray-600 mb-1">Season</label>
                        <select
                            id="season-select"
                            value={selectedSeason}
                            onChange={handleSeasonChange}
                            className="mt-1 block w-full pl-3 pr-10 py-3 sm:py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm touch-friendly"
                        >
                            {availableSeasons.map(season => (
                                <option key={season} value={season}>{season}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="week-select" className="block text-sm font-medium text-gray-600 mb-1">Week</label>
                        <select
                            id="week-select"
                            value={selectedWeek}
                            onChange={handleWeekChange}
                            className="mt-1 block w-full pl-3 pr-10 py-3 sm:py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm touch-friendly"
                        >
                            {seasonWeeks.map(week => (
                                <option key={week} value={week}>Week {week}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Matchups display - Mobile Optimized Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                    {weeklyMatchups.map(matchup => {
                        const team1RosterId = String(matchup.team1_roster_id);
                        const team2RosterId = String(matchup.team2_roster_id);

                        const rosterForTeam1 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === team1RosterId);
                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team1Details = getTeamDetails(team1OwnerId, selectedSeason);

                        const rosterForTeam2 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === team2RosterId);
                        const team2OwnerId = rosterForTeam2?.owner_id;
                        const team2Details = getTeamDetails(team2OwnerId, selectedSeason);
                        
                        const isCompleted = matchup.team1_score > 0 || matchup.team2_score > 0;

                        // Determine if we should highlight winners (only if week is complete OR all players have played)
                        const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
                        const currentNFLWeek = parseInt(nflState?.week || 1);
                        const selectedSeasonInt = parseInt(selectedSeason);
                        const selectedWeekInt = parseInt(selectedWeek);
                        
                        const isWeekComplete = selectedSeasonInt < currentNFLSeason || 
                                             (selectedSeasonInt === currentNFLSeason && selectedWeekInt < currentNFLWeek);
                        
                        // For current week/season, check if all players have played (this would need roster data)
                        // For now, we'll use the simpler logic: only highlight if week is historically complete
                        const shouldHighlightWinner = isWeekComplete;

                        const team1Luck = weeklyLuckData[team1RosterId]?.[selectedWeek - 1] ?? 0;
                        const team2Luck = weeklyLuckData[team2RosterId]?.[selectedWeek - 1] ?? 0;

                        const team1AvgPts = getCorrectAveragePoints(team1RosterId, selectedSeason);
                        const team2AvgPts = getCorrectAveragePoints(team2RosterId, selectedSeason);

                        const h2h = getHeadToHeadRecord(team1OwnerId, team2OwnerId);
                        const team1Streak = getWinLossStreak(team1OwnerId, selectedSeason);
                        const team2Streak = getWinLossStreak(team2OwnerId, selectedSeason);

                        return (
                            <div 
                                key={matchup.matchup_id} 
                                className={`bg-white rounded-xl shadow-md mobile-card overflow-hidden transition-all duration-300 hover:shadow-lg touch-friendly ${
                                    isCompleted ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''
                                }`}
                                onClick={() => handleMatchupClick(matchup)}
                            >
                                <div className="p-3 sm:p-4">
                                    {/* Mobile-First Team Layout */}
                                    <div className="space-y-3 sm:space-y-0">
                                        {/* Mobile: Stacked Teams */}
                                        <div className="sm:hidden">
                                            {/* Team 1 */}
                                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <img 
                                                        className="w-10 h-10 rounded-full border-2 border-gray-200 flex-shrink-0" 
                                                        src={team1Details.avatar} 
                                                        alt={`${team1Details.name} avatar`} 
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-gray-700 text-sm truncate">
                                                            {team1Details.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {team1Streak} • Avg: {formatScore(Number(team1AvgPts ?? 0), 1)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className={`font-bold text-lg ${
                                                        isCompleted && shouldHighlightWinner && matchup.team1_score > matchup.team2_score ? 'text-green-600' : 'text-gray-800'
                                                    }`}>
                                                        {isCompleted ? formatScore(Number(matchup.team1_score ?? 0), 1) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* VS Divider */}
                                            <div className="text-center py-1">
                                                <span className="text-xs text-gray-400 font-medium">VS</span>
                                                {(() => {
                                                    const h2h = getHeadToHeadRecord(team1OwnerId, team2OwnerId);
                                                    return h2h !== "0-0" && (
                                                        <span className="ml-2 text-xs text-gray-500">H2H: {h2h}</span>
                                                    );
                                                })()}
                                            </div>
                                            
                                            {/* Team 2 */}
                                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <img 
                                                        className="w-10 h-10 rounded-full border-2 border-gray-200 flex-shrink-0" 
                                                        src={team2Details.avatar} 
                                                        alt={`${team2Details.name} avatar`} 
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-gray-700 text-sm truncate">
                                                            {team2Details.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {team2Streak} • Avg: {formatScore(Number(team2AvgPts ?? 0), 1)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className={`font-bold text-lg ${
                                                        isCompleted && shouldHighlightWinner && matchup.team2_score > matchup.team1_score ? 'text-green-600' : 'text-gray-800'
                                                    }`}>
                                                        {isCompleted ? formatScore(Number(matchup.team2_score ?? 0), 1) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop: Side by Side Teams */}
                                        <div className="hidden sm:flex items-center justify-between gap-3">
                                            {/* Team 1 */}
                                            <div className="flex flex-col items-center flex-1 min-w-0">
                                                <img className="w-12 h-12 rounded-full mb-2" src={team1Details.avatar} alt={`${team1Details.name} avatar`} />
                                                <div className="text-center w-full">
                                                    <div className="font-semibold text-gray-700 text-sm leading-tight break-words mb-1">
                                                        {team1Details.name}
                                                    </div>
                                                    <div className={`font-bold text-lg ${isCompleted && shouldHighlightWinner && matchup.team1_score > matchup.team2_score ? 'text-green-600' : 'text-gray-800'}`}>
                                                        {isCompleted ? formatScore(Number(matchup.team1_score ?? 0), 2) : '-'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* VS indicator */}
                                            <div className="flex-shrink-0 text-gray-400 font-medium text-sm px-2">
                                                vs
                                            </div>

                                            {/* Team 2 */}
                                            <div className="flex flex-col items-center flex-1 min-w-0">
                                                <img className="w-12 h-12 rounded-full mb-2" src={team2Details.avatar} alt={`${team2Details.name} avatar`} />
                                                <div className="text-center w-full">
                                                    <div className="font-semibold text-gray-700 text-sm leading-tight break-words mb-1">
                                                        {team2Details.name}
                                                    </div>
                                                    <div className={`font-bold text-lg ${isCompleted && shouldHighlightWinner && matchup.team2_score > matchup.team1_score ? 'text-green-600' : 'text-gray-800'}`}>
                                                        {isCompleted ? formatScore(Number(matchup.team2_score ?? 0), 2) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Stats Section */}
                                    <div className="border-t border-gray-200 mt-3 pt-3">
                                        {!isCompleted ? (
                                            <div className="text-xs text-gray-600">
                                                {/* Mobile Stats Layout */}
                                                <div className="sm:hidden space-y-1">
                                                    <div className="text-center text-xs text-gray-500 font-medium">
                                                        Pre-Game Stats
                                                    </div>
                                                </div>
                                                
                                                {/* Desktop Stats Layout */}
                                                <div className="hidden sm:block">
                                                    <div className="text-center mb-2">
                                                        <div className="text-xs text-gray-500 font-medium">H2H: {getHeadToHeadRecord(team1OwnerId, team2OwnerId)}</div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-2 items-center">
                                                        <div className="text-center space-y-1">
                                                            <div className="text-xs font-semibold">{team1Streak}</div>
                                                            <div className="text-xs font-semibold">{formatScore(Number(team1AvgPts ?? 0), 1)}</div>
                                                        </div>
                                                        
                                                        <div className="text-center space-y-1">
                                                            <div className="text-xs text-gray-500 font-medium">Streak</div>
                                                            <div className="text-xs text-gray-500 font-medium">Avg Pts</div>
                                                        </div>
                                                        
                                                        <div className="text-center space-y-1">
                                                            <div className="text-xs font-semibold">{team2Streak}</div>
                                                            <div className="text-xs font-semibold">{formatScore(Number(team2AvgPts ?? 0), 1)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {(() => {
                                                    const currentNFLSeason = parseInt(nflState?.season || new Date().getFullYear());
                                                    const currentNFLWeek = parseInt(nflState?.week || 1);
                                                    const selectedSeasonInt = parseInt(selectedSeason);
                                                    const selectedWeekInt = parseInt(selectedWeek);
                                                    
                                                    const isWeekComplete = selectedSeasonInt < currentNFLSeason || 
                                                                         (selectedSeasonInt === currentNFLSeason && selectedWeekInt < currentNFLWeek);
                                                    
                                                    const gameHasScores = matchup.team1_score > 0 && matchup.team2_score > 0;
                                                    
                                                    return isWeekComplete && gameHasScores ? (
                                                        <div className="text-xs text-gray-600">
                                                            {/* Mobile Luck Display */}
                                                            <div className="sm:hidden text-center">
                                                                <div className="text-xs text-gray-500 font-medium mb-1">Luck Factor</div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`font-semibold text-sm ${team1Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {formatScore(Number(team1Luck ?? 0), 2)}
                                                                    </span>
                                                                    <span className={`font-semibold text-sm ${team2Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {formatScore(Number(team2Luck ?? 0), 2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Desktop Luck Display */}
                                                            <div className="hidden sm:block">
                                                                <div className="grid grid-cols-3 gap-2 items-center">
                                                                    <div className="text-center">
                                                                        <span className={`font-semibold text-sm ${team1Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {formatScore(Number(team1Luck ?? 0), 2)}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="text-center">
                                                                        <div className="text-xs text-gray-500 font-medium">Luck</div>
                                                                    </div>
                                                                    
                                                                    <div className="text-center">
                                                                        <span className={`font-semibold text-sm ${team2Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {formatScore(Number(team2Luck ?? 0), 2)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-xs text-gray-500">
                                                            Game in progress or incomplete
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                        
                                        {/* Tap indicator for completed games */}
                                        {isCompleted && (
                                            <div className="text-center mt-2">
                                                <span className="text-xs text-blue-500 font-medium">Tap for details</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Detailed Matchup Modal - Mobile Optimized */}
                {selectedMatchup && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                        <div className="bg-white w-full h-full sm:h-auto sm:rounded-xl sm:max-w-6xl sm:w-full sm:max-h-[90vh] overflow-y-auto mobile-scroll">
                            {/* Header - Sticky on mobile */}
                            <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 safe-area-top">
                                <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                                    <span className="sm:hidden">{selectedSeason} W{selectedWeek}</span>
                                    <span className="hidden sm:inline">{selectedSeason} Week {selectedWeek} Details</span>
                                </h2>
                                <button 
                                    onClick={closeMatchupModal}
                                    className="text-gray-500 hover:text-gray-700 text-2xl sm:text-3xl font-bold p-2 touch-friendly rounded-full hover:bg-gray-100"
                                    aria-label="Close modal"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 safe-area-bottom">
                                {(() => {
                                    const team1RosterId = String(selectedMatchup.team1_roster_id);
                                    const team2RosterId = String(selectedMatchup.team2_roster_id);
                                    
                                    const rosterForTeam1 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === team1RosterId);
                                    const team1OwnerId = rosterForTeam1?.owner_id;
                                    const team1Details = getTeamDetails(team1OwnerId, selectedSeason);
                                    
                                    const rosterForTeam2 = historicalData.rostersBySeason?.[selectedSeason]?.find(r => String(r.roster_id) === team2RosterId);
                                    const team2OwnerId = rosterForTeam2?.owner_id;
                                    const team2Details = getTeamDetails(team2OwnerId, selectedSeason);
                                    
                                    const team1Luck = weeklyLuckData[team1RosterId]?.[selectedWeek - 1] ?? 0;
                                    const team2Luck = weeklyLuckData[team2RosterId]?.[selectedWeek - 1] ?? 0;
                                    
                                    const team1AvgPts = getCorrectAveragePoints(team1RosterId, selectedSeason);
                                    const team2AvgPts = getCorrectAveragePoints(team2RosterId, selectedSeason);
                                    
                                    const h2h = getHeadToHeadRecord(team1OwnerId, team2OwnerId);
                                    const team1Streak = getWinLossStreak(team1OwnerId, selectedSeason);
                                    const team2Streak = getWinLossStreak(team2OwnerId, selectedSeason);
                                    
                                    const team1Won = selectedMatchup.team1_score > selectedMatchup.team2_score;
                                    const team2Won = selectedMatchup.team2_score > selectedMatchup.team1_score;

                                    // Compute optimal bench players (position-by-position)
                                    const computeOptimalBench = (team) => {
                                        if (!team) return new Set();
                                        const starters = team.lineup || [];
                                        const bench = team.bench || [];
                                        // Count starters by their lineup slot (use lineupPosition primarily)
                                        const starterCountByPos = {};
                                        starters.forEach(s => {
                                            const pos = s.lineupPosition || s.position || 'FLEX';
                                            starterCountByPos[pos] = (starterCountByPos[pos] || 0) + 1;
                                        });

                                        const optimal = new Set();
                                        Object.keys(starterCountByPos).forEach(pos => {
                                            const need = starterCountByPos[pos];
                                            if (!need) return;

                                            let startersPos = [];
                                            let benchPos = [];

                                            if (pos === 'FLEX') {
                                                // FLEX starters are those with lineupPosition === 'FLEX'
                                                startersPos = starters.filter(s => s.lineupPosition === 'FLEX');
                                                // Bench players eligible for FLEX: RB, WR, TE (include TE as requested)
                                                benchPos = bench.filter(b => ['RB', 'WR', 'TE'].includes(b.position));
                                            } else {
                                                startersPos = starters.filter(s => (s.lineupPosition || s.position) === pos);
                                                benchPos = bench.filter(b => b.position === pos);
                                            }

                                            const combined = [...startersPos, ...benchPos].sort((a, b) => (b.points || 0) - (a.points || 0));
                                            const topN = combined.slice(0, need);
                                            topN.forEach(p => {
                                                if (benchPos.find(b => b.playerId === p.playerId)) {
                                                    optimal.add(p.playerId);
                                                }
                                            });
                                        });

                                        return optimal;
                                    };

                                    // Compute potential points (sum of the top-N scorers per slot / position)
                                    const computePotentialPoints = (team) => {
                                        if (!team) return 0;
                                        const starters = team.lineup || [];
                                        const bench = team.bench || [];
                                        const starterCountByPos = {};
                                        starters.forEach(s => {
                                            const pos = s.lineupPosition || s.position || 'FLEX';
                                            starterCountByPos[pos] = (starterCountByPos[pos] || 0) + 1;
                                        });

                                        let total = 0;
                                        Object.keys(starterCountByPos).forEach(pos => {
                                            const need = starterCountByPos[pos];
                                            if (!need) return;

                                            let startersPos = [];
                                            let benchPos = [];

                                            if (pos === 'FLEX') {
                                                startersPos = starters.filter(s => s.lineupPosition === 'FLEX');
                                                benchPos = bench.filter(b => ['RB', 'WR', 'TE'].includes(b.position));
                                                // Also include starters of eligible positions
                                                startersPos = startersPos.concat(starters.filter(s => ['RB', 'WR', 'TE'].includes(s.position)));
                                            } else {
                                                startersPos = starters.filter(s => (s.lineupPosition || s.position) === pos);
                                                benchPos = bench.filter(b => b.position === pos);
                                            }

                                            const combined = [...startersPos, ...benchPos].sort((a, b) => (b.points || 0) - (a.points || 0));
                                            const topN = combined.slice(0, need);
                                            topN.forEach(p => {
                                                total += (p.points || 0);
                                            });
                                        });

                                        return total;
                                    };

                                    const team1OptimalBench = computeOptimalBench(matchupRosterData?.team1);
                                    const team2OptimalBench = computeOptimalBench(matchupRosterData?.team2);

                                    const team1Potential = computePotentialPoints(matchupRosterData?.team1);
                                    const team2Potential = computePotentialPoints(matchupRosterData?.team2);

                                    const team1Actual = matchupRosterData?.team1?.totalPoints ?? selectedMatchup.team1_score ?? 0;
                                    const team2Actual = matchupRosterData?.team2?.totalPoints ?? selectedMatchup.team2_score ?? 0;

                                    const team1CoachScore = team1Potential > 0 ? (team1Actual / team1Potential) * 100 : 0;
                                    const team2CoachScore = team2Potential > 0 ? (team2Actual / team2Potential) * 100 : 0;

                                    // Persist coach scores locally for a simple "career" average per roster
                                    try {
                                        const persist = (rosterId, score, season, week, ownerId) => {
                                            if (!rosterId) return;
                                            const key = `coachScore:${rosterId}`;
                                            const raw = localStorage.getItem(key);
                                            let arr = raw ? JSON.parse(raw) : [];
                                            // Avoid persisting incomplete games: require both teams to have scores
                                            const gameHasScores = (selectedMatchup.team1_score > 0 && selectedMatchup.team2_score > 0);
                                            if (!gameHasScores) return; // don't persist incomplete matchups

                                            // Dedupe by season/week if present: replace existing entry for same season/week
                                            if (season && typeof week !== 'undefined') {
                                                const existingIdx = arr.findIndex(e => e && (e.season === season || String(e.season) === String(season)) && (e.week === week || String(e.week) === String(week)));
                                                // Include ownerId in persisted entry to make later aggregation robust
                                                const entry = { ts: Date.now(), score, season, week, ownerId: ownerId != null ? String(ownerId) : null };
                                                if (existingIdx !== -1) {
                                                    arr[existingIdx] = entry;
                                                } else {
                                                    arr.push(entry);
                                                }
                                            } else {
                                                // Backwards-compatible: push a timestamped score, include ownerId when available
                                                arr.push({ ts: Date.now(), score, ownerId: ownerId != null ? String(ownerId) : null });
                                            }

                                            // Keep last 200 entries to avoid unbounded growth
                                            if (arr.length > 200) arr = arr.slice(arr.length - 200);
                                            localStorage.setItem(key, JSON.stringify(arr));
                                        };

                                        const getCareerAverage = (rosterId) => {
                                            if (!rosterId) return null;
                                            const raw = localStorage.getItem(`coachScore:${rosterId}`);
                                            if (!raw) return null;
                                            const arr = JSON.parse(raw);
                                            if (!Array.isArray(arr) || arr.length === 0) return null;
                                            // Only include entries that have season/week and are not from 2021 if present
                                            const filtered = arr.filter(e => !(e && (e.season === '2021' || e.season === 2021)));
                                            if (filtered.length === 0) return null;
                                            const sum = filtered.reduce((s, r) => s + (r.score || 0), 0);
                                            return sum / filtered.length;
                                        };

                                        // Persist for teams if we have roster IDs
                                        const team1RosterIdForPersist = String(rosterForTeam1?.roster_id || team1RosterId);
                                        const team2RosterIdForPersist = String(rosterForTeam2?.roster_id || team2RosterId);

                                        // Persist only if the matchup has completed scores
                                        if (team1RosterIdForPersist) persist(team1RosterIdForPersist, team1CoachScore, selectedSeason, selectedWeek, rosterForTeam1?.owner_id);
                                        if (team2RosterIdForPersist) persist(team2RosterIdForPersist, team2CoachScore, selectedSeason, selectedWeek, rosterForTeam2?.owner_id);

                                        var team1Career = getCareerAverage(team1RosterIdForPersist);
                                        var team2Career = getCareerAverage(team2RosterIdForPersist);
                                    } catch (e) {
                                        // localStorage may be unavailable in some environments; ignore failures
                                        var team1Career = null;
                                        var team2Career = null;
                                    }
                                    
                                    return (
                                        <div className="space-y-4 sm:space-y-6">
                                            {/* Header with team names and scores - Mobile Optimized */}
                                            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-8">
                                                {/* Team 1 */}
                                                <div className="text-center bg-gray-50 rounded-lg p-4">
                                                    <div className="flex items-center justify-center gap-3 mb-3">
                                                        <img className="w-12 h-12 sm:w-16 sm:h-16 rounded-full" src={team1Details.avatar} alt={`${team1Details.name} avatar`} />
                                                        <div className="text-left">
                                                            <h3 className="text-lg sm:text-2xl font-bold text-gray-800">{team1Details.name}</h3>
                                                            <p className="text-xs sm:text-sm text-gray-500">{selectedSeason} Week {selectedWeek}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-3xl sm:text-4xl font-bold ${team1Won ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {formatScore(Number(selectedMatchup.team1_score ?? 0), 2)}
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-500 mt-1">POINTS</div>
                                                    <div className="text-xs sm:text-sm text-gray-500 mt-1">Coach Score: <span className="font-semibold text-gray-800">{team1Potential > 0 ? `${formatScore(Number(team1CoachScore ?? 0), 1)}%` : 'N/A'}</span></div>
                                                </div>
                                                
                                                {/* Team 2 */}
                                                <div className="text-center bg-gray-50 rounded-lg p-4">
                                                    <div className="flex items-center justify-center gap-3 mb-3">
                                                        <img className="w-12 h-12 sm:w-16 sm:h-16 rounded-full" src={team2Details.avatar} alt={`${team2Details.name} avatar`} />
                                                        <div className="text-left">
                                                            <h3 className="text-lg sm:text-2xl font-bold text-gray-800">{team2Details.name}</h3>
                                                            <p className="text-xs sm:text-sm text-gray-500">{selectedSeason} Week {selectedWeek}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-3xl sm:text-4xl font-bold ${team2Won ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {formatScore(Number(selectedMatchup.team2_score ?? 0), 2)}
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-500 mt-1">POINTS</div>
                                                    <div className="text-xs sm:text-sm text-gray-500 mt-1">Coach Score: <span className="font-semibold text-gray-800">{team2Potential > 0 ? `${formatScore(Number(team2CoachScore ?? 0), 1)}%` : 'N/A'}</span></div>
                                                </div>
                                            </div>
                                            
                                            {/* Stats Grid - Mobile Optimized */}
                                            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
                                                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mobile-card">
                                                    <h4 className="font-semibold text-gray-700 mb-3 text-sm sm:text-base">{team1Details.name} Stats</h4>
                                                    <div className="space-y-2 text-xs sm:text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Season Record:</span>
                                                            <span className="font-medium">{processedSeasonalRecords?.[selectedSeason]?.[team1RosterId]?.wins || 0}-{processedSeasonalRecords?.[selectedSeason]?.[team1RosterId]?.losses || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Current Streak:</span>
                                                            <span className="font-medium">{team1Streak}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Season Avg:</span>
                                                            <span className="font-medium">{formatScore(Number(team1AvgPts ?? 0), 2)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Luck Factor:</span>
                                                            <span className={`font-medium ${team1Luck > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {team1Luck > 0 ? '+' : ''}{formatScore(Number(team1Luck ?? 0), 2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mobile-card">
                                                    <h4 className="font-semibold text-gray-700 mb-3 text-sm sm:text-base">{team2Details.name} Stats</h4>
                                                    <div className="space-y-2 text-xs sm:text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Season Record:</span>
                                                            <span className="font-medium">{processedSeasonalRecords?.[selectedSeason]?.[team2RosterId]?.wins || 0}-{processedSeasonalRecords?.[selectedSeason]?.[team2RosterId]?.losses || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Current Streak:</span>
                                                            <span className="font-medium">{team2Streak}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Season Avg:</span>
                                                            <span className="font-medium">{formatScore(Number(team2AvgPts ?? 0), 2)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Luck Factor:</span>
                                                            <span className={`font-medium ${team2Luck > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {team2Luck > 0 ? '+' : ''}{formatScore(Number(team2Luck ?? 0), 2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Game Info Section */}
                                            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mobile-card">
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                                                    <div>
                                                        <div className="text-xs sm:text-sm text-gray-500">H2H Record</div>
                                                        <div className="text-lg sm:text-2xl font-bold text-gray-800">{h2h}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs sm:text-sm text-gray-500">Point Difference</div>
                                                        <div className="text-lg sm:text-2xl font-bold text-gray-800">{formatScore(Math.abs(Number(selectedMatchup.team1_score ?? 0) - Number(selectedMatchup.team2_score ?? 0)), 2)}</div>
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <div className="text-xs sm:text-sm text-gray-500">Matchup Type</div>
                                                        <div className="text-sm sm:text-base font-bold text-gray-800">Regular Season</div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Roster Breakdown: show both teams side-by-side on large screens, stacked on mobile */}
                                            {matchupRosterData ? (
                                                matchupRosterData.error ? (
                                                    <div className="text-center py-6 sm:py-8">
                                                        <div className="text-gray-500 mb-2">
                                                            <svg className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base px-4">{matchupRosterData.message}</p>
                                                    </div>
                                                ) : (
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Team 1 Column */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-lg sm:text-xl font-bold text-gray-800 border-b pb-2">{team1Details.name} Roster</h4>

                                                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mobile-card">
                                                            <h5 className="font-semibold text-gray-700 mb-3 text-sm sm:text-base">Starting Lineup</h5>
                                                            <div className="space-y-1 sm:space-y-2">
                                                                {matchupRosterData.team1.lineup.map((player, idx) => {
                                                                    const opp = matchupRosterData.team2.lineup[idx];
                                                                    const oppPts = opp?.points ?? 0;
                                                                    const myPts = player?.points ?? 0;
                                                                    const outcome = myPts > oppPts ? 'win' : myPts < oppPts ? 'loss' : 'tie';

                                                                    return (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                                                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                                                            <span className="w-8 sm:w-10 text-xs font-medium text-gray-500 flex-shrink-0">{player.lineupPosition}</span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="font-medium text-gray-800 text-sm sm:text-base truncate">
                                                                                    <span>{player.name}</span>
                                                                                </div>
                                                                                <div className="text-xs text-gray-500">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                                                                            <div className="font-semibold text-gray-800 text-sm sm:text-base">{player.points.toFixed(2)}</div>
                                                                            {outcome === 'win' ? (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-green-600" aria-label="scored more" />
                                                                            ) : outcome === 'loss' ? (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-red-600" aria-label="scored less" />
                                                                            ) : (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-gray-300" aria-label="tied" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <details className="bg-gray-50 rounded-lg mobile-card">
                                                            <summary className="font-semibold text-gray-700 p-3 sm:p-4 text-sm sm:text-base cursor-pointer hover:bg-gray-100 rounded-lg touch-friendly">
                                                                Bench ({matchupRosterData.team1.bench.length} players)
                                                            </summary>
                                                            <div className="p-3 sm:p-4 pt-0 space-y-1">
                                                                {matchupRosterData.team1.bench.map((player) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-1">
                                                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                                                            <span className="w-8 sm:w-10 text-xs font-medium text-gray-400 flex-shrink-0">BN</span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="text-sm text-gray-600 truncate">{player.name}</div>
                                                                                <div className="text-xs text-gray-400">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                                                                            <div className="text-sm text-gray-600">{player.points > 0 ? player.points.toFixed(2) : '---'}</div>
                                                                            {team1OptimalBench.has(player.playerId) && (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" aria-label="optimal start" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    </div>

                                                    {/* Team 2 Column */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-lg sm:text-xl font-bold text-gray-800 border-b pb-2">{team2Details.name} Roster</h4>

                                                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mobile-card">
                                                            <h5 className="font-semibold text-gray-700 mb-3 text-sm sm:text-base">Starting Lineup</h5>
                                                            <div className="space-y-1 sm:space-y-2">
                                                                {matchupRosterData.team2.lineup.map((player, idx) => {
                                                                    const opp = matchupRosterData.team1.lineup[idx];
                                                                    const oppPts = opp?.points ?? 0;
                                                                    const myPts = player?.points ?? 0;
                                                                    const outcome = myPts > oppPts ? 'win' : myPts < oppPts ? 'loss' : 'tie';

                                                                    return (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                                                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                                                            <span className="w-8 sm:w-10 text-xs font-medium text-gray-500 flex-shrink-0">{player.lineupPosition}</span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="font-medium text-gray-800 text-sm sm:text-base truncate">
                                                                                    <span className="truncate">{player.name}</span>
                                                                                </div>
                                                                                <div className="text-xs text-gray-500">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                                                                            <div className="font-semibold text-gray-800 text-sm sm:text-base">{player.points.toFixed(2)}</div>
                                                                            {outcome === 'win' ? (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-green-600" aria-label="scored more" />
                                                                            ) : outcome === 'loss' ? (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-red-600" aria-label="scored less" />
                                                                            ) : (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-gray-300" aria-label="tied" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <details className="bg-gray-50 rounded-lg mobile-card">
                                                            <summary className="font-semibold text-gray-700 p-3 sm:p-4 text-sm sm:text-base cursor-pointer hover:bg-gray-100 rounded-lg touch-friendly">
                                                                Bench ({matchupRosterData.team2.bench.length} players)
                                                            </summary>
                                                            <div className="p-3 sm:p-4 pt-0 space-y-1">
                                                                {matchupRosterData.team2.bench.map((player) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-1">
                                                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                                                            <span className="w-8 sm:w-10 text-xs font-medium text-gray-400 flex-shrink-0">BN</span>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="text-sm text-gray-600 truncate">{player.name}</div>
                                                                                <div className="text-xs text-gray-400">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                                                                            <div className="text-sm text-gray-600">{player.points > 0 ? player.points.toFixed(2) : '---'}</div>
                                                                            {team2OptimalBench.has(player.playerId) && (
                                                                                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" aria-label="optimal start" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    </div>
                                                </div>
                                                )
                                            ) : (
                                                <div className="text-center py-6 sm:py-8">
                                                    <div className="text-gray-500 text-sm sm:text-base">Loading roster details...</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Gamecenter;