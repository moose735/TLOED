// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_CHAMPIONS_API_URL, // Will use mock data if not provided
  // NICKNAME_TO_SLEEPER_USER and SLEEPER_LEAGUE_ID are no longer needed here
} from './config';

// Import existing components from your provided App.js
import PowerRankings from './lib/PowerRankings';
import MatchupHistory from './lib/MatchupHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';

// Import the new TeamDetailPage component
import TeamDetailPage from './lib/TeamDetailPage';


// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Power Rankings', tab: 'powerRankings' }, // Default home tab
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
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
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail' // New tab for individual team pages
};

// Main App component
const App = () => {
  // --- State Variables ---
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  const [activeDropdown, setActiveDropdown] = useState(null); // To manage dropdown visibility
  const [selectedTeam, setSelectedTeam] = useState(null); // Holds the name of the currently selected team for TeamDetailPage

  // Data for historical matchups (used by multiple components)
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);

  // Unique team names derived from historical matchups for the 'Teams' dropdown
  const [uniqueTeamNames, setUniqueTeamNames] = useState([]);

  // Historical Champions data (mocked if API not provided)
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingChampions, setLoadingChampions] = useState(true);
  const [errorChampions, setErrorChampions] = useState(null);


  // --- Helper Functions ---
  // getMappedTeamName now simply returns the original name, as we assume historicalMatchups
  // already contains the desired display names. If custom mapping is needed,
  // it would be implemented here using NICKNAME_TO_SLEEPER_USER from config.
  const getMappedTeamName = useCallback((originalName) => {
    return originalName;
  }, []);


  // --- Centralized Data Fetching ---

  // Fetch Historical Matchups
  useEffect(() => {
    const fetchMatchups = async () => {
      if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_NEW_HISTORICAL_MATCHUPS_APPS_SCRIPT_URL' || !HISTORICAL_MATCHUPS_API_URL) {
        setLoadingHistoricalData(false);
        setHistoricalDataError("Please update HISTORICAL_MATCHUPS_API_URL in config.js with your actual Apps Script URL for historical matchups.");
        return;
      }

      setLoadingHistoricalData(true);
      setHistoricalDataError(null);

      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        const fetchedMatchups = Array.isArray(data.data) ? data.data : [];
        setHistoricalMatchups(fetchedMatchups);

        // Derive unique team names from fetched matchups
        const teams = new Set();
        fetchedMatchups.forEach(match => {
          if (match.team1) teams.add(String(match.team1).trim());
          if (match.team2) teams.add(String(match.team2).trim());
        });
        setUniqueTeamNames(Array.from(teams).sort()); // Sort alphabetically
      } catch (err) {
        console.error("Error fetching historical matchups:", err);
        setHistoricalDataError(
          `Failed to fetch historical matchups: ${err.message}. ` +
          `Ensure your Apps Script URL (${HISTORICAL_MATCHUPS_API_URL}) is correct and publicly accessible.`
        );
      } finally {
        setLoadingHistoricalData(false);
      }
    };

    fetchMatchups();
  }, [HISTORICAL_MATCHUPS_API_URL]);

  // Fetch Historical Champions data (mocked if GOOGLE_SHEET_CHAMPIONS_API_URL is not provided)
  useEffect(() => {
    const fetchHistoricalChampions = async () => {
      if (GOOGLE_SHEET_CHAMPIONS_API_URL && GOOGLE_SHEET_CHAMPIONS_API_URL !== 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL_OPTIONAL') {
        setLoadingChampions(true);
        setErrorChampions(null);
        try {
          const response = await fetch(GOOGLE_SHEET_CHAMPIONS_API_URL, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`Champions API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }
          setHistoricalChampions(Array.isArray(data.data) ? data.data : []);
        } catch (error) {
          console.error("Error fetching historical champions data:", error);
          setErrorChampions(
            `Error: ${error.message}. ` +
            `Please ensure your Champions Apps Script URL (${GOOGLE_SHEET_CHAMPIONS_API_URL}) is correct and publicly accessible.`
          );
          setHistoricalChampions([]); // Set to empty array on error
        } finally {
          setLoadingChampions(false);
        }
      } else {
        // Mock data if API URL is not set
        setLoadingChampions(false);
        setErrorChampions(null);
        setHistoricalChampions([
          { year: 2023, champion: "Irwin", runnerUp: "Blumbergs", mvp: "Irwin" },
          { year: 2022, champion: "Boilard", runnerUp: "Irwin", mvp: "Boilard" },
          { year: 2021, champion: "Randall", runnerUp: "Meer", mvp: "Randall" },
          { year: 2020, champion: "Tomczak", runnerUp: "Boilard", mvp: "Tomczak" },
          { year: 2019, champion: "Neufeglise", runnerUp: "Blumbergs", mvp: "Neufeglise" },
        ]);
      }
    };

    fetchHistoricalChampions();
  }, [GOOGLE_SHEET_CHAMPIONS_API_URL]);


  // Dynamically populate Teams dropdown in NAV_CATEGORIES using uniqueTeamNames
  const updatedNavCategories = { ...NAV_CATEGORIES };
  updatedNavCategories.TEAMS.subTabs = uniqueTeamNames.map(teamName => ({
    label: teamName,
    tab: TABS.TEAM_DETAIL,
    teamName: teamName
  }));


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Tailwind CSS CDN for styling */}
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />

      {/* Custom CSS for dropdown navigation, adjusted for conciseness */}
      <style>{`
        /* Global Styles & Utilities */
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f2f5; /* Light background */
        }
        .max-w-4xl {
            max-width: 900px;
        }

        /* Navigation Styles */
        .navbar {
            display: flex;
            justify-content: center;
            width: 100%;
            max-width: 4xl;
            background: #0070c0; /* Darker blue for navbar */
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            padding: 0 10px;
            z-index: 1000;
            position: relative;
        }

        .nav-item {
            position: relative;
            cursor: pointer;
            padding: 15px 20px;
            color: white;
            font-weight: 600;
            transition: background-color 0.3s ease;
            white-space: nowrap;
        }

        .nav-item:hover {
            background-color: #005f9f;
        }

        .nav-item.active-category {
            background-color: #005f9f;
        }

        .dropdown-content {
            display: none;
            position: absolute;
            background-color: #f9f9f9;
            min-width: 160px;
            box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
            z-index: 1001;
            left: 0;
            top: 100%;
            border-radius: 0 0 8px 8px;
            overflow: hidden;
            border-top: 2px solid #0070c0;
        }

        .nav-item:hover .dropdown-content, .dropdown-content.active {
            display: block;
        }

        .dropdown-item {
            color: #333;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            text-align: left;
            font-weight: normal;
        }

        .dropdown-item:hover {
            background-color: #e0e0e0;
            color: #0070c0;
        }
        .dropdown-item.active-tab {
            background-color: #0070c0;
            color: white;
        }

        .content-container {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            width: 100%;
            max-w-4xl;
            min-height: 400px;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 20px;
        }

        @media (max-width: 600px) {
          .navbar {
            padding: 0;
            flex-wrap: wrap;
            border-radius: 8px;
          }
          .nav-item {
            padding: 10px 12px;
            font-size: 0.9em;
          }
          .dropdown-content {
            width: 100%;
            left: 0;
            border-radius: 0 0 8px 8px;
            position: static;
            box-shadow: none;
            border-top: none;
          }
          .nav-item:hover .dropdown-content, .dropdown-content.active {
            display: block;
          }
          .dropdown-item {
            padding: 10px 12px;
          }
          .content-container {
            padding: 15px;
          }
        }
      `}</style>

      <header className="w-full max-w-4xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Fantasy League Dashboard</h1>
        {sleeperLeagueData && ( // Still keeping sleeperLeagueData if it were to be re-added for league name display
          <p className="text-xl">
            {sleeperLeagueData.name} ({sleeperLeagueData.season} Season)
          </p>
        )}
        {!sleeperLeagueData && (
          <p className="text-xl">Your central hub for league insights!</p>
        )}
      </header>

      {/* Team Ticker - Removed as per user instruction. */}

      {/* Navigation Tabs with Dropdown */}
      <nav className="navbar mb-0">
        {Object.entries(updatedNavCategories).map(([categoryKey, category]) => (
          <div
            key={categoryKey}
            // Add active-category class if it's the current dropdown open, OR if a sub-tab within it is active
            className={`nav-item ${activeDropdown === categoryKey || (category.subTabs && category.subTabs.some(sub => sub.tab === activeTab && (sub.teamName ? selectedTeam === sub.teamName : true))) ? 'active-category' : ''}`}
            onMouseEnter={() => category.subTabs && setActiveDropdown(categoryKey)}
            onMouseLeave={() => setActiveDropdown(null)}
            onClick={() => {
              if (!category.subTabs) { // Direct tab click (e.g., Power Rankings)
                setActiveTab(category.tab);
                setSelectedTeam(null); // Clear selected team
                setActiveDropdown(null);
              }
            }}
          >
            {category.label}
            {category.subTabs && (
              <div className={`dropdown-content ${activeDropdown === categoryKey ? 'active' : ''}`}>
                {category.subTabs.map((subTab) => (
                  <a
                    key={subTab.label}
                    href="#"
                    className={`dropdown-item ${activeTab === subTab.tab && (subTab.teamName ? selectedTeam === subTab.teamName : true) ? 'active-tab' : ''}`}
                    onClick={(e) => {
                      e.preventDefault(); // Prevent default link behavior
                      setActiveTab(subTab.tab);
                      setSelectedTeam(subTab.teamName || null); // Set selected team if applicable
                      setActiveDropdown(null); // Close dropdown
                    }}
                  >
                    {subTab.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <main className="w-full max-w-4xl">
        {activeTab === TABS.POWER_RANKINGS && <PowerRankings />}
        {activeTab === TABS.LEAGUE_HISTORY && (
          <MatchupHistory
            historicalMatchups={historicalMatchups}
            loading={loadingHistoricalData}
            error={historicalDataError}
            getMappedTeamName={getMappedTeamName}
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
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8">
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
