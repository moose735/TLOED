// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Still imported, but PowerRankings.js no longer uses it directly
  CURRENT_LEAGUE_ID, // Import CURRENT_LEAGUE_ID
} from './config'; // Corrected import path for config.js to be within src/

// Import existing components from your provided App.js
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory'; // Corrected import to the LeagueHistory component
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid'; // Stays for its own tab
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard'; // <--- NEW IMPORT for the homepage

// Import Sleeper API functions to fetch league details for dynamic tab population
import { fetchLeagueDetails } from './utils/sleeperApi';


// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Dashboard', tab: 'dashboard' }, // Default home tab now points to Dashboard
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' }, // Now points to LeagueHistory
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'Head-to-Head', tab: 'headToHead' }, // Separate tab for Head2HeadGrid
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating', tab: 'luckRating' },
    ]
  },
  TEAMS: { // New category for individual team pages
    label: 'Teams',
    subTabs: [], // This will be populated dynamically from historicalMatchups
  },
  FINANCIALS: { label: 'Financials', tab: 'financials' },
};

// Flattened list of all possible tabs for conditional rendering
const TABS = {
  DASHBOARD: 'dashboard', // <--- NEW TAB CONSTANT for the homepage
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory', // Constant updated for LeagueHistory
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail',
  FINANCIALS: 'financials',
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD); // Set Dashboard as default
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [historicalChampions, setHistoricalChampions] = useState([]); // State for champions
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null); // State to hold the selected team name

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
  const [openSubMenu, setOpenSubMenu] = useState(null); // State for mobile sub-menus


  // Function to toggle sub-menus in mobile view
  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };


  // Function to get mapped team names (case-insensitive, trim)
  const getMappedTeamName = useCallback((teamName) => {
    if (typeof teamName !== 'string' || !teamName) return ''; // Ensure it's a string and not empty
    const trimmedName = teamName.trim();
    return trimmedName;
  }, []);

  // Fetch historical matchup data and championship data
  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoadingHistoricalData(true);
      setHistoricalDataError(null); // Clear previous errors

      // Fetch Historical Matchups (still using Google Sheet for this specific data for now)
      let fetchedMatchupData = [];
      try {
        if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_GOOGLE_SHEET_HISTORICAL_MATCHUPS_API_URL') {
          // Instead of throwing an error for config, try to use Sleeper API for historical data
          // if the Google Sheet URL is not configured.
          // For now, retaining the error as per existing structure, but could be enhanced.
          throw new Error("HISTORICAL_MATCHUPS_API_URL not configured in config.js. Please update it or note that historical data won't load.");
        }
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - Could not load historical matchup data.`);
        }

        const textResponse = await response.text(); // Get raw text to inspect
        try {
          const parsedData = JSON.parse(textResponse);
          // Crucial: Check if the parsed data is an object with a 'data' property that is an array
          if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.data)) {
            fetchedMatchupData = parsedData.data; // Extract the actual array
            setHistoricalMatchups(fetchedMatchupData);
          } else {
            console.error("API response for historical matchups is not in the expected format (object with 'data' array):", parsedData);
            throw new Error("Historical matchup data is not in the expected array format. Raw response: " + textResponse);
          }
        } catch (jsonError) {
          console.error("Error parsing historical matchup data JSON. Raw response:", textResponse, jsonError);
          setHistoricalDataError(`Failed to load historical matchup data: The API response was not valid JSON. Please ensure your Google Apps Script for HISTORICAL_MATCHUPS_API_URL is correctly deployed as a Web App and returns JSON (e.g., using ContentService.MimeType.JSON). Raw response snippet: ${textResponse.substring(0, 200)}...`);
          setLoadingHistoricalData(false); // Ensure loading is false on error
          return; // Stop execution if parsing fails to avoid further issues
        }

        // Dynamically populate TEAMS subTabs
        const uniqueTeamsSet = new Set();
        // Check if fetchedMatchupData is actually an array before iterating
        if (Array.isArray(fetchedMatchupData)) {
          fetchedMatchupData.forEach(match => {
            const team1 = getMappedTeamName(match.team1);
            const team2 = getMappedTeamName(match.team2);
            if (team1) uniqueTeamsSet.add(team1);
            if (team2) uniqueTeamsSet.add(team2);
          });
        } else {
          console.warn("fetchedMatchupData is not an array after processing, cannot populate team list.");
        }

        const uniqueTeams = Array.from(uniqueTeamsSet).sort();

        NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
          label: team,
          tab: TABS.TEAM_DETAIL, // All team links go to the team detail tab
          teamName: team,           // Pass the team name for rendering
        }));

      } catch (error) {
        console.error("Error fetching historical matchup data:", error);
        setHistoricalDataError(`Failed to load historical data: ${error.message}. Please check your HISTORICAL_MATCHUPS_API_URL in config.js and ensure your Google Apps Script is deployed correctly as a Web App (Execute as: Me, Who has access: Anyone).`);
        setLoadingHistoricalData(false); // Ensure loading is false on error
        return; // Stop execution if fetching fails
      } finally {
        // Ensure loading is false after data fetch (even if it fails, to stop spinner)
        setLoadingHistoricalData(false);
      }

      // Always use mock data for historical champions as per request
      setHistoricalChampions([
        { year: 2023, champion: "Mock Champion 2023" },
        { year: 2022, champion: "Mock Champion 2022" },
      ]);
    };

    fetchHistoricalData();
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
            onClick={() => handleTabChange(TABS.DASHBOARD)} {/* Link for Dashboard */}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.HOME.label}
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
                    key={item.label} // Use label as key for team buttons
                    onClick={() => handleTabChange(item.tab, item.teamName)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${selectedTeam === item.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Financials Link */}
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
              onClick={() => handleTabChange(TABS.DASHBOARD)} {/* Link for Dashboard */}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.HOME.label}
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


      <main className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 mt-4"> {/* Adjusted for centering and max-width */}
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
            1. **Google Apps Script URLs (`config.js`):** Ensure `HISTORICAL_MATCHUPS_API_URL` is correct and points to your deployed Google Apps Script Web App.
            2. **Google Apps Script Deployment:** For your script, verify its deployment settings: "Execute as: Me" and "Who has access: Anyone".
            3. **Vercel Deployment / Local Server:** Ensure your `index.js` file (and other JavaScript files) are being served with the correct MIME type (`application/javascript`). This usually requires proper build configuration (e.g., using a `build` script that generates optimized JavaScript bundles, which Vercel handles automatically for standard React projects). If developing locally, ensure your development server is configured correctly.
          </p>
        ) : (
          <div className="w-full"> {/* Ensure content area takes full width */}
            {activeTab === TABS.DASHBOARD && ( // Render Dashboard for the new homepage
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

           {/* Render TeamDetailPage when selected */}
           {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
             <TeamDetailPage
               teamName={selectedTeam}
               historicalMatchups={historicalMatchups}
               getMappedTeamName={getMappedTeamName}
             />
           )}
           {/* NEW: Render FinancialTracker */}
{activeTab === TABS.FINANCIALS && (
    <FinancialTracker
        getDisplayTeamName={getMappedTeamName}
        historicalMatchups={historicalMatchups} // <--- Ensure this prop is present and correctly linked
    />
)}
          </div>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8 px-4">
        <p>This site displays league data powered by Google Apps Script.</p>
        <p className="mt-2">
          For Apps Script deployment instructions, visit:{" "}
          <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Google Apps Script Web Apps Guide
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
