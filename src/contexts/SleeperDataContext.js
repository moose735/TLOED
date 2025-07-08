// src/contexts/SleeperDataContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchLeagueData,
    fetchUsersData,
    fetchRostersWithDetails,
    fetchMatchupsForSeason,
    fetchPlayoffBracket,
    fetchNFLPlayers,
    fetchDrafts,
} from '../utils/sleeperApi';
import { CURRENT_LEAGUE_ID } from '../config'; // Removed START_YEAR from import

const SleeperDataContext = createContext();

export const SleeperDataProvider = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [leagueData, setLeagueData] = useState(null); // Current league data
    const [usersData, setUsersData] = useState(null); // All users in the league's history
    const [nflPlayers, setNflPlayers] = useState(null); // NFL player data
    const [allDraftHistory, setAllDraftHistory] = useState(null); // All draft history

    // Historical data, keyed by season (year)
    const [historicalData, setHistoricalData] = useState({
        matchupsBySeason: {},
        rostersBySeason: {},
        leaguesMetadataBySeason: {}, // Stores league_id, settings, etc. for each historical year
        winnersBracketBySeason: {},
        losersBracketBySeason: {},
    });

    // Ref to store ownerId to display name mapping
    const ownerIdToDisplayNameMapRef = useRef({});

    // Function to get team name, now more robust for historical data
    const getTeamName = useCallback((ownerId, season = null) => {
        if (!usersData || !historicalData.rostersBySeason) return 'Loading Team...';

        // Try to find the user's display name
        const user = usersData.find(u => u.user_id === ownerId);
        let displayName = user ? (user.metadata?.team_name || user.display_name) : `Unknown Team (ID: ${ownerId})`;

        // If a specific season is provided, try to get the team name from that season's roster metadata
        // This ensures historical team names are used if available in roster metadata
        if (season && historicalData.rostersBySeason[season]) {
            const rosterForSeason = historicalData.rostersBySeason[season].find(r => r.owner_id === ownerId);
            if (rosterForSeason && rosterForSeason.metadata?.team_name) {
                displayName = rosterForSeason.metadata.team_name;
            }
        }

        // Store in ref for consistent lookup
        ownerIdToDisplayNameMapRef.current[ownerId] = displayName;
        return displayName;
    }, [usersData, historicalData.rostersBySeason]); // Dependency on historicalData.rostersBySeason

    useEffect(() => {
        const fetchAllSleeperData = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Fetch current league data
                const currentLeague = await fetchLeagueData(CURRENT_LEAGUE_ID);
                setLeagueData(currentLeague);

                // 2. Fetch all users from the current league (users are generally consistent across seasons)
                const users = await fetchUsersData(CURRENT_LEAGUE_ID);
                setUsersData(users);

                // 3. Fetch NFL players data
                const players = await fetchNFLPlayers();
                setNflPlayers(players);

                // 4. Build historical league chain (crucial for getting correct historical league IDs)
                const leagueChain = {}; // Stores { year: league_object }
                let currentLeagueObj = currentLeague;
                // Define START_YEAR here or ensure it's globally available if not imported
                const startYearNum = parseInt(process.env.REACT_APP_START_YEAR || '2019'); // Fallback to '2019' if not set

                // Traverse back through previous_league_id to get all historical league objects
                while (currentLeagueObj && currentLeagueObj.season >= startYearNum) {
                    leagueChain[currentLeagueObj.season] = currentLeagueObj;
                    if (currentLeagueObj.previous_league_id) {
                        currentLeagueObj = await fetchLeagueData(currentLeagueObj.previous_league_id);
                    } else {
                        break; // No more previous leagues
                    }
                }

                // Prepare new historical data structure
                const newHistoricalData = {
                    matchupsBySeason: {},
                    rostersBySeason: {},
                    leaguesMetadataBySeason: {},
                    winnersBracketBySeason: {},
                    losersBracketBySeason: {},
                };

                // Get all years from the league chain, sort them for processing
                const yearsToFetch = Object.keys(leagueChain).map(Number).sort((a, b) => a - b);

                // 5. Fetch historical data for each year using the correct league ID for that year
                for (const year of yearsToFetch) {
                    const leagueForThisYear = leagueChain[year];

                    if (!leagueForThisYear) {
                        console.warn(`Could not find league data for year ${year} in the historical chain. Skipping this season.`);
                        continue;
                    }

                    const historicalLeagueId = leagueForThisYear.league_id;
                    newHistoricalData.leaguesMetadataBySeason[year] = leagueForThisYear;

                    console.log(`Fetching data for season: ${year} (League ID: ${historicalLeagueId})`);

                    // Fetch rosters for this specific historical league ID
                    const rosters = await fetchRostersWithDetails(historicalLeagueId);
                    newHistoricalData.rostersBySeason[year] = rosters;

                    // Fetch matchups for this specific historical league ID
                    const matchups = await fetchMatchupsForSeason(historicalLeagueId, year, leagueForThisYear.settings?.playoff_start_week);
                    newHistoricalData.matchupsBySeason[year] = matchups;

                    // Fetch playoff brackets for this specific historical league ID
                    const winnersBracket = await fetchPlayoffBracket(historicalLeagueId, 'winner');
                    const losersBracket = await fetchPlayoffBracket(historicalLeagueId, 'loser');
                    newHistoricalData.winnersBracketBySeason[year] = winnersBracket;
                    newHistoricalData.losersBracketBySeason[year] = losersBracket;
                }

                // 6. Fetch draft history (can use the current league ID, as drafts are usually linked to the league)
                const drafts = await fetchDrafts(CURRENT_LEAGUE_ID);
                setAllDraftHistory(drafts);

                setHistoricalData(newHistoricalData);
                setLoading(false);

            } catch (err) {
                console.error("Error in fetchAllSleeperData:", err);
                setError(err.message || "An unknown error occurred while fetching Sleeper data.");
                setLoading(false);
            }
        };

        fetchAllSleeperData();
    }, []); // Empty dependency array means this runs once on mount

    const contextValue = {
        loading,
        error,
        leagueData,
        usersData,
        nflPlayers,
        allDraftHistory,
        historicalData,
        getTeamName,
        rostersBySeason: historicalData.rostersBySeason, // Expose rostersBySeason directly from historicalData
    };

    return (
        <SleeperDataContext.Provider value={contextValue}>
            {children}
        </SleeperDataContext.Provider>
    );
};

export const useSleeperData = () => useContext(SleeperDataContext);
