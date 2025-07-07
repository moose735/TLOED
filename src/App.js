// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  // Removed: HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL,
  CURRENT_LEAGUE_ID,
  LEAGUE_START_YEAR, // NEW: Import LEAGUE_START_YEAR
} from './config';

// Import existing components
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';

// Import Sleeper API functions to fetch league details and historical matchups
import {
  fetchLeagueDetails,
  fetchUsersData,
  fetchHistoricalMatchups, // NEW: Import the new historical matchups function
  TEAM_NAME_TO_SLEEPER_ID_MAP, // NEW: Import the map for display names
  RETIRED_MANAGERS, // NEW: Import retired managers
} from './utils/sleeperApi';

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Dashboard', tab: 'dashboard' },
  POWER_RANKINGS: { label: 'Power Rankings', tab: 'powerRankings' },
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating Analysis', tab: 'luckRating' },
      { label: 'Matchup History', tab: 'matchupHistory' },
      { label: 'Financial Tracker', tab: 'financials' },
    ],
  },
  TEAM_STATS: { label: 'Team Stats', tab: 'teamDetail' }, // This tab is special, activated by team selection
};

const TABS = {
  DASHBOARD: 'dashboard',
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  MATCHUP_HISTORY: 'matchupHistory',
  FINANCIALS: 'financials',
  TEAM_DETAIL: 'teamDetail',
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [allTeamNames, setAllTeamNames] = useState([]); // List of unique team names for dropdown
  const [selectedTeam, setSelectedTeam] = useState(null); // State for selected team in dropdown
  const [sleeperUsers, setSleeperUsers] = useState([]); // Store Sleeper users for display name mapping

  // Function to get display team name based on Sleeper users and custom map
  const getMappedTeamName = useCallback((userIdOrDisplayName) => {
    // If it's directly a display name from Sleeper, return it
    const foundUser = sleeperUsers.find(user => user.display_name === userIdOrDisplayName || user.user_id === userIdOrDisplayName);
    if (foundUser) {
        // Check if there's a custom mapping for this user ID
        const customName = Object.keys(TEAM_NAME_TO_SLEEPER_ID_MAP).find(key => TEAM_NAME_TO_SLEEPER_ID_MAP[key] === foundUser.user_id);
        if (customName) {
            return customName;
        }
        // Check for retired managers map
        if (RETIRED_MANAGERS[foundUser.user_id]) {
            return RETIRED_MANAGERS[foundUser.user_id];
        }
        // Prioritize metadata.team_name if available
        if (foundUser.metadata && foundUser.metadata.team_name) {
            return foundUser.metadata.team_name;
        }
        // Fallback to display_name
        return foundUser.display_name || foundUser.first_name || `User ${foundUser.user_id}`;
    }

    // Fallback if userIdOrDisplayName isn't a direct user ID or display name from current users
    // This handles cases where `userIdOrDisplayName` might be a pre-mapped string or from old data.
    // In a pure Sleeper API setup, this branch should ideally not be hit frequently for team names.
    // If it's a direct match in the custom map (e.g., 'Ainsworth'), return it.
    const customMappedId = TEAM_NAME_TO_SLEEPER_ID_MAP[userIdOrDisplayName];
    if (customMappedId) {
        return userIdOrDisplayName; // Return the key as it's the desired display name
    }
    // Check if the input is a retired manager's ID
    if (RETIRED_MANAGERS[userIdOrDisplayName]) {
        return RETIRED_MANAGERS[userIdOrDisplayName];
    }

    // Default to the input if no mapping found (e.g., if it's already the correct display name)
    return userIdOrDisplayName;
}, [sleeperUsers]); // Depend on sleeperUsers so it updates if user data changes


  // Effect to load historical matchups and set team names for dropdown
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("App.js: Fetching historical matchups from Sleeper API...");
        const matchups = await fetchHistoricalMatchups(CURRENT_LEAGUE_ID);
        setHistoricalMatchups(matchups);
        console.log("App.js: Fetched historical matchups:", matchups);

        // Fetch current users for team name display in dropdown and team detail page
        const users = await fetchUsersData(CURRENT_LEAGUE_ID);
        setSleeperUsers(users);

        // Extract unique team names for the dropdown from the fetched matchups
        const uniqueTeamNames = new Set();
        matchups.forEach(match => {
            const team1Display = getMappedTeamName(match.team1UserId); // Use userId directly for mapping
            const team2Display = getMappedTeamName(match.team2UserId); // Use userId directly for mapping
            if (team1Display) uniqueTeamNames.add(team1Display);
            if (team2Display) uniqueTeamNames.add(team2Display);
        });

        // Add display names of current users to the set to ensure all active teams are present
        users.forEach(user => {
            const display = getMappedTeamName(user.user_id); // Pass user ID to getMappedTeamName
            if (display) uniqueTeamNames.add(display);
        });

        // Sort team names alphabetically
        const sortedTeamNames = Array.from(uniqueTeamNames).sort();
        setAllTeamNames(sortedTeamNames);

      } catch (err) {
        console.error("Error loading data in App.js:", err);
        setError("Failed to load historical data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [getMappedTeamName]); // getMappedTeamName is a dependency because it's used inside loadData

  const handleTeamSelect = (e) => {
    setSelectedTeam(e.target.value);
    setActiveTab(TABS.TEAM_DETAIL); // Switch to Team Detail tab when a team is selected
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setSelectedTeam(null); // Clear selected team when navigating away from Team Detail
  };

  const currentYear = new Date().getFullYear(); // Dynamic current year

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <header className="w-full max-w-6xl bg-blue-700 text-white p-6 rounded-lg shadow-md mb-8 flex flex-col md:flex-row justify-between items-center">
        <h1 className="text-4xl font-extrabold text-center mb-4 md:mb-0">
          Fantasy Football League History
        </h1>
        <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
          {/* Dropdown for Team Selection */}
          {activeTab !== TABS.TEAM_DETAIL && ( // Only show dropdown if not already on Team Detail page
            <div className="relative inline-block text-left w-full md:w-auto">
              <select
                onChange={handleTeamSelect}
                value={selectedTeam || ''} // Control the select element
                className="block appearance-none w-full bg-white border border-gray-300 text-gray-800 py-2 px-4 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">-- View Team History --</option>
                {allTeamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 6.757 7.586 5.343 9z"/></svg>
              </div>
            </div>
          )}

          {/* Navigation Tabs (simplified from original for demonstration) */}
          <nav className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-4 mt-4 md:mt-0">
            {Object.entries(NAV_CATEGORIES).map(([key, category]) => {
              if (category.subTabs) {
                // Render dropdown for categories with sub-tabs
                return (
                  <div key={key} className="relative group">
                    <button
                      className={`px-4 py-2 rounded-md font-semibold text-white transition-colors duration-200
                        ${Object.values(category.subTabs).some(sub => sub.tab === activeTab) ? 'bg-blue-800' : 'hover:bg-blue-600'}`}
                    >
                      {category.label}
                    </button>
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 hidden group-hover:block">
                      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {category.subTabs.map(subTab => (
                          <a
                            key={subTab.tab}
                            href="#"
                            onClick={() => handleNavClick(subTab.tab)}
                            className={`${activeTab === subTab.tab ? 'bg-gray-100 text-blue-700' : 'text-gray-700'}
                              block px-4 py-2 text-sm hover:bg-gray-100 hover:text-blue-700`}
                            role="menuitem"
                          >
                            {subTab.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              } else if (key === 'TEAM_STATS') {
                // Team Stats tab is handled by team selection dropdown, don't render explicitly here
                return null;
              } else {
                // Render single button for direct tabs
                return (
                  <button
                    key={key}
                    onClick={() => handleNavClick(category.tab)}
                    className={`px-4 py-2 rounded-md font-semibold transition-colors duration-200
                      ${activeTab === category.tab ? 'bg-blue-800' : 'hover:bg-blue-600'}`}
                  >
                    {category.label}
                  </button>
                );
              }
            })}
          </nav>
        </div>
      </header>

      <main className="w-full max-w-6xl bg-white p-8 rounded-lg shadow-md">
        {loading ? (
          <p className="text-center text-xl text-blue-700">Loading historical data from Sleeper API, please wait...</p>
        ) : error ? (
          <p className="text-center text-xl text-red-600">Error: {error}</p>
        ) : (
          <div>
            {activeTab === TABS.DASHBOARD && (
              <Dashboard
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                currentYear={currentYear}
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
            {activeTab === TABS.MATCHUP_HISTORY && (
              <MatchupHistory
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
