import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback
} from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRosterData,
    fetchNFLPlayers,
    fetchNFLState,
    fetchAllHistoricalMatchups,
    fetchAllDraftHistory,
} from '../utils/sleeperApi';
import {
    calculateAllLeagueMetrics
} from '../utils/statCalculations';
import {
    CURRENT_LEAGUE_ID,
    FALLBACK_LEAGUE_ID,
    HARDCODED_YAHOO_DATA as hardcodedYahooData
} from '../config';

// 1. Create the Context
const SleeperDataContext = createContext(undefined);

// 2. Create the Provider Component
export const SleeperDataProvider = ({
    children
}) => {
    const [leagueData, setLeagueData] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [rostersWithDetails, setRostersWithDetails] = useState(null);
    const [nflPlayers, setNflPlayers] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [historicalMatchups, setHistoricalMatchups] = useState(null);
    const [processedSeasonalRecords, setProcessedSeasonalRecords] = useState({});
    const [careerDPRData, setCareerDPRData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [draftsBySeason, setDraftsBySeason] = useState({});
    const [draftPicksBySeason, setDraftPicksBySeason] = useState({});


    // Memoize maps for quick lookups
    const {
        currentLeagueUserMap,
        yearSpecificUserMap,
        yearSpecificRosterMap
    } = useMemo(() => {
        const currentUserMap = new Map();
        if (usersData) {
            usersData.forEach(user => {
                currentUserMap.set(user.user_id, user);
            });
        }

        const yearUserMap = new Map();
        const yearRosterMap = new Map();

        const allHistoricalUsers = {
            ...(historicalMatchups?.usersBySeason || {}),
            "2021": hardcodedYahooData["2021"]?.usersBySeason || []
        };
        const allHistoricalRosters = {
            ...(historicalMatchups?.rostersBySeason || {}),
            "2021": hardcodedYahooData["2021"]?.rostersBySeason || []
        };

        if (allHistoricalUsers) {
            Object.entries(allHistoricalUsers).forEach(([year, seasonUsers]) => {
                const userMapForYear = new Map();
                if (Array.isArray(seasonUsers)) {
                    seasonUsers.forEach(user => {
                        userMapForYear.set(user.user_id, user);
                    });
                }
                yearUserMap.set(year, userMapForYear);
            });
        }

        if (allHistoricalRosters) {
            Object.entries(allHistoricalRosters).forEach(([year, seasonRosters]) => {
                const rosterMapForYear = new Map();
                if (Array.isArray(seasonRosters)) {
                    seasonRosters.forEach(roster => {
                        rosterMapForYear.set(roster.roster_id, roster);
                    });
                }
                yearRosterMap.set(year, rosterMapForYear);
            });
        }

        return {
            currentLeagueUserMap: currentUserMap,
            yearSpecificUserMap: yearUserMap,
            yearSpecificRosterMap: yearRosterMap,
        };
    }, [usersData, historicalMatchups]);


    // 3. Memoized function for getting team names
    const getTeamName = useMemo(() => {
        return (ownerId, year = null) => {
            const getNameFromUser = (user) => {
                if (user?.metadata?.team_name) {
                    return user.metadata.team_name;
                }
                if (user?.display_name) {
                    return user.display_name;
                }
                return null;
            };

            let resolvedName = `Unknown Team (ID: ${ownerId})`;

            // --- START: ADDED DEBUG LOGS ---
            console.log(`[getTeamName] Called for ownerId: ${ownerId}, year: ${year}`);
            console.log('[getTeamName] Current League User Map size:', currentLeagueUserMap.size);
            console.log('[getTeamName] Year Specific User Map keys:', Array.from(yearSpecificUserMap.keys()));
            // --- END: ADDED DEBUG LOGS ---


            // If year is null, we want the MOST CURRENT team name
            if (year === null) {
                // 1. Try to get name from current league's usersData first (most current)
                const currentUser = currentLeagueUserMap.get(ownerId);
                // --- START: ADDED DEBUG LOG ---
                console.log(`[getTeamName] Current user for ${ownerId}:`, currentUser);
                // --- END: ADDED DEBUG LOG ---
                const currentName = getNameFromUser(currentUser);
                if (currentName) {
                    resolvedName = currentName;
                } else {
                    // 2. If not found in current data, search historical data from most recent year backwards
                    const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                    for (const historicalYear of sortedYearsDesc) {
                        const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                        if (userMapInHistoricalYear instanceof Map) {
                            const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                            const historicalName = getNameFromUser(userInHistoricalYear);
                            if (historicalName) {
                                resolvedName = historicalName;
                                break;
                            }
                        }
                    }
                }

                // 3. Fallback to careerDPRData's teamName if available and not generic
                if (resolvedName.startsWith('Unknown Team (ID:')) {
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                    }
                }
            } else {
                // If a specific year is provided, prioritize that year's name
                if (yearSpecificUserMap.has(String(year))) {
                    const userMapForYear = yearSpecificUserMap.get(String(year));
                    if (userMapForYear instanceof Map) {
                        const userInSpecificYear = userMapForYear.get(ownerId);
                        // --- START: ADDED DEBUG LOG ---
                        console.log(`[getTeamName] User for ${ownerId} in year ${year}:`, userInSpecificYear);
                        // --- END: ADDED DEBUG LOG ---
                        const specificYearName = getNameFromUser(userInSpecificYear);
                        if (specificYearName) {
                            resolvedName = specificYearName;
                        }
                    }
                }

                // Fallback for historical lookups if specific year data is missing in that year,
                // try to get a name from ANY historical year (most recent first)
                if (resolvedName.startsWith('Unknown Team (ID:')) {
                    const sortedYearsDesc = Array.from(yearSpecificUserMap.keys()).sort((a, b) => parseInt(b) - parseInt(a));
                    for (const historicalYear of sortedYearsDesc) {
                        const userMapInHistoricalYear = yearSpecificUserMap.get(historicalYear);
                        if (userMapInHistoricalYear instanceof Map) {
                            const userInHistoricalYear = userMapInHistoricalYear.get(ownerId);
                            const historicalName = getNameFromUser(userInHistoricalYear);
                            if (historicalName) {
                                resolvedName = historicalName;
                                break;
                            }
                        }
                    }
                }

                // Fallback to current league data if no historical name is found
                if (resolvedName.startsWith('Unknown Team (ID:')) {
                    const currentUser = currentLeagueUserMap.get(ownerId);
                    const currentName = getNameFromUser(currentUser);
                    if (currentName) {
                        resolvedName = currentName;
                    }
                }

                // Fallback to careerDPRData if historical year-specific or current names not found
                if (resolvedName.startsWith('Unknown Team (ID:')) {
                    const careerTeam = careerDPRData?.find(team => team.ownerId === ownerId);
                    if (careerTeam && careerTeam.teamName && !careerTeam.teamName.startsWith('Unknown Team (ID:')) {
                        resolvedName = careerTeam.teamName;
                    }
                }
            }
            // --- START: ADDED DEBUG LOG ---
            console.log(`[getTeamName] Final resolved name for ${ownerId} (Year: ${year}): ${resolvedName}`);
            // --- END: ADDED DEBUG LOG ---

            return resolvedName;
        };
    }, [usersData, historicalMatchups, careerDPRData]);


    useEffect(() => {
        const loadAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                const leagueIdToFetch = CURRENT_LEAGUE_ID || FALLBACK_LEAGUE_ID;

                if (!leagueIdToFetch) {
                    setError(new Error("No league ID provided or fallback ID is invalid. Please set CURRENT_LEAGUE_ID in config.js or ensure FALLBACK_LEAGUE_ID is valid."));
                    setLoading(false);
                    return;
                }

                if (!CURRENT_LEAGUE_ID) {
                    console.warn(`SleeperDataContext: CURRENT_LEAGUE_ID is undefined in config.js. Using fallback ID: ${FALLBACK_LEAGUE_ID}`);
                }

                const [
                    leagues,
                    users,
                    rosters,
                    players,
                    state,
                    historicalDataFromSleeperAPI,
                    allHistoricalDraftsRaw,
                ] = await Promise.all([
                    fetchLeagueData(leagueIdToFetch),
                    fetchUsersData(leagueIdToFetch),
                    fetchRosterData(leagueIdToFetch),
                    fetchNFLPlayers(),
                    fetchNFLState(),
                    fetchAllHistoricalMatchups(),
                    fetchAllDraftHistory(),
                ]);

                if (!leagues) {
                    setError(new Error(`Failed to fetch initial league data for ID: ${leagueIdToFetch}. Please check the league ID in config.js or the fallback ID.`));
                    setLoading(false);
                    return;
                }

                setLeagueData(leagues);
                setUsersData(users);
                setRostersWithDetails(rosters);
                setNflPlayers(players);
                setNflState(state);

                const processedDraftsBySeason = {};
                const processedDraftPicksBySeason = {};

                if (allHistoricalDraftsRaw) {
                    for (const season in allHistoricalDraftsRaw) {
                        if (allHistoricalDraftsRaw.hasOwnProperty(season)) {
                            const seasonData = allHistoricalDraftsRaw[season];
                            const mainDraft = seasonData.drafts?.find(d => d.status === 'complete') || seasonData.drafts?.[0];

                            if (mainDraft) {
                                processedDraftsBySeason[season] = mainDraft;
                                processedDraftPicksBySeason[season] = mainDraft.picks || [];
                            }
                        }
                    }
                }
                setDraftsBySeason(processedDraftsBySeason);
                setDraftPicksBySeason(processedDraftPicksBySeason);


                const flattenedSleeperMatchupsBySeason = {};
                if (historicalDataFromSleeperAPI?.matchupsBySeason) {
                    Object.entries(historicalDataFromSleeperAPI.matchupsBySeason).forEach(([year, weeklyMatchupsObject]) => {
                        if (typeof weeklyMatchupsObject === 'object' && weeklyMatchupsObject !== null && !Array.isArray(weeklyMatchupsObject)) {
                            flattenedSleeperMatchupsBySeason[year] = Object.values(weeklyMatchupsObject).flat();
                        } else if (Array.isArray(weeklyMatchupsObject)) {
                            flattenedSleeperMatchupsBySeason[year] = weeklyMatchupsObject;
                        } else {
                            flattenedSleeperMatchupsBySeason[year] = [];
                        }
                    });
                }


                const mergedHistoricalData = {
                    matchupsBySeason: { ...(flattenedSleeperMatchupsBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.matchupsBySeason || []
                    },
                    rostersBySeason: { ...(historicalDataFromSleeperAPI?.rostersBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.rostersBySeason || []
                    },
                    usersBySeason: { ...(historicalDataFromSleeperAPI?.usersBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.usersBySeason || []
                    },
                    leaguesMetadataBySeason: { ...(historicalDataFromSleeperAPI?.leaguesMetadataBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.leaguesMetadataBySeason || {}
                    },
                    winnersBracketBySeason: { ...(historicalDataFromSleeperAPI?.winnersBracketBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.winnersBracketBySeason || []
                    },
                    losersBracketBySeason: { ...(historicalDataFromSleeperAPI?.losersBracketBySeason || {}),
                        "2021": hardcodedYahooData["2021"]?.losersBracketBySeason || []
                    },
                    draftsBySeason: processedDraftsBySeason,
                    draftPicksBySeason: processedDraftPicksBySeason,
                };
                setHistoricalMatchups(mergedHistoricalData);


                if (mergedHistoricalData && Object.keys(mergedHistoricalData.matchupsBySeason).length > 0) {
                    const {
                        seasonalMetrics,
                        careerDPRData: calculatedCareerDPRData
                    } = calculateAllLeagueMetrics(
                        mergedHistoricalData, {
                            draftsBySeason: processedDraftsBySeason,
                            draftPicksBySeason: processedDraftPicksBySeason
                        },
                        getTeamName,
                        state
                    );
                    setProcessedSeasonalRecords(seasonalMetrics);
                    setCareerDPRData(calculatedCareerDPRData);
                } else {
                    setProcessedSeasonalRecords({});
                    setCareerDPRData(null);
                }

                setLoading(false);

                // --- START: ADDED DEBUG LOGS ---
                console.log('SleeperDataContext: Final nflPlayers state:', players);
                console.log('SleeperDataContext: Final draftsBySeason state:', processedDraftsBySeason);
                console.log('SleeperDataContext: Final draftPicksBySeason state:', processedDraftPicksBySeason);
                console.log('SleeperDataContext: Final historicalMatchups (merged historicalData) state:', mergedHistoricalData);
                // --- END: ADDED DEBUG LOGS ---

            } catch (err) {
                console.error("Failed to load initial Sleeper data:", err);
                setError(err);
                setLoading(false);
            }
        };

        loadAllSleeperData();
    }, []);

    const contextValue = useMemo(() => ({
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalData: historicalMatchups,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
    }), [
        leagueData,
        usersData,
        rostersWithDetails,
        nflPlayers,
        nflState,
        historicalMatchups,
        processedSeasonalRecords,
        careerDPRData,
        loading,
        error,
        getTeamName,
    ]);

    return ( <
        SleeperDataContext.Provider value = {
            contextValue
        } > {
            children
        } <
        /SleeperDataContext.Provider>
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
