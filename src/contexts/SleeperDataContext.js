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

const SleeperDataContext = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [rostersWithDetails, setRostersWithDetails] = useState(null);
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    // FIX: Initialize historicalMatchups to an empty object instead of null
    const [historicalMatchups, setHistoricalMatchups] = useState({});
    const [allDraftHistory, setAllDraftHistory] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const getTeamName = useMemo(() => {
        const allUserMap = new Map();
        // Safely access properties on historicalMatchups, which is now guaranteed to be an object
        if (historicalMatchups?.usersBySeason) {
            Object.values(historicalMatchups.usersBySeason).forEach(seasonUsers => {
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        allUserMap.set(user.user_id, user);
                    });
                }
            });
        }
        if (usersData) {
            usersData.forEach(user => {
                allUserMap.set(user.user_id, user);
            });
        }

        const allRosterToOwnerMap = new Map();
        // Safely access properties on historicalMatchups, which is now guaranteed to be an object
        if (historicalMatchups?.rostersBySeason) {
            Object.values(historicalMatchups.rostersBySeason).forEach(seasonRosters => {
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        allRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
                    });
                }
            });
        }
        if (rostersWithDetails) {
            rostersWithDetails.forEach(roster => {
                allRosterToOwnerMap.set(roster.roster_id, roster.owner_id);
            });
        }

        return (id) => {
            const user = allUserMap.get(id);
            if (user) {
                return user.metadata?.team_name || user.display_name || `User ${id}`;
            }
            const ownerId = allRosterToOwnerMap.get(id);
            if (ownerId) {
                const ownerUser = allUserMap.get(ownerId);
                if (ownerUser) {
                    return ownerUser.metadata?.team_name || ownerUser.display_name || `Roster Owner ${ownerId}`;
                }
            }
            return `Unknown Team (ID: ${id})`;
        };
    }, [usersData, rostersWithDetails, historicalMatchups]); // historicalMatchups is a dependency

    useEffect(() => {
        const loadAllSleeperData = async () => {
            console.log("[SleeperDataContext] Starting data load...");
            setLoading(true);
            setError(null);
            try {
                console.log(`[SleeperDataContext] Attempting to fetch data for CURRENT_LEAGUE_ID: ${CURRENT_LEAGUE_ID}`);
                const [
                    leagues,
                    users,
                    rosters,
                    players,
                    state,
                    fetchedHistoricalData,
                    draftHistory
                ] = await Promise.all([
                    fetchLeagueData(CURRENT_LEAGUE_ID),
                    fetchUsersData(CURRENT_LEAGUE_ID),
                    fetchRostersWithDetails(CURRENT_LEAGUE_ID),
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(CURRENT_LEAGUE_ID),
                    fetchAllDraftHistory(),
                ]);

                console.log("[SleeperDataContext] Raw data fetched successfully.");
                console.log("[SleeperDataContext] fetchedHistoricalData structure:", fetchedHistoricalData);
                console.log("[SleeperDataContext] fetchedHistoricalData.matchupsBySeason keys:", Object.keys(fetchedHistoricalData.matchupsBySeason || {}));

                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters);
                setNflPlayers(players);
                setNflState(state);
                setHistoricalMatchups(fetchedHistoricalData); // Set the comprehensive data here

                setAllDraftHistory(draftHistory);

                setLoading(false);
                console.log("[SleeperDataContext] Data loading complete. historicalMatchups state updated.");
            } catch (err) {
                console.error("[SleeperDataContext] Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, [getTeamName]); // getTeamName is a dependency because it's used in the memoized getTeamName function

    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups, // This is the state variable passed to context
        allDraftHistory,
        loading,
        error,
        getTeamName,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups, // Dependency for the context value
        allDraftHistory,
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

export const useSleeperData = () => {
    const context = useContext(SleeperDataContext);
    if (context === undefined) {
        throw new Error('useSleeperData must be used within a SleeperDataProvider');
    }
    return context;
};
