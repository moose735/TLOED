// App.js
import React, { useState, useEffect, useCallback } from 'react';
import PowerRankings from './lib/PowerRankings';
import MatchupHistory from './lib/MatchupHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis'; // Import the new LuckRatingAnalysis component
import { HISTORICAL_MATCHUPS_API_URL } from './config'; // Import the API URL

const TABS = {
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating', // New tab for Luck Rating Analysis
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);

  const getMappedTeamName = useCallback((originalName) => {
    return originalName;
  }, []);

  // Centralized data fetching for historical matchups
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
        setHistoricalMatchups(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error("Error fetching historical matchups in App.js:", err);
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


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Tailwind CSS CDN for styling */}
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />

      <header className="w-full max-w-4xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Fantasy League Dashboard</h1>
        <p className="text-xl">Your central hub for league insights!</p>
      </header>

      {/* Navigation Tabs */}
      <nav className="w-full max-w-4xl bg-white rounded-lg shadow-md mb-8 p-2 flex justify-center space-x-4">
        <button
          className={`px-6 py-2 rounded-md font-semibold text-lg transition-colors ${
            activeTab === TABS.POWER_RANKINGS
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.POWER_RANKINGS)}
        >
          Power Rankings
        </button>
        <button
          className={`px-6 py-2 rounded-md font-semibold text-lg transition-colors ${
            activeTab === TABS.LEAGUE_HISTORY
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.LEAGUE_HISTORY)}
        >
          League History
        </button>
        <button
          className={`px-6 py-2 rounded-md font-semibold text-lg transition-colors ${
            activeTab === TABS.RECORD_BOOK
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.RECORD_BOOK)}
        >
          Record Book
        </button>
        <button
          className={`px-6 py-2 rounded-md font-semibold text-lg transition-colors ${
            activeTab === TABS.DPR_ANALYSIS
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.DPR_ANALYSIS)}
        >
          DPR Analysis
        </button>
        <button
          className={`px-6 py-2 rounded-md font-semibold text-lg transition-colors ${
            activeTab === TABS.LUCK_RATING // New tab button
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.LUCK_RATING)} // Set active tab
        >
          Luck Rating
        </button>
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
        {activeTab === TABS.LUCK_RATING && ( // Render LuckRatingAnalysis component
          <LuckRatingAnalysis
            historicalMatchups={historicalMatchups}
            getDisplayTeamName={getMappedTeamName}
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
