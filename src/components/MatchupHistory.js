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
    // It depends on usersData and historicalMatchups (specifically historicalMatchups.rostersBySeason and historicalMatchups.usersBySeason)
    const getTeamName = useMemo(() => {
        // Create a comprehensive map for user_id to user details across ALL historical seasons
        // This will be used as a fallback if season-specific data isn't found
        const globalUserMap = new Map();
        if (historicalMatchups?.usersBySeason) {
            Object.values(historicalMatchups.usersBySeason).forEach(seasonUsers => {
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        globalUserMap.set(user.user_id, user);
                    });
                }
            });
        }
        // Also add users from the current league's usersData, prioritizing it
        if (usersData) {
            usersData.forEach(user => {
                globalUserMap.set(user.user_id, user);
            });
        }

        // Create a comprehensive map for roster_id to owner_id across ALL historical seasons
        // This will be used as a fallback if season-specific data isn't found
        const globalRosterToOwnerMap = new Map();
        if (historicalMatchups?.rostersBySeason) {
            Object.values(historicalMatchups.rostersBySeason).forEach(seasonRosters => {
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        globalRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
                    });
                }
            });
        }
        // Also add current league's rosters to the map
        if (rostersWithDetails) {
            rostersWithDetails.forEach(roster => {
                globalRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }


        // The main getTeamName function, now accepting an optional 'season' parameter
        return (id, season = null) => {
            let user = null;
            let ownerId = null;

            // --- Attempt to get season-specific name first if season is provided ---
            if (season && historicalMatchups?.usersBySeason?.[season] && historicalMatchups?.rostersBySeason?.[season]) {
                const seasonUsers = historicalMatchups.usersBySeason[season];
                const seasonRosters = historicalMatchups.rostersBySeason[season];

                // Check if ID is a user_id for this season
                user = seasonUsers.find(u => u.user_id === id);
                if (user) {
                    return user.metadata?.team_name || user.display_name || `User ${id} (${season})`;
                }

                // Check if ID is a roster_id for this season and find its owner
                const rosterForSeason = seasonRosters.find(r => r.roster_id === id);
                if (rosterForSeason?.owner_id) {
                    ownerId = rosterForSeason.owner_id;
                    user = seasonUsers.find(u => u.user_id === ownerId);
                    if (user) {
                        return user.metadata?.team_name || user.display_name || `Roster Owner ${ownerId} (${season})`;
                    }
                }
            }

            // --- Fallback to global maps if season-specific lookup fails or no season provided ---

            // 1. Check if the ID is a user_id directly in the global map
            user = globalUserMap.get(id);
            if (user) {
                return user.metadata?.team_name || user.display_name || `User ${id}`;
            }

            // 2. If not a user_id, check if it's a roster_id in the global map and find its owner
            ownerId = globalRosterToOwnerMap.get(id);
            if (ownerId) {
                const ownerUser = globalUserMap.get(ownerId);
                if (ownerUser) {
                    return ownerUser.metadata?.team_name || ownerUser.display_name || `Roster Owner ${ownerId}`;
                }
            }

            return `Unknown Team (ID: ${id})`; // Final fallback
        };
    }, [usersData, rostersWithDetails, historicalMatchups]); // Re-memoize if these dependencies change

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
