// App.js
import React, { useState, useCallback } from 'react';
import PowerRankings from './lib/PowerRankings';
import MatchupHistory from './lib/MatchupHistory';
import RecordBook from './lib/RecordBook'; // Import RecordBook directly

const TABS = {
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory', // Renamed from MATCHUP_HISTORY for clarity
  RECORD_BOOK: 'recordBook',      // New main tab for RecordBook
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.POWER_RANKINGS);

  const getMappedTeamName = useCallback((originalName) => {
    return originalName;
  }, []);

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
            activeTab === TABS.RECORD_BOOK // New tab
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab(TABS.RECORD_BOOK)} // New tab handler
        >
          Record Book
        </button>
      </nav>

      <main className="w-full max-w-4xl">
        {activeTab === TABS.POWER_RANKINGS && <PowerRankings />}
        {activeTab === TABS.LEAGUE_HISTORY && (
          <MatchupHistory
            getMappedTeamName={getMappedTeamName}
          />
        )}
        {activeTab === TABS.RECORD_BOOK && ( // Render RecordBook when its tab is active
          <RecordBook
            historicalMatchups={[]} // Will fetch in RecordBook, or pass down from MatchupHistory
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
