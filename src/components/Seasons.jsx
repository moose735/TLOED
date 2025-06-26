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

// Import sub-components (will be created in subsequent steps)
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allLeagueData, setAllLeagueData] = useState([]); // All historical league details
  const [allUsers, setAllUsers] = useState({}); // Map of userId to user details across all leagues
  const [allRosters, setAllRosters] = useState({}); // Map of leagueId -> roster data
  const [allSleeperMatchups, setAllSleeperMatchups] = useState({}); // Map of season -> week -> matchups
  const [allDraftHistory, setAllDraftHistory] = useState({}); // Map of season -> draftId -> {details, picks, tradedPicks}
  const [allNflPlayers, setAllNflPlayers] = useState({}); // Map of playerId to player details
  const [allTransactions, setAllTransactions] = useState({}); // Map of leagueId -> week -> transactions

  const [selectedSeason, setSelectedSeason] = useState(null); // The season currently being viewed
  const [activeSubTab, setActiveSubTab] = useState(SEASONS_SUB_TABS.OVERVIEW);

  // Memoized helper to get a user's display name from their ID, considering all users fetched
  const getUserDisplayName = useCallback((userId) => {
    const user = allUsers[userId];
    return user ? getDisplayTeamName(user.teamName || user.displayName) : 'Unknown User';
  }, [allUsers, getDisplayTeamName]);

  // Memoized helper to get a player's name from their ID
  const getPlayerName = useCallback((playerId) => {
    const player = allNflPlayers[playerId];
    return player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : `Unknown Player (${playerId})`;
  }, [allNflPlayers]);


  useEffect(() => {
    const loadAllHistoricalSleeperData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all foundational data concurrently
        const [
          fetchedLeagueData,
          fetchedUsersArray, // This is an array of user objects
          fetchedAllRostersByLeague, // This returns {leagueId: [...rosters]}
          fetchedAllSleeperMatchups,
          fetchedAllDraftHistory,
          fetchedNFLPlayers,
        ] = await Promise.all([
          fetchLeagueData(CURRENT_LEAGUE_ID),
          // Fetch users for the CURRENT_LEAGUE_ID, then for all previous leagues
          (async () => {
              const usersMap = new Map();
              const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
              for (const league of leagues) {
                  const users = await fetchUsersData(league.league_id);
                  users.forEach(user => usersMap.set(user.userId, user));
              }
              return Array.from(usersMap.values()); // Convert back to array for consistent handling
          })(),
          // Fetch rosters for all historical leagues
          (async () => {
              const rostersMap = {};
              const leagues = await fetchLeagueData(CURRENT_LEAGUE_ID);
              for (const league of leagues) {
                  const rosters = await fetchRostersWithDetails(league.league_id);
                  rostersMap[league.league_id] = rosters;
              }
              return rostersMap;
          })(),
          fetchAllHistoricalMatchups(), // This already returns by season->week
          fetchAllDraftHistory(), // This already returns by season->draftId->details/picks/tradedPicks
          fetchNFLPlayers(),
        ]);

        setAllLeagueData(fetchedLeagueData);

        // Convert fetchedUsersArray to a map for easier lookup
        const usersMap = fetchedUsersArray.reduce((acc, user) => {
          acc[user.userId] = user;
          return acc;
        }, {});
        setAllUsers(usersMap);

        setAllRosters(fetchedAllRostersByLeague);
        setAllSleeperMatchups(fetchedAllSleeperMatchups);
        setAllDraftHistory(fetchedAllDraftHistory);
        setAllNflPlayers(fetchedNFLPlayers);

        // Set initial selected season to the current league's season
        if (fetchedLeagueData.length > 0) {
          const currentSeason = fetchedLeagueData[0].season; // Assumes first in array is current
          setSelectedSeason(currentSeason);
        }

        // Fetch transactions for all weeks of all seasons
        const allTransactionsData = {};
        for (const league of fetchedLeagueData) {
            allTransactionsData[league.league_id] = {}; // Initialize for this league
            // Assuming max 18 weeks (14 regular + 4 playoff potential) for a season
            for (let week = 1; week <= 18; week++) { // Iterate up to 18 weeks as a safe upper bound
                const transactionsForWeek = await fetchTransactionsForWeek(league.league_id, week);
                if (transactionsForWeek && transactionsForWeek.length > 0) {
                    allTransactionsData[league.league_id][week] = transactionsForWeek;
                } else if (week === 1) {
                    // If no transactions in week 1, likely no transactions for this league in the season
                    // Break early to avoid unnecessary API calls for later weeks of this league
                    break;
                }
            }
        }
        setAllTransactions(allTransactionsData);

      } catch (err) {
        console.error('Error loading all historical Sleeper data:', err);
        setError(`Failed to load historical data: ${err.message}. Please check API configurations.`);
      } finally {
        setLoading(false);
      }
    };

    loadAllHistoricalSleeperData();
  }, []); // Run once on component mount

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-blue-600">
        <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium">Loading all season history data...</p>
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

  const availableSeasons = allLeagueData
    .map(league => league.season)
    .filter((value, index, self) => self.indexOf(value) === index) // Get unique seasons
    .sort((a, b) => b - a); // Sort descending (most recent first)

  // Get the league details for the currently selected season
  const currentSeasonLeague = allLeagueData.find(league => league.season === selectedSeason);
  const currentSeasonLeagueId = currentSeasonLeague ? currentSeasonLeague.league_id : null;

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
          onChange={(e) => setSelectedSeason(e.target.value)}
        >
          {!selectedSeason && <option value="">Select a Season</option>}
          {availableSeasons.map(season => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </div>

      {selectedSeason && (
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
                leagueDetails={currentSeasonLeague}
                rosters={allRosters[currentSeasonLeagueId] || []}
                users={allUsers}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeSubTab === SEASONS_SUB_TABS.MATCHUPS && (
              <SeasonMatchups
                season={selectedSeason}
                leagueId={currentSeasonLeagueId}
                matchups={allSleeperMatchups[selectedSeason] || {}}
                users={allUsers}
                rosters={allRosters[currentSeasonLeagueId] || []}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeSubTab === SEASONS_SUB_TABS.DRAFT && (
              <SeasonDraft
                season={selectedSeason}
                leagueId={currentSeasonLeagueId}
                draftHistory={allDraftHistory[selectedSeason] || {}}
                nflPlayers={allNflPlayers}
                users={allUsers}
                rosters={allRosters[currentSeasonLeagueId] || []}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeSubTab === SEASONS_SUB_TABS.TRANSACTIONS && (
              <SeasonTransactions
                season={selectedSeason}
                leagueId={currentSeasonLeagueId}
                transactionsByWeek={allTransactions[currentSeasonLeagueId] || {}}
                nflPlayers={allNflPlayers}
                users={allUsers}
                rosters={allRosters[currentSeasonLeagueId] || []}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Seasons;
