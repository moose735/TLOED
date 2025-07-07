// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Still imported, but PowerRankings.js no longer uses it directly
  // CURRENT_LEAGUE_ID, // REMOVED: Import CURRENT_LEAGUE_ID from here as it's defined in sleeperApi.js
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
import { fetchLeagueDetails, CURRENT_LEAGUE_ID } from './utils/sleeperApi'; // ADDED: Import CURRENT_LEAGUE_ID from sleeperApi.js


// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Dashboard', tab: 'dashboard' }, // Default home tab now points to Dashboard
  POWER_RANKINGS: { label: 'Power Rankings', tab: 'powerRankings' }, // Re-added Power Rankings as a top-level nav item
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' }, // Corrected label
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'DPR Analysis', tab: 'dprAnalysis' }, // Added DPR Analysis
      { label: 'Luck Rating', tab: 'luckRating' }, // Added Luck Rating
      { label: 'Head-to-Head Grid', tab: 'head2HeadGrid' }, // Added Head to Head Grid
      { label: 'Financials', tab: 'financials' }, // Added Financials
    ],
  },
};

const TABS = {
  DASHBOARD: 'dashboard',
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail', // For navigating to a specific team's detail page
  HEAD_TO_HEAD_GRID: 'head2HeadGrid', // Tab for the Head2HeadGrid component
  FINANCIALS: 'financials', // Tab for FinancialTracker
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [selectedTeam, setSelectedTeam] = useState(null); // State to hold the selected team for TeamDetailPage
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagueName, setLeagueName] = useState('Fantasy League'); // Default league name


  // Function to determine the display name for a team
  const getMappedTeamName = useCallback((teamIdOrName) => {
    // This function can be enhanced to map team IDs from Sleeper to custom names
    // if you have a separate mapping in config.js or another utility.
    // For now, it simply returns the name as is or uses the sleeper_id to team name map.

    // If you're passing a team ID that needs to be mapped to a display name:
    // Example: if (TEAM_ID_TO_DISPLAY_NAME_MAP[teamIdOrName]) {
    //   return TEAM_ID_TO_DISPLAY_NAME_MAP[teamIdOrName];
    // }

    // Use the TEAM_NAME_TO_SLEEPER_ID_MAP to reverse lookup display names if necessary
    // or just return the provided teamIdOrName if it's already a display name.
    return teamIdOrName;
  }, []); // No dependencies for now, but add if external mappings are used.


  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        // Fetch league details to get the league name dynamically
        const leagueDetails = await fetchLeagueDetails(CURRENT_LEAGUE_ID);
        if (leagueDetails && leagueDetails.name) {
          setLeagueName(leagueDetails.name);
        }

        const response = await fetch(HISTORICAL_MATCHUPS_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched historical data:", data); // Log the fetched data
        setHistoricalMatchups(data);
      } catch (e) {
        console.error("Error fetching historical matchups:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, []);

  const handleSelectTeam = useCallback((teamName) => {
    setSelectedTeam(teamName);
    setActiveTab(TABS.TEAM_DETAIL);
  }, []);

  // Helper to render navigation items
  const renderNavItem = (category) => {
    if (category.subTabs) {
      return (
        <div key={category.label} className="relative group">
          <button className="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium">
            {category.label}
          </button>
          <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 hidden group-hover:block">
            {category.subTabs.map(subTab => (
              <a
                key={subTab.tab}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab(subTab.tab); setSelectedTeam(null); }}
                className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${activeTab === subTab.tab ? 'bg-gray-100 font-semibold' : ''}`}
              >
                {subTab.label}
              </a>
            ))}
          </div>
        </div>
      );
    } else {
      return (
        <a
          key={category.tab}
          href="#"
          onClick={(e) => { e.preventDefault(); setActiveTab(category.tab); setSelectedTeam(null); }}
          className={`text-white px-3 py-2 rounded-md text-sm font-medium ${activeTab === category.tab ? 'bg-blue-700' : 'hover:bg-blue-700'}`}
        >
          {category.label}
        </a>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white shadow-md p-4">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold mb-2 sm:mb-0">
            {leagueName} Dashboard
          </h1>
          <nav className="flex space-x-4">
            {Object.values(NAV_CATEGORIES).map(renderNavItem)}
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {loading ? (
          <div className="text-center text-gray-600 text-lg mt-8">Loading historical data...</div>
        ) : error ? (
          <div className="text-center text-red-600 text-lg mt-8">Error: {error}</div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
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
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
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
            {activeTab === TABS.HEAD_TO_HEAD_GRID && (
              <Head2HeadGrid
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
