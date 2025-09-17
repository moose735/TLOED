import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

// Import champion images (you can add these)
// Example: import champion2024 from '../assets/images/champions/2024-champion.jpg';

const HallOfChampions = () => {
    // Consume historical data and user information from the context
    const { historicalData, getTeamName, getTeamDetails } = useSleeperData();
    const [championsByYear, setChampionsByYear] = useState([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const [selectedYear, setSelectedYear] = useState(null);
    const [showBracket, setShowBracket] = useState(false);
    const [bracketData, setBracketData] = useState(null);

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
        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl font-inter">
            <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Hall of Champions</h2>
            <p className="text-lg text-gray-600 mb-6 text-center max-w-2xl mx-auto">
                Celebrating the winners of the past. Each year, only one team can ascend to the throne of fantasy glory.
                Click on any champion to view their championship bracket!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {championsByYear.map((champion, index) => (
                    <div 
                        key={index} 
                        onClick={() => champion.hasBracket ? handleChampionClick(champion.year) : null}
                        className={`p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl shadow-lg flex flex-col items-center text-center transition-all transform ${
                            champion.hasBracket 
                                ? 'hover:scale-105 hover:shadow-xl cursor-pointer hover:from-yellow-100 hover:to-amber-100' 
                                : ''
                        } border border-yellow-200`}
                    >
                        {/* Champion Image */}
                        {champion.image ? (
                            <div className="mb-4 overflow-hidden border-4 border-yellow-400 shadow-lg flex items-center justify-center bg-white">
                                <img
                                    src={champion.image}
                                    alt={`${champion.year} Champion`}
                                    className="block w-auto h-auto max-w-full max-h-48"
                                    style={{ display: 'block' }}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                />
                                {/* Trophy/medal icon removed */}
                            </div>
                        ) : (
                            /* Fallback: Team Avatar or Trophy Icon */
                            <div className="w-24 h-24 sm:w-32 sm:h-32 mb-4 overflow-hidden border-4 border-yellow-400 shadow-lg bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center">
                                {champion.avatar ? (
                                    <img
                                        src={champion.avatar}
                                        alt={champion.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : null}
                                {/* Trophy/medal icon removed */}
                            </div>
                        )}
                        
                        {/* Year */}
                        <div className="text-gray-900 font-bold text-2xl mb-2">{champion.year}</div>
                        
                        {/* Champion Name */}
                        <div className="text-gray-700 text-lg font-semibold mb-2">{champion.name}</div>
                        
                        {/* Trophy icon removed from champion card */}
                        
                        {/* Click to view bracket hint */}
                        {champion.hasBracket && (
                            <div className="text-xs text-blue-600 font-medium">
                                📊 Click to view bracket
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Bracket Modal */}
            {showBracket && <BracketModal bracket={bracketData} onClose={closeBracket} />}
        </div>
    );
};

export default HallOfChampions;
