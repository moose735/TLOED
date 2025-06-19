// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Still imported, but PowerRankings.js no longer uses it directly
} from './config';

// Import existing components
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid'; // Stays for its own tab
import RivalryComparisonPage from './lib/RivalryComparisonPage'; // NEW: For direct rivalry comparison

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Power Rankings', tab: 'powerRankings' }, // Default home tab
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'Head-to-Head', tab: 'headToHead' }, // Separate tab for Head2HeadGrid
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating', tab: 'luckRating' },
    ]
  },
  TEAMS: { // New category for individual team pages
    label: 'Teams',
    subTabs: [], // This will be populated dynamically from historicalMatchups
  }
};

// Flattened list of all possible tabs for conditional rendering
const TABS = {
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail',
  RIVALRY_COMPARISON: 'rivalryComparison', // NEW: Tab for direct rivalry comparison
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  // historicalMatchups will now store the TRANSFORMED, nested data structure
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null); // State to hold the selected team name for TeamDetailPage
  // NEW STATE: to hold the two team names for rivalry comparison
  const [teamsToCompare, setTeamsToCompare] = useState(null); // Will be an array: [team1, team2]

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);

  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };

  const getMappedTeamName = useCallback((teamName) => {
    if (typeof teamName !== 'string' || !teamName) return '';
    const trimmedName = teamName.trim();
    // You can add more complex mapping logic here if needed
    return trimmedName;
  }, []);

  // Function to process flat matchup data into a season-nested structure
  const processFlatMatchupsToSeasons = useCallback((flatMatchups) => {
    const seasonsMap = new Map();

    flatMatchups.forEach(matchup => {
      const year = matchup.year;
      if (!year) {
        console.warn("Matchup without a year found:", matchup);
        return; // Skip matchups without a year
      }

      if (!seasonsMap.has(year)) {
        seasonsMap.set(year, {
          year: year,
          matchups: [],
          teams: {}, // To store team-specific stats for that season if available in raw data
        });
      }
      const season = seasonsMap.get(year);
      season.matchups.push(matchup);

      // Populate unique teams for the season (if not already there)
      const addTeamToSeason = (teamName) => {
        if (teamName && !season.teams[teamName]) {
          season.teams[teamName] = { name: teamName }; // Basic entry
          // Add more team-specific season stats here if they exist in your raw data
        }
      };
      addTeamToSeason(matchup.team1);
      addTeamToSeason(matchup.team2);
    });

    // Sort seasons by year
    const sortedSeasons = Array.from(seasonsMap.values()).sort((a, b) => a.year - b.year);
    return sortedSeasons;
  }, []);


  // Fetch historical matchup data and championship data
  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoadingHistoricalData(true);
      setHistoricalDataError(null);

      try {
        if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_GOOGLE_SHEET_HISTORICAL_MATCHUPS_API_URL') {
          throw new Error("HISTORICAL_MATCHUPS_API_URL not configured in config.js. Please update it.");
        }

        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - Could not load historical matchup data.`);
        }

        const textResponse = await response.text();
        let parsedData;
        try {
          parsedData = JSON.parse(textResponse);
        } catch (jsonError) {
          console.error("Error parsing historical matchup data JSON. Raw response:", textResponse, jsonError);
          throw new Error(`Failed to load historical matchup data: The API response was not valid JSON. Please ensure your Google Apps Script for HISTORICAL_MATCHUPS_API_URL is correctly deployed as a Web App and returns JSON (e.g., using ContentService.MimeType.JSON). Raw response snippet: ${textResponse.substring(0, 200)}...`);
        }

        // Assuming API returns { data: [...] } where 'data' is a flat array of matchups
        let rawFlatMatchups = [];
        if (parsedData && Array.isArray(parsedData.data)) {
          rawFlatMatchups = parsedData.data;
        } else {
          console.warn("API response 'data' property is not an array or is missing.", parsedData);
          throw new Error("Historical matchup data is not in the expected array format under 'data' key.");
        }

        // Process the flat matchups into season-nested structure
        const processedSeasons = processFlatMatchupsToSeasons(rawFlatMatchups);
        setHistoricalMatchups(processedSeasons);

        // Extract all unique team names from the processed seasons for the TEAMS dropdown
        const uniqueTeamsSet = new Set();
        processedSeasons.forEach(season => {
          Object.keys(season.teams).forEach(teamName => {
            uniqueTeamsSet.add(getMappedTeamName(teamName));
          });
        });
        const uniqueTeams = Array.from(uniqueTeamsSet).sort();

        NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
          label: team,
          tab: TABS.TEAM_DETAIL,
          teamName: team,
        }));

        // Always use mock data for historical champions as per request
        setHistoricalChampions([
          { year: 2023, champion: "Mock Champion 2023" },
          { year: 2022, champion: "Mock Champion 2022" },
        ]);

      } catch (error) {
        console.error("Error fetching or processing historical data:", error);
        setHistoricalDataError(`Failed to load historical data: ${error.message}. Please check your HISTORICAL_MATCHUPS_API_URL in config.js and ensure your Google Apps Script is deployed correctly as a Web App (Execute as: Me, Who has access: Anyone) and returns data in the format { "data": [...] }.`);
        // Ensure historicalMatchups is empty on error to prevent cascading issues
        setHistoricalMatchups([]);
      } finally {
        setLoadingHistoricalData(false);
      }
    };

    fetchAndProcessData();
  }, [getMappedTeamName, processFlatMatchupsToSeasons]);


  // Handle tab change, including setting selectedTeam/teamsToCompare
  const handleTabChange = useCallback((tab, teamName = null) => {
    setActiveTab(tab);
    setSelectedTeam(teamName); // Set for TEAM_DETAIL
    setTeamsToCompare(null); // Clear comparison when changing general tabs
    setIsMobileMenuOpen(false); // Close mobile menu on tab selection
  }, []);

  // NEW: Handle a click from the Head2Head grid for comparison
  const handleRivalryGridClick = useCallback((team1, team2) => {
    setTeamsToCompare([team1, team2]);
    setSelectedTeam(null); // Clear single team selection
    setActiveTab(TABS.RIVALRY_COMPARISON); // Switch to the new comparison tab
    setIsMobileMenuOpen(false); // Close mobile menu
  }, []);

  // Function for sub-menu clicks (used in both desktop and mobile menus)
  const handleSubTabClick = useCallback((item) => {
    if (item.tab === TABS.TEAM_DETAIL) {
      handleTabChange(item.tab, item.teamName); // Pass teamName for TeamDetailPage
    } else {
      handleTabChange(item.tab); // Standard tab change
    }
  }, [handleTabChange]);


  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-900 flex flex-col items-center">
      <header className="bg-white shadow-md py-4 px-6 flex justify-between items-center relative z-10 w-full">
        <div className="flex items-center">
          <h1 className="text-xl md:text-2xl font-bold text-blue-800">The League of Extraordinary Douchebags</h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
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
                  onClick={() => handleSubTabClick(item)}
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
                    onClick={() => handleSubTabClick(item)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${selectedTeam === item.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
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
                        onClick={() => handleSubTabClick(subTab)}
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
                          onClick={() => handleSubTabClick(subTab)}
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
          </nav>
        </div>
      )}


      <main className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 mt-4"> {/* Adjusted for centering and max-width */}
        {loadingHistoricalData ? (
          // Enhanced Loading Spinner
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
            3. **API Response Format:** Ensure your Apps Script returns JSON in the format `{"data": [...]}` where `data` is an array of matchup objects, each containing `year`, `team1`, `team2`, `winner`, `loser`, `team1Score`, `team2Score`, etc.
          </p>
        ) : (
          <div className="w-full"> {/* Ensure content area takes full width */}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                historicalChampions={historicalChampions}
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
                historicalMatchups={historicalMatchups} // This is now the season-nested data
                getDisplayTeamName={getMappedTeamName}
                onRivalryCellClick={handleRivalryGridClick} // Pass the new handler
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
                historicalChampions={historicalChampions}
              />
            )}

            {/* NEW: Render RivalryComparisonPage when teamsToCompare is set */}
            {activeTab === TABS.RIVALRY_COMPARISON && teamsToCompare && (
              <RivalryComparisonPage
                team1Name={teamsToCompare[0]}
                team2Name={teamsToCompare[1]}
                historicalMatchups={historicalMatchups} // This is the season-nested data
                getMappedTeamName={getMappedTeamName}
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
