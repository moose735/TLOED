import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

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
        console.log('Gamecenter useEffect 1 - loading:', loading, 'leagueData:', leagueData, 'nflState:', nflState);
        if (!loading && leagueData && Array.isArray(leagueData) && leagueData[0]?.season && nflState?.week) {
            console.log('Setting selectedSeason to:', leagueData[0].season, 'and selectedWeek to:', nflState.week);
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
            
            // Get league ID for the season - for current season use leagueData, for historical we'd need the league ID
            let leagueId = null;
            if (season === (leagueData && Array.isArray(leagueData) ? leagueData[0].season : leagueData?.season)) {
                leagueId = leagueData && Array.isArray(leagueData) ? leagueData[0].league_id : leagueData?.league_id;
            } else {
                // For historical seasons, we'd need to store league IDs in historical data
                // For now, let's try to use the current league ID as fallback
                leagueId = leagueData && Array.isArray(leagueData) ? leagueData[0].league_id : leagueData?.league_id;
            }

            if (!leagueId) {
                console.error('No league ID available for roster data fetch');
                return;
            }

            // Fetch detailed matchup data from Sleeper API
            const rosterResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
            const rosterData = await rosterResponse.json();

            if (rosterData && Array.isArray(rosterData)) {
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
                }
            }
        } catch (error) {
            console.error('Error fetching matchup roster data:', error);
            setMatchupRosterData(null);
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
        if (!history1 || !ownerId1 || !ownerId2) return "0-0-0";
    
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
    
        return `${wins}-${losses}-${ties}`;
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
        <div className="p-4 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Gamecenter</h1>
                
                {/* Dropdowns for season and week selection */}
                <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow">
                    <div>
                        <label htmlFor="season-select" className="block text-sm font-medium text-gray-600 mb-1">Season</label>
                        <select
                            id="season-select"
                            value={selectedSeason}
                            onChange={handleSeasonChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                        >
                            {availableSeasons.map(season => (
                                <option key={season} value={season}>{season}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="week-select" className="block text-sm font-medium text-gray-600 mb-1">Week</label>
                        <select
                            id="week-select"
                            value={selectedWeek}
                            onChange={handleWeekChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                        >
                            {seasonWeeks.map(week => (
                                <option key={week} value={week}>Week {week}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Matchups display */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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

                        const team1Luck = weeklyLuckData[team1RosterId]?.[selectedWeek - 1] ?? 0;
                        const team2Luck = weeklyLuckData[team2RosterId]?.[selectedWeek - 1] ?? 0;

                        const team1AvgPts = processedSeasonalRecords?.[selectedSeason]?.[team1RosterId]?.averageScore ?? 0;
                        const team2AvgPts = processedSeasonalRecords?.[selectedSeason]?.[team2RosterId]?.averageScore ?? 0;

                        const h2h = getHeadToHeadRecord(team1OwnerId, team2OwnerId);
                        const team1Streak = getWinLossStreak(team1OwnerId, selectedSeason);
                        const team2Streak = getWinLossStreak(team2OwnerId, selectedSeason);

                        return (
                            <div 
                                key={matchup.matchup_id} 
                                className={`bg-white rounded-xl shadow-md overflow-hidden transition-shadow duration-300 hover:shadow-lg ${isCompleted ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                onClick={() => handleMatchupClick(matchup)}
                            >
                                <div className="p-5">
                                    <div className="flex flex-col space-y-4">
                                        {/* Team 1 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img className="w-10 h-10 rounded-full" src={team1Details.avatar} alt={`${team1Details.name} avatar`} />
                                                <span className="font-semibold text-gray-700 text-lg">{team1Details.name}</span>
                                            </div>
                                            <div className={`font-bold text-xl ${isCompleted && matchup.team1_score > matchup.team2_score ? 'text-green-600' : 'text-gray-800'}`}>
                                                {isCompleted ? matchup.team1_score.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                        {/* Team 2 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img className="w-10 h-10 rounded-full" src={team2Details.avatar} alt={`${team2Details.name} avatar`} />
                                                <span className="font-semibold text-gray-700 text-lg">{team2Details.name}</span>
                                            </div>
                                            <div className={`font-bold text-xl ${isCompleted && matchup.team2_score > matchup.team1_score ? 'text-green-600' : 'text-gray-800'}`}>
                                                {isCompleted ? matchup.team2_score.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 mt-4 pt-4">
                                        {!isCompleted ? (
                                            <div className="text-sm text-gray-600 space-y-2">
                                                <div className="flex justify-between"><span>H2H Record:</span> <span className="font-medium">{h2h}</span></div>
                                                <div className="flex justify-between"><span>{team1Details.name} Streak:</span> <span className="font-medium">{team1Streak}</span></div>
                                                <div className="flex justify-between"><span>{team2Details.name} Streak:</span> <span className="font-medium">{team2Streak}</span></div>
                                                <div className="flex justify-between"><span>{team1Details.name} Avg Pts:</span> <span className="font-medium">{team1AvgPts.toFixed(2)}</span></div>
                                                <div className="flex justify-between"><span>{team2Details.name} Avg Pts:</span> <span className="font-medium">{team2AvgPts.toFixed(2)}</span></div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-600 space-y-2">
                                                <div className="flex justify-between">
                                                    <span>{team1Details.name} Luck:</span>
                                                    <span className={`font-medium ${team1Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>{team1Luck.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>{team2Details.name} Luck:</span>
                                                    <span className={`font-medium ${team2Luck > 0 ? 'text-green-500' : 'text-red-500'}`}>{team2Luck.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Detailed Matchup Modal */}
                {selectedMatchup && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {selectedSeason} Week {selectedWeek} Matchup Details
                                </h2>
                                <button 
                                    onClick={closeMatchupModal}
                                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="p-6">
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
                                    
                                    const team1AvgPts = processedSeasonalRecords?.[selectedSeason]?.[team1RosterId]?.averageScore ?? 0;
                                    const team2AvgPts = processedSeasonalRecords?.[selectedSeason]?.[team2RosterId]?.averageScore ?? 0;
                                    
                                    const h2h = getHeadToHeadRecord(team1OwnerId, team2OwnerId);
                                    const team1Streak = getWinLossStreak(team1OwnerId, selectedSeason);
                                    const team2Streak = getWinLossStreak(team2OwnerId, selectedSeason);
                                    
                                    const team1Won = selectedMatchup.team1_score > selectedMatchup.team2_score;
                                    const team2Won = selectedMatchup.team2_score > selectedMatchup.team1_score;
                                    
                                    return (
                                        <div className="space-y-8">
                                            {/* Header with team names and scores */}
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="text-center">
                                                    <div className="flex items-center justify-center gap-3 mb-2">
                                                        <img className="w-16 h-16 rounded-full" src={team1Details.avatar} alt={`${team1Details.name} avatar`} />
                                                        <div>
                                                            <h3 className="text-2xl font-bold text-gray-800">{team1Details.name}</h3>
                                                            <p className="text-sm text-gray-500">{selectedSeason} Week {selectedWeek}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-4xl font-bold ${team1Won ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {selectedMatchup.team1_score.toFixed(2)}
                                                    </div>
                                                    <div className="text-sm text-gray-500 mt-1">POINTS</div>
                                                </div>
                                                
                                                <div className="text-center">
                                                    <div className="flex items-center justify-center gap-3 mb-2">
                                                        <img className="w-16 h-16 rounded-full" src={team2Details.avatar} alt={`${team2Details.name} avatar`} />
                                                        <div>
                                                            <h3 className="text-2xl font-bold text-gray-800">{team2Details.name}</h3>
                                                            <p className="text-sm text-gray-500">{selectedSeason} Week {selectedWeek}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-4xl font-bold ${team2Won ? 'text-green-600' : 'text-gray-600'}`}>
                                                        {selectedMatchup.team2_score.toFixed(2)}
                                                    </div>
                                                    <div className="text-sm text-gray-500 mt-1">POINTS</div>
                                                </div>
                                            </div>
                                            
                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <h4 className="font-semibold text-gray-700 mb-3">Team Stats</h4>
                                                        <div className="space-y-2 text-sm">
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
                                                                <span className="font-medium">{team1AvgPts.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Luck Factor:</span>
                                                                <span className={`font-medium ${team1Luck > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {team1Luck > 0 ? '+' : ''}{team1Luck.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <h4 className="font-semibold text-gray-700 mb-3">Versus Record</h4>
                                                        <div className="text-center">
                                                            <div className="text-2xl font-bold text-gray-800">{h2h}</div>
                                                            <div className="text-sm text-gray-500">All-time H2H</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <h4 className="font-semibold text-gray-700 mb-3">Team Stats</h4>
                                                        <div className="space-y-2 text-sm">
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
                                                                <span className="font-medium">{team2AvgPts.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Luck Factor:</span>
                                                                <span className={`font-medium ${team2Luck > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {team2Luck > 0 ? '+' : ''}{team2Luck.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <h4 className="font-semibold text-gray-700 mb-3">Game Info</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span>Matchup Type:</span>
                                                                <span className="font-medium">Regular Season</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Point Difference:</span>
                                                                <span className="font-medium">{Math.abs(selectedMatchup.team1_score - selectedMatchup.team2_score).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Roster Breakdown */}
                                            {matchupRosterData ? (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    {/* Team 1 Roster */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-xl font-bold text-gray-800 border-b pb-2">{team1Details.name} Roster</h4>
                                                        
                                                        {/* Starting Lineup */}
                                                        <div className="bg-gray-50 rounded-lg p-4">
                                                            <h5 className="font-semibold text-gray-700 mb-3">Starting Lineup</h5>
                                                            <div className="space-y-2">
                                                                {matchupRosterData.team1.lineup.map((player, index) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                                                                        <div className="flex items-center space-x-3">
                                                                            <span className="w-8 text-xs font-medium text-gray-500">{player.lineupPosition}</span>
                                                                            <div>
                                                                                <div className="font-medium text-gray-800">{player.name}</div>
                                                                                <div className="text-xs text-gray-500">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-semibold text-gray-800">{player.points.toFixed(2)}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Bench */}
                                                        <div className="bg-gray-50 rounded-lg p-4">
                                                            <h5 className="font-semibold text-gray-700 mb-3">Bench</h5>
                                                            <div className="space-y-2">
                                                                {matchupRosterData.team1.bench.map((player, index) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-1">
                                                                        <div className="flex items-center space-x-3">
                                                                            <span className="w-8 text-xs font-medium text-gray-400">BN</span>
                                                                            <div>
                                                                                <div className="text-sm text-gray-600">{player.name}</div>
                                                                                <div className="text-xs text-gray-400">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-sm text-gray-600">{player.points > 0 ? player.points.toFixed(2) : '---'}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Team 2 Roster */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-xl font-bold text-gray-800 border-b pb-2">{team2Details.name} Roster</h4>
                                                        
                                                        {/* Starting Lineup */}
                                                        <div className="bg-gray-50 rounded-lg p-4">
                                                            <h5 className="font-semibold text-gray-700 mb-3">Starting Lineup</h5>
                                                            <div className="space-y-2">
                                                                {matchupRosterData.team2.lineup.map((player, index) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                                                                        <div className="flex items-center space-x-3">
                                                                            <span className="w-8 text-xs font-medium text-gray-500">{player.lineupPosition}</span>
                                                                            <div>
                                                                                <div className="font-medium text-gray-800">{player.name}</div>
                                                                                <div className="text-xs text-gray-500">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="font-semibold text-gray-800">{player.points.toFixed(2)}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Bench */}
                                                        <div className="bg-gray-50 rounded-lg p-4">
                                                            <h5 className="font-semibold text-gray-700 mb-3">Bench</h5>
                                                            <div className="space-y-2">
                                                                {matchupRosterData.team2.bench.map((player, index) => (
                                                                    <div key={player.playerId} className="flex justify-between items-center py-1">
                                                                        <div className="flex items-center space-x-3">
                                                                            <span className="w-8 text-xs font-medium text-gray-400">BN</span>
                                                                            <div>
                                                                                <div className="text-sm text-gray-600">{player.name}</div>
                                                                                <div className="text-xs text-gray-400">{player.position} · {player.team || 'FA'}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-sm text-gray-600">{player.points > 0 ? player.points.toFixed(2) : '---'}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <div className="text-gray-500">Loading roster details...</div>
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