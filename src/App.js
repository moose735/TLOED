// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  CURRENT_LEAGUE_ID,
  NICKNAME_TO_SLEEPER_USER
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
import HistoricalMatchupsByYear from './components/HistoricalMatchupsByYear';

// Import Sleeper API functions
import {
  fetchAllHistoricalMatchups, // Updated to return maps
  getSleeperAvatarUrl, // To use in getMappedTeamName if needed for default avatar
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
      { label: 'Matchup History', tab: 'historicalMatchups' },
      { label: 'Head-to-Head Grid', tab: 'head2HeadGrid' },
    ],
  },
  ANALYSIS: {
    label: 'Analysis',
    subTabs: [
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating Analysis', tab: 'luckRatingAnalysis' },
    ],
  },
  FINANCIALS: { label: 'Financial Tracker', tab: 'financials' },
};

const TABS = {
  DASHBOARD: 'dashboard',
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HISTORICAL_MATCHUPS: 'historicalMatchups',
  HEAD_TO_HEAD_GRID: 'head2HeadGrid',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING_ANALYSIS: 'luckRatingAnalysis',
  FINANCIALS: 'financials',
  TEAM_DETAIL: 'teamDetail', // For navigating to a specific team's page
};


function App() {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [rosterToOwnerMap, setRosterToOwnerMap] = useState(new Map());
  const [ownerToDisplayNameMap, setOwnerToDisplayNameMap] = useState(new Map());
  const [selectedTeam, setSelectedTeam] = useState(null); // For TeamDetailPage

  // Callback to handle navigation to TeamDetailPage
  const handleSelectTeam = useCallback((teamName) => {
    setSelectedTeam(teamName);
    setActiveTab(TABS.TEAM_DETAIL);
  }, []);

  // Function to go back from TeamDetailPage to the previous view (e.g., Dashboard or records)
  const handleGoBack = useCallback(() => {
    setSelectedTeam(null);
    setActiveTab(TABS.DASHBOARD); // Or a more sophisticated way to remember the previous tab
  }, []);

  // Function to map Sleeper roster_id/user_id to a displayable team name
  const getMappedTeamName = useCallback((sleeperId) => {
    if (!sleeperId) {
        // console.warn('getMappedTeamName called with null or undefined Sleeper ID.');
        return 'Unknown Team'; // Fallback for invalid input
    }

    // Attempt to map directly if it's an owner_id/user_id
    if (ownerToDisplayNameMap.has(sleeperId)) {
        return ownerToDisplayNameMap.get(sleeperId);
    }

    // If it's a roster_id, find its owner_id, then map to display name
    const ownerId = rosterToOwnerMap.get(sleeperId.toString());
    if (ownerId && ownerToDisplayNameMap.has(ownerId)) {
        return ownerToDisplayNameMap.get(ownerId);
    }

    // Fallback if no mapping is found
    // console.warn(`Could not map Sleeper ID: ${sleeperId} to a display name.`);
    return `Unknown Team (${sleeperId.substring(0, 8)}...)`; // Truncate for display
  }, [rosterToOwnerMap, ownerToDisplayNameMap]);


  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { matchups, rosterToOwnerMap: rToOMap, ownerToDisplayNameMap: oToDMap } = await fetchAllHistoricalMatchups(CURRENT_LEAGUE_ID);

        setRosterToOwnerMap(rToOMap);
        setOwnerToDisplayNameMap(oToDMap);

        if (!matchups || matchups.length === 0) {
          throw new Error('No historical matchup data found from Sleeper API.');
        }

        // Now, process the raw matchups to resolve roster_ids to display names
        const processedMatchups = matchups.map(match => {
          const team1DisplayName = getMappedTeamName(match.roster_id_1);
          const team2DisplayName = match.roster_id_2 ? getMappedTeamName(match.roster_id_2) : null; // Handle bye weeks
          
          return {
            ...match,
            team1: team1DisplayName,
            team2: team2DisplayName,
            // Ensure team1Score and team2Score are numbers
            team1Score: parseFloat(match.team1Score),
            team2Score: match.team2Score !== null ? parseFloat(match.team2Score) : null,
            year: parseInt(match.year), // Ensure year is number
            week: parseInt(match.week), // Ensure week is number
          };
        }).filter(match => match.team1 !== 'Unknown Team'); // Filter out any matchups where team1 couldn't be mapped


        setHistoricalMatchups(processedMatchups);

      } catch (err) {
        console.error("Error loading all data:", err);
        setError(err.message || 'Failed to load historical data.');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [getMappedTeamName]); // getMappedTeamName is stable due to useCallback and its dependencies

  // Helper for tab navigation (desktop)
  const renderNavButtons = () => (
    <nav className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-10">
      <div className="container mx-auto flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4">
        {Object.values(NAV_CATEGORIES).map(category => (
          category.subTabs ? (
            <div key={category.label} className="relative group">
              <button
                className="px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
              >
                {category.label} <span className="ml-1">&#9662;</span>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 visibility-hidden group-hover:visible transition-opacity duration-200 z-20">
                {category.subTabs.map(subTab => (
                  <button
                    key={subTab.tab}
                    onClick={() => { setActiveTab(subTab.tab); setSelectedTeam(null); }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${activeTab === subTab.tab ? 'bg-gray-100 font-semibold' : ''}`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              key={category.tab}
              onClick={() => { setActiveTab(category.tab); setSelectedTeam(null); }}
              className={`px-4 py-2 rounded-md ${activeTab === category.tab ? 'bg-blue-800' : 'hover:bg-blue-600'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200`}
            >
              {category.label}
            </button>
          )
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-blue-800 text-white p-6 shadow-lg">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-extrabold mb-2 sm:mb-0">Fantasy League Central</h1>
          {selectedTeam && activeTab === TABS.TEAM_DETAIL && (
            <button
              onClick={handleGoBack}
              className="mt-2 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
            >
              &larr; Back to Dashboard
            </button>
          )}
        </div>
      </header>

      {renderNavButtons()}

      <main className="container mx-auto p-4 flex-grow">
        {loading ? (
          <div className="text-center text-blue-700 text-lg mt-8">
            <svg className="animate-spin h-10 w-10 text-blue-500 mb-3 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading league data...
          </div>
        ) : error ? (
          <div className="text-center text-red-700 text-lg mt-8">Error: {error}</div>
        ) : (
          <div className="mt-4">
            {/* Render Dashboard */}
            {activeTab === TABS.DASHBOARD && (
              <Dashboard getDisplayTeamName={getMappedTeamName} />
            )}

            {/* Render PowerRankings */}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                onSelectTeam={handleSelectTeam}
              />
            )}

            {/* Render LeagueHistory */}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                onSelectTeam={handleSelectTeam}
              />
            )}

            {/* Render RecordBook */}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                onSelectTeam={handleSelectTeam}
              />
            )}

            {/* Render DPRAnalysis */}
            {activeTab === TABS.DPR_ANALYSIS && (
              <DPRAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                onSelectTeam={handleSelectTeam}
              />
            )}

            {/* Render LuckRatingAnalysis */}
            {activeTab === TABS.LUCK_RATING_ANALYSIS && (
              <LuckRatingAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
                onSelectTeam={handleSelectTeam}
              />
            )}

            {/* Render Head2HeadGrid */}
            {activeTab === TABS.HEAD_TO_HEAD_GRID && (
              <Head2HeadGrid
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
               getDisplayTeamName={getMappedTeamName}
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
}

export default App;
