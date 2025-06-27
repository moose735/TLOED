// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  CURRENT_LEAGUE_ID, // Import CURRENT_LEAGUE_ID from config
  NICKNAME_TO_SLEEPER_USER // Import custom nickname map from config
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
  fetchLeagueDetails,
  fetchAllHistoricalMatchups,
  fetchUsersData, // Needed to map user_ids
  fetchRostersWithDetails, // Needed to map roster_ids to user_ids
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
  const [allUsers, setAllUsers] = useState([]); // All users across historical leagues
  const [allRosters, setAllRosters] = useState([]); // All rosters across historical leagues
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
  // This is crucial for replacing the Google Sheet's team name logic
  const getMappedTeamName = useCallback((sleeperId) => {
    // 1. Check custom nicknames first (if user_id based)
    if (NICKNAME_TO_SLEEPER_USER[sleeperId]) {
      return NICKNAME_TO_SLEEPER_USER[sleeperId];
    }

    // 2. Try to find by user_id
    const user = allUsers.find(u => u.user_id === sleeperId);
    if (user) {
      return user.display_name;
    }

    // 3. Try to find by roster_id (from rosters data)
    // This assumes sleeperId passed might be a roster_id from matchups
    const roster = allRosters.find(r => r.roster_id === sleeperId);
    if (roster && roster.owner_id) {
      const owner = allUsers.find(u => u.user_id === roster.owner_id);
      if (owner) {
        // Prioritize custom nickname for owner_id if available
        if (NICKNAME_TO_SLEEPER_USER[owner.user_id]) {
          return NICKNAME_TO_SLEEPER_USER[owner.user_id];
        }
        return owner.display_name;
      }
    }

    // Fallback if no mapping is found
    console.warn(`Could not map Sleeper ID: ${sleeperId} to a display name.`);
    return `Unknown Team (${sleeperId})`;
  }, [allUsers, allRosters]); // Depend on allUsers and allRosters as they are fetched async

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all users and rosters first, as they are needed for mapping
        // You might need to fetch users/rosters for CURRENT_LEAGUE_ID initially,
        // and then fetch for previous league IDs as you traverse history in fetchAllHistoricalMatchups.
        // For simplicity here, let's assume fetchUsersData and fetchRostersWithDetails
        // can eventually cover all relevant users/rosters if league history is well-handled.

        // For robust historical mapping, you might need to fetch users and rosters for *each* league ID
        // encountered during the historical traversal, or ensure your main fetches cover enough.
        // For now, let's fetch for the CURRENT_LEAGUE_ID and rely on `getMappedTeamName`'s logic.
        const users = await fetchUsersData(CURRENT_LEAGUE_ID);
        const rosters = await fetchRostersWithDetails(CURRENT_LEAGUE_ID);

        setAllUsers(users);
        setAllRosters(rosters);

        // Fetch all historical matchups using the Sleeper API
        const rawHistoricalMatchups = await fetchAllHistoricalMatchups(CURRENT_LEAGUE_ID);

        if (!rawHistoricalMatchups || rawHistoricalMatchups.length === 0) {
          throw new Error('No historical matchup data found from Sleeper API.');
        }

        // Now, process the raw matchups to resolve roster_ids to display names
        // This makes sure all child components receive display names directly
        const processedMatchups = rawHistoricalMatchups.map(match => {
          const team1DisplayName = getMappedTeamName(match.roster_id_1);
          const team2DisplayName = getMappedTeamName(match.roster_id_2);

          return {
            ...match,
            team1: team1DisplayName,
            team2: team2DisplayName,
            // Ensure team1Score and team2Score are numbers
            team1Score: parseFloat(match.team1Score),
            team2Score: parseFloat(match.team2Score),
            year: parseInt(match.year), // Ensure year is number
            week: parseInt(match.week), // Ensure week is number
          };
        }).filter(match => match.team1 !== `Unknown Team (${match.roster_id_1})` && match.team2 !== `Unknown Team (${match.roster_id_2})`); // Filter out unmapped teams


        setHistoricalMatchups(processedMatchups);

      } catch (err) {
        console.error("Error loading all data:", err);
        setError(err.message || 'Failed to load historical data.');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [getMappedTeamName]); // Re-run if getMappedTeamName changes (due to allUsers/allRosters update)


  // Helper for tab navigation
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
                    onClick={() => { setActiveTab(subTab.tab); setSelectedTeam(null); }} // Clear selected team on tab change
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
              onClick={() => { setActiveTab(category.tab); setSelectedTeam(null); }} // Clear selected team on tab change
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
          <div className="text-center text-blue-700 text-lg mt-8">Loading league data...</div>
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

           {/* Render TeamDetailPage when selected */}\
           {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
             <TeamDetailPage
               teamName={selectedTeam}
               historicalMatchups={historicalMatchups}
               getDisplayTeamName={getMappedTeamName} // Corrected prop name to match other components
             />
           )}
           {/* Render FinancialTracker */}\
            {activeTab === TABS.FINANCIALS && (
                <FinancialTracker
                    getDisplayTeamName={getMappedTeamName}
                    historicalMatchups={historicalMatchups} // Passing historical matchups for potential future integration if financial data needs it
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
