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
            setLoading(true); // Start loading
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

                // Set loading to false ONLY after all data states have been updated
                setLoading(false); 
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err); // Store the error object
                setLoading(false); // Set loading to false even on error
            }
        };

        loadAllSleeperData();
    }, []); // Empty dependency array ensures this runs only once on mount

    // Memoize the getTeamName function so it's stable across renders
    // It depends on usersData and rostersWithDetails
    const getTeamName = useMemo(() => {
        // Create a map for quick lookup of user_id to display name/team name
        const userMap = new Map();
        if (usersData) {
            usersData.forEach(user => {
                userMap.set(user.user_id, user);
            });
        }

        // Create a map for quick lookup of roster_id to owner_id for the *current* league
        // Assuming rostersWithDetails contains roster data for the current league.
        // If rostersWithDetails contains multiple seasons, this needs refinement.
        // For now, it's assumed to be the current league's rosters as fetched by fetchRostersWithDetails(CURRENT_LEAGUE_ID)
        const rosterToOwnerMap = new Map();
        if (rostersWithDetails) {
            rostersWithDetails.forEach(roster => {
                rosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }

        return (id) => {
            // Check if the ID is a user_id first
            const user = userMap.get(id);
            if (user) {
                return user.metadata?.team_name || user.display_name || `User ${id}`;
            }

            // If not a user_id, check if it's a roster_id and find its owner
            const ownerId = rosterToOwnerMap.get(id);
            if (ownerId) {
                const ownerUser = userMap.get(ownerId);
                if (ownerUser) {
                    return ownerUser.metadata?.team_name || ownerUser.display_name || `Roster Owner ${ownerId}`;
                }
            }
            return `Loading Team...`; // Fallback if no name found
        };
    }, [usersData, rostersWithDetails]); // Re-memoize if usersData or rostersWithDetails change

    // 4. Memoize the context value to prevent unnecessary re-renders of consumers
    // Only update the 'value' object if any of its dependencies change
    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails, // This is the current league's rosters
        nflPlayers,
        nflState,
        historicalData: historicalMatchups, // Renamed for clarity in context
        allDraftHistory,
        loading,
        error,
        getTeamName, // Include the memoized getTeamName function
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
        getTeamName, // Dependency for the context value
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
