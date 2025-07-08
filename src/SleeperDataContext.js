// src/SleeperDataContext.js
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRostersWithDetails,
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchAllDraftHistory,
} from '../utils/sleeperApi'; // Adjust path if necessary
import { CURRENT_LEAGUE_ID } from '../config'; // Adjust path if necessary

// 1. Create the Context
const SleeperDataContext = createContext();

// 2. Create the Provider Component
export const SleeperDataProvider = ({ children }) => {
    // State to hold all the fetched data
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [rostersWithDetails, setRostersWithDetails] = useState(null);
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [historicalMatchups, setHistoricalMatchups] = useState(null);
    const [allDraftHistory, setAllDraftHistory] = useState(null);

    // State for loading and error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 3. Fetch data on component mount
    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use Promise.all to fetch all data concurrently for efficiency
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

                // Update state with fetched data
                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters);
                setNflPlayers(players);
                setNflState(state);
                setHistoricalMatchups(matchups);
                setAllDraftHistory(draftHistory);

            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err); // Store the error
            } finally {
                setLoading(false); // Set loading to false regardless of success or failure
            }
        };

        loadAllSleeperData();
    }, []); // Empty dependency array ensures this runs only once on mount

    // 4. Memoize the context value to prevent unnecessary re-renders of consumers
    // Only update the 'value' object if any of its dependencies change
    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups,
        allDraftHistory,
        loading,
        error,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups,
        allDraftHistory,
        loading,
        error,
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
    // Add a check to ensure the hook is used within the Provider
    if (context === undefined) {
        throw new Error('useSleeperData must be used within a SleeperDataProvider');
    }
    return context;
};
