// App.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HISTORICAL_MATCHUPS_API_URL,
  GOOGLE_SHEET_POWER_RANKINGS_API_URL,
} from './config';

import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';


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
    subTabs: [],
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
};


function App() {
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [error, setError] = useState(null);
  const [allTeamNames, setAllTeamNames] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);


  const fetchAllTeamNames = useCallback(async () => {
    setLoadingInitialData(true);
    setError(null);
    try {
      const response = await fetch(HISTORICAL_MATCHUPS_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received data from HISTORICAL_MATCHUPS_API_URL:', data); // Added console log

      let matchupsArray = [];
      if (data && Array.isArray(data.historicalMatchups)) {
        matchupsArray = data.historicalMatchups;
      } else if (Array.isArray(data)) {
        matchupsArray = data;
      } else {
        // More specific error message
        throw new Error("API returned an unexpected data format. Expected an array or an object with 'historicalMatchups' array.");
      }

      const uniqueTeams = new Set();
      matchupsArray.forEach(match => {
        if (match.team1) uniqueTeams.add(match.team1.trim());
        if (match.team2) uniqueTeams.add(match.team2.trim());
      });
      const sortedTeamNames = Array.from(uniqueTeams).sort();
      setAllTeamNames(sortedTeamNames);
    } catch (e) {
      console.error("Failed to fetch initial data:", e); // Updated console error message
      // Updated error message to include more detail
      setError(`Failed to load initial data. Details: ${e.message}. Please check API URL and response format.`);
    } finally {
      setLoadingInitialData(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTeamNames();
  }, [fetchAllTeamNames]);


  const getMappedTeamName = useCallback((rawName) => {
    return rawName;
  }, []);

  const teamSubTabs = useMemo(() => {
    return allTeamNames.map(teamName => ({
      label: getMappedTeamName(teamName),
      tab: TABS.TEAM_DETAIL,
      teamName: teamName,
    }));
  }, [allTeamNames, getMappedTeamName]);

  useEffect(() => {
    if (NAV_CATEGORIES.TEAMS) {
      NAV_CATEGORIES.TEAMS.subTabs = teamSubTabs;
    }
  }, [teamSubTabs]);


  const handleTabChange = (tab, teamName = null) => {
    setActiveTab(tab);
    setSelectedTeam(teamName);
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
