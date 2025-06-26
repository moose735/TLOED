// src/components/Seasons.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CURRENT_LEAGUE_ID,
  fetchLeagueData,
  fetchUsersData,
  fetchRostersWithDetails,
  fetchAllHistoricalMatchups, // This fetches Sleeper matchup data
  fetchAllDraftHistory,
  fetchNFLPlayers,
  fetchTransactionsForWeek, // Need this to fetch transactions per week for a given season
} from '../utils/sleeperApi';

// Import sub-components
import SeasonOverview from './SeasonOverview';
import SeasonMatchups from './SeasonMatchups';
import SeasonDraft from './SeasonDraft';
import SeasonTransactions from './SeasonTransactions';

const SEASONS_SUB_TABS = {
  OVERVIEW: 'overview',
  MATCHUPS: 'matchups',
  DRAFT: 'draft',
  TRANSACTIONS: 'transactions',
};

const Seasons = ({ getDisplayTeamName }) => {
  // State for available seasons (fetched initially)
  const [availableSeasonsData, setAvailableSeasonsData] = useState([]); // Array of { season: 'YYYY', league_id: '...' }

  // State for data of the CURRENTLY SELECTED season
  const [currentSeasonDetails, setCurrentSeasonDetails] = useState(null); // Full league object for selected season
  const [currentSeasonUsers, setCurrentSeasonUsers] = useState({}); // Map of userId to user details for selected league
  const [currentSeasonRosters, setCurrentSeasonRosters] = useState([]); // Array of roster data for selected league
  const [currentSeasonSleeperMatchups, setCurrentSeasonSleeperMatchups] = useState({}); // Object of week -> matchups for selected season
  const [currentSeasonDraftHistory, setCurrentSeasonDraftHistory] = useState({}); // Object of draftId -> {details, picks, tradedPicks} for selected season
  const [currentSeasonNflPlayers, setCurrentSeasonNflPlayers] = useState({}); // Map of playerId to player details (global, but fetched once)
  const [currentSeasonTransactions, setCurrentSeasonTransactions] = useState({}); // Object of week -> transactions for selected league

  const [selectedSeason, setSelectedSeason] = useState(null); // The season string currently being viewed
  const [activeSubTab, setActiveSubTab] = useState(SEASONS_SUB_TABS.OVERVIEW);

  const [loadingInitial, setLoadingInitial] = useState(true); // Loading state for initial season list
  const [loadingSeasonData, setLoadingSeasonData] = useState(false); // Loading state for specific season's data
  const [error, setError] = useState(null);


  // Memoized helper to get a user's display name from their ID, considering users for the *current* season
  const getUserDisplayName = useCallback((userId) => {
    const user = currentSeasonUsers[userId];
    return user ? getDisplayTeamName(user.teamName || user.displayName) : 'Unknown User';
  }, [currentSeasonUsers, getDisplayTeamName]);

  // Memoized helper to get a player's name from their ID (NFL players are fetched once globally)
  const getPlayerName = useCallback((playerId) => {
    const player = currentSeasonNflPlayers[playerId];
    return player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : `Unknown Player (${playerId})`;
  }, [currentSeasonNflPlayers]);


  // Effect 1: Fetch initial list of available seasons, excluding the current season
  useEffect(() => {
    const loadAvailableSeasons = async () => {
      setLoadingInitial(true);
      setError(null);
      try {
        const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
        // Find the current league's season
        const currentLeague = leagues.find(l => l.league_id === CURRENT_LEAGUE_ID);
        const currentSeason = currentLeague ? currentLeague.season : null;

        // Filter out the current season and map to simpler objects
        const historicalLeagues = leagues
          .filter(l => l.season !== currentSeason) // Exclude the current season
          .map(l => ({ season: l.season, league_id: l.league_id, settings: l.settings }));

        setAvailableSeasonsData(historicalLeagues.sort((a, b) => b.season - a.season)); // Sort descending

        // Do NOT set initial selected season if the current season is excluded
        // The dropdown will default to "Select a Season"
      } catch (err) {
        console.error('Error loading available seasons:', err);
        setError(`Failed to load available seasons: ${err.message}.`);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadAvailableSeasons();
  }, []); // Runs only once on mount to get the list of all historical leagues

  // Effect 2: Fetch detailed data when a season is selected
  useEffect(() => {
    const loadSelectedSeasonData = async () => {
      if (!selectedSeason) {
        console.log("No season selected, clearing current season data."); // NEW LOG
        // Clear previous season's data if no season is selected
        setCurrentSeasonDetails(null);
        setCurrentSeasonUsers({});
        setCurrentSeasonRosters([]);
        setCurrentSeasonSleeperMatchups({});
        setCurrentSeasonDraftHistory({});
        setCurrentSeasonTransactions({});
        return;
      }

      setLoadingSeasonData(true);
      setError(null);
      console.log(`Attempting to load data for selected season: ${selectedSeason}`); // NEW LOG

      // Find the leagueId for the selected season
      const leagueForSelectedSeason = availableSeasonsData.find(l => l.season === selectedSeason);
      if (!leagueForSelectedSeason) {
        console.error(`League details not found for season ${selectedSeason} in availableSeasonsData.`); // NEW LOG
        setError(`League details not found for season ${selectedSeason}.`);
        setLoadingSeasonData(false);
        return;
      }
      const selectedLeagueId = leagueForSelectedSeason.league_id;
      setCurrentSeasonDetails(leagueForSelectedSeason); // Set the full league object
      console.log(`Selected league ID for ${selectedSeason}: ${selectedLeagueId}`); // NEW LOG

      try {
        // Fetch users, rosters, NFL players (once), and specific season data
        const [
          fetchedUsersArray, // This is an array of user objects for the SELECTED league
          fetchedRosters, // Rosters for the SELECTED league
          allSleeperMatchups, // This is the *global* cache for all historical matchups
          fetchedAllDraftHistory, // Still global, but will filter by selected season later
          fetchedNFLPlayers, // Global, cached via in-memory cache
        ] = await Promise.all([
          fetchUsersData(selectedLeagueId),
          fetchRostersWithDetails(selectedLeagueId),
          fetchAllHistoricalMatchups(), // This fetches all, filter by season for specific display
          fetchAllDraftHistory(), // This fetches all, filter by season for specific display
          fetchNFLPlayers(), // Fetch global NFL players (cached)
        ]);

        // Convert fetchedUsersArray to a map for easier lookup in sub-components
        const usersMap = fetchedUsersArray.reduce((acc, user) => {
          acc[user.userId] = user;
          return acc;
        }, {});
        setCurrentSeasonUsers(usersMap);
        setCurrentSeasonRosters(fetchedRosters);
        
        // Extract only the matchups for the selected season from the global cache
        const matchupsForSelectedSeason = allSleeperMatchups[selectedSeason] || {};
        setCurrentSeasonSleeperMatchups(matchupsForSelectedSeason); 
        console.log(`Matchups for ${selectedSeason} being set to state:`, matchupsForSelectedSeason); // NEW LOG: Check content here

        setCurrentSeasonDraftHistory(fetchedAllDraftHistory[selectedSeason] || {}); // Filter by selected season
        setCurrentSeasonNflPlayers(fetchedNFLPlayers); // Set global NFL players

        // Fetch transactions for all weeks of the selected season
        const transactionsForSelectedSeason = {};
        // Use leagueForSelectedSeason.settings?.playoff_start_week to determine relevant weeks
        let maxWeek = leagueForSelectedSeason.settings?.playoff_start_week ? leagueForSelectedSeason.settings.playoff_start_week + 3 : 18; // Max 3 playoff weeks after start
        maxWeek = Math.min(maxWeek, 18); // Cap at 18 just in case

        for (let week = 1; week <= maxWeek; week++) {
            const transactions = await fetchTransactionsForWeek(selectedLeagueId, week);
            if (transactions && transactions.length > 0) {
                transactionsForSelectedSeason[week] = transactions;
            } else if (week === 1 && (!transactions || transactions.length === 0)) { // If week 1 has no transactions, and none were fetched, break early
                console.log(`No transactions found for league ${selectedLeagueId}, Week 1. Stopping transaction fetches for this season.`); // NEW LOG
                break;
            }
        }
        setCurrentSeasonTransactions(transactionsForSelectedSeason);
        console.log(`Transactions for ${selectedSeason} being set to state:`, transactionsForSelectedSeason); // NEW LOG

      } catch (err) {
        console.error(`Error loading data for season ${selectedSeason}:`, err);
        setError(`Failed to load data for ${selectedSeason}: ${err.message}.`);
        // Clear data on error for the current season
        setCurrentSeasonDetails(null);
        setCurrentSeasonUsers({});
        setCurrentSeasonRosters([]);
        setCurrentSeasonSleeperMatchups({});
        setCurrentSeasonDraftHistory({});
        setCurrentSeasonTransactions({});
      } finally {
        setLoadingSeasonData(false);
      }
    };

    loadSelectedSeasonData();
  }, [selectedSeason, availableSeasonsData]); // Re-run when selectedSeason changes or initial season list loads


  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-blue-600">
        <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium">Loading available seasons...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 text-lg p-4">
        <p>Error: {error}</p>
        <p>Could not load season history. Please check your network connection and API configurations.</p>
      </div>
    );
  }

  // Derived state for the dropdown options
  const seasonOptions = availableSeasonsData.map(league => league.season);


  return (
    <div className="container mx-auto p-4 md:p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        Season History
      </h2>

      {/* Season Selection Dropdown */}
      <div className="mb-6 flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4">
        <label htmlFor="season-select" className="font-semibold text-gray-700">Select Season:</label>
        <select
          id="season-select"
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={selectedSeason || ''}
          onChange={(e) => {
            setSelectedSeason(e.target.value);
            setActiveSubTab(SEASONS_SUB_TABS.OVERVIEW); // Reset to overview when season changes
          }}
        >
          {/* Add a default "Select a Season" option if no season is initially selected */}
          {!selectedSeason && <option value="">Select a Season</option>}
          {seasonOptions.map(season => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </div>

      {selectedSeason && (
        loadingSeasonData ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-blue-600">
            <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium">Loading data for {selectedSeason} season...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center border-b border-gray-200 mb-6">
              {Object.values(SEASONS_SUB_TABS).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`py-2 px-4 text-lg font-medium transition-colors duration-200 ${
                    activeSubTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-700 hover:text-blue-500 hover:border-blue-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeSubTab === SEASONS_SUB_TABS.OVERVIEW && (
                <SeasonOverview
                  season={selectedSeason}
                  leagueDetails={currentSeasonDetails}
                  rosters={currentSeasonRosters}
                  users={currentSeasonUsers}
                  getDisplayTeamName={getDisplayTeamName}
                />
              )}
              {activeSubTab === SEASONS_SUB_TABS.MATCHUPS && (
                <SeasonMatchups
                  season={selectedSeason}
                  leagueId={currentSeasonDetails?.league_id}
                  matchups={currentSeasonSleeperMatchups}
                  users={currentSeasonUsers}
                  rosters={currentSeasonRosters}
                  getDisplayTeamName={getDisplayTeamName}
                />
              )}
              {activeSubTab === SEASONS_SUB_TABS.DRAFT && (
                <SeasonDraft
                  season={selectedSeason}
                  leagueId={currentSeasonDetails?.league_id}
                  draftHistory={currentSeasonDraftHistory}
                  nflPlayers={currentSeasonNflPlayers}
                  users={currentSeasonUsers}
                  rosters={currentSeasonRosters}
                  getDisplayTeamName={getDisplayTeamName}
                />
              )}
              {activeSubTab === SEASONS_SUB_TABS.TRANSACTIONS && (
                <SeasonTransactions
                  season={selectedSeason}
                  leagueId={currentSeasonDetails?.league_id}
                  transactionsByWeek={currentSeasonTransactions}
                  nflPlayers={currentSeasonNflPlayers}
                  users={currentSeasonUsers}
                  rosters={currentSeasonRosters}
                  getDisplayTeamName={getDisplayTeamName}
                />
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};

export default Seasons;
