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

    // State for loading and error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Memoize the getTeamName function so it's stable across renders
    // This function now performs year-specific lookups.
    const getTeamName = useMemo(() => {
        // We'll create maps that are keyed by year for year-specific lookups
        const yearSpecificRosterToOwnerMap = new Map(); // Map: year -> (roster_id -> owner_id)
        const yearSpecificUserMap = new Map();       // Map: year -> (user_id -> user_object)

        if (historicalMatchups?.rostersBySeason) {
            Object.entries(historicalMatchups.rostersBySeason).forEach(([year, seasonRosters]) => {
                const rosterMapForYear = new Map();
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        rosterMapForYear.set(roster.roster_id, roster.owner_id);
                    });
                }
                yearSpecificRosterToOwnerMap.set(year, rosterMapForYear);
            });
        }

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

        // Add current league's users and rosters, but without a specific year context for now
        // This is a fallback if year-specific data isn't found, or for current year lookups
        const currentLeagueUserMap = new Map();
        if (usersData) {
            usersData.forEach(user => {
                currentLeagueUserMap.set(user.user_id, user);
            });
        }
        const currentLeagueRosterToOwnerMap = new Map();
        if (rostersWithDetails) {
            rostersWithDetails.forEach(roster => {
                currentLeagueRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }


        // The returned function now explicitly uses the 'year' parameter for lookups
        return (id, year = null) => {
            let user = null;
            let ownerId = null;

            if (year && yearSpecificRosterToOwnerMap.has(year) && yearSpecificUserMap.has(year)) {
                // Try year-specific lookup first
                const rosterMapForYear = yearSpecificRosterToOwnerMap.get(year);
                const userMapForYear = yearSpecificUserMap.get(year);

                ownerId = rosterMapForYear.get(id); // Check if ID is a roster_id for that year
                if (ownerId) {
                    user = userMapForYear.get(ownerId); // Get user for that year's owner_id
                    if (user) {
                        return user.metadata?.team_name || user.display_name || `User ${user.user_id} (${year})`;
                    }
                }

                // If ID is a user_id directly for that year
                user = userMapForYear.get(id);
                if (user) {
                    return user.metadata?.team_name || user.display_name || `User ${id} (${year})`;
                }
            }

            // Fallback to current league data if year-specific lookup failed or no year provided
            // This prioritizes current league users/rosters if they exist
            user = currentLeagueUserMap.get(id);
            if (user) {
                return user.metadata?.team_name || user.display_name || `User ${id}`;
            }

            ownerId = currentLeagueRosterToOwnerMap.get(id);
            if (ownerId) {
                user = currentLeagueUserMap.get(ownerId);
                if (user) {
                    return user.metadata?.team_name || user.display_name || `Roster Owner ${ownerId}`;
                }
            }

            // Final fallback
            return `Unknown Team (ID: ${id})`;
        };
    }, [usersData, rostersWithDetails, historicalMatchups]); // Re-memoize if dependencies change

    // 3. Fetch data and perform calculations on component mount
    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true); // Start loading
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

                // Update state with fetched data
                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters);
                setNflPlayers(players);
                setNflState(state);
                setHistoricalMatchups(matchups);

                // IMPORTANT: Calculate processedSeasonalRecords AFTER historicalMatchups is set
                // and getTeamName is ready (which it should be, as its dependencies are set above).
                if (matchups && Object.keys(matchups).length > 0) {
                    // calculateAllLeagueMetrics returns an object with seasonalMetrics and careerDPRData
                    // Ensure getTeamName is passed correctly here, as it's a dependency for the calculation
                    const { seasonalMetrics } = calculateAllLeagueMetrics(matchups, getTeamName);
                    console.log("SleeperDataContext: Calculated seasonalMetrics:", seasonalMetrics); // Debugging log
                    setProcessedSeasonalRecords(seasonalMetrics);
                } else {
                    console.warn("SleeperDataContext: historicalMatchups is empty or null, cannot calculate seasonal metrics.");
                    setProcessedSeasonalRecords({}); // Ensure it's an empty object if no data
                }

                setAllDraftHistory(draftHistory); // Set draft history after other data
                setLoading(false); // Set loading to false ONLY after all data and calculations are done
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, [getTeamName]); // Keep getTeamName as a dependency to ensure recalculation if its underlying maps change.
                       // This is a trade-off: it ensures data consistency, but if getTeamName's dependencies
                       // (historicalMatchups, usersData, rostersWithDetails) are changing on every render,
                       // it could still cause issues. However, they should only change once after initial fetch.


    // 4. Memoize the context value to prevent unnecessary re-renders of consumers
    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalData: historicalMatchups, // Renamed for clarity in context
        allDraftHistory,
        processedSeasonalRecords, // NEW: Include processed seasonal records
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
        processedSeasonalRecords, // NEW: Add as dependency
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
