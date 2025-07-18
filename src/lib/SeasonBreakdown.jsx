import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the calculation utility

const SeasonBreakdown = () => {
    const {
        loading,
        error,
        historicalData,
        usersData,
        allDraftHistory, // Import allDraftHistory
        nflState // Import nflState
    } = useSleeperData();

    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [seasonStandings, setSeasonStandings] = useState([]);
    const [seasonChampion, setSeasonChampion] = useState('N/A');
    const [seasonRunnerUp, setSeasonRunnerUp] = useState('N/A');
    const [seasonThirdPlace, setSeasonThirdPlace] = useState('N/A');

    // Helper function to get user display name (reused from App.js)
    // Now accepts an optional 'year' to look up historical team names
    const getUserDisplayName = useCallback((userId, currentUsersData, year = null) => {
        if (!userId || !currentUsersData) {
            return 'Unknown User';
        }

        let usersSource = currentUsersData;
        // If a year is provided and historicalData has users for that year, use that specific year's users
        if (year && historicalData && historicalData.usersBySeason && historicalData.usersBySeason[year]) {
            usersSource = historicalData.usersBySeason[year];
        }

        let usersArray = [];
        if (Array.isArray(usersSource)) {
            usersArray = usersSource;
        } else if (typeof usersSource === 'object' && usersSource !== null) {
            // If usersSource is an object (e.g., {userId: userObject}), convert its values to an array
            usersArray = Object.values(usersSource);
        } else {
            return 'Unknown User'; // usersSource is neither an array nor a valid object
        }

        const user = usersArray.find(u => u.user_id === userId);
        if (user) {
            return user.metadata?.team_name || user.display_name;
        } else {
            // If user is not found by ID, check if userId itself is a display name (e.g., from Google Sheet)
            // This is a fallback and assumes the userId might directly be the team name if not found in users.
            // This is less robust but handles cases where IDs might not map perfectly.
            // A more robust solution would involve a comprehensive mapping.
            return userId; // Return the userId itself as a last resort
        }
    }, [historicalData]); // Add historicalData to dependency array for useCallback

    // Memoize the result of calculateAllLeagueMetrics
    const { seasonalMetrics, careerDPRData } = useMemo(() => {
        if (!historicalData || !allDraftHistory || !nflState || !usersData || loading || error) {
            return { seasonalMetrics: {}, careerDPRData: [] };
        }
        // Pass a year-aware getTeamName function to calculateAllLeagueMetrics
        // This function will be called by calculateAllLeagueMetrics with ownerId and year
        const getTeamNameForCalculations = (ownerId, year) => getUserDisplayName(ownerId, usersData, year);

        return calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamNameForCalculations, nflState);
    }, [historicalData, allDraftHistory, nflState, usersData, loading, error, getUserDisplayName]);


    // Effect to populate seasons dropdown and set default selected season
    useEffect(() => {
        if (!loading && !error && historicalData) {
            const allYears = new Set();
            // Use seasonalMetrics keys as the primary source for available years
            if (seasonalMetrics) {
                Object.keys(seasonalMetrics).forEach(year => allYears.add(Number(year)));
            } else {
                // Fallback to other historicalData keys if seasonalMetrics isn't ready
                if (historicalData.matchupsBySeason) {
                    Object.keys(historicalData.matchupsBySeason).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.seasonAwardsSummary) {
                    Object.keys(historicalData.seasonAwardsSummary).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.winnersBracketBySeason) {
                    Object.keys(historicalData.winnersBracketBySeason).forEach(year => allYears.add(Number(year)));
                }
            }

            const sortedYears = Array.from(allYears).sort((a, b) => b - a);
            setSeasons(sortedYears);

            // Set the most recent year as default
            if (sortedYears.length > 0) {
                setSelectedSeason(sortedYears[0]);
            }
        }
    }, [loading, error, historicalData, seasonalMetrics]); // Added seasonalMetrics to dependency array

    // Effect to calculate standings and champion for the selected season
    useEffect(() => {
        if (selectedSeason && historicalData && usersData && seasonalMetrics[selectedSeason]) {
            const currentSeasonMetrics = seasonalMetrics[selectedSeason];
            const currentSeasonRosters = historicalData.rostersBySeason[selectedSeason]; // Still need rosters for owner_id mapping

            if (!currentSeasonMetrics || !currentSeasonRosters) {
                setSeasonStandings([]);
                setSeasonChampion('N/A');
                setSeasonRunnerUp('N/A');
                setSeasonThirdPlace('N/A');
                return;
            }

            // --- Calculate Standings using seasonalMetrics ---
            const standingsArray = Object.values(currentSeasonMetrics).map(teamData => {
                // Use the teamName already resolved by calculateAllLeagueMetrics
                return {
                    teamName: teamData.teamName,
                    wins: teamData.wins,
                    losses: teamData.losses,
                    ties: teamData.ties,
                    pointsFor: teamData.pointsFor,
                    pointsAgainst: teamData.pointsAgainst,
                    rosterId: teamData.rosterId,
                    ownerId: teamData.ownerId,
                };
            });

            // Sort standings
            const sortedStandings = standingsArray.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (a.losses !== b.losses) return a.losses - b.losses;
                return b.pointsFor - a.pointsFor;
            });
            setSeasonStandings(sortedStandings);

            // --- Determine Champion, Runner-Up, and Third Place for the selected season ---
            let champion = 'N/A';
            let runnerUp = 'N/A';
            let thirdPlace = 'N/A';

            if (historicalData.winnersBracketBySeason && historicalData.winnersBracketBySeason[selectedSeason]) {
                const winnersBracket = historicalData.winnersBracketBySeason[selectedSeason];

                // Find Championship Game (p: 1)
                const championshipGame = winnersBracket.find(matchup => matchup.p === 1 && matchup.w && matchup.l);
                if (championshipGame) {
                    const championRosterId = String(championshipGame.w).trim();
                    const runnerUpRosterId = String(championshipGame.l).trim();

                    const winningRoster = currentSeasonRosters.find(r => String(r.roster_id) === championRosterId);
                    const runnerUpRoster = currentSeasonRosters.find(r => String(r.roster_id) === runnerUpRosterId);

                    if (winningRoster && winningRoster.owner_id) {
                        champion = getUserDisplayName(winningRoster.owner_id, usersData, selectedSeason);
                    }
                    if (runnerUpRoster && runnerUpRoster.owner_id) {
                        runnerUp = getUserDisplayName(runnerUpRoster.owner_id, usersData, selectedSeason);
                    }
                }

                // Find 3rd Place Game (p: 3)
                const thirdPlaceGame = winnersBracket.find(matchup => matchup.p === 3 && matchup.w);
                if (thirdPlaceGame) {
                    const thirdPlaceRosterId = String(thirdPlaceGame.w).trim();
                    const thirdPlaceRoster = currentSeasonRosters.find(r => String(r.roster_id) === thirdPlaceRosterId);

                    if (thirdPlaceRoster && thirdPlaceRoster.owner_id) {
                        thirdPlace = getUserDisplayName(thirdPlaceRoster.owner_id, usersData, selectedSeason);
                    }
                }
            }

            // Fallback to seasonAwardsSummary/awardsSummary for champion if playoff data is missing
            if (champion === 'N/A' && historicalData.seasonAwardsSummary && historicalData.seasonAwardsSummary[selectedSeason]) {
                const summary = historicalData.seasonAwardsSummary[selectedSeason];
                if (summary.champion && summary.champion !== 'N/A' && summary.champion.trim() !== '') {
                    const potentialChampionValue = summary.champion.trim();
                    const resolvedName = getUserDisplayName(potentialChampionValue, usersData, selectedSeason);
                    if (resolvedName !== 'Unknown User') {
                        champion = resolvedName;
                    } else {
                        champion = potentialChampionValue;
                    }
                }
            }
            if (champion === 'N/A' && historicalData.awardsSummary && historicalData.awardsSummary[selectedSeason]) {
                const summary = historicalData.awardsSummary[selectedSeason];
                const champKey = summary.champion || summary["Champion"];
                if (champKey && champKey !== 'N/A' && String(champKey).trim() !== '') {
                    const potentialChampionValue = String(champKey).trim();
                    const resolvedName = getUserDisplayName(potentialChampionValue, usersData, selectedSeason);
                    if (resolvedName !== 'Unknown User') {
                        champion = resolvedName;
                    } else {
                        champion = potentialChampionValue;
                    }
                }
            }
            setSeasonChampion(champion);
            setSeasonRunnerUp(runnerUp);
            setSeasonThirdPlace(thirdPlace);

        } else if (!selectedSeason) {
            setSeasonStandings([]);
            setSeasonChampion('N/A');
            setSeasonRunnerUp('N/A');
            setSeasonThirdPlace('N/A');
        }
    }, [selectedSeason, historicalData, usersData, seasonalMetrics, getUserDisplayName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-6 bg-white rounded-lg shadow-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Loading season data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                    <p className="font-bold text-xl mb-2">Error Loading Data</p>
                    <p className="text-base">Failed to load season data: {error.message || String(error)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Season Breakdown</h2>

            <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                <label htmlFor="season-select" className="text-lg font-semibold text-gray-700">Select Season:</label>
                <select
                    id="season-select"
                    value={selectedSeason || ''}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 text-lg"
                >
                    {seasons.length === 0 && <option value="">No Seasons Available</option>}
                    {seasons.map(year => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            {selectedSeason && (
                <div className="mt-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-20 text-center"> {/* Increased margin-bottom */}
                        {selectedSeason} Season Summary
                    </h3>

                    {/* Podium Section */}
                    {(seasonChampion !== 'N/A' || seasonRunnerUp !== 'N/A' || seasonThirdPlace !== 'N/A') ? (
                        <div className="relative flex justify-center items-end h-56 gap-2 md:gap-4 mb-8"> {/* Adjusted overall height */}
                            {/* 2nd Place */}
                            {seasonRunnerUp !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-4/5 bg-gray-300 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2"> {/* Adjusted top for larger icon */}
                                        <i className="fas fa-trophy text-gray-500 text-5xl"></i> {/* Reverted to Font Awesome, silver color */}
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold text-gray-700">2nd Place</span>
                                    <p className="text-base md:text-lg font-semibold text-gray-800">{seasonRunnerUp}</p>
                                </div>
                            )}

                            {/* 1st Place */}
                            {seasonChampion !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-full bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-20 left-1/2 -translate-x-1/2"> {/* Adjusted top for larger icon */}
                                        <span className="text-7xl">🏆</span> {/* Kept as emoji for gold */}
                                    </div>
                                    <span className="text-2xl md:text-3xl font-bold text-white">SWEEN BOWL CHAMPION</span>
                                    <p className="text-lg md:text-xl font-semibold text-white">{seasonChampion}</p>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {seasonThirdPlace !== 'N/A' && (
                                <div className="relative flex flex-col items-center justify-center h-3/5 bg-amber-700 rounded-lg shadow-lg p-2 md:p-4 w-1/3 text-center text-white transition-all duration-300 hover:scale-105">
                                    <div className="absolute -top-16 left-1/2 -translate-x-1/2"> {/* Adjusted top for larger icon */}
                                        <i className="fas fa-trophy text-amber-800 text-5xl"></i> {/* Reverted to Font Awesome, bronze color */}
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold">3rd Place</span>
                                    <p className="text-base md:text-lg font-semibold">{seasonThirdPlace}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-center text-gray-600">No playoff results available for this season to determine podium.</p>
                    )}


                    {/* Season Standings Table */}
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Season Standings</h3>
                    {seasonStandings.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg shadow-md">
                            <table className="min-w-full bg-white border border-gray-200">
                                <thead className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal">
                                    <tr>
                                        <th className="py-3 px-6 text-left">Rank</th>
                                        <th className="py-3 px-6 text-left">Team</th>
                                        <th className="py-3 px-6 text-center">W</th>
                                        <th className="py-3 px-6 text-center">L</th>
                                        <th className="py-3 px-6 text-center">T</th>
                                        <th className="py-3 px-6 text-center">PF</th>
                                        <th className="py-3 px-6 text-center">PA</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700 text-sm font-light">
                                    {seasonStandings.map((team, index) => (
                                        <tr key={team.rosterId} className="border-b border-gray-200 hover:bg-gray-100">
                                            <td className="py-3 px-6 text-left whitespace-nowrap font-medium">{index + 1}</td>
                                            <td className="py-3 px-6 text-left">{team.teamName}</td>
                                            <td className="py-3 px-6 text-center">{team.wins}</td>
                                            <td className="py-3 px-6 text-center">{team.losses}</td>
                                            <td className="py-3 px-6 text-center">{team.ties}</td>
                                            <td className="py-3 px-6 text-center">{team.pointsFor.toFixed(2)}</td>
                                            <td className="py-3 px-6 text-center">{team.pointsAgainst.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-gray-600">No standings data available for this season.</p>
                    )}
                </div>
            )}
            {!selectedSeason && !loading && !error && (
                <p className="text-center text-gray-600 text-lg mt-8">Please select a season from the dropdown to view its breakdown.</p>
            )}
        </div>
    );
};

export default SeasonBreakdown;
