// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL,
} from './config';

// Import existing components
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
// Import the new component for rivalry comparison
import RivalryComparisonPage from './lib/RivalryComparisonPage';

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Power Rankings', tab: 'powerRankings' },
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
  TEAMS: {
    label: 'Teams',
    subTabs: [], // This will be dynamically populated
  }
};

const TABS = {
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail',
  RIVALRY_COMPARISON: 'rivalryComparison', // New tab type for comparison
};


const App = () => {
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [allTeamNames, setAllTeamNames] = useState([]);
  // NEW STATE: to hold the two team names for comparison
  const [teamsToCompare, setTeamsToCompare] = useState(null); // Will be an array: [team1, team2]


  const getMappedTeamName = useCallback((teamName) => {
    // This function remains the same, assuming it maps raw team names to display names
    // For example, if your data has "Team A" and you want to display "Awesome Team A"
    // If no mapping is needed, just return teamName
    return teamName;
  }, []);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoading(true);
      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHistoricalMatchups(data.historicalMatchups);
        setHistoricalChampions(data.historicalChampions);

        // Extract all unique team names for the Teams dropdown
        const uniqueTeamNames = new Set();
        data.historicalMatchups.forEach(season => {
          Object.values(season.teams).forEach(team => {
            uniqueTeamNames.add(team.name);
          });
        });
        setAllTeamNames(Array.from(uniqueTeamNames).sort());

      } catch (e) {
        console.error("Failed to fetch historical data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, []);

  // Effect to update NAV_CATEGORIES.TEAMS.subTabs when allTeamNames changes
  useEffect(() => {
    if (allTeamNames.length > 0) {
      NAV_CATEGORIES.TEAMS.subTabs = allTeamNames.map(teamName => ({
        label: getMappedTeamName(teamName),
        tab: `${TABS.TEAM_DETAIL}-${teamName}`, // Unique tab identifier for each team
        action: () => handleTeamSelection(teamName), // Action to set selected team
      }));
    }
  }, [allTeamNames, getMappedTeamName]);


  // New function to handle single team selection (e.g., from dropdown)
  const handleTeamSelection = useCallback((teamName) => {
    setSelectedTeam(teamName);
    setTeamsToCompare(null); // Clear comparison when viewing single team
    setActiveTab(TABS.TEAM_DETAIL); // Always switch to the Team Detail tab
  }, []);

  // NEW HANDLER: For when a rivalry cell is clicked (to compare two teams)
  const handleRivalryComparisonClick = useCallback((team1, team2) => {
    setTeamsToCompare([team1, team2]);
    setSelectedTeam(null); // Clear single team selection
    setActiveTab(TABS.RIVALRY_COMPARISON); // Switch to the new comparison tab
  }, []);


  // Function to navigate between tabs
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedTeam(null); // Clear selected team when changing main tabs
    setTeamsToCompare(null); // Clear comparison when changing main tabs
  }, []);

  const handleSubTabClick = useCallback((subTab) => {
    if (subTab.action) {
      subTab.action(); // If a sub-tab has an action (like team selection)
    } else {
      setActiveTab(subTab.tab);
      setSelectedTeam(null); // Clear selected team if not a team detail tab
      setTeamsToCompare(null); // Clear comparison if not a specific team detail/comparison tab
    }
  }, []);

  // --- RENDERING LOGIC ---
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-4 sm:mb-0">
            Fantasy Football League Stats
          </h1>
          <nav className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-2">
            {Object.entries(NAV_CATEGORIES).map(([categoryKey, category]) => (
              <div key={categoryKey} className="relative group">
                <button
                  onClick={() => category.tab && handleTabChange(category.tab)}
                  className={`text-lg font-medium py-2 px-4 rounded-lg transition-colors duration-200
                    ${activeTab === category.tab ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
                >
                  {category.label}
                </button>
                {category.subTabs && category.subTabs.length > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200">
                    {category.subTabs.map((subTab) => (
                      <button
                        key={subTab.tab}
                        onClick={() => handleSubTabClick(subTab)}
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="text-center text-xl text-gray-700">Loading historical data...</div>
        ) : error ? (
          <div className="text-center text-xl text-red-600">Error: {error}</div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-xl">
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getMappedTeamName={getMappedTeamName}
                historicalChampions={historicalChampions}
              />
            )}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                getMappedTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
                getMappedTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.HEAD_TO_HEAD && (
              <MatchupHistory
                historicalMatchups={historicalMatchups}
                getMappedTeamName={getMappedTeamName}
                // Pass the NEW handler for rivalry comparison
                onRivalryCellClick={handleRivalryComparisonClick}
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

            {/* Render TeamDetailPage when selectedTeam is set */}
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
                historicalMatchups={historicalMatchups}
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
