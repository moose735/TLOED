// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  // Removed HISTORICAL_MATCHUPS_API_URL and GOOGLE_SHEET_POWER_RANKINGS_API_URL as we'll use Sleeper API directly
  CURRENT_LEAGUE_ID, // Import CURRENT_LEAGUE_ID
} from './config'; // Corrected import path for config.js to be within src/

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

// Import Sleeper API functions
import { fetchLeagueDetails, fetchAllHistoricalMatchups } from './utils/sleeperApi';


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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);


  // Function to toggle sub-menus in mobile view
  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };


  // Function to get mapped team names (case-insensitive, trim)
  const getMappedTeamName = useCallback((teamName) => {
    if (typeof teamName !== 'string' || !teamName) return '';
    const trimmedName = teamName.trim();
    // This map should ideally be populated from sleeperApi.js's TEAM_NAME_TO_SLEEPER_ID_MAP
    // For now, let's assume it maps directly, or enhance it if display names differ
    return trimmedName; // Placeholder, as sleeperApi handles the actual mapping internally
  }, []);

  // Fetch historical matchup data and championship data
  useEffect(() => {
    const fetchAndProcessHistoricalData = async () => {
      setLoadingHistoricalData(true);
      setHistoricalDataError(null);

      try {
        // Use the fetchAllHistoricalMatchups from sleeperApi.js
        const fetchedMatchupData = await fetchAllHistoricalMatchups();
        if (Object.keys(fetchedMatchupData).length > 0) {
          setHistoricalMatchups(fetchedMatchupData);

          // Dynamically populate TEAMS subTabs
          const uniqueTeamsSet = new Set();
          // Iterate through seasons and weeks to get all team names
          for (const season in fetchedMatchupData) {
            const seasonMatchups = fetchedMatchupData[season];
            for (const week in seasonMatchups) {
              seasonMatchups[week].forEach(match => {
                // IMPORTANT: The raw matchup data from Sleeper API does NOT contain team names directly.
                // It contains `roster_id` and `owner_id`.
                // To get actual team names, we would need to:
                // 1. Fetch rosters for each league/season.
                // 2. Fetch users for each league/season.
                // 3. Map roster_id to owner_id, and owner_id to teamName.
                // This is a more complex data processing step.
                // For now, let's just make sure the TeamDetailPage still functions if selected via direct URL,
                // and acknowledge that dynamic population of team names here requires more logic.
                // For simplicity, I'm commenting out the team population for now, as it's not directly supported
                // by the raw historicalMatchups data structure as is.
                // If you want dynamic team list, we need to enhance the data processing in sleeperApi.js
                // to include resolved team names within the historicalMatchups object.

                // Placeholder for future team name extraction from fetchedMatchupData if enriched
                // For now, TeamDetailPage relies on the passed `teamName` via `handleTabChange`.
              });
            }
          }

          // Placeholder: Update NAV_CATEGORIES.TEAMS.subTabs if team name resolution is implemented
          // For now, keep it empty or populate it manually for testing if needed.
          NAV_CATEGORIES.TEAMS.subTabs = []; // Keep empty until full team name resolution is implemented.

        } else {
          console.warn("No historical matchup data found from Sleeper API.");
          setHistoricalDataError("No historical matchup data could be loaded from Sleeper API. Check CURRENT_LEAGUE_ID and API connectivity.");
        }

      } catch (error) {
        console.error("Error fetching historical matchup data from Sleeper API:", error);
        setHistoricalDataError(`Failed to load historical data: ${error.message}. Please check your internet connection or Sleeper API.`);
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
  }, [getMappedTeamName]);

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
              <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center transition-colors duration-200">
                {NAV_CATEGORIES.TEAMS.label}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-60 overflow-y-auto z-20">
                {NAV_CATEGORIES.TEAMS.subTabs.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleTabChange(item.tab, item.teamName)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${selectedTeam === item.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.HEAD_TO_HEAD && (
              <Head2HeadGrid
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.DPR_ANALYSIS && (
              <DPRAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.LUCK_RATING && (
              <LuckRatingAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {/* NEW: Render HistoricalMatchupsByYear */}
            {activeTab === TABS.HISTORICAL_MATCHUPS && (
                <HistoricalMatchupsByYear
                    historicalMatchups={historicalMatchups}
                    getDisplayTeamName={getMappedTeamName}
                />
            )}

           {/* Render TeamDetailPage when selected */}
           {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
             <TeamDetailPage
               teamName={selectedTeam}
               historicalMatchups={historicalMatchups}
               getMappedTeamName={getMappedTeamName}
             />
           )}
           {/* Render FinancialTracker */}
            {activeTab === TABS.FINANCIALS && (
                <FinancialTracker
                    getDisplayTeamName={getMappedTeamName}
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
