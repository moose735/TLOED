// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  // Removed HISTORICAL_MATCHUPS_API_URL and GOOGLE_SHEET_POWER_RANKINGS_API_URL as we'll use Sleeper API directly
  // CURRENT_LEAGUE_ID is now imported from sleeperApi.js, so it should not be imported from config.js at all.
} from './config'; // No CURRENT_LEAGUE_ID here, as it's from sleeperApi.js

// Import existing components from your provided App.js
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';
// NEW: Import the HistoricalMatchupsByYear component
import HistoricalMatchupsByYear from './components/HistoricalMatchupsByYear';

// Import Sleeper API functions to fetch league details for dynamic tab population
// Ensure CURRENT_LEAGUE_ID and TEAM_NAME_TO_SLEEPER_ID_MAP are imported from here
import { fetchLeagueDetails, fetchAllHistoricalMatchups, TEAM_NAME_TO_SLEEPER_ID_MAP, fetchRostersWithDetails, fetchUsersData, CURRENT_LEAGUE_ID } from './utils/sleeperApi';
// Import calculations to get career stats
import { calculateAllLeagueMetrics } from './utils/calculations';


// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Dashboard', tab: 'dashboard' },
  POWER_RANKINGS: { label: 'Power Rankings', tab: 'powerRankings' },
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'Head-to-Head', tab: 'headToHead' },
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating', tab: 'luckRating' },
      { label: 'Historical Matchups', tab: 'historicalMatchups' }, // NEW: Historical Matchups tab
    ]
  },
  TEAMS: {
    label: 'Teams',
    subTabs: [],
  },
  FINANCIALS: { label: 'Financials', tab: 'financials' },
};

