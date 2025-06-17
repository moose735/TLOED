// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  // GOOGLE_SHEET_POWER_RANKINGS_API_URL is no longer needed here as PowerRankings.js derives its data from historicalMatchups
} from './config';

// Import existing components
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Power Rankings', tab: 'powerRankings' }, // Default home tab
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'Head-to-Head', tab: 'headToHead' },
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating', tab: 'luckRating' },
    ]
  },
  TEAMS: { // New category for individual team pages. subTabs will be dynamically populated with actual team names.
    label: 'Teams',
    subTabs: [],
  }
};

const TABS = {
  HOME: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail', // New tab for individual team detail pages
};


const App = () => {
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [allTeams, setAllTeams] = useState([]); // State to hold all unique team names for the 'Teams' dropdown
  const [historicalChampions, setHistoricalChampions] = useState({}); // State to hold historical champions data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.HOME); // Default tab
  const [selectedTeam, setSelectedTeam] = useState(null); // State for selected team for TeamDetailPage

  // This function maps raw team IDs/names from data to display names if NICKNAME_TO_SLEEPER_USER is used
  // Or simply returns the name as is if no mapping is provided.
  const getMappedTeamName = useCallback((rawTeamName) => {
    // Implement your mapping logic here if you have NICKNAME_TO_SLEEPER_USER
    // For now, assuming rawTeamName is the display name
    return rawTeamName;
  }, []); // Dependencies: Add NICKNAME_TO_SLEEPER_USER if it's imported and used here

  // Handler for main navigation tab changes
  const handleTabChange = useCallback((tab, team = null) => {
    setActiveTab(tab);
    setSelectedTeam(team); // Set selected team if navigating to a team-specific tab
    window.scrollTo(0, 0); // Scroll to top on tab change
  }, []);

  useEffect(() => {
    const fetchHistoricalMatchups = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Assuming data is an array of matchup objects directly
        setHistoricalMatchups(data);

        // Extract unique team names and historical champions after fetching matchups
        // This is a basic extraction; for robust data, use a dedicated calculation.
        const uniqueTeams = new Set();
        const champions = {};
        data.forEach(match => {
          if (match.team1) uniqueTeams.add(getMappedTeamName(match.team1));
          if (match.team2) uniqueTeams.add(getMappedTeamName(match.team2));

          // Simple champion extraction (refine with actual logic from calculateAllLeagueMetrics if needed)
          // This is a placeholder; real champion logic should come from calculateAllLeagueMetrics.
          if (match.finalSeedingGame === 1) { // Assuming 1 means championship
            if (parseFloat(match.team1Score) > parseFloat(match.team2Score)) {
              champions[match.year] = getMappedTeamName(match.team1);
            } else if (parseFloat(match.team2Score) > parseFloat(match.team1Score)) {
              champions[match.year] = getMappedTeamName(match.team2);
            }
          }
        });
        setAllTeams(Array.from(uniqueTeams).sort());
        setHistoricalChampions(champions);

      } catch (error) {
        console.error("Error fetching historical matchups:", error);
        setError("Failed to load historical matchup data.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalMatchups();
  }, [getMappedTeamName]); // getMappedTeamName is a dependency because it's used inside useEffect

  // Dynamically populate the 'Teams' subTabs once team data is available
  useEffect(() => {
    if (allTeams.length > 0) {
      NAV_CATEGORIES.TEAMS.subTabs = allTeams.map(team => ({
        label: team,
        tab: TABS.TEAM_DETAIL,
        teamName: team, // Pass the team name for the TeamDetailPage
      }));
    }
  }, [allTeams]);


  // Helper to render the navigation item, managing active state and dropdowns
  const renderNavItem = (category) => {
    const isActive = category.tab === activeTab || (category.subTabs && category.subTabs.some(sub => sub.tab === activeTab));

    if (category.subTabs && category.subTabs.length > 0) {
      return (
        <div key={category.label} className="relative group">
          <button
            className={`py-2 px-3 text-sm font-medium rounded-lg hover:bg-blue-600 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isActive ? 'bg-blue-700 text-white' : 'text-blue-700 bg-blue-100'}`
            }
          >
            {category.label}
          </button>
          <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 hidden group-hover:block">
            <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
              {category.subTabs.map(sub => (
                <button
                  key={sub.label}
                  onClick={() => handleTabChange(sub.tab, sub.teamName || null)}
                  className={`block w-full text-left px-4 py-2 text-sm ${activeTab === sub.tab && selectedTeam === sub.teamName ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                  role="menuitem"
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <button
          key={category.label}
          onClick={() => handleTabChange(category.tab)}
          className={`py-2 px-3 text-sm font-medium rounded-lg hover:bg-blue-600 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${activeTab === category.tab ? 'bg-blue-700 text-white' : 'text-blue-700 bg-blue-100'}`
          }
        >
          {category.label}
        </button>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-900">
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 shadow-md">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-extrabold mb-2 sm:mb-0">Fantasy League Dashboard</h1>
          <nav className="flex flex-wrap justify-center sm:justify-end gap-2">
            {Object.values(NAV_CATEGORIES).map(renderNavItem)}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading && (
          <p className="text-center text-lg text-blue-600">Loading historical data...</p>
        )}
        {error && (
          <p className="text-center text-lg text-red-600">Error: {error}</p>
        )}
        {!loading && !error && (
          <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
            {activeTab === TABS.HOME && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                // powerRankingsData prop removed as PowerRankings.js now calculates its own DPR from historicalMatchups
              />
            )}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                historicalChampions={historicalChampions}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
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
                historicalChampions={historicalChampions}
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
