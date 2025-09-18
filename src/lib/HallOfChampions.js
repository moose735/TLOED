import React, { useState, useEffect, useMemo } from 'react';
import { getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';
import { useSleeperData } from '../contexts/SleeperDataContext';

// Import champion images (you can add these)
// Example: import champion2024 from '../assets/images/champions/2024-champion.jpg';

const HallOfChampions = () => {
    // Consume historical data and user information from the context
    const { historicalData, getTeamName, getTeamDetails, nflPlayers } = useSleeperData();
    const [championsByYear, setChampionsByYear] = useState([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const [selectedYear, setSelectedYear] = useState(null);
    const [showBracket, setShowBracket] = useState(false);
    const [bracketData, setBracketData] = useState(null);
    const [championPlayersByYear, setChampionPlayersByYear] = useState({});
    const [rosterModalOpen, setRosterModalOpen] = useState(false);
    const [rosterModalYear, setRosterModalYear] = useState(null);

    // Static champion images mapping (add your images here)
    // For easy image management, place images in: /workspaces/TLOED/src/assets/images/champions/
    const championImages = {
        // Example: 2024: require('../assets/images/champions/2024-champion.jpg'),
        // Add images by uncommenting and adding files:
        2023: require('../assets/images/hall-of-champions/2023-champion.jpg'),
        2022: require('../assets/images/hall-of-champions/2022-champion.jpg'),
        2021: require('../assets/images/hall-of-champions/2021-champion.jpg'),
    };

    // Fallback function to get champion image
    const getChampionImage = (year) => {
        try {
            return championImages[year] || null;
        } catch (error) {
            // Return null if image not found
            return null;
        }
    };

    // Trophy/medal icon function removed

    // Function to get bracket data for a specific year
    const getBracketForYear = (year) => {
        if (!historicalData?.winnersBracketBySeason?.[year]) {
            return null;
        }
        
        const winnersBracket = historicalData.winnersBracketBySeason[year];
        const losersBracket = historicalData.losersBracketBySeason?.[year] || [];
        const rosters = historicalData.rostersBySeason?.[year] || [];
        
        // Safety check for rosters array
        let teams = [];
        if (rosters && Array.isArray(rosters)) {
            teams = rosters.map(roster => ({
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                name: getTeamName(roster.owner_id, year),
                avatar: getTeamDetails(roster.owner_id, year)?.avatar
            }));
        }
        
        return {
            year,
            winnersBracket,
            losersBracket,
            rosters,
            teams
        };
    };

    // Handle clicking on a champion banner to view bracket
    const handleChampionClick = (year) => {
        const bracket = getBracketForYear(year);
        if (bracket) {
            setSelectedYear(year);
            setBracketData(bracket);
            setShowBracket(true);
        }
    };

    // Close bracket modal
    const closeBracket = () => {
        setShowBracket(false);
        setSelectedYear(null);
        setBracketData(null);
    };

    // Helper function to get user display name
    const getUserDisplayName = (userId, year) => {
        return getTeamName(userId, year) || 'Unknown Champion';
    };

    // Effect to process historical data and build the list of champions
    useEffect(() => {
        // Ensure all necessary data is available before processing
        const allDataPresent = historicalData && historicalData.winnersBracketBySeason && historicalData.rostersBySeason;
        setIsDataReady(allDataPresent);

        if (allDataPresent) {
            const allChampions = [];
            const sortedYears = Object.keys(historicalData.winnersBracketBySeason).sort((a, b) => b - a);

            for (const year of sortedYears) {
                const yearNumber = Number(year);
                let championUserId = null;

                // Priority 1: Check winners bracket for the championship game winner
                const winnersBracket = historicalData.winnersBracketBySeason[yearNumber];
                const championshipGame = winnersBracket?.find(matchup => matchup.p === 1 && matchup.w);

                if (championshipGame) {
                    const winningRosterId = String(championshipGame.w);
                    const rostersForYear = historicalData.rostersBySeason?.[yearNumber];
                    
                    if (rostersForYear && Array.isArray(rostersForYear)) {
                        const winningRoster = rostersForYear.find(roster => String(roster.roster_id) === winningRosterId);
                        
                        if (winningRoster && winningRoster.owner_id) {
                            championUserId = winningRoster.owner_id;
                        }
                    }
                }

                // If no champion found from the bracket, try other historical data sources
                // This handles cases where bracket data might be incomplete or missing
                if (!championUserId) {
                    const seasonAwards = historicalData.seasonAwardsSummary?.[yearNumber];
                    if (seasonAwards?.champion && seasonAwards.champion !== 'N/A') {
                        // Assume this is a user ID
                        championUserId = seasonAwards.champion;
                    } else {
                        const awardsSummary = historicalData.awardsSummary?.[yearNumber];
                        const champKey = awardsSummary?.champion || awardsSummary?.["Champion"];
                        if (champKey && champKey !== 'N/A') {
                            // This might be a user ID or a pre-existing name
                            championUserId = champKey;
                        }
                    }
                }

                // If a champion was successfully identified, get their display name and add to the list
                if (championUserId) {
                    const championName = getUserDisplayName(championUserId, yearNumber);
                    const teamDetails = getTeamDetails(championUserId, yearNumber);
                    allChampions.push({
                        year: yearNumber,
                        name: championName !== 'Unknown Champion' ? championName : championUserId, // Use the raw ID if the name can't be resolved
                        championId: championUserId,
                        avatar: teamDetails?.avatar,
                        image: getChampionImage(yearNumber),
                        hasBracket: !!winnersBracket && winnersBracket.length > 0
                    });
                }
            }
            setChampionsByYear(allChampions);
        }
    }, [historicalData, getTeamName, getTeamDetails]);

    // Build a database of NFL players who were on the champion roster at championship time
    useEffect(() => {
        if (!historicalData || !championsByYear || championsByYear.length === 0) return;

        const db = {};

        const findWinningRosterId = (yearNumber) => {
            const winnersBracket = historicalData.winnersBracketBySeason?.[yearNumber];
            if (winnersBracket && Array.isArray(winnersBracket)) {
                const championshipGame = winnersBracket.find(g => g.p === 1 && g.w);
                if (championshipGame && championshipGame.w) return String(championshipGame.w);
            }
            return null;
        };

        const getPlayersFromRosterObj = (rosterObj) => {
            if (!rosterObj) return null;
            // Common shapes: rosterObj.players (array), rosterObj.starters (array), rosterObj?.players_by_week
            if (Array.isArray(rosterObj.players) && rosterObj.players.length > 0) return rosterObj.players;
            if (Array.isArray(rosterObj.starters) && rosterObj.starters.length > 0) return rosterObj.starters;
            // Some snapshots include slots like rosterObj?.players_by_week or rosterObj?.players_map - try to flatten
            if (rosterObj.players_by_week && typeof rosterObj.players_by_week === 'object') {
                // take latest week
                const weeks = Object.keys(rosterObj.players_by_week).sort((a,b) => parseInt(b)-parseInt(a));
                if (weeks.length > 0) return rosterObj.players_by_week[weeks[0]];
            }
            return null;
        };

        // Helper: best-effort scan of matchups for a given year to find a player's NFL team at that time
        const findPlayerTeamInMatchups = (yearNumber, playerId, championshipWeekHint = null) => {
            const matchups = historicalData.matchupsBySeason?.[yearNumber] || [];
            const weeksToScan = new Set();
            if (championshipWeekHint) weeksToScan.add(String(championshipWeekHint));

            // add last few weeks (playoffs) as fallback
            const recentWeeks = matchups.slice(-6).map(m => String(m.week || m.weekNumber || ''));
            recentWeeks.forEach(w => { if (w) weeksToScan.add(w); });

            // Utility to recursively search objects for team info keyed by playerId
            const inspectValueForPlayerTeam = (val, pid) => {
                if (!val) return null;
                if (typeof val === 'object') {
                    // If it's a map with playerId as key
                    if (val.hasOwnProperty(pid) && val[pid] && typeof val[pid] === 'object') {
                        if (val[pid].team) return val[pid].team;
                        if (val[pid].player_team) return val[pid].player_team;
                    }
                    // If it's an array, inspect items
                    if (Array.isArray(val)) {
                        for (const item of val) {
                            const found = inspectValueForPlayerTeam(item, pid);
                            if (found) return found;
                        }
                    } else {
                        // inspect fields
                        for (const k of Object.keys(val)) {
                            const v = val[k];
                            if (k === 'team' && typeof v === 'string') return v;
                            if ((k === 'player_id' || k === 'player' || k === 'playerId') && String(val[k]) === String(pid)) {
                                if (val.team) return val.team;
                            }
                            const found = inspectValueForPlayerTeam(v, pid);
                            if (found) return found;
                        }
                    }
                }
                return null;
            };

            for (const m of matchups) {
                const wk = String(m.week || m.weekNumber || '');
                if (weeksToScan.size > 0 && !weeksToScan.has(wk)) continue;

                // Check common fields where player-team info might be present
                const candidateFields = [m.team1_players, m.team2_players, m.team1_details, m.team2_details, m.team1_players_points, m.team2_players_points, m.players, m.players_points, m.players_points_map];
                for (const field of candidateFields) {
                    const found = inspectValueForPlayerTeam(field, String(playerId));
                    if (found) return found;
                }

                // As a last resort, inspect the whole matchup object
                const foundAny = inspectValueForPlayerTeam(m, String(playerId));
                if (foundAny) return foundAny;
            }

            return null;
        };

        championsByYear.forEach(champ => {
            const year = champ.year;
            const championId = champ.championId;
            const championName = champ.name;

            const rosterId = findWinningRosterId(year);
            let players = null;

            // Try: historicalData.rostersBySeason[year] may contain roster objects with players
            const rostersForYear = historicalData.rostersBySeason?.[year] || historicalData.rostersBySeason?.[String(year)];
            if (rostersForYear && Array.isArray(rostersForYear)) {
                const rosterObj = rostersForYear.find(r => String(r.roster_id) === String(rosterId));
                players = getPlayersFromRosterObj(rosterObj);
            }

            // Fallback: check matchups for the championship week or last playoff week for that roster
            if ((!players || players.length === 0) && historicalData.matchupsBySeason && historicalData.matchupsBySeason[year]) {
                const matchups = historicalData.matchupsBySeason[year];
                // Prefer championship week from winnersBracket
                const winnersBracket = historicalData.winnersBracketBySeason?.[year] || [];
                const championshipGame = winnersBracket.find(g => g.p === 1 && g.w);
                const championshipWeek = championshipGame?.week || championshipGame?.weekNumber || null;

                // Try to find matchup in the championshipWeek
                const tryMatchups = (list) => {
                    for (let i = list.length - 1; i >= 0; i--) {
                        const m = list[i];
                        // match possible keys
                        if (String(m.team1_roster_id) === String(rosterId)) {
                            if (m.team1_players) return m.team1_players;
                            if (m.team1_details && m.team1_details.starters) return m.team1_details.starters;
                        }
                        if (String(m.team2_roster_id) === String(rosterId)) {
                            if (m.team2_players) return m.team2_players;
                            if (m.team2_details && m.team2_details.starters) return m.team2_details.starters;
                        }
                    }
                    return null;
                };

                // If we have a championshipWeek, first filter matchups to that week
                if (championshipWeek) {
                    const weekMatchups = matchups.filter(mm => String(mm.week) === String(championshipWeek) || mm.weekNumber === championshipWeek);
                    players = tryMatchups(weekMatchups) || players;
                }

                // final fallback: scan recent matchups for that roster
                if ((!players || players.length === 0)) {
                    players = tryMatchups(matchups) || players;
                }
            }

            // Normalize players to array of objects using nflPlayers map if available
                const normalized = [];
                if (Array.isArray(players)) {
                    // Try to find the championship matchup to extract starter points
                    const winnersBracket = historicalData.winnersBracketBySeason?.[year] || [];
                    const championshipGame = winnersBracket.find(g => g.p === 1 && g.w);
                    const championshipWeek = championshipGame?.week || championshipGame?.weekNumber || null;

                    // Find the matchup for this roster in the championship week or nearby
                    let championshipMatch = null;
                    const matchups = historicalData.matchupsBySeason?.[year] || [];
                    if (championshipWeek) {
                        const weekMatchups = matchups.filter(mm => String(mm.week) === String(championshipWeek) || mm.weekNumber === championshipWeek || mm.playoffs);
                        championshipMatch = weekMatchups.find(m => String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)) || null;
                    }
                    // If not found, try to find last playoff matchup for roster
                    if (!championshipMatch && Array.isArray(matchups) && matchups.length > 0) {
                        for (let i = matchups.length - 1; i >= 0; i--) {
                            const m = matchups[i];
                            if (String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)) {
                                championshipMatch = m; break;
                            }
                        }
                    }

                    // Extract players_points map and starters list if present
                    const extractPointsForRoster = (match, rosterIdStr) => {
                        if (!match) return null;
                        const isTeam1 = String(match.team1_roster_id) === String(rosterIdStr);
                        const teamPlayers = isTeam1 ? (match.team1_players || match.team1_details || {}) : (match.team2_players || match.team2_details || {});

                        // players_points map could be directly on teamPlayers.players_points
                        const playersPoints = teamPlayers.players_points || teamPlayers.players_points_map || teamPlayers.players_points_by_id || null;

                        // starters array may be present in teamPlayers.starters
                        const starters = teamPlayers.starters || null;

                        return { playersPoints, starters };
                    };

                    const rosterPointsInfo = championshipMatch ? extractPointsForRoster(championshipMatch, rosterId) : null;
                    const startersSet = rosterPointsInfo && Array.isArray(rosterPointsInfo.starters) ? new Set(rosterPointsInfo.starters.map(s => String(s))) : null;

                    players.forEach(pid => {
                        const meta = (nflPlayers && nflPlayers[pid]) || null;
                        // compute starter points if we have a playersPoints map and starters list
                        let pointsForChampGame = null;
                        const pidStr = String(pid);
                        const isStarter = startersSet ? startersSet.has(pidStr) : false;
                        if (rosterPointsInfo && rosterPointsInfo.playersPoints) {
                            const ptsMap = rosterPointsInfo.playersPoints;
                            // If we have starters list, sum their points
                            if (Array.isArray(rosterPointsInfo.starters) && rosterPointsInfo.starters.length > 0) {
                                // Some starters may be stored as numbers or strings; normalize
                                const startersSet = new Set(rosterPointsInfo.starters.map(s => String(s)));
                                const pidStr = String(pid);
                                if (startersSet.has(pidStr) && typeof ptsMap[pidStr] === 'number') {
                                    pointsForChampGame = ptsMap[pidStr];
                                } else {
                                    // If starters list exists but pid not in starters set, leave null
                                    pointsForChampGame = pointsForChampGame;
                                }
                            } else {
                                // No starters list: try to read points directly if present
                                const v = ptsMap[String(pid)];
                                if (typeof v === 'number') pointsForChampGame = v;
                            }
                        }

                        // Best-effort prefer team found in matchups for that year
                        const teamFromMatchups = findPlayerTeamInMatchups(year, pid, championshipWeek);
                        const teamValue = teamFromMatchups || meta?.team || null;

                        normalized.push({
                            playerId: pid,
                            name: meta ? `${meta.first_name} ${meta.last_name}` : pid,
                            position: meta ? meta.position : null,
                            nflMeta: meta || null,
                            teamAtChampionship: teamValue,
                            starterPoints: pointsForChampGame,
                            isStarter
                        });
                    });
                }

                db[year] = {
                    year,
                    championId,
                    championName,
                    rosterId: rosterId || null,
                    players: normalized
                };
        });

        // Debug: expose the built DB so we can inspect playerId shapes and nflMeta in the browser console
        console.debug('HallOfChampions: built championPlayersByYear', db);
        setChampionPlayersByYear(db);
    }, [historicalData, championsByYear, nflPlayers]);

    // Use local celebratory GIF unconditionally (no Tenor dependency)

    // ...existing code...

    // Small presentational component to show a player's headshot with a fallback to initials
    const PlayerAvatar = ({ p, size = 40, className = '' }) => {
        // Prefer explicit headshot fields, otherwise build Sleeper CDN URL from playerId
        const explicit = p?.nflMeta?.headshot || p?.nflMeta?.headshot_url || p?.nflMeta?.img || null;
        const built = p?.playerId ? getSleeperPlayerHeadshotUrl(p.playerId) : null;
        const imgUrl = explicit || built;
        const initials = p?.nflMeta ? `${(p.nflMeta.first_name?.[0] || '')}${(p.nflMeta.last_name?.[0] || '')}`.toUpperCase() : (p.playerId || '').slice(0,2).toUpperCase();
        const [imgError, setImgError] = useState(false);

        // If there's an image URL and it hasn't errored, show the image only.
        // If no image URL or the image failed to load, show initials fallback.
        if (imgUrl && !imgError) {
            return (
                <div style={{ width: size, height: size }} className={`relative rounded-full flex-shrink-0 ${className}`}>
                    {/* gold ring */}
                    <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 4px rgba(250,204,21,0.95)' }} />
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                            src={imgUrl}
                            alt={p.name || p.playerId}
                            style={{ width: size - 8, height: size - 8, borderRadius: '50%' }}
                            className="object-cover"
                            onError={(e) => { console.debug('PlayerAvatar: headshot failed to load for', p.playerId, imgUrl); setImgError(true); }}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div style={{ width: size, height: size }} className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}>
                <div className={`w-full h-full rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-semibold text-sm border`}>
                    {/* Neutral silhouette instead of team/player initials to reduce clutter in the Hall */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-amber-800" fill="currentColor" aria-hidden>
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                </div>
            </div>
        );
    };

    const openRosterModal = (year) => {
        setRosterModalYear(year);
        setRosterModalOpen(true);
    };
    const closeRosterModal = () => {
        setRosterModalOpen(false);
        setRosterModalYear(null);
    };

    // Bracket Modal Component
    const BracketModal = ({ bracket, onClose }) => {
        if (!bracket) return null;

        const { year, winnersBracket, losersBracket, teams } = bracket;
        
        // Safety check for required data
        if (!winnersBracket || !Array.isArray(winnersBracket)) {
            return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">No Bracket Data</h3>
                        <p className="text-gray-600 mb-4">Bracket data is not available for {year}.</p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }
        
        const getTeamInfo = (rosterId) => {
            // Safety check for teams array
            if (!teams || !Array.isArray(teams)) {
                return { name: 'Unknown Team', avatar: null };
            }
            const team = teams.find(t => String(t.rosterId) === String(rosterId));
            return team || { name: 'Unknown Team', avatar: null };
        };

        // Separate games into different categories
        const mainBracketGames = [];
        
        // Process winners bracket (main elimination bracket) - exclude all consolation games
        winnersBracket.forEach(game => {
            // Only include games that are part of the main tournament path (no position games)
            if (!game.p || game.p === 1) {
                mainBracketGames.push(game);
            }
        });

        // Organize main bracket games by round
        const gamesByRound = {};
        
        mainBracketGames.forEach(game => {
            const round = game.r || 1;
            if (!gamesByRound[round]) {
                gamesByRound[round] = [];
            }
            gamesByRound[round].push(game);
        });

        // Sort rounds in ascending order (Round 1, 2, 3, etc.)
        const sortedRounds = Object.keys(gamesByRound).sort((a, b) => parseInt(a) - parseInt(b));

        // Helper function to get round name
        const getRoundName = (round, games) => {
            const roundNum = parseInt(round);
            const specialGames = games.filter(g => g.p);
            
            if (specialGames.length > 0) {
                const championshipGame = specialGames.find(g => g.p === 1);
                if (championshipGame) return "Championship";
            }
            
            // Determine round name based on position in bracket
            const maxRound = Math.max(...sortedRounds.map(r => parseInt(r)));
            
            if (roundNum === maxRound) {
                return "Championship";
            } else if (roundNum === maxRound - 1) {
                return "Semifinals";
            } else if (roundNum === maxRound - 2) {
                return "Quarterfinals";
            } else if (roundNum === 1) {
                return "First Round";
            }
            
            return `Round ${roundNum}`;
        };

        // Helper function to render a clean bracket matchup
        const renderBracketMatchup = (game) => {
            const team1Info = getTeamInfo(game.t1);
            const team2Info = getTeamInfo(game.t2);
            
            return (
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm w-48 h-20">
                    {/* Team 1 */}
                    <div className={`flex items-center justify-between px-3 py-2 h-10 border-b border-gray-200 ${
                        String(game.w) === String(game.t1) ? 'bg-green-50 border-l-4 border-l-green-500' : 'bg-gray-50'
                    }`}>
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <img
                                src={team1Info.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'}
                                alt={team1Info.name}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }}
                            />
                            <span className="font-medium text-xs truncate">{team1Info.name}</span>
                        </div>
                        <div className="font-bold text-sm ml-2 flex-shrink-0">
                            {game.t1_score ? parseFloat(game.t1_score).toFixed(1) : '-'}
                        </div>
                    </div>
                    
                    {/* Team 2 */}
                    <div className={`flex items-center justify-between px-3 py-2 h-10 ${
                        String(game.w) === String(game.t2) ? 'bg-green-50 border-l-4 border-l-green-500' : 'bg-gray-50'
                    }`}>
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <img
                                src={team2Info.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'}
                                alt={team2Info.name}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }}
                            />
                            <span className="font-medium text-xs truncate">{team2Info.name}</span>
                        </div>
                        <div className="font-bold text-sm ml-2 flex-shrink-0">
                            {game.t2_score ? parseFloat(game.t2_score).toFixed(1) : '-'}
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-gray-800">
                                {year} Tournament Bracket
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-6 bg-gray-50">
                        {/* Clean Single Elimination Bracket */}
                        <div className="flex justify-center">
                            <div className="flex items-center space-x-16 overflow-x-auto pb-4">
                                {sortedRounds.map((round, roundIndex) => {
                                    const roundGames = gamesByRound[round];
                                    const roundName = getRoundName(round, roundGames);
                                    const isChampionship = roundName === "Championship";
                                    
                                    return (
                                        <div key={round} className="flex flex-col items-center min-w-max">
                                            {/* Clean Round Header */}
                                            <div className="mb-6 text-center">
                                                <h4 className={`font-bold ${isChampionship ? 'text-lg text-yellow-600' : 'text-sm text-gray-600'}`}>
                                                    {roundName}
                                                </h4>
                                                {/* Trophy icon removed from round header */}
                                            </div>
                                            
                                            {/* Round Games - Clean vertical layout */}
                                            <div className="flex flex-col justify-center space-y-12">
                                                {roundGames.map((game, gameIndex) => (
                                                    <div 
                                                        key={`${game.r}-${game.m}-${gameIndex}`} 
                                                        className="relative flex items-center"
                                                    >
                                                        {renderBracketMatchup(game)}
                                                        
                                                        {/* Simple connection line to next round */}
                                                        {roundIndex < sortedRounds.length - 1 && (
                                                            <div className="absolute top-1/2 left-full w-8 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {sortedRounds.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                <p className="text-lg">No playoff games found for {year}</p>
                                <p className="text-sm mt-2">The bracket data may be incomplete or unavailable.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!isDataReady) {
        return (
            <div className="text-center p-6 bg-white rounded-lg shadow-md font-inter">
                <p className="text-lg font-semibold text-gray-700">Loading historical champion data...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a moment to process the league history.</p>
            </div>
        );
    }

    if (championsByYear.length === 0) {
        return (
            <div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md font-inter">
                <p className="font-bold text-xl mb-2">No Champion Data Found</p>
                <p className="text-base">Could not find any historical champions in the provided data.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-50 to-white rounded-lg shadow-xl font-inter">
            {/* Hero banner removed per UX request (Download and View Roster buttons removed from hero) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {championsByYear.map((champion, index) => (
                    <div 
                        key={index} 
                        className={`relative p-6 bg-gradient-to-br from-white to-yellow-50 rounded-xl shadow-2xl flex flex-col items-center text-center transition-transform transform hover:-translate-y-1 hover:scale-102 border border-yellow-200`}
                    >
                        {/* Gold ribbon with year */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md border border-amber-300">{champion.year}</div>
                        {/* Champion Image */}
                        <div className="mb-4 p-1 bg-white rounded-lg shadow-inner inline-flex items-center justify-center" style={{ border: '6px solid rgba(250, 204, 21, 0.15)' }}>
                            {champion.image ? (
                                <img
                                    src={champion.image}
                                    alt={`${champion.year} Champion`}
                                    className="max-w-full max-h-40 sm:max-h-44 md:max-h-48 object-contain rounded-md"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-amber-200 to-yellow-300 rounded-md flex items-center justify-center text-xl font-bold text-amber-800">{(champion.name || '').split(' ')[0]?.slice(0,2)}</div>
                            )}
                        </div>

                        {/* Champion Name */}
                        <div className="text-gray-800 text-lg font-semibold mb-1">{champion.name}</div>

                        <div className="flex items-center gap-2 mt-3">
                            {champion.hasBracket && (
                                <button onClick={() => handleChampionClick(champion.year)} className="px-3 py-1 bg-amber-600 text-white text-sm rounded shadow">View Bracket</button>
                            )}
                            <button onClick={() => openRosterModal(champion.year)} className="px-3 py-1 bg-white border border-gray-200 text-sm rounded shadow-sm">View Roster</button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-2">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-extrabold text-gray-800">Multi-Time Champions</h3>
                </div>

                <div className="space-y-3">
                    {Object.keys(championPlayersByYear).length === 0 ? (
                        <p className="text-sm text-gray-500">Champion roster player data not available or still processing.</p>
                    ) : (
                        (() => {
                            // Aggregate players across years to find multi-time winners
                            const tally = {};
                            Object.values(championPlayersByYear).forEach(entry => {
                                (entry.players || []).forEach(p => {
                                    if (!p || !p.playerId) return;
                                    if (!tally[p.playerId]) tally[p.playerId] = { ...p, count: 0, years: [] };
                                    tally[p.playerId].count += 1;
                                    tally[p.playerId].years.push(entry.year);
                                });
                            });

                            const multi = Object.values(tally).filter(x => x.count > 1).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));

                            if (multi.length === 0) {
                                return <p className="text-sm text-gray-500">No multi-time champions found in the current dataset.</p>;
                            }

                            return (
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {multi.map(p => (
                                            <div key={`multi-${p.playerId}`} className="flex flex-col items-center gap-3 bg-white p-4 rounded shadow-md">
                                                <PlayerAvatar p={p} size={64} />
                                                <div className="text-center">
                                                    <div className="font-semibold text-lg" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                    <div className="text-sm text-gray-500 mt-1">Championships: <span className="font-medium text-amber-600">{p.count}</span></div>
                                                    <div className="text-xs text-gray-400">{p.years.join(', ')}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* Celebration GIF placed below the Multi-Time Champions section */}
            <div className="mt-2">
                <div id="champion-gif-container" className="relative flex justify-center mb-1">
                    <div className="w-full max-w-2xl sm:max-w-3xl px-2">
                        {/* Removed white card background and shadow so GIF sits directly on page */}
                        <img src="/hall-of-champions/tom-brady-rings.gif" alt="celebration" className="w-full h-auto object-contain max-h-56 sm:max-h-64" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                </div>
            </div>

            {/* Roster Modal */}
            {rosterModalOpen && rosterModalYear && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">{rosterModalYear} Champion Roster</h3>
                            <button onClick={closeRosterModal} className="text-gray-500 hover:text-gray-800">×</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {(() => {
                                const players = (championPlayersByYear[rosterModalYear]?.players || []) || [];
                                // Desired starter order: QB, RB, RB, FLEX (RB/WR/TE), WR, WR, TE, K, DEF
                                const starterOrder = ['QB','RB','RB','FLEX','WR','WR','TE','K','DEF'];

                                // Separate starters from bench by isStarter flag
                                const starters = players.filter(p => p.isStarter);
                                const bench = players.filter(p => !p.isStarter);

                                // Normalize position helper
                                const normPos = (pos) => (pos || '').toUpperCase();

                                // Group starters by position
                                const byPos = {};
                                starters.forEach(s => {
                                    const pos = normPos(s.position) || 'FLEX';
                                    if (!byPos[pos]) byPos[pos] = [];
                                    byPos[pos].push(s);
                                });

                                // Build ordered starters list following starterOrder
                                const orderedStarters = [];
                                const usedIds = new Set();
                                for (const slot of starterOrder) {
                                    if (slot === 'FLEX') {
                                        // pick first remaining starter not used (prefer RB/WR/TE)
                                        const remaining = starters.filter(s => !usedIds.has(s.playerId));
                                        const preferred = remaining.find(r => ['RB','WR','TE'].includes(normPos(r.position)));
                                        const pick = preferred || remaining[0];
                                        if (pick) {
                                            orderedStarters.push(pick);
                                            usedIds.add(pick.playerId);
                                        }
                                        continue;
                                    }

                                    const bucket = byPos[slot];
                                    if (bucket && bucket.length > 0) {
                                        const pick = bucket.find(b => !usedIds.has(b.playerId));
                                        if (pick) {
                                            orderedStarters.push(pick);
                                            usedIds.add(pick.playerId);
                                        }
                                    }
                                }

                                // Append any remaining starters that weren't placed (fallback)
                                starters.forEach(s => { if (!usedIds.has(s.playerId)) { orderedStarters.push(s); usedIds.add(s.playerId); } });

                                // Sort bench by position priority then name
                                const positionPriority = {
                                    'QB': 1,
                                    'RB': 2,
                                    'WR': 3,
                                    'TE': 4,
                                    'K': 5,
                                    'DEF': 6
                                };

                                const benchSorted = bench.slice().sort((a,b) => {
                                    const pa = positionPriority[normPos(a.position)] || 99;
                                    const pb = positionPriority[normPos(b.position)] || 99;
                                    if (pa !== pb) return pa - pb;
                                    return (a.name || '').localeCompare(b.name || '');
                                });

                                // Final display list: orderedStarters then benchSorted
                                const displayList = orderedStarters.concat(benchSorted);

                                // Render starters first with a divider before bench
                                return (
                                    <>
                                        {orderedStarters.map(p => (
                                            <div key={`modal-${rosterModalYear}-starter-${p.playerId}`} className="flex items-center gap-3 p-2 bg-gray-50 rounded h-20">
                                                <PlayerAvatar p={p} size={44} />
                                                <div className="min-w-0">
                                                    <div className="font-medium text-sm" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                    <div className="text-xs text-gray-500">{p.position || 'N/A'}</div>
                                                    {typeof p.starterPoints === 'number' && (
                                                        <div className="text-xs text-amber-600 font-semibold">Starter points: {p.starterPoints}</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Divider between starters and bench */}
                                        {benchSorted.length > 0 && (
                                            <div className="col-span-full my-1">
                                                <div className="border-t border-dashed border-gray-300 w-full" />
                                            </div>
                                        )}

                                        {benchSorted.map(p => (
                                            <div key={`modal-${rosterModalYear}-bench-${p.playerId}`} className="flex items-center gap-3 p-2 bg-white rounded h-18">
                                                <PlayerAvatar p={p} size={40} />
                                                <div className="min-w-0">
                                                    <div className="font-medium text-sm" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                    <div className="text-xs text-gray-500">{p.position || 'N/A'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Bracket Modal */}
            {showBracket && <BracketModal bracket={bracketData} onClose={closeBracket} />}
        </div>
    );
};

export default HallOfChampions;
