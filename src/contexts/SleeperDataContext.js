// src/contexts/SleeperDataContext.js
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchAllHistoricalMatchups } from '../utils/sleeperApi';
import { calculateAllTimeRecords, calculateSeasonalMetrics } from '../utils/calculations';

const SleeperData = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [allTimeRecords, setAllTimeRecords] = useState([]);
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [allTeams, setAllTeams] = useState(new Map()); // Map of roster_id to team details (e.g., name, owner)
    const [allLeagueUsers, setAllLeagueUsers] = useState(new Map()); // Map of user_id to user details
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Ref to hold the raw historical data, accessible within memoized functions
    const allHistoricalDataRef = React.useRef(null);

    // Memoized getTeamName and getOwnerName functions (from previous discussion)
    const getTeamName = useMemo(() => (rosterId, season = null) => {
        const rostersForSeason = allTeams.get(String(season));
        if (rostersForSeason) {
            const rosterDetails = rostersForSeason.get(String(rosterId));
            if (rosterDetails) {
                return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
            }
        }
        for (const [s, rostersMap] of allTeams.entries()) {
            const rosterDetails = rostersMap.get(String(rosterId));
            if (rosterDetails) {
                return rosterDetails.ownerTeamName || rosterDetails.ownerDisplayName || `Team ${rosterId}`;
            }
        }
        return `Team ${rosterId}`;
    }, [allTeams]);

    const getOwnerName = useMemo(() => (userId, season = null) => {
        const usersForSeason = allLeagueUsers.get(String(season));
        if (usersForSeason) {
            const userDetails = usersForSeason.get(String(userId));
            if (userDetails) {
                return userDetails.display_name || `User ${userId}`;
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
            console.log("SleeperDataProvider: Starting data fetch..."); // NEW LOG
            try {
                const historicalData = await fetchAllHistoricalMatchups();
                allHistoricalDataRef.current = historicalData; // Store in ref

                console.log("SleeperDataProvider: Raw historicalData fetched:", historicalData); // NEW LOG

                // Check if key data parts are missing
                if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
                    console.error("SleeperDataProvider: No valid matchupsBySeason found in historical data."); // NEW LOG
                    throw new Error("No historical matchup data found.");
                }

                // Populate allTeams and allLeagueUsers maps
                const tempAllTeams = new Map(); // Map<season, Map<rosterId, details>>
                const tempAllLeagueUsers = new Map(); // Map<season, Map<userId, details>>

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
                setAllTeams(tempAllTeams);
                setAllLeagueUsers(tempAllLeagueUsers);

                console.log("SleeperDataProvider: Populated team/user maps."); // NEW LOG

                // Calculate all-time and seasonal records
                const calculatedAllTimeRecords = calculateAllTimeRecords(
                    historicalData.matchupsBySeason,
                    historicalData.rostersBySeason,
                    historicalData.winnersBracketBySeason,
                    historicalData.losersBracketBySeason,
                    historicalData.leaguesMetadataBySeason,
                    historicalData.usersBySeason
                );

                const calculatedSeasonalMetrics = calculateSeasonalMetrics(
                    historicalData.matchupsBySeason,
                    historicalData.rostersBySeason,
                    historicalData.winnersBracketBySeason,
                    historicalData.losersBracketBySeason,
                    historicalData.leaguesMetadataBySeason,
                    historicalData.usersBySeason
                );

                setAllTimeRecords(calculatedAllTimeRecords);
                setProcessedSeasonalRecords(calculatedSeasonalMetrics);
                console.log("SleeperDataProvider: Records calculated and set."); // NEW LOG

            } catch (err) {
                console.error("SleeperDataProvider: Failed to fetch or process historical data:", err); // UPDATED LOG
                setError(err);
                // Clear any partially loaded data
                setAllTimeRecords([]);
                setProcessedSeasonalRecords({});
                setAllTeams(new Map());
                setAllLeagueUsers(new Map());
            } finally {
                setLoading(false);
                console.log("SleeperDataProvider: Data fetch process completed. Loading set to false."); // NEW LOG
            }
        };

        fetchData();
    }, []); // Empty dependency array means this runs once on mount

    const contextValue = useMemo(() => ({
        allTimeRecords,
        processedSeasonalRecords,
        getTeamName,
        getOwnerName,
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
