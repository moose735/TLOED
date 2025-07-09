// src/contexts/SleeperDataContext.js
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchAllHistoricalMatchups } from '../utils/sleeperApi';
import { calculateAllLeagueMetrics } from '../utils/calculations';

const SleeperData = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [allTimeRecords, setAllTimeRecords] = useState([]);
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [allTeams, setAllTeams] = useState(new Map()); // Map of season -> rosterId -> details
    const [allLeagueUsers, setAllLeagueUsers] = useState(new Map()); // Map of season -> userId -> details
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const allHistoricalDataRef = React.useRef(null);

    // Memoized getTeamName for components consuming the context.
    // This getTeamName uses the `allTeams` state.
    const getTeamName = useMemo(() => (rosterId, season = null) => {
        // First, try to find for a specific season if provided and available
        if (season && allTeams.has(String(season))) {
            const rostersForSeason = allTeams.get(String(season));
            if (rostersForSeason) {
                const rosterDetails = rostersForSeason.get(String(rosterId));
                if (rosterDetails) {
                    return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
                }
            }
        }
        // Fallback: search across all seasons if not found for specific season or no season provided
        for (const [s, rostersMap] of allTeams.entries()) {
            const rosterDetails = rostersMap.get(String(rosterId));
            if (rosterDetails) {
                return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
            }
        }
        return `Team ${rosterId}`; // Default if not found
    }, [allTeams]);

    // Memoized getOwnerName for components consuming the context.
    // This getOwnerName uses the `allLeagueUsers` state.
    const getOwnerName = useMemo(() => (userId, season = null) => {
        if (season && allLeagueUsers.has(String(season))) {
            const usersForSeason = allLeagueUsers.get(String(season));
            if (usersForSeason) {
                const userDetails = usersForSeason.get(String(userId));
                if (userDetails) {
                    return userDetails.display_name || `User ${userId}`;
                }
            }
        }
        for (const [s, usersMap] of allLeagueUsers.entries()) {
            const userDetails = usersMap.get(String(userId));
            if (userDetails) {
                return userDetails.display_name || `User ${userId}`;
            }
        }
        return `User ${userId}`;
    }, [allLeagueUsers]);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            console.log("SleeperDataProvider: Starting data fetch...");
            try {
                const historicalData = await fetchAllHistoricalMatchups();
                allHistoricalDataRef.current = historicalData;

                console.log("SleeperDataProvider: Raw historicalData fetched:", historicalData);

                if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
                    console.error("SleeperDataProvider: No valid matchupsBySeason found in historical data.");
                    throw new Error("No historical matchup data found.");
                }

                // Temporary maps to populate directly within this useEffect's scope
                // These will be used by the ephemeralGetTeamName/OwnerName functions
                const tempAllTeams = new Map();
                const tempAllLeagueUsers = new Map();

                Object.keys(historicalData.rostersBySeason).forEach(season => {
                    const rostersMapForSeason = new Map();
                    historicalData.rostersBySeason[season].forEach(roster => {
                        rostersMapForSeason.set(String(roster.roster_id), roster);
                    });
                    tempAllTeams.set(season, rostersMapForSeason);

                    const usersMapForSeason = new Map();
                    historicalData.usersBySeason[season]?.forEach(user => {
                        usersMapForSeason.set(String(user.user_id), user);
                    });
                    tempAllLeagueUsers.set(season, usersMapForSeason);
                });

                // Update the state with the populated maps. This will trigger a a re-render,
                // but the useEffect itself will not re-run because its dependencies are empty.
                setAllTeams(tempAllTeams);
                setAllLeagueUsers(tempAllLeagueUsers);

                console.log("SleeperDataProvider: Populated team/user maps.");

                // Define an ephemeral getTeamName function *for this specific calculation run*.
                // It directly uses the `tempAllTeams` populated within this `useEffect` closure,
                // ensuring it has the correct data for the calculation *at this moment*.
                const ephemeralGetTeamName = (rosterId, season = null) => {
                    const rostersForSeason = tempAllTeams.get(String(season));
                    if (rostersForSeason) {
                        const rosterDetails = rostersForSeason.get(String(rosterId));
                        if (rosterDetails) {
                            return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
                        }
                    }
                    // Fallback search across all temporary seasons
                    for (const [s, rostersMap] of tempAllTeams.entries()) {
                        const rosterDetails = rostersMap.get(String(rosterId));
                        if (rosterDetails) {
                            return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
                        }
                    }
                    return `Team ${rosterId}`;
                };

                const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(
                    historicalData,
                    ephemeralGetTeamName // Pass the ephemeral function to the calculation
                );

                setAllTimeRecords(careerDPRData);
                setProcessedSeasonalRecords(seasonalMetrics);

            } catch (err) {
                console.error("SleeperDataProvider: Failed to fetch or process historical data:", err);
                setError(err);
                // Clear any partially loaded data
                setAllTimeRecords([]);
                setProcessedSeasonalRecords({});
                setAllTeams(new Map()); // Reset to empty maps on error
                setAllLeagueUsers(new Map()); // Reset to empty maps on error
            } finally {
                setLoading(false);
                console.log("SleeperDataProvider: Data fetch process completed. Loading set to false.");
            }
        };

        fetchData();
    }, []); // <--- CRUCIAL FIX: Empty dependency array. This useEffect will now run ONLY ONCE on mount.

    const contextValue = useMemo(() => ({
        allTimeRecords,
        processedSeasonalRecords,
        getTeamName, // This is the memoized getTeamName provided to consuming components (uses 'allTeams' state)
        getOwnerName, // This is the memoized getOwnerName provided to consuming components (uses 'allLeagueUsers' state)
        loading,
        error,
    }), [allTimeRecords, processedSeasonalRecords, getTeamName, getOwnerName, loading, error]);

    return (
        <SleeperData.Provider value={contextValue}>
            {children}
        </SleeperData.Provider>
    );
};

export const useSleeperData = () => {
    const context = useContext(SleeperData);
    if (context === undefined) {
        throw new Error('useSleeperData must be used within a SleeperDataProvider');
    }
    return context;
};
