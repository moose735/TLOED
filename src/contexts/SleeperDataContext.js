// src/contexts/SleeperDataContext.js
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchAllHistoricalMatchups } from '../utils/sleeperApi'; // Corrected path from previous step
import { calculateAllLeagueMetrics } from '../utils/calculations'; // <--- CHANGE IS HERE

const SleeperData = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [allTimeRecords, setAllTimeRecords] = useState([]);
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [allTeams, setAllTeams] = useState(new Map());
    const [allLeagueUsers, setAllLeagueUsers] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const allHistoricalDataRef = React.useRef(null);

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
            console.log("SleeperDataProvider: Starting data fetch...");
            try {
                const historicalData = await fetchAllHistoricalMatchups();
                allHistoricalDataRef.current = historicalData;

                console.log("SleeperDataProvider: Raw historicalData fetched:", historicalData);

                if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
                    console.error("SleeperDataProvider: No valid matchupsBySeason found in historical data.");
                    throw new Error("No historical matchup data found.");
                }

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
                setAllTeams(tempAllTeams);
                setAllLeagueUsers(tempAllLeagueUsers);

                console.log("SleeperDataProvider: Populated team/user maps.");

                // <--- CHANGES START HERE
                const { seasonalMetrics, careerDPRData } = calculateAllLeagueMetrics(
                    historicalData,
                    getTeamName // Pass the getTeamName function as required by calculateAllLeagueMetrics
                );

                setAllTimeRecords(careerDPRData); // Set careerDPRData to allTimeRecords
                setProcessedSeasonalRecords(seasonalMetrics); // Set seasonalMetrics to processedSeasonalRecords
                // <--- CHANGES END HERE

                console.log("SleeperDataProvider: Records calculated and set.");

            } catch (err) {
                console.error("SleeperDataProvider: Failed to fetch or process historical data:", err);
                setError(err);
                setAllTimeRecords([]);
                setProcessedSeasonalRecords({});
                setAllTeams(new Map());
                setAllLeagueUsers(new Map());
            } finally {
                setLoading(false);
                console.log("SleeperDataProvider: Data fetch process completed. Loading set to false.");
            }
        };

        fetchData();
    }, [getTeamName]); // <--- IMPORTANT: Add getTeamName to dependencies because it's used inside useEffect
                       //     (even though it's memoized, its dependencies might change or it might be recreated)


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
