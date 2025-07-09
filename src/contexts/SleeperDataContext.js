// src/contexts/SleeperDataContext.js
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRostersWithDetails,
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchAllDraftHistory,
} from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config';

// IMPORT THE CALCULATION FUNCTION HERE
import { calculateAllLeagueMetrics } from '../utils/calculations';

// 1. Create the Context
const SleeperDataContext = createContext();

// 2. Create the Provider Component
export const SleeperDataProvider = ({ children }) => {
    // State to hold all the fetched data
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null); // This holds current league's users
    const [rostersWithDetails, setRostersWithDetails] = useState(null); // This holds current league's rosters
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [historicalMatchups, setHistoricalMatchups] = useState(null); // This holds historicalData with rostersBySeason AND usersBySeason
    const [allDraftHistory, setAllDraftHistory] = useState(null);

    // NEW STATE FOR PROCESSED SEASONAL RECORDS
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [careerDPRData, setCareerDPRData] = useState(null);

    // State for loading and error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Memoize the getTeamName function so it's stable across renders
    const getTeamName = useMemo(() => {
        const yearSpecificUserMap = new Map();
        if (historicalMatchups?.usersBySeason) {
            Object.entries(historicalMatchups.usersBySeason).forEach(([year, seasonUsers]) => {
                const userMapForYear = new Map();
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        userMapForYear.set(user.user_id, user);
                    });
                }
                yearSpecificUserMap.set(year, userMapForYear);
            });
        }

        const currentLeagueUserMap = new Map();
        if (usersData) { // usersData holds the current league's user information
            usersData.forEach(user => {
                currentLeagueUserMap.set(user.user_id, user);
            });
        }

        return (ownerId, year = null) => {
            // If year is null, we want the MOST CURRENT team name
            if (year === null) {
                // 1. Try to get name from current league's usersData first (most current)
                const currentUser = currentLeagueUserMap.get(ownerId);
                if (currentUser) {
                    if (currentUser.metadata?.team_name) {
                        return currentUser.metadata.team_name;
                    }
                    if (currentUser.display_name) {
                        return currentUser.display_name;
                    }
                }

                // 2. If not found in current data, search historical data from most recent year backwards
                const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                for (const historicalYear of sortedYearsDesc) {
                    const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                    const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                    if (userInHistoricalYear) {
                        if (userInHistoricalYear.metadata?.team_name) {
                            return userInHistoricalYear.metadata.team_name;
                        }
                        if (userInHistoricalYear.display_name) {
                            return userInHistoricalYear.display_name;
                        }
                    }
                }

                // 3. Fallback to careerDPRData's teamName if available and not generic
                const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                if (careerTeam && careerTeam.teamName && careerTeam.teamName !== `Unknown Team (ID: ${ownerId})`) {
                    return careerTeam.teamName;
                }
            } else {
                // If a specific year is provided, prioritize that year's name
                if (yearSpecificUserMap.has(String(year))) {
                    const userMapForYear = yearSpecificUserMap.get(String(year));
                    const userInSpecificYear = userMapForYear.get(ownerId);
                    if (userInSpecificYear) {
                        if (userInSpecificYear.metadata?.team_name) {
                            return userInSpecificYear.metadata.team_name;
                        }
                        if (userInSpecificYear.display_name) {
                            return userInSpecificYear.display_name;
                        }
                    }
                }

                // Fallback for historical lookups if specific year data is missing,
                // still try to find *any* historical name (from most recent to oldest)
                const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                for (const historicalYear of sortedYearsDesc) {
                    const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                    const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                    if (userInHistoricalYear) {
                        if (userInHistoricalYear.metadata?.team_name) {
                            return userInHistoricalYear.metadata.team_name;
                        }
                        if (userInHistoricalYear.display_name) {
                            return userInHistoricalYear.display_name;
                        }
                    }
                }
                
                // Fallback to careerDPRData if historical year-specific or general historical names not found
                const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                if (careerTeam && careerTeam.teamName && careerTeam.teamName !== `Unknown Team (ID: ${ownerId})`) {
                    return careerTeam.teamName;
                }
            }

            // Final fallback if no specific name is found
            return `Unknown Team (ID: ${ownerId})`;
        };
    }, [usersData, historicalMatchups, careerDPRData]); // Depend on careerDPRData now that it's state

    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    leagues,
                    users,
                    rosters,
                    players,
                    state,
                    matchups,
                    draftHistory
                ] = await Promise.all([
                    fetchLeagueData(CURRENT_LEAGUE_ID),
                    fetchUsersData(CURRENT_LEAGUE_ID),
                    fetchRostersWithDetails(CURRENT_LEAGUE_ID),
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(),
                    fetchAllDraftHistory(),
                ]);

                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters);
                setNflPlayers(players);
                setNflState(state);
                setHistoricalMatchups(matchups);
                setAllDraftHistory(draftHistory);

                if (matchups && Object.keys(matchups).length > 0) {
                    const { seasonalMetrics, careerDPRData: calculatedCareerDPRData } = calculateAllLeagueMetrics(matchups, draftHistory, getTeamName);
                    console.log("SleeperDataContext: Calculated seasonalMetrics:", seasonalMetrics);
                    setProcessedSeasonalRecords(seasonalMetrics);
                    setCareerDPRData(calculatedCareerDPRData);
                } else {
                    console.warn("SleeperDataContext: historicalMatchups is empty or null, cannot calculate seasonal metrics.");
                    setProcessedSeasonalRecords({});
                    setCareerDPRData(null);
                }
                
                setLoading(false);
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, []); // This effect now runs only once on mount (or if CURRENT_LEAGUE_ID were to change).


    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalData: historicalMatchups,
        allDraftHistory,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups,
        allDraftHistory,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
    ]);

    return (
        <SleeperDataContext.Provider value={contextValue}>
            {children}
        </SleeperDataContext.Provider>
    );
};

// 5. Create a Custom Hook to consume the context
export const useSleeperData = () => {
    const context = useContext(SleeperDataContext);
    if (context === undefined) {
        throw new Error('useSleeperData must be used within a SleeperDataProvider');
    }
    return context;
};
