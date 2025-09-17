// src/contexts/SleeperDataContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import logger from '../utils/logger';
import { getLeagueData, getMatchupsForAllWeeks, getRosters, getUsers, getDraftPicks, getLeagueMetadata, getWinnersBracket, getLosersBracket } from '../api/sleeperApi';
import { calculateAllLeagueMetrics } from '../utils/calculations';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, addDoc, getDocs } from 'firebase/firestore';

// Global variables for Firebase config and app ID (provided by the environment)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase (only once)
let app;
let db;
let auth;

    try {
    if (Object.keys(firebaseConfig).length > 0) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } else {
        logger.warn("Firebase config not found. Firestore features will be disabled.");
    }
} catch (e) {
    logger.error("Failed to initialize Firebase:", e);
    db = null; // Ensure db is null if initialization fails
    auth = null; // Ensure auth is null if initialization fails
}


const SleeperDataContext = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [historicalData, setHistoricalData] = useState(null);
    const [allDraftHistory, setAllDraftHistory] = useState(null);
    const [usersData, setUsersData] = useState(null);
    const [nflState, setNflState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(null); // State to store the user ID
    const [yahooHistoricalData, setYahooHistoricalData] = useState({}); // New state for Yahoo data

    // Ref to prevent multiple data fetches on initial render
    const isInitialLoad = useRef(true);

    // Memoize getTeamName to prevent unnecessary re-renders
    const getTeamName = useCallback((ownerId, year = null) => {
        if (!usersData || !historicalData || !historicalData.rostersBySeason) return `Unknown Team (ID: ${ownerId})`;

        // Try to find the team name for a specific year first
        if (year && historicalData.rostersBySeason[year]) {
            const roster = historicalData.rostersBySeason[year].find(r => r.owner_id === ownerId);
            if (roster && roster.metadata && roster.metadata.team_name) {
                return roster.metadata.team_name;
            }
        }

        // Fallback: Find the user's display name from usersData
        const user = usersData.find(u => u.user_id === ownerId);
        if (user && user.display_name) {
            return user.display_name;
        }

        // Fallback: If no display name, use the owner_id
        return `Unknown Team (ID: ${ownerId})`;
    }, [usersData, historicalData]);


    // Authentication and initial data loading
    useEffect(() => {
        const loadAllSleeperData = async (currentUser) => {
            if (!currentUser) {
                setError(new Error("Authentication failed. No user available."));
                setLoading(false);
                return;
            }

            setUserId(currentUser.uid); // Set the user ID from Firebase Auth

            try {
                // Fetch basic league data (including league ID)
                const leagueData = await getLeagueData();
                const leagueId = leagueData[0]?.league_id; // Assuming the first league is the target

                if (!leagueId) {
                    throw new Error("No league ID found. Please check your Sleeper API configuration.");
                }

                // Fetch NFL state to determine current season and week
                const nflStateResponse = await fetch('https://api.sleeper.app/v1/state/nfl');
                const currentNflState = await nflStateResponse.json();
                setNflState(currentNflState);

                const currentSeason = parseInt(currentNflState.season);
                const latestWeek = currentNflState.week;

                // Determine all years to fetch data for (from earliest league year to current NFL season)
                const earliestLeagueYear = leagueData[0]?.season; // Assuming leagueData is sorted or first entry is oldest
                const yearsToFetch = [];
                for (let y = parseInt(earliestLeagueYear); y <= currentSeason; y++) {
                    yearsToFetch.push(y);
                }

                const fetchedHistoricalData = {
                    matchupsBySeason: {},
                    rostersBySeason: {},
                    usersBySeason: {},
                    leaguesMetadataBySeason: {},
                    winnersBracketBySeason: {},
                    losersBracketBySeason: {},
                };
                let fetchedAllDraftHistory = [];
                let fetchedUsersData = []; // To store all users across all seasons

                for (const year of yearsToFetch) {
                    // Fetch league metadata for the current year
                    const metadata = await getLeagueMetadata(leagueId, year);
                    fetchedHistoricalData.leaguesMetadataBySeason[year] = metadata;

                    // Fetch users for the current year's league
                    const users = await getUsers(leagueId, year);
                    fetchedHistoricalData.usersBySeason[year] = users;
                    fetchedUsersData.push(...users); // Aggregate all users

                    // Fetch rosters for the current year's league
                    const rosters = await getRosters(leagueId, year);
                    fetchedHistoricalData.rostersBySeason[year] = rosters;

                    // Fetch matchups for all weeks of the current year's league
                    // Only fetch up to the latest week if it's the current season, otherwise fetch all 17 weeks
                    const maxWeek = (year === currentSeason) ? latestWeek : 17; // Assuming 17 weeks for past seasons
                    const matchups = await getMatchupsForAllWeeks(leagueId, year, maxWeek);
                    fetchedHistoricalData.matchupsBySeason[year] = matchups;

                    // Fetch playoff bracket data
                    const winnersBracket = await getWinnersBracket(leagueId, year);
                    const losersBracket = await getLosersBracket(leagueId, year);
                    fetchedHistoricalData.winnersBracketBySeason[year] = winnersBracket;
                    fetchedHistoricalData.losersBracketBySeason[year] = losersBracket;

                    // Fetch draft picks for the current year
                    const draftPicks = await getDraftPicks(leagueId, year);
                    fetchedAllDraftHistory.push(...draftPicks);
                }

                // Deduplicate usersData
                const uniqueUsersMap = new Map();
                fetchedUsersData.forEach(user => uniqueUsersMap.set(user.user_id, user));
                setUsersData(Array.from(uniqueUsersMap.values()));

                setAllDraftHistory(fetchedAllDraftHistory);

                // --- Load Yahoo Historical Data from Firestore ---
                let loadedYahooData = {};
                if (db && currentUser.uid) {
                    const yahooDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/yahoo_data/custom_data`);
                    const docSnap = await getDoc(yahooDocRef);
                    if (docSnap.exists()) {
                            loadedYahooData = docSnap.data().data || {};
                            logger.info("SleeperDataContext: Loaded Yahoo data from Firestore:", loadedYahooData);
                        }
                }
                setYahooHistoricalData(loadedYahooData); // Set this state so it can be merged below

                // --- Merge Yahoo data with fetched Sleeper data ---
                // This ensures Yahoo data overrides Sleeper data for overlapping years
                const mergedHistoricalData = { ...fetchedHistoricalData };
                Object.keys(loadedYahooData).forEach(year => {
                    // Each year in loadedYahooData should contain objects like matchupsBySeason, rostersBySeason etc.
                    // This assumes loadedYahooData is structured as { "2021": { "matchupsBySeason": {...}, "rostersBySeason": {...} } }
                    // We need to merge the *contents* of each category for that year.
                    const yahooYearData = loadedYahooData[year];
                    if (yahooYearData) {
                        Object.keys(yahooYearData).forEach(category => {
                            if (mergedHistoricalData[category]) {
                                // If the category exists (e.g., matchupsBySeason), merge/overwrite the specific year
                                mergedHistoricalData[category][year] = yahooYearData[category];
                            } else {
                                // If it's a new category, add it
                                mergedHistoricalData[category] = { [year]: yahooYearData[category] };
                            }
                        });
                    }
                });

                setHistoricalData(mergedHistoricalData); // Set the final merged data

                } catch (err) {
                logger.error("Failed to load initial Sleeper data:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        // Firebase Authentication Listener
        if (auth && db) {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                        // User is signed in
                        logger.info("Firebase: User signed in:", user.uid);
                        if (isInitialLoad.current) {
                            await loadAllSleeperData(user);
                            isInitialLoad.current = false;
                        }
                    } else {
                        // User is signed out, attempt anonymous sign-in
                        logger.info("Firebase: No user signed in. Attempting anonymous sign-in.");
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (signInError) {
                        logger.error("Firebase: Anonymous sign-in failed:", signInError);
                        setError(new Error("Failed to authenticate with Firebase."));
                        setLoading(false);
                    }
                }
            });
            return () => unsubscribe(); // Cleanup auth listener on component unmount
        } else {
            // If Firebase is not initialized, proceed without authentication and data loading
            setLoading(false);
            setError(new Error("Firebase is not initialized. Data loading skipped."));
        }
    }, []); // Empty dependency array means this effect runs once on mount

    // Effect to save yahooHistoricalData to Firestore whenever it changes
    useEffect(() => {
        const saveYahooDataToFirestore = async () => {
            if (db && userId && Object.keys(yahooHistoricalData).length > 0) {
                try {
                    const yahooDocRef = doc(db, `artifacts/${appId}/users/${userId}/yahoo_data/custom_data`);
                    await setDoc(yahooDocRef, { data: yahooHistoricalData }, { merge: false }); // Overwrite existing
                    logger.info("SleeperDataContext: Yahoo data saved to Firestore successfully.");
                } catch (e) {
                    logger.error("SleeperDataContext: Failed to save Yahoo data to Firestore:", e);
                }
            }
        };

        // Only save if it's not the initial load and data actually exists
        if (!isInitialLoad.current && yahooHistoricalData && Object.keys(yahooHistoricalData).length > 0) {
            saveYahooDataToFirestore();
        }
    }, [yahooHistoricalData, userId]); // Depend on yahooHistoricalData and userId

    // Re-calculate all league metrics whenever historicalData, allDraftHistory, or nflState changes
    // This useEffect ensures that the calculated metrics are always up-to-date
    // and available to components consuming this context.
    const calculatedMetrics = useMemo(() => {
        if (historicalData && allDraftHistory && usersData && nflState && typeof getTeamName === 'function') {
            logger.debug("SleeperDataContext: Recalculating all league metrics...");
            return calculateAllLeagueMetrics(historicalData, allDraftHistory, getTeamName, nflState);
        }
        return { seasonalMetrics: {}, careerDPRData: [] };
    }, [historicalData, allDraftHistory, usersData, nflState, getTeamName]);


    return (
        <SleeperDataContext.Provider value={{
            loading,
            error,
            historicalData,
            allDraftHistory,
            usersData,
            nflState,
            getTeamName,
            setYahooHistoricalData, // Provide the setter for Yahoo data
            ...calculatedMetrics // Spread the calculated metrics
        }}>
            {children}
        </SleeperDataContext.Provider>
    );
};

export const useSleeperData = () => useContext(SleeperDataContext);
