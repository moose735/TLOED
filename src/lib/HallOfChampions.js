import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

const HallOfChampions = () => {
    // Consume historical data and user information from the context
    const { historicalData, usersData } = useSleeperData();
    const [championsByYear, setChampionsByYear] = useState([]);
    const [isDataReady, setIsDataReady] = useState(false);

    // Helper function to get the team name from a user ID
    const getUserDisplayName = (userId) => {
        if (!userId || !usersData) {
            return 'Unknown Champion';
        }
        const user = usersData.find(u => u.user_id === userId);
        if (user) {
            // Prioritize team_name from metadata, otherwise use display_name
            return user.metadata?.team_name || user.display_name;
        }
        return 'Unknown Champion';
    };

    // Effect to process historical data and build the list of champions
    useEffect(() => {
        // Ensure all necessary data is available before processing
        const allDataPresent = historicalData && usersData && historicalData.winnersBracketBySeason && historicalData.rostersBySeason;
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
                    const rostersForYear = historicalData.rostersBySeason[yearNumber];
                    const winningRoster = rostersForYear.find(roster => String(roster.roster_id) === winningRosterId);

                    if (winningRoster && winningRoster.owner_id) {
                        championUserId = winningRoster.owner_id;
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
                    const championName = getUserDisplayName(championUserId);
                    allChampions.push({
                        year: yearNumber,
                        name: championName !== 'Unknown Champion' ? championName : championUserId, // Use the raw ID if the name can't be resolved
                        championId: championUserId,
                    });
                }
            }
            setChampionsByYear(allChampions);
        }
    }, [historicalData, usersData]);

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
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {championsByYear.map((champion, index) => (
                    <div key={index} className="p-6 bg-gray-50 rounded-lg shadow-md flex flex-col items-center text-center transition-transform transform hover:scale-105 hover:shadow-lg">
                        <i className="fas fa-trophy text-[#eab308] text-4xl mb-3"></i>
                        <div className="text-gray-900 font-bold text-xl mb-1">{champion.year}</div>
                        <div className="text-gray-700 text-lg font-semibold">{champion.name}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HallOfChampions;
