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
        // Note: yearSpecificRosterToOwnerMap is not directly used in the returned function,
        // as getTeamName is called with ownerId (user_id) directly.
        const yearSpecificUserMap = new Map();        // Map: year -> (user_id -> user_object)

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

        // Add current league's users for fallback, without a specific year context
        const currentLeagueUserMap = new Map();
        if (usersData) {
            usersData.forEach(user => {
                currentLeagueUserMap.set(user.user_id, user);
            });
        }

        // The returned function now explicitly uses the 'year' parameter for lookups
        // The 'id' parameter here is expected to be an ownerId (user_id)
        return (ownerId, year = null) => {
            // 1. Try to find team_name for the specific year provided
            if (year && yearSpecificUserMap.has(String(year))) { // Ensure year is a string key
                const userMapForYear = yearSpecificUserMap.get(String(year));
                const userInSpecificYear = userMapForYear.get(ownerId);
                if (userInSpecificYear && userInSpecificYear.metadata?.team_name) {
                    return userInSpecificYear.metadata.team_name;
                }
            }

            // 2. If year-specific team_name not found, search for team_name across ALL historical years
            // Sort years to ensure consistent lookup order if multiple years have a team_name
            const sortedYears = Array.from(yearSpecificUserMap.keys()).sort((a,b) => parseInt(a) - parseInt(b));
            for (const historicalYear of sortedYears) {
                const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                const userInAnyHistoricalYear = userMapInHistoricalYear.get(ownerId);
                if (userInAnyHistoricalYear && userInAnyHistoricalYear.metadata?.team_name) {
                    return userInAnyHistoricalYear.metadata.team_name; // Return the first team name found
                }
            }

            // 3. Fallback to display_name for the specific year (if available)
            if (year && yearSpecificUserMap.has(String(year))) {
                const userMapForYear = yearSpecificUserMap.get(String(year));
                const userInSpecificYear = userMapForYear.get(ownerId);
                if (userInSpecificYear && userInSpecificYear.display_name) {
                    return userInSpecificYear.display_name;
                }
            }

            // 4. Fallback to display_name from any historical year
            for (const historicalYear of sortedYears) {
                const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                const userInAnyHistoricalYear = userMapInHistoricalYear.get(ownerId);
                if (userInAnyHistoricalYear && userInAnyHistoricalYear.display_name) {
                    return userInAnyHistoricalYear.display_name; // Return the first display_name found
                }
            }

            // 5. Fallback to current league data (if ownerId is found in current users)
            const currentUser = currentLeagueUserMap.get(ownerId);
            if (currentUser) {
                return currentUser.metadata?.team_name || currentUser.display_name || `User ${ownerId}`;
            }

            // 6. Fallback to careerDPRData's teamName (if it's not the default "Unknown Team")
            // This assumes careerDPRData has been calculated and contains a more permanent team name.
            const careerTeam = processedSeasonalRecords?.careerDPRData?.find(team => team.ownerId === ownerId);
            if (careerTeam && careerTeam.teamName && careerTeam.teamName !== `Unknown Team (ID: ${ownerId})`) {
                return careerTeam.teamName;
            }

            // Final fallback if no specific name is found
            return `Unknown Team (ID: ${ownerId})`;
        };
    }, [usersData, historicalMatchups, processedSeasonalRecords]); // Depend on processedSeasonalRecords for careerDPRData

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
                setAllDraftHistory(draftHistory); // Set draft history here

                // IMPORTANT: Calculate processedSeasonalRecords AFTER historicalMatchups is set
                // and getTeamName is ready (which it should be, as its dependencies are set above).
                if (matchups && Object.keys(matchups).length > 0) {
                    // calculateAllLeagueMetrics returns an object with seasonalMetrics and careerDPRData
                    // Ensure getTeamName is passed correctly here, as it's a dependency for the calculation
                    const { seasonalMetrics, careerDPRData: calculatedCareerDPRData } = calculateAllLeagueMetrics(matchups, draftHistory); // Pass draftHistory here
                    console.log("SleeperDataContext: Calculated seasonalMetrics:", seasonalMetrics); // Debugging log
                    setProcessedSeasonalRecords(seasonalMetrics);
                    // Also set careerDPRData here, as it's used by getTeamName
                    // Note: The previous code was missing setting careerDPRData here.
                    // This is crucial for the getTeamName fallback.
                    setCareerDPRData(calculatedCareerDPRData);
                } else {
                    console.warn("SleeperDataContext: historicalMatchups is empty or null, cannot calculate seasonal metrics.");
                    setProcessedSeasonalRecords({}); // Ensure it's an empty object if no data
                    setCareerDPRData(null); // Ensure careerDPRData is reset too
                }
                
                setLoading(false); // Set loading to false ONLY after all data and calculations are done
            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, []); // This effect now runs only once on mount (or if CURRENT_LEAGUE_ID were to change).


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
        careerDPRData, // Ensure careerDPRData is exposed via context
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
        careerDPRData, // Add as dependency
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
