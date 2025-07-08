// src/contexts/SleeperDataContext.js
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRostersWithDetails,
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchLeagueDrafts, // Corrected import: fetchDrafts changed to fetchLeagueDrafts
} from '../utils/sleeperApi'; // Adjust path if necessary
import { CURRENT_LEAGUE_ID } from '../config'; // Adjust path if necessary

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
                    users, // Current league's users
                    rosters, // Current league's rosters
                    players,
                    state,
                    matchups, // All historical data including rostersBySeason and usersBySeason
                    draftHistory
                ] = await Promise.all([
                    fetchLeagueData(CURRENT_LEAGUE_ID),
                    fetchUsersData(CURRENT_LEAGUE_ID), // Fetch current league's users
                    fetchRostersWithDetails(CURRENT_LEAGUE_ID),
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(), // This now fetches historical users too
                    fetchAllDraftHistory(),
                ]);

                // Update state with fetched data
                setLeagueData(leagues);
                setUsersData(users); // Set current league's users
                setRostersWithDetails(rosters); // Set current league's rosters
                setNflPlayers(players);
                setNflState(state);
                setHistoricalMatchups(matchups); // Set all historical data
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
    // It depends on historicalMatchups (specifically historicalMatchups.rostersBySeason and historicalMatchups.usersBySeason)
    const getTeamName = useMemo(() => {
        // Create a comprehensive map for user_id to display name/team name across ALL historical seasons
        const allUserMap = new Map();
        if (historicalMatchups?.usersBySeason) {
            Object.values(historicalMatchups.usersBySeason).forEach(seasonUsers => {
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        allUserMap.set(user.user_id, user);
                    });
                }
            });
        }
        // Also add users from the current league's usersData, if it's different or more up-to-date
        // This ensures the current league's users are prioritized if there's overlap or new users
        if (usersData) {
            usersData.forEach(user => {
                allUserMap.set(user.user_id, user);
            });
        }


        // Create a comprehensive map for roster_id to owner_id across ALL historical seasons
        const allRosterToOwnerMap = new Map();
        if (historicalMatchups?.rostersBySeason) {
            Object.values(historicalMatchups.rostersBySeason).forEach(seasonRosters => {
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        allRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
                    });
                }
            });
        }
        // Also add current league's rosters to the map
        if (rostersWithDetails) {
            rostersWithDetails.forEach(roster => {
                allRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }


        return (id) => {
            // 1. Check if the ID is a user_id directly
            const user = allUserMap.get(id);
            if (user) {
                return user.metadata?.team_name || user.display_name || `User ${id}`;
            }

            // 2. If not a user_id, check if it's a roster_id (from any season) and find its owner
            const ownerId = allRosterToOwnerMap.get(id);
            if (ownerId) {
                const ownerUser = allUserMap.get(ownerId);
                if (ownerUser) {
                    return ownerUser.metadata?.team_name || ownerUser.display_name || `Roster Owner ${ownerId}`;
                }
            }
            return `Unknown Team (ID: ${id})`; // Fallback if no name found
        };
    }, [usersData, rostersWithDetails, historicalMatchups]); // Re-memoize if usersData, rostersWithDetails, or historicalMatchups change

    // 4. Memoize the context value to prevent unnecessary re-renders of consumers
    // Only update the 'value' object if any of its dependencies change
    const contextValue = useMemo(() => ({
        leagueData,
        usersData, // Current league's users
        rostersWithDetails, // Current league's rosters
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