// Flattened list of all possible tabs for conditional rendering
const TABS = {
  DASHBOARD: 'dashboard',
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail',
  FINANCIALS: 'financials',
  HISTORICAL_MATCHUPS: 'historicalMatchups', // NEW: Tab for Historical Matchups
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [historicalMatchups, setHistoricalMatchups] = useState({}); // Changed to object for year-keyed data
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamNameToDisplayMap, setTeamNameToDisplayMap] = useState(new Map()); // Maps internal names (Ainsworth) to display names
  // New state for mapping Sleeper IDs to display names
  const [rosterIdToDisplayNameMap, setRosterIdToDisplayNameMap] = useState(new Map());
  const [userIdToDisplayNameMap, setUserIdToDisplayNameMap] = useState(new Map());
  const [allCareerStats, setAllCareerStats] = useState([]); // Stores careerDPRData for use in other components

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);


  // Function to toggle sub-menus in mobile view
  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };

  /**
   * Universal function to get the display name for a team given various identifiers.
   * Prioritizes mapping Sleeper roster_ids/user_ids to display names.
   * Falls back to mapping internal team name keys or the identifier itself.
   * @param {string} identifier - Can be a Sleeper roster_id, a Sleeper user_id, or an internal team name key (e.g., 'Ainsworth').
   * @returns {string} The display name for the team.
   */
  const getDisplayTeamName = useCallback((identifier) => {
    if (typeof identifier !== 'string' || !identifier) return '';

    // 1. Try to resolve if it's a roster_id
    if (rosterIdToDisplayNameMap.has(identifier)) {
        return rosterIdToDisplayNameMap.get(identifier);
    }
    // 2. Try to resolve if it's a user_id
    if (userIdToDisplayNameMap.has(identifier)) {
        return userIdToDisplayNameMap.get(identifier);
    }
    // 3. Try to resolve if it's an internal team name key (e.g., 'Ainsworth')
    // This handles names coming from NAV_CATEGORIES.TEAMS.subTabs directly.
    if (teamNameToDisplayMap.has(identifier)) {
        return teamNameToDisplayMap.get(identifier);
    }

    // 4. Last resort: return the identifier itself if no mapping found
    return identifier.trim();
  }, [teamNameToDisplayMap, rosterIdToDisplayNameMap, userIdToDisplayNameMap]);


  // Fetch historical matchup data, championship data, and populate team names
  useEffect(() => {
    const fetchAndProcessHistoricalData = async () => {
      setLoadingHistoricalData(true);
      setHistoricalDataError(null);

      try {
        // Use the fetchAllHistoricalMatchups from sleeperApi.js
        const fetchedMatchupData = await fetchAllHistoricalMatchups();
        setHistoricalMatchups(fetchedMatchupData);

        // --- Start: Dynamic Team Name Population for Navigation and ID Resolution ---
        const uniqueTeamsSet = new Set();
        const tempTeamNameToDisplayMap = new Map(); // For internal names like 'Ainsworth' to display names
        const tempUserIdToDisplayNameMap = new Map(); // For user_id to display name
        const tempRosterIdToDisplayNameMap = new Map(); // For roster_id to display name

        let currentLeagueId = CURRENT_LEAGUE_ID;
        const leagueIds = [];
        const usersByLeague = {};
        const rostersByLeague = {};
        const leagueDetailsMap = new Map(); // To store league details for quick lookup by ID

        while (currentLeagueId && currentLeagueId !== '0' && !leagueIds.includes(currentLeagueId)) {
            leagueIds.push(currentLeagueId);
            const leagueDetail = await fetchLeagueDetails(currentLeagueId);
            if (leagueDetail) {
                leagueDetailsMap.set(currentLeagueId, leagueDetail);
                currentLeagueId = leagueDetail.previous_league_id;
            } else {
                currentLeagueId = null; // End of history or error
            }
        }

        // Fetch users and rosters for all identified league IDs in parallel
        const allUsersPromises = leagueIds.map(id => fetchUsersData(id));
        const allRostersPromises = leagueIds.map(id => fetchRostersWithDetails(id));

        const allUsersResults = await Promise.all(allUsersPromises);
        const allRostersResults = await Promise.all(allRostersPromises);

        allUsersResults.forEach((users, index) => {
            const leagueId = leagueIds[index];
            usersByLeague[leagueId] = users;
            if (users && users.length > 0) {
                users.forEach(user => {
                    const displayName = user.teamName || user.displayName || user.metadata?.team_name || user.display_name || user.user_id;
                    tempUserIdToDisplayNameMap.set(user.userId, displayName);

                    const mappedName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(
                        key => TEAM_NAME_TO_SLEEPER_ID_MAP[key] === user.userId
                    );
                    if (mappedName) {
                        uniqueTeamsSet.add(mappedName); // Add internal name to unique set for navigation
                        tempTeamNameToDisplayMap.set(mappedName, displayName);
                    } else {
                        // Fallback for unmapped teams, using display_name or user_id for navigation
                        const fallbackName = user.teamName || user.displayName || user.userId;
                        uniqueTeamsSet.add(fallbackName);
                        tempTeamNameToDisplayMap.set(fallbackName, fallbackName); // Map it to itself if no specific internal key
                    }
                });
            }
        });

        allRostersResults.forEach((rosters, index) => {
            const leagueId = leagueIds[index];
            rostersByLeague[leagueId] = rosters;
            if (rosters && rosters.length > 0) {
                rosters.forEach(roster => {
                    const ownerDisplayName = tempUserIdToDisplayNameMap.get(roster.owner_id);
                    if (ownerDisplayName) {
                        tempRosterIdToDisplayNameMap.set(roster.roster_id, ownerDisplayName);
                    } else {
                        // Fallback for roster_id if owner_id somehow didn't map
                        tempRosterIdToDisplayNameMap.set(roster.roster_id, `Roster: ${roster.roster_id}`);
                    }
                });
            }
        });

        // Set the state variables for the maps
        setTeamNameToDisplayMap(tempTeamNameToDisplayMap);
        setUserIdToDisplayNameMap(tempUserIdToDisplayNameMap);
        setRosterIdToDisplayNameMap(tempRosterIdToDisplayNameMap);

        console.log("Final teamNameToDisplayMap (internal to display):", tempTeamNameToDisplayMap);
        console.log("Final userIdToDisplayNameMap (user_id to display):", tempUserIdToDisplayNameMap);
        console.log("Final rosterIdToDisplayNameMap (roster_id to display):", tempRosterIdToDisplayNameMap);

        const uniqueTeams = Array.from(uniqueTeamsSet).sort();
        NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
          label: team,
          tab: TABS.TEAM_DETAIL,
          teamName: team,
        }));
        // --- End: Dynamic Team Name Population for Navigation and ID Resolution ---

        // AFTER all maps are populated and stable, calculate league metrics
        if (Object.keys(fetchedMatchupData).length > 0) {
            const { careerDPRData } = calculateAllLeagueMetrics(fetchedMatchupData, getDisplayTeamName);
            setAllCareerStats(careerDPRData);
            console.log("Calculated all career stats:", careerDPRData);
        }

      } catch (error) {
        console.error("Error fetching historical matchup data or league details from Sleeper API:", error);
        setHistoricalDataError(`Failed to load league data: ${error.message}. Please check your internet connection, CURRENT_LEAGUE_ID, or the Sleeper API.`);
      } finally {
        setLoadingHistoricalData(false);
      }

      // Always use mock data for historical champions as per request
      setHistoricalChampions([
        { year: 2023, champion: "Mock Champion 2023" },
        { year: 2022, champion: "Mock Champion 2022" },
      ]);
    };

    fetchAndProcessHistoricalData();
    // Dependency array for useEffect: re-run if any of these change, ensuring re-calculation with updated maps
  }, [getDisplayTeamName]); // getDisplayTeamName is a useCallback, so it only changes if its dependencies change.

  // Handle tab change, including setting selectedTeam for TEAM_DETAIL tab
  const handleTabChange = (tab, teamName = null) => {
    setActiveTab(tab);
    setSelectedTeam(teamName);
    setIsMobileMenuOpen(false); // Close mobile menu on tab selection
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-900 flex flex-col items-center">
      <header className="bg-white shadow-md py-4 px-6 flex justify-between items-center relative z-10 w-full">
        <div className="flex items-center">
          <h1 className="text-xl md:text-2xl font-bold text-blue-800">The League of Extraordinary Douchebags</h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => handleTabChange(TABS.DASHBOARD)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.HOME.label}
          </button>

          <button
            onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.POWER_RANKINGS.label}
          </button>

          {/* Dropdown for League Data */}
          <div className="relative group">
            <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center transition-colors duration-200">
              {NAV_CATEGORIES.LEAGUE_DATA.label}
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
              {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => handleTabChange(item.tab)}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${activeTab === item.tab ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown for Teams (dynamic) */}
          {NAV_CATEGORIES.TEAMS.subTabs.length > 0 && (
            <div className="relative group">
              <button
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center transition-colors duration-200"
                onClick={() => toggleSubMenu('TEAMS')}
              >
                {NAV_CATEGORIES.TEAMS.label}
                <svg className={`w-5 h-5 transition-transform duration-200 ${openSubMenu === 'TEAMS' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {openSubMenu === 'TEAMS' && (
                <ul className="pl-6 mt-2 space-y-2 transition-all duration-300 ease-in-out origin-top">
                  {NAV_CATEGORIES.TEAMS.subTabs.map((subTab) => (
                      <li key={subTab.label}>
                        <button
                          onClick={() => handleTabChange(subTab.tab, subTab.teamName)}
                          className={`block w-full text-left py-2 px-3 rounded-md text-base transition-colors duration-200 ${selectedTeam === subTab.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {subTab.label}
                        </button>
                      </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={() => handleTabChange(TABS.FINANCIALS)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.FINANCIALS ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.FINANCIALS.label}
          </button>
        </nav>

        {/* Mobile Hamburger Icon */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-800 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className={`fixed inset-0 bg-white z-50 overflow-y-auto p-4 md:hidden transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-800 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
              aria-label="Close mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          {/* Mobile Navigation Links */}
          <nav className="flex flex-col space-y-4">
            <button
              onClick={() => handleTabChange(TABS.DASHBOARD)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.HOME.label}
            </button>

            <button
              onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.POWER_RANKINGS.label}
            </button>

            {/* Accordion for League Data */}
            <div className="border-b border-gray-200 pb-2">
              <button
                className="flex justify-between items-center w-full py-3 px-4 text-lg font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
                onClick={() => toggleSubMenu('LEAGUE_DATA')}
              >
                {NAV_CATEGORIES.LEAGUE_DATA.label}
                <svg className={`w-5 h-5 transition-transform duration-200 ${openSubMenu === 'LEAGUE_DATA' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {openSubMenu === 'LEAGUE_DATA' && (
                <ul className="pl-6 mt-2 space-y-2 transition-all duration-300 ease-in-out origin-top">
                  {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map((subTab) => (
                    <li key={subTab.tab}>
                      <button
                        onClick={() => handleTabChange(subTab.tab)}
                        className={`block w-full text-left py-2 px-3 rounded-md text-base transition-colors duration-200 ${activeTab === subTab.tab ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {subTab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Accordion for Teams (dynamic) */}
            {NAV_CATEGORIES.TEAMS.subTabs.length > 0 && (
              <div className="border-b border-gray-200 pb-2">
                <button
                  className="flex justify-between items-center w-full py-3 px-4 text-lg font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
                  onClick={() => toggleSubMenu('TEAMS')}
                >
                  {NAV_CATEGORIES.TEAMS.label}
                  <svg className={`w-5 h-5 transition-transform duration-200 ${openSubMenu === 'TEAMS' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {openSubMenu === 'TEAMS' && (
                  <ul className="pl-6 mt-2 space-y-2 transition-all duration-300 ease-in-out origin-top">
                    {NAV_CATEGORIES.TEAMS.subTabs.map((subTab) => (
                      <li key={subTab.label}>
                        <button
                          onClick={() => handleTabChange(subTab.tab, subTab.teamName)}
                          className={`block w-full text-left py-2 px-3 rounded-md text-base transition-colors duration-200 ${selectedTeam === subTab.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {subTab.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Financials Link (Mobile) */}
            <button
              onClick={() => handleTabChange(TABS.FINANCIALS)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.FINANCIALS ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.FINANCIALS.label}
            </button>
          </nav>
        </div>
      )}


      <main className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 mt-4">
        {loadingHistoricalData ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
            <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium">Loading league data...</p>
          </div>
        ) : historicalDataError ? (
          <p className="text-center text-red-600 text-lg">
            {historicalDataError} <br />
            <br />
            **Please check the following:**<br />
            1. **Sleeper API:** Ensure your `CURRENT_LEAGUE_ID` in `config.js` is correct and you have an active internet connection.
            2. **Data Structure:** Verify that the Sleeper API is returning data in the expected format for matchups.
          </p>
        ) : (
          <div className="w-full">
            {activeTab === TABS.DASHBOARD && (
              <Dashboard
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeTab === TABS.HEAD_TO_HEAD && (
              <Head2HeadGrid
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getDisplayTeamName}
                allLeagueStats={allCareerStats}
              />
            )}
            {activeTab === TABS.DPR_ANALYSIS && (
              <DPRAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {activeTab === TABS.LUCK_RATING && (
              <LuckRatingAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getDisplayTeamName}
              />
            )}
            {/* NEW: Render HistoricalMatchupsByYear */}
            {activeTab === TABS.HISTORICAL_MATCHUPS && (
                <HistoricalMatchupsByYear
                    historicalMatchups={historicalMatchups}
                    getDisplayTeamName={getDisplayTeamName}
                />
            )}

           {/* Render TeamDetailPage when selected */}
           {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
             <TeamDetailPage
               teamName={selectedTeam}
               historicalMatchups={historicalMatchups}
               getMappedTeamName={getDisplayTeamName}
             />
           )}
           {/* Render FinancialTracker */}
            {activeTab === TABS.FINANCIALS && (
                <FinancialTracker
                    getDisplayTeamName={getDisplayTeamName}
                    historicalMatchups={historicalMatchups}
                />
            )}
          </div>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8 px-4">
        <p>This site displays league data powered by Sleeper API.</p>
        <p className="mt-2">
          For Sleeper API documentation, visit:{" "}
          <a href="https://docs.sleeper.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Sleeper API Docs
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
