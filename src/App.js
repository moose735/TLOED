// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Still imported, but PowerRankings.js no longer uses it directly
} from './config';

// Import existing components from your provided App.js
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory'; // Corrected import to the LeagueHistory component
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid'; // Stays for its own tab


// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Power Rankings', tab: 'powerRankings' }, // Default home tab
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
    subTabs: [], // This will be dynamically populated with team names
  }
};

// Define tabs as constants for easier reference
const TABS = {
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail', // New tab for individual team details
};


function App() {
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [error, setError] = useState(null);
  const [allTeamNames, setAllTeamNames] = useState([]); // To populate the "Teams" dropdown
  const [selectedTeam, setSelectedTeam] = useState(null); // To store the currently selected team for TeamDetailPage


  // Fetch all historical matchups data to get team names for the dropdown
  // This is a separate fetch from TeamDetailPage's internal fetch
  const fetchAllTeamNames = useCallback(async () => {
    setLoadingInitialData(true);
    setError(null);
    try {
      const response = await fetch(HISTORICAL_MATCHUPS_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      let matchupsArray = [];
      if (data && Array.isArray(data.historicalMatchups)) {
        matchupsArray = data.historicalMatchups;
      } else if (Array.isArray(data)) {
        matchupsArray = data;
      } else {
        throw new Error("Unexpected data format for historical matchups from API.");
      }

      const uniqueTeams = new Set();
      matchupsArray.forEach(match => {
        if (match.team1) uniqueTeams.add(match.team1.trim());
        if (match.team2) uniqueTeams.add(match.team2.trim());
      });
      // Sort team names alphabetically
      const sortedTeamNames = Array.from(uniqueTeams).sort();
      setAllTeamNames(sortedTeamNames);
    } catch (e) {
      console.error("Failed to fetch team names:", e);
      setError("Failed to load initial data. Please check network connection and API URLs.");
    } finally {
      setLoadingInitialData(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTeamNames();
  }, [fetchAllTeamNames]);


  // Placeholder for getMappedTeamName - replace with actual logic if needed
  // This function should map the raw team name from data to a display name.
  // Currently, it just returns the original name if no custom mapping is defined.
  const getMappedTeamName = useCallback((rawName) => {
    // You can integrate NICKNAME_TO_SLEEPER_USER from config.js here if you have it.
    // For now, it just returns the raw name or NICKNAME_TO_SLEEPER_USER[rawName] if found.
    // Ensure NICKNAME_TO_SLEEPER_USER is imported and available if you use it.
    // Example: return NICKNAME_TO_SLEEPER_USER[rawName] || rawName;
    return rawName; // Default: no mapping
  }, []); // Add NICKNAME_TO_SLEEPER_USER to dependency array if you use it inside

  // Dynamically create team sub-tabs for the "Teams" category
  const teamSubTabs = useMemo(() => {
    return allTeamNames.map(teamName => ({
      label: getMappedTeamName(teamName),
      tab: TABS.TEAM_DETAIL, // All team detail links point to the same tab
      teamName: teamName, // Store the actual team name for selection
    }));
  }, [allTeamNames, getMappedTeamName]);

  // Update NAV_CATEGORIES with dynamic team sub-tabs
  useEffect(() => {
    if (NAV_CATEGORIES.TEAMS) {
      NAV_CATEGORIES.TEAMS.subTabs = teamSubTabs;
    }
  }, [teamSubTabs]);


  const handleTabChange = (tab, teamName = null) => {
    setActiveTab(tab);
    setSelectedTeam(teamName); // Set selectedTeam when a team detail tab is clicked
  };

  if (loadingInitialData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-700">Loading initial data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 shadow-lg">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-extrabold mb-4 sm:mb-0">Fantasy Football Stats</h1>
          <nav>
            <ul className="flex flex-wrap justify-center sm:justify-end space-x-4">
              {Object.values(NAV_CATEGORIES).map(category => (
                <li key={category.label} className="relative group">
                  <button className="py-2 px-3 text-lg font-medium rounded-md hover:bg-blue-800 transition-colors duration-200">
                    {category.label}
                  </button>
                  {category.subTabs && category.subTabs.length > 0 && (
                    <ul className="absolute left-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-hover:visible transition-all duration-300 invisible z-10">
                      {category.subTabs.map(subTab => (
                        <li key={subTab.label}>
                          <button
                            onClick={() => handleTabChange(subTab.tab, subTab.teamName)}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-200 rounded-md"
                          >
                            {subTab.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {activeTab === TABS.POWER_RANKINGS && (
          <PowerRankings getMappedTeamName={getMappedTeamName} />
        )}

        {/* Render other components based on activeTab */}
        {!loadingInitialData && !error && (
          <div>
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.HEAD_TO_HEAD && (
              <Head2HeadGrid
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.DPR_ANALYSIS && (
              <DPRAnalysis
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.LUCK_RATING && (
              <LuckRatingAnalysis
                getDisplayTeamName={getMappedTeamName}
              />
            )}

           {/* Render TeamDetailPage when selected */}
           {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
              <TeamDetailPage
                teamName={selectedTeam}
                getMappedTeamName={getMappedTeamName}
              />
            )}
          </div>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8 px-4">
        <p>This site displays league data powered by Google Apps Script.</p>
        <p className="mt-2">
          For Apps Script deployment instructions, visit:{' '}
          <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Google Apps Script Web Apps Guide
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
