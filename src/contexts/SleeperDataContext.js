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
    // This needs to be defined BEFORE the useEffect that calls calculateAllLeagueMetrics
    // because calculateAllLeagueMetrics depends on getTeamName.
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
                setAllDraftHistory(draftHistory);

                // IMPORTANT: Calculate processedSeasonalRecords AFTER historicalMatchups is set
                // and getTeamName is ready (which it should be, as its dependencies are set above).
                if (matchups && Object.keys(matchups).length > 0) {
                    // calculateAllLeagueMetrics returns an object with seasonalMetrics and careerDPRData
                    const { seasonalMetrics } = calculateAllLeagueMetrics(matchups, getTeamName);
                    console.log("SleeperDataContext: Calculated seasonalMetrics:", seasonalMetrics); // Debugging log
                    setProcessedSeasonalRecords(seasonalMetrics);
                } else {
                    console.warn("SleeperDataContext: historicalMatchups is empty or null, cannot calculate seasonal metrics.");
                    setProcessedSeasonalRecords({}); // Ensure it's an empty object if no data
                }

                setLoading(false); // Set loading to false ONLY after all data and calculations are done
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, [getTeamName]); // Add getTeamName as a dependency to ensure it's stable when calculateAllLeagueMetrics is called.
    // getTeamName itself depends on historicalMatchups, usersData, rostersWithDetails.
    // This ensures that when the underlying data for getTeamName changes, this effect re-runs.


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
