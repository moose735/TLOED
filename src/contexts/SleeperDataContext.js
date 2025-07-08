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
    // It depends on usersData, rostersWithDetails, and historicalMatchups
    const getTeamName = useMemo(() => {
        // Create global maps for fallback if season-specific data isn't found
        const globalUserMap = new Map();
        const globalRosterToOwnerMap = new Map();

        // Populate global maps with ALL historical and current data
        if (historicalMatchups?.usersBySeason) {
            Object.values(historicalMatchups.usersBySeason).forEach(seasonUsers => {
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        globalUserMap.set(user.user_id, user);
                    });
                }
            });
        }
        if (usersData) { // Add current users, prioritizing them if there's overlap
            usersData.forEach(user => {
                globalUserMap.set(user.user_id, user);
            });
        }

        if (historicalMatchups?.rostersBySeason) {
            Object.values(historicalMatchups.rostersBySeason).forEach(seasonRosters => {
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        globalRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
                    });
                }
            });
        }
        if (rostersWithDetails) { // Add current rosters, prioritizing them if there's overlap
            rostersWithDetails.forEach(roster => {
                globalRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }


        // The main getTeamName function, now accepting an optional 'season' parameter
        return (id, season = null) => {
            console.log(`getTeamName called for ID: ${id}, Season: ${season}`);
            let user = null;
            let ownerId = null;
            let resolvedName = null;

            // --- Attempt to get season-specific name first if season is provided ---
            if (season && historicalMatchups?.usersBySeason?.[season] && historicalMatchups?.rostersBySeason?.[season]) {
                const seasonUsers = historicalMatchups.usersBySeason[season];
                const seasonRosters = historicalMatchups.rostersBySeason[season];
                console.log(`  Attempting season-specific lookup for ${season}...`);

                // 1. Check if ID is a user_id for this specific season
                user = seasonUsers.find(u => u.user_id === id);
                if (user) {
                    resolvedName = user.metadata?.team_name || user.display_name;
                    if (resolvedName) {
                        console.log(`  Found user_id directly in season ${season}: ${resolvedName}`);
                        return resolvedName;
                    }
                    console.log(`  User ID ${id} found in season ${season}, but no team_name or display_name. Falling back.`);
                }

                // 2. Check if ID is a roster_id for this specific season and find its owner
                const rosterForSeason = seasonRosters.find(r => String(r.roster_id) === String(id)); // Ensure string comparison
                if (rosterForSeason?.owner_id) {
                    ownerId = rosterForSeason.owner_id;
                    user = seasonUsers.find(u => u.user_id === ownerId);
                    if (user) {
                        resolvedName = user.metadata?.team_name || user.display_name;
                        if (resolvedName) {
                            console.log(`  Found roster_id ${id} (owner ${ownerId}) in season ${season}: ${resolvedName}`);
                            return resolvedName;
                        }
                        console.log(`  Roster ID ${id} (owner ${ownerId}) found in season ${season}, but no team_name or display_name. Falling back.`);
                    } else {
                        console.log(`  Roster ID ${id} found in season ${season}, but owner_id ${ownerId} not found in season users.`);
                    }
                } else {
                    console.log(`  Roster ID ${id} not found in season ${season} rosters, or no owner_id.`);
                }
            }

            // --- Fallback to current league data if season-specific lookup fails or no season provided ---
            console.log(`  Attempting current league lookup...`);
            if (usersData) { // usersData is the current league's users
                user = usersData.find(u => u.user_id === id);
                if (user) {
                    resolvedName = user.metadata?.team_name || user.display_name;
                    if (resolvedName) {
                        console.log(`  Found user_id directly in current league: ${resolvedName}`);
                        return resolvedName;
                    }
                    console.log(`  User ID ${id} found in current league, but no team_name or display_name. Falling back.`);
                }
            }
            if (rostersWithDetails) { // rostersWithDetails is the current league's rosters
                const rosterForCurrent = rostersWithDetails.find(r => String(r.roster_id) === String(id)); // Ensure string comparison
                if (rosterForCurrent?.owner_id) {
                    ownerId = rosterForCurrent.owner_id;
                    user = usersData.find(u => u.user_id === ownerId);
                    if (user) {
                        resolvedName = user.metadata?.team_name || user.display_name;
                        if (resolvedName) {
                            console.log(`  Found roster_id ${id} (owner ${ownerId}) in current league: ${resolvedName}`);
                            return resolvedName;
                        }
                        console.log(`  Roster ID ${id} (owner ${ownerId}) found in current league, but no team_name or display_name. Falling back.`);
                    } else {
                        console.log(`  Roster ID ${id} found in current league, but owner_id ${ownerId} not found in current users.`);
                    }
                } else {
                    console.log(`  Roster ID ${id} not found in current league rosters, or no owner_id.`);
                }
            }

            // --- Final Fallback: Use global aggregated maps ---
            console.log(`  Attempting global lookup...`);
            user = globalUserMap.get(id);
            if (user) {
                resolvedName = user.metadata?.team_name || user.display_name;
                if (resolvedName) {
                    console.log(`  Found user_id directly in global map: ${resolvedName}`);
                    return resolvedName;
                }
                console.log(`  User ID ${id} found in global map, but no team_name or display_name. Falling back.`);
            }

            ownerId = globalRosterToOwnerMap.get(id);
            if (ownerId) {
                const ownerUser = globalUserMap.get(ownerId);
                if (ownerUser) {
                    resolvedName = ownerUser.metadata?.team_name || ownerUser.display_name;
                    if (resolvedName) {
                        console.log(`  Found roster_id ${id} (owner ${ownerId}) in global map: ${resolvedName}`);
                        return resolvedName;
                    }
                    console.log(`  Roster ID ${id} (owner ${ownerId}) found in global map, but no team_name or display_name. Falling back.`);
                } else {
                    console.log(`  Roster ID ${id} found in global map, but owner_id ${ownerId} not found in global users.`);
                }
            }
            console.log(`  No team name found for ID: ${id}. Returning fallback.`);
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
